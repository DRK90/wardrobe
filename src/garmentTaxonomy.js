export const outfitSlotOptions = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" }
];

export const categoryDefinitions = [
  "top",
  "bottom",
  "outerwear",
  "dress",
  "suit",
  "shoes",
  "accessory",
  "athletic",
  "underwear",
  "socks",
  "sleepwear",
  "swimwear"
].map((value) => ({ value, label: optionLabel(value), defaultEnabled: true }));

export const categoryOptions = categoryDefinitions.map((option) => option.value);

export const sleeveLengthDefinitions = [
  { value: "sleeveless", label: "Sleeveless", coverage: 0, defaultEnabled: true },
  { value: "cap", label: "Cap sleeve", coverage: 0.15, defaultEnabled: false },
  { value: "short", label: "Short sleeve", coverage: 0.28, defaultEnabled: true },
  { value: "elbow", label: "Elbow sleeve", coverage: 0.48, defaultEnabled: false },
  { value: "three_quarter", label: "Three-quarter sleeve", coverage: 0.72, defaultEnabled: true },
  { value: "long", label: "Long sleeve", coverage: 1, defaultEnabled: true }
];

export const bottomLengthDefinitions = [
  { value: "short", label: "Shorts", coverage: 0.2, defaultEnabled: true },
  { value: "knee", label: "Knee length", coverage: 0.46, defaultEnabled: true },
  { value: "capri", label: "Capri", coverage: 0.65, defaultEnabled: false },
  { value: "cropped", label: "Cropped", coverage: 0.78, defaultEnabled: true },
  { value: "ankle", label: "Ankle length", coverage: 0.9, defaultEnabled: false },
  { value: "full", label: "Full length", coverage: 1, defaultEnabled: true }
];

export const sleeveLengthOptions = sleeveLengthDefinitions.map(({ value, label }) => ({ value, label }));
export const bottomLengthOptions = bottomLengthDefinitions.map(({ value, label }) => ({ value, label }));

const defaultSlotByCategory = {
  top: "top",
  bottom: "bottom",
  outerwear: "outerwear",
  suit: "outerwear",
  dress: "top",
  shoes: "shoes",
  accessory: "accessory",
  socks: "accessory"
};

const typeOptionsByCategory = {
  top: ["t_shirt", "button_down", "polo", "sweater", "sweatshirt", "hoodie", "tank", "blouse", "base_layer", "tunic"],
  bottom: ["jeans", "chinos", "trousers", "shorts", "joggers", "leggings", "skirt"],
  outerwear: ["jacket", "coat", "blazer", "parka", "rain_shell", "vest"],
  dress: ["dress", "jumpsuit", "romper"],
  suit: ["suit", "tuxedo", "suit_separate"],
  shoes: ["sneakers", "boots", "loafers", "oxfords", "derbies", "sandals", "heels", "flats"],
  accessory: ["belt", "tie", "scarf", "hat", "watch", "bag"],
  athletic: ["performance_top", "hoodie", "sports_bra", "running_shorts", "training_pants", "leggings"],
  underwear: ["undershirt", "briefs", "boxers", "bra", "base_layer"],
  socks: ["crew_socks", "ankle_socks", "dress_socks", "no_show_socks"],
  sleepwear: ["sleep_top", "sleep_pants", "sleep_shorts", "robe"],
  swimwear: ["swim_trunks", "board_shorts", "swimsuit", "rash_guard"]
};

const typeOptionsBySlot = {
  top: ["t_shirt", "button_down", "polo", "sweater", "sweatshirt", "hoodie", "tank", "base_layer"],
  bottom: ["jeans", "chinos", "trousers", "shorts", "joggers", "leggings", "skirt"],
  outerwear: ["jacket", "coat", "blazer", "parka", "rain_shell", "vest"],
  shoes: ["sneakers", "boots", "loafers", "oxfords", "derbies", "sandals"],
  accessory: ["belt", "tie", "scarf", "hat", "watch", "bag"]
};

const optionalTypeDefinitions = [
  { value: "henley", categories: ["top"], slots: ["top"] },
  { value: "cardigan", categories: ["top"], slots: ["top"] },
  { value: "overshirt", categories: ["outerwear"], slots: ["outerwear"] },
  { value: "chore_coat", categories: ["outerwear"], slots: ["outerwear"] },
  { value: "peacoat", categories: ["outerwear"], slots: ["outerwear"] },
  { value: "trench_coat", categories: ["outerwear"], slots: ["outerwear"] },
  { value: "boat_shoes", categories: ["shoes"], slots: ["shoes"] },
  { value: "clogs", categories: ["shoes"], slots: ["shoes"] },
  { value: "mules", categories: ["shoes"], slots: ["shoes"] }
].map((option) => ({ ...option, label: optionLabel(option.value), defaultEnabled: false }));

const defaultTypeValues = [
  ...new Set([...Object.values(typeOptionsByCategory).flat(), ...Object.values(typeOptionsBySlot).flat()])
];

export const itemTypeDefinitions = [
  ...defaultTypeValues.map((value) => {
    const categories = Object.entries(typeOptionsByCategory)
      .filter(([, values]) => values.includes(value))
      .map(([category]) => category);
    const slots = Object.entries(typeOptionsBySlot)
      .filter(([, values]) => values.includes(value))
      .map(([slot]) => slot);
    return {
      value,
      label: optionLabel(value),
      categories,
      slots: [...new Set([...slots, ...categories.map((category) => defaultSlotByCategory[category]).filter(Boolean)])],
      defaultEnabled: true
    };
  }),
  ...optionalTypeDefinitions
];

export const taxonomyGroups = {
  categories: categoryDefinitions,
  itemTypes: itemTypeDefinitions,
  sleeveLengths: sleeveLengthDefinitions,
  bottomLengths: bottomLengthDefinitions
};

export function defaultTaxonomyConfig() {
  return Object.fromEntries(
    Object.entries(taxonomyGroups).map(([group, options]) => [
      group,
      options.filter((option) => option.defaultEnabled).map((option) => option.value)
    ])
  );
}

export function normalizeTaxonomyConfig(config) {
  const defaults = defaultTaxonomyConfig();
  return Object.fromEntries(
    Object.entries(taxonomyGroups).map(([group, options]) => {
      const allowed = new Set(options.map((option) => option.value));
      const configured = Array.isArray(config?.[group]) ? config[group] : defaults[group];
      return [group, [...new Set(configured.filter((value) => allowed.has(value)))]];
    })
  );
}

export function enabledTaxonomyOptions(config, group) {
  const normalized = normalizeTaxonomyConfig(config);
  const enabled = new Set(normalized[group] ?? []);
  return (taxonomyGroups[group] ?? []).filter((option) => enabled.has(option.value));
}

export function setTaxonomyOptionEnabled(config, group, value, enabled) {
  const normalized = normalizeTaxonomyConfig(config);
  const current = new Set(normalized[group] ?? []);
  if (enabled) current.add(value);
  else current.delete(value);
  return normalizeTaxonomyConfig({ ...normalized, [group]: [...current] });
}

export function ensureTaxonomySupportsItems(config, items) {
  let next = normalizeTaxonomyConfig(config);
  const valuesByGroup = {
    categories: items.map((item) => item.category),
    itemTypes: items.map((item) => item.itemType),
    sleeveLengths: items
      .filter((item) => resolvedOutfitSlot(item) === "top")
      .map((item) => item.sleeveLength),
    bottomLengths: items
      .filter((item) => resolvedOutfitSlot(item) === "bottom")
      .map((item) => item.bottomLength)
  };

  Object.entries(valuesByGroup).forEach(([group, values]) => {
    const known = new Set((taxonomyGroups[group] ?? []).map((option) => option.value));
    const enabled = new Set(next[group]);
    values.filter((value) => value && known.has(value)).forEach((value) => enabled.add(value));
    next = { ...next, [group]: [...enabled] };
  });
  return normalizeTaxonomyConfig(next);
}

export function taxonomyUsageCount(items, group, value) {
  if (group === "categories") return items.filter((item) => item.category === value).length;
  if (group === "itemTypes") return items.filter((item) => item.itemType === value).length;
  if (group === "sleeveLengths") {
    return items.filter((item) => resolvedOutfitSlot(item) === "top" && item.sleeveLength === value).length;
  }
  if (group === "bottomLengths") {
    return items.filter((item) => resolvedOutfitSlot(item) === "bottom" && item.bottomLength === value).length;
  }
  return 0;
}

function optionLabel(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function resolvedOutfitSlot(item) {
  return item?.outfitSlot || defaultSlotByCategory[item?.category] || "";
}

export function coverageGroupFor(item) {
  if (["top", "bottom", "outerwear", "shoes"].includes(item?.category)) return item.category;
  if (item?.category === "suit") return "outerwear";
  if (["athletic", "underwear", "sleepwear", "swimwear"].includes(item?.category)) {
    const slot = resolvedOutfitSlot(item);
    return ["top", "bottom", "outerwear", "shoes"].includes(slot) ? slot : "";
  }
  return "";
}

export function categoryOptionsFor(config, currentValue = "") {
  const options = enabledTaxonomyOptions(config, "categories").map(({ value, label }) => ({ value, label }));
  if (currentValue && !options.some((option) => option.value === currentValue)) {
    options.push({ value: currentValue, label: optionLabel(currentValue) });
  }
  return options;
}

export function itemTypeOptionsFor(item, config) {
  const slot = resolvedOutfitSlot(item);
  const enabled = new Set(normalizeTaxonomyConfig(config).itemTypes);
  const options = itemTypeDefinitions.filter(
    (option) =>
      enabled.has(option.value) &&
      (option.categories.includes(item?.category) || option.slots.includes(slot))
  );
  const current = item?.itemType;
  if (current && !options.some((option) => option.value === current)) {
    return [...options, { value: current, label: optionLabel(current) }];
  }
  return options;
}

export function itemTypeOptionsForSlot(slot, config) {
  const enabled = new Set(normalizeTaxonomyConfig(config).itemTypes);
  return itemTypeDefinitions.filter((option) => enabled.has(option.value) && option.slots.includes(slot));
}

export function sleeveLengthOptionsFor(config, currentValue = "") {
  return optionsWithCurrent(enabledTaxonomyOptions(config, "sleeveLengths"), sleeveLengthDefinitions, currentValue);
}

export function bottomLengthOptionsFor(config, currentValue = "") {
  return optionsWithCurrent(enabledTaxonomyOptions(config, "bottomLengths"), bottomLengthDefinitions, currentValue);
}

function optionsWithCurrent(options, definitions, currentValue) {
  const next = options.map(({ value, label }) => ({ value, label }));
  if (currentValue && !next.some((option) => option.value === currentValue)) {
    const definition = definitions.find((option) => option.value === currentValue);
    next.push({ value: currentValue, label: definition?.label ?? optionLabel(currentValue) });
  }
  return next;
}

export function coverageFieldFor(item) {
  const slot = resolvedOutfitSlot(item);
  if (slot === "bottom") return "bottomLength";
  if (slot === "top" || slot === "outerwear") return "sleeveLength";
  return "";
}

export function effectiveCoverageValue(item) {
  const slot = resolvedOutfitSlot(item);
  if (slot === "outerwear") return "long";
  const field = coverageFieldFor(item);
  return field ? item?.[field] || "" : "";
}

export function coverageDefinitionFor(item) {
  const slot = resolvedOutfitSlot(item);
  const value = effectiveCoverageValue(item);
  const definitions = slot === "bottom" ? bottomLengthDefinitions : sleeveLengthDefinitions;
  return definitions.find((option) => option.value === value) ?? null;
}

export function coverageFilterValue(item) {
  const field = coverageFieldFor(item);
  const value = effectiveCoverageValue(item);
  return field && value ? `${field}:${value}` : "";
}

export function coverageLabel(item) {
  const field = coverageFieldFor(item);
  if (!field) return "n/a";
  const value = effectiveCoverageValue(item);
  if (!value) return "Not entered";
  const options = field === "sleeveLength" ? sleeveLengthDefinitions : bottomLengthDefinitions;
  return options.find((option) => option.value === value)?.label ?? optionLabel(value);
}

export function coverageFilterOptionsFor(config) {
  return [
    { value: "all", label: "Any coverage" },
    ...sleeveLengthOptionsFor(config).map((option) => ({ value: `sleeveLength:${option.value}`, label: option.label })),
    ...bottomLengthOptionsFor(config).map((option) => ({ value: `bottomLength:${option.value}`, label: option.label })),
    { value: "missing", label: "Not entered" }
  ];
}

export const coverageFilterOptions = coverageFilterOptionsFor(defaultTaxonomyConfig());
