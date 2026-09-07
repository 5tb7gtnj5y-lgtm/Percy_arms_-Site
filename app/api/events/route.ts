import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { communityEvents } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getAdminUser } from "@/lib/admin";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET() {
  try {
    const db = getDb();
    const events = await db
      .select({
        id: communityEvents.id,
        title: communityEvents.title,
        eventDate: communityEvents.eventDate,
        eventTime: communityEvents.eventTime,
        description: communityEvents.description,
      })
      .from(communityEvents)
      .orderBy(asc(communityEvents.eventDate), asc(communityEvents.eventTime))
      .limit(50);

    return Response.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const unavailable = message.includes("no such table") || message.includes("binding `DB` is unavailable");
    return Response.json(
      { error: unavailable ? "The community board is being set up. Please try again shortly." : "Events could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const runtimeEnv = env as unknown as { ADMIN_EMAIL?: string };
  const adminEmail = runtimeEnv.ADMIN_EMAIL?.toLowerCase();

  if (!user || !adminEmail || user.email.toLowerCase() !== adminEmail) {
    return Response.json({ error: "Only the pub admin can post events." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = clean(body.title, 100);
    const eventDate = clean(body.eventDate, 10);
    const eventTime = clean(body.eventTime, 5);
    const description = clean(body.description, 500);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && !Number.isNaN(Date.parse(`${eventDate}T12:00:00Z`));
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(eventTime);

    if (!title || !validDate || !validTime || !description) {
      return Response.json({ error: "Complete the event name, date, time and details." }, { status: 400 });
    }

    const db = getDb();
    const [event] = await db
      .insert(communityEvents)
      .values({
        title,
        eventDate,
        eventTime,
        description,
        createdBy: user.email,
      })
      .returning({
        id: communityEvents.id,
        title: communityEvents.title,
        eventDate: communityEvents.eventDate,
        eventTime: communityEvents.eventTime,
        description: communityEvents.description,
      });

    return Response.json({ event }, { status: 201 });
  } catch {
    return Response.json({ error: "The event could not be posted. Please try again." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return Response.json({ error: "Only the pub admin can delete events." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "The event is not valid." }, { status: 400 });
    }
    const db = getDb();
    const [deleted] = await db
      .delete(communityEvents)
      .where(eq(communityEvents.id, id))
      .returning({ id: communityEvents.id });
    if (!deleted) {
      return Response.json({ error: "Event not found." }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch {
    return Response.json({ error: "The event could not be deleted." }, { status: 500 });
  }
}
