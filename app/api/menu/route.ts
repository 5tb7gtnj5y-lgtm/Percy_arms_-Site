import { env } from "cloudflare:workers";
import { getAdminUser } from "@/lib/admin";
import { ensureSpecialsTable, loadOrderConfig } from "@/lib/order-config";

function validPrice(value: unknown) {
  const price = Number(value);
  return Number.isInteger(price) && price >= 0 && price <= 50000 ? price : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  try {
    const adminView = new URL(request.url).searchParams.get("admin") === "1";

    if (adminView) {
      const user = await getAdminUser(request);
      if (!user) {
        return Response.json({ error: "Admin access is required." }, { status: 403 });
      }

      const config = await loadOrderConfig();
      const runtimeEnv = env as unknown as {
        RESEND_API_KEY?: string;
        RESEND_FROM_EMAIL?: string;
      };

      return Response.json({
        ...config,
        emailServiceReady: Boolean(
          runtimeEnv.RESEND_API_KEY && runtimeEnv.RESEND_FROM_EMAIL,
        ),
      });
    }

    const config = await loadOrderConfig();
    return Response.json({
      adultMealPrice: config.adultMealPrice,
      childMealPrice: config.childMealPrice,
      extras: config.extras.filter((extra) => extra.active),
      specials: config.specials.filter((special) => special.active),
      configured: config.configured,
      orderingOpen: config.orderingOpen,
      chickenAvailable: config.chickenAvailable,
      beefAvailable: config.beefAvailable,
      porkAvailable: config.porkAvailable,
      serviceMessage: config.serviceMessage,
    });
  } catch (error) {
    console.error("Menu database read failed", error);
    return Response.json({ error: "The menu could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAdminUser(request);
  if (!user) {
    return Response.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const adultMealPrice = validPrice(body.adultMealPrice);
    const childMealPrice = validPrice(body.childMealPrice);
    const orderEmail = clean(body.orderEmail, 160).toLowerCase();
    const orderingOpen = body.orderingOpen !== false;
    const chickenAvailable = body.chickenAvailable !== false;
    const beefAvailable = body.beefAvailable !== false;
    const porkAvailable = body.porkAvailable !== false;
    const serviceMessage = clean(body.serviceMessage, 240);
    const rawExtras = Array.isArray(body.extras) ? body.extras.slice(0, 20) : [];
    const rawSpecials = Array.isArray(body.specials)
      ? body.specials.slice(0, 12)
      : [];

    if (
      adultMealPrice === null ||
      adultMealPrice < 1 ||
      childMealPrice === null ||
      childMealPrice < 1 ||
      !/^\S+@\S+\.\S+$/.test(orderEmail)
    ) {
      return Response.json(
        { error: "Add valid adult and child prices and an order email address." },
        { status: 400 },
      );
    }

    const extras = rawExtras.map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const name = clean(item.name, 80);
      const pricePence = validPrice(item.pricePence);
      const suppliedId = clean(item.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
      return {
        id: suppliedId || `extra-${crypto.randomUUID()}`,
        name,
        pricePence,
        active: item.active !== false,
        sortOrder: index,
      };
    });

    if (extras.some((extra) => !extra.name || extra.pricePence === null)) {
      return Response.json(
        { error: "Every extra needs a name and a valid price." },
        { status: 400 },
      );
    }

    const specials = rawSpecials.map((raw, index) => {
      const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const text = clean(item.text, 500);
      const suppliedId = clean(item.id, 80).replace(/[^a-zA-Z0-9_-]/g, "");
      return {
        id: suppliedId || `special-${crypto.randomUUID()}`,
        text,
        active: item.active !== false,
        sortOrder: index,
      };
    });

    if (specials.some((special) => !special.text)) {
      return Response.json(
        { error: "Every special needs some text, or it can be deleted." },
        { status: 400 },
      );
    }

    await ensureSpecialsTable();
    const database = env.DB;
    const statements = [
      database
        .prepare(
          `INSERT INTO order_settings
            (id, adult_meal_price, child_meal_price, order_email, ordering_open, chicken_available, beef_available, pork_available, service_message, updated_by, updated_at)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             adult_meal_price = excluded.adult_meal_price,
             child_meal_price = excluded.child_meal_price,
             order_email = excluded.order_email,
             ordering_open = excluded.ordering_open,
             chicken_available = excluded.chicken_available,
             beef_available = excluded.beef_available,
             pork_available = excluded.pork_available,
             service_message = excluded.service_message,
             updated_by = excluded.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(
          adultMealPrice,
          childMealPrice,
          orderEmail,
          orderingOpen ? 1 : 0,
          chickenAvailable ? 1 : 0,
          beefAvailable ? 1 : 0,
          porkAvailable ? 1 : 0,
          serviceMessage,
          user.email,
        ),
      database.prepare("DELETE FROM menu_extras"),
      database.prepare("DELETE FROM menu_specials"),
    ];

    for (const extra of extras) {
      statements.push(
        database
          .prepare(
            `INSERT INTO menu_extras
              (id, name, price_pence, active, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            extra.id,
            extra.name,
            extra.pricePence,
            extra.active ? 1 : 0,
            extra.sortOrder,
          ),
      );
    }

    for (const special of specials) {
      statements.push(
        database
          .prepare(
            `INSERT INTO menu_specials
              (id, text, active, sort_order)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(
            special.id,
            special.text,
            special.active ? 1 : 0,
            special.sortOrder,
          ),
      );
    }

    await database.batch(statements);
    const config = await loadOrderConfig();
    const runtimeEnv = env as unknown as {
      RESEND_API_KEY?: string;
      RESEND_FROM_EMAIL?: string;
    };

    return Response.json({
      ...config,
      emailServiceReady: Boolean(
        runtimeEnv.RESEND_API_KEY && runtimeEnv.RESEND_FROM_EMAIL,
      ),
    });
  } catch {
    return Response.json(
      { error: "The menu settings could not be saved." },
      { status: 500 },
    );
  }
}
