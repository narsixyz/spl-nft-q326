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

Each script writes what the next one needs into `mint.json` (`splMint`, `imageUri`, `metadataUri`, `asset`), so there is nothing to paste by hand. `mint.json` is gitignored. Only the transfer recipient (`const to` in `spl_transfer.ts`) is a literal.

## NFT

Run in order:

```bash
npm run nft:image      # uploads image.jpeg to Irys
npm run nft:metadata   # builds and uploads the metadata JSON
npm run nft:mint       # mints the Core NFT
npm run nft:update     # updates name/uri of an existing asset
```

`nft_update.ts` reads the asset address written to `mint.json` by `nft:mint`.

Explorers may show "no symbol", "compressed", "mutable" on Core NFTs, that's normal, not an error.

## Tests

```bash
npm test            # the whole suite, offline, no wallet or RPC needed
npm run test:watch  # re-run on change
npm run typecheck   # tsc over src/ and tests/
npm run test:devnet # verify on devnet what the scripts actually produced
```

The suite uses the Node built-in test runner through `ts-node`, so it adds no dependencies. `npm test` never sends a transaction and never calls an RPC, which means it runs in a fresh clone with no `.env`, no wallet and no `mint.json` — anything that needs those files skips itself with a reason instead of failing.

| File | What it covers |
| --- | --- |
| `tests/env.test.ts` | `src/env.ts`: the RPC URL is required and the error names `.env.example`, an empty value counts as missing, and the websocket URL falls back to public devnet. |
| `tests/spl-token.test.ts` | The SPL flow built offline against the real `@solana-program/token` instruction builders: the 82-byte mint layout, `initializeMint` with 6 decimals, ATA derivation (determinism plus a pinned address, so a dependency bump cannot silently move it), `mintTo` amounts in base units, `transferChecked` amount and decimals, and a full build/sign/extract-signature pass with no RPC. |
| `tests/nft-core.test.ts` | The NFT flow: `devnet-wallet.json` resolves to the same address in `@solana/kit` and umi (the spl half and the nft half must sign as one wallet), umi identity and mpl-core registration, a Metaplex Core JSON-schema validator, and the shape of a recorded `mint.json`. |
| `tests/project-config.test.ts` | That the repo stays wired together: every documented npm script exists and points at a real file, the Makefile only invokes real scripts and keeps both flows in their required order, `.env.example` documents every variable `src/env.ts` reads, the README mentions every script, and no `.env`, wallet or `mint.json` is tracked by git. |
| `tests/typecheck.test.ts` | Compiles `src/` and `tests/` under strict mode. Every script runs its work in a top-level IIFE, so importing one would fire real transactions; compiling is what still covers all eight. Skips without `devnet-wallet.json`, which the scripts import as a JSON module. |
| `tests/devnet.integration.test.ts` | Opt-in, read-only, no transactions. Checks the wallet is funded, the recorded mint has 6 decimals and the right authority, the ATA holds a supply, the Core asset is owned by the wallet, and the uploaded metadata is valid and points at the uploaded image. |

Several tests compare the scripts against each other rather than re-running them — the decimals in `spl_init.ts` must match the decimals in `spl_transfer.ts`, the asset name must agree across `nft_metadata.ts`, `nft_mint.ts` and `nft_update.ts`, and the image mime type must match between upload and metadata. Those mismatches fail on-chain with no local warning, which is exactly what makes them worth a test.

### Running the devnet suite

```bash
RUN_DEVNET_TESTS=1 npm run test:devnet
```

It needs `SOLANA_RPC_URL`, a funded `devnet-wallet.json`, and a `mint.json` left behind by a previous run. Without `RUN_DEVNET_TESTS=1` the whole file skips, so `npm test` stays offline. Individual cases skip for whichever key `mint.json` is missing, so an NFT-only run reports the SPL checks as skipped rather than failing them.

Note that `make test` is not this suite — it runs both script flows end to end against devnet and spends SOL.

## Troubleshooting

- `ENOENT ... image.jpeg`: run scripts from the project root via `npm run`, not directly.
- `429 Too Many Requests`: public devnet RPC is rate-limited, use a keyed RPC.
- `SOLANA_RPC_URL is not set`: copy `.env.example` to `.env` and fill it in.
- Tests skipping with `mint.json not found` or `devnet-wallet.json not found`: expected in a fresh clone, those files are gitignored.
- `npm run typecheck` failing with `Cannot find module '../../devnet-wallet.json'`: the scripts import the wallet as a JSON module, so `tsc` needs the file to exist. Add your wallet, or `echo '[]' > devnet-wallet.json` to typecheck without one.

## Docs

- [Solana token docs](https://solana.com/docs/tokens)
- [Solana Kit](https://www.solanakit.com/)
- [Metaplex Token Metadata](https://www.metaplex.com/docs/smart-contracts/token-metadata)
- [Metaplex Core](https://www.metaplex.com/docs/smart-contracts/core)
