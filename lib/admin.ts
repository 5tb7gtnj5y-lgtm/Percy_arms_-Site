import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import {
  isSameOriginAdminRequest,
  verifyAdminAccess,
  type AccessEnvironment,
} from "./cloudflare-access";

export async function getAdminUser(request?: Request) {
  if (request && !isSameOriginAdminRequest(request)) return null;
  return verifyAdminAccess(
    request?.headers ?? await headers(),
    env as unknown as AccessEnvironment,
  );
}
