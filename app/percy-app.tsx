"use client";

import { CalendarDays, Shield, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPanel } from "./components/admin-panel";
import { OrderMenu } from "./components/order-menu";

type PercyAppProps = {
  isAdmin: boolean;
  signInPath: string;
  signOutPath: string;
  initialTab?: "order" | "admin";
};

export function PercyApp({
  isAdmin,
  signInPath,
  signOutPath,
  initialTab = "order",
}: PercyAppProps) {
  return (
    <main className="min-h-screen bg-[#f2f7f5] text-[#18201f]">
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0f3934] via-[#15564e] to-[#20766b] text-white">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[#f4c95d]/15 blur-2xl" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl border border-white/30 bg-[#f4c95d] font-serif text-xl font-black text-[#123c37] shadow-lg shadow-black/10">
              PA
            </div>
            <div>
              <p className="font-serif text-xl font-bold leading-none">
                The Percy Arms
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#d6f0e9]">
                Blyth · Sunday Lunch
              </p>
            </div>
          </div>
          <Badge className="hidden border border-white/20 bg-white/12 px-3 py-1 text-white shadow-sm backdrop-blur sm:inline-flex">
            <ShoppingBag /> Order & collect
          </Badge>
        </div>
      </header>

      {isAdmin ? (
        <Tabs defaultValue={initialTab} className="gap-0">
          <div className="sticky top-0 z-30 border-b border-[#cbdcd6] bg-[#f2f7f5]/90 px-3 py-3 shadow-sm backdrop-blur-xl sm:px-6">
            <TabsList className="mx-auto grid h-12 w-full max-w-md grid-cols-2 rounded-2xl border border-[#d5e4df] bg-white p-1 shadow-sm">
              <TabsTrigger value="order" className="rounded-xl text-xs sm:text-sm">
                <CalendarDays /> <span>Order</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="rounded-xl text-xs sm:text-sm">
                <Shield /> <span>Admin</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="order">
            <OrderMenu />
          </TabsContent>
          <TabsContent value="admin">
            <AdminPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <OrderMenu />
      )}
      <footer className="mt-10 border-t border-[#d5e4df] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[#60716d] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-serif text-lg font-bold text-[#123c37]">The Percy Arms</p>
            <p>Blyth, Northumberland</p>
          </div>
          <div className="sm:text-right">
            <p className="font-semibold text-[#18201f]">Sunday lunches · 12pm–3pm</p>
            <p>Dine in or order for collection</p>
            <a
              href={isAdmin ? signOutPath : signInPath}
              className="mt-2 inline-block text-xs font-semibold text-[#123c37] underline underline-offset-4"
            >
              {isAdmin ? "Admin sign out" : "Admin sign in"}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
