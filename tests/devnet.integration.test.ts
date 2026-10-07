/**
 * On-chain verification of what the scripts actually produced on devnet.
 *
 * Skipped unless RUN_DEVNET_TESTS=1, because it needs a funded wallet, a
 * working RPC and a mint.json written by a previous run:
 *
 *   RUN_DEVNET_TESTS=1 npm run test:devnet
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { address, createSolanaRpc } from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeToken,
  fetchMint,
  findAssociatedTokenPda,
} from "@solana-program/token";
import { fetchAsset, mplCore } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import {
  devnetSkipReason,
  loadMintState,
  loadWalletBytes,
  validateCoreMetadata,
} from "./support";
import { getRpcUrl } from "../src/env";

const skip = devnetSkipReason() ?? undefined;
const TIMEOUT = 30_000;

/** Only touched inside non-skipped tests, so the preconditions hold there. */
const state = () => loadMintState()!;
const rpc = () => createSolanaRpc(getRpcUrl());

async function walletAddress(): Promise<string> {
  const umi = createUmi(getRpcUrl());
  const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(loadWalletBytes()!));
  return String(keypair.publicKey);
}

describe("devnet: wallet", { skip, timeout: TIMEOUT }, () => {
  it("is funded", async () => {
    const owner = address(await walletAddress());
    const { value: lamports } = await rpc().getBalance(owner).send();
    assert.ok(lamports > 0n, `${owner} has no SOL, fund it at https://faucet.solana.com`);
  });
});

describe("devnet: spl mint", { skip, timeout: TIMEOUT }, () => {
  const splSkip = state().splMint ? undefined : "no splMint in mint.json";

  it("exists with the decimals and authorities spl_init set", { skip: splSkip }, async () => {
    const mint = await fetchMint(rpc(), address(state().splMint!));
    const owner = await walletAddress();

    assert.equal(mint.programAddress, TOKEN_PROGRAM_ADDRESS);
    assert.equal(mint.data.decimals, 6);
    assert.equal(mint.data.isInitialized, true);
    assert.equal(mint.data.mintAuthority.__option, "Some");
    assert.equal(String((mint.data.mintAuthority as { value: string }).value), owner);
  });

  it("minted a supply into the wallet's ATA", { skip: splSkip }, async () => {
    const mint = address(state().splMint!);
    const owner = address(await walletAddress());
    const [ata] = await findAssociatedTokenPda({
      mint,
      owner,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const token = await fetchMaybeToken(rpc(), ata);
    assert.ok(token.exists, `ATA ${ata} does not exist, run npm run spl:mint`);
    assert.equal(token.data.mint, mint);
    assert.equal(token.data.owner, owner);
    assert.ok(token.data.amount > 0n, "the wallet's ATA holds no tokens");

    const supply = (await fetchMint(rpc(), mint)).data.supply;
    assert.ok(supply >= token.data.amount);
  });
});

describe("devnet: core nft", { skip, timeout: TIMEOUT }, () => {
  const assetSkip = state().asset ? undefined : "no asset in mint.json";

  it("is owned by the wallet and carries a name and uri", { skip: assetSkip }, async () => {
    const umi = createUmi(getRpcUrl()).use(mplCore());
    const asset = await fetchAsset(umi, publicKey(state().asset!));

    assert.equal(String(asset.owner), await walletAddress());
    assert.ok(asset.name.length > 0, "the asset has no name");
    assert.match(asset.uri, /^https:\/\//);
  });
});

describe("devnet: uploaded metadata", { skip, timeout: TIMEOUT }, () => {
  const uriSkip = state().metadataUri ? undefined : "no metadataUri in mint.json";

  it("is valid Core off-chain metadata", { skip: uriSkip }, async () => {
    const response = await fetch(state().metadataUri!);
    assert.equal(response.status, 200);

    const document = await response.json();
    assert.deepEqual(
      validateCoreMetadata(document),
      [],
      `metadata at ${state().metadataUri} is invalid`,
    );
  });

  it("points at the image this run uploaded", { skip: uriSkip }, async () => {
    const document = (await (await fetch(state().metadataUri!)).json()) as { image: string };
    assert.equal(document.image, state().imageUri);
  });

  it("serves the image from the recorded uri", { skip: uriSkip }, async () => {
    const response = await fetch(state().imageUri!, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^image\//);
  });
});
