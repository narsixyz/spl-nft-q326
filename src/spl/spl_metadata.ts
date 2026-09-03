import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import wallet from "../../devnet-wallet.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createMetadataAccountV3,
  CreateMetadataAccountV3InstructionAccounts,
  CreateMetadataAccountV3InstructionArgs,
  DataV2Args,
} from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";
import { getRpcUrl } from "../env";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const MINT_FILE = resolve(__dirname, "../../mint.json");
const mintData = JSON.parse(readFileSync(MINT_FILE, "utf-8"));
const mint = publicKey(mintData.splMint);

const umi = createUmi(getRpcUrl());

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(signerIdentity(signer));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    const accounts: CreateMetadataAccountV3InstructionAccounts = {
      mint,
      mintAuthority: signer,
    };

    const data: DataV2Args = {
      name: "Test Token",
      symbol: "TEST",
      uri: "https://example.com/token.json",
      sellerFeeBasisPoints: 0,
      creators: null,
      collection: null,
      uses: null,
    };

    const args: CreateMetadataAccountV3InstructionArgs = {
      data,
      isMutable: true,
      collectionDetails: null,
    };

    const tx = createMetadataAccountV3(umi, {
      ...accounts,
      ...args,
    });

    let result;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        result = await tx.sendAndConfirm(umi);
        break;
      } catch (e: any) {
        const logs = JSON.stringify(e?.logs ?? e?.cause ?? "");
        const isRpc = /range end index|Provided owner|InvalidPublicKey|503|429|Failed to fetch/i.test(logs);
        if (attempt === 5 || !isRpc) throw e;
        console.log(`attempt ${attempt} failed, retrying in ${attempt * 3}s...`);
        await sleep(attempt * 3000);
      }
    }

    console.log("signature: ", bs58.encode(Buffer.from(result!.signature)));
  } catch (error) {
    console.log("error", error);
  }
})();
