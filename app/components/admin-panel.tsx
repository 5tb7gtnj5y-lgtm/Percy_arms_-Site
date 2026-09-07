"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Plus,
  ReceiptText,
  Save,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type {
  AdminMenuConfig,
  AdminOrder,
  ExtraOption,
  OrderStatus,
} from "@/lib/order-types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

function money(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function poundsToPence(value: string) {
  const pounds = Number(value);
  return Number.isFinite(pounds) ? Math.round(pounds * 100) : -1;
}

function penceToPounds(value: number) {
  return (value / 100).toFixed(2);
}

export function AdminPanel() {
  const [config, setConfig] = useState<AdminMenuConfig | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [adultPrice, setAdultPrice] = useState("");
  const [childPrice, setChildPrice] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [orderingOpen, setOrderingOpen] = useState(true);
  const [chickenAvailable, setChickenAvailable] = useState(true);
  const [beefAvailable, setBeefAvailable] = useState(true);
  const [porkAvailable, setPorkAvailable] = useState(true);
  const [serviceMessage, setServiceMessage] = useState("");
  const [extras, setExtras] = useState<ExtraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [clearingSeen, setClearingSeen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const knownOrderIds = useRef(new Set<number>());

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/menu?admin=1").then(async (response) => {
        const result = (await response.json()) as AdminMenuConfig & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Menu settings could not be loaded.");
        }
        return result;
      }),
      fetch("/api/orders").then(async (response) => {
        const result = (await response.json()) as {
          orders?: AdminOrder[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Orders could not be loaded.");
        }
        return result.orders ?? [];
      }),
    ])
      .then(([menuConfig, savedOrders]) => {
        if (!active) return;
        setConfig(menuConfig);
        setAdultPrice(penceToPounds(menuConfig.adultMealPrice));
        setChildPrice(penceToPounds(menuConfig.childMealPrice));
        setOrderEmail(menuConfig.orderEmail);
        setOrderingOpen(menuConfig.orderingOpen);
        setChickenAvailable(menuConfig.chickenAvailable);
        setBeefAvailable(menuConfig.beefAvailable);
        setPorkAvailable(menuConfig.porkAvailable);
        setServiceMessage(menuConfig.serviceMessage);
        setExtras(menuConfig.extras);
        setOrders(savedOrders);
        knownOrderIds.current = new Set(savedOrders.map((order) => order.id));
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "The admin area could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const poll = window.setInterval(async () => {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const result = (await response.json()) as {
          orders?: AdminOrder[];
          error?: string;
        };
        if (!response.ok) return;
        const latestOrders = result.orders ?? [];
        const newOrders = latestOrders.filter(
          (order) => !knownOrderIds.current.has(order.id),
        );
        knownOrderIds.current = new Set(latestOrders.map((order) => order.id));
        if (!active) return;
        setOrders(latestOrders);

        if (newOrders.length > 0) {
          const newest = newOrders[0];
          toast.success(
            newOrders.length === 1
              ? "New Sunday lunch order"
              : `${newOrders.length} new Sunday lunch orders`,
            {
              description: `${newest.reference} · ${newest.customerName} · ${money(newest.totalPence)}`,
            },
          );
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New Percy Arms order", {
              body: `${newest.reference} · ${newest.customerName} · ${money(newest.totalPence)}`,
              icon: "/favicon.svg",
            });
          }
        }
      } catch {
        // The next poll will retry without interrupting the admin.
      }
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast.success("Order alerts are on", {
        description: "You’ll get a browser notification when a new order arrives.",
      });
    } else {
      toast.error("Browser notifications were not enabled");
    }
  }

  async function setSeen(order: AdminOrder, seen: boolean) {
    setBusyOrderId(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: order.id, seen }),
      });
      const result = (await response.json()) as {
        order?: { id: number; seenAt: string | null };
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error || "The order could not be updated.");
      }
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, seenAt: result.order!.seenAt } : item,
        ),
      );
      toast.success(seen ? "Order marked as seen" : "Order marked as new");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The order could not be updated.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function setOrderStatus(order: AdminOrder, status: OrderStatus) {
    setBusyOrderId(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const result = (await response.json()) as {
        order?: {
          id: number;
          seenAt: string | null;
          status: OrderStatus;
          statusUpdatedAt: string | null;
        };
        error?: string;
      };
      if (!response.ok || !result.order) {
        throw new Error(result.error || "The order status could not be updated.");
      }
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: result.order!.status,
                statusUpdatedAt: result.order!.statusUpdatedAt,
                seenAt: result.order!.seenAt,
              }
            : item,
        ),
      );
      toast.success(`${order.reference} is now ${STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The status could not be updated.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function deleteOrder(order: AdminOrder) {
    setBusyOrderId(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const result = (await response.json()) as { deleted?: boolean; error?: string };
      if (!response.ok || !result.deleted) {
        throw new Error(result.error || "The order could not be deleted.");
      }
      setOrders((current) => current.filter((item) => item.id !== order.id));
      knownOrderIds.current.delete(order.id);
      toast.success(`${order.reference} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The order could not be deleted.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function clearSeenOrders() {
    setClearingSeen(true);
    try {
      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clearSeen: true }),
      });
      const result = (await response.json()) as {
        deleted?: boolean;
        count?: number;
        error?: string;
      };
      if (!response.ok || !result.deleted) {
        throw new Error(result.error || "Seen orders could not be cleared.");
      }
      const clearedIds = new Set(
        orders.filter((order) => order.seenAt).map((order) => order.id),
      );
      setOrders((current) => current.filter((order) => !order.seenAt));
      for (const id of clearedIds) knownOrderIds.current.delete(id);
      toast.success(
        result.count === 1 ? "1 seen order cleared" : `${result.count ?? 0} seen orders cleared`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Seen orders could not be cleared.");
    } finally {
      setClearingSeen(false);
    }
  }

  function changeExtra(
    id: string,
    changes: Partial<Pick<ExtraOption, "name" | "pricePence" | "active">>,
  ) {
    setExtras((current) =>
      current.map((extra) => (extra.id === id ? { ...extra, ...changes } : extra)),
    );
    setSaved(false);
  }

  function addExtra() {
    setExtras((current) => [
      ...current,
      {
        id: `extra-${crypto.randomUUID()}`,
        name: "New extra",
        pricePence: 0,
        active: true,
        sortOrder: current.length,
      },
    ]);
    setSaved(false);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    setSaved(false);

    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          adultMealPrice: poundsToPence(adultPrice),
          childMealPrice: poundsToPence(childPrice),
          orderEmail,
          orderingOpen,
          chickenAvailable,
          beefAvailable,
          porkAvailable,
          serviceMessage,
          extras,
        }),
      });
      const result = (await response.json()) as AdminMenuConfig & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "The menu settings could not be saved.");
      }
      setConfig(result);
      setExtras(result.extras);
      setAdultPrice(penceToPounds(result.adultMealPrice));
      setChildPrice(penceToPounds(result.childMealPrice));
      setOrderEmail(result.orderEmail);
      setOrderingOpen(result.orderingOpen);
      setChickenAvailable(result.chickenAvailable);
      setBeefAvailable(result.beefAvailable);
      setPorkAvailable(result.porkAvailable);
      setServiceMessage(result.serviceMessage);
      setSaved(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The menu settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[28rem] max-w-6xl items-center justify-center gap-3 px-4 text-[#6e625a]">
        <Loader2 className="animate-spin" /> Loading the admin area…
      </div>
    );
  }

  if (!config || loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          {loadError || "The admin area could not be loaded."}
        </div>
      </div>
    );
  }

  const unreadCount = orders.filter((order) => !order.seenAt).length;
  const seenCount = orders.filter((order) => order.seenAt).length;
  const filteredOrders = orders.filter((order) => {
    const query = orderSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.reference.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.phone.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function downloadOrders() {
    const cells = [
      ["Reference", "Customer", "Date", "Time", "Service", "Status", "Total", "Phone", "Email"],
      ...filteredOrders.map((order) => [
        order.reference,
        order.customerName,
        order.mealDate,
        order.timeSlot,
        order.service,
        STATUS_LABELS[order.status],
        (order.totalPence / 100).toFixed(2),
        order.phone,
        order.email,
      ]),
    ];
    const csv = cells
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `percy-arms-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#123c37] via-[#18564e] to-[#20766b] p-6 text-white shadow-[0_22px_58px_rgba(18,60,55,0.22)] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-[#f4c95d]/20 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Badge className="bg-[#f4c95d] text-[#123c37]">Pub admin</Badge>
            <h2 className="mt-4 font-serif text-4xl font-bold">
              Menu, email and orders
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#d6f0e9]">
              Set prices and extras, then manage incoming Sunday lunch orders in one place.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-black">{orders.length}</p>
              <p className="text-xs text-[#d6f0e9]">Total orders</p>
            </div>
            <div className="rounded-2xl border border-[#f4c95d]/40 bg-[#f4c95d]/15 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-black text-[#f4c95d]">{unreadCount}</p>
              <p className="text-xs text-[#d6f0e9]">New</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <form onSubmit={saveSettings} className="space-y-6">
          <Card className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Settings2 className="text-[#df654d]" /> Main meal prices
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adult-price">Adult Sunday roast</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#6e625a]">
                    £
                  </span>
                  <Input
                    id="adult-price"
                    type="number"
                    min="0.01"
                    max="500"
                    step="0.01"
                    value={adultPrice}
                    onChange={(event) => {
                      setAdultPrice(event.target.value);
                      setSaved(false);
                    }}
                    className="h-12 rounded-xl pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="child-price">Children’s Sunday roast</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#6e625a]">
                    £
                  </span>
                  <Input
                    id="child-price"
                    type="number"
                    min="0.01"
                    max="500"
                    step="0.01"
                    value={childPrice}
                    onChange={(event) => {
                      setChildPrice(event.target.value);
                      setSaved(false);
                    }}
                    className="h-12 rounded-xl pl-7"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Online ordering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f4f8f6] p-4">
                <div>
                  <Label htmlFor="ordering-open" className="text-base">Accept online orders</Label>
                  <p className="mt-1 text-sm text-[#60716d]">
                    Close ordering instantly when the kitchen is full.
                  </p>
                </div>
                <Switch
                  id="ordering-open"
                  checked={orderingOpen}
                  onCheckedChange={(checked) => {
                    setOrderingOpen(checked);
                    setSaved(false);
                  }}
                />
              </div>
              <div className="rounded-2xl border border-[#d9e6e2] p-4">
                <p className="font-semibold">Meat availability</p>
                <p className="mt-1 text-sm leading-6 text-[#60716d]">
                  Switch off a sold-out meat while keeping the other choices live.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {([
                    ["Chicken", "chicken-available", chickenAvailable, setChickenAvailable],
                    ["Beef", "beef-available", beefAvailable, setBeefAvailable],
                    ["Pork", "pork-available", porkAvailable, setPorkAvailable],
                  ] as const).map(([label, id, available, setAvailable]) => (
                    <div key={id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 ${available ? "bg-[#edf3e9]" : "bg-[#fff2ee]"}`}>
                      <Label htmlFor={id}>{label}</Label>
                      <Switch
                        id={id}
                        checked={available}
                        onCheckedChange={(checked) => {
                          setAvailable(checked);
                          setSaved(false);
                        }}
                        aria-label={`${label} ${available ? "available" : "sold out"}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-message">Customer notice</Label>
                <Textarea
                  id="service-message"
                  value={serviceMessage}
                  onChange={(event) => {
                    setServiceMessage(event.target.value);
                    setSaved(false);
                  }}
                  maxLength={240}
                  placeholder="For example: Beef is sold out for this Sunday."
                  className="min-h-24 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Mail className="text-[#df654d]" /> Order email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-email">Send new orders to</Label>
                <Input
                  id="order-email"
                  type="email"
                  value={orderEmail}
                  onChange={(event) => {
                    setOrderEmail(event.target.value);
                    setSaved(false);
                  }}
                  placeholder="orders@percyarms.co.uk"
                  className="h-12 rounded-xl"
                  required
                />
              </div>
              <div
                className={`flex gap-3 rounded-xl p-4 text-sm leading-6 ${config.emailServiceReady ? "bg-[#edf3e9] text-[#34543c]" : "bg-[#fff8df] text-[#614b1f]"}`}
              >
                {config.emailServiceReady ? (
                  <Check className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <CircleAlert className="mt-0.5 size-5 shrink-0" />
                )}
                <p>
                  {config.emailServiceReady
                    ? "Automatic order email is connected."
                    : "Orders will still be saved in the inbox. Automatic email needs the Resend key and verified sender address to be connected."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-[0_12px_34px_rgba(55,37,25,0.08)]">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="font-serif text-2xl">Extras</CardTitle>
                <Button type="button" variant="outline" onClick={addExtra}>
                  <Plus /> Add extra
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extras.map((extra) => (
                <div
                  key={extra.id}
                  className="grid gap-3 rounded-2xl border border-[#e7ded2] p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`extra-name-${extra.id}`}>Extra name</Label>
                    <Input
                      id={`extra-name-${extra.id}`}
                      value={extra.name}
                      onChange={(event) =>
                        changeExtra(extra.id, { name: event.target.value })
                      }
                      maxLength={80}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`extra-price-${extra.id}`}>Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold">
                        £
                      </span>
                      <Input
                        id={`extra-price-${extra.id}`}
                        type="number"
                        min="0"
                        max="500"
                        step="0.01"
                        value={penceToPounds(extra.pricePence)}
                        onChange={(event) =>
                          changeExtra(extra.id, {
                            pricePence: poundsToPence(event.target.value),
                          })
                        }
                        className="h-11 rounded-xl pl-7"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7f1] px-3 py-3 sm:justify-start">
                    <Label htmlFor={`extra-active-${extra.id}`}>Show</Label>
                    <Switch
                      id={`extra-active-${extra.id}`}
                      checked={extra.active}
                      onCheckedChange={(active) =>
                        changeExtra(extra.id, { active })
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {saveError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {saveError}
            </p>
          )}
          {saved && (
            <p className="flex items-center gap-2 rounded-xl bg-[#edf3e9] px-4 py-3 text-sm font-semibold text-[#34543c]">
              <Check className="size-4" /> Menu and order settings saved.
            </p>
          )}
          <Button
            type="submit"
            className="h-13 w-full rounded-xl bg-[#123c37] text-base font-bold shadow-lg shadow-[#123c37]/15 hover:bg-[#1d5a52]"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save /> Save menu and email
              </>
            )}
          </Button>
        </form>

        <div className="lg:sticky lg:top-24">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#df654d]">
                Admin inbox
              </p>
              <h3 className="mt-2 font-serif text-3xl font-bold">Orders</h3>
            </div>
            <div className="flex items-center gap-2">
              {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                <Button type="button" size="sm" variant="outline" onClick={enableNotifications} className="rounded-full">
                  <Bell /> Enable alerts
                </Button>
              )}
              <Badge className="bg-[#123c37] text-white">{unreadCount} new</Badge>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={seenCount === 0 || clearingSeen}
                >
                  {clearingSeen ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  Clear seen orders{seenCount > 0 ? ` (${seenCount})` : ""}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all seen orders?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes {seenCount} order{seenCount === 1 ? "" : "s"} already marked as seen. New orders will be kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep orders</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={clearSeenOrders}>
                    Clear seen orders
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#60716d]" />
              <Input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Search customer, phone or reference"
                className="h-10 rounded-xl bg-white pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl bg-white">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={downloadOrders} className="rounded-xl" disabled={filteredOrders.length === 0}>
              <Download /> CSV
            </Button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cdbfae] bg-white/55 p-9 text-center">
              <ReceiptText className="mx-auto size-10 text-[#df654d]" />
              <p className="mt-4 font-semibold">{orders.length === 0 ? "No orders yet" : "No matching orders"}</p>
              <p className="mt-2 text-sm text-[#6e625a]">
                {orders.length === 0 ? "New orders will appear here immediately." : "Try a different search or status filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className={`gap-4 overflow-hidden py-5 shadow-[0_12px_34px_rgba(18,60,55,0.08)] ${order.seenAt ? "border-[#d5e4df] bg-white" : "border-[#ef6a52] bg-[#fffdfb] ring-2 ring-[#ef6a52]/10"}`}
                >
                  <CardHeader className="gap-3 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-black tracking-wider text-[#123c37]">
                          {order.reference}
                          </p>
                          {!order.seenAt && <Badge className="bg-[#ef6a52] text-white">New</Badge>}
                        </div>
                        <CardTitle className="mt-2 font-serif text-2xl">
                          {order.customerName}
                        </CardTitle>
                      </div>
                      <strong className="text-xl">{money(order.totalPence)}</strong>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        <Clock3 /> {order.mealDate} · {order.timeSlot}
                      </Badge>
                      <Badge
                        className={
                          order.emailStatus === "sent"
                            ? "bg-[#34543c]"
                            : "bg-[#b16a20]"
                        }
                      >
                        {order.emailStatus === "sent"
                          ? "Email sent"
                          : order.emailStatus === "awaiting_setup"
                            ? "Saved · email setup needed"
                            : "Saved · email failed"}
                      </Badge>
                      <Badge className={order.status === "cancelled" ? "bg-red-700" : order.status === "completed" ? "bg-[#34543c]" : "bg-[#146f63]"}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5 text-sm">
                    {order.lines.meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex justify-between gap-3 border-t border-[#eee6da] pt-3"
                      >
                        <span>
                          {meal.quantity} × {meal.name}{" "}
                          <span className="capitalize text-[#75685f]">
                            ({meal.meat})
                          </span>
                        </span>
                        <strong>
                          {money(meal.unitPricePence * meal.quantity)}
                        </strong>
                      </div>
                    ))}
                    {order.lines.extras.map((extra) => (
                      <div key={extra.id} className="flex justify-between gap-3">
                        <span>
                          {extra.quantity} × {extra.name}
                        </span>
                        <strong>
                          {money(extra.unitPricePence * extra.quantity)}
                        </strong>
                      </div>
                    ))}
                    <div className="border-t border-[#eee6da] pt-3 leading-6 text-[#6e625a]">
                      <p>{order.service === "dine_in" ? "Dining in" : "Takeaway"}</p>
                      <p>
                        {order.phone} · {order.email}
                      </p>
                      {order.notes && <p className="mt-1">Note: {order.notes}</p>}
                      {order.allergenAcknowledged && (
                        <p className="mt-1 font-semibold text-[#34543c]">Allergen notice acknowledged</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-[#dfe9e5] pt-4">
                      <Select
                        value={order.status}
                        onValueChange={(value) => setOrderStatus(order, value as OrderStatus)}
                        disabled={busyOrderId === order.id}
                      >
                        <SelectTrigger className="h-9 w-[9.5rem] rounded-full bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant={order.seenAt ? "outline" : "default"}
                        className={order.seenAt ? "rounded-full" : "rounded-full bg-[#123c37] hover:bg-[#1d5a52]"}
                        disabled={busyOrderId === order.id}
                        onClick={() => setSeen(order, !order.seenAt)}
                      >
                        {order.seenAt ? <EyeOff /> : <Eye />}
                        {order.seenAt ? "Mark as new" : "Mark as seen"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                            <Trash2 /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {order.reference}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the order for {order.customerName}. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep order</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => deleteOrder(order)}>
                              Delete order
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
