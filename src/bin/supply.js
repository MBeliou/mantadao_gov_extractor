// @ts-check
import { Querier } from "../querier.js";
import { QueryClient, setupBankExtension } from "@cosmjs/stargate";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { stringify } from "csv-stringify";

const RPCS = {
  //   kujira: "https://rpc-kujira.whispernode.com:443",
  kujira: "https://rpc.kujira.chaintools.tech/", //"https://kujira-rpc.lavenderfive.com:443",
  osmosis: "https://rpc.osmosis.zone/",
  neutron: "https://rpc-lb.neutron.org/",
};

const DENOMS = {
  kujira: {
    wBTC: null,
    "axl.wBTC":
      "ibc/301DAF9CB0A9E247CD478533EF0E21F48FF8118C4A51F77C8BC3EB70E5566DBC",
    nBTC: "ibc/A6826D67800ED864F3BF51D56B0165DAF2491B00D93433564158D87BAA0C82BE",

    "noble.wstETH":
      "ibc/B572E6F30E7C33D78A50D8B4E973A9C118C30F848DF31A95FAA5E4C7450A8BD0",
    "axl.wETH":
      "ibc/1B38805B1C75352B28169284F96DF56BDEBD9E8FAC005BDCC8CF0378C82AA8E7",

    USDC: "ibc/FE98AAD68F02F03565E9FA39A5E627946699B2B07115889ED812D8BA639576A9",
    "axl.USDC":
      "ibc/295548A78785A1007F232DE286149A6FF512F180AF5657780FC89C009E2C348F",

    "axl.USDT":
      "ibc/F2331645B9683116188EF36FC04A809C28BD36B54555E8705A37146D0182F045",
    USDT: null,
    USK: "factory/kujira1qk00h5atutpsv900x202pxx42npjr9thg58dnqpa72f2p7m2luase444a7/uusk",
  },
  osmosis: {
    wBTC: "factory/osmo1z0qrq605sjgcqpylfl4aa6s90x738j7m58wyatt0tdzflg2ha26q67k743/wbtc",
    "axl.wBTC":
      "ibc/D1542AA8762DB13087D8364F3EA6509FD6F009A34F00426AF9E4F9FA85CBBF1F",
    nBTC: "ibc/75345531D87BD90BF108BE7240BD721CB2CB0A1F16D4EBA71B09EC3C43E15C8F",

    "noble.wstETH":
      "ibc/2F21E6D4271DE3F561F20A02CD541DAF7405B1E9CB3B9B07E3C2AC7D8A4338A5",
    "axl.wETH":
      "ibc/EA1D43981D5C9A1C4AAEA9C23BB1D4FA126BA9BC7020A25E0AE4AA841EA25DC5",

    USDC: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
    "axl.USDC":
      "ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858",

    "axl.USDT":
      "ibc/8242AD24008032E457D2E12D46588FD39FB54FB29680C6C7663D296B383C37C4",
    USDT: "ibc/4ABBEF4C8926DDDB320AE5188CFD63267ABBCEFC0583E4AE05D6E5AA2401DDAB",
    USK: null,
  },
  neutron: {
    wBTC: "ibc/78F7404035221CD1010518C7BC3DD99B90E59C2BA37ABFC3CE56B0CFB7E8901B",
    "axl.wBTC": null,
    nBTC: "ibc/DDC3C60EE82BF544F1A0C6A983FF500EF1C14DE20071A5E1E7C0FB470E36E920",

    "noble.wstETH":
      "factory/neutron1ug740qrkquxzrk2hh29qrlx3sktkfml3je7juusc2te7xmvsscns0n2wry/wstETH", // NOTE: looks like there's actually a cw20 handing around neutron149tpx0nequ0cpctw06nk29hwfps0343wvwfh6tkhju3ra7hxvpeq8pvstf
    "axl.wETH":
      "ibc/A585C2D15DCD3B010849B453A2CFCB5E213208A5AB665691792684C26274304D",

    USDC: null,
    "axl.USDC":
      "ibc/F082B65C88E4B6D5EF1DB243CDA1D331D002759E938A0F5CD3FFDC5D53B3E349",

    "axl.USDT":
      "ibc/57503D7852EF4E1899FE6D71C5E81D7C839F76580F86F21E39348FC2BC9D7CE2",
    USDT: null,
    USK: null,
  },
};

/*
We're looking to get the current supply of various denominations on various cosmos chains. The point is to try and get an idea of what tokens are in demand or not
Right now we're looking for:
    - axl.wETH
    - axl.wstETH
    - noble(native).wstETH
    - axlUSDC
    - USDC

On the following chains:
    - Kujira
    - Osmosis
    - Neutron
*/
async function main() {
  const ws = fs.createWriteStream(
    `./output/supply-${new Date().toDateString()}.csv`
  );
  const stringifier = stringify({
    header: true,
    columns: ["network", ...Object.keys(DENOMS.kujira)],
  });

  const queriers = {
    kujira: QueryClient.withExtensions(
      (await Querier.fromRPC(RPCS.kujira, "")).tm,
      setupBankExtension
    ),
    osmosis: QueryClient.withExtensions(
      (await Querier.fromRPC(RPCS.osmosis, "")).tm,
      setupBankExtension
    ),
    neutron: QueryClient.withExtensions(
      (await Querier.fromRPC(RPCS.neutron, "")).tm,
      setupBankExtension
    ),
  };

  const networks = Object.keys(DENOMS);

  const namesToSupply = await Promise.all(
    networks.map(async (network) => {
      const querier = queriers[network];
      const denoms = Object.entries(DENOMS[network]);

      const ret = await Promise.all(
        denoms.map(async (d) => {
          const name = d[0];
          const denom = d[1];
          let supply = 0;
          if (d[1] !== null) {
            supply = await querier.bank.supplyOf(denom);
          }

          return {
            [name]: supply,
          };
        })
      );
      return { [network]: ret };
    })
  );

  const reduced = namesToSupply.reduce((p, c) => ({ ...p, ...c }));

  const reducedKeys = Object.keys(reduced);

  reducedKeys.forEach((n) => {
    const inner = reduced[n].reduce(
      (p, c) => {
        const key = Object.keys(c)[0];
        let toInsert = 0;
        if (typeof c[key] === "number") {
          toInsert = 0;
        } else {
          toInsert = c[key].amount;
        }
        return { ...p, [key]: toInsert };
      },
      { network: n }
    );
    stringifier.write(inner);
  });

  stringifier.end();
  await pipeline(stringifier, ws);
  ws.end();
}

main()
  .catch((e) => console.error(e))
  .finally(() => {
    process.exit();
  });
