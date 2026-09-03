# Solana SPL Token & MPL Core NFT Scripts

TypeScript scripts to mint an SPL token and an NFT on Solana devnet.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `SOLANA_RPC_URL` to a devnet RPC (the free public one gets rate-limited fast, a keyed endpoint like Helius works better).

Add a funded devnet wallet keypair at the project root as `devnet-wallet.json` (array of 64 numbers). Fund it at https://faucet.solana.com.

For the NFT flow, also add an image at the project root as `image.jpeg`.

Both `.env` and `devnet-wallet.json` are gitignored, never commit them.

## SPL token

Run in order:

```bash
npm run spl:init       # creates the mint
npm run spl:metadata   # attaches name/symbol/uri
npm run spl:mint       # mints tokens into your ATA
npm run spl:transfer   # sends tokens to another wallet
```

Each script logs an address you need to paste into the next one (`const mint`, `const to`, etc).

## NFT

Run in order:

```bash
npm run nft:image      # uploads image.jpeg to Irys
npm run nft:metadata   # builds and uploads the metadata JSON
npm run nft:mint       # mints the Core NFT
npm run nft:update     # updates name/uri of an existing asset
```

`nft_update.ts` needs the asset address from `nft:mint` pasted into `const asset`.

Explorers may show "no symbol", "compressed", "mutable" on Core NFTs, that's normal, not an error.

## Troubleshooting

- `ENOENT ... image.jpeg`: run scripts from the project root via `npm run`, not directly.
- `429 Too Many Requests`: public devnet RPC is rate-limited, use a keyed RPC.
- `SOLANA_RPC_URL is not set`: copy `.env.example` to `.env` and fill it in.

## Docs

- [Solana token docs](https://solana.com/docs/tokens)
- [Solana Kit](https://www.solanakit.com/)
- [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata)
- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core)
