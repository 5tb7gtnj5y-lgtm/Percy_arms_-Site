import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { orders as ordersTable } from "@/db/schema";
import type { OrderLines, OrderStatus, ServiceType } from "@/lib/order-types";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in to view your orders." }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: ordersTable.id,
        reference: ordersTable.reference,
        service: ordersTable.service,
        mealDate: ordersTable.mealDate,
        timeSlot: ordersTable.timeSlot,
        lineItems: ordersTable.lineItems,
        totalPence: ordersTable.totalPence,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(eq(ordersTable.email, user.email.toLowerCase()))
      .orderBy(desc(ordersTable.createdAt), desc(ordersTable.id))
      .limit(20);

    return Response.json({
      orders: rows.map((row) => ({
        ...row,
        service: row.service as ServiceType,
        status: row.status as OrderStatus,
        lines: JSON.parse(row.lineItems) as OrderLines,
      })),
    });
  } catch {
    return Response.json({ error: "Your orders could not be loaded." }, { status: 500 });
  }
}
