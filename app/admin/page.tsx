import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { chatGPTSignInPath, chatGPTSignOutPath } from "../chatgpt-auth";
import { PercyApp } from "../percy-app";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f2f7f5] px-6 text-[#18201f]">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <p className="font-serif text-xl font-bold text-[#123c37]">The Percy Arms</p>
          <h1 className="mt-5 text-2xl font-semibold">Admin sign-in required</h1>
          <p className="mt-3 leading-7 text-[#60716d]">
            We couldn’t verify your staff access. Please sign in again or ask
            the site owner to check your access.
          </p>
          <a href="/cdn-cgi/access/logout" className="mt-6 block font-semibold underline underline-offset-4">
            Sign out and try again
          </a>
          <Link href="/" className="mt-4 block font-semibold underline underline-offset-4">
            Return to the menu
          </Link>
        </section>
      </main>
    );
  }

  return (
    <PercyApp
      isAdmin
      initialTab="admin"
      signInPath={chatGPTSignInPath()}
      signOutPath={chatGPTSignOutPath()}
    />
  );
}
