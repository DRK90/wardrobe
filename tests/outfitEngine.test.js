import assert from "node:assert/strict";
import test from "node:test";
import { starterItems } from "../src/data.js";
import { generateOutfit } from "../src/outfitEngine.js";

const request = {
  outfitCategory: "daily",
  tempF: 72,
  rainPct: 10,
  windMph: 5,
  exposure: "mixed",
  formality: 2,
  season: "summer",
  underused: false,
  seed: 1
};

function item(data) {
  return {
    id: data.id,
    name: data.name ?? data.id,
    category: data.category,
    subcategory: data.subcategory ?? data.category,
    color: "Gray",
    swatch: "oklch(0.55 0.01 220)",
    material: "Cotton",
    fabric: "plain weave",
    pattern: "solid",
    status: "active",
    laundry: "ready",
    warmth: 2,
    breathability: 3,
    rain: 1,
    wind: 1,
    formality: 2,
    condition: 4,
    outfitTags: ["daily"],
    season: ["summer"],
    climate: ["mild", "hot"],
    wears: 0,
    ...data
  };
}

function selectedIds(outfit) {
  return Object.values(outfit.selections).flat().map((selected) => selected.id);
}

test("a standard outfit always includes a bottom when one is ready", () => {
  const items = [
    item({ id: "top-one", category: "top" }),
    item({ id: "bottom-one", category: "bottom" }),
    item({ id: "shoes-one", category: "shoes" })
  ];

  const outfit = generateOutfit(items, request);

  assert.equal(outfit.selections.bottom?.[0]?.id, "bottom-one");
});

test("locked articles remain selected while the rest of the outfit regenerates", () => {
  const first = generateOutfit(starterItems, request);
  const lockedTop = first.selections.top[0];
  const avoidItemIds = selectedIds(first).filter((id) => id !== lockedTop.id);
  const second = generateOutfit(
    starterItems,
    { ...request, seed: 2, avoidItemIds },
    { top: [lockedTop.id] }
  );

  assert.equal(second.selections.top[0].id, lockedTop.id);
  assert.notDeepEqual(selectedIds(second), selectedIds(first));
});

test("regeneration rotates away from the previous unlocked outfit", () => {
  const first = generateOutfit(starterItems, request);
  const second = generateOutfit(starterItems, {
    ...request,
    seed: 2,
    avoidItemIds: selectedIds(first)
  });

  assert.notDeepEqual(selectedIds(second), selectedIds(first));
});

test("a vivid locked color favors a neutral partner over a conflicting vivid color", () => {
  const items = [
    item({
      id: "cobalt-top",
      category: "top",
      color: "Cobalt",
      swatch: "oklch(0.55 0.18 255)"
    }),
    item({
      id: "charcoal-bottom",
      category: "bottom",
      color: "Charcoal",
      swatch: "#42464b"
    }),
    item({
      id: "vivid-green-bottom",
      category: "bottom",
      color: "Vivid green",
      swatch: "#00a86b"
    }),
    item({ id: "shoes-one", category: "shoes" })
  ];

  const outfit = generateOutfit(items, request, { top: ["cobalt-top"] });

  assert.equal(outfit.selections.bottom[0].id, "charcoal-bottom");
});

test("formal material and footwear cues beat an athletic material mismatch", () => {
  const formalRequest = {
    ...request,
    outfitCategory: "formal",
    formality: 5,
    season: "fall",
    tempF: 62
  };
  const items = [
    item({
      id: "wool-blazer",
      category: "outerwear",
      material: "Worsted wool",
      fabric: "worsted twill",
      formality: 5,
      outfitTags: ["formal"]
    }),
    item({
      id: "leather-oxford",
      category: "shoes",
      material: "Calf leather",
      subcategory: "dress oxford",
      formality: 5,
      outfitTags: ["formal"]
    }),
    item({
      id: "mesh-runner",
      category: "shoes",
      material: "Polyester mesh",
      subcategory: "performance runner",
      formality: 5,
      outfitTags: ["formal"]
    })
  ];

  const outfit = generateOutfit(items, formalRequest, { outerwear: ["wool-blazer"] });

  assert.equal(outfit.selections.shoes[0].id, "leather-oxford");
});
