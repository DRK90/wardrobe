import assert from "node:assert/strict";
import test from "node:test";
import {
  availableSelectionIds,
  localDateIso,
  monthDates,
  resolveSavedSelections,
  serializePlannerPlan,
  serializeTodayPlans,
  upsertOutfitDay,
  wearOutfitsForDate
} from "../src/outfitCalendar.js";

const top = { id: "top-1", name: "Navy shirt", color: "Navy", material: "Cotton", swatch: "#263a58" };
const shoes = { id: "shoes-1", name: "Brown derbies", color: "Brown", material: "Leather", swatch: "#624537" };

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
