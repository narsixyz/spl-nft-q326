import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import wallet from "../../devnet-wallet.json";
import {
  createSignerFromKeypair,
  publicKey,
  signerIdentity,
  some,
} from "@metaplex-foundation/umi";
import { mplCore, updateV1 } from "@metaplex-foundation/mpl-core";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { getRpcUrl } from "../env";
import { readFileSync } from "fs";
import { resolve } from "path";

const MINT_FILE = resolve(__dirname, "../../mint.json");

const umi = createUmi(getRpcUrl());

const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(signerIdentity(signer));

umi.use(mplCore());

(async () => {
  try {
    const mintData = JSON.parse(readFileSync(MINT_FILE, "utf-8"));
    const asset = publicKey(mintData.asset);

    //change the name and uri to your new values
    const newName = "old_monk";
    const newUri =
      "https://gateway.irys.xyz/CPT9sx4DkTq8s18Y14fS6pEhDGvjHNSG6dAKtfQTWFyC";

    const tx = await updateV1(umi, {
      asset,
      newName: some(newName),
      newUri: some(newUri),
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(tx.signature)[0];

    console.log(`update txid: ${signature}`);
  } catch (e) {
    console.log(`error ${e}`);
  }
})();