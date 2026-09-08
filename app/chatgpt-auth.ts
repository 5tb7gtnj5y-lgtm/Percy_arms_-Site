// Compatibility exports for the original app. Standalone Cloudflare Workers
// authenticate staff with Cloudflare Access, not the old hosting headers.
export { getAdminUser as getChatGPTUser } from "@/lib/admin";
export type { AccessUser as ChatGPTUser } from "@/lib/cloudflare-access";

export function chatGPTSignInPath(): string {
  return "/admin";
}

export function chatGPTSignOutPath(): string {
  return "/cdn-cgi/access/logout";
}
