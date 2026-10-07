import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createKeyPairSignerFromBytes } from "@solana/kit";
import { MPL_CORE_PROGRAM_ID, mplCore } from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import {
  BASE58_ADDRESS,
  loadMintState,
  loadWalletBytes,
  readSource,
  validateCoreMetadata,
} from "./support";

/** No request is made at construction, so this is safe offline. */
const newUmi = () => createUmi("https://api.devnet.solana.com");

describe("wallet file format", () => {
  it("loads the same address in @solana/kit and umi", async () => {
    // The spl scripts use @solana/kit and the nft scripts use umi, both reading
    // the same devnet-wallet.json. If the two disagreed, the nft flow would
    // sign as a different wallet than the one that was funded.
    const umi = newUmi();
    const keypair = umi.eddsa.createKeypairFromSeed(new Uint8Array(32).fill(7));
    const kitSigner = await createKeyPairSignerFromBytes(new Uint8Array(keypair.secretKey));

    assert.equal(keypair.secretKey.length, 64);
    assert.equal(String(kitSigner.address), String(keypair.publicKey));
  });

  it("rejects a secret key that is not 64 bytes", async () => {
    await assert.rejects(() => createKeyPairSignerFromBytes(new Uint8Array(32)));
  });

  const walletBytes = loadWalletBytes();
  const walletSkip = walletBytes ? undefined : "devnet-wallet.json not found";

  it("devnet-wallet.json is an array of 64 byte values", { skip: walletSkip }, () => {
    assert.ok(Array.isArray(walletBytes));
    assert.equal(walletBytes!.length, 64);
    for (const byte of walletBytes!) {
      assert.ok(Number.isInteger(byte) && byte >= 0 && byte <= 255, `${byte} is not a byte`);
    }
  });

  it("devnet-wallet.json loads in both libraries", { skip: walletSkip }, async () => {
    const umi = newUmi();
    const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletBytes!));
    const kitSigner = await createKeyPairSignerFromBytes(new Uint8Array(walletBytes!));
    assert.equal(String(kitSigner.address), String(keypair.publicKey));
    assert.match(String(kitSigner.address), BASE58_ADDRESS);
  });
});

describe("umi setup used by the nft scripts", () => {
  it("registers mpl-core at the canonical program address", () => {
    const umi = newUmi().use(mplCore());
    assert.equal(
      String(umi.programs.get("mplCore").publicKey),
      "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
    );
    assert.equal(String(MPL_CORE_PROGRAM_ID), "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
  });

  it("signs as the wallet identity once signerIdentity is applied", () => {
    const umi = newUmi();
    const keypair = umi.eddsa.createKeypairFromSeed(new Uint8Array(32).fill(3));
    const signer = createSignerFromKeypair(umi, keypair);
    umi.use(signerIdentity(signer));

    assert.equal(String(umi.identity.publicKey), String(keypair.publicKey));
    assert.equal(String(umi.payer.publicKey), String(keypair.publicKey));
  });

  it("generates a fresh asset address per mint", () => {
    const umi = newUmi().use(mplCore());
    const first = generateSigner(umi).publicKey;
    const second = generateSigner(umi).publicKey;

    assert.notEqual(String(first), String(second));
    assert.match(String(first), BASE58_ADDRESS);
  });

  it("rejects an address that is not valid base58", () => {
    assert.throws(() => publicKey("not-a-real-address"));
  });
});

describe("core metadata schema validator", () => {
  const validDocument = {
    name: "old_monk",
    description: "a Metaplex Core NFT",
    image: "https://gateway.irys.xyz/abc",
    attributes: [{ trait_type: "Name", value: "old_monk" }],
    properties: { files: [{ type: "image/jpeg", uri: "https://gateway.irys.xyz/abc" }] },
  };

  it("accepts a complete document", () => {
    assert.deepEqual(validateCoreMetadata(validDocument), []);
  });

  it("rejects a document with no image", () => {
    const { image, ...withoutImage } = validDocument;
    assert.ok(validateCoreMetadata(withoutImage).some((p) => /image/.test(p)));
  });

  it("rejects attributes that are missing a trait_type", () => {
    const problems = validateCoreMetadata({
      ...validDocument,
      attributes: [{ value: "old_monk" }],
    });
    assert.ok(problems.some((p) => /trait_type/.test(p)));
  });

  it("rejects an empty properties.files list", () => {
    const problems = validateCoreMetadata({ ...validDocument, properties: { files: [] } });
    assert.ok(problems.some((p) => /properties\.files/.test(p)));
  });
});

describe("source consistency across the nft flow", () => {
  it("uses one asset name in nft_metadata, nft_mint and nft_update", () => {
    const metadataName = /name:\s*"([^"]+)"/.exec(readSource("nft/nft_metadata.ts"));
    const mintName = /name:\s*"([^"]+)"/.exec(readSource("nft/nft_mint.ts"));
    const updateName = /newName\s*=\s*"([^"]+)"/.exec(readSource("nft/nft_update.ts"));

    assert.ok(metadataName && mintName && updateName, "an asset name is missing");
    assert.equal(mintName![1], metadataName![1]);
    assert.equal(updateName![1], metadataName![1]);
  });

  it("declares the image mime type consistently with the uploaded file", () => {
    const uploadType = /contentType:\s*"([^"]+)"/.exec(readSource("nft/nft_image.ts"));
    // Anchored inside properties.files so it does not match trait_type above.
    const metadataType = /files:[\s\S]*?\btype:\s*"([^"]+)"/.exec(
      readSource("nft/nft_metadata.ts"),
    );

    assert.ok(uploadType && metadataType);
    assert.equal(metadataType![1], uploadType![1]);
  });

  it("chains the flow through mint.json rather than pasted literals", () => {
    assert.match(readSource("nft/nft_image.ts"), /imageUri:\s*myUri/);
    assert.match(readSource("nft/nft_metadata.ts"), /mintData\.imageUri/);
    assert.match(readSource("nft/nft_mint.ts"), /mintData\.metadataUri/);
    assert.match(readSource("nft/nft_update.ts"), /mintData\.asset/);
  });

  it("uploads to the devnet Irys node, not mainnet", () => {
    for (const file of ["nft/nft_image.ts", "nft/nft_metadata.ts"]) {
      assert.match(readSource(file), /devnet\.irys\.xyz/, `${file} does not target devnet Irys`);
    }
  });
});

describe("mint.json state file", () => {
  const state = loadMintState();
  const skip = state ? undefined : "mint.json not found, run the scripts first";

  it("records a valid asset address", { skip }, () => {
    assert.ok(state!.asset, "no asset recorded");
    assert.match(state!.asset!, BASE58_ADDRESS);
    assert.doesNotThrow(() => publicKey(state!.asset!));
  });

  it("records https upload URIs", { skip }, () => {
    for (const key of ["imageUri", "metadataUri"] as const) {
      assert.ok(state![key], `no ${key} recorded`);
      assert.match(state![key]!, /^https:\/\//, `${key} is not an https URI`);
    }
  });

  it("records a valid spl mint address when the spl flow has run", { skip }, () => {
    if (!state!.splMint) return; // nft-only runs never write this key
    assert.match(state!.splMint, BASE58_ADDRESS);
    assert.doesNotThrow(() => publicKey(state!.splMint!));
  });

  it("keeps the image and metadata URIs distinct", { skip }, () => {
    assert.notEqual(state!.imageUri, state!.metadataUri);
  });
});
