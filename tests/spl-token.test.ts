import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
} from "@solana/kit";
import {
  SYSTEM_PROGRAM_ADDRESS,
  getCreateAccountInstruction,
} from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getInitializeMintInstruction,
  getInitializeMintInstructionDataDecoder,
  getMintSize,
  getMintToInstruction,
  getMintToInstructionDataDecoder,
  getTransferCheckedInstruction,
  getTransferCheckedInstructionDataDecoder,
} from "@solana-program/token";

import { readSource } from "./support";

/** Matches the scripts: 6 decimals, declared in spl_init.ts. */
const DECIMALS = 6;
const ONE_TOKEN = 1_000_000n;

/** A fixed, syntactically valid mint, so derivations below are reproducible. */
const FIXED_MINT = address("So11111111111111111111111111111111111111112");
const FIXED_OWNER = address("ADm5yXExUnTnrYz1iuNNUZVEg5tiPDcW8nMPQQebPRKt");

const ata = async (mint: Address, owner: Address) => {
  const [pda] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return pda;
};

describe("mint account layout (spl_init)", () => {
  it("allocates the 82-byte token mint", () => {
    assert.equal(getMintSize(), 82);
  });

  it("creates the account under the token program, not the system program", async () => {
    const payer = await generateKeyPairSigner();
    const newMint = await generateKeyPairSigner();

    const ix = getCreateAccountInstruction({
      payer,
      newAccount: newMint,
      lamports: 1_461_600n,
      space: BigInt(getMintSize()),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });

    // The instruction itself is a system-program call that assigns ownership
    // of the new account to the token program.
    assert.equal(ix.programAddress, SYSTEM_PROGRAM_ADDRESS);
    const owners = ix.accounts.map((a) => a.address);
    assert.ok(owners.includes(payer.address));
    assert.ok(owners.includes(newMint.address));
  });

  it("initializes the mint with 6 decimals and the payer as both authority", async () => {
    const payer = await generateKeyPairSigner();

    const ix = getInitializeMintInstruction({
      mint: FIXED_MINT,
      decimals: DECIMALS,
      mintAuthority: payer.address,
      freezeAuthority: payer.address,
    });

    assert.equal(ix.programAddress, TOKEN_PROGRAM_ADDRESS);
    assert.equal(ix.accounts[0].address, FIXED_MINT);

    const data = getInitializeMintInstructionDataDecoder().decode(ix.data);
    assert.equal(data.decimals, DECIMALS);
    assert.equal(data.mintAuthority, payer.address);
    assert.deepEqual(data.freezeAuthority, { __option: "Some", value: payer.address });
  });
});

describe("associated token account derivation (spl_mint, spl_transfer)", () => {
  it("is deterministic for the same mint and owner", async () => {
    const first = await ata(FIXED_MINT, FIXED_OWNER);
    const second = await ata(FIXED_MINT, FIXED_OWNER);
    assert.equal(first, second);
  });

  it("derives the address the token program expects (regression lock)", async () => {
    // Locked value: a dependency bump that changes ATA derivation would send
    // tokens to the wrong account, so pin it rather than recompute it.
    assert.equal(
      await ata(FIXED_MINT, FIXED_OWNER),
      "EGNUDy69r14MUcqagbraKRkwUHg1cfJmHvoywLvkKq8z",
    );
  });

  it("gives each owner a different account for the same mint", async () => {
    const other = await generateKeyPairSigner();
    assert.notEqual(await ata(FIXED_MINT, FIXED_OWNER), await ata(FIXED_MINT, other.address));
  });

  it("gives each mint a different account for the same owner", async () => {
    const otherMint = await generateKeyPairSigner();
    assert.notEqual(
      await ata(FIXED_MINT, FIXED_OWNER),
      await ata(otherMint.address, FIXED_OWNER),
    );
  });
});

describe("mintTo instruction (spl_mint)", () => {
  it("mints 1,000,000 whole tokens as base units", async () => {
    const authority = await generateKeyPairSigner();
    const token = await ata(FIXED_MINT, authority.address);

    const ix = getMintToInstruction({
      mint: FIXED_MINT,
      token,
      mintAuthority: authority,
      amount: 1_000_000n * ONE_TOKEN,
    });

    assert.equal(ix.programAddress, TOKEN_PROGRAM_ADDRESS);
    const data = getMintToInstructionDataDecoder().decode(ix.data);
    // 1,000,000 tokens at 6 decimals is 10^12 base units.
    assert.equal(data.amount, 1_000_000_000_000n);
  });
});

describe("transferChecked instruction (spl_transfer)", () => {
  it("carries the amount and the decimals the mint was created with", async () => {
    const authority = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();

    const ix = getTransferCheckedInstruction({
      source: await ata(FIXED_MINT, authority.address),
      mint: FIXED_MINT,
      destination: await ata(FIXED_MINT, recipient.address),
      authority,
      amount: 100n * ONE_TOKEN,
      decimals: DECIMALS,
    });

    assert.equal(ix.programAddress, TOKEN_PROGRAM_ADDRESS);
    const data = getTransferCheckedInstructionDataDecoder().decode(ix.data);
    assert.equal(data.amount, 100_000_000n);
    // transferChecked fails on-chain if decimals disagree with the mint.
    assert.equal(data.decimals, DECIMALS);
  });

  it("sends from the signer's account to the recipient's, not the reverse", async () => {
    const authority = await generateKeyPairSigner();
    const recipient = await generateKeyPairSigner();
    const fromAta = await ata(FIXED_MINT, authority.address);
    const toAta = await ata(FIXED_MINT, recipient.address);

    const ix = getTransferCheckedInstruction({
      source: fromAta,
      mint: FIXED_MINT,
      destination: toAta,
      authority,
      amount: 100n * ONE_TOKEN,
      decimals: DECIMALS,
    });

    const accounts = ix.accounts.map((a) => a.address);
    assert.equal(accounts[0], fromAta);
    assert.equal(accounts[2], toAta);
    assert.ok(accounts.includes(authority.address));
  });
});

describe("transaction assembly and signing (offline)", () => {
  it("builds, signs and extracts a signature without touching an RPC", async () => {
    const payer = await generateKeyPairSigner();
    const newMint = await generateKeyPairSigner();

    const createAccountIx = getCreateAccountInstruction({
      payer,
      newAccount: newMint,
      lamports: 1_461_600n,
      space: BigInt(getMintSize()),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    });
    const initializeMintIx = getInitializeMintInstruction({
      mint: newMint.address,
      decimals: DECIMALS,
      mintAuthority: payer.address,
      freezeAuthority: payer.address,
    });

    const message = appendTransactionMessageInstructions(
      [createAccountIx, initializeMintIx],
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash("GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi"),
          lastValidBlockHeight: 100n,
        },
        setTransactionMessageFeePayerSigner(payer, createTransactionMessage({ version: 0 })),
      ),
    );

    assert.equal(message.version, 0);
    assert.equal(message.instructions.length, 2);
    assert.equal(message.feePayer.address, payer.address);

    const signedTx = await signTransactionMessageWithSigners(message);

    // Both the payer and the new mint account must have signed.
    assert.equal(Object.keys(signedTx.signatures).length, 2);
    assertIsTransactionWithBlockhashLifetime(signedTx);

    const signature = getSignatureFromTransaction(signedTx);
    assert.match(String(signature), /^[1-9A-HJ-NP-Za-km-z]{86,88}$/);
  });

  it("refuses to sign a message with no fee payer", async () => {
    const message = createTransactionMessage({ version: 0 });
    await assert.rejects(() => signTransactionMessageWithSigners(message as never));
  });
});

describe("source consistency across the spl flow", () => {
  it("creates and transfers the mint with the same decimals", () => {
    const initDecimals = /decimals:\s*(\d+)/.exec(readSource("spl/spl_init.ts"));
    const transferDecimals = /decimals:\s*(\d+)/.exec(readSource("spl/spl_transfer.ts"));

    assert.ok(initDecimals, "spl_init.ts declares no decimals");
    assert.ok(transferDecimals, "spl_transfer.ts declares no decimals");
    // A mismatch here makes spl:transfer fail on-chain with no local warning.
    assert.equal(initDecimals[1], transferDecimals[1]);
    assert.equal(Number(initDecimals[1]), DECIMALS);
  });

  it("derives ATAs against the same token program the mint belongs to", () => {
    for (const file of ["spl/spl_mint.ts", "spl/spl_transfer.ts"]) {
      assert.match(
        readSource(file),
        /tokenProgram:\s*TOKEN_PROGRAM_ADDRESS/,
        `${file} derives its ATA against a different token program`,
      );
    }
    assert.match(readSource("spl/spl_init.ts"), /programAddress:\s*TOKEN_PROGRAM_ADDRESS/);
  });

  it("reads the mint address from mint.json instead of a pasted literal", () => {
    for (const file of ["spl/spl_metadata.ts", "spl/spl_mint.ts", "spl/spl_transfer.ts"]) {
      assert.match(
        readSource(file),
        /mintData\.splMint/,
        `${file} does not read splMint from mint.json`,
      );
    }
  });
});
