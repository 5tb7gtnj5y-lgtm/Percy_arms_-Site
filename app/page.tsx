import { getAdminUser } from "@/lib/admin";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from "./chatgpt-auth";
import { PercyApp } from "./percy-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAdminUser();

  return (
    <PercyApp
      isAdmin={Boolean(user)}
      signInPath={chatGPTSignInPath()}
      signOutPath={chatGPTSignOutPath()}
    />
  );
}
