import { coverageGroupFor } from "./garmentTaxonomy.js";

export const formalityLevels = [1, 2, 3, 4, 5];

export const targetColorOptions = [
  { id: "black", name: "Black", swatch: "#1b1b1b" },
  { id: "charcoal", name: "Charcoal", swatch: "#414348" },
  { id: "gray", name: "Gray", swatch: "#7d8288" },
  { id: "silver", name: "Silver", swatch: "#b8bdc2" },
  { id: "white", name: "White", swatch: "#f3f2ee" },
  { id: "cream", name: "Cream", swatch: "#eee3c5" },
  { id: "camel", name: "Camel", swatch: "#b58b5a" },
  { id: "brown", name: "Brown", swatch: "#6c4936" },
  { id: "burgundy", name: "Burgundy", swatch: "#702d40" },
  { id: "red", name: "Red", swatch: "#b53d3d" },
  { id: "rust", name: "Rust", swatch: "#a65531" },
  { id: "orange", name: "Orange", swatch: "#d07a34" },
  { id: "mustard", name: "Mustard", swatch: "#c39a32" },
  { id: "yellow", name: "Yellow", swatch: "#d8ca51" },
  { id: "olive", name: "Olive", swatch: "#717642" },
  { id: "forest", name: "Forest green", swatch: "#326448" },
  { id: "green", name: "Green", swatch: "#43885c" },
  { id: "mint", name: "Mint", swatch: "#8bc4a4" },
  { id: "teal", name: "Teal", swatch: "#2d7e78" },
  { id: "cyan", name: "Cyan", swatch: "#56a6ae" },
  { id: "light_blue", name: "Light blue", swatch: "#8eb8d2" },
  { id: "blue", name: "Blue", swatch: "#3e72a8" },
  { id: "navy", name: "Navy", swatch: "#293b59" },
  { id: "indigo", name: "Indigo", swatch: "#49548a" },
  { id: "purple", name: "Purple", swatch: "#76568d" },
  { id: "lavender", name: "Lavender", swatch: "#aa91bb" },
  { id: "magenta", name: "Magenta", swatch: "#a84b78" },
  { id: "pink", name: "Pink", swatch: "#cf819c" },
  { id: "blush", name: "Blush", swatch: "#d6a6a3" }
];

export function defaultColorPreferences() {
  return Object.fromEntries(
    formalityLevels.map((formality) => [
      formality,
      Object.fromEntries(targetColorOptions.map((color) => [color.id, 3]))
    ])
  );
}

export function normalizeColorPreferences(preferences) {
  const defaults = defaultColorPreferences();
  return Object.fromEntries(
    formalityLevels.map((formality) => [
      formality,
      Object.fromEntries(
        targetColorOptions.map((color) => {
          const value = Number(preferences?.[formality]?.[color.id]);
          return [color.id, Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value))) : defaults[formality][color.id]];
        })
      )
    ])
  );
}

export function setColorPreference(preferences, formality, colorId, rating) {
  const normalized = normalizeColorPreferences(preferences);
  return {
    ...normalized,
    [formality]: {
      ...normalized[formality],
      [colorId]: Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
    }
  };
}

export function matrixClauseKey(clause) {
  return [clause.slot, clause.field, clause.value, clause.formality || 0].join(":");
}

export function itemMatchesMatrixClause(item, clause) {
  if (coverageGroupFor(item) !== clause.slot) return false;
  if (clause.formality && Number(item.formality) !== Number(clause.formality)) return false;
  if (clause.value === "all") return true;
  if (clause.value === "missing") return !item[clause.field];
  return item[clause.field] === clause.value;
}

export function filterItemsByMatrixSelection(items, clauses) {
  if (!clauses?.length) return items;
  return items.filter((item) => clauses.some((clause) => itemMatchesMatrixClause(item, clause)));
}

export function formalitiesForSelection(clauses) {
  if (!clauses?.length || clauses.some((clause) => !clause.formality)) return formalityLevels;
  return [...new Set(clauses.map((clause) => Number(clause.formality)))].sort((a, b) => a - b);
}

export function targetPaletteForSelection(preferences, clauses) {
  const normalized = normalizeColorPreferences(preferences);
  const formalities = formalitiesForSelection(clauses);
  return targetColorOptions
    .map((color) => ({
      ...color,
      rating: formalities.reduce((sum, formality) => sum + normalized[formality][color.id], 0) / formalities.length
    }))
    .filter((color) => color.rating > 0);
}

export function recommendItemColor({ selectedItems, allItems, clauses, preferences }) {
  const targets = targetPaletteForSelection(preferences, clauses);
  if (!targets.length) return null;

  const formalities = formalitiesForSelection(clauses);
  const selectedSlots = new Set((clauses ?? []).map((clause) => clause.slot));
  const relevantItems = allItems.filter(
    (item) =>
      item.status === "active" &&
      formalities.includes(Number(item.formality)) &&
      (!selectedSlots.size || !selectedSlots.has(coverageGroupFor(item)))
  );
  const profiles = new Map(targets.map((target) => [target.id, colorProfile(target.swatch)]));
  const actualCounts = Object.fromEntries(targets.map((target) => [target.id, 0]));
  const similarItemCounts = Object.fromEntries(targets.map((target) => [target.id, 0]));

  selectedItems.forEach((item) => {
    const itemProfile = colorProfile(item.swatch);
    targets.forEach((target) => {
      const similarity = profileSimilarity(itemProfile, profiles.get(target.id));
      actualCounts[target.id] += similarity;
      if (similarity >= 0.55) similarItemCounts[target.id] += 1;
    });
  });

  const scored = targets.map((target) => {
    const profile = profiles.get(target.id);
    const desiredCoverage = 0.75 + target.rating * 0.25;
    const coverageRatio = actualCounts[target.id] / desiredCoverage;
    const coverageGap = Math.max(0, 1 - coverageRatio);
    const compatibilityScores = relevantItems.map((item) => colorCompatibility(profile, colorProfile(item.swatch)));
    const versatility = compatibilityScores.length
      ? compatibilityScores.reduce((sum, score) => sum + score, 0) / compatibilityScores.length
      : 0.5;
    const compatibleCount = compatibilityScores.filter((score) => score >= 0.64).length;
    const score =
      target.rating * 12 +
      coverageGap * 60 +
      versatility * 10 -
      Math.min(actualCounts[target.id], 4) * 8;
    return {
      ...target,
      score,
      actualCount: actualCounts[target.id],
      coverageRatio,
      similarItemCount: similarItemCounts[target.id],
      compatibleCount,
      formalityLevels: formalities
    };
  });

  return scored.sort(
    (first, second) =>
      second.score - first.score ||
      second.rating - first.rating ||
      first.actualCount - second.actualCount ||
      targetColorOptions.findIndex((color) => color.id === first.id) - targetColorOptions.findIndex((color) => color.id === second.id)
  )[0];
}

export function nearestTargetColor(swatch, targets = targetColorOptions) {
  if (!targets.length) return null;
  const profile = colorProfile(swatch);
  return [...targets].sort(
    (first, second) => colorDistance(profile, colorProfile(first.swatch)) - colorDistance(profile, colorProfile(second.swatch))
  )[0];
}

export function colorSimilarity(firstSwatch, secondSwatch) {
  return profileSimilarity(colorProfile(firstSwatch), colorProfile(secondSwatch));
}

export function colorProfile(swatch) {
  const text = String(swatch ?? "").trim();
  const oklch = text.match(/oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)/i);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const chroma = Number(oklch[3]) || 0;
    const hue = normalizeHue(Number(oklch[4]) || 0);
    const radians = (hue * Math.PI) / 180;
    return { lightness, chroma, hue, a: chroma * Math.cos(radians), b: chroma * Math.sin(radians), neutral: chroma < 0.035 };
  }

  const hex = text.match(/^#?([0-9a-f]{6})$/i);
  if (!hex) return colorProfile("#858b90");
  const red = linearRgb(parseInt(hex[1].slice(0, 2), 16) / 255);
  const green = linearRgb(parseInt(hex[1].slice(2, 4), 16) / 255);
  const blue = linearRgb(parseInt(hex[1].slice(4, 6), 16) / 255);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.sqrt(a * a + b * b);
  const hue = normalizeHue((Math.atan2(b, a) * 180) / Math.PI);
  return { lightness, chroma, hue, a, b, neutral: chroma < 0.035 };
}

function linearRgb(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function colorDistance(first, second) {
  return Math.sqrt(
    (first.lightness - second.lightness) ** 2 +
      (first.a - second.a) ** 2 +
      (first.b - second.b) ** 2
  );
}

function profileSimilarity(first, second) {
  const distance = colorDistance(first, second);
  if (distance >= 0.24) return 0;
  const bandwidth = 0.11;
  return Math.exp(-0.5 * (distance / bandwidth) ** 2);
}

function hueDistance(first, second) {
  const gap = Math.abs(first - second) % 360;
  return Math.min(gap, 360 - gap);
}

function colorCompatibility(first, second) {
  const hueGap = hueDistance(first.hue, second.hue);
  const lightGap = Math.abs(first.lightness - second.lightness);
  let score = 0.5;
  if (first.neutral && second.neutral) score = 0.72;
  else if (first.neutral || second.neutral) score = 0.9;
  else if (hueGap <= 22) score = 0.86;
  else if (hueGap <= 55) score = 0.74;
  else if (hueGap >= 145) score = 0.68;
  else if (hueGap >= 65 && first.chroma > 0.09 && second.chroma > 0.09) score = 0.28;
  if (lightGap >= 0.16) score += 0.08;
  return Math.max(0, Math.min(1, score));
}
