import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type AccessEnvironment = {
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
  ADMIN_EMAIL?: string;
};

export type AccessUser = {
  email: string;
  displayName: string;
  fullName: string | null;
};

type RequestHeaders = Pick<Headers, "get">;
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function accessConfiguration(environment: AccessEnvironment) {
  try {
    const issuer = new URL(environment.TEAM_DOMAIN?.trim() ?? "");
    const audience = environment.POLICY_AUD?.trim();
    const adminEmails = (environment.ADMIN_EMAIL ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => /^\S+@\S+\.\S+$/.test(email));

    // Fetch keys only from a Cloudflare Access team, never from a request URL.
    if (
      issuer.protocol !== "https:" ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer.hostname) ||
      issuer.username || issuer.password || issuer.port ||
      issuer.pathname !== "/" || issuer.search || issuer.hash ||
      !audience || !adminEmails.length
    ) return null;

    return { issuer: issuer.origin, audience, adminEmails };
  } catch {
    return null;
  }
}

function accessToken(headers: RequestHeaders) {
  const assertion = headers.get("cf-access-jwt-assertion");
  if (assertion) return assertion;

  // Access adds the assertion on /admin. Same-origin API requests also need
  // to authenticate using Access's signed, HttpOnly application cookie.
  const cookie = (headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("CF_Authorization="));
  return cookie?.slice("CF_Authorization=".length) || null;
}

export async function verifyAdminAccess(
  headers: RequestHeaders,
  environment: AccessEnvironment,
  keyResolver?: JWTVerifyGetKey,
): Promise<AccessUser | null> {
  const config = accessConfiguration(environment);
  const token = accessToken(headers);
  if (!config || !token) return null;

  try {
    let keys = keyResolver ?? keySets.get(config.issuer);
    if (!keys) {
      const remoteKeys = createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`));
      keySets.set(config.issuer, remoteKeys);
      keys = remoteKeys;
    }
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["iss", "aud", "exp", "iat", "sub", "email"],
    });
    if (payload.type !== "app" || typeof payload.email !== "string") return null;
    const email = payload.email.trim().toLowerCase();
    if (!config.adminEmails.includes(email)) return null;
    const fullName = typeof payload.name === "string" ? payload.name : null;
    return { email, fullName, displayName: fullName || email };
  } catch {
    // Invalid/expired tokens and unavailable signing keys must fail closed.
    return null;
  }
}

export function isSameOriginAdminRequest(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  return request.headers.get("origin") === new URL(request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}
