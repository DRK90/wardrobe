import { slotOrder } from "./data.js";
import { effectiveWeatherForExposure, itemWeatherFit } from "./clothingMeta.js";

const slotMatches = {
  outerwear: ["outerwear", "suit"],
  top: ["top", "dress"],
  bottom: ["bottom"],
  shoes: ["shoes"],
  accessory: ["accessory", "socks"]
};

const selectionOrder = ["top", "bottom", "shoes", "outerwear", "accessory"];
const neutralColorWords = /black|white|gray|grey|charcoal|navy|denim|stone|taupe|cream|ivory|tan|khaki|brown|camel|beige/i;

function athleticSlot(item, slot) {
  if (item.category !== "athletic") return false;
  const subcategory = String(item.subcategory || "").toLowerCase();
  if (slot === "top") return /hoodie|shirt|tee|polo|top|base/.test(subcategory);
  if (slot === "bottom") return /short|pant|tight|legging|jogger/.test(subcategory);
  return false;
}

export function matchesOutfitSlot(item, slot) {
  return slotMatches[slot]?.includes(item.category) || athleticSlot(item, slot);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values, fallback = 0) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (!numeric.length) return fallback;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function daysSince(dateText) {
  if (!dateText) return 999;
  const date = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}

function hslFromRgb(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const chroma = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  let hue = 0;
  if (delta && max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  else if (delta && max === green) hue = ((blue - red) / delta + 2) * 60;
  else if (delta) hue = ((red - green) / delta + 4) * 60;
  return { hue, chroma, lightness };
}

function colorProfile(item) {
  const text = String(item.swatch ?? "");
  const oklch = text.match(/oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)/i);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const chroma = Number(oklch[3]) || 0;
    return {
      hue: Number(oklch[4]) || 0,
      chroma,
      lightness,
      neutral: chroma < 0.018 || neutralColorWords.test(item.color ?? "")
    };
  }

  const hex = text.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1];
    const red = parseInt(value.slice(0, 2), 16) / 255;
    const green = parseInt(value.slice(2, 4), 16) / 255;
    const blue = parseInt(value.slice(4, 6), 16) / 255;
    const color = hslFromRgb(red, green, blue);
    return {
      ...color,
      neutral: color.chroma < 0.12 || neutralColorWords.test(item.color ?? "")
    };
  }

  return {
    hue: 0,
    chroma: 0,
    lightness: 0.5,
    neutral: true
  };
}

function hueDistance(first, second) {
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance);
}

function selectionList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function selectedItems(selections) {
  return Object.values(selections ?? {}).flatMap(selectionList);
}

function selectedWithoutSlot(selections, slot) {
  return Object.entries(selections ?? {})
    .filter(([key]) => key !== slot)
    .flatMap(([, value]) => selectionList(value));
}

function primarySelected(selections, slot) {
  return selectionList(selections?.[slot])[0] ?? null;
}

function colorHarmonyScore(item, selections) {
  const selected = selectedItems(selections);
  if (!selected.length) return 0;
  const profile = colorProfile(item);
  const colorfulSelected = selected.filter((candidate) => !colorProfile(candidate).neutral).length;

  const pairScores = selected.map((candidate) => {
    const other = colorProfile(candidate);
    const hueGap = hueDistance(profile.hue, other.hue);
    const lightGap = Math.abs(profile.lightness - other.lightness);
    let score = 0;

    if (profile.neutral || other.neutral) score += 4;
    else if (hueGap <= 20) score += 6;
    else if (hueGap <= 45) score += 4;
    else if (hueGap >= 155 && hueGap <= 205) score += 3;
    else if (hueGap >= 105 && hueGap <= 135) score += 2;
    else if (hueGap >= 60 && hueGap <= 145 && profile.chroma > 0.05 && other.chroma > 0.05) score -= 5;

    if (lightGap >= 0.18) score += 2;
    if (lightGap < 0.06 && !profile.neutral && !other.neutral) score -= 1;
    return score;
  });

  const crowdingPenalty = !profile.neutral && colorfulSelected >= 2 ? -3 : 0;
  return average(pairScores, 0) + crowdingPenalty;
}

function styleCompatibilityScore(item, slot, request, selections) {
  const selected = selectedWithoutSlot(selections, slot);
  const selectedTags = new Set(selected.flatMap((candidate) => candidate.outfitTags ?? []));
  const itemTags = new Set(item.outfitTags ?? []);
  const selectedFormality = average(selected.map((candidate) => Number(candidate.formality ?? 3)), request.formality);
  const formalityGap = Math.abs((item.formality ?? 3) - selectedFormality);
  const pattern = String(item.pattern ?? "solid").toLowerCase();
  const patternedSelected = selected.filter((candidate) => !/solid|plain|none|n\/a/.test(String(candidate.pattern ?? "solid").toLowerCase())).length;
  let score = 0;

  if (selected.length) score += Math.max(-8, 6 - formalityGap * 3);
  if ([...itemTags].some((tag) => selectedTags.has(tag))) score += 5;
  else if (selected.length && selectedTags.size) score -= 2;

  if (request.outfitCategory === "formal") {
    if ((item.formality ?? 3) >= 4) score += 6;
    else score -= slot === "accessory" ? 2 : 10;
  }

  if (request.outfitCategory === "professional") {
    if ((item.formality ?? 3) >= 3) score += 4;
    if (item.category === "athletic" || (item.formality ?? 3) <= 1) score -= 9;
  }

  if (request.outfitCategory === "athletic") {
    score += item.category === "athletic" || itemTags.has("athletic") ? 9 : -7;
  }

  if (request.outfitCategory === "travel") {
    if ((item.climate ?? []).length >= 3 || (item.outfitTags ?? []).includes("travel")) score += 4;
    if ((item.condition ?? 4) <= 2) score -= 4;
  }

  if (!/solid|plain|none|n\/a/.test(pattern)) {
    score += patternedSelected ? -5 : 2;
  }

  if (slot === "shoes" && ["formal", "professional"].includes(request.outfitCategory) && (item.formality ?? 3) < 3) score -= 8;
  return score;
}

function layerCompatibilityScore(item, slot, request, selections) {
  const weather = effectiveWeatherForExposure(request);
  const exposure = weather.exposure ?? "mixed";
  const role = String(item.layerRole ?? "").toLowerCase();
  const warmth = Number(item.warmth ?? 3);
  const breathability = Number(item.breathability ?? 3);
  let score = 0;

  if (slot === "outerwear") {
    const top = primarySelected(selections, "top");
    if (role === "base") score -= 8;
    if (/shell|outer|insulation/.test(role)) score += 3;
    if (weather.tempF <= 45) score += warmth >= 4 ? 8 : -8;
    if (weather.tempF <= 32) score += warmth >= 5 ? 5 : -5;
    if (weather.tempF >= 58 && warmth >= 4 && weather.rainPct < 45 && weather.windMph < 16) score -= 8;
    if (weather.rainPct >= 50) score += (item.rain ?? 0) >= 3 ? 8 : -10;
    if (weather.windMph >= 16) score += (item.wind ?? 0) >= 3 ? 5 : -5;
    if (top && warmth + Number(top.warmth ?? 3) >= 8 && weather.tempF > 48) score -= 4;
    if (top && warmth + Number(top.warmth ?? 3) >= 7 && weather.tempF <= 42) score += 4;
  }

  if (slot === "top") {
    if (/shell|outer/.test(role)) score -= 3;
    if (weather.tempF >= 80) score += breathability >= 4 && warmth <= 2 ? 7 : -6;
    if (weather.tempF <= 45) score += warmth >= 3 ? 5 : -4;
    if (exposure === "indoor" && warmth >= 5 && weather.tempF >= 65) score -= 6;
  }

  if (slot === "bottom") {
    if (weather.tempF >= 82) score += breathability >= 4 && warmth <= 2 ? 6 : -5;
    if (weather.tempF <= 38) score += warmth >= 3 ? 4 : -4;
    if (weather.rainPct >= 60) score += (item.rain ?? 0) >= 2 ? 3 : -3;
  }

  if (slot === "shoes") {
    if (weather.rainPct >= 50) score += (item.rain ?? 0) >= 3 ? 9 : -11;
    if (weather.tempF <= 35) score += warmth >= 3 ? 5 : -4;
    if (exposure === "outdoor" && weather.windMph >= 16) score += (item.wind ?? 0) >= 2 ? 3 : -3;
  }

  if (slot === "accessory") {
    if (weather.tempF <= 38 && warmth >= 3) score += 4;
    if (weather.tempF >= 78 && warmth >= 3) score -= 3;
    if (weather.rainPct >= 50 && (item.rain ?? 0) >= 2) score += 3;
  }

  return score * weather.weatherWeight;
}

function targetWarmth(tempF) {
  if (tempF <= 35) return 5;
  if (tempF <= 50) return 4;
  if (tempF <= 68) return 3;
  if (tempF <= 78) return 2;
  return 1;
}

function targetClimate(request) {
  if (request.rainPct >= 60) return "rain";
  if (request.windMph >= 18) return "wind";
  if (request.tempF <= 32) return "cold";
  if (request.tempF <= 52) return "cool";
  if (request.tempF >= 80) return "hot";
  return "mild";
}

function scoreItem(item, slot, request, usedIds, selections) {
  if (usedIds.has(item.id)) return -Infinity;
  if (item.status !== "active") return -Infinity;
  if (item.laundry === "dirty" || item.laundry === "repair") return -Infinity;
  if (!matchesOutfitSlot(item, slot)) return -Infinity;
  if (item.category === "suit" && !["formal", "professional"].includes(request.outfitCategory)) return -Infinity;
  if (slot === "top" && selections.outerwear?.category === "suit" && item.category === "dress") return -Infinity;

  const weather = effectiveWeatherForExposure(request);
  const warmthTarget = targetWarmth(weather.tempF);
  const climate = targetClimate({ ...request, ...weather });
  const hasCategoryTag = item.outfitTags?.includes(request.outfitCategory);
  const categoryFit = hasCategoryTag ? 26 : request.outfitCategory === "athletic" ? -24 : -10;
  const warmthGap = Math.abs((item.warmth ?? 3) - warmthTarget);
  const weatherFit = Math.max(-8, 11 - warmthGap * 3) * weather.weatherWeight;
  const climateFit = (item.climate?.includes(climate) ? 10 : weather.weatherWeight > 1 ? -3 : 0) * weather.weatherWeight;
  const seasonFit = !request.season || item.season?.includes(request.season) ? 5 : -4;
  const rainFit = (weather.rainPct >= 50 ? (item.rain ?? 0) * 3 - 4 : Math.max(0, 4 - (item.rain ?? 0))) * weather.weatherWeight;
  const windFit = (weather.windMph >= 16 ? (item.wind ?? 0) * 2 - 2 : 1) * weather.weatherWeight;
  const formalityFit = Math.max(-8, 11 - Math.abs((item.formality ?? 3) - request.formality) * 2.75);
  const daysSinceLastWear = daysSince(item.lastWorn);
  const underusedFit = request.underused ? Math.max(0, 12 - Math.min(item.wears ?? 0, 12)) : 0;
  const recencyFit = request.underused
    ? Math.min(14, daysSinceLastWear / 2.2)
    : Math.min(6, daysSinceLastWear / 4);
  const recentWearPenalty = request.underused
    ? daysSinceLastWear <= 1
      ? -12
      : daysSinceLastWear <= 3
        ? -8
        : daysSinceLastWear <= 7
          ? -4
          : 0
    : 0;
  const variation = ((request.seed ?? 0) * 17 + item.id.length * 13 + slot.length * 7) % 7;
  const inferredWeatherFit = (itemWeatherFit(item, request).score - 60) / 2.7;
  const colorFit = colorHarmonyScore(item, selectedWithoutSlot(selections, slot));
  const styleFit = styleCompatibilityScore(item, slot, request, selections);
  const layerFit = layerCompatibilityScore(item, slot, request, selections);

  return (
    categoryFit +
    weatherFit +
    climateFit +
    seasonFit +
    rainFit +
    windFit +
    inferredWeatherFit +
    formalityFit +
    colorFit +
    styleFit +
    layerFit +
    underusedFit +
    recencyFit +
    recentWearPenalty +
    variation
  );
}

function candidatesForSlot(items, slot, request, usedIds, selections) {
  return items
    .map((item) => ({ item, score: scoreItem(item, slot, request, usedIds, selections) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 8);
}

function primarySelections(selections) {
  return Object.fromEntries(Object.entries(selections).map(([key, values]) => [key, values[0]]));
}

function reasonBitsFor(selected, slot, request, selections) {
  const reasonBits = [];
  const weatherFit = itemWeatherFit(selected, request);
  if (selected.outfitTags?.includes(request.outfitCategory)) reasonBits.push(request.outfitCategory.replace("_", " "));
  if (selected.season?.includes(request.season)) reasonBits.push(request.season);
  if ((request.exposure ?? "mixed") === "indoor") reasonBits.push("indoor");
  if (request.rainPct >= 50 && selected.rain >= 3) reasonBits.push("rain");
  if (request.windMph >= 16 && selected.wind >= 3) reasonBits.push("wind");
  if (selected.formality >= request.formality) reasonBits.push("formality");
  if (weatherFit.score >= 78) reasonBits.push("weather fit");
  if (colorHarmonyScore(selected, selectedWithoutSlot(primarySelections(selections), slot)) >= 4) reasonBits.push("color");
  return reasonBits.slice(0, 4);
}

export function generateOutfit(items, request, overrides = {}) {
  const usedIds = new Set();
  const selections = {};
  const alternatives = {};
  const reasons = [];

  for (const slot of slotOrder) {
    const slotOverrides = Array.isArray(overrides[slot])
      ? overrides[slot]
      : overrides[slot]
        ? [overrides[slot]]
        : [];

    if (!slotOverrides.length) continue;
    selections[slot] = [];
    slotOverrides.forEach((itemId) => {
      const override = items.find((item) => item.id === itemId && matchesOutfitSlot(item, slot));
      if (override && !usedIds.has(override.id)) {
        selections[slot].push(override);
        usedIds.add(override.id);
      }
    });
    if (!selections[slot].length) delete selections[slot];
  }

  for (const slot of selectionOrder) {
    const weather = effectiveWeatherForExposure(request);
    const skipOuterwear =
      slot === "outerwear" &&
      weather.tempF > 60 &&
      weather.rainPct < 45 &&
      weather.windMph < 16 &&
      !["formal", "professional"].includes(request.outfitCategory);
    if (skipOuterwear && !selections[slot]?.length) {
      alternatives[slot] = [];
      continue;
    }

    const candidates = candidatesForSlot(items, slot, request, usedIds, primarySelections(selections));
    alternatives[slot] = candidates;

    if (!selections[slot]?.length && candidates[0]) {
      selections[slot] = [candidates[0].item];
      usedIds.add(candidates[0].item.id);
    }
  }

  for (const slot of slotOrder) {
    if (!selections[slot]?.length) continue;
    selections[slot].forEach((selected, index) => {
      const reasonBits = reasonBitsFor(selected, slot, request, selections);
      const slotLabel = index ? `${slot} ${index + 1}` : slot;
      reasons.push(`${slotLabel}: ${selected.name}${reasonBits.length ? ` · ${reasonBits.join(", ")}` : ""}`);
    });
  }

  const missing = slotOrder.filter((slot) => {
    if (slot === "outerwear" && !selections.outerwear?.length) return false;
    if (slot === "accessory" && !selections.accessory?.length) return false;
    return !selections[slot]?.length;
  });

  return {
    selections,
    alternatives,
    missing,
    reasons,
    summary:
      Object.keys(selections).length > 0
        ? `${request.outfitCategory.replace("_", " ")} · ${request.exposure ?? "mixed"} · ${request.tempF} F · ${request.rainPct}% rain`
        : "Add ready items to build an outfit."
  };
}
