// @ts-check

import fs from "node:fs";
import { stringify } from "csv-stringify";
import { pipeline } from "node:stream/promises";

const LIQUIDITY_URL =
  "https://api-osmosis.imperator.co/pools/v2/all?low_liquidity=false";

async function main() {
  const ws = fs.createWriteStream(`./output/osmosis-liquidity.csv`);

  const resp = await fetch(LIQUIDITY_URL);
  /**
   * @type {import("./types").Root}
   */
  const json = await resp.json();
  const poolIDS = Object.keys(json);

  const poolInfos = Object.keys(json).map((poolID) => {
    const [asset0, asset1] = json[poolID];

    const output = {
      poolID,
      liquidity: asset0.liquidity,
      liquidity24hChange: asset0.liquidity_24h_change,

      asset0Symbol: asset0.symbol,
      asset0Denom: asset0.denom,
      asset0Amount: asset0.amount,
      asset0gecko: asset0.coingecko_id,

      asset1Symbol: asset1.symbol,
      asset1Denom: asset1.denom,

      asset1Amount: asset1.amount,
      asset1gecko: asset1.coingecko_id,

      volume24h: asset0.volume_24h,
      volume7d: asset0.volume_7d,
      fee: asset0.fees,
    };

    return output;
  });

  const stringifier = stringify({
    header: true,
    columns: Object.keys(poolInfos[0]),
  });

  poolInfos.forEach((p) => stringifier.write(p));

  stringifier.end();
  await pipeline(stringifier, ws);
  ws.end();
}

main()
  .catch((e) => console.error(e))
  .finally(() => {
    process.exit();
  });
