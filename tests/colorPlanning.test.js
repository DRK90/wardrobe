import assert from "node:assert/strict";
import test from "node:test";
import {
  colorSimilarity,
  defaultColorPreferences,
  filterItemsByMatrixSelection,
  formalitiesForSelection,
  recommendItemColor,
  setColorPreference,
  targetColorOptions,
  targetPaletteForSelection
} from "../src/colorPlanning.js";

test("every formality starts with an independent three-out-of-five target palette", () => {
  const preferences = defaultColorPreferences();

  assert.equal(preferences[1].navy, 3);
  assert.equal(preferences[5].navy, 3);
  const changed = setColorPreference(preferences, 3, "navy", 0);
  assert.equal(changed[3].navy, 0);
  assert.equal(changed[2].navy, 3);
});

test("matrix selections union cells and retain their selected formality grain", () => {
  const items = [
    { id: "long", category: "top", sleeveLength: "long", formality: 3 },
    { id: "short", category: "top", sleeveLength: "short", formality: 3 },
    { id: "formal", category: "top", sleeveLength: "long", formality: 4 },
    { id: "shoes", category: "shoes", itemType: "loafers", formality: 3 }
  ];
  const clauses = [
    { slot: "top", field: "sleeveLength", value: "long", formality: 3 },
    { slot: "top", field: "sleeveLength", value: "short", formality: 3 }
  ];

  assert.deepEqual(filterItemsByMatrixSelection(items, clauses).map((item) => item.id), ["long", "short"]);
  assert.deepEqual(formalitiesForSelection(clauses), [3]);
});

test("target palette and recommendation honor exclusions and preference ratings", () => {
  let preferences = defaultColorPreferences();
  targetColorOptions.forEach((color) => {
    preferences = setColorPreference(preferences, 3, color.id, 0);
  });
  preferences = setColorPreference(preferences, 3, "navy", 5);
  preferences = setColorPreference(preferences, 3, "red", 1);
  const clauses = [{ slot: "top", field: "sleeveLength", value: "long", formality: 3 }];
  const selectedItems = [
    { id: "red-top", category: "top", sleeveLength: "long", formality: 3, status: "active", swatch: "#b53d3d" }
  ];
  const allItems = [
    ...selectedItems,
    { id: "gray-bottom", category: "bottom", bottomLength: "full", formality: 3, status: "active", swatch: "#7d8288" }
  ];
  const target = targetPaletteForSelection(preferences, clauses);
  const recommendation = recommendItemColor({ selectedItems, allItems, clauses, preferences });

  assert.deepEqual(target.map((color) => color.id), ["red", "navy"]);
  assert.equal(recommendation.id, "navy");
  assert.equal(recommendation.rating, 5);
  assert.ok(recommendation.actualCount < 0.02);
});

test("owned excluded colors are not miscounted as the nearest enabled target", () => {
  let preferences = defaultColorPreferences();
  targetColorOptions.forEach((color) => {
    preferences = setColorPreference(preferences, 3, color.id, color.id === "navy" ? 5 : 0);
  });
  const clauses = [{ slot: "top", field: "sleeveLength", value: "long", formality: 3 }];
  const redTop = { id: "red", category: "top", sleeveLength: "long", formality: 3, status: "active", swatch: "#b53d3d" };
  const recommendation = recommendItemColor({ selectedItems: [redTop], allItems: [redTop], clauses, preferences });

  assert.equal(recommendation.id, "navy");
  assert.ok(recommendation.actualCount < 0.02);
});

test("recommendation coverage follows swatch similarity instead of color names", () => {
  let preferences = defaultColorPreferences();
  targetColorOptions.forEach((color) => {
    preferences = setColorPreference(preferences, 3, color.id, color.id === "navy" ? 5 : 0);
  });
  const clauses = [{ slot: "top", field: "sleeveLength", value: "long", formality: 3 }];
  const nearNavy = {
    id: "misnamed",
    category: "top",
    sleeveLength: "long",
    formality: 3,
    status: "active",
    color: "Sunset orange",
    swatch: "#2a3c5a"
  };
  const recommendation = recommendItemColor({ selectedItems: [nearNavy], allItems: [nearNavy], clauses, preferences });

  assert.ok(colorSimilarity(nearNavy.swatch, "#293b59") > 0.99);
  assert.ok(recommendation.actualCount > 0.99);
  assert.equal(recommendation.similarItemCount, 1);
});
