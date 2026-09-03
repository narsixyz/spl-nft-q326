# Solana SPL Token & MPL Core NFT Scripts

TypeScript scripts to mint and transfer an SPL token, and mint/update a Metaplex Core NFT on Solana devnet.

## What's here

1. Mint and transfer your own SPL token: create a mint, attach metadata, mint tokens into an ATA, transfer to another wallet.
2. Mint an NFT using MPL Core: upload an image and metadata JSON to Irys, then mint the asset on-chain.
3. Update an NFT's name and metadata in place using the update authority.

## Prerequisites

- Node.js v18+ and npm
- A funded devnet wallet (see Setup below)
- An image file at the project root (only needed for the NFT flow, `image.jpeg` by default)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your RPC endpoint

Copy the example env file and add your RPC URL:

```bash
cp .env.example .env
```

Then edit `.env`:

```dotenv
# Keyed endpoints (Helius, QuickNode, Alchemy) are far more reliable than the free public one
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY

# WebSocket endpoint used to wait for transaction confirmation (optional)
SOLANA_RPC_WSS=wss://api.devnet.solana.com
```

`.env` is gitignored and never committed. Only `.env.example`, with placeholders, lives in the repo. Don't hardcode RPC keys or push them to git.

### 3. Add your devnet wallet

Place a keypair file at the project root:

```
root/
└── devnet-wallet.json
```

It needs to be a JSON array of 64 numbers, the ed25519 secret key (32-byte private key followed by its 32-byte derived public key), e.g. `[174, 23, ...]`.

Fund it with devnet SOL from a faucet. The public airdrop endpoint gets rate-limited a lot, so if it fails just try https://faucet.solana.com directly.

`devnet-wallet.json` is gitignored, don't commit it.

### 4. Add your image (NFT flow only)

```
root/
└── image.jpeg
```

## Environment variables

- `SOLANA_RPC_URL` (required): devnet RPC endpoint. Use a keyed provider for reliability.
- `SOLANA_RPC_WSS` (optional): websocket endpoint used by `sendAndConfirm`, defaults to the public devnet one.

All scripts load these from `.env` through `src/env.ts` and throw a clear error if `SOLANA_RPC_URL` is missing.

## SPL token flow

Uses `@solana/kit` and `@solana-program/token` for transactions, and `mpl-token-metadata` (via UMI) for the on-chain name/symbol/URI.

Run these in order, each one logs an address or signature you paste into the next:

- `npm run spl:init` (`spl_init.ts`): creates and initializes the mint (6 decimals). Copy the mint address into `spl_metadata.ts`, `spl_mint.ts`, and `spl_transfer.ts`.
- `npm run spl:metadata` (`spl_metadata.ts`): attaches name, symbol and URI to the mint.
- `npm run spl:mint` (`spl_mint.ts`): creates your ATA and mints 1,000,000 tokens into it.
- `npm run spl:transfer` (`spl_transfer.ts`): transfers 100 tokens to another wallet, ATA to ATA. Set the recipient in `const to`.

## NFT flow

Uses `mpl-core` via UMI. Images and metadata JSON get stored on Irys.

- `npm run nft:image` (`nft_image.ts`): uploads `image.jpeg` to Irys, logs the image URI.
- `npm run nft:metadata` (`nft_metadata.ts`): builds the metadata JSON (Metaplex Core schema) and uploads it, logs the metadata URI.
- `npm run nft:mint` (`nft_mint.ts`): mints the Core asset on-chain, logs the asset address.
- `npm run nft:update` (`nft_update.ts`): updates the name/URI of an existing asset.

A few things the explorer shows that aren't errors:

- No symbol: Core NFTs don't have a symbol field at all.
- Compressed: how Core assets get labeled by explorers.
- Mutable: `create()` mints a mutable asset by default.

### Updating an existing NFT

`nft_update.ts` calls `updateV1` and works because the minting wallet is the asset's update authority by default.

1. Paste the asset address logged by `npm run nft:mint` into `const asset`.
2. Set `newName` and `newUri`.
3. Run `npm run nft:update`.

If you changed the off-chain metadata JSON, re-run `nft_metadata.ts` first to get a fresh URI.

## Security

- `.env` and `devnet-wallet.json` are gitignored, check `git status` before pushing anything.
- Never commit real API keys or keypair files.
- `src/env.ts` throws if `SOLANA_RPC_URL` is missing instead of silently falling back to the throttled public RPC.

## Troubleshooting

- `Error: ENOENT ... image.jpeg`: scripts resolve paths from the project root via `npm run`, make sure the image is at `./image.jpeg`.
- `HTTP error (429): Too Many Requests`: public devnet RPC is rate-limited, use a keyed RPC in `.env`.
- `The provided private key does not match`: `devnet-wallet.json` needs to be a real ed25519 keypair (64 numbers), not random bytes.
- `SOLANA_RPC_URL is not set`: copy `.env.example` to `.env` and fill in your RPC URL.

## Learning resources

- [Solana token docs](https://solana.com/docs/tokens): mint accounts, token accounts, ATAs
- [Solana Kit](https://www.solanakit.com/): the JS SDK used here for building and sending transactions
- [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata): SPL token metadata
- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core): the NFT standard used in the NFT scripts
