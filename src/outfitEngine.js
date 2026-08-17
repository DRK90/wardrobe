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
const plainPattern = /solid|plain|none|n\/a/;
const beamWidth = 18;

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

function humanize(value) {
  const text = String(value ?? "").replaceAll("_", " ");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
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

function linearSrgb(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function oklchFromRgb(red, green, blue) {
  const r = linearSrgb(red);
  const g = linearSrgb(green);
  const b = linearSrgb(blue);
  const lRoot = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mRoot = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sRoot = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.sqrt(a ** 2 + bAxis ** 2);
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  return { hue: hue < 0 ? hue + 360 : hue, chroma, lightness };
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
    const color = oklchFromRgb(red, green, blue);
    return {
      ...color,
      neutral: color.chroma < 0.035 || neutralColorWords.test(item.color ?? "")
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
  const colorfulSelected = selected.map(colorProfile).filter((candidate) => !candidate.neutral);

  const pairScores = selected.map((candidate) => {
    const other = colorProfile(candidate);
    const hueGap = hueDistance(profile.hue, other.hue);
    const lightGap = Math.abs(profile.lightness - other.lightness);
    let score = 0;

    if (profile.neutral && other.neutral) score += 3;
    else if (profile.neutral || other.neutral) score += 6;
    else if (hueGap <= 18) score += 7;
    else if (hueGap <= 52) score += 5;
    else if (hueGap >= 160) score += Math.max(profile.chroma, other.chroma) > 0.16 ? 2 : 4;
    else if (hueGap >= 125) score += 2;
    else if (hueGap >= 62 && profile.chroma > 0.07 && other.chroma > 0.07) score -= 6;

    if (lightGap >= 0.18) score += 2;
    if (lightGap < 0.06 && !profile.neutral && !other.neutral) score -= 2;
    if (profile.lightness < 0.36 && other.lightness < 0.36 && lightGap < 0.08) score -= 1;
    return score;
  });

  const hueFamilies = new Set(colorfulSelected.map((candidate) => Math.round(candidate.hue / 45) % 8));
  const addsNewHueFamily = !profile.neutral && !hueFamilies.has(Math.round(profile.hue / 45) % 8);
  const crowdingPenalty = addsNewHueFamily && hueFamilies.size >= 2 ? -5 : 0;
  return average(pairScores, 0) + crowdingPenalty;
}

function materialProfile(item) {
  const text = `${item.material ?? ""} ${item.fabric ?? ""} ${item.subcategory ?? ""}`.toLowerCase();
  return {
    formal: /worsted|cashmere|silk|satin|oxford|poplin|dress|calf|full-grain|suede|leather/.test(text),
    rugged: /denim|canvas|flannel|corduroy|waxed|workwear/.test(text),
    technical: /nylon|polyester|shell|waterproof|membrane|mesh|performance|elastane/.test(text),
    warm: /wool|cashmere|down|fleece|flannel|corduroy/.test(text),
    light: /linen|silk|chambray|mesh|seersucker|rayon|viscose/.test(text)
  };
}

function materialCompatibilityScore(item, slot, request, selections) {
  const weather = effectiveWeatherForExposure(request);
  const profile = materialProfile(item);
  const selected = selectedWithoutSlot(selections, slot);
  const selectedProfiles = selected.map(materialProfile);
  let score = 0;

  if (request.outfitCategory === "formal") {
    if (profile.formal) score += 5;
    if (profile.rugged) score -= 5;
    if (profile.technical && !(slot === "outerwear" && weather.rainPct >= 50)) score -= 5;
  } else if (request.outfitCategory === "professional") {
    if (profile.formal) score += 3;
    if (profile.rugged) score -= 2;
    if (profile.technical && slot !== "outerwear") score -= 3;
  } else if (request.outfitCategory === "athletic") {
    score += profile.technical ? 6 : -3;
  }

  if (slot === "shoes") {
    if (["formal", "professional"].includes(request.outfitCategory)) score += profile.formal ? 6 : -5;
    if (request.outfitCategory === "athletic") score += profile.technical ? 5 : -4;
  }

  if (weather.tempF >= 80) {
    if (profile.light) score += 4;
    if (profile.warm) score -= 5;
  }
  if (weather.tempF <= 45 && profile.warm) score += 3;

  selectedProfiles.forEach((other) => {
    if (profile.formal && other.formal) score += 1.5;
    if (profile.rugged && other.rugged) score += 1.5;
    if (profile.technical && other.technical && request.outfitCategory === "athletic") score += 2;
    if ((profile.formal && other.rugged) || (profile.rugged && other.formal)) score -= 2.5;
    if ((profile.formal && other.technical) || (profile.technical && other.formal)) {
      if (!(slot === "outerwear" && weather.rainPct >= 50)) score -= 2;
    }
  });

  return score;
}

function styleCompatibilityScore(item, slot, request, selections) {
  const selected = selectedWithoutSlot(selections, slot);
  const selectedTags = new Set(selected.flatMap((candidate) => candidate.outfitTags ?? []));
  const itemTags = new Set(item.outfitTags ?? []);
  const selectedFormality = average(selected.map((candidate) => Number(candidate.formality ?? 3)), request.formality);
  const formalityGap = Math.abs((item.formality ?? 3) - selectedFormality);
  const pattern = String(item.pattern ?? "solid").toLowerCase();
  const patternedSelected = selected.filter((candidate) => !plainPattern.test(String(candidate.pattern ?? "solid").toLowerCase())).length;
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

  if (!plainPattern.test(pattern)) {
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

function seededVariation(itemId, slot, seed) {
  let hash = 2166136261;
  const text = `${seed ?? 0}:${slot}:${itemId}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  return ((hash >>> 0) / 4294967295 - 0.5) * 3;
}

function scoreItem(item, slot, request, usedIds, selections) {
  if (usedIds.has(item.id)) return -Infinity;
  if (item.status !== "active") return -Infinity;
  if (item.laundry === "dirty" || item.laundry === "repair") return -Infinity;
  if (!matchesOutfitSlot(item, slot)) return -Infinity;
  if (item.category === "suit" && !["formal", "professional"].includes(request.outfitCategory)) return -Infinity;
  if (slot === "top" && primarySelected(selections, "outerwear")?.category === "suit" && item.category === "dress") return -Infinity;

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
  const repeatPenalty = request.avoidItemIds?.includes(item.id) ? -18 : 0;
  const variation = seededVariation(item.id, slot, request.seed);
  const inferredWeatherFit = (itemWeatherFit(item, request).score - 60) / 2.7;
  const colorFit = colorHarmonyScore(item, selectedWithoutSlot(selections, slot));
  const styleFit = styleCompatibilityScore(item, slot, request, selections);
  const layerFit = layerCompatibilityScore(item, slot, request, selections);
  const materialFit = materialCompatibilityScore(item, slot, request, selections);

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
    materialFit +
    underusedFit +
    recencyFit +
    recentWearPenalty +
    repeatPenalty +
    variation
  );
}

function candidatesForSlot(items, slot, request, usedIds, selections, limit = 8) {
  return items
    .map((item) => ({ item, score: scoreItem(item, slot, request, usedIds, selections) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit);
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
  if (colorHarmonyScore(selected, selectedWithoutSlot(selections, slot)) >= 4) reasonBits.push("color");
  if (styleCompatibilityScore(selected, slot, request, selections) >= 4) reasonBits.push("style");
  if (materialCompatibilityScore(selected, slot, request, selections) >= 3) reasonBits.push("materials");
  return reasonBits.slice(0, 4);
}

export function generateOutfit(items, request, lockedSelections = {}) {
  const initialSelections = {};
  const initialUsedIds = new Set();
  const reasons = [];

  for (const slot of slotOrder) {
    const lockedIds = Array.isArray(lockedSelections[slot])
      ? lockedSelections[slot]
      : lockedSelections[slot]
        ? [lockedSelections[slot]]
        : [];

    lockedIds.forEach((itemId) => {
      const lockedItem = items.find((item) => item.id === itemId && matchesOutfitSlot(item, slot));
      if (!lockedItem || initialUsedIds.has(lockedItem.id)) return;
      initialSelections[slot] = [...(initialSelections[slot] ?? []), lockedItem];
      initialUsedIds.add(lockedItem.id);
    });
  }

  let states = [{ selections: initialSelections, usedIds: initialUsedIds, score: 0 }];
  for (const slot of selectionOrder) {
    const expanded = states.flatMap((state) => {
      if (state.selections[slot]?.length) return [state];

      const weather = effectiveWeatherForExposure(request);
      const top = primarySelected(state.selections, "top");
      const skipBottom = slot === "bottom" && top?.category === "dress";
      const skipOuterwear =
        slot === "outerwear" &&
        weather.tempF > 60 &&
        weather.rainPct < 45 &&
        weather.windMph < 16 &&
        !["formal", "professional"].includes(request.outfitCategory);
      if (skipBottom || skipOuterwear) return [state];

      const candidates = candidatesForSlot(
        items,
        slot,
        request,
        state.usedIds,
        state.selections,
        6
      );
      if (!candidates.length) return [state];

      return candidates.map((candidate) => ({
        selections: { ...state.selections, [slot]: [candidate.item] },
        usedIds: new Set([...state.usedIds, candidate.item.id]),
        score: state.score + candidate.score
      }));
    });

    states = expanded
      .sort((first, second) => second.score - first.score || selectionKey(first.selections).localeCompare(selectionKey(second.selections)))
      .slice(0, beamWidth);
  }

  const selections = states[0]?.selections ?? initialSelections;
  const alternatives = Object.fromEntries(
    slotOrder.map((slot) => {
      const selectedInOtherSlots = selectedWithoutSlot(selections, slot);
      const usedInOtherSlots = new Set(selectedInOtherSlots.map((item) => item.id));
      return [
        slot,
        candidatesForSlot(items, slot, request, usedInOtherSlots, selections, 8)
      ];
    })
  );

  for (const slot of slotOrder) {
    if (!selections[slot]?.length) continue;
    selections[slot].forEach((selected, index) => {
      const reasonBits = reasonBitsFor(selected, slot, request, selections);
      const slotLabel = humanize(index ? `${slot} ${index + 1}` : slot);
      reasons.push(`${slotLabel}: ${selected.name}${reasonBits.length ? ` · ${reasonBits.map(humanize).join(", ")}` : ""}`);
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
        ? `${humanize(request.outfitCategory)} · ${humanize(request.exposure ?? "mixed")} · ${request.tempF} F · ${request.rainPct}% rain`
        : "Add ready items to build an outfit."
  };
}

function selectionKey(selections) {
  return slotOrder
    .flatMap((slot) => selectionList(selections?.[slot]).map((item) => item.id))
    .join(":");
}
