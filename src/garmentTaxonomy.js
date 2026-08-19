export const outfitSlotOptions = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "outerwear", label: "Outerwear" },
  { value: "shoes", label: "Shoes" },
  { value: "accessory", label: "Accessory" }
];

export const sleeveLengthOptions = [
  { value: "sleeveless", label: "Sleeveless" },
  { value: "short", label: "Short sleeve" },
  { value: "three_quarter", label: "Three-quarter sleeve" },
  { value: "long", label: "Long sleeve" }
];

export const bottomLengthOptions = [
  { value: "short", label: "Shorts" },
  { value: "knee", label: "Knee length" },
  { value: "cropped", label: "Cropped" },
  { value: "full", label: "Full length" }
];

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

function optionLabel(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function resolvedOutfitSlot(item) {
  return item?.outfitSlot || defaultSlotByCategory[item?.category] || "";
}

export function coverageGroupFor(item) {
  if (item?.category === "top" || item?.category === "bottom") return item.category;
  if (["athletic", "underwear", "sleepwear", "swimwear"].includes(item?.category)) {
    return ["top", "bottom"].includes(item?.outfitSlot) ? item.outfitSlot : "";
  }
  return "";
}

export function itemTypeOptionsFor(item) {
  const values = [
    ...(typeOptionsByCategory[item?.category] ?? []),
    ...(typeOptionsBySlot[resolvedOutfitSlot(item)] ?? [])
  ];
  return [...new Set(values)].map((value) => ({ value, label: optionLabel(value) }));
}

export function coverageFieldFor(item) {
  const slot = resolvedOutfitSlot(item);
  if (slot === "bottom") return "bottomLength";
  if (slot === "top" || slot === "outerwear") return "sleeveLength";
  return "";
}

export function coverageFilterValue(item) {
  const field = coverageFieldFor(item);
  const value = field ? item?.[field] : "";
  return field && value ? `${field}:${value}` : "";
}

export function coverageLabel(item) {
  if (!coverageFieldFor(item)) return "n/a";
  const filterValue = coverageFilterValue(item);
  if (!filterValue) return "Not entered";
  const [field, value] = filterValue.split(":");
  const options = field === "sleeveLength" ? sleeveLengthOptions : bottomLengthOptions;
  return options.find((option) => option.value === value)?.label ?? optionLabel(value);
}

export const coverageFilterOptions = [
  { value: "all", label: "Any coverage" },
  ...sleeveLengthOptions.map((option) => ({ value: `sleeveLength:${option.value}`, label: option.label })),
  ...bottomLengthOptions.map((option) => ({ value: `bottomLength:${option.value}`, label: option.label })),
  { value: "missing", label: "Not entered" }
];
