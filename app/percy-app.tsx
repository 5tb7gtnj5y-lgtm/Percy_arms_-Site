"use client";

import {
  CalendarDays,
  Clock3,
  MapPin,
  Shield,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
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
    <main className="site-shell min-h-screen text-[#17211f]">
      <header className="pub-header relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -left-20 -top-28 size-72 rounded-full bg-[#d9ad5b]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-36 size-80 rounded-full bg-[#93b7a8]/10 blur-3xl" />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative grid size-12 place-items-center rounded-full border border-[#e7c67d]/60 bg-[#d9ad5b] font-serif text-lg font-black text-[#102f2a] shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
              <span className="absolute inset-1 rounded-full border border-[#102f2a]/25" />
              <span className="relative">PA</span>
            </div>
            <div>
              <p className="font-serif text-xl font-bold leading-none tracking-[-0.02em] sm:text-2xl">
                The Percy Arms
              </p>
              <p className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#c6d8d1]">
                Blyth · Kitchen &amp; Bar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-[#dbe7e2] md:flex">
              <span className="size-2 rounded-full bg-[#8fd6a4] shadow-[0_0_0_4px_rgba(143,214,164,0.12)]" />
              Sunday orders open
            </div>
            <Badge className="border border-white/15 bg-white/10 px-3 py-1.5 text-white shadow-sm backdrop-blur-md">
              <ShoppingBag /> <span className="hidden sm:inline">Order &amp; collect</span><span className="sm:hidden">Order</span>
            </Badge>
          </div>
        </div>
      </header>

      {isAdmin ? (
        <Tabs defaultValue={initialTab} className="gap-0">
          <div className="sticky top-0 z-30 border-b border-[#d9ddd8]/80 bg-[#f7f5ef]/88 px-3 py-3 shadow-[0_8px_30px_rgba(20,48,43,0.05)] backdrop-blur-xl sm:px-6">
            <TabsList className="mx-auto grid h-12 w-full max-w-md grid-cols-2 rounded-full border border-[#d7ded9] bg-white/90 p-1 shadow-[0_6px_24px_rgba(20,48,43,0.07)]">
              <TabsTrigger value="order" className="rounded-full text-xs data-[state=active]:bg-[#153f38] data-[state=active]:text-white sm:text-sm">
                <CalendarDays /> <span>Order</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="rounded-full text-xs data-[state=active]:bg-[#153f38] data-[state=active]:text-white sm:text-sm">
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
      <footer className="mt-12 bg-[#102f2a] text-[#c8d7d1]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:grid-cols-[1.1fr_0.9fr] sm:px-6 lg:px-8">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-[#d9ad5b] font-serif font-black text-[#102f2a]">PA</div>
              <p className="font-serif text-xl font-bold text-white">The Percy Arms</p>
            </div>
            <p className="mt-4 leading-6 text-[#aebfba]">
              Proper Sunday lunches, served with a warm Northumberland welcome.
            </p>
          </div>
          <div className="grid gap-3 sm:justify-self-end sm:text-right">
            <p className="inline-flex items-center gap-2 sm:justify-end">
              <MapPin className="size-4 text-[#d9ad5b]" /> Blyth, Northumberland
            </p>
            <p className="inline-flex items-center gap-2 font-semibold text-white sm:justify-end">
              <Clock3 className="size-4 text-[#d9ad5b]" /> Sundays · 11:30am–5pm
            </p>
            <a
              href={isAdmin ? signOutPath : signInPath}
              className="mt-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#e7c67d] underline decoration-white/30 underline-offset-4 sm:justify-end"
            >
              <Sparkles className="size-3.5" />
              {isAdmin ? "Admin sign out" : "Admin sign in"}
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
