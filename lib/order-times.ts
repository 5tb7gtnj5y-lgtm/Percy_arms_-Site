// Keep the customer picker and both order endpoints on the same timetable.
export const DINE_IN_TIMES = [
  "11:30", "12:00", "12:30", "13:00", "13:30", "14:00",
  "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
] as const;

export const TAKEAWAY_TIMES = [
  "11:30", "11:45", "12:15", "12:45", "13:15", "13:45",
  "14:15", "14:45", "15:15", "15:45", "16:15", "16:45", "17:00",
] as const;

export function isValidOrderTime(service: string, time: string) {
  const available = service === "dine_in" ? DINE_IN_TIMES : TAKEAWAY_TIMES;
  return available.some((slot) => slot === time);
}
