import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageDefinitionFor,
  defaultTaxonomyConfig,
  enabledTaxonomyOptions,
  ensureTaxonomySupportsItems,
  itemTypeOptionsFor,
  normalizeTaxonomyConfig,
  setTaxonomyOptionEnabled,
  taxonomyUsageCount
} from "../src/garmentTaxonomy.js";

test("extended taxonomy options are available but disabled by default", () => {
  const defaults = defaultTaxonomyConfig();

  assert.equal(defaults.bottomLengths.includes("cropped"), true);
  assert.equal(defaults.bottomLengths.includes("capri"), false);
  assert.equal(defaults.sleeveLengths.includes("elbow"), false);
  assert.equal(defaults.itemTypes.includes("trench_coat"), false);
});

test("saved item values are forced active until those items are reclassified", () => {
  const configured = setTaxonomyOptionEnabled(defaultTaxonomyConfig(), "bottomLengths", "capri", false);
  const items = [
    { id: "capri-1", category: "bottom", itemType: "trousers", bottomLength: "capri" },
    { id: "henley-1", category: "top", itemType: "henley", sleeveLength: "long" }
  ];
  const guarded = ensureTaxonomySupportsItems(configured, items);

  assert.equal(guarded.bottomLengths.includes("capri"), true);
  assert.equal(guarded.itemTypes.includes("henley"), true);
  assert.equal(taxonomyUsageCount(items, "bottomLengths", "capri"), 1);
  assert.equal(taxonomyUsageCount(items, "itemTypes", "henley"), 1);
});

test("item type choices stay canonical and respect enabled configuration", () => {
  const config = normalizeTaxonomyConfig({
    ...defaultTaxonomyConfig(),
    itemTypes: ["t_shirt", "button_down"]
  });
  const values = itemTypeOptionsFor({ category: "top", outfitSlot: "top" }, config).map((option) => option.value);

  assert.deepEqual(values, ["t_shirt", "button_down"]);
  assert.equal(enabledTaxonomyOptions(config, "itemTypes").some((option) => option.value === "henley"), false);
});

test("outerwear receives full sleeve coverage without a configurable sleeve value", () => {
  const definition = coverageDefinitionFor({ category: "outerwear", itemType: "coat", sleeveLength: "" });

  assert.equal(definition.value, "long");
  assert.equal(definition.coverage, 1);
});
