// @ts-check
import fs from "node:fs";
import { stringify } from "csv-stringify";
import { pipeline } from "node:stream/promises";
import { Querier } from "../querier.js";
import {
  KUJIRA_RPC,
  MANTA_DAO_ADDRESS,
  MIN_DELAY_BETWEEN_QUERIES,
} from "../constants.js";

async function main() {
  const lower_proposal_id = 1;
  const higher_proposal_id = 213;

  const querier = await Querier.fromRPC(KUJIRA_RPC, MANTA_DAO_ADDRESS, {
    batchSizeLimit: 100,
    dispatchInterval: MIN_DELAY_BETWEEN_QUERIES,
  });

  let config = await querier.getConfig();

  /**
   * @type {{"time": number }}
   */
  // @ts-expect-error
  const proposalVoteDuration = config.max_voting_period;
  const convertedProposalDuration = BigInt(proposalVoteDuration.time * 1000);

  let current = higher_proposal_id;
  /**
   * @type {number[]}
   */
  const proposalIDs = [];
  while (current >= lower_proposal_id) {
    proposalIDs.push(current);
    current--;
  }

  /**
   * @type {{id: number; expiration: bigint;}[]}
   */
  const allProposalsAccumulator = [];
  for await (const proposals of await querier.getAllProposals(
    Math.min(...proposalIDs),
    Math.max(...proposalIDs)
  )) {
    allProposalsAccumulator.push(...proposals);
  }

  /**
   * @type {Record<string, bigint>}
   */
  const proposalIdToStart = allProposalsAccumulator.reduce((p, c) => {
    // NOTE: convert CosmWasm timestamp
    const start = c.expiration / BigInt(1_000_000) - convertedProposalDuration;
    return {
      ...p,
      [c.id]: start,
    };
  }, {});

  const ws = fs.createWriteStream(
    `./output/governance-${lower_proposal_id}-${higher_proposal_id}.csv`
  );

  const stringifier = stringify({
    header: true,
    columns: ["id", "voter", "vote", "start", "iso"],
  });
  const allVotes = (
    await Promise.all(
      proposalIDs.map(async (id) => {
        /**
         * @type {import("../codegen/Cw3.types.js").VoteInfo[]}
         */
        let allVotes = [];
        for await (const votes of querier.getAllVotesFor(id)) {
          allVotes.push(...votes);
        }

        return allVotes.flatMap((v) => {
          const start = proposalIdToStart[id].toString();
          const iso = new Date(Number(start)).toISOString();

          return {
            vote: v.vote,
            voter: v.voter,
            id,
            start,
            iso,
          };
        });
      })
    )
  ).flatMap((v) => v);

  allVotes.forEach((v) => {
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
