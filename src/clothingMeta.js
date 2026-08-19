import { resolvedOutfitSlot } from "./garmentTaxonomy.js";

export const exposureOptions = [
  { value: "indoor", label: "Indoor" },
  { value: "mixed", label: "Mixed" },
  { value: "outdoor", label: "Outdoor" }
];

const weatherMaterials = [
  ["linen", "hot"],
  ["mesh", "hot"],
  ["chambray", "hot"],
  ["merino", "cold"],
  ["wool", "cold"],
  ["down", "cold"],
  ["fleece", "cold"],
  ["flannel", "cold"],
  ["nylon", "rain"],
  ["shell", "rain"],
  ["waxed", "rain"],
  ["waterproof", "rain"],
  ["leather", "wind"]
];

function materialText(item) {
  return `${item.material ?? ""} ${item.fabric ?? ""} ${item.itemType ?? ""} ${item.subcategory ?? ""}`.toLowerCase();
}

function materialBoost(item, target) {
  const text = materialText(item);
  return weatherMaterials
    .filter(([needle, weather]) => weather === target && text.includes(needle))
    .reduce((score) => score + 1, 0);
}

function targetWarmth(tempF) {
  if (tempF <= 35) return 5;
  if (tempF <= 50) return 4;
  if (tempF <= 68) return 3;
  if (tempF <= 78) return 2;
  return 1;
}

export function effectiveWeatherForExposure(request) {
  const exposure = request.exposure ?? "mixed";
  if (exposure === "indoor") {
    return {
      tempF: request.tempF >= 78 ? 72 : request.tempF <= 58 ? 68 : request.tempF,
      rainPct: Math.round((request.rainPct ?? 0) * 0.18),
      windMph: Math.round((request.windMph ?? 0) * 0.18),
      weatherWeight: 0.28,
      exposure
    };
  }
  if (exposure === "outdoor") {
    return {
      tempF: request.tempF,
      rainPct: request.rainPct ?? 0,
      windMph: request.windMph ?? 0,
      weatherWeight: 1.2,
      exposure
    };
  }
  return {
    tempF: request.tempF,
    rainPct: request.rainPct ?? 0,
    windMph: request.windMph ?? 0,
    weatherWeight: 0.72,
    exposure
  };
}

export function inferWeatherProfile(item) {
  const hot = Math.max(0, (item.breathability ?? 3) * 2 + (3 - (item.warmth ?? 3)) + materialBoost(item, "hot"));
  const cold = Math.max(0, (item.warmth ?? 3) * 2 + (item.wind ?? 1) + materialBoost(item, "cold"));
  const rain = Math.max(0, (item.rain ?? 1) * 2 + (item.climate?.includes("rain") ? 2 : 0) + materialBoost(item, "rain"));
  const wind = Math.max(0, (item.wind ?? 1) * 2 + (item.climate?.includes("wind") ? 2 : 0) + materialBoost(item, "wind"));
  const indoor = Math.max(0, 10 - Math.abs((item.warmth ?? 3) - 2.5) * 2 + (item.formality ?? 3) / 2);

  const labels = [];
  if (hot >= 9) labels.push("Hot weather");
  if (cold >= 11) labels.push("Cold weather");
  if (rain >= 9) labels.push("Rain");
  if (wind >= 8) labels.push("Wind");
  if (indoor >= 8) labels.push("Indoor comfort");
  if (!labels.length) labels.push("Mild weather");

  return {
    labels,
    scores: {
      hot: Math.min(10, Math.round(hot)),
      cold: Math.min(10, Math.round(cold)),
      rain: Math.min(10, Math.round(rain)),
      wind: Math.min(10, Math.round(wind)),
      indoor: Math.min(10, Math.round(indoor))
    }
  };
}

export function coverageWeatherFit(item, request) {
  const weather = effectiveWeatherForExposure(request);
  const slot = resolvedOutfitSlot(item);
  const coverage = slot === "bottom" ? item.bottomLength : item.sleeveLength;
  if (!coverage || !["top", "bottom", "outerwear"].includes(slot)) {
    return { adjustment: 0, strengths: [], cautions: [] };
  }

  const warmth = Number(item.warmth ?? 3);
  const breathability = Number(item.breathability ?? 3);
  const lightweightAndBreathable = warmth <= 2 && breathability >= 4;
  const strengths = [];
  const cautions = [];
  let adjustment = 0;

  if (weather.tempF >= 82) {
    if (slot === "bottom") {
      if (coverage === "short") {
        adjustment += 10;
        strengths.push("shorts suit the heat");
      } else if (coverage === "knee") {
        adjustment += 7;
        strengths.push("light leg coverage");
      } else if (coverage === "cropped") {
        adjustment += 3;
        strengths.push("cropped for warmth");
      } else if (coverage === "full" && lightweightAndBreathable) {
        adjustment += 2;
        strengths.push("breathable full coverage");
      } else if (coverage === "full") {
        adjustment -= 9;
        cautions.push("full length in heat");
      }
    } else if (["sleeveless", "short"].includes(coverage)) {
      adjustment += 9;
      strengths.push(coverage === "sleeveless" ? "sleeveless for heat" : "short sleeves suit the heat");
    } else if (coverage === "three_quarter") {
      adjustment += 3;
      strengths.push("moderate sleeve coverage");
    } else if (coverage === "long" && lightweightAndBreathable) {
      adjustment += 2;
      strengths.push("breathable long sleeves");
    } else if (coverage === "long") {
      adjustment -= 9;
      cautions.push("long sleeves in heat");
    }
  }

  if (weather.tempF <= 45) {
    if (slot === "bottom") {
      if (coverage === "full") {
        adjustment += 9;
        strengths.push("full coverage for cold");
      } else if (coverage === "cropped") {
        adjustment -= 3;
        cautions.push("limited ankle coverage");
      } else if (coverage === "knee") {
        adjustment -= 7;
        cautions.push("limited leg coverage");
      } else if (coverage === "short") {
        adjustment -= 11;
        cautions.push("shorts expose legs to cold");
      }
    } else if (coverage === "long") {
      adjustment += 8;
      strengths.push("long sleeves for cold");
    } else if (coverage === "three_quarter") {
      adjustment += 1;
      cautions.push("partial arm coverage");
    } else if (coverage === "short") {
      adjustment -= 8;
      cautions.push("short sleeves expose arms");
    } else if (coverage === "sleeveless") {
      adjustment -= 11;
      cautions.push("limited arm coverage");
    }
  }

  if (weather.exposure === "outdoor" && weather.tempF > 45 && weather.tempF < 82 && weather.windMph >= 16) {
    const fullCoverage = coverage === "long" || coverage === "full";
    adjustment += fullCoverage ? 2 : -2;
    if (fullCoverage) strengths.push("coverage for wind");
    else cautions.push("exposed in wind");
  }

  return {
    adjustment: adjustment * weather.weatherWeight,
    strengths: [...new Set(strengths)],
    cautions: [...new Set(cautions)]
  };
}

export function itemWeatherFit(item, request) {
  const weather = effectiveWeatherForExposure(request);
  const profile = inferWeatherProfile(item);
  const warmth = item.warmth ?? 3;
  const breathability = item.breathability ?? 3;
  const rain = item.rain ?? 0;
  const wind = item.wind ?? 0;
  const warmthGap = Math.abs(warmth - targetWarmth(weather.tempF));
  let score = 76 - warmthGap * 4.5 * weather.weatherWeight;
  const strengths = [];
  const cautions = [];
  const coverageFit = coverageWeatherFit(item, request);

  if (warmthGap <= 1) strengths.push("right warmth");
  else if (warmth > targetWarmth(weather.tempF)) cautions.push("warmer than needed");
  else cautions.push("lighter than forecast");
  strengths.push(...coverageFit.strengths);
  cautions.push(...coverageFit.cautions);

  if (weather.tempF >= 82) {
    if (profile.scores.hot >= 7 && breathability >= 4 && warmth <= 2) {
      score += 15 * weather.weatherWeight;
      strengths.push("heat ready");
    } else if (warmth >= 3 || breathability <= 2) {
      score -= 18 * weather.weatherWeight;
      cautions.push("heat risk");
    }
  }

  if (weather.tempF <= 45) {
    if (profile.scores.cold >= 7 && warmth >= 4) {
      score += 15 * weather.weatherWeight;
      strengths.push("cold ready");
    } else if (warmth <= 2) {
      score -= 18 * weather.weatherWeight;
      cautions.push("light for cold");
    }
  }

  if (weather.rainPct >= 50) {
    if (profile.scores.rain >= 7 || rain >= 3 || item.climate?.includes("rain")) {
      score += 15 * weather.weatherWeight;
      strengths.push("rain ready");
    } else {
      score -= 22 * weather.weatherWeight;
      cautions.push("weak in rain");
    }
  }

  if (weather.windMph >= 16) {
    if (profile.scores.wind >= 7 || wind >= 3 || item.climate?.includes("wind")) {
      score += 10 * weather.weatherWeight;
      strengths.push("wind ready");
    } else {
      score -= 12 * weather.weatherWeight;
      cautions.push("wind exposure");
    }
  }

  if (weather.exposure === "indoor") {
    if (warmth >= 5 && weather.tempF >= 65) {
      score -= 11;
      cautions.push("heavy indoors");
    } else if (profile.scores.indoor >= 7 && warmth >= 1 && warmth <= 4) {
      score += 9;
      strengths.push("indoor friendly");
    }
  } else if (weather.exposure === "outdoor") {
    const protection = rain + wind + (item.climate?.includes("rain") ? 1 : 0) + (item.climate?.includes("wind") ? 1 : 0);
    if (protection >= 6 || profile.scores.rain + profile.scores.wind >= 13) {
      score += 8;
      strengths.push("outdoor ready");
    } else if (protection <= 2) {
      score -= 7;
      cautions.push("light outdoors");
    }
  } else if (warmth >= 2 && warmth <= 4) {
    score += 3;
    strengths.push("mixed plan");
  }

  score += coverageFit.adjustment;

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalized,
    tone: normalized >= 82 ? "success" : normalized >= 62 ? "info" : "warning",
    label: normalized >= 86 ? "Strong fit" : normalized >= 72 ? "Good fit" : normalized >= 58 ? "Usable" : "Check weather",
    strengths: strengths.slice(0, 2),
    cautions: cautions.slice(0, 2),
    profile
  };
}
