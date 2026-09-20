import assert from "node:assert/strict";
import test from "node:test";
import { DINE_IN_TIMES, TAKEAWAY_TIMES, isValidOrderTime } from "../lib/order-times.ts";

test("dine in and takeaway accept the requested Sunday service window", () => {
  for (const [service, slots] of [
    ["dine_in", DINE_IN_TIMES],
    ["takeaway", TAKEAWAY_TIMES],
  ]) {
    assert.equal(slots[0], "11:30");
    assert.equal(slots.at(-1), "17:00");
    assert.equal(new Set(slots).size, slots.length);
    assert.ok(slots.every((slot, index) => !index || slot > slots[index - 1]));
    for (const slot of slots) assert.equal(isValidOrderTime(service, slot), true);
    for (const outside of ["11:00", "17:15", "18:00"]) {
      assert.equal(isValidOrderTime(service, outside), false);
    }
  }
  assert.equal(isValidOrderTime("takeaway", "12:15"), true);
  assert.equal(isValidOrderTime("dine_in", "12:15"), false);
});
