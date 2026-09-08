import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Miniflare } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const root = fileURLToPath(new URL("..", import.meta.url));

async function workerModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? workerModules(fullPath) :
      entry.name.endsWith(".js") ? [{ type: "ESModule", path: fullPath }] : [];
  }));
  return groups.flat();
}

test("built Cloudflare Worker: public menu, protected admin and stored orders", { timeout: 60000 }, async (t) => {
  const directory = path.join(root, "dist/server");
  const modules = await workerModules(directory);
  // The first module is the Worker entry point. Include dynamic SSR imports.
  modules.sort((a, b) => (a.path === path.join(directory, "index.js") ? -1 :
    b.path === path.join(directory, "index.js") ? 1 : a.path.localeCompare(b.path)));
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "runtime-test", alg: "RS256" };
  const team = "https://percy-test.cloudflareaccess.com";
  const audience = "local-test-audience";
  const jwt = await new SignJWT({ email: "admin@example.com", type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "runtime-test" })
    .setIssuer(team).setAudience(audience).setSubject("test-staff")
    .setIssuedAt().setExpirationTime("1h").sign(privateKey);
  const config = JSON.parse(await readFile(path.join(directory, "wrangler.json"), "utf8"));
  const mf = new Miniflare({
    name: config.name,
    modules, modulesRoot: directory,
    compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags,
    d1Databases: ["DB"],
    bindings: { TEAM_DOMAIN: team, POLICY_AUD: audience, ADMIN_EMAIL: "admin@example.com" },
    assets: {
      directory: path.join(root, "dist/client"),
      workerName: config.name,
      routerConfig: { has_user_worker: true },
    },
    outboundService: async (request) => {
      assert.equal(request.url, `${team}/cdn-cgi/access/certs`, "No external order emails or other network requests in tests");
      return Response.json({ keys: [jwk] });
    },
  });
  t.after(() => mf.dispose());
  const database = await mf.getD1Database("DB");
  const sql = await readFile(path.join(root, "scripts/cloudflare-repair-order-tables.sql"), "utf8");
  const statements = sql.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean);
  async function repair() {
    await database.batch(statements.map((statement) => database.prepare(statement)));
  }
  await repair();

  const origin = "https://pub.example";
  async function request(url, options = {}, admin = false) {
    const headers = new Headers(options.headers);
    if (options.body) headers.set("content-type", "application/json");
    if (admin) {
      headers.set("cookie", `CF_Authorization=${jwt}`);
      if (options.method && options.method !== "GET" && !headers.has("origin")) headers.set("origin", origin);
    }
    return mf.dispatchFetch(`${origin}${url}`, { ...options, headers });
  }

  await t.test("anonymous HTML and photograph load without image-service bindings", async () => {
    const page = await request("/");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /The Percy Arms/);
    // Menu content hydrates after fetching /api/menu in the browser.
    assert.match(html, /Loading the Sunday menu/);
    assert.match(html, /href="\/admin"/);
    const photo = await request("/sunday-roast.png");
    assert.equal(photo.status, 200);
    assert.match(photo.headers.get("content-type"), /image\/png/);
    await photo.arrayBuffer();
  });

  let settings;
  await t.test("public menu loads but checkout is disabled until configured", async () => {
    const menu = await request("/api/menu");
    assert.equal(menu.status, 200);
    settings = await menu.json();
    assert.equal(settings.configured, false);
    assert.equal(settings.orderEmail, undefined);
  });

  await t.test("anonymous and forged identities cannot access staff endpoints", async () => {
    for (const [url, method] of [
      ["/api/menu?admin=1", "GET"], ["/api/menu", "POST"],
      ["/api/orders", "GET"], ["/api/orders", "PATCH"], ["/api/orders", "DELETE"],
      ["/api/events", "POST"], ["/api/events", "DELETE"],
    ]) {
      const response = await request(url, { method, headers: {
        "oai-authenticated-user-email": "admin@example.com", origin,
      } });
      assert.equal(response.status, 403, `${method} ${url}`);
      assert.match(response.headers.get("cache-control"), /no-store/);
      await response.text();
    }
    const page = await request("/admin");
    assert.match(await page.text(), /Admin sign-in required/);
  });

  await t.test("a verified staff session opens the admin dashboard and saves settings", async () => {
    const page = await request("/admin", {}, true);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.doesNotMatch(html, /Admin sign-in required/);
    assert.match(html, /Admin sign out/);
    assert.match(page.headers.get("cache-control"), /no-store/);
    const response = await request("/api/menu", {
      method: "POST", body: JSON.stringify({ ...settings, orderEmail: "orders@example.com" }),
    }, true);
    assert.equal(response.status, 200, await response.clone().text());
    settings = await response.json();
    assert.equal(settings.configured, true);
    assert.equal(settings.emailServiceReady, false);
    const blocked = await request("/api/menu", { method: "POST", headers: { origin: "https://another.example" } }, true);
    assert.equal(blocked.status, 403);
    await blocked.text();
  });

  const sunday = new Date();
  sunday.setUTCDate(sunday.getUTCDate() + ((7 - sunday.getUTCDay()) % 7 || 7));
  const order = {
    service: "takeaway", mealDate: sunday.toISOString().slice(0, 10), timeSlot: "12:15",
    customerName: "Local test customer", email: "customer@example.com", phone: "00000000000",
    allergenAcknowledged: true,
    meals: [{ mealType: "adult", meat: "chicken", quantity: 1 }], extras: [],
  };
  await t.test("an order is stored locally; seen-order clearing preserves unseen orders", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request("/api/orders", { method: "POST", body: JSON.stringify(order) });
      assert.equal(response.status, 201, await response.clone().text());
      assert.equal((await response.json()).order.emailStatus, "awaiting_setup");
    }
    const response = await request("/api/orders", {}, true);
    assert.equal(response.status, 200);
    const { orders } = await response.json();
    assert.equal(orders.length, 2);
    const seen = await request("/api/orders", { method: "PATCH", body: JSON.stringify({ id: orders[0].id, seen: true }) }, true);
    assert.equal(seen.status, 200);
    await seen.text();
    const cleared = await request("/api/orders", { method: "DELETE", body: JSON.stringify({ clearSeen: true }) }, true);
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).count, 1);
    const remaining = await request("/api/orders", {}, true);
    assert.equal((await remaining.json()).orders.length, 1);
  });

  await t.test("sold-out meat is rejected while other meats remain available", async () => {
    const saved = await request("/api/menu", { method: "POST", body: JSON.stringify({ ...settings, beefAvailable: false }) }, true);
    assert.equal(saved.status, 200);
    settings = await saved.json();
    const rejected = await request("/api/orders", { method: "POST", body: JSON.stringify({ ...order, meals: [{ mealType: "child", meat: "beef", quantity: 1 }] }) });
    assert.equal(rejected.status, 409);
    await rejected.text();
    const accepted = await request("/api/orders", { method: "POST", body: JSON.stringify(order) });
    assert.equal(accepted.status, 201);
    await accepted.text();
    const closed = await request("/api/menu", { method: "POST", body: JSON.stringify({ ...settings, orderingOpen: false }) }, true);
    assert.equal(closed.status, 200);
    await closed.text();
    const rejectedClosed = await request("/api/orders", { method: "POST", body: JSON.stringify(order) });
    assert.equal(rejectedClosed.status, 409);
    await rejectedClosed.text();
  });

  await t.test("re-running the database repair preserves settings and orders", async () => {
    const before = await database.prepare("SELECT COUNT(*) AS count FROM orders").first();
    await repair();
    const after = await database.prepare("SELECT COUNT(*) AS count FROM orders").first();
    assert.equal(after.count, before.count);
    const settings = await database.prepare("SELECT order_email, ordering_open FROM order_settings WHERE id = 1").first();
    assert.equal(settings.order_email, "orders@example.com");
    assert.equal(settings.ordering_open, 0);
  });
});
