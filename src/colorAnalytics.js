const fallbackSwatch = "#858b90";

function normalizedSwatch(value) {
  const swatch = String(value ?? "").trim() || fallbackSwatch;
  return /^#[0-9a-f]{6}$/i.test(swatch) ? swatch.toLowerCase() : swatch;
}

function normalizedColorName(value) {
  return String(value ?? "").trim() || "Unspecified";
}

export function groupColorsBySwatch(items) {
  const groups = new Map();

  items.forEach((item) => {
    const swatch = normalizedSwatch(item.swatch);
    const key = swatch.toLocaleLowerCase().replace(/\s+/g, " ");
    const color = normalizedColorName(item.color);
    const current = groups.get(key) ?? { swatch, count: 0, colorNames: new Map() };
    current.count += 1;
    if (!current.colorNames.has(color.toLocaleLowerCase())) {
      current.colorNames.set(color.toLocaleLowerCase(), color);
    }
    groups.set(key, current);
  });

  return [...groups.values()].map(({ swatch, count, colorNames }) => ({
    swatch,
    count,
    colors: [...colorNames.values()].sort((a, b) => a.localeCompare(b))
  }));
}
