import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function getAdminUser() {
  const user = await getChatGPTUser();
  const runtimeEnv = env as unknown as { ADMIN_EMAIL?: string };
  const adminEmail = runtimeEnv.ADMIN_EMAIL?.toLowerCase();

  if (!user || !adminEmail || user.email.toLowerCase() !== adminEmail) {
    return null;
  }

  return user;
}
