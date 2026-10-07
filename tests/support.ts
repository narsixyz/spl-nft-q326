import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/** Repo root, independent of where the test runner was launched from. */
export const projectRoot = resolve(__dirname, "..");

export const fromRoot = (...parts: string[]) => resolve(projectRoot, ...parts);

/** Reads a file from the repo as text. */
export const readRootFile = (relativePath: string) =>
  readFileSync(fromRoot(relativePath), "utf-8");

/** Reads one of the scripts under src/ as text, for source-consistency checks. */
export const readSource = (relativePath: string) =>
  readRootFile(resolve("src", relativePath));

export interface PackageJson {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export const packageJson = (): PackageJson =>
  JSON.parse(readRootFile("package.json")) as PackageJson;

/**
 * The script-to-script handoff file. It is gitignored and only exists once the
 * scripts have run, so every test that reads it must skip when it is absent.
 */
export interface MintState {
  splMint?: string;
  imageUri?: string;
  metadataUri?: string;
  asset?: string;
}

export const mintStatePath = fromRoot("mint.json");

export function loadMintState(): MintState | null {
  if (!existsSync(mintStatePath)) return null;
  return JSON.parse(readFileSync(mintStatePath, "utf-8")) as MintState;
}

export const walletPath = fromRoot("devnet-wallet.json");

export function loadWalletBytes(): number[] | null {
  if (!existsSync(walletPath)) return null;
  return JSON.parse(readFileSync(walletPath, "utf-8")) as number[];
}

/** `null` when the path is ignored by git, otherwise a reason string. */
export function gitIgnoreReason(relativePath: string): string | null {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", relativePath], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    return null;
  } catch {
    return `${relativePath} is not matched by .gitignore`;
  }
}

/** Paths currently tracked by git. */
export function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf-8" })
    .split("\n")
    .filter(Boolean);
}

/** A base58 address is 32 bytes, which encodes to 32-44 characters. */
export const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validates a Metaplex Core off-chain metadata document.
 * https://www.metaplex.com/docs/smart-contracts/core/json-schema
 * Returns a list of problems; an empty list means the document is valid.
 */
export function validateCoreMetadata(doc: unknown): string[] {
  const problems: string[] = [];
  if (typeof doc !== "object" || doc === null) return ["metadata is not an object"];
  const m = doc as Record<string, unknown>;

  if (typeof m.name !== "string" || m.name.length === 0) problems.push("missing name");
  if (typeof m.description !== "string") problems.push("missing description");
  if (typeof m.image !== "string" || !/^https?:\/\//.test(m.image as string))
    problems.push("image is not an http(s) URI");

  if (!Array.isArray(m.attributes)) {
    problems.push("attributes is not an array");
  } else {
    m.attributes.forEach((attr, i) => {
      const a = attr as Record<string, unknown>;
      if (typeof a?.trait_type !== "string") problems.push(`attributes[${i}].trait_type missing`);
      if (a?.value === undefined) problems.push(`attributes[${i}].value missing`);
    });
  }

  const files = (m.properties as Record<string, unknown> | undefined)?.files;
  if (!Array.isArray(files) || files.length === 0) {
    problems.push("properties.files is empty");
  } else {
    files.forEach((file, i) => {
      const f = file as Record<string, unknown>;
      if (typeof f?.uri !== "string") problems.push(`properties.files[${i}].uri missing`);
      if (typeof f?.type !== "string") problems.push(`properties.files[${i}].type missing`);
    });
  }

  return problems;
}

/** Reason string when the devnet suite should not run, else `null`. */
export function devnetSkipReason(): string | null {
  if (process.env.RUN_DEVNET_TESTS !== "1")
    return "set RUN_DEVNET_TESTS=1 to run devnet tests";
  if (!process.env.SOLANA_RPC_URL) return "SOLANA_RPC_URL is not set";
  if (!loadMintState()) return "mint.json not found, run the scripts first";
  if (!loadWalletBytes()) return "devnet-wallet.json not found";
  return null;
}
