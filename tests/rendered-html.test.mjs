import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

test("builds a standalone Cloudflare Worker with its ordering database and assets", async () => {
  const config = (await import("../dist/server/wrangler.json", {
    with: { type: "json" },
  })).default;
  assert.equal(config.name, "percy-arms--site");
  assert.deepEqual(config.compatibility_flags, ["nodejs_compat"]);
  assert.equal(config.assets.directory, "../client");
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(config.d1_databases[0].database_name, "percy-arms-orders");
  await access(new URL("../dist/client/sunday-roast.png", import.meta.url));
});
