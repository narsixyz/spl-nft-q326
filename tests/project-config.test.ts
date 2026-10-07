import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "fs";

import {
  fromRoot,
  gitIgnoreReason,
  packageJson,
  readRootFile,
  trackedFiles,
} from "./support";

/** The ordered workflows the README and Makefile both document. */
const SPL_FLOW = ["spl:init", "spl:metadata", "spl:mint", "spl:transfer"];
const NFT_FLOW = ["nft:image", "nft:metadata", "nft:mint", "nft:update"];
const SCRIPT_FLOW = [...SPL_FLOW, ...NFT_FLOW];

describe("npm scripts", () => {
  const scripts = packageJson().scripts;

  it("defines every step of both flows", () => {
    for (const name of SCRIPT_FLOW) {
      assert.ok(scripts[name], `package.json is missing the "${name}" script`);
    }
  });

  it("points every step at a file that exists", () => {
    for (const name of SCRIPT_FLOW) {
      const match = /(src\/\S+\.ts)/.exec(scripts[name]);
      assert.ok(match, `"${name}" does not run a src/*.ts file: ${scripts[name]}`);
      assert.ok(
        existsSync(fromRoot(match[1])),
        `"${name}" runs ${match[1]}, which does not exist`,
      );
    }
  });

  it("has no orphan script files under src/spl and src/nft", () => {
    const referenced = new Set(
      SCRIPT_FLOW.map((name) => /(src\/\S+\.ts)/.exec(scripts[name])![1]),
    );
    const onDisk = [
      ...["spl_init", "spl_metadata", "spl_mint", "spl_transfer"].map((f) => `src/spl/${f}.ts`),
      ...["nft_image", "nft_metadata", "nft_mint", "nft_update"].map((f) => `src/nft/${f}.ts`),
    ];
    for (const file of onDisk) {
      assert.ok(referenced.has(file), `${file} has no npm script`);
    }
  });

  it("exposes a test script that runs the suite", () => {
    assert.ok(scripts.test, "package.json has no test script");
    assert.match(scripts.test, /--test/);
  });
});

describe("Makefile", () => {
  const makefile = readRootFile("Makefile");
  const scripts = packageJson().scripts;

  it("only invokes npm scripts that exist", () => {
    const invoked = [...makefile.matchAll(/npm run (\S+)/g)].map((m) => m[1]);
    assert.ok(invoked.length > 0, "Makefile invokes no npm scripts");
    for (const name of invoked) {
      assert.ok(scripts[name], `Makefile runs "npm run ${name}", which is not defined`);
    }
  });

  it("keeps the spl target in the order the flow requires", () => {
    // The mint must exist before metadata, metadata before minting, and so on,
    // so the target order here is functional, not cosmetic.
    const target = /^spl:(.*)$/m.exec(makefile);
    assert.ok(target, "Makefile has no spl target");
    const steps = target[1].trim().split(/\s+/).filter((s) => s !== "wait");
    assert.deepEqual(steps, SPL_FLOW.map((s) => s.replace(":", "-")));
  });

  it("keeps the nft target in the order the flow requires", () => {
    const target = /^nft:(.*)$/m.exec(makefile);
    assert.ok(target, "Makefile has no nft target");
    const steps = target[1].trim().split(/\s+/).filter((s) => s !== "wait");
    assert.deepEqual(steps, NFT_FLOW.map((s) => s.replace(":", "-")));
  });
});

describe(".env.example", () => {
  const example = readRootFile(".env.example");
  const envSource = readRootFile("src/env.ts");

  it("documents every variable src/env.ts reads", () => {
    const used = [...envSource.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    assert.ok(used.length > 0, "src/env.ts reads no environment variables");
    for (const name of new Set(used)) {
      assert.match(example, new RegExp(`^${name}=`, "m"));
    }
  });

  it("ships a placeholder rather than a real API key", () => {
    assert.match(example, /YOUR_API_KEY|<.*>/i);
  });
});

describe("secrets stay out of git", () => {
  for (const path of [".env", "devnet-wallet.json", "mint.json"]) {
    it(`ignores ${path}`, () => {
      assert.equal(gitIgnoreReason(path), null);
    });
  }

  it("tracks no wallet or env file", () => {
    const leaked = trackedFiles().filter((f) =>
      /(^|\/)(\.env|devnet-wallet\.json|wallet\.json|mint\.json)$/.test(f),
    );
    assert.deepEqual(leaked, [], `these files are committed: ${leaked.join(", ")}`);
  });
});

describe("README", () => {
  const readme = readRootFile("README.md");

  it("documents every npm script of both flows", () => {
    for (const name of SCRIPT_FLOW) {
      assert.ok(readme.includes(`npm run ${name}`), `README does not mention ${name}`);
    }
  });

  it("explains the test suite", () => {
    assert.match(readme, /npm test|npm run test/);
  });
});

describe("tsconfig", () => {
  const tsconfig = JSON.parse(
    readRootFile("tsconfig.json").replace(/^\s*\/\/.*$/gm, ""),
  ) as { compilerOptions: Record<string, unknown> };

  it("keeps strict mode on", () => {
    assert.equal(tsconfig.compilerOptions.strict, true);
  });

  it("can import mint.json and devnet-wallet.json", () => {
    assert.equal(tsconfig.compilerOptions.resolveJsonModule, true);
  });
});
