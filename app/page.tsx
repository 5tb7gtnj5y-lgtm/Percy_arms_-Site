import { env } from "cloudflare:workers";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "./chatgpt-auth";
import { PercyApp } from "./percy-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const runtimeEnv = env as unknown as { ADMIN_EMAIL?: string };
  const isAdmin = Boolean(
    user &&
      runtimeEnv.ADMIN_EMAIL &&
      user.email.toLowerCase() === runtimeEnv.ADMIN_EMAIL.toLowerCase(),
  );

  return (
    <PercyApp
      isAdmin={isAdmin}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
