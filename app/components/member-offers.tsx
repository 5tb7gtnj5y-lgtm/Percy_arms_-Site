"use client";

import { useEffect, useState } from "react";
import { Clock3, Gift, Loader2, LogIn, LogOut, PartyPopper, ReceiptText, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { OrderLines, OrderStatus, ServiceType } from "@/lib/order-types";

type MemberOrder = {
  id: number;
  reference: string;
  service: ServiceType;
  mealDate: string;
  timeSlot: string;
  totalPence: number;
  status: OrderStatus;
  lines: OrderLines;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Received",
  accepted: "Accepted",
  preparing: "Being prepared",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

function money(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function MemberOffers({
  memberName,
  memberEmail,
  signInPath,
  signOutPath,
}: {
  memberName: string | null;
  memberEmail: string | null;
  signInPath: string;
  signOutPath: string;
}) {
  const [orders, setOrders] = useState<MemberOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(Boolean(memberEmail));

  useEffect(() => {
    if (!memberEmail) return;
    let active = true;
    fetch("/api/my-orders", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { orders?: MemberOrder[] };
        if (active && response.ok) setOrders(result.orders ?? []);
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberEmail]);

  if (!memberName) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#123c37] to-[#20766b] text-white shadow-[0_24px_70px_rgba(18,60,55,0.22)]">
          <div className="grid gap-8 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Badge className="bg-[#f4c95d] text-[#123c37]">Percy members</Badge>
              <h2 className="mt-5 max-w-xl font-serif text-4xl font-bold leading-tight">
                A little extra for our regulars.
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-[#eadcc4]">
                Sign in to see the latest member-only food and drink offers.
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="h-12 rounded-xl bg-white px-6 text-[#123c37] hover:bg-[#e5f2ee]">
                  <LogIn /> Member login
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">Member login</DialogTitle>
                  <DialogDescription className="leading-6">
                    Continue with your ChatGPT account to securely open the Percy
                    Arms member area.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button asChild className="h-11 w-full bg-[#123c37] hover:bg-[#1d5a52]">
                    <a href={signInPath} target="_top">
                      <LogIn /> Continue to login
                    </a>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>
    );
  }

  const offers = [
    {
      title: "Sunday lunch welcome",
      detail: "Free tea or coffee with any Sunday lunch.",
      eyebrow: "Food offer",
    },
    {
      title: "First pick of times",
      detail: "Members get early access to the most popular Sunday slots.",
      eyebrow: "Member perk",
    },
    {
      title: "Birthday month treat",
      detail: "Show your member account to the team during your birthday month.",
      eyebrow: "Just for you",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-[#f4c95d] text-[#123c37]">
            <Gift /> Members only
          </Badge>
          <h2 className="mt-3 font-serif text-4xl font-bold">Hello, {memberName}</h2>
          <p className="mt-2 text-[#6e625a]">Here are your current Percy Arms offers.</p>
        </div>
        <Button
          variant="outline"
          asChild
          className="w-fit rounded-xl border-[#123c37]/20 text-[#123c37]"
        >
          <a href={signOutPath} target="_top">
            <LogOut /> Sign out
          </a>
        </Button>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {offers.map((offer, index) => (
          <Card
            key={offer.title}
            className="relative overflow-hidden border-0 bg-white shadow-[0_14px_38px_rgba(55,37,25,0.1)]"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1.5 ${index === 1 ? "bg-[#34543c]" : "bg-[#8d3b45]"}`}
            />
            <CardHeader>
              <div className="mb-3 grid size-11 place-items-center rounded-full bg-[#e5f2ee] text-[#146f63]">
                {index === 2 ? <PartyPopper /> : <Tag />}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#df654d]">
                {offer.eyebrow}
              </p>
              <CardTitle className="font-serif text-2xl leading-tight">
                {offer.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-7 text-[#6e625a]">{offer.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#e5f2ee] text-[#146f63]">
            <ReceiptText />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#df654d]">Your account</p>
            <h3 className="font-serif text-3xl font-bold">Recent orders</h3>
          </div>
        </div>

        {ordersLoading ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-6 text-[#60716d]">
            <Loader2 className="animate-spin" /> Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#cbdcd6] bg-white/60 p-7 text-center text-[#60716d]">
            Orders placed with {memberEmail} will appear here.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {orders.map((order) => (
              <Card key={order.id} className="border-[#d5e4df] bg-white shadow-[0_10px_28px_rgba(18,60,55,0.07)]">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-black tracking-wider text-[#123c37]">{order.reference}</p>
                      <CardTitle className="mt-1 font-serif text-xl">
                        {order.service === "dine_in" ? "Dining in" : "Takeaway collection"}
                      </CardTitle>
                    </div>
                    <Badge className={order.status === "cancelled" ? "bg-red-700" : "bg-[#146f63]"}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="flex items-center gap-2 text-[#60716d]"><Clock3 className="size-4" /> {order.mealDate} at {order.timeSlot}</p>
                  <div className="flex justify-between border-t border-[#dfe9e5] pt-3">
                    <span>{order.lines.meals.reduce((total, meal) => total + meal.quantity, 0)} meals</span>
                    <strong>{money(order.totalPence)}</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
