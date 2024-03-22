export type Root = Record<string, [Pool, Pool]>;

export interface Pool {
  symbol: string;
  amount: number;
  denom: string;
  coingecko_id: string;
  liquidity: number;
  liquidity_24h_change: number;
  volume_24h: number;
  volume_24h_change: number;
  volume_7d: number;
  price: number;
  fees: string;
}
