import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { getRpcSubscriptionsUrl, getRpcUrl } from "../src/env";

describe("src/env.ts", () => {
  // src/env.ts imports dotenv/config, so the real .env may already have
  // populated these. Snapshot and restore them around every case.
  let savedRpc: string | undefined;
  let savedWss: string | undefined;

  beforeEach(() => {
    savedRpc = process.env.SOLANA_RPC_URL;
    savedWss = process.env.SOLANA_RPC_WSS;
  });

  afterEach(() => {
    if (savedRpc === undefined) delete process.env.SOLANA_RPC_URL;
    else process.env.SOLANA_RPC_URL = savedRpc;
    if (savedWss === undefined) delete process.env.SOLANA_RPC_WSS;
    else process.env.SOLANA_RPC_WSS = savedWss;
  });

  describe("getRpcUrl", () => {
    it("returns SOLANA_RPC_URL when it is set", () => {
      process.env.SOLANA_RPC_URL = "https://devnet.example.com/?api-key=abc";
      assert.equal(getRpcUrl(), "https://devnet.example.com/?api-key=abc");
    });

    it("throws a setup hint when SOLANA_RPC_URL is missing", () => {
      delete process.env.SOLANA_RPC_URL;
      assert.throws(() => getRpcUrl(), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /SOLANA_RPC_URL is not set/);
        // The message is the only setup guidance a first-time runner gets.
        assert.match(error.message, /\.env\.example/);
        return true;
      });
    });

    it("treats an empty SOLANA_RPC_URL as missing", () => {
      process.env.SOLANA_RPC_URL = "";
      assert.throws(() => getRpcUrl(), /SOLANA_RPC_URL is not set/);
    });
  });

  describe("getRpcSubscriptionsUrl", () => {
    it("returns SOLANA_RPC_WSS when it is set", () => {
      process.env.SOLANA_RPC_WSS = "wss://devnet.example.com";
      assert.equal(getRpcSubscriptionsUrl(), "wss://devnet.example.com");
    });

    it("falls back to the public devnet websocket", () => {
      delete process.env.SOLANA_RPC_WSS;
      assert.equal(getRpcSubscriptionsUrl(), "wss://api.devnet.solana.com");
    });

    it("never returns an http(s) URL, the confirmation subscription needs wss", () => {
      delete process.env.SOLANA_RPC_WSS;
      assert.match(getRpcSubscriptionsUrl(), /^wss:\/\//);
    });
  });
});
