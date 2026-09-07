import { env } from "cloudflare:workers";
import { desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { orders as ordersTable } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { loadOrderConfig } from "@/lib/order-config";
import type {
  AdminOrder,
  MeatChoice,
  MealType,
  OrderLines,
  OrderStatus,
  ServiceType,
} from "@/lib/order-types";

const SERVICES = new Set<ServiceType>(["dine_in", "takeaway"]);
const MEATS = new Set<MeatChoice>(["chicken", "beef", "pork"]);
const MEAL_TYPES = new Set<MealType>(["adult", "child"]);
const ORDER_STATUSES = new Set<OrderStatus>([
  "new",
  "accepted",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
const DINE_IN_TIMES = new Set(["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"]);
const TAKEAWAY_TIMES = new Set(["12:15", "12:45", "13:15", "13:45", "14:15", "14:45"]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function positiveQuantity(value: unknown, max = 20) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= max
    ? quantity
    : null;
}

function orderReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PA-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function orderEmailText(args: {
  reference: string;
  service: ServiceType;
  mealDate: string;
  timeSlot: string;
  customerName: string;
  email: string;
  phone: string;
  notes: string;
  lines: OrderLines;
  totalPence: number;
}) {
  const mealLines = args.lines.meals.map(
    (item) =>
      `${item.quantity} x ${item.name} — ${item.meat} — ${formatMoney(item.unitPricePence * item.quantity)}`,
  );
  const extraLines = args.lines.extras.map(
    (item) =>
      `${item.quantity} x ${item.name} — ${formatMoney(item.unitPricePence * item.quantity)}`,
  );

  return [
    `NEW SUNDAY LUNCH ORDER — ${args.reference}`,
    "",
    `Service: ${args.service === "dine_in" ? "Dine in" : "Takeaway collection"}`,
    `Date: ${args.mealDate}`,
    `Time: ${args.timeSlot}`,
    "",
    "MEALS",
    ...mealLines,
    ...(extraLines.length ? ["", "EXTRAS", ...extraLines] : []),
    "",
    `TOTAL: ${formatMoney(args.totalPence)}`,
    "",
    "CUSTOMER",
    `Name: ${args.customerName}`,
    `Phone: ${args.phone}`,
    `Email: ${args.email}`,
    `Notes: ${args.notes || "None"}`,
    "Allergen notice acknowledged: Yes",
  ].join("\n");
}

async function sendOrderEmail(args: {
  to: string;
  reference: string;
  customerEmail: string;
  text: string;
}) {
  const runtimeEnv = env as unknown as {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  };

  if (!runtimeEnv.RESEND_API_KEY || !runtimeEnv.RESEND_FROM_EMAIL) {
    return "awaiting_setup" as const;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${runtimeEnv.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": args.reference,
      },
      body: JSON.stringify({
        from: runtimeEnv.RESEND_FROM_EMAIL,
        to: [args.to],
        reply_to: args.customerEmail,
        subject: `Percy Arms order ${args.reference}`,
        text: args.text,
      }),
    });

    return response.ok ? ("sent" as const) : ("failed" as const);
  } catch {
    return "failed" as const;
  }
}

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt), desc(ordersTable.id))
      .limit(100);
    const orders: AdminOrder[] = rows.map((row) => ({
      ...row,
      service: row.service as ServiceType,
      lines: JSON.parse(row.lineItems) as OrderLines,
      status: row.status as OrderStatus,
    }));
    return Response.json({ orders });
  } catch {
    return Response.json({ error: "Orders could not be loaded." }, { status: 500 });
  }
}

function orderId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = orderId(body.id);
    const seen = typeof body.seen === "boolean" ? body.seen : null;
    const status = clean(body.status, 20) as OrderStatus;
    if (id === null || (seen === null && !ORDER_STATUSES.has(status))) {
      return Response.json({ error: "The order update is not valid." }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(ordersTable)
      .set({
        ...(seen === null ? {} : { seenAt: seen ? new Date().toISOString() : null }),
        ...(ORDER_STATUSES.has(status)
          ? { status, statusUpdatedAt: new Date().toISOString(), seenAt: new Date().toISOString() }
          : {}),
      })
      .where(eq(ordersTable.id, id))
      .returning({
        id: ordersTable.id,
        seenAt: ordersTable.seenAt,
        status: ordersTable.status,
        statusUpdatedAt: ordersTable.statusUpdatedAt,
      });

    if (!updated) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }
    return Response.json({ order: updated });
  } catch {
    return Response.json({ error: "The order could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.clearSeen === true) {
      const db = getDb();
      const deleted = await db
        .delete(ordersTable)
        .where(isNotNull(ordersTable.seenAt))
        .returning({ id: ordersTable.id });
      return Response.json({ deleted: true, count: deleted.length });
    }
    const id = orderId(body.id);
    if (id === null) {
      return Response.json({ error: "The order is not valid." }, { status: 400 });
    }

    const db = getDb();
    const [deleted] = await db
      .delete(ordersTable)
      .where(eq(ordersTable.id, id))
      .returning({ id: ordersTable.id });

    if (!deleted) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "The order could not be deleted." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = clean(body.service, 20) as ServiceType;
    const mealDate = clean(body.mealDate, 10);
    const timeSlot = clean(body.timeSlot, 5);
    const customerName = clean(body.customerName, 100);
    const email = clean(body.email, 160).toLowerCase();
    const phone = clean(body.phone, 30);
    const notes = clean(body.notes, 500);
    const allergenAcknowledged = body.allergenAcknowledged === true;
    const rawMeals = Array.isArray(body.meals) ? body.meals.slice(0, 20) : [];
    const rawExtras = Array.isArray(body.extras) ? body.extras.slice(0, 20) : [];
    const validTimes = service === "dine_in" ? DINE_IN_TIMES : TAKEAWAY_TIMES;
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(mealDate)
      ? new Date(`${mealDate}T12:00:00Z`)
      : null;

    if (
      !SERVICES.has(service) ||
      !validTimes.has(timeSlot) ||
      !parsedDate ||
      parsedDate.getUTCDay() !== 0 ||
      !customerName ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !phone ||
      !allergenAcknowledged ||
      rawMeals.length === 0
    ) {
      return Response.json(
        { error: "Please check the order details and try again." },
        { status: 400 },
      );
    }

    const config = await loadOrderConfig();
    if (!config.configured) {
      return Response.json(
        { error: "Online ordering is not open yet. The pub needs to finish its menu settings." },
        { status: 409 },
      );
    }
    if (!config.orderingOpen) {
      return Response.json(
        { error: config.serviceMessage || "Online ordering is currently closed. Please check back soon." },
        { status: 409 },
      );
    }

    const meals = rawMeals.map((raw) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const mealType = clean(item.mealType, 10) as MealType;
      const meat = clean(item.meat, 10) as MeatChoice;
      const quantity = positiveQuantity(item.quantity, 10);
      if (!MEAL_TYPES.has(mealType) || !MEATS.has(meat) || quantity === null) {
        return null;
      }
      return {
        id: clean(item.id, 80) || crypto.randomUUID(),
        mealType,
        meat,
        quantity,
        name: mealType === "adult" ? "Adult Sunday Roast" : "Children’s Sunday Roast",
        unitPricePence:
          mealType === "adult" ? config.adultMealPrice : config.childMealPrice,
      };
    });

    if (meals.some((meal) => meal === null)) {
      return Response.json({ error: "One of the meals is not valid." }, { status: 400 });
    }

    const unavailableMeats = new Set<MeatChoice>([
      ...(config.chickenAvailable ? [] : (["chicken"] as MeatChoice[])),
      ...(config.beefAvailable ? [] : (["beef"] as MeatChoice[])),
      ...(config.porkAvailable ? [] : (["pork"] as MeatChoice[])),
    ]);
    const soldOutMeal = meals.find(
      (meal) => meal !== null && unavailableMeats.has(meal.meat),
    );
    if (soldOutMeal) {
      return Response.json(
        { error: `${soldOutMeal.meat[0].toUpperCase()}${soldOutMeal.meat.slice(1)} has sold out. Please choose another meat.` },
        { status: 409 },
      );
    }

    const activeExtras = new Map(
      config.extras.filter((extra) => extra.active).map((extra) => [extra.id, extra]),
    );
    const extras = rawExtras.map((raw) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const id = clean(item.id, 80);
      const quantity = positiveQuantity(item.quantity, 10);
      const option = activeExtras.get(id);
      if (!option || quantity === null) return null;
      return {
        id,
        quantity,
        name: option.name,
        unitPricePence: option.pricePence,
      };
    });

    if (extras.some((extra) => extra === null)) {
      return Response.json({ error: "One of the extras is not valid." }, { status: 400 });
    }

    const lines: OrderLines = {
      meals: meals.filter((meal) => meal !== null) as OrderLines["meals"],
      extras: extras.filter((extra) => extra !== null) as OrderLines["extras"],
    };
    const totalPence =
      lines.meals.reduce(
        (total, item) => total + item.unitPricePence * item.quantity,
        0,
      ) +
      lines.extras.reduce(
        (total, item) => total + item.unitPricePence * item.quantity,
        0,
      );
    const reference = orderReference();
    const db = getDb();
    const [savedOrder] = await db
      .insert(ordersTable)
      .values({
        reference,
        service,
        mealDate,
        timeSlot,
        customerName,
        email,
        phone,
        notes,
        lineItems: JSON.stringify(lines),
        totalPence,
        orderEmail: config.orderEmail,
        emailStatus: "pending",
        allergenAcknowledged,
      })
      .returning({ id: ordersTable.id });

    const text = orderEmailText({
      reference,
      service,
      mealDate,
      timeSlot,
      customerName,
      email,
      phone,
      notes,
      lines,
      totalPence,
    });
    const emailStatus = await sendOrderEmail({
      to: config.orderEmail,
      reference,
      customerEmail: email,
      text,
    });

    await db
      .update(ordersTable)
      .set({ emailStatus })
      .where(eq(ordersTable.id, savedOrder.id));

    return Response.json(
      { order: { reference, totalPence, emailStatus } },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: "The order could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
