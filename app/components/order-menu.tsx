"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Baby,
  CalendarCheck,
  Check,
  ChevronRight,
  ChefHat,
  Clock3,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CartExtra,
  CartMeal,
  CartSpecial,
  MealType,
  MeatChoice,
  OrderConfirmation,
  PublicMenuConfig,
  ServiceType,
} from "@/lib/order-types";
import { DINE_IN_TIMES, TAKEAWAY_TIMES } from "@/lib/order-times";

function money(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function upcomingSundays(count = 5) {
  const dates: { value: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() + ((7 - cursor.getDay()) % 7));

  for (let index = 0; index < count; index += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + index * 7);
    dates.push({
      value: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(date),
    });
  }
  return dates;
}

export function OrderMenu() {
  const sundays = useMemo(() => upcomingSundays(), []);
  const [menu, setMenu] = useState<PublicMenuConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [service, setService] = useState<ServiceType>("dine_in");
  const [mealDate, setMealDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [cartMeals, setCartMeals] = useState<CartMeal[]>([]);
  const [cartSpecials, setCartSpecials] = useState<CartSpecial[]>([]);
  const [cartExtras, setCartExtras] = useState<CartExtra[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [selectedMeat, setSelectedMeat] = useState<MeatChoice>("beef");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [allergenConfirmed, setAllergenConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/menu")
      .then(async (response) => {
        const result = (await response.json()) as PublicMenuConfig & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "The menu could not be loaded.");
        }
        setMenu(result);
      })
      .catch((error) => {
        setLoadError(
          error instanceof Error ? error.message : "The menu could not be loaded.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const availableTimes =
    service === "dine_in" ? DINE_IN_TIMES : TAKEAWAY_TIMES;
  const mealCount = cartMeals.reduce((total, item) => total + item.quantity, 0);
  const specialCount = cartSpecials.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const extraCount = cartExtras.reduce((total, item) => total + item.quantity, 0);
  const totalPence = menu
    ? cartMeals.reduce(
        (total, item) =>
          total +
          (item.mealType === "adult"
            ? menu.adultMealPrice
            : menu.childMealPrice) *
            item.quantity,
        0,
      ) +
      cartSpecials.reduce((total, item) => {
        const option = menu.specials.find((special) => special.id === item.id);
        return total + (option?.pricePence ?? 0) * item.quantity;
      }, 0) +
      cartExtras.reduce((total, item) => {
        const option = menu.extras.find((extra) => extra.id === item.id);
        return total + (option?.pricePence ?? 0) * item.quantity;
      }, 0)
    : 0;
  const availableMeats = menu
    ? ([
        ...(menu.chickenAvailable ? (["chicken"] as MeatChoice[]) : []),
        ...(menu.beefAvailable ? (["beef"] as MeatChoice[]) : []),
        ...(menu.porkAvailable ? (["pork"] as MeatChoice[]) : []),
      ] as MeatChoice[])
    : [];
  const soldOutMeats = (["chicken", "beef", "pork"] as MeatChoice[]).filter(
    (meat) => !availableMeats.includes(meat),
  );

  function openMeal(mealType: MealType) {
    if (availableMeats.length === 0) return;
    setSelectedMealType(mealType);
    setSelectedMeat(availableMeats[0]);
    setSelectedQuantity(1);
  }

  function addMeal() {
    if (!selectedMealType || !availableMeats.includes(selectedMeat)) return;
    setCartMeals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        mealType: selectedMealType,
        meat: selectedMeat,
        quantity: selectedQuantity,
      },
    ]);
    setSelectedMealType(null);
  }

  function changeMealQuantity(id: string, change: number) {
    setCartMeals((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, Math.min(10, item.quantity + change)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function addExtra(id: string) {
    setCartExtras((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(10, item.quantity + 1) }
            : item,
        );
      }
      return [...current, { id, quantity: 1 }];
    });
  }

  function addSpecial(id: string) {
    setCartSpecials((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(10, item.quantity + 1) }
            : item,
        );
      }
      return [...current, { id, quantity: 1 }];
    });
  }

  function changeSpecialQuantity(id: string, change: number) {
    setCartSpecials((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, Math.min(10, item.quantity + change)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function changeExtraQuantity(id: string, change: number) {
    setCartExtras((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, Math.min(10, item.quantity + change)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function beginCheckout() {
    setSubmitError("");
    if (!mealDate || !timeSlot) {
      setSubmitError("Choose your Sunday and time before checking out.");
      return;
    }
    if (cartMeals.length === 0 && cartSpecials.length === 0) {
      setSubmitError("Add a Sunday lunch or special to your basket.");
      return;
    }
    setAllergenConfirmed(false);
    setCheckoutOpen(true);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    const form = new FormData(event.currentTarget);

    try {
      setSubmitting(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service,
          mealDate,
          timeSlot,
          meals: cartMeals,
          specials: cartSpecials,
          extras: cartExtras,
          customerName: String(form.get("customerName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          notes: String(form.get("notes") ?? ""),
          allergenAcknowledged: allergenConfirmed,
        }),
      });
      const result = (await response.json()) as {
        order?: OrderConfirmation;
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error || "The order could not be placed.");
      }
      setConfirmation(result.order);
      setCheckoutOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "The order could not be placed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetOrder() {
    setConfirmation(null);
    setCartMeals([]);
    setCartSpecials([]);
    setCartExtras([]);
    setMealDate("");
    setTimeSlot("");
    setSubmitError("");
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[28rem] max-w-6xl items-center justify-center gap-3 px-4 text-[#6e625a]">
        <Loader2 className="animate-spin" /> Loading the Sunday menu…
      </div>
    );
  }

  if (!menu || loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          {loadError || "The Sunday menu could not be loaded."}
        </div>
      </div>
    );
  }

  if (confirmation) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Card className="surface-card overflow-hidden rounded-[2rem] py-0 shadow-[0_22px_70px_rgba(23,47,42,0.14)]">
          <div className="bg-gradient-to-br from-[#e8efeb] to-[#f7f1e5] px-6 py-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#153f38] text-white shadow-lg shadow-[#153f38]/20">
              <Check className="size-8" strokeWidth={3} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#58715d]">
              Order received
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold tracking-[-0.035em] text-[#25382a]">
              We’ll see you Sunday
            </h2>
            <p className="mt-3 font-mono text-2xl font-black tracking-widest text-[#123c37]">
              {confirmation.reference}
            </p>
          </div>
          <CardContent className="space-y-5 px-6 py-7 sm:px-9">
            <div className="flex items-center justify-between rounded-2xl border border-[#dfe6e1] bg-[#f8faf8] p-5">
              <span className="font-semibold">Total to pay at the pub</span>
              <strong className="text-2xl text-[#123c37]">
                {money(confirmation.totalPence)}
              </strong>
            </div>
            <p className="text-center text-sm leading-6 text-[#685c54]">
              {confirmation.emailStatus === "sent"
                ? "Your order has been saved and emailed to the Percy Arms."
                : confirmation.emailStatus === "awaiting_setup"
                  ? "Your order is safely saved in the pub’s admin inbox. Automatic email is awaiting final setup."
                  : "Your order is safely saved in the pub’s admin inbox, but the email copy could not be sent."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl border-[#123c37]/20 text-[#123c37]"
              onClick={resetOrder}
            >
              Start another order
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
        <div className="gentle-rise relative min-h-[25rem] overflow-hidden rounded-[2rem] bg-[#102f2a] text-white shadow-[0_28px_80px_rgba(16,47,42,0.24)] sm:min-h-[31rem]">
          <Image
            src="/sunday-roast.png"
            unoptimized
            alt="A roast beef Sunday lunch with Yorkshire pudding, roast potatoes and vegetables"
            fill
            priority
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover object-[64%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#092823]/95 via-[#102f2a]/78 to-[#102f2a]/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#092823]/80 via-transparent to-black/10" />
          <div className="relative flex min-h-[25rem] max-w-2xl flex-col justify-end p-6 sm:min-h-[31rem] sm:p-10 lg:p-12">
            <Badge className="w-fit border border-[#f2d89f]/35 bg-[#d9ad5b] px-3 py-1.5 text-[#102f2a] shadow-lg shadow-black/10">
              <Sparkles /> Made in Blyth · Every Sunday
            </Badge>
            <h1 className="mt-5 max-w-xl font-serif text-[2.75rem] font-bold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Sunday lunch, made properly.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#e4ede9] sm:text-lg">
              Choose your roast, add a little extra and we’ll have everything
              ready for your table or collection.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm text-[#f4f8f6]">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/15 px-3.5 py-2 backdrop-blur-sm">
                <MapPin className="size-4 text-[#e7c67d]" /> Percy Arms, Blyth
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/15 px-3.5 py-2 backdrop-blur-sm">
                <Clock3 className="size-4 text-[#e7c67d]" /> 11:30am–5pm
              </span>
            </div>
          </div>
          <div className="absolute bottom-8 right-8 hidden w-56 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md lg:block">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-[#d9ad5b] text-[#102f2a]">
                <WalletCards className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Pay at the pub</p>
                <p className="mt-0.5 text-xs text-[#d6e2dd]">Simple, no online payment</p>
              </div>
            </div>
          </div>
        </div>

        <div className="gentle-rise mx-auto -mt-5 grid max-w-3xl grid-cols-3 overflow-hidden rounded-2xl border border-[#d9ded9] bg-white/95 shadow-[0_16px_44px_rgba(23,47,42,0.10)] backdrop-blur sm:-mt-7">
          {[
            ["1", "Choose a time"],
            ["2", "Build your meal"],
            ["3", "Place your order"],
          ].map(([step, label], index) => (
            <div
              key={step}
              className={`flex min-h-16 items-center justify-center gap-2 px-2 text-center text-[0.68rem] font-bold text-[#51635f] sm:text-sm ${index > 0 ? "border-l border-[#e2e6e2]" : ""}`}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#e8efeb] text-[0.65rem] font-black text-[#153f38] sm:size-7 sm:text-xs">
                {step}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {!menu.configured && (
          <div className="mt-6 rounded-2xl border border-[#d9ad5b]/45 bg-[#fff8e8] px-5 py-4 text-sm leading-6 text-[#624b20] shadow-sm">
            <strong>Ordering setup required:</strong> the admin needs to confirm
            prices and the order email before customers can check out.
          </div>
        )}
        {menu.configured && !menu.orderingOpen && (
          <div className="mt-6 rounded-2xl border border-[#b95d49]/25 bg-[#fff1ed] px-5 py-4 text-sm leading-6 text-[#7b3024] shadow-sm">
            <strong>Online ordering is currently closed.</strong>{" "}
            {menu.serviceMessage || "Please check back soon or contact the pub for help."}
          </div>
        )}
        {menu.orderingOpen && menu.serviceMessage && (
          <div className="mt-6 rounded-2xl border border-[#153f38]/15 bg-[#e8efeb] px-5 py-4 text-sm leading-6 text-[#102f2a] shadow-sm">
            {menu.serviceMessage}
          </div>
        )}
        {menu.orderingOpen && soldOutMeats.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[#b95d49]/25 bg-[#fff1ed] px-5 py-4 text-sm leading-6 text-[#7b3024] shadow-sm">
            <strong>
              {soldOutMeats.map((meat) => `${meat[0].toUpperCase()}${meat.slice(1)}`).join(", ")} {soldOutMeats.length === 1 ? "is" : "are"} sold out.
            </strong>{" "}
            {availableMeats.length > 0
              ? `${availableMeats.map((meat) => `${meat[0].toUpperCase()}${meat.slice(1)}`).join(" and ")} can still be ordered.`
              : "No meat choices are currently available."}
          </div>
        )}

        {menu.specials.length > 0 && (
          <section
            className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#d9ad5b]/25 bg-[#102f2a] text-white shadow-[0_22px_60px_rgba(16,47,42,0.16)]"
            aria-labelledby="specials-heading"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#d9ad5b] text-[#102f2a] shadow-lg shadow-black/10">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#e7c67d]">
                  From the kitchen
                </p>
                <h2 id="specials-heading" className="mt-1 font-serif text-2xl font-bold tracking-[-0.02em] sm:text-3xl">
                  This week’s specials
                </h2>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
              {menu.specials.map((special) => {
                const quantity =
                  cartSpecials.find((item) => item.id === special.id)?.quantity ?? 0;
                return (
                  <article
                    key={special.id}
                    className="flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-5 shadow-inner backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
                  >
                    <div>
                      <p className="whitespace-pre-wrap text-base font-semibold leading-7 text-[#fff9e9]">
                        {special.text}
                      </p>
                      <p className="mt-3 text-lg font-black text-[#e7c67d]">
                        {money(special.pricePence)}
                      </p>
                    </div>
                    {quantity === 0 ? (
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl bg-[#d9ad5b] font-bold text-[#102f2a] shadow-md shadow-black/10 hover:bg-[#e7c67d]"
                        onClick={() => addSpecial(special.id)}
                        disabled={!menu.configured || !menu.orderingOpen}
                      >
                        Add to order <Plus />
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-black/15 p-2">
                        <span className="text-sm font-semibold">In your basket</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            onClick={() => changeSpecialQuantity(special.id, -1)}
                          >
                            <Minus />
                            <span className="sr-only">Remove one {special.text}</span>
                          </Button>
                          <span className="w-5 text-center font-bold">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            onClick={() => changeSpecialQuantity(special.id, 1)}
                          >
                            <Plus />
                            <span className="sr-only">Add one {special.text}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <aside className="mt-6 rounded-2xl border border-[#d9ad5b]/40 bg-[#fff9e8] p-5 text-[#564317] shadow-sm" aria-labelledby="allergen-heading">
          <div className="flex gap-3">
            <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#d9ad5b] text-[#102f2a]">
              <Info className="size-5" />
            </div>
            <div>
              <h2 id="allergen-heading" className="font-serif text-xl font-bold tracking-[-0.01em]">Food allergies and intolerances</h2>
              <p className="mt-2 text-sm leading-6">
                The Food Standards Agency says allergen information must be available before an online food order is completed and again when the food is supplied.
              </p>
              <p className="mt-2 text-sm font-semibold leading-6">
                If you or anyone you are ordering for has an allergy or intolerance, contact the Percy Arms directly before ordering. Do not rely only on the order-notes box.
              </p>
              <a
                href="https://www.gov.uk/food-allergies"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#153f38] underline underline-offset-4"
              >
                Read the Food Standards Agency guidance <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </aside>

        <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <div className="space-y-8">
            <Card className="surface-card gap-0 py-0">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="section-number">1</span>
                  <div>
                    <p className="section-kicker"><CalendarCheck className="size-3.5" /> Plan your visit</p>
                    <CardTitle className="mt-1 font-serif text-2xl tracking-[-0.02em] sm:text-3xl">When and how?</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pb-6">
                <RadioGroup
                  value={service}
                  onValueChange={(value) => {
                    setService(value as ServiceType);
                    setTimeSlot("");
                  }}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    className={`choice-card ${service === "dine_in" ? "choice-card-active" : ""}`}
                  >
                    <RadioGroupItem value="dine_in" className="sr-only" />
                    <UtensilsCrossed className="size-6" />
                    <span>
                      <strong>Dine in</strong>
                      <small>Book a table</small>
                    </span>
                  </Label>
                  <Label
                    className={`choice-card ${service === "takeaway" ? "choice-card-active" : ""}`}
                  >
                    <RadioGroupItem value="takeaway" className="sr-only" />
                    <ShoppingBag className="size-6" />
                    <span>
                      <strong>Takeaway</strong>
                      <small>Pick it up</small>
                    </span>
                  </Label>
                </RadioGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="order-date">Which Sunday?</Label>
                    <Select value={mealDate} onValueChange={setMealDate}>
                      <SelectTrigger
                        id="order-date"
                        className="field-shell h-12 w-full rounded-xl"
                      >
                        <SelectValue placeholder="Choose a Sunday" />
                      </SelectTrigger>
                      <SelectContent>
                        {sundays.map((sunday) => (
                          <SelectItem key={sunday.value} value={sunday.value}>
                            {sunday.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order-time">
                      {service === "dine_in" ? "Table time" : "Collection time"}
                    </Label>
                    <Select value={timeSlot} onValueChange={setTimeSlot}>
                      <SelectTrigger
                        id="order-time"
                        className="field-shell h-12 w-full rounded-xl"
                      >
                        <SelectValue placeholder="Choose a time" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="flex items-center gap-3">
                <span className="section-number">2</span>
                <div>
                  <p className="section-kicker"><ChefHat className="size-3.5" /> Sunday menu</p>
                  <h2 className="mt-1 font-serif text-3xl font-bold tracking-[-0.03em]">
                    Choose your meals
                  </h2>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {([
                  {
                    type: "adult" as const,
                    title: "Adult Sunday Roast",
                    detail: "A full Sunday dinner with your choice of meat.",
                    price: menu.adultMealPrice,
                    icon: UtensilsCrossed,
                  },
                  {
                    type: "child" as const,
                    title: "Children’s Sunday Roast",
                    detail: "A smaller portion, with the same meat choices.",
                    price: menu.childMealPrice,
                    icon: Baby,
                  },
                ]).map((meal) => {
                  const Icon = meal.icon;
                  return (
                    <Card
                      key={meal.type}
                      className="surface-card surface-card-interactive overflow-hidden"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid size-11 place-items-center rounded-full bg-[#e8efeb] text-[#153f38]">
                            <Icon />
                          </div>
                          <strong className="rounded-full bg-[#f4efe4] px-3 py-1.5 text-lg text-[#153f38]">
                            {money(meal.price)}
                          </strong>
                        </div>
                        <CardTitle className="font-serif text-2xl tracking-[-0.02em]">
                          {meal.title}
                        </CardTitle>
                        <p className="text-sm leading-6 text-[#61706c]">
                          {meal.detail}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Button
                          className="h-11 w-full rounded-xl bg-[#153f38] shadow-md shadow-[#153f38]/10 hover:bg-[#235c52]"
                          onClick={() => openMeal(meal.type)}
                          disabled={!menu.configured || !menu.orderingOpen || availableMeats.length === 0}
                        >
                          Choose meat and add <Plus />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="section-number">3</span>
                <div>
                  <p className="section-kicker"><Plus className="size-3.5" /> Make it yours</p>
                  <h2 className="mt-1 font-serif text-3xl font-bold tracking-[-0.03em]">Add extras</h2>
                </div>
              </div>
              <Card className="surface-card mt-4 gap-0 overflow-hidden py-0">
                {menu.extras.map((extra, index) => {
                  const quantity =
                    cartExtras.find((item) => item.id === extra.id)?.quantity ?? 0;
                  return (
                    <div
                      key={extra.id}
                      className={`flex items-center justify-between gap-4 p-5 transition-colors hover:bg-[#fafbf8] ${index > 0 ? "border-t border-[#e7e9e5]" : ""}`}
                    >
                      <div>
                        <p className="font-semibold">{extra.name}</p>
                        <p className="mt-1 font-bold text-[#a35f34]">
                          {money(extra.pricePence)}
                        </p>
                      </div>
                      {quantity === 0 ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full border-[#153f38]/20 bg-[#f8faf8] text-[#153f38] hover:bg-[#e8efeb]"
                          onClick={() => addExtra(extra.id)}
                          disabled={!menu.configured || !menu.orderingOpen}
                        >
                          <Plus />
                          <span className="sr-only">Add {extra.name}</span>
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full"
                            onClick={() => changeExtraQuantity(extra.id, -1)}
                          >
                            <Minus />
                          </Button>
                          <span className="w-5 text-center font-bold">{quantity}</span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full"
                            onClick={() => changeExtraQuantity(extra.id, 1)}
                          >
                            <Plus />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          </div>

          <Card className="surface-card overflow-hidden lg:sticky lg:top-24">
            <CardHeader className="border-b border-[#e5e9e5] bg-[#fbfcfa]">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-serif text-2xl tracking-[-0.02em]">
                  <ShoppingBag className="text-[#a35f34]" /> Your basket
                </CardTitle>
                <Badge className="bg-[#e8efeb] text-[#153f38]">
                  {mealCount + specialCount + extraCount} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {cartMeals.length === 0 &&
                cartSpecials.length === 0 &&
                cartExtras.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#d4ddd8] bg-[#fafbf9] px-5 py-8 text-center text-sm leading-6 text-[#73807c]">
                  <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-[#e8efeb] text-[#153f38]">
                    <ReceiptText className="size-5" />
                  </div>
                  Your chosen meals, specials and extras will appear here.
                </div>
              )}

              {cartMeals.map((item) => {
                const unitPrice =
                  item.mealType === "adult"
                    ? menu.adultMealPrice
                    : menu.childMealPrice;
                return (
                  <div key={item.id} className="border-b border-[#eee6da] pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.mealType === "adult"
                            ? "Adult Sunday Roast"
                            : "Children’s Sunday Roast"}
                        </p>
                        <p className="mt-1 text-sm capitalize text-[#75685f]">
                          {item.meat}
                        </p>
                      </div>
                      <strong>{money(unitPrice * item.quantity)}</strong>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          onClick={() => changeMealQuantity(item.id, -1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          onClick={() => changeMealQuantity(item.id, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-[#8b3838]"
                        onClick={() =>
                          setCartMeals((current) =>
                            current.filter((meal) => meal.id !== item.id),
                          )
                        }
                      >
                        <Trash2 />
                        <span className="sr-only">Remove meal</span>
                      </Button>
                    </div>
                  </div>
                );
              })}

              {cartSpecials.map((item) => {
                const option = menu.specials.find(
                  (special) => special.id === item.id,
                );
                if (!option) return null;
                return (
                  <div key={item.id} className="border-b border-[#eee6da] pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="whitespace-pre-wrap font-semibold">
                          {option.text}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#df654d]">
                          Special
                        </p>
                      </div>
                      <strong>{money(option.pricePence * item.quantity)}</strong>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          onClick={() => changeSpecialQuantity(item.id, -1)}
                        >
                          <Minus />
                        </Button>
                        <span className="w-5 text-center font-bold">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          onClick={() => changeSpecialQuantity(item.id, 1)}
                        >
                          <Plus />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-[#8b3838]"
                        onClick={() =>
                          setCartSpecials((current) =>
                            current.filter((special) => special.id !== item.id),
                          )
                        }
                      >
                        <Trash2 />
                        <span className="sr-only">Remove special</span>
                      </Button>
                    </div>
                  </div>
                );
              })}

              {cartExtras.map((item) => {
                const option = menu.extras.find((extra) => extra.id === item.id);
                if (!option) return null;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {item.quantity} × {option.name}
                    </span>
                    <strong>{money(option.pricePence * item.quantity)}</strong>
                  </div>
                );
              })}

              <div className="flex items-center justify-between border-t border-[#ded2c4] pt-4">
                <span className="text-lg font-bold">Total</span>
                      <strong className="text-2xl text-[#153f38]">{money(totalPence)}</strong>
              </div>
              {submitError && !checkoutOpen && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {submitError}
                </p>
              )}
              <Button
                className="h-13 w-full rounded-xl bg-[#153f38] text-base font-bold shadow-lg shadow-[#153f38]/15 hover:bg-[#235c52]"
                onClick={beginCheckout}
                disabled={
                  !menu.configured ||
                  !menu.orderingOpen ||
                  (cartMeals.length === 0 && cartSpecials.length === 0)
                }
              >
                Go to checkout <ChevronRight />
              </Button>
              <p className="text-center text-xs text-[#81736a]">
                Payment is taken at the pub.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {mealCount + specialCount + extraCount > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/15 bg-[#102f2a]/95 p-2.5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 pl-2">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#c6d8d1]">
                {mealCount + specialCount + extraCount} items
              </p>
              <p className="text-lg font-black">{money(totalPence)}</p>
            </div>
            <Button
              className="h-12 rounded-xl bg-[#d9ad5b] px-5 font-bold text-[#102f2a] hover:bg-[#e7c67d]"
              onClick={beginCheckout}
              disabled={
                !menu.configured ||
                !menu.orderingOpen ||
                (cartMeals.length === 0 && cartSpecials.length === 0)
              }
            >
              Checkout <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={selectedMealType !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMealType(null);
        }}
      >
        <DialogContent className="rounded-[1.75rem] border-[#d9ded9] bg-[#fffefa] shadow-[0_28px_90px_rgba(16,47,42,0.24)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {selectedMealType === "child"
                ? "Children’s Sunday Roast"
                : "Adult Sunday Roast"}
            </DialogTitle>
            <DialogDescription>
              Choose the meat and number of dinners.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-bold">Choose your meat</legend>
              <RadioGroup
                value={selectedMeat}
                onValueChange={(value) => setSelectedMeat(value as MeatChoice)}
                className="mt-3 grid grid-cols-3 gap-2"
              >
                {(["chicken", "beef", "pork"] as MeatChoice[]).map((meat) => (
                  <Label
                    key={meat}
                    className={`meat-card ${selectedMeat === meat ? "meat-card-active" : ""} ${!availableMeats.includes(meat) ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <RadioGroupItem value={meat} className="sr-only" disabled={!availableMeats.includes(meat)} />
                    <span className="capitalize">
                      {meat}
                      {!availableMeats.includes(meat) && <small className="mt-0.5 block text-[0.7rem] normal-case">Sold out</small>}
                    </span>
                    {selectedMeat === meat && <Check className="size-4" />}
                  </Label>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="flex items-center justify-between rounded-2xl border border-[#e1e5e0] bg-[#f7f5ef] p-4">
              <div>
                <p className="font-semibold">Quantity</p>
                <p className="mt-1 text-sm text-[#75685f]">
                  {money(
                    selectedMealType === "child"
                      ? menu.childMealPrice
                      : menu.adultMealPrice,
                  )}{" "}
                  each
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() =>
                    setSelectedQuantity((quantity) => Math.max(1, quantity - 1))
                  }
                  disabled={selectedQuantity === 1}
                >
                  <Minus />
                </Button>
                <strong className="w-6 text-center text-lg">
                  {selectedQuantity}
                </strong>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() =>
                    setSelectedQuantity((quantity) => Math.min(10, quantity + 1))
                  }
                  disabled={selectedQuantity === 10}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="h-12 w-full rounded-xl bg-[#153f38] hover:bg-[#235c52]"
              onClick={addMeal}
              disabled={!availableMeats.includes(selectedMeat)}
            >
              Add to basket ·{" "}
              {money(
                (selectedMealType === "child"
                  ? menu.childMealPrice
                  : menu.adultMealPrice) * selectedQuantity,
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] border-[#d9ded9] bg-[#fffefa] shadow-[0_28px_90px_rgba(16,47,42,0.24)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl">Checkout</DialogTitle>
            <DialogDescription>
              Your {service === "dine_in" ? "table" : "collection"} is for{" "}
              {mealDate
                ? new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date(`${mealDate}T12:00:00`))
                : "Sunday"}{" "}
              at {timeSlot || "your chosen time"}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitOrder}>
            <div className="rounded-2xl border border-[#e1e5e0] bg-[#f7f5ef] p-4">
              <div className="flex justify-between text-sm">
                <span>
                  {mealCount} meal{mealCount === 1 ? "" : "s"}
                  {extraCount > 0
                    ? ` and ${extraCount} extra${extraCount === 1 ? "" : "s"}`
                    : ""}
                </span>
                <strong>{money(totalPence)}</strong>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-name">Name</Label>
                <Input
                  id="checkout-name"
                  name="customerName"
                  autoComplete="name"
                  required
                  className="field-shell h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-phone">Mobile number</Label>
                <Input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  className="field-shell h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-email">Email</Label>
              <Input
                id="checkout-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="field-shell h-11 rounded-xl"
              />
            </div>
            <div className="rounded-2xl border border-[#e4c35a] bg-[#fff9df] p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="allergen-confirmation"
                  checked={allergenConfirmed}
                  onCheckedChange={(checked) => setAllergenConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="allergen-confirmation" className="cursor-pointer text-sm leading-6 text-[#564317]">
                  I have read the allergen notice. If anyone covered by this order has an allergy or intolerance, I have contacted the Percy Arms before placing the order.
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-notes">
                Anything we need to know?{" "}
                <span className="font-normal text-[#87796f]">(optional)</span>
              </Label>
              <Textarea
                id="checkout-notes"
                name="notes"
                placeholder="High chair, access needs or food allergy details"
                className="field-shell min-h-24 rounded-xl"
              />
            </div>
            {submitError && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {submitError}
              </p>
            )}
            <Button
              type="submit"
              className="h-13 w-full rounded-xl bg-[#153f38] text-base font-bold shadow-lg shadow-[#153f38]/15 hover:bg-[#235c52]"
              disabled={submitting || !allergenConfirmed}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Placing order…
                </>
              ) : (
                <>
                  Place order · {money(totalPence)} <ChevronRight />
                </>
              )}
            </Button>
            <p className="text-center text-xs leading-5 text-[#81736a]">
              Your order is saved for the pub and payment is taken on arrival or
              collection.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
