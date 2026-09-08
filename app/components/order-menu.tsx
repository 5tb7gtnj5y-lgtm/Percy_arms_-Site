"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Baby,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
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
  MealType,
  MeatChoice,
  OrderConfirmation,
  PublicMenuConfig,
  ServiceType,
} from "@/lib/order-types";

const DINE_IN_TIMES = ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"];
const TAKEAWAY_TIMES = ["12:15", "12:45", "13:15", "13:45", "14:15", "14:45"];

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
    if (cartMeals.length === 0) {
      setSubmitError("Add at least one Sunday lunch to your basket.");
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
        <Card className="overflow-hidden rounded-[1.75rem] border-0 bg-white py-0 shadow-[0_18px_55px_rgba(55,37,25,0.12)]">
          <div className="bg-[#edf3e9] px-6 py-9 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#34543c] text-white">
              <Check className="size-8" strokeWidth={3} />
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-[#58715d]">
              Order received
            </p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-[#25382a]">
              We’ll see you Sunday
            </h2>
            <p className="mt-3 font-mono text-2xl font-black tracking-widest text-[#123c37]">
              {confirmation.reference}
            </p>
          </div>
          <CardContent className="space-y-5 px-6 py-7 sm:px-9">
            <div className="flex items-center justify-between rounded-2xl bg-[#f4f8f6] p-5">
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
      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="relative min-h-64 overflow-hidden rounded-[1.75rem] bg-[#123c37] text-white shadow-[0_20px_60px_rgba(18,60,55,0.22)]">
          <Image
            src="/sunday-roast.png"
            unoptimized
            alt="A roast beef Sunday lunch with Yorkshire pudding, roast potatoes and vegetables"
            fill
            priority
            sizes="(min-width: 1024px) 1152px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b2d29]/95 via-[#123c37]/80 to-[#20766b]/30" />
          <div className="relative max-w-xl p-6 sm:p-9">
            <Badge className="bg-[#f4c95d] text-[#123c37]">
              Order like your favourite takeaway app
            </Badge>
            <h1 className="mt-5 font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Build your Sunday lunch
            </h1>
            <p className="mt-3 leading-7 text-[#f6ead5]">
              Choose adult or children’s meals, pick the meat, add extras and
              check your basket before ordering.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#f6ead5]">
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-[#f4c95d]" /> Percy Arms, Blyth
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-4 text-[#f4c95d]" /> Sundays, noon–3pm
              </span>
            </div>
          </div>
        </div>

        {!menu.configured && (
          <div className="mt-5 rounded-2xl border border-[#e4c97e] bg-[#fff8df] px-5 py-4 text-sm leading-6 text-[#614b1f]">
            <strong>Ordering setup required:</strong> the admin needs to confirm
            prices and the order email before customers can check out.
          </div>
        )}
        {menu.configured && !menu.orderingOpen && (
          <div className="mt-5 rounded-2xl border border-[#ef6a52]/30 bg-[#fff2ee] px-5 py-4 text-sm leading-6 text-[#7b3024]">
            <strong>Online ordering is currently closed.</strong>{" "}
            {menu.serviceMessage || "Please check back soon or contact the pub for help."}
          </div>
        )}
        {menu.orderingOpen && menu.serviceMessage && (
          <div className="mt-5 rounded-2xl border border-[#146f63]/20 bg-[#e5f2ee] px-5 py-4 text-sm leading-6 text-[#123c37]">
            {menu.serviceMessage}
          </div>
        )}
        {menu.orderingOpen && soldOutMeats.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[#ef6a52]/30 bg-[#fff2ee] px-5 py-4 text-sm leading-6 text-[#7b3024]">
            <strong>
              {soldOutMeats.map((meat) => `${meat[0].toUpperCase()}${meat.slice(1)}`).join(", ")} {soldOutMeats.length === 1 ? "is" : "are"} sold out.
            </strong>{" "}
            {availableMeats.length > 0
              ? `${availableMeats.map((meat) => `${meat[0].toUpperCase()}${meat.slice(1)}`).join(" and ")} can still be ordered.`
              : "No meat choices are currently available."}
          </div>
        )}

        <aside className="mt-5 rounded-2xl border border-[#e4c35a] bg-[#fff9df] p-5 text-[#564317]" aria-labelledby="allergen-heading">
          <div className="flex gap-3">
            <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4c95d] text-[#123c37]">
              <Info className="size-5" />
            </div>
            <div>
              <h2 id="allergen-heading" className="font-serif text-xl font-bold">Food allergies and intolerances</h2>
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
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#123c37] underline underline-offset-4"
              >
                Read the Food Standards Agency guidance <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </aside>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="space-y-6">
            <Card className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
              <CardHeader>
                <CardTitle className="font-serif text-2xl">1. When and how?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
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
                        className="h-12 w-full rounded-xl bg-[#fcfaf6]"
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
                        className="h-12 w-full rounded-xl bg-[#fcfaf6]"
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
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#df654d]">
                Sunday menu
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold">
                2. Choose your meals
              </h2>
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
                      className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="grid size-11 place-items-center rounded-full bg-[#e5f2ee] text-[#146f63]">
                            <Icon />
                          </div>
                          <strong className="text-xl text-[#123c37]">
                            {money(meal.price)}
                          </strong>
                        </div>
                        <CardTitle className="font-serif text-2xl">
                          {meal.title}
                        </CardTitle>
                        <p className="text-sm leading-6 text-[#6e625a]">
                          {meal.detail}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Button
                          className="h-11 w-full rounded-xl bg-[#123c37] hover:bg-[#1d5a52]"
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
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#df654d]">
                Make it yours
              </p>
              <h2 className="mt-2 font-serif text-3xl font-bold">3. Add extras</h2>
              <Card className="mt-4 gap-0 overflow-hidden border-0 bg-white py-0 shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
                {menu.extras.map((extra, index) => {
                  const quantity =
                    cartExtras.find((item) => item.id === extra.id)?.quantity ?? 0;
                  return (
                    <div
                      key={extra.id}
                      className={`flex items-center justify-between gap-4 p-5 ${index > 0 ? "border-t border-[#eee6da]" : ""}`}
                    >
                      <div>
                        <p className="font-semibold">{extra.name}</p>
                        <p className="mt-1 font-bold text-[#df654d]">
                          {money(extra.pricePence)}
                        </p>
                      </div>
                      {quantity === 0 ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full border-[#123c37]/20 text-[#123c37]"
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

          <Card className="border-0 bg-white shadow-[0_16px_42px_rgba(55,37,25,0.12)] lg:sticky lg:top-24">
            <CardHeader className="border-b border-[#eee6da]">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <ShoppingBag className="text-[#df654d]" /> Your basket
                </CardTitle>
                <Badge className="bg-[#e5f2ee] text-[#123c37]">
                  {mealCount + extraCount} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {cartMeals.length === 0 && cartExtras.length === 0 && (
                <div className="py-8 text-center text-sm leading-6 text-[#81736a]">
                  <ReceiptText className="mx-auto mb-3 size-9 opacity-50" />
                  Your chosen meals and extras will appear here.
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
                <strong className="text-2xl text-[#123c37]">{money(totalPence)}</strong>
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
                className="h-13 w-full rounded-xl bg-[#123c37] text-base font-bold shadow-lg shadow-[#123c37]/15 hover:bg-[#1d5a52]"
                onClick={beginCheckout}
                disabled={!menu.configured || !menu.orderingOpen || cartMeals.length === 0}
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

      <Dialog
        open={selectedMealType !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMealType(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
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
            <div className="flex items-center justify-between rounded-2xl bg-[#faf7f1] p-4">
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
              className="h-12 w-full bg-[#123c37] hover:bg-[#1d5a52]"
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
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
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
            <div className="rounded-2xl bg-[#faf7f1] p-4">
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
                  className="h-11 rounded-xl"
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
                  className="h-11 rounded-xl"
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
                className="h-11 rounded-xl"
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
                className="min-h-24 rounded-xl"
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
              className="h-13 w-full rounded-xl bg-[#123c37] text-base font-bold hover:bg-[#1d5a52]"
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
