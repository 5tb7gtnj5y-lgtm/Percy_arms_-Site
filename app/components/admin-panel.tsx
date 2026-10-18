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
  Sparkles,
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
  SpecialOption,
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

function DirectPriceInput({
  id,
  valuePence,
  min = "0",
  className,
  onChange,
}: {
  id: string;
  valuePence: number;
  min?: string;
  className: string;
  onChange: (pricePence: number) => void;
}) {
  const [draft, setDraft] = useState(() => penceToPounds(valuePence));
  const [editing, setEditing] = useState(false);

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max="500"
      step="0.01"
      value={editing ? draft : penceToPounds(valuePence)}
      onFocus={(event) => {
        setDraft(penceToPounds(valuePence));
        setEditing(true);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const pricePence = poundsToPence(next);
        if (pricePence >= 0 && pricePence <= 50000) onChange(pricePence);
      }}
      onBlur={() => {
        setEditing(false);
      }}
      className={className}
      required
    />
  );
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
  const [specials, setSpecials] = useState<SpecialOption[]>([]);
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
        setSpecials(menuConfig.specials);
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

  async function retryOrderEmails(order: AdminOrder) {
    setBusyOrderId(order.id);
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: order.id, retryEmails: true }),
      });
      const result = await response.json() as { order?: { emailStatus: string }; error?: string };
      if (!response.ok || !result.order) throw new Error(result.error || "Email retry failed.");
      const emailStatus = result.order.emailStatus;
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, emailStatus } : item));
      if (emailStatus === "sent") toast.success("The email provider accepted the pub and customer emails. Check the customer inbox.");
      else toast.error(emailStatus.startsWith("failed:") ? emailStatus.slice(8) : "Email setup is incomplete. Check RESEND_API_KEY and RESEND_FROM_EMAIL in Cloudflare.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email retry failed.");
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

  function changeSpecial(
    id: string,
    changes: Partial<Pick<SpecialOption, "text" | "pricePence" | "active">>,
  ) {
    setSpecials((current) =>
      current.map((special) =>
        special.id === id ? { ...special, ...changes } : special,
      ),
    );
    setSaved(false);
  }

  function addSpecial() {
    setSpecials((current) => [
      ...current,
      {
        id: `special-${crypto.randomUUID()}`,
        text: "",
        pricePence: 0,
        active: true,
        sortOrder: current.length,
      },
    ]);
    setSaved(false);
  }

  function removeSpecial(id: string) {
    setSpecials((current) =>
      current
        .filter((special) => special.id !== id)
        .map((special, index) => ({ ...special, sortOrder: index })),
    );
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
          specials,
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
      setSpecials(result.specials);
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
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="gentle-rise relative overflow-hidden rounded-[2rem] bg-[#102f2a] p-6 text-white shadow-[0_26px_72px_rgba(16,47,42,0.22)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full bg-[#d9ad5b]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#6ca28f]/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <Badge className="border border-[#e7c67d]/30 bg-[#d9ad5b] px-3 py-1.5 text-[#102f2a]">Live service dashboard</Badge>
            <h2 className="mt-5 max-w-2xl font-serif text-4xl font-bold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
              Sunday service, all in one place.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#c9d9d3]">
              Update the menu, control availability and keep every incoming order moving.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            <div className="min-w-24 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur">
              <p className="text-2xl font-black tracking-tight">{orders.length}</p>
              <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#b7cbc4]">Orders</p>
            </div>
            <div className="min-w-24 rounded-2xl border border-[#d9ad5b]/30 bg-[#d9ad5b]/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-black tracking-tight text-[#e7c67d]">{unreadCount}</p>
              <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#b7cbc4]">New</p>
            </div>
            <div className="min-w-24 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur">
              <p className={`text-sm font-black ${orderingOpen ? "text-[#93d5a5]" : "text-[#f2a795]"}`}>
                {orderingOpen ? "Open" : "Paused"}
              </p>
              <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#b7cbc4]">Ordering</p>
            </div>
            <Button
              type="submit"
              form="menu-settings"
              className="h-auto min-h-[4.25rem] rounded-2xl bg-[#d9ad5b] px-5 font-bold text-[#102f2a] shadow-lg shadow-black/10 hover:bg-[#e7c67d]"
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              <span className="hidden sm:inline">Save changes</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1.06fr_0.94fr] lg:items-start">
        <form id="menu-settings" onSubmit={saveSettings} className="space-y-6">
          <Card className="admin-card">
            <CardHeader>
              <p className="section-kicker">Menu setup</p>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl tracking-[-0.02em]">
                <Settings2 className="text-[#a35f34]" /> Main meal prices
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
                    inputMode="decimal"
                    min="0.01"
                    max="500"
                    step="0.01"
                    value={adultPrice}
                    onChange={(event) => {
                      setAdultPrice(event.target.value);
                      setSaved(false);
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    className="field-shell h-12 rounded-xl pl-7"
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
                    inputMode="decimal"
                    min="0.01"
                    max="500"
                    step="0.01"
                    value={childPrice}
                    onChange={(event) => {
                      setChildPrice(event.target.value);
                      setSaved(false);
                    }}
                    onFocus={(event) => event.currentTarget.select()}
                    className="field-shell h-12 rounded-xl pl-7"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-kicker">Promote this week</p>
                  <CardTitle className="mt-1 flex items-center gap-2 font-serif text-2xl tracking-[-0.02em]">
                    <Sparkles className="text-[#a35f34]" /> Specials board
                  </CardTitle>
                  <p className="mt-2 text-sm leading-6 text-[#60716d]">
                    Add a description and price. Customers can order each special through the normal checkout.
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={addSpecial}>
                  <Plus /> Add special
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {specials.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#cfded9] bg-[#f7faf9] px-5 py-6 text-center text-sm leading-6 text-[#60716d]">
                  No specials have been added yet. Select <strong>Add special</strong> to create one.
                </div>
              )}
              {specials.map((special, index) => (
                <div
                  key={special.id}
                  className="rounded-2xl border border-[#dce2dd] bg-[#fafbf9] p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`special-text-${special.id}`} className="text-base">
                      Special {index + 1}
                    </Label>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`special-active-${special.id}`} className="text-sm">
                        Show
                      </Label>
                      <Switch
                        id={`special-active-${special.id}`}
                        checked={special.active}
                        onCheckedChange={(active) =>
                          changeSpecial(special.id, { active })
                        }
                        aria-label={`Show special ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-[#8b3838] hover:bg-red-50 hover:text-[#8b3838]"
                        onClick={() => removeSpecial(special.id)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete special {index + 1}</span>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem] sm:items-start">
                    <div>
                      <Textarea
                        id={`special-text-${special.id}`}
                        value={special.text}
                        onChange={(event) =>
                          changeSpecial(special.id, { text: event.target.value })
                        }
                        maxLength={500}
                        placeholder="For example: Homemade steak pie, chips and peas"
                        className="field-shell min-h-28 rounded-xl"
                        required
                      />
                      <p className="mt-2 text-right text-xs text-[#7c8a86]">
                        {special.text.length}/500
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`special-price-${special.id}`}>Price</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#6e625a]">
                          £
                        </span>
                        <DirectPriceInput
                          id={`special-price-${special.id}`}
                          min="0.01"
                          valuePence={special.pricePence}
                          onChange={(pricePence) =>
                            changeSpecial(special.id, {
                              pricePence,
                            })
                          }
                          className="field-shell h-12 rounded-xl pl-7"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <p className="section-kicker">Service controls</p>
              <CardTitle className="font-serif text-2xl tracking-[-0.02em]">Online ordering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#dfe5e0] bg-[#f5f8f5] p-4">
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
              <div className="rounded-2xl border border-[#dfe5e0] bg-[#fffefa] p-4">
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
                    <div key={id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ${available ? "border-[#cfe0d6] bg-[#edf4ef]" : "border-[#f0d4cc] bg-[#fff2ee]"}`}>
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
                  className="field-shell min-h-24 rounded-xl"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader>
              <p className="section-kicker">Notifications</p>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl tracking-[-0.02em]">
                <Mail className="text-[#a35f34]" /> Order email
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
                  className="field-shell h-12 rounded-xl"
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

          <Card className="admin-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Menu add-ons</p>
                  <CardTitle className="mt-1 font-serif text-2xl tracking-[-0.02em]">Extras</CardTitle>
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={addExtra}>
                  <Plus /> Add extra
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {extras.map((extra) => (
                <div
                  key={extra.id}
                  className="grid gap-3 rounded-2xl border border-[#dfe5e0] bg-[#fafbf9] p-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
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
                      className="field-shell h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`extra-price-${extra.id}`}>Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold">
                        £
                      </span>
                      <DirectPriceInput
                        id={`extra-price-${extra.id}`}
                        min="0"
                        valuePence={extra.pricePence}
                        onChange={(pricePence) =>
                          changeExtra(extra.id, {
                            pricePence,
                          })
                        }
                        className="field-shell h-11 rounded-xl pl-7"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e1e5e0] bg-white px-3 py-3 sm:justify-start">
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
            className="h-13 w-full rounded-xl bg-[#153f38] text-base font-bold shadow-lg shadow-[#153f38]/15 hover:bg-[#235c52]"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save /> Save menu and specials
              </>
            )}
          </Button>
        </form>

        <div className="lg:sticky lg:top-24">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">
                Admin inbox
              </p>
              <h3 className="mt-2 font-serif text-3xl font-bold tracking-[-0.03em]">Orders</h3>
            </div>
            <div className="flex items-center gap-2">
              {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
                <Button type="button" size="sm" variant="outline" onClick={enableNotifications} className="rounded-full">
                  <Bell /> Enable alerts
                </Button>
              )}
              <Badge className="bg-[#153f38] text-white">{unreadCount} new</Badge>
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
                className="field-shell h-10 rounded-xl pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="field-shell h-10 w-full rounded-xl">
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
            <div className="surface-card rounded-2xl border-dashed p-9 text-center">
              <ReceiptText className="mx-auto size-10 text-[#a35f34]" />
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
                  className={`order-card gap-4 overflow-hidden rounded-2xl py-5 shadow-[0_14px_38px_rgba(18,60,55,0.07)] ${order.seenAt ? "border-[#d9ded9] bg-white" : "border-[#b77746] bg-[#fffdfa] ring-2 ring-[#b77746]/10"}`}
                >
                  <CardHeader className="gap-3 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-black tracking-wider text-[#123c37]">
                          {order.reference}
                          </p>
                          {!order.seenAt && <Badge className="bg-[#a35f34] text-white">New</Badge>}
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
                          ? "Emails accepted by provider"
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
                    {order.emailStatus !== "sent" && (
                      <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950">
                        <p role="status">
                          {order.emailStatus.startsWith("failed:")
                            ? order.emailStatus.slice(8)
                            : order.emailStatus === "awaiting_setup"
                              ? "Email setup is incomplete. Add RESEND_API_KEY and a verified RESEND_FROM_EMAIL in Cloudflare."
                              : "The email provider did not confirm that both emails were accepted. Retry to see the reason."}
                        </p>
                        <Button type="button" variant="outline" disabled={busyOrderId === order.id} onClick={() => retryOrderEmails(order)}>
                          <Mail /> {busyOrderId === order.id ? "Retrying…" : "Retry order emails"}
                        </Button>
                      </div>
                    )}
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
                    {order.lines.specials.map((special) => (
                      <div
                        key={special.id}
                        className="flex justify-between gap-3 border-t border-[#eee6da] pt-3"
                      >
                        <span className="whitespace-pre-wrap">
                          {special.quantity} × {special.name}
                        </span>
                        <strong>
                          {money(special.unitPricePence * special.quantity)}
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
                        className={order.seenAt ? "rounded-full" : "rounded-full bg-[#153f38] hover:bg-[#235c52]"}
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
