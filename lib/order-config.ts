import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { menuExtras, menuSpecials, orderSettings } from "@/db/schema";
import type { ExtraOption } from "./order-types";

const DEFAULT_EXTRAS: ExtraOption[] = [
  { id: "extra-yorkshire", name: "Extra Yorkshire pudding", pricePence: 100, active: true, sortOrder: 0 },
  { id: "extra-potatoes", name: "Extra roast potatoes", pricePence: 150, active: true, sortOrder: 1 },
  { id: "extra-gravy", name: "Extra gravy", pricePence: 75, active: true, sortOrder: 2 },
  { id: "cauliflower-cheese", name: "Cauliflower cheese", pricePence: 250, active: true, sortOrder: 3 },
];

let specialsTableReady: Promise<unknown> | null = null;

type StoredSpecial = {
  v: 1;
  text: string;
  pricePence: number;
};

function decodeSpecial(value: string) {
  try {
    const stored = JSON.parse(value) as Partial<StoredSpecial>;
    if (
      stored.v === 1 &&
      typeof stored.text === "string" &&
      Number.isInteger(stored.pricePence) &&
      Number(stored.pricePence) >= 0
    ) {
      return {
        text: stored.text,
        pricePence: Number(stored.pricePence),
      };
    }
  } catch {
    // Specials saved before prices were added are kept as plain text.
  }

  return { text: value, pricePence: 0 };
}

export function encodeSpecial(text: string, pricePence: number) {
  return JSON.stringify({ v: 1, text, pricePence } satisfies StoredSpecial);
}

export function ensureSpecialsTable() {
  if (!specialsTableReady) {
    specialsTableReady = env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS menu_specials (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL
      )`,
    )
      .run()
      .catch((error) => {
        specialsTableReady = null;
        throw error;
      });
  }

  return specialsTableReady;
}

export async function loadOrderConfig() {
  await ensureSpecialsTable();
  const db = getDb();
  const [settings] = await db
    .select()
    .from(orderSettings)
    .where(eq(orderSettings.id, 1))
    .limit(1);
  const savedExtras = await db
    .select()
    .from(menuExtras)
    .orderBy(asc(menuExtras.sortOrder), asc(menuExtras.name));
  const savedSpecials = await db
    .select()
    .from(menuSpecials)
    .orderBy(asc(menuSpecials.sortOrder));

  return {
    adultMealPrice: settings?.adultMealPrice ?? 1295,
    childMealPrice: settings?.childMealPrice ?? 795,
    orderEmail: settings?.orderEmail ?? "",
    orderingOpen: settings?.orderingOpen ?? true,
    chickenAvailable: settings?.chickenAvailable ?? true,
    beefAvailable: settings?.beefAvailable ?? true,
    porkAvailable: settings?.porkAvailable ?? true,
    serviceMessage: settings?.serviceMessage ?? "",
    extras: savedExtras.length > 0 ? savedExtras : DEFAULT_EXTRAS,
    specials: savedSpecials.map((special) => ({
      ...special,
      ...decodeSpecial(special.text),
    })),
    configured: Boolean(
      settings &&
        settings.adultMealPrice > 0 &&
        settings.childMealPrice > 0 &&
        settings.orderEmail,
    ),
  };
}
