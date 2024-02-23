// @ts-check

import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { HttpBatchClient, Tendermint34Client } from "@cosmjs/tendermint-rpc";

export class Querier {
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
     * @type {import("./codegen/Cw3.types.js").QueryMsg}
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
       * @type {import("./codegen/Cw3.types.js").VoteListResponse}
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
   * @param {import("./codegen/Cw3.types.js").QueryMsg} query
   * @returns {Promise<import("./codegen/Cw3.types.js").VoteInfo[]>}
   */
  async getVotesFor(query) {
    /**
     * @type {import("./codegen/Cw3.types.js").VoteListResponse}
     */
    const { votes } = await this.client.queryContractSmart(
      this.contractAddress,
      query
    );

    return votes;
  }

  /**
   *
   * @returns {Promise<import("./codegen/Cw3.types.js").Config>}
   */
  async getConfig() {
    /**
     * @type {import("./codegen/Cw3.types.js").QueryMsg}
     */
    const query = {
      config: {},
    };

    return this.client.queryContractSmart(this.contractAddress, query);
  }
  /**
   *
   * @param {number} from
   * @param {number} to
   * @returns
   */
  async *getAllProposals(from, to) {
    /**
     * @type {import("./codegen/Cw3.types.js").QueryMsg}
     */
    const query = {
      list_proposals: {
        limit: 30,
        start_after: null,
      },
    };

    while (true) {
      const proposals = await this.getProposals(query);
      if (proposals.length > 0) {
        query.list_proposals.start_after = proposals.at(-1)?.id;

        yield proposals;
      } else {
        console.log(`#getAllProposals - Done`);
        return;
      }
    }
  }

  /**
   *
   * @param {import("./codegen/Cw3.types.js").QueryMsg} query
   */
  async getProposals(query) {
    /**
     * @type {import("./codegen/Cw3.types.js").ProposalListResponseForEmpty}
     */
    const { proposals } = await this.client.queryContractSmart(
      this.contractAddress,
      query
    );

    return proposals.map((p) => {
      // NOTE: we'll be considering that all proposals have an expiration and that it's set to at_time
      /**
       * @type {{at_time: import("./codegen/Cw3.types.js").Timestamp}}
       */
      // @ts-expect-error jsdoc seems wonky for a | b types
      const { at_time } = p.expires;

      const expiration = BigInt(at_time);

      return {
        id: p.id,
        expiration: expiration,
      };
    });
  }

  /**
   *
   * @param {import("./codegen/Cw3.types.js").QueryMsg} query
   * @returns {Promise<import("./codegen/Cw3.types.js").VoterDetail[]>}
   */
  async getStaked(query) {
    /**
     * @type {import("./codegen/Cw3.types.js").VoterListResponse}
     */
    const { voters } = await this.client.queryContractSmart(
      this.contractAddress,
      query
    );

    return voters;
  }

  async *getAllStakers() {
    /**
     * @type {import("./codegen/Cw3.types.js").QueryMsg}
     */
    const query = {
      list_voters: {
        limit: 30,
        start_after: null,
      },
    };

    while (true) {
      /**
       * @type {import("./codegen/Cw3.types.js").VoterListResponse}
       */
      const { voters } = await this.client.queryContractSmart(
        this.contractAddress,
        query
      );
      if (voters.length > 0) {
        query.list_voters.start_after = voters.at(-1)?.addr;

        yield voters.map((v) => {
          return {
            addr: v.addr,
            staked: v.weight,
          };
        });
      } else {
        console.log(`getAllStakers - Done`);
        return;
      }
    }
  }
}
