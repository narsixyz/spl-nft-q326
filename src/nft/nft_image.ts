import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { readFile } from "fs/promises";

import wallet from "../../devnet-wallet.json";
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
    //chanege image path to your image path
    const image = await readFile("image.jpeg");

    //change the image name and mime type
    const file = createGenericFile(image, "image.jpeg", {
      contentType: "image/jpeg",
    });

    const [myUri] = await umi.uploader.upload([file]);

    const existing = JSON.parse(readFileSync(MINT_FILE, "utf-8"));
    writeFileSync(MINT_FILE, JSON.stringify({ ...existing, imageUri: myUri }, null, 2));

    console.log("Your image URI: ", myUri);
  } catch (error) {
    console.log(error);
  }
})();
