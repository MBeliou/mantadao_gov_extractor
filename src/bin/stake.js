// @ts-check

import fs from "node:fs";
import { stringify } from "csv-stringify";
import { pipeline } from "node:stream/promises";
import {
  KUJIRA_RPC,
  MANTA_DAO_ADDRESS,
  MIN_DELAY_BETWEEN_QUERIES,
  Querier,
} from "../index.js";

async function main() {
  const querier = await Querier.fromRPC(KUJIRA_RPC, MANTA_DAO_ADDRESS, {
    batchSizeLimit: 100,
    dispatchInterval: MIN_DELAY_BETWEEN_QUERIES,
  });

  const latestBlock = await querier.client.getBlock();

  const ws = fs.createWriteStream(
    `./output/stakers-${latestBlock.header.height}.csv`
  );

  const stringifier = stringify({
    header: true,
    columns: ["addr", "staked"],
  });

  let voterCount = 0;
  for await (const voters of querier.getAllStakers()) {
    // voters[0].addr, weight

    voters.map((v) => stringifier.write(v));
    voterCount += voters.length;
    console.log(`${voterCount} stakers found`);
  }

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
