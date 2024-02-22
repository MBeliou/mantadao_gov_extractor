// @ts-check
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { HttpBatchClient, Tendermint34Client } from "@cosmjs/tendermint-rpc";
import fs from "node:fs";
import { stringify } from "csv-stringify";
import { pipeline } from "node:stream/promises";

//const KUJIRA_RPC = "https://rpc-kujira.whispernode.com:443";
const KUJIRA_RPC = "https://kujira-rpc.polkachu.com";
const MANTA_DAO_ADDRESS =
  "kujira15e682nq9jees29rm9j3h030af86lq2qtlejgphlspzqcvs9whf2q00nua5";
const MIN_DELAY_BETWEEN_QUERIES = 500;

/**
 * @typedef {import('./codegen/Cw3.types.js').QueryMsg} QueryMsg
 * @typedef {import('./codegen/Cw3.types.js').VoteListResponse} VoteListResponse
 */

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Querier {
  client;
  contractAddress;

  /**
   *
   * @param {CosmWasmClient} client
   * @param {string} address
   */
  constructor(client, address) {
    this.client = client;
    this.contractAddress = address;
  }

  /**
   *
   * @param {string} rpc
   * @param {string} contract
   * @param {Partial<import("@cosmjs/tendermint-rpc").HttpBatchClientOptions> | undefined} options
   */
  static async fromRPC(rpc, contract, options = undefined) {
    const batchClient = new HttpBatchClient(rpc, options);
    const tm = await Tendermint34Client.create(batchClient);

    const cosmwasmClient = await CosmWasmClient.create(tm);

    return new Querier(cosmwasmClient, contract);
  }

  /**
   *
   * @param {number} proposal_id
   */
  async *getAllVotesFor(proposal_id) {
    /**
     * @type {QueryMsg}
     */
    const query = {
      list_votes: {
        limit: 30,
        proposal_id: proposal_id,
        start_after: null,
      },
    };

    while (true) {
      /**
       * @type {VoteListResponse}
       */
      const { votes } = await this.client.queryContractSmart(
        this.contractAddress,
        query
      );
      if (votes.length > 0) {
        query.list_votes.start_after = votes.at(-1)?.voter;

        yield votes;
      } else {
        console.log(`#${query.list_votes.proposal_id} - Done`);
        return;
      }
    }
  }

  /**
   *
   * @param {QueryMsg} query
   * @returns {Promise<import("./codegen/Cw3.types.js").VoteInfo[]>}
   */
  async getVotesFor(query) {
    /**
     * @type {VoteListResponse}
     */
    const { votes } = await this.client.queryContractSmart(
      this.contractAddress,
      query
    );

    return votes;
  }
}

async function main() {
  const lower_proposal_id = 107;
  const higher_proposal_id = 213;

  const querier = await Querier.fromRPC(KUJIRA_RPC, MANTA_DAO_ADDRESS, {
    batchSizeLimit: 100,
    dispatchInterval: MIN_DELAY_BETWEEN_QUERIES,
  });

  let current = higher_proposal_id;
  /**
   * @type {number[]}
   */
  const proposalIDs = [];
  while (current >= lower_proposal_id) {
    proposalIDs.push(current);
    current--;
  }

  const ws = fs.createWriteStream(
    `./output/governance-${lower_proposal_id}-${higher_proposal_id}.csv`
  );

  const stringifier = stringify({
    header: true,
    columns: ["id", "voter", "vote"],
  });
  //stringifier.pipe(ws);
  const allVotes = (
    await Promise.all(
      proposalIDs.map(async (id) => {
        /**
         * @type {import("./codegen/Cw3.types.js").VoteInfo[]}
         */
        let allVotes = [];
        for await (const votes of querier.getAllVotesFor(id)) {
          allVotes.push(...votes);
        }

        return allVotes.flatMap((v) => {
          return {
            vote: v.vote,
            voter: v.voter,
            id,
          };
        });
      })
    )
  ).flatMap((v) => v);

  allVotes
    .flatMap((v) => v)
    .forEach((v) => {
      stringifier.write(v);
    });

  stringifier.end();
  await pipeline(stringifier, ws);
  ws.end();

  return;
}

main()
  .catch((e) => console.error(e))
  .finally(() => {
    process.exit();
  });
