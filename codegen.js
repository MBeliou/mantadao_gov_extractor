import codegen from "@cosmwasm/ts-codegen";

codegen.default({
  contracts: [
    {
      name: "CW3",
      dir: "./schemas",
    },
  ],
  outPath: "./src/codegen",

  // options are completely optional ;)
  options: {
    bundle: {
      bundleFile: "index.d.ts",
      scope: "contracts",
    },
    types: {
      enabled: true,
    },
    client: {
      enabled: false,
    },
    reactQuery: {
      enabled: false,
      optionalClient: true,
      version: "v4",
      mutations: true,
      queryKeys: true,
      queryFactory: true,
    },
    recoil: {
      enabled: false,
    },
    messageComposer: {
      enabled: false,
    },
    messageBuilder: {
      enabled: false,
    },
    useContractsHooks: {
      enabled: false,
    },
  },
}).then(() => {
  console.log("✨ all done!");
});
