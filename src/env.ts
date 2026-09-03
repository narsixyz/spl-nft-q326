import "dotenv/config";

export function getRpcUrl(): string {
  const url = process.env.SOLANA_RPC_URL;
  if (!url) {
    throw new Error(
      "SOLANA_RPC_URL is not set. Copy .env.example to .env and add your RPC URL, then run the script again.",
    );
  }
  return url;
}

export function getRpcSubscriptionsUrl(): string {
  return process.env.SOLANA_RPC_WSS ?? "wss://api.devnet.solana.com";
}