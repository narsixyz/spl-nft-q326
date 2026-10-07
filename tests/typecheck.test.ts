import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execFileSync } from "child_process";

import { loadWalletBytes, projectRoot } from "./support";

// Every script imports ../../devnet-wallet.json as a JSON module, so tsc
// cannot resolve them at all without that file present.
const skip = loadWalletBytes()
  ? undefined
  : "devnet-wallet.json not found, the scripts import it as a JSON module";

/**
 * Every script under src/ runs its work in a top-level IIFE, so no test can
 * import one without firing real transactions. Compiling them under strict
 * mode is the check that still covers all eight of them.
 */
describe("typecheck", { skip, timeout: 120_000 }, () => {
  it("compiles src/ and tests/ with no errors", () => {
    try {
      execFileSync("npx", ["tsc", "-p", "tsconfig.test.json"], {
        cwd: projectRoot,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (error) {
      const { stdout, stderr } = error as { stdout?: string; stderr?: string };
      assert.fail(`tsc reported errors:\n${stdout ?? ""}${stderr ?? ""}`);
    }
  });
});
