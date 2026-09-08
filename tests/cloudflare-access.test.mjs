import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  accessConfiguration,
  isSameOriginAdminRequest,
  verifyAdminAccess,
} from "../lib/cloudflare-access.ts";

const environment = {
  TEAM_DOMAIN: "https://percy-test.cloudflareaccess.com",
  POLICY_AUD: "test-app-audience",
  ADMIN_EMAIL: " admin@example.com, SECOND@example.com ",
};
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });
const now = Math.floor(Date.now() / 1000);

async function token(overrides = {}, signingKey = privateKey) {
  const claims = {
    iss: environment.TEAM_DOMAIN, aud: [environment.POLICY_AUD],
    sub: "staff-identity", iat: now, exp: now + 3600,
    type: "app", email: "ADMIN@example.com", ...overrides,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(signingKey);
}

test("accepts a signed Access assertion for an allowed staff email", async () => {
  const user = await verifyAdminAccess(
    new Headers({ "cf-access-jwt-assertion": await token() }), environment, keys,
  );
  assert.equal(user?.email, "admin@example.com");
});

test("authenticates same-origin API requests with the Access cookie", async () => {
  const user = await verifyAdminAccess(new Headers({
    cookie: `preference=yes; CF_Authorization=${await token({ email: "second@example.com" })}; other=1`,
  }), environment, keys);
  assert.equal(user?.email, "second@example.com");
});

test("ignores forged old hosting identity headers", async () => {
  assert.equal(await verifyAdminAccess(new Headers({
    "oai-authenticated-user-email": "admin@example.com",
    "cf-access-authenticated-user-email": "admin@example.com",
  }), environment, keys), null);
});

test("rejects absent config, anonymous visitors and malformed tokens", async () => {
  assert.equal(await verifyAdminAccess(new Headers(), environment, keys), null);
  assert.equal(await verifyAdminAccess(new Headers({ cookie: `CF_Authorization=${await token()}` }), {}, keys), null);
  assert.equal(await verifyAdminAccess(new Headers({ "cf-access-jwt-assertion": "not-a-jwt" }), environment, keys), null);
});

test("rejects tokens for other people, applications, issuers or token types", async () => {
  for (const claims of [
    { email: "customer@example.com" }, { aud: "another-app" },
    { iss: "https://other-team.cloudflareaccess.com" }, { type: "service" },
    { exp: now - 60 }, { exp: undefined }, { email: undefined }, { sub: undefined },
    { nbf: now + 3600 },
  ]) {
    assert.equal(await verifyAdminAccess(new Headers({
      "cf-access-jwt-assertion": await token(claims),
    }), environment, keys), null, JSON.stringify(claims));
  }
});

test("rejects a forged signature and an unsigned JWT", async () => {
  const otherKeys = await generateKeyPair("RS256");
  const forged = await token({}, otherKeys.privateKey);
  const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ email: "admin@example.com" })).toString("base64url")}.`;
  for (const value of [forged, unsigned]) {
    assert.equal(await verifyAdminAccess(new Headers({
      "cf-access-jwt-assertion": value,
    }), environment, keys), null);
  }
});

test("does not fall back to a cookie when an invalid assertion was supplied", async () => {
  assert.equal(await verifyAdminAccess(new Headers({
    "cf-access-jwt-assertion": "invalid",
    cookie: `CF_Authorization=${await token()}`,
  }), environment, keys), null);
});

test("fails closed when Access signing keys cannot be fetched", async () => {
  assert.equal(await verifyAdminAccess(new Headers({
    "cf-access-jwt-assertion": await token(),
  }), environment, async () => { throw new Error("Network unavailable"); }), null);
});

test("restricts signing-key hosts and normalises the staff allowlist", () => {
  assert.deepEqual(accessConfiguration(environment)?.adminEmails, ["admin@example.com", "second@example.com"]);
  for (const domain of [
    "http://percy-test.cloudflareaccess.com", "https://example.com",
    "https://team.cloudflareaccess.com.evil.example", "https://127.0.0.1",
    "https://user:pass@team.cloudflareaccess.com", "https://team.cloudflareaccess.com:8443",
    "https://team.cloudflareaccess.com/path", "https://team.cloudflareaccess.com?key=1",
  ]) assert.equal(accessConfiguration({ ...environment, TEAM_DOMAIN: domain }), null, domain);
});

test("staff mutations require the exact same origin", () => {
  const url = "https://pub.example/api/orders";
  for (const method of ["POST", "PATCH", "DELETE"]) {
    assert.equal(isSameOriginAdminRequest(new Request(url, { method })), false);
    assert.equal(isSameOriginAdminRequest(new Request(url, { method, headers: { origin: "https://attacker.example" } })), false);
    assert.equal(isSameOriginAdminRequest(new Request(url, { method, headers: { origin: "https://pub.example", "sec-fetch-site": "cross-site" } })), false);
    assert.equal(isSameOriginAdminRequest(new Request(url, { method, headers: { origin: "https://pub.example" } })), true);
  }
  assert.equal(isSameOriginAdminRequest(new Request(url)), true);
});
