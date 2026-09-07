import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { menuExtras, orderSettings } from "@/db/schema";
import type { ExtraOption } from "./order-types";

const DEFAULT_EXTRAS: ExtraOption[] = [
  { id: "extra-yorkshire", name: "Extra Yorkshire pudding", pricePence: 100, active: true, sortOrder: 0 },
  { id: "extra-potatoes", name: "Extra roast potatoes", pricePence: 150, active: true, sortOrder: 1 },
  { id: "extra-gravy", name: "Extra gravy", pricePence: 75, active: true, sortOrder: 2 },
  { id: "cauliflower-cheese", name: "Cauliflower cheese", pricePence: 250, active: true, sortOrder: 3 },
];

export async function loadOrderConfig() {
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
    configured: Boolean(
      settings &&
        settings.adultMealPrice > 0 &&
        settings.childMealPrice > 0 &&
        settings.orderEmail,
    ),
  };
}
