import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import {
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { getCreateAccountInstruction } from "@solana-program/system";

//import your wallet
import wallet from "../../devnet-wallet.json";
import { getRpcSubscriptionsUrl, getRpcUrl } from "../env";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const MINT_FILE = resolve(__dirname, "../../mint.json");

function loadMint() {
  return JSON.parse(readFileSync(MINT_FILE, "utf-8"));
}

function saveMint(data: Record<string, string>) {
  const existing = loadMint();
  writeFileSync(MINT_FILE, JSON.stringify({ ...existing, ...data }, null, 2));
}

const rpc = createSolanaRpc(getRpcUrl());

const rpcSubscriptions = createSolanaRpcSubscriptions(
  getRpcSubscriptionsUrl(),
);

(async () => {
  try {
    const payer = await createKeyPairSignerFromBytes(new Uint8Array(wallet));

    const newMint = await generateKeyPairSigner();

    const space = getMintSize();

    const lamports = await rpc
      .getMinimumBalanceForRentExemption(BigInt(space))
      .send();

    const createAccountIx = getCreateAccountInstruction({
      payer,
      newAccount: newMint,
      lamports,
      space: BigInt(space),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });

    const initializeMintIx = getInitializeMintInstruction({
      mint: newMint.address,
      decimals: 6,
      mintAuthority: payer.address,
      freezeAuthority: payer.address,
    });

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const msg = createTransactionMessage({ version: 0 });

    const msgWithPayer = setTransactionMessageFeePayerSigner(payer, msg);

    const msgWithLiftime = setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      msgWithPayer,
    );

    const txMessage = appendTransactionMessageInstructions(
      [createAccountIx, initializeMintIx],
      msgWithLiftime,
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);

    assertIsTransactionWithBlockhashLifetime(signedTx);

    const signature = getSignatureFromTransaction(signedTx);

    const sendAndConfirm = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });

    await sendAndConfirm(signedTx, { commitment: "confirmed" });

    saveMint({ splMint: newMint.address });

    console.log(`Your mint address is: ${newMint.address}`);
    console.log(`mint txid: ${signature}`);
  } catch (error) {
    console.log(error);
  }
})();
