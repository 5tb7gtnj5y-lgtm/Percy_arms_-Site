"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CommunityEvent = {
  id: number;
  title: string;
  eventDate: string;
  eventTime: string;
  description: string;
};

export function CommunityBoard({ isAdmin }: { isAdmin: boolean }) {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [postError, setPostError] = useState("");
  const [posting, setPosting] = useState(false);
  const [postOpen, setPostOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then(async (response) => {
        const result = (await response.json()) as {
          events?: CommunityEvent[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Events could not be loaded.");
        }
        if (active) setEvents(result.events ?? []);
      })
      .catch((eventError) => {
        if (active) {
          setLoadError(
            eventError instanceof Error
              ? eventError.message
              : "Events could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      eventDate: String(form.get("eventDate") ?? ""),
      eventTime: String(form.get("eventTime") ?? ""),
      description: String(form.get("description") ?? ""),
    };

    try {
      setPosting(true);
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        event?: CommunityEvent;
        error?: string;
      };
      if (!response.ok || !result.event) {
        throw new Error(result.error || "The event could not be posted.");
      }
      setEvents((current) =>
        [...current, result.event as CommunityEvent].sort((left, right) =>
          `${left.eventDate} ${left.eventTime}`.localeCompare(
            `${right.eventDate} ${right.eventTime}`,
          ),
        ),
      );
      setPostOpen(false);
    } catch (eventError) {
      setPostError(
        eventError instanceof Error
          ? eventError.message
          : "The event could not be posted.",
      );
    } finally {
      setPosting(false);
    }
  }

  async function deleteEvent(id: number) {
    const response = await fetch("/api/events", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) setEvents((current) => current.filter((event) => event.id !== id));
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="rounded-[1.75rem] bg-[#34543c] p-6 text-white shadow-[0_22px_58px_rgba(45,75,53,0.2)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="bg-[#f4c95d] text-[#123c37]">What’s on</Badge>
            <h2 className="mt-4 font-serif text-4xl font-bold">
              Percy community board
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[#dbe6d7]">
              Pub events and community notices, all in one place.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 w-fit rounded-xl bg-white px-5 text-[#34543c] hover:bg-[#f2f5ef]">
                  <Plus /> Post an event
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl">
                    Add to the community board
                  </DialogTitle>
                  <DialogDescription>
                    Post an event for customers to see.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={submitEvent}>
                  <div className="space-y-2">
                    <Label htmlFor="event-title">Event name</Label>
                    <Input
                      id="event-title"
                      name="title"
                      required
                      maxLength={100}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Date</Label>
                      <Input
                        id="event-date"
                        name="eventDate"
                        type="date"
                        required
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-time">Time</Label>
                      <Input
                        id="event-time"
                        name="eventTime"
                        type="time"
                        required
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-description">Details</Label>
                    <Textarea
                      id="event-description"
                      name="description"
                      required
                      maxLength={500}
                      className="min-h-28 rounded-xl"
                    />
                  </div>
                  {postError && (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      {postError}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="h-11 w-full bg-[#34543c] hover:bg-[#42684b]"
                    disabled={posting}
                  >
                    {posting ? (
                      <>
                        <Loader2 className="animate-spin" /> Posting…
                      </>
                    ) : (
                      <>
                        <Megaphone /> Post event
                      </>
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-10 text-[#6e625a]">
            <Loader2 className="animate-spin" /> Loading the community board…
          </div>
        )}
        {!loading && loadError && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
          >
            {loadError}
          </p>
        )}
        {!loading && !loadError && events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#cdbfae] bg-white/55 p-10 text-center">
            <Megaphone className="mx-auto size-10 text-[#df654d]" />
            <h3 className="mt-4 font-serif text-2xl font-bold">
              Nothing posted yet
            </h3>
            <p className="mt-2 text-[#6e625a]">
              {isAdmin
                ? "Use “Post an event” to add the first notice."
                : "Check back soon for Percy Arms events."}
            </p>
          </div>
        )}
        {!loading && !loadError && events.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <Card
                key={event.id}
                className="border-0 bg-white shadow-[0_12px_32px_rgba(55,37,25,0.09)]"
              >
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#df654d]">
                    <CalendarDays className="size-4" />
                    {new Intl.DateTimeFormat("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    }).format(new Date(`${event.eventDate}T12:00:00`))}
                    <span aria-hidden="true">·</span>
                    {event.eventTime}
                  </div>
                  <CardTitle className="font-serif text-2xl leading-tight">
                    {event.title}
                  </CardTitle>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" size="sm" variant="outline" className="mt-2 w-fit rounded-full border-red-200 text-red-700">
                          <Trash2 /> Delete event
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
                          <AlertDialogDescription>This removes the event from the community board permanently.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep event</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => deleteEvent(event.id)}>Delete event</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap leading-7 text-[#6e625a]">
                    {event.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
