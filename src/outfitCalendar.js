function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

const outfitSlotOrder = ["outerwear", "top", "bottom", "shoes", "accessory"];
const calendarExcludedColorSlots = new Set(["shoes", "socks"]);

function cloneLocks(locks = {}) {
  return Object.fromEntries(
    Object.entries(locks)
      .map(([slot, ids]) => [slot, [...new Set(list(ids))]])
      .filter(([, ids]) => ids.length)
  );
}

export function localDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function selectionIdsFor(selections = {}) {
  return Object.fromEntries(
    Object.entries(selections)
      .map(([slot, items]) => [slot, list(items).map((item) => item?.id).filter(Boolean)])
      .filter(([, ids]) => ids.length)
  );
}

export function availableSelectionIds(snapshot, items) {
  const availableIds = new Set(items.map((item) => item.id));
  return Object.fromEntries(
    Object.entries(snapshot?.selectedItemIds ?? {})
      .map(([slot, ids]) => [slot, list(ids).filter((id) => availableIds.has(id))])
      .filter(([, ids]) => ids.length)
  );
}

export function resolveSavedSelections(snapshot, items) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return Object.fromEntries(
    Object.entries(snapshot?.selectedItemIds ?? {})
      .map(([slot, ids]) => [slot, list(ids).map((id) => itemsById.get(id)).filter(Boolean)])
      .filter(([, selected]) => selected.length)
  );
}

export function calendarOutfitColorGroups(entryGroups) {
  return list(entryGroups)
    .map((entries) =>
      list(entries).flatMap((entry) => {
        const slot = Array.isArray(entry) ? entry[0] : entry?.slot;
        const item = Array.isArray(entry) ? entry[1] : entry?.item;
        if (!item || calendarExcludedColorSlots.has(slot)) return [];
        return [item.swatch || "#858b90"];
      })
    )
    .filter((swatches) => swatches.length);
}

export function serializeTodayPlans(plans) {
  return plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    request: { ...plan.request },
    locks: cloneLocks(plan.locks),
    selectedItemIds: selectionIdsFor(plan.outfit?.selections),
    lastWornDate: plan.lastWornDate || ""
  }));
}

export function serializePlannerPlan(request, locks, outfit, savedAt = new Date().toISOString()) {
  return {
    request: { ...request },
    locks: cloneLocks(locks),
    selectedItemIds: selectionIdsFor(outfit?.selections),
    savedAt
  };
}

export function upsertOutfitDay(days, date, patch) {
  const current = days.find((day) => day.id === date) ?? { id: date, date };
  const next = { ...current, ...patch, id: date, date };
  return [...days.filter((day) => day.id !== date), next].sort((a, b) => a.date.localeCompare(b.date));
}

export function monthDates(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: localDateIso(date),
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth()
    };
  });
}

export function wearOutfitsForDate(wearLogs, date, items) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const groups = new Map();

  wearLogs
    .filter((log) => log.wornDate === date)
    .forEach((log) => {
      const key = `${log.outfitId || "outfit"}:${log.wornAt || log.wornDate}`;
      const group = groups.get(key) ?? {
        id: key,
        outfitId: log.outfitId || "",
        label: log.outfitLabel || "Outfit",
        wornAt: log.wornAt || `${date}T12:00:00`,
        request: log.outfitRequest ?? null,
        entries: []
      };
      const item = itemsById.get(log.itemId) ?? {
        id: log.itemId,
        name: log.itemSnapshot?.name || "Removed item",
        color: log.itemSnapshot?.color || "Color unavailable",
        material: log.itemSnapshot?.material || "Material unavailable",
        swatch: log.itemSnapshot?.swatch || "#858b90"
      };
      group.entries.push({ slot: log.slot || "item", item });
      groups.set(key, group);
    });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => {
        const aIndex = outfitSlotOrder.indexOf(a.slot);
        const bIndex = outfitSlotOrder.indexOf(b.slot);
        return (aIndex === -1 ? outfitSlotOrder.length : aIndex) -
          (bIndex === -1 ? outfitSlotOrder.length : bIndex);
      })
    }))
    .sort((a, b) => a.wornAt.localeCompare(b.wornAt));
}
