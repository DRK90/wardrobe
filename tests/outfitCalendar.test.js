import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWearToItems,
  availableSelectionIds,
  calendarOutfitColorGroups,
  localDateIso,
  monthDates,
  markPlannerPlanWorn,
  plannerPlanIsPending,
  resolveSavedSelections,
  serializePlannerPlan,
  serializeTodayPlans,
  upsertOutfitDay,
  wearTimestampForDate,
  wearOutfitsForDate
} from "../src/outfitCalendar.js";

const top = { id: "top-1", name: "Navy shirt", color: "Navy", material: "Cotton", swatch: "#263a58" };
const shoes = { id: "shoes-1", name: "Brown derbies", color: "Brown", material: "Leather", swatch: "#624537" };

test("calendar color groups preserve outfits and exclude shoes and socks", () => {
  const groups = calendarOutfitColorGroups([
    [
      ["top", top, 0],
      ["bottom", { id: "bottom-1", swatch: "#a69b86" }, 0],
      ["shoes", shoes, 0],
      ["socks", { id: "socks-1", swatch: "#ffffff" }, 0]
    ],
    [
      { slot: "outerwear", item: { id: "outerwear-1", swatch: "#47624c" } },
      { slot: "top", item: { id: "top-2", swatch: "#e5ddd0" } },
      { slot: "accessory", item: { id: "accessory-1", swatch: "#8a3552" } }
    ]
  ]);

  assert.deepEqual(groups, [
    ["#263a58", "#a69b86"],
    ["#47624c", "#e5ddd0", "#8a3552"]
  ]);
});

test("calendar color groups omit empty shoe-only outfits and retain one segment per article", () => {
  const groups = calendarOutfitColorGroups([
    [{ slot: "shoes", item: shoes }],
    [
      { slot: "top", item: top },
      { slot: "top", item: { ...top, id: "top-2" } },
      { slot: "bottom", item: { id: "bottom-1" } }
    ]
  ]);

  assert.deepEqual(groups, [["#263a58", "#263a58", "#858b90"]]);
});

test("today plan serialization stores selected IDs without duplicating inventory objects", () => {
  const plans = serializeTodayPlans([
    {
      id: "today-1",
      label: "Outfit 1",
      request: { eventDate: "2026-08-18", outfitCategory: "daily" },
      locks: { top: [top.id] },
      outfit: { selections: { top: [top], shoes: [shoes] } },
      lastWornDate: "2026-08-18"
    }
  ]);

  assert.deepEqual(plans[0].selectedItemIds, { top: ["top-1"], shoes: ["shoes-1"] });
  assert.equal(JSON.stringify(plans).includes("Navy shirt"), false);
  assert.equal(plans[0].lastWornDate, "2026-08-18");
});

test("saved selections resolve against current inventory and ignore removed items", () => {
  const saved = { selectedItemIds: { top: [top.id], shoes: [shoes.id, "removed-shoes"] } };

  assert.deepEqual(availableSelectionIds(saved, [top, shoes]), { top: [top.id], shoes: [shoes.id] });
  assert.deepEqual(resolveSavedSelections(saved, [top, shoes]), { top: [top], shoes: [shoes] });
});

test("outfit day upserts preserve the other record type for the same date", () => {
  const plannerPlan = serializePlannerPlan(
    { eventDate: "2026-08-20" },
    {},
    { selections: { top: [top], shoes: [shoes] } },
    "2026-08-18T12:00:00.000Z"
  );
  const withPlan = upsertOutfitDay([], "2026-08-20", { plannerPlan });
  const withBoth = upsertOutfitDay(withPlan, "2026-08-20", { todayPlans: [{ id: "today-1" }] });

  assert.equal(withBoth.length, 1);
  assert.deepEqual(withBoth[0].plannerPlan, plannerPlan);
  assert.deepEqual(withBoth[0].todayPlans, [{ id: "today-1" }]);
});

test("a logged planner outfit remains stored but no longer counts as pending", () => {
  const date = "2026-08-20";
  const plannerPlan = serializePlannerPlan(
    { eventDate: date },
    {},
    { selections: { top: [top] } },
    "2026-08-18T12:00:00.000Z"
  );
  const days = upsertOutfitDay([], date, { plannerPlan });
  const wornAt = wearTimestampForDate(date, "09:30");
  const fulfilled = markPlannerPlanWorn(days, date, { outfitId: "worn-outfit-1", wornAt });

  assert.equal(plannerPlanIsPending(days[0]), true);
  assert.equal(plannerPlanIsPending(fulfilled[0]), false);
  assert.equal(fulfilled[0].plannerPlan.wornOutfitId, "worn-outfit-1");
  assert.equal(fulfilled[0].plannerPlan.selectedItemIds.top[0], top.id);
});

test("backfilled wear increments counts without moving last worn backward", () => {
  const items = [
    { ...top, wears: 4, lastWorn: "2026-08-22", laundry: "ready" },
    { ...shoes, wears: 1, lastWorn: "", laundry: "ready" }
  ];
  const updated = applyWearToItems(items, [top.id, shoes.id], "2026-08-18", { markDirty: true });

  assert.equal(updated[0].wears, 5);
  assert.equal(updated[0].lastWorn, "2026-08-22");
  assert.equal(updated[0].laundry, "dirty");
  assert.equal(updated[1].wears, 2);
  assert.equal(updated[1].lastWorn, "2026-08-18");
});

test("historical wear timestamps preserve the selected local date and time", () => {
  const timestamp = wearTimestampForDate("2026-08-18", "07:45");
  const local = new Date(timestamp);

  assert.equal(localDateIso(local), "2026-08-18");
  assert.equal(local.getHours(), 7);
  assert.equal(local.getMinutes(), 45);
});

test("calendar month produces six complete Sunday-first weeks", () => {
  const dates = monthDates(new Date(2026, 7, 1, 12));

  assert.equal(dates.length, 42);
  assert.equal(dates[0].date, "2026-07-26");
  assert.equal(dates.at(-1).date, "2026-09-05");
  assert.equal(localDateIso(new Date(2026, 7, 18, 12)), "2026-08-18");
});

test("wear history groups one outfit and retains item snapshots after removal", () => {
  const logs = [
    {
      id: "wear-2",
      itemId: shoes.id,
      slot: "shoes",
      wornDate: "2026-08-18",
      wornAt: "2026-08-18T13:00:00.000Z",
      outfitId: "outfit-1",
      outfitLabel: "Work outfit"
    },
    {
      id: "wear-1",
      itemId: "removed-top",
      slot: "top",
      wornDate: "2026-08-18",
      wornAt: "2026-08-18T13:00:00.000Z",
      outfitId: "outfit-1",
      outfitLabel: "Work outfit",
      itemSnapshot: { name: "Marine Layer tee", color: "Blue", material: "Cotton", swatch: "#263a58" }
    }
  ];

  const groups = wearOutfitsForDate(logs, "2026-08-18", [shoes]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].entries[0].item.name, "Marine Layer tee");
  assert.equal(groups[0].entries[1].item.name, "Brown derbies");
});
