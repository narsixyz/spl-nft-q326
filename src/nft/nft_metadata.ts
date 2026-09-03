import {
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import wallet from "../../devnet-wallet.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { getRpcUrl } from "../env";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const MINT_FILE = resolve(__dirname, "../../mint.json");

const umi = createUmi(getRpcUrl());

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(
  irysUploader({
    address: "https://devnet.irys.xyz/",
  }),
);

umi.use(signerIdentity(signer));

(async () => {
  try {
    const mintData = JSON.parse(readFileSync(MINT_FILE, "utf-8"));
    const image = mintData.imageUri;

    //json scheme : https://www.metaplex.com/docs/smart-contracts/core/json-schema
    //change the metadata
    const metadata = {
      name: "old_monk",
      description: "old_monk, a Metaplex Core NFT minted on Solana devnet.",

      image,

      attributes: [
        {
          trait_type: "Name",
          value: "old_monk",
        },
        {
          trait_type: "Collection",
          value: "old_monk",
        },
      ],

      properties: {
        files: [
          {
            type: "image/jpeg",
            uri: image,
          },
        ],
      },
    };

    const myUri = await umi.uploader.uploadJson(metadata);

    const existing = JSON.parse(readFileSync(MINT_FILE, "utf-8"));
    writeFileSync(MINT_FILE, JSON.stringify({ ...existing, metadataUri: myUri }, null, 2));

    console.log(`metadata uri: ${myUri} `);
  } catch (error) {
    console.log("error", error);
  }
})();
