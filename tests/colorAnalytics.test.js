import assert from "node:assert/strict";
import test from "node:test";
import { groupColorsBySwatch } from "../src/colorAnalytics.js";

test("one swatch keeps every distinct color name in the legend data", () => {
  const groups = groupColorsBySwatch([
    { swatch: "#31506f", color: "Indigo Selvage" },
    { swatch: "#31506F", color: "Washed Navy" },
    { swatch: "#31506f", color: "indigo selvage" }
  ]);

  assert.deepEqual(groups, [
    {
      swatch: "#31506f",
      count: 3,
      colors: ["Indigo Selvage", "Washed Navy"]
    }
  ]);
});

test("missing color metadata receives stable chart fallbacks", () => {
  assert.deepEqual(groupColorsBySwatch([{ swatch: "", color: "" }]), [
    { swatch: "#858b90", count: 1, colors: ["Unspecified"] }
  ]);
});
