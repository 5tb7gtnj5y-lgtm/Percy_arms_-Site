import { getDb } from "../../../db";
import { bookings } from "../../../db/schema";

const SERVICES = new Set(["dine_in", "takeaway"]);
const MEATS = new Set(["chicken", "beef", "pork"]);
const DINE_IN_TIMES = new Set(["12:00", "12:30", "13:00", "13:30", "14:00", "14:30"]);
const TAKEAWAY_TIMES = new Set(["12:15", "12:45", "13:15", "13:45", "14:15", "14:45"]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function bookingReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PA-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = clean(body.service, 20);
    const mealDate = clean(body.mealDate, 10);
    const timeSlot = clean(body.timeSlot, 5);
    const meat = clean(body.meat, 20);
    const customerName = clean(body.customerName, 100);
    const email = clean(body.email, 160).toLowerCase();
    const phone = clean(body.phone, 30);
    const notes = clean(body.notes, 500);
    const quantity = Number(body.quantity);

    const validTimes = service === "dine_in" ? DINE_IN_TIMES : TAKEAWAY_TIMES;
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(mealDate) ? new Date(`${mealDate}T12:00:00Z`) : null;

    if (
      !SERVICES.has(service) ||
      !MEATS.has(meat) ||
      !validTimes.has(timeSlot) ||
      !parsedDate ||
      parsedDate.getUTCDay() !== 0 ||
      !customerName ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !phone ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return Response.json({ error: "Please check the booking details and try again." }, { status: 400 });
    }

    const reference = bookingReference();
    const db = getDb();
    const [booking] = await db
      .insert(bookings)
      .values({ reference, service, mealDate, timeSlot, meat, quantity, customerName, email, phone, notes })
      .returning({
        reference: bookings.reference,
        service: bookings.service,
        mealDate: bookings.mealDate,
        timeSlot: bookings.timeSlot,
        meat: bookings.meat,
        quantity: bookings.quantity,
        customerName: bookings.customerName,
      });

    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const unavailable = message.includes("no such table") || message.includes("binding `DB` is unavailable");
    return Response.json(
      { error: unavailable ? "Bookings are being set up. Please try again shortly." : "The booking could not be saved. Please try again." },
      { status: 500 },
    );
  }
}
