import assert from "node:assert/strict";
import test from "node:test";
import { starterItems } from "../src/data.js";
import { itemWeatherFit } from "../src/clothingMeta.js";
import { generateOutfit, matchesOutfitSlot } from "../src/outfitEngine.js";

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

test("formal trousers receive a tall sock recommendation coordinated to the bottom", () => {
  const formalRequest = {
    ...request,
    outfitCategory: "professional",
    formality: 4,
    tempF: 68
  };
  const items = [
    item({
      id: "navy-trouser",
      category: "bottom",
      bottomLength: "full",
      subcategory: "dress trouser",
      color: "Navy",
      swatch: "#263a58",
      formality: 4,
      outfitTags: ["professional"]
    }),
    item({
      id: "brown-derby",
      category: "shoes",
      subcategory: "derby",
      color: "Brown",
      swatch: "#624537",
      material: "Full-grain leather",
      formality: 4,
      outfitTags: ["professional"]
    })
  ];

  const outfit = generateOutfit(items, formalRequest, {
    bottom: ["navy-trouser"],
    shoes: ["brown-derby"]
  });

  assert.equal(outfit.socks.id, "virtual-socks-tall-navy");
  assert.match(outfit.socks.reason, /clean trouser line/i);
});

test("hot athletic shorts receive short socks coordinated to the shoes", () => {
  const athleticRequest = {
    ...request,
    outfitCategory: "athletic",
    formality: 1,
    tempF: 88
  };
  const items = [
    item({
      id: "black-running-short",
      category: "bottom",
      bottomLength: "short",
      subcategory: "running shorts",
      color: "Black",
      swatch: "#202326",
      formality: 1,
      outfitTags: ["athletic"]
    }),
    item({
      id: "white-running-shoe",
      category: "shoes",
      subcategory: "running shoe",
      color: "White",
      swatch: "#f4f4f1",
      material: "Mesh and rubber",
      formality: 1,
      outfitTags: ["athletic"]
    })
  ];

  const outfit = generateOutfit(items, athleticRequest, {
    bottom: ["black-running-short"],
    shoes: ["white-running-shoe"]
  });

  assert.equal(outfit.socks.id, "virtual-socks-short-white");
  assert.match(outfit.socks.reason, /short for shorts/i);
});

test("explicit outfit position classifies mixed clothing categories without parsing text", () => {
  const athleticTop = item({
    id: "athletic-layer",
    category: "athletic",
    outfitSlot: "top",
    itemType: "performance_top",
    subcategory: "",
    sleeveLength: "long"
  });

  assert.equal(matchesOutfitSlot(athleticTop, "top"), true);
  assert.equal(matchesOutfitSlot(athleticTop, "bottom"), false);
});

test("hot outdoor plans favor short sleeves over otherwise equal long sleeves", () => {
  const hotRequest = { ...request, tempF: 92, exposure: "outdoor" };
  const items = [
    item({
      id: "short-sleeve-top",
      category: "top",
      sleeveLength: "short",
      warmth: 2,
      breathability: 4
    }),
    item({
      id: "long-sleeve-top",
      category: "top",
      sleeveLength: "long",
      warmth: 2,
      breathability: 4
    }),
    item({ id: "bottom-one", category: "bottom", bottomLength: "short" }),
    item({ id: "shoes-one", category: "shoes" })
  ];

  const outfit = generateOutfit(items, hotRequest);

  assert.equal(outfit.selections.top[0].id, "short-sleeve-top");
  assert.ok(itemWeatherFit(items[1], hotRequest).score >= 70, "breathable long sleeves should remain viable");
});

test("cold outdoor plans favor full coverage", () => {
  const coldRequest = { ...request, tempF: 34, exposure: "outdoor", season: "winter" };
  const items = [
    item({ id: "short-bottom", category: "bottom", bottomLength: "short", season: ["winter"] }),
    item({ id: "full-bottom", category: "bottom", bottomLength: "full", season: ["winter"] }),
    item({ id: "top-one", category: "top", sleeveLength: "long", season: ["winter"] }),
    item({ id: "shoes-one", category: "shoes", season: ["winter"] })
  ];

  const outfit = generateOutfit(items, coldRequest);

  assert.equal(outfit.selections.bottom[0].id, "full-bottom");
  assert.match(itemWeatherFit(items[0], coldRequest).cautions.join(" "), /shorts expose legs/i);
});
