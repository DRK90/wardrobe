import {
  Archive,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  Menu,
  ChevronRight,
  CloudSun,
  Database,
  Download,
  Home,
  ImagePlus,
  MapPin,
  Navigation,
  PackageSearch,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Shuffle,
  Thermometer,
  Trash2,
  Umbrella,
  Upload,
  Wand2,
  Wind,
  X
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  categoryOptions,
  climateOptions,
  laundryOptions,
  outfitCategories,
  seasonOptions,
  starterItems
} from "./data.js";
import { generateOutfit, matchesOutfitSlot, recommendSocks } from "./outfitEngine.js";
import { exposureOptions, inferWeatherProfile, itemWeatherFit } from "./clothingMeta.js";
import {
  loadItems,
  loadOutfitDays,
  loadSettings,
  loadWearLogs,
  loadWeatherCache,
  saveItems,
  saveOutfitDays,
  saveSettings,
  saveWearLogs,
  saveWeatherCache
} from "./storage.js";
import {
  availableSelectionIds,
  localDateIso,
  monthDates,
  resolveSavedSelections,
  selectionIdsFor,
  serializePlannerPlan,
  serializeTodayPlans,
  upsertOutfitDay,
  wearOutfitsForDate
} from "./outfitCalendar.js";
import {
  activeWeatherEntry,
  cleanZip,
  eventWeatherForRequest,
  fetchZipForecast,
  isWeatherFresh,
  validZip,
  weatherToRequest
} from "./weather.js";

const defaultSettings = {
  id: "main",
  weatherProvider: "manual",
  units: "imperial",
  removedStarterIds: [],
  homeZip: "",
  destinationEnabled: false,
  destinationZip: ""
};

const emptyWeatherCache = {
  id: "main",
  home: null,
  destination: null,
  plan: null
};

const localComponentLabels =
  import.meta.env.DEV ||
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) ||
  /^10\./.test(window.location.hostname) ||
  /^192\.168\./.test(window.location.hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(window.location.hostname);

function componentMeta(name) {
  return localComponentLabels ? { "data-component": name } : {};
}

function normalizeSettings(settings) {
  const next = {
    ...defaultSettings,
    homeZip: settings?.homeZip ?? defaultSettings.homeZip,
    destinationEnabled: Boolean(settings?.destinationEnabled),
    destinationZip: settings?.destinationZip ?? defaultSettings.destinationZip,
    removedStarterIds: settings?.removedStarterIds,
    weatherProvider: settings?.weatherProvider ?? defaultSettings.weatherProvider,
    units: settings?.units ?? defaultSettings.units
  };
  if (!Array.isArray(next.removedStarterIds)) next.removedStarterIds = [];
  next.homeZip = cleanZip(next.homeZip);
  next.destinationZip = cleanZip(next.destinationZip);
  if (next.homeZip) next.weatherProvider = "nws";
  return next;
}

const newItemTemplate = {
  name: "",
  category: "top",
  subcategory: "",
  brand: "",
  size: "",
  color: "",
  swatch: "oklch(0.43 0.075 200)",
  material: "",
  materialPct: 100,
  fabric: "",
  pattern: "solid",
  warmth: 3,
  breathability: 3,
  rain: 1,
  wind: 1,
  formality: 3,
  condition: 4,
  cost: 0,
  wears: 0,
  acquired: "",
  lastWorn: "",
  laundry: "ready",
  status: "active",
  outfitTags: ["daily"],
  season: ["spring", "fall"],
  climate: ["mild"],
  layerRole: "",
  care: "",
  storageLocation: "",
  notes: "",
  imageDataUrl: "",
  evidencePhotos: []
};

const starterItemIds = new Set(starterItems.map((item) => item.id));

const filterDefaults = {
  category: "all",
  brand: "",
  season: "all",
  climate: "all",
  laundry: "all",
  formality: "all",
  photos: "all",
  size: "",
  material: ""
};

const materialOptions = [
  "Cotton",
  "Linen",
  "Merino wool",
  "Wool",
  "Cashmere",
  "Silk",
  "Viscose",
  "Rayon",
  "Nylon",
  "Polyester",
  "Elastane",
  "Leather",
  "Down",
  "Fleece",
  "Waxed cotton",
  "Recycled nylon",
  "Recycled polyester"
];

const fabricOptions = [
  "plain weave",
  "oxford cloth",
  "chambray",
  "jersey knit",
  "fine jersey knit",
  "heavy jersey",
  "pique knit",
  "flannel",
  "twill",
  "stretch twill",
  "stretch woven",
  "denim",
  "fleece",
  "crepe knit",
  "ponte knit",
  "waterproof shell",
  "3-layer waterproof shell",
  "leather upper",
  "woven strap"
];

const layerRoleOptions = [
  "base",
  "mid",
  "insulation",
  "shell",
  "outer",
  "one-piece",
  "footwear",
  "accessory"
];

const patternOptions = ["solid", "stripe", "plaid", "check", "houndstooth", "floral", "graphic", "textured", "colorblock"];

const itemStatusOptions = ["active", "archived"];

const evidencePhotoRoles = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "brand_label", label: "Brand label" },
  { value: "care_label", label: "Care label" },
  { value: "size_tag", label: "Size tag" },
  { value: "detail", label: "Detail" },
  { value: "packaging", label: "Packaging" }
];

const materialPctOptions = [100, 98, 95, 92, 90, 88, 85, 80, 75, 70, 65, 60, 55, 50, 0].map((value) => ({
  value,
  label: `${value}%`
}));

const ratingOptions = [
  { value: 0, label: "0 None" },
  { value: 1, label: "1 Low" },
  { value: 2, label: "2 Light" },
  { value: 3, label: "3 Medium" },
  { value: 4, label: "4 High" },
  { value: 5, label: "5 Max" }
];

const oneToFiveOptions = ratingOptions.filter((option) => option.value > 0);

const costOptions = [0, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000].map(
  (value) => ({ value, label: money(value) })
);

const wearCountOptions = [0, 1, 2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200].map((value) => ({
  value,
  label: String(value)
}));

const friendlyLabels = {
  all: "Any",
  daily: "Daily",
  professional: "Professional",
  formal: "Formal",
  travel: "Travel",
  top: "Tops",
  bottom: "Bottoms",
  outerwear: "Outerwear",
  dress: "Dresses",
  suit: "Suits",
  shoes: "Shoes",
  accessory: "Accessories",
  athletic: "Athletic",
  underwear: "Underwear",
  socks: "Socks",
  sleepwear: "Sleepwear",
  swimwear: "Swimwear",
  active: "Active",
  archived: "Archived",
  ready: "Ready",
  dirty: "Dirty",
  repair: "Repair",
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
  hot: "Hot",
  mild: "Mild",
  cool: "Cool",
  cold: "Cold",
  rain: "Rain",
  wind: "Wind",
  snow: "Snow",
  home: "Home",
  destination: "Trip",
  weather_protective: "Weather"
};

function labelFor(value) {
  if (typeof value === "object" && value !== null) return value.label;
  return friendlyLabels[value] ?? String(value).replaceAll("_", " ");
}

function optionValue(option) {
  return typeof option === "object" && option !== null ? option.value : option;
}

function freshItemTemplate() {
  return {
    ...newItemTemplate,
    outfitTags: [...newItemTemplate.outfitTags],
    season: [...newItemTemplate.season],
    climate: [...newItemTemplate.climate],
    evidencePhotos: []
  };
}

function money(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function todayIso() {
  return localDateIso();
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDateIso(date);
}

function makeId(prefix) {
  const randomId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

function defaultPlannerRequest() {
  return {
    outfitCategory: "professional",
    eventDate: tomorrowIso(),
    eventTime: "09:00",
    eventLocation: "home",
    planLocationEnabled: false,
    planZip: "",
    tempF: 67,
    rainPct: 12,
    windMph: 6,
    exposure: "mixed",
    formality: 4,
    season: "spring",
    underused: true,
    seed: 1
  };
}

function defaultTodayRequest(seed = 1) {
  return {
    ...defaultPlannerRequest(),
    outfitCategory: "daily",
    eventDate: todayIso(),
    eventLocation: "home",
    formality: 2,
    seed
  };
}

function createTodayOutfitPlan(index = 1, requestPatch = {}) {
  return {
    id: makeId("today-outfit"),
    label: `Outfit ${index}`,
    request: {
      ...defaultTodayRequest(index),
      ...requestPatch,
      eventDate: todayIso()
    },
    locks: {},
    outfit: null,
    lastWornDate: ""
  };
}

function restoreTodayPlans(savedPlans, items) {
  return savedPlans.map((saved, index) => {
    const request = {
      ...defaultTodayRequest(index + 1),
      ...saved.request,
      eventDate: todayIso()
    };
    const selectedItemIds = availableSelectionIds(saved, items);
    return {
      id: saved.id || makeId("today-outfit"),
      label: saved.label || `Outfit ${index + 1}`,
      request,
      locks: saved.locks ?? {},
      outfit: generateOutfit(items, request, selectedItemIds),
      lastWornDate: saved.lastWornDate || ""
    };
  });
}

function restorePlannerPlan(saved, items, fallbackRequest = defaultPlannerRequest()) {
  const request = { ...fallbackRequest, ...saved?.request };
  const selectedItemIds = availableSelectionIds(saved, items);
  return {
    request,
    locks: saved?.locks ?? {},
    outfit: generateOutfit(items, request, selectedItemIds)
  };
}

function restoreTodayPlansFromWearLogs(wearLogs, items) {
  return wearOutfitsForDate(wearLogs, todayIso(), items).map((group, index) => {
    const request = {
      ...defaultTodayRequest(index + 1),
      ...(group.request ?? {}),
      eventDate: todayIso()
    };
    const selectedItemIds = group.entries.reduce((selections, entry) => {
      selections[entry.slot] = [...(selections[entry.slot] ?? []), entry.item.id];
      return selections;
    }, {});
    return {
      id: group.outfitId || makeId("today-outfit"),
      label: group.label || `Outfit ${index + 1}`,
      request,
      locks: {},
      outfit: generateOutfit(items, request, selectedItemIds),
      lastWornDate: todayIso()
    };
  });
}

function normalizeEvidencePhotos(photos) {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((photo) => photo?.dataUrl)
    .map((photo) => ({
      id: photo.id ?? makeId("photo"),
      role: photo.role || "detail",
      dataUrl: photo.dataUrl,
      capturedAt: photo.capturedAt || ""
    }));
}

function parseDate(dateText) {
  if (!dateText) return null;
  const date = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageMonths(item) {
  const date = parseDate(item.acquired);
  if (!date) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 2629800000));
}

function daysSince(dateText) {
  const date = parseDate(dateText);
  if (!date) return 999;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}

function costPerWear(item) {
  if (!item.cost) return "n/a";
  return money(item.cost / Math.max(1, item.wears || 0), 2);
}

function normalizeItem(form) {
  const laundry = form.laundry === "worn" ? "ready" : form.laundry || "ready";
  return {
    ...newItemTemplate,
    ...form,
    id: form.id ?? makeId("itm"),
    materialPct: Number(form.materialPct || 0),
    warmth: Number(form.warmth || 0),
    breathability: Number(form.breathability || 0),
    rain: Number(form.rain || 0),
    wind: Number(form.wind || 0),
    formality: Number(form.formality || 0),
    condition: Number(form.condition || 0),
    cost: Number(form.cost || 0),
    wears: Number(form.wears || 0),
    acquired: form.acquired || todayIso(),
    lastWorn: form.lastWorn || "",
    status: form.status || "active",
    laundry: laundryOptions.includes(laundry) ? laundry : "ready",
    outfitTags: form.outfitTags?.length ? form.outfitTags : ["daily"],
    season: form.season?.length ? form.season : ["spring", "fall"],
    climate: form.climate?.length ? form.climate : ["mild"],
    evidencePhotos: normalizeEvidencePhotos(form.evidencePhotos)
  };
}

function mergeStarterItems(storedItems, removedStarterIds = []) {
  const removed = new Set(removedStarterIds);
  const storedById = new Map(storedItems.map((item) => [item.id, normalizeItem(item)]));
  starterItems.forEach((item) => {
    if (!removed.has(item.id) && !storedById.has(item.id)) storedById.set(item.id, normalizeItem(item));
  });
  return [...storedById.values()];
}

function groupTotals(items, key, valueKey = null) {
  return items.reduce((map, item) => {
    const raw = item[key];
    const values = Array.isArray(raw) ? raw : [raw || "Unspecified"];
    values.forEach((value) => {
      const current = map.get(value) ?? { label: value, count: 0, value: 0 };
      current.count += 1;
      current.value += valueKey ? Number(item[valueKey] || 0) : 0;
      map.set(value, current);
    });
    return map;
  }, new Map());
}

function brandLabel(value) {
  return value || "Unbranded";
}

function brandTotals(items) {
  return items.reduce((map, item) => {
    const label = String(item.brand || "Unbranded").trim() || "Unbranded";
    const key = label.toLocaleLowerCase();
    const current = map.get(key) ?? { label, count: 0, value: 0 };
    current.count += 1;
    current.value += Number(item.cost || 0);
    map.set(key, current);
    return map;
  }, new Map());
}

function hslFromRgb(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  let hue = 0;
  if (delta && max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  else if (delta && max === green) hue = ((blue - red) / delta + 2) * 60;
  else if (delta) hue = ((red - green) / delta + 4) * 60;
  return { hue, chroma: saturation, lightness };
}

function colorSortKey(swatch) {
  const text = String(swatch ?? "");
  const oklch = text.match(/oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)/i);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const chroma = Number(oklch[3]) || 0;
    const hue = Number(oklch[4]) || 0;
    return { hue, chroma, lightness, neutral: chroma < 0.018 };
  }
  const hex = text.match(/^#?([0-9a-f]{6})$/i);
  if (!hex) return { hue: 0, chroma: 0, lightness: 0.5, neutral: true };
  const value = hex[1];
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const color = hslFromRgb(red, green, blue);
  return { ...color, neutral: color.chroma < 0.12 };
}

function compareSwatches(a, b) {
  const first = colorSortKey(a.swatch);
  const second = colorSortKey(b.swatch);
  if (first.neutral !== second.neutral) return first.neutral ? 1 : -1;
  if (first.neutral) return second.lightness - first.lightness;
  return (
    first.hue - second.hue ||
    first.lightness - second.lightness ||
    second.chroma - first.chroma ||
    String(a.color).localeCompare(String(b.color))
  );
}

function analyticsFor(items, wearLogs) {
  const active = items.filter((item) => item.status === "active");
  const totalValue = active.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const totalWears = active.reduce((sum, item) => sum + Number(item.wears || 0), 0);
  const oldest = [...active].sort((a, b) => ageMonths(b) - ageMonths(a)).slice(0, 5);
  const underused = active
    .filter((item) => Number(item.cost || 0) >= 70 && Number(item.wears || 0) <= 10)
    .sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0))
    .slice(0, 5);
  const byCategory = [...groupTotals(active, "category", "cost").values()].sort((a, b) => b.count - a.count);
  const bySeason = [...groupTotals(active, "season").values()].sort((a, b) => b.count - a.count);
  const byClimate = [...groupTotals(active, "climate").values()].sort((a, b) => b.count - a.count);
  const byMaterial = [...groupTotals(active, "material").values()].sort((a, b) => b.count - a.count).slice(0, 6);
  const byBrand = [...brandTotals(active).values()].sort(
    (a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label))
  );
  const byLaundry = [...groupTotals(active, "laundry").values()].sort((a, b) => b.count - a.count);
  const byFormality = [...groupTotals(active, "formality", "cost").values()].sort((a, b) => Number(a.label) - Number(b.label));
  const colors = active.reduce((list, item) => {
    if (!list.some((entry) => entry.swatch === item.swatch)) {
      list.push({ swatch: item.swatch, color: item.color, count: active.filter((candidate) => candidate.swatch === item.swatch).length });
    }
    return list;
  }, []);
  const gaps = findWardrobeGaps(active);
  const careQueue = active
    .filter((item) => item.laundry !== "ready" || item.condition <= 2)
    .sort((a, b) => Number(a.condition || 0) - Number(b.condition || 0) || daysSince(b.lastWorn) - daysSince(a.lastWorn))
    .slice(0, 5);

  return {
    active,
    totalValue,
    totalWears,
    averageCostPerWear: totalWears ? totalValue / totalWears : 0,
    ready: active.filter((item) => item.laundry === "ready").length,
    needsCare: active.filter((item) => item.laundry !== "ready" || item.condition <= 2).length,
    withPhotos: active.filter((item) => item.imageDataUrl).length,
    wearLogs: wearLogs.length,
    oldest,
    underused,
    byCategory,
    bySeason,
    byClimate,
    byMaterial,
    byBrand,
    byLaundry,
    byFormality,
    colors,
    gaps,
    careQueue
  };
}

function findWardrobeGaps(items) {
  const count = (predicate) => items.filter(predicate).length;
  const gaps = [];
  [
    ["top", 7, "More tops", "Daily rotation is thin for tops."],
    ["bottom", 4, "More bottoms", "Bottoms will cycle faster than the rest of the wardrobe."],
    ["shoes", 4, "More shoe options", "Footwear has limited coverage across weather and formality."],
    ["outerwear", 4, "More outerwear depth", "Layering choices are narrow for changing weather."]
  ].forEach(([category, target, label, reason]) => {
    if (count((item) => item.category === category) < target) gaps.push({ label, reason });
  });
  if (count((item) => item.category === "shoes" && item.formality >= 4 && item.rain >= 3) === 0) {
    gaps.push({ label: "Dress shoes for wet weather", reason: "Formal outfits have no rain-capable footwear." });
  }
  if (count((item) => item.season?.includes("summer") && item.formality >= 4) < 2) {
    gaps.push({ label: "Warm-weather professional pieces", reason: "Summer coverage is light for higher formality." });
  }
  if (count((item) => item.climate?.includes("snow")) < 3) {
    gaps.push({ label: "Snow-day depth", reason: "Winter weather depends on very few items." });
  }
  if (count((item) => item.category === "bottom" && item.outfitTags?.includes("athletic")) === 0) {
    gaps.push({ label: "Athletic bottoms", reason: "Athletic outfits rely on shorts only." });
  }
  if (items.some((item) => ageMonths(item) > 72 && item.condition <= 2)) {
    gaps.push({ label: "Replacement candidates", reason: "Several older pieces are in low condition." });
  }
  return gaps.slice(0, 5);
}

function StatusChip({ tone = "neutral", icon: Icon, children }) {
  return (
    <span className={`status-chip tone-${tone}`}>
      {Icon ? <Icon size={13} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function ItemVisual({ item, size = "md" }) {
  return (
    <div className={`item-visual visual-${size}`} style={{ "--swatch": item?.swatch ?? "oklch(0.43 0.075 200)" }}>
      {item?.imageDataUrl ? <img src={item.imageDataUrl} alt="" /> : <Shirt size={size === "lg" ? 28 : 16} aria-hidden="true" />}
    </div>
  );
}

function ToggleGroup({ options, values, onChange }) {
  function toggle(value) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <div className="toggle-grid">
      {options.map((option) => (
        <label key={option} className="checkbox-line">
          <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} />
          {option}
        </label>
      ))}
    </div>
  );
}

function App() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [wearLogs, setWearLogs] = useState([]);
  const [outfitDays, setOutfitDays] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [weatherCache, setWeatherCache] = useState(emptyWeatherCache);
  const [weatherStatus, setWeatherStatus] = useState({ home: "idle", destination: "idle", plan: "idle" });
  const [view, setView] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(filterDefaults);
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [request, setRequest] = useState(() => defaultPlannerRequest());
  const [todayOutfits, setTodayOutfits] = useState(() => [createTodayOutfitPlan(1)]);
  const [eventForecastStatus, setEventForecastStatus] = useState({ state: "idle", message: "" });
  const [generatedOutfit, setGeneratedOutfit] = useState(null);
  const [outfitLocks, setOutfitLocks] = useState({});
  const [form, setForm] = useState(() => freshItemTemplate());
  const [toast, setToast] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true
  );
  const importRef = useRef(null);

  useEffect(() => {
    async function hydrate() {
      const [storedItems, storedSettings, storedWearLogs, storedWeatherCache, storedOutfitDays] = await Promise.all([
        loadItems(),
        loadSettings(),
        loadWearLogs(),
        loadWeatherCache(),
        loadOutfitDays()
      ]);
      const nextSettings = normalizeSettings(storedSettings);
      const nextItems = mergeStarterItems(storedItems, nextSettings.removedStarterIds);
      const todayRecord = storedOutfitDays.find((day) => day.id === todayIso());
      const savedTodayPlans = Array.isArray(todayRecord?.todayPlans) ? todayRecord.todayPlans : [];
      const loggedTodayPlans = restoreTodayPlansFromWearLogs(storedWearLogs, nextItems);
      const initialTodayPlans = savedTodayPlans.length
        ? restoreTodayPlans(savedTodayPlans, nextItems)
        : loggedTodayPlans.length
          ? loggedTodayPlans
          : [createTodayOutfitPlan(1)].map((plan) => {
            const plannedRequest = {
              ...plan.request,
              eventDate: todayIso(),
              eventLocation: nextSettings.destinationEnabled ? "destination" : "home"
            };
              return { ...plan, request: plannedRequest, outfit: generateOutfit(nextItems, plannedRequest) };
            });
      const initialPlannerRequest = defaultPlannerRequest();
      const savedPlanner = storedOutfitDays.find((day) => day.id === initialPlannerRequest.eventDate)?.plannerPlan;
      const initialPlanner = savedPlanner
        ? restorePlannerPlan(savedPlanner, nextItems, initialPlannerRequest)
        : {
            request: initialPlannerRequest,
            locks: {},
            outfit: generateOutfit(nextItems, initialPlannerRequest)
          };
      setItems(nextItems);
      setSettings(nextSettings);
      setWearLogs(storedWearLogs);
      setOutfitDays(storedOutfitDays);
      setWeatherCache({ ...emptyWeatherCache, ...(storedWeatherCache ?? {}) });
      setRequest(initialPlanner.request);
      setOutfitLocks(initialPlanner.locks);
      setGeneratedOutfit(initialPlanner.outfit);
      setTodayOutfits(initialTodayPlans);
      setLoaded(true);
    }
    hydrate();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(display-mode: standalone)");
    const updateInstalledState = () => setIsInstalled(Boolean(media?.matches || window.navigator.standalone === true));
    updateInstalledState();
    media?.addEventListener?.("change", updateInstalledState);
    window.addEventListener("appinstalled", updateInstalledState);
    return () => {
      media?.removeEventListener?.("change", updateInstalledState);
      window.removeEventListener("appinstalled", updateInstalledState);
    };
  }, []);

  useEffect(() => {
    if (loaded) saveItems(items);
  }, [items, loaded]);

  useEffect(() => {
    if (loaded) saveSettings(settings);
  }, [settings, loaded]);

  useEffect(() => {
    if (loaded) saveWearLogs(wearLogs);
  }, [wearLogs, loaded]);

  useEffect(() => {
    if (loaded) saveOutfitDays(outfitDays);
  }, [outfitDays, loaded]);

  useEffect(() => {
    if (loaded) saveWeatherCache(weatherCache);
  }, [weatherCache, loaded]);

  useEffect(() => {
    if (!loaded) return;
    setOutfitDays((current) =>
      upsertOutfitDay(current, todayIso(), {
        todayPlans: serializeTodayPlans(todayOutfits),
        updatedAt: new Date().toISOString()
      })
    );
  }, [loaded, todayOutfits]);

  useEffect(() => {
    if (!loaded) return;
    setEventForecastStatus({ state: "idle", message: "" });
  }, [loaded, request.eventDate, request.eventTime, request.eventLocation]);

  useEffect(() => {
    if (!loaded) return;
    const homeZip = cleanZip(settings.homeZip);
    if (homeZip && (!weatherCache.home || weatherCache.home.zip !== homeZip || !isWeatherFresh(weatherCache.home))) {
      refreshWeather("home", homeZip, { silent: true });
    }

    const destinationZip = cleanZip(settings.destinationZip);
    if (
      settings.destinationEnabled &&
      destinationZip &&
      (!weatherCache.destination ||
        weatherCache.destination.zip !== destinationZip ||
        !isWeatherFresh(weatherCache.destination))
    ) {
      refreshWeather("destination", destinationZip, { silent: true });
    }
  }, [loaded, settings.homeZip, settings.destinationEnabled, settings.destinationZip]);

  useEffect(() => {
    if (!loaded || !items.length) return;
    const weatherRequest = requestWithKnownWeather(request, "planner");
    const changed = ["eventLocation", "tempF", "rainPct", "windMph", "season"].some(
      (key) => weatherRequest[key] !== request[key]
    );
    if (!changed) return;
    const preservedSelections = selectionIdsFor(generatedOutfit?.selections);
    setRequest(weatherRequest);
    setGeneratedOutfit(
      generateOutfit(
        items,
        weatherRequest,
        Object.keys(preservedSelections).length ? preservedSelections : outfitLocks
      )
    );
  }, [loaded, weatherCache.home, weatherCache.plan, settings.homeZip, request.planLocationEnabled, request.planZip]);

  useEffect(() => {
    if (!loaded || !items.length) return;
    setTodayOutfits((current) =>
      current.map((plan) => {
        const weatherRequest = requestWithKnownWeather(plan.request, "today");
        const changed = ["eventLocation", "eventDate", "tempF", "rainPct", "windMph", "season"].some(
          (key) => weatherRequest[key] !== plan.request[key]
        );
        if (!changed && plan.outfit) return plan;
        const preservedSelections = selectionIdsFor(plan.outfit?.selections);
        return {
          ...plan,
          request: weatherRequest,
          outfit: generateOutfit(
            items,
            weatherRequest,
            Object.keys(preservedSelections).length ? preservedSelections : plan.locks ?? {}
          )
        };
      })
    );
  }, [loaded, weatherCache.home, weatherCache.destination, settings.homeZip, settings.destinationEnabled, settings.destinationZip]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const queryMatch =
        !needle ||
        [item.name, item.brand, item.color, item.material, item.subcategory, item.notes, item.storageLocation]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const categoryMatch = filters.category === "all" || item.category === filters.category;
      const brandMatch = !filters.brand || String(item.brand ?? "").toLowerCase().includes(filters.brand.toLowerCase());
      const seasonMatch = filters.season === "all" || item.season?.includes(filters.season);
      const climateMatch = filters.climate === "all" || item.climate?.includes(filters.climate);
      const laundryMatch = filters.laundry === "all" || item.laundry === filters.laundry;
      const formalityMatch = filters.formality === "all" || Number(item.formality) === Number(filters.formality);
      const photosMatch =
        filters.photos === "all" ||
        (filters.photos === "with" && item.imageDataUrl) ||
        (filters.photos === "without" && !item.imageDataUrl);
      const sizeMatch = !filters.size || String(item.size ?? "").toLowerCase().includes(filters.size.toLowerCase());
      const materialMatch =
        !filters.material ||
        [item.material, item.fabric]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(filters.material.toLowerCase()));
      return (
        queryMatch &&
        categoryMatch &&
        brandMatch &&
        seasonMatch &&
        climateMatch &&
        laundryMatch &&
        formalityMatch &&
        photosMatch &&
        sizeMatch &&
        materialMatch
      );
    });

    return filtered.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const valueA = sortValue(a, sort.key);
      const valueB = sortValue(b, sort.key);
      if (typeof valueA === "number" && typeof valueB === "number") return (valueA - valueB) * dir;
      return String(valueA).localeCompare(String(valueB)) * dir;
    });
  }, [items, query, filters, sort]);

  const analytics = useMemo(() => analyticsFor(items, wearLogs), [items, wearLogs]);
  const activeWeather = useMemo(() => activeWeatherEntry(settings, weatherCache), [settings, weatherCache]);
  const todayEventLocation = settings.destinationEnabled ? "destination" : "home";
  const plannerEventLocation = request.planLocationEnabled && validZip(request.planZip) ? "plan" : "home";

  function requestForSurface(baseRequest, surface = "planner") {
    if (surface === "today") {
      return { ...baseRequest, eventLocation: todayEventLocation, eventDate: todayIso() };
    }
    return {
      ...baseRequest,
      eventLocation: baseRequest.planLocationEnabled && validZip(baseRequest.planZip) ? "plan" : "home"
    };
  }

  function weatherEntryForRequest(baseRequest, surface = "planner") {
    const kind = requestForSurface(baseRequest, surface).eventLocation;
    return weatherCache[kind]?.current ? weatherCache[kind] : null;
  }

  function requestWithKnownWeather(baseRequest, surface = "planner") {
    const plannedRequest = requestForSurface(baseRequest, surface);
    const entry = weatherEntryForRequest(baseRequest, surface);
    if (surface === "today") {
      return entry?.current ? weatherToRequest(entry, plannedRequest) : plannedRequest;
    }
    const eventForecast = eventWeatherForRequest(entry, plannedRequest);
    if (eventForecast?.request) return eventForecast.request;
    return entry?.current ? weatherToRequest(entry, plannedRequest) : plannedRequest;
  }

  function sortValue(item, key) {
    if (key === "age") return ageMonths(item);
    if (key === "lastWorn") return daysSince(item.lastWorn);
    if (key === "costPerWear") return item.cost / Math.max(1, item.wears || 0);
    return item[key] ?? "";
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function updateWeatherSettings(patch) {
    setSettings((current) =>
      normalizeSettings({
        ...current,
        ...patch,
        weatherProvider: patch.homeZip || current.homeZip ? "nws" : current.weatherProvider
      })
    );
  }

  function saveInventoryItem(updatedItem) {
    const normalized = normalizeItem(updatedItem);
    const nextItems = items.map((candidate) => (candidate.id === normalized.id ? normalized : candidate));
    setItems(nextItems);
    setGeneratedOutfit((current) => syncOutfitItems(current, nextItems));
    setTodayOutfits((current) =>
      current.map((plan) => ({
        ...plan,
        outfit: syncOutfitItems(plan.outfit, nextItems)
      }))
    );
    showToast("Item saved");
  }

  async function refreshWeather(kind, zip, options = {}) {
    const normalizedZip = cleanZip(zip);
    if (!validZip(normalizedZip)) {
      setWeatherStatus((current) => ({ ...current, [kind]: "error" }));
      showToast("Enter a 5-digit ZIP");
      return null;
    }

    const cached = weatherCache[kind];
    if (!options.force && cached?.zip === normalizedZip && isWeatherFresh(cached)) {
      setWeatherStatus((current) => ({ ...current, [kind]: "idle" }));
      if (!options.silent) showToast("Forecast is current");
      return cached;
    }

    setWeatherStatus((current) => ({ ...current, [kind]: "loading" }));
    try {
      const forecast = await fetchZipForecast(normalizedZip);
      setWeatherCache((current) => ({ ...current, [kind]: forecast }));
      setWeatherStatus((current) => ({ ...current, [kind]: "idle" }));
      if (!options.silent) showToast("Forecast updated");
      return forecast;
    } catch (error) {
      setWeatherStatus((current) => ({ ...current, [kind]: "error" }));
      if (!options.silent) showToast(error.message || "Forecast unavailable");
      return null;
    }
  }

  async function applyEventForecast(baseRequest = request, surface = "planner") {
    const plannedRequest = requestForSurface(baseRequest, surface);
    const kind = plannedRequest.eventLocation;
    const zip =
      kind === "destination"
        ? cleanZip(settings.destinationZip)
        : kind === "plan"
          ? cleanZip(plannedRequest.planZip)
          : cleanZip(settings.homeZip);
    if (!validZip(zip)) {
      setEventForecastStatus({ state: "manual", message: "Add a ZIP or set conditions." });
      showToast("Add a ZIP or set conditions");
      return null;
    }

    setEventForecastStatus({ state: "loading", message: "Checking forecast." });
    let entry = weatherCache[kind];
    if (!entry || entry.zip !== zip || !isWeatherFresh(entry)) {
      entry = await refreshWeather(kind, zip, { silent: true });
    }
    if (entry && !entry.forecastHours?.length) {
      entry = await refreshWeather(kind, zip, { force: true, silent: true });
    }

    const forecast =
      surface === "today" && entry?.current
        ? { request: weatherToRequest(entry, plannedRequest), period: entry.current, locationName: entry.locationName }
        : eventWeatherForRequest(entry, plannedRequest);
    if (!forecast) {
      setEventForecastStatus({ state: "manual", message: "Set conditions for this event." });
      showToast("Set conditions for this event");
      return null;
    }

    setRequest(forecast.request);
    if (items.length) setGeneratedOutfit(generateOutfit(items, forecast.request, outfitLocks));
    setEventForecastStatus({
      state: "ready",
      message: `${forecast.locationName} · ${forecast.period.tempF} F · ${forecast.period.rainPct}% rain`
    });
    showToast("Forecast applied");
    return forecast.request;
  }

  function removeItem(id) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (!window.confirm(`Remove ${item.name}?`)) return;
    if (starterItemIds.has(id)) {
      setSettings((current) => ({
        ...current,
        removedStarterIds: [...new Set([...(current.removedStarterIds ?? []), id])]
      }));
    }
    const nextItems = items.filter((candidate) => candidate.id !== id);
    setItems(nextItems);
    setGeneratedOutfit((current) => syncOutfitItems(current, nextItems));
    setOutfitLocks((current) =>
      Object.fromEntries(
        Object.entries(current)
          .map(([slot, itemIds]) => [slot, itemIds.filter((itemId) => itemId !== id)])
          .filter(([, itemIds]) => itemIds.length)
      )
    );
    setTodayOutfits((current) =>
      current.map((plan) => {
        const nextLocks = Object.fromEntries(
          Object.entries(plan.locks ?? {})
            .map(([slot, itemIds]) => [slot, itemIds.filter((itemId) => itemId !== id)])
            .filter(([, itemIds]) => itemIds.length)
        );
        return {
          ...plan,
          locks: nextLocks,
          outfit: syncOutfitItems(plan.outfit, nextItems)
        };
      })
    );
    showToast("Item removed");
  }

  function removeStarterWardrobe() {
    const starterIds = new Set(starterItemIds);
    const starterCount = items.filter((item) => starterIds.has(item.id)).length;
    if (!starterCount) return;
    if (!window.confirm(`Remove ${starterCount} starter items from this device?`)) return;

    const nextItems = items.filter((item) => !starterIds.has(item.id));
    const nextLocks = Object.fromEntries(
      Object.entries(outfitLocks)
        .map(([slot, itemIds]) => [slot, itemIds.filter((itemId) => !starterIds.has(itemId))])
        .filter(([, itemIds]) => itemIds.length)
    );
    setSettings((current) =>
      normalizeSettings({
        ...current,
        removedStarterIds: [...new Set([...(current.removedStarterIds ?? []), ...starterIds])]
      })
    );
    setItems(nextItems);
    setOutfitLocks(nextLocks);
    setGeneratedOutfit(generateOutfit(nextItems, requestWithKnownWeather(request, "planner"), nextLocks));
    setTodayOutfits((current) =>
      current.map((plan) => {
        const nextPlanLocks = Object.fromEntries(
          Object.entries(plan.locks ?? {})
            .map(([slot, itemIds]) => [slot, itemIds.filter((itemId) => !starterIds.has(itemId))])
            .filter(([, itemIds]) => itemIds.length)
        );
        const weatherRequest = requestWithKnownWeather(plan.request, "today");
        return {
          ...plan,
          request: weatherRequest,
          locks: nextPlanLocks,
          outfit: generateOutfit(nextItems, weatherRequest, nextPlanLocks)
        };
      })
    );
    showToast("Starter wardrobe removed");
  }

  function generateTodayOutfit(planId, nextRequest = null, nextLocks = null) {
    setTodayOutfits((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const locks = nextLocks ?? plan.locks ?? {};
        const weatherRequest = requestWithKnownWeather(nextRequest ?? plan.request, "today");
        return {
          ...plan,
          request: weatherRequest,
          locks,
          outfit: generateOutfit(items, weatherRequest, locks),
          lastWornDate: ""
        };
      })
    );
  }

  function updateTodayOutfitRequest(planId, patch) {
    setTodayOutfits((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const weatherRequest = requestWithKnownWeather({ ...plan.request, ...patch, avoidItemIds: [] }, "today");
        return {
          ...plan,
          request: weatherRequest,
          outfit: generateOutfit(items, weatherRequest, plan.locks ?? {}),
          lastWornDate: ""
        };
      })
    );
  }

  function addTodayOutfit() {
    setTodayOutfits((current) => {
      const index = current.length + 1;
      const previousRequest = current.at(-1)?.request ?? defaultTodayRequest(index);
      const nextPlan = createTodayOutfitPlan(index, {
        outfitCategory: previousRequest.outfitCategory,
        exposure: previousRequest.exposure,
        formality: previousRequest.formality,
        underused: previousRequest.underused,
        seed: index
      });
      const weatherRequest = requestWithKnownWeather(nextPlan.request, "today");
      return [
        ...current,
        {
          ...nextPlan,
          request: weatherRequest,
          outfit: generateOutfit(items, weatherRequest, nextPlan.locks)
        }
      ];
    });
  }

  function removeTodayOutfit(planId) {
    setTodayOutfits((current) => (current.length <= 1 ? current : current.filter((plan) => plan.id !== planId)));
  }

  function regenerateTodayOutfit(planId) {
    const plan = todayOutfits.find((candidate) => candidate.id === planId);
    if (!plan) return;
    generateTodayOutfit(
      planId,
      {
        ...plan.request,
        seed: (plan.request.seed ?? 1) + 1,
        avoidItemIds: unlockedOutfitItemIds(plan.outfit, plan.locks)
      },
      plan.locks ?? {}
    );
    showToast("Outfit regenerated");
  }

  function chooseTodayOutfitItem(planId, slot, itemId, options = {}) {
    setTodayOutfits((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const currentIds = selectionItems(plan.outfit?.selections ?? {}, slot).map((item) => item.id);
        const nextSlotIds = options.append ? [...currentIds.filter((id) => id !== itemId), itemId] : [itemId];
        const temporaryLocks = { ...(plan.locks ?? {}), [slot]: nextSlotIds };
        const weatherRequest = requestWithKnownWeather(plan.request, "today");
        return {
          ...plan,
          request: weatherRequest,
          outfit: generateOutfit(items, weatherRequest, temporaryLocks),
          lastWornDate: ""
        };
      })
    );
  }

  function changeTodayOutfitItem(planId, slot, index, itemId) {
    setTodayOutfits((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const currentIds = selectionItems(plan.outfit?.selections ?? {}, slot).map((item) => item.id);
        const replacedId = currentIds[index];
        const nextSlotIds = currentIds.length ? [...currentIds] : [itemId];
        nextSlotIds[index] = itemId;
        const dedupedSlotIds = nextSlotIds.filter((id, idIndex, ids) => id && ids.indexOf(id) === idIndex);
        const nextLocks = replaceLockedItem(plan.locks ?? {}, slot, replacedId, itemId);
        const temporaryLocks = { ...nextLocks, [slot]: dedupedSlotIds };
        const weatherRequest = requestWithKnownWeather(plan.request, "today");
        return {
          ...plan,
          request: weatherRequest,
          locks: nextLocks,
          outfit: generateOutfit(items, weatherRequest, temporaryLocks),
          lastWornDate: ""
        };
      })
    );
  }

  function removeTodayOutfitItem(planId, slot, itemId) {
    setTodayOutfits((current) =>
      current.map((plan) => {
        if (plan.id !== planId) return plan;
        const currentIds = selectionItems(plan.outfit?.selections ?? {}, slot).map((item) => item.id);
        const nextSlotIds = currentIds.filter((id) => id !== itemId);
        const nextLocks = setItemLock(plan.locks ?? {}, slot, itemId, false);
        const temporaryLocks = { ...nextLocks };
        if (nextSlotIds.length) temporaryLocks[slot] = nextSlotIds;
        else delete temporaryLocks[slot];
        const weatherRequest = requestWithKnownWeather(plan.request, "today");
        return {
          ...plan,
          request: weatherRequest,
          locks: nextLocks,
          outfit: generateOutfit(items, weatherRequest, temporaryLocks),
          lastWornDate: ""
        };
      })
    );
  }

  function toggleTodayOutfitItemLock(planId, slot, itemId, locked) {
    setTodayOutfits((current) =>
      current.map((plan) =>
        plan.id === planId ? { ...plan, locks: setItemLock(plan.locks ?? {}, slot, itemId, locked) } : plan
      )
    );
  }

  function markTodayOutfitWorn(planId, options = {}) {
    const plan = todayOutfits.find((candidate) => candidate.id === planId);
    const entries = outfitEntries(plan?.outfit?.selections);
    const uniqueEntries = entries.filter(([, item], index, list) => list.findIndex(([, candidate]) => candidate.id === item.id) === index);
    const wornIds = new Set(uniqueEntries.map(([, item]) => item.id));
    if (!plan || !wornIds.size) {
      showToast("Add outfit items first");
      return;
    }

    const wornDate = todayIso();
    const wornAt = new Date().toISOString();
    const markDirty = Boolean(options.markDirty);
    const nextItems = items.map((item) =>
      wornIds.has(item.id)
        ? {
            ...item,
            wears: Number(item.wears || 0) + 1,
            lastWorn: wornDate,
            laundry: markDirty ? "dirty" : item.laundry === "worn" ? "ready" : item.laundry
          }
        : item
    );
    const logs = uniqueEntries.map(([slot, item]) => ({
      id: makeId("wear"),
      itemId: item.id,
      slot,
      wornAt,
      wornDate,
      source: "today",
      markedDirty: markDirty,
      outfitId: plan.id,
      outfitLabel: plan.label,
      outfitRequest: { ...plan.request },
      itemSnapshot: {
        name: item.name,
        color: item.color,
        material: item.material,
        swatch: item.swatch
      }
    }));

    setItems(nextItems);
    setWearLogs((current) => [...logs, ...current]);
    setGeneratedOutfit((current) => syncOutfitItems(current, nextItems));
    setTodayOutfits((current) =>
      current.map((candidate) => ({
        ...candidate,
        outfit: syncOutfitItems(candidate.outfit, nextItems),
        lastWornDate: candidate.id === planId ? wornDate : candidate.lastWornDate
      }))
    );
    showToast(
      `${uniqueEntries.length} item${uniqueEntries.length === 1 ? "" : "s"} ${
        markDirty ? "logged and marked dirty" : "wear logged"
      }`
    );
  }

  function generateCurrentOutfit(nextRequest = request, nextLocks = outfitLocks, surface = "planner") {
    const weatherRequest = requestWithKnownWeather(nextRequest, surface);
    const outfit = generateOutfit(items, weatherRequest, nextLocks);
    setGeneratedOutfit(outfit);
    setRequest(weatherRequest);
  }

  function regenerateOutfit(surface = "planner") {
    generateCurrentOutfit(
      {
        ...request,
        seed: request.seed + 1,
        avoidItemIds: unlockedOutfitItemIds(generatedOutfit, outfitLocks)
      },
      outfitLocks,
      surface
    );
    showToast("Outfit regenerated");
  }

  function chooseOutfitItem(slot, itemId, options = {}) {
    const currentIds = selectionItems(generatedOutfit?.selections ?? {}, slot).map((item) => item.id);
    const nextSlotIds = options.append ? [...currentIds.filter((id) => id !== itemId), itemId] : [itemId];
    generateCurrentOutfit(request, { ...outfitLocks, [slot]: nextSlotIds }, options.surface ?? "planner");
  }

  function changeOutfitItem(slot, index, itemId, options = {}) {
    const currentIds = selectionItems(generatedOutfit?.selections ?? {}, slot).map((item) => item.id);
    const replacedId = currentIds[index];
    const nextSlotIds = currentIds.length ? [...currentIds] : [itemId];
    nextSlotIds[index] = itemId;
    const dedupedSlotIds = nextSlotIds.filter((id, idIndex, ids) => id && ids.indexOf(id) === idIndex);
    const nextLocks = replaceLockedItem(outfitLocks, slot, replacedId, itemId);
    setOutfitLocks(nextLocks);
    generateCurrentOutfit(request, { ...nextLocks, [slot]: dedupedSlotIds }, options.surface ?? "planner");
  }

  function removeOutfitItem(slot, itemId, surface = "planner") {
    const currentIds = selectionItems(generatedOutfit?.selections ?? {}, slot).map((item) => item.id);
    const nextSlotIds = currentIds.filter((id) => id !== itemId);
    const nextLocks = setItemLock(outfitLocks, slot, itemId, false);
    const temporaryLocks = { ...nextLocks };
    if (nextSlotIds.length) temporaryLocks[slot] = nextSlotIds;
    else delete temporaryLocks[slot];
    setOutfitLocks(nextLocks);
    generateCurrentOutfit(request, temporaryLocks, surface);
  }

  function toggleOutfitItemLock(slot, itemId, locked) {
    setOutfitLocks((current) => setItemLock(current, slot, itemId, locked));
  }

  function updatePlannerRequest(nextRequest, options = {}) {
    const surface = options.surface ?? "planner";
    const requestWithoutHistory = { ...nextRequest, avoidItemIds: [] };
    if (surface === "planner" && requestWithoutHistory.eventDate !== request.eventDate) {
      loadPlannerDate(requestWithoutHistory.eventDate, requestWithoutHistory);
      return;
    }
    if (options.generate) {
      generateCurrentOutfit(requestWithoutHistory, outfitLocks, surface);
      return;
    }
    setRequest(requestForSurface(requestWithoutHistory, surface));
  }

  function loadPlannerDate(date, fallbackRequest = request) {
    if (!parseDate(date)) return;
    const saved = outfitDays.find((day) => day.id === date)?.plannerPlan;
    if (saved) {
      const restored = restorePlannerPlan(saved, items, { ...fallbackRequest, eventDate: date });
      setRequest(requestForSurface({ ...restored.request, eventDate: date, avoidItemIds: [] }, "planner"));
      setOutfitLocks(restored.locks);
      setGeneratedOutfit(restored.outfit);
    } else {
      const nextRequest = requestWithKnownWeather(
        {
          ...fallbackRequest,
          eventDate: date,
          avoidItemIds: [],
          seed: Number(date.replaceAll("-", "")) % 100000
        },
        "planner"
      );
      setRequest(nextRequest);
      setOutfitLocks({});
      setGeneratedOutfit(generateOutfit(items, nextRequest));
    }
    setEventForecastStatus({ state: "idle", message: "" });
  }

  function openPlannerForDate(date) {
    loadPlannerDate(date, { ...request, eventDate: date });
    setView("planner");
  }

  function savePlannerPlan() {
    const date = request.eventDate;
    if (!parseDate(date) || !generatedOutfit) {
      showToast("Choose a date and outfit first");
      return;
    }
    setOutfitDays((current) =>
      upsertOutfitDay(current, date, {
        plannerPlan: serializePlannerPlan(request, outfitLocks, generatedOutfit),
        updatedAt: new Date().toISOString()
      })
    );
    showToast(`Plan saved for ${formatDay(date)}`);
  }

  function saveNewItem(event) {
    event.preventDefault();
    const item = normalizeItem(form);
    setItems((current) => [item, ...current]);
    setForm(freshItemTemplate());
    setView("inventory");
    showToast("Item saved");
  }

  function exportData() {
    const exportSettings = { ...settings };
    delete exportSettings.aiVision;
    delete exportSettings.aiApiKey;
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 5,
      items,
      wearLogs,
      outfitDays,
      settings: exportSettings,
      weatherCache
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wardrobe-export-${todayIso()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!Array.isArray(payload.items)) throw new Error("Import file must include an items array.");
    const importedItems = payload.items.map(normalizeItem);
    const importedWearLogs = Array.isArray(payload.wearLogs) ? payload.wearLogs : [];
    const importedOutfitDays = Array.isArray(payload.outfitDays) ? payload.outfitDays : [];
    const todayRecord = importedOutfitDays.find((day) => day.id === todayIso());
    const loggedTodayPlans = restoreTodayPlansFromWearLogs(importedWearLogs, importedItems);
    const importedTodayPlans = Array.isArray(todayRecord?.todayPlans) && todayRecord.todayPlans.length
      ? restoreTodayPlans(todayRecord.todayPlans, importedItems)
      : loggedTodayPlans.length
        ? loggedTodayPlans
        : [createTodayOutfitPlan(1)].map((plan) => ({
            ...plan,
            outfit: generateOutfit(importedItems, plan.request)
          }));
    const initialPlannerRequest = defaultPlannerRequest();
    const savedPlanner = importedOutfitDays.find((day) => day.id === initialPlannerRequest.eventDate)?.plannerPlan;
    const importedPlanner = savedPlanner
      ? restorePlannerPlan(savedPlanner, importedItems, initialPlannerRequest)
      : {
          request: initialPlannerRequest,
          locks: {},
          outfit: generateOutfit(importedItems, initialPlannerRequest)
        };
    setItems(importedItems);
    setWearLogs(importedWearLogs);
    setOutfitDays(importedOutfitDays);
    setTodayOutfits(importedTodayPlans);
    setRequest(importedPlanner.request);
    setOutfitLocks(importedPlanner.locks);
    setGeneratedOutfit(importedPlanner.outfit);
    setWeatherCache({ ...emptyWeatherCache, ...(payload.weatherCache ?? {}) });
    if (payload.settings) setSettings(normalizeSettings({ ...payload.settings, id: "main" }));
    showToast("Import complete");
  }

  async function installApp() {
    setInstallHelpOpen(true);
  }

  async function runInstallPrompt() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <div className="app-shell" {...componentMeta("AppShell")}>
      <Sidebar
        view={view}
        setView={setView}
        activeWeather={activeWeather}
        isInstalled={isInstalled}
        onInstall={installApp}
      />
      <div className="workspace">
        <main className="content-grid single">
          <section className="primary-pane" aria-label="Wardrobe workspace">
            {view === "dashboard" ? (
              <TodayView
                settings={settings}
                weatherCache={weatherCache}
                weatherStatus={weatherStatus}
                activeWeather={activeWeather}
                onUpdateWeatherSettings={updateWeatherSettings}
                onRefreshWeather={refreshWeather}
                outfits={todayOutfits}
                onAddOutfit={addTodayOutfit}
                onRemoveOutfit={removeTodayOutfit}
                onUpdateOutfitRequest={updateTodayOutfitRequest}
                onRegenerateOutfit={regenerateTodayOutfit}
                onChooseItem={chooseTodayOutfitItem}
                onChangeItem={changeTodayOutfitItem}
                onRemoveItem={removeTodayOutfitItem}
                onToggleItemLock={toggleTodayOutfitItemLock}
                onMarkWorn={markTodayOutfitWorn}
                allItems={items}
              />
            ) : null}
            {view === "calendar" ? (
              <CalendarView
                wearLogs={wearLogs}
                outfitDays={outfitDays}
                items={items}
                todayOutfits={todayOutfits}
                onOpenPlanner={openPlannerForDate}
                onOpenToday={() => setView("dashboard")}
              />
            ) : null}
            {view === "insights" ? (
              <InsightsView analytics={analytics} setFilters={setFilters} setQuery={setQuery} setView={setView} />
            ) : null}
            {view === "inventory" ? (
              <InventoryView
                items={visibleItems}
                allItems={items}
                query={query}
                setQuery={setQuery}
                filters={filters}
                setFilters={setFilters}
                sort={sort}
                setSort={setSort}
                onRemove={removeItem}
                onSaveItem={saveInventoryItem}
              />
            ) : null}
            {view === "planner" ? (
              <PlannerView
                request={request}
                setRequest={setRequest}
                onUpdateRequest={updatePlannerRequest}
                outfit={generatedOutfit}
                onRegenerate={() => regenerateOutfit("planner")}
                onChooseItem={chooseOutfitItem}
                onChangeItem={changeOutfitItem}
                onRemoveItem={removeOutfitItem}
                onToggleItemLock={toggleOutfitItemLock}
                lockedItems={outfitLocks}
                allItems={items}
                settings={settings}
                weatherCache={weatherCache}
                weatherStatus={weatherStatus}
                onRefreshWeather={refreshWeather}
                plannedEventLocation={plannerEventLocation}
                eventForecastStatus={eventForecastStatus}
                onFindEventForecast={() => applyEventForecast(request, "planner")}
                onSavePlan={savePlannerPlan}
              />
            ) : null}
            {view === "capture" ? (
              <CaptureView
                form={form}
                setForm={setForm}
                onSubmit={saveNewItem}
              />
            ) : null}
            {view === "settings" ? (
              <SettingsView
                settings={settings}
                onInstall={installApp}
                isInstalled={isInstalled}
                onExport={exportData}
                onImportClick={() => importRef.current?.click()}
                importRef={importRef}
                onImport={importData}
                onUpdateWeatherSettings={updateWeatherSettings}
                onRemoveStarterWardrobe={removeStarterWardrobe}
                starterItemCount={items.filter((item) => starterItemIds.has(item.id)).length}
              />
            ) : null}
          </section>

        </main>
      </div>
      {installHelpOpen ? (
        <InstallHelpDialog
          canPrompt={Boolean(installPrompt)}
          onPrompt={runInstallPrompt}
          onClose={() => setInstallHelpOpen(false)}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function Sidebar({
  view,
  setView,
  activeWeather,
  isInstalled,
  onInstall
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const nav = [
    { id: "dashboard", label: "Today", icon: CloudSun },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "planner", label: "Planner", icon: Wand2 },
    { id: "inventory", label: "Inventory", icon: Database },
    { id: "capture", label: "Add item", icon: ImagePlus },
    { id: "insights", label: "Insights", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings }
  ];
  const activeNav = nav.find((item) => item.id === view) ?? nav[0];

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  function chooseView(id) {
    setView(id);
    setMobileNavOpen(false);
  }

  return (
    <aside className="sidebar" aria-label="Wardrobe navigation" {...componentMeta("Sidebar")}>
      <div className="sidebar-header">
        <button className="brand-block brand-button" type="button" onClick={() => chooseView("dashboard")}>
          <div className="brand-mark" aria-hidden="true">
            <Shirt size={20} />
          </div>
          <div>
            <strong>Wardrobe</strong>
            <span>{activeWeather ? activeWeather.locationName : "Local wardrobe"}</span>
          </div>
        </button>

        <div className="mobile-nav" {...componentMeta("MobilePrimaryNav")}>
          <button
            className="mobile-nav-trigger"
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-primary-nav"
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            <Menu size={17} aria-hidden="true" />
            <span>{activeNav.label}</span>
            <ChevronRight className={mobileNavOpen ? "rotate-icon" : ""} size={15} aria-hidden="true" />
          </button>
          <nav id="mobile-primary-nav" className="mobile-nav-menu" hidden={!mobileNavOpen} aria-label="Primary navigation menu">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                className={view === id ? "nav-button active" : "nav-button"}
                key={id}
                onClick={() => chooseView(id)}
                type="button"
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ))}
          </nav>
        </div>
      </div>

      <nav className="nav-list" {...componentMeta("PrimaryNav")}>
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            className={view === id ? "nav-button active" : "nav-button"}
            key={id}
            onClick={() => chooseView(id)}
            type="button"
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <section className="sidebar-actions" aria-label="App actions" {...componentMeta("SidebarActions")}>
        {!isInstalled ? (
          <button className="icon-button" onClick={onInstall} type="button">
            <Plus size={16} aria-hidden="true" />
            <span>Install as App</span>
          </button>
        ) : null}
      </section>

      <section className="local-boundary" aria-label="Wardrobe status" {...componentMeta("StorageBoundary")}>
        <StatusChip tone="success" icon={Database}>
          Local only
        </StatusChip>
        <StatusChip tone={activeWeather ? "info" : "neutral"} icon={CloudSun}>
          {activeWeather ? `${activeWeather.current.tempF} F` : "Weather off"}
        </StatusChip>
      </section>
    </aside>
  );
}

function TodayView({
  settings,
  weatherCache,
  weatherStatus,
  activeWeather,
  onUpdateWeatherSettings,
  onRefreshWeather,
  outfits,
  onAddOutfit,
  onRemoveOutfit,
  onUpdateOutfitRequest,
  onRegenerateOutfit,
  onChooseItem,
  onChangeItem,
  onRemoveItem,
  onToggleItemLock,
  onMarkWorn,
  allItems
}) {
  return (
    <section className="today-stack" {...componentMeta("TodayView")}>
      <WeatherPanel
        settings={settings}
        weatherCache={weatherCache}
        weatherStatus={weatherStatus}
        activeWeather={activeWeather}
        onUpdateSettings={onUpdateWeatherSettings}
        onRefreshWeather={onRefreshWeather}
      />
      <section className="today-outfits" {...componentMeta("TodayOutfits")}>
        <div className="section-header today-outfits-header">
          <h1>Today</h1>
          <button className="primary-button" type="button" onClick={onAddOutfit}>
            <Plus size={16} aria-hidden="true" />
            Add outfit
          </button>
        </div>
        {outfits.map((plan, index) => (
          <TodayOutfitCard
            key={plan.id}
            plan={plan}
            index={index}
            canRemove={outfits.length > 1}
            onRemoveOutfit={onRemoveOutfit}
            onUpdateRequest={onUpdateOutfitRequest}
            onRegenerate={onRegenerateOutfit}
            onChooseItem={onChooseItem}
            onChangeItem={onChangeItem}
            onRemoveItem={onRemoveItem}
            onToggleItemLock={onToggleItemLock}
            onMarkWorn={onMarkWorn}
            allItems={allItems}
          />
        ))}
      </section>
    </section>
  );
}

function TodayOutfitCard({
  plan,
  index,
  canRemove,
  onRemoveOutfit,
  onUpdateRequest,
  onRegenerate,
  onChooseItem,
  onChangeItem,
  onRemoveItem,
  onToggleItemLock,
  onMarkWorn,
  allItems
}) {
  const selectedItems = outfitEntries(plan.outfit?.selections);
  const wornToday = plan.lastWornDate === todayIso();
  const [markDirty, setMarkDirty] = useState(false);

  return (
    <section className="panel outfit-panel today-outfit-card" {...componentMeta("TodayOutfitCard")}>
      <div className="panel-header">
        <div>
          <h1>{plan.label || `Outfit ${index + 1}`}</h1>
          <span className="panel-subtitle">{plan.outfit?.summary ?? "Outfit based on ready items."}</span>
        </div>
        <div className="panel-actions">
          <button className="secondary-button" type="button" onClick={() => onRegenerate(plan.id)}>
            <Shuffle size={16} aria-hidden="true" />
            Regenerate outfit
          </button>
          <div className="wear-action-group">
            <label className="checkbox-line compact-checkbox dirty-checkbox">
              <input
                type="checkbox"
                checked={markDirty}
                disabled={!selectedItems.length || wornToday}
                onChange={(event) => setMarkDirty(event.target.checked)}
              />
              Mark dirty
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedItems.length || wornToday}
              onClick={() => onMarkWorn(plan.id, { markDirty })}
            >
              <Check size={16} aria-hidden="true" />
              {wornToday ? "Logged today" : "Mark worn"}
            </button>
          </div>
          {canRemove ? (
            <button className="row-remove" type="button" aria-label={`Remove ${plan.label}`} onClick={() => onRemoveOutfit(plan.id)}>
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="today-outfit-controls outfit-preference-controls">
        <Select
          label="Category"
          value={plan.request.outfitCategory}
          onChange={(outfitCategory) => onUpdateRequest(plan.id, { outfitCategory })}
          options={outfitCategories.map((category) => category.id)}
        />
        <Select
          label="Plan for"
          value={plan.request.exposure}
          onChange={(exposure) => onUpdateRequest(plan.id, { exposure })}
          options={exposureOptions}
        />
        <FormalityField
          value={plan.request.formality}
          onChange={(formality) => onUpdateRequest(plan.id, { formality })}
        />
        <label className="checkbox-line preference-checkbox">
          <input
            type="checkbox"
            checked={plan.request.underused}
            onChange={(event) => onUpdateRequest(plan.id, { underused: event.target.checked })}
          />
          Prefer underused
        </label>
      </div>

      <OutfitBoard
        selections={plan.outfit?.selections ?? {}}
        alternatives={plan.outfit?.alternatives ?? {}}
        sockRecommendation={recommendSocks(plan.outfit?.selections, plan.request)}
        allItems={allItems}
        onChooseItem={(slot, itemId, options) => onChooseItem(plan.id, slot, itemId, options)}
        onChangeItem={(slot, itemIndex, itemId) => onChangeItem(plan.id, slot, itemIndex, itemId)}
        onRemoveItem={(slot, itemId) => onRemoveItem(plan.id, slot, itemId)}
        onToggleItemLock={(slot, itemId, locked) => onToggleItemLock(plan.id, slot, itemId, locked)}
        lockedItems={plan.locks ?? {}}
        surface="today"
      />
      <WeatherFitList entries={selectedItems} request={plan.request} />
      <div className="evidence-list">
        {(plan.outfit?.reasons ?? []).map((line) => (
          <div key={line}>
            <Check size={14} aria-hidden="true" />
            <span>{line}</span>
          </div>
        ))}
        {(plan.outfit?.missing ?? []).map((slot) => (
          <div key={slot} className="warning-line">
            <PackageSearch size={14} aria-hidden="true" />
            <span>Add a ready {slot}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCalendarDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function selectionsFromEntries(entries) {
  return entries.reduce((selections, [slot, item]) => {
    selections[slot] = [...(selections[slot] ?? []), item];
    return selections;
  }, {});
}

function CalendarOutfitSummary({ label, entries, request, status, timestamp }) {
  const selections = selectionsFromEntries(entries);
  const socks = request ? recommendSocks(selections, request) : null;
  const detail =
    status === "Worn" && timestamp
      ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp))
      : request
        ? `${labelFor(request.outfitCategory)} · ${labelFor(request.exposure ?? "mixed")}`
        : "Wear record";

  return (
    <section className="calendar-outfit-summary">
      <div className="calendar-outfit-heading">
        <div>
          <strong>{label}</strong>
          <span>{detail}</span>
        </div>
        <StatusChip tone={status === "Worn" ? "success" : "info"}>{status}</StatusChip>
      </div>
      <div className="calendar-outfit-items">
        {entries.map(([slot, item, index = 0]) => (
          <div key={`${slot}-${item.id}-${index}`}>
            <ItemVisual item={item} size="sm" />
            <span>
              <small>{index ? `${plannerSlotLabels[slot] ?? slot} ${index + 1}` : plannerSlotLabels[slot] ?? slot}</small>
              <strong>{item.name}</strong>
              <em>{item.color || "Color n/a"}</em>
            </span>
          </div>
        ))}
        {socks ? (
          <div>
            <SockIcon recommendation={socks} />
            <span>
              <small>Socks</small>
              <strong>{socks.name}</strong>
              <em>{socks.reason}</em>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CalendarView({ wearLogs, outfitDays, items, todayOutfits, onOpenPlanner, onOpenToday }) {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = parseDate(todayIso());
    return new Date(today.getFullYear(), today.getMonth(), 1, 12);
  });
  const dates = monthDates(visibleMonth);
  const daysByDate = new Map(outfitDays.map((day) => [day.date, day]));
  const wornDates = new Set(wearLogs.map((log) => log.wornDate).filter(Boolean));
  const plannedDates = new Set(
    outfitDays
      .filter((day) => day.plannerPlan || day.todayPlans?.some((plan) => plan.lastWornDate !== day.date))
      .map((day) => day.date)
  );
  const selectedRecord = daysByDate.get(selectedDate);
  const wornOutfits = wearOutfitsForDate(wearLogs, selectedDate, items);
  const savedTodayPlans =
    selectedDate === todayIso()
      ? todayOutfits.map((plan) => ({
          ...plan,
          entries: outfitEntries(plan.outfit?.selections)
        }))
      : (selectedRecord?.todayPlans ?? []).map((plan) => ({
          ...plan,
          entries: outfitEntries(resolveSavedSelections(plan, items))
        }));
  const unwornDayPlans = savedTodayPlans.filter((plan) => plan.lastWornDate !== selectedDate && plan.entries.length);
  const plannerPlan = selectedRecord?.plannerPlan;
  const plannerEntries = plannerPlan ? outfitEntries(resolveSavedSelections(plannerPlan, items)) : [];
  const isToday = selectedDate === todayIso();
  const isFuture = selectedDate > todayIso();

  function moveMonth(offset) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
  }

  function chooseDate(date) {
    setSelectedDate(date);
    const parsed = parseDate(date);
    if (parsed.getMonth() !== visibleMonth.getMonth() || parsed.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12));
    }
  }

  return (
    <section className="calendar-layout" {...componentMeta("CalendarView")}>
      <section className="panel calendar-panel" aria-label="Outfit calendar">
        <div className="calendar-toolbar">
          <button className="icon-only-button" type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h1>{formatMonthLabel(visibleMonth)}</h1>
          <button className="icon-only-button" type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {calendarWeekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-days">
          {dates.map((day) => {
            const worn = wornDates.has(day.date);
            const planned = plannedDates.has(day.date);
            const className = [
              "calendar-day",
              day.inMonth ? "" : "outside-month",
              day.date === selectedDate ? "selected" : "",
              day.date === todayIso() ? "today" : ""
            ].filter(Boolean).join(" ");
            return (
              <button
                className={className}
                type="button"
                key={day.date}
                aria-pressed={day.date === selectedDate}
                aria-label={`${formatCalendarDate(day.date)}${worn ? ", worn" : ""}${planned ? ", planned" : ""}`}
                onClick={() => chooseDate(day.date)}
              >
                <time dateTime={day.date}>{day.day}</time>
                <span className="calendar-day-status">
                  {worn ? <small className="worn">Worn</small> : null}
                  {planned ? <small className="planned">Plan</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel calendar-detail" aria-live="polite">
        <div className="panel-header">
          <div>
            <h1>{formatCalendarDate(selectedDate)}</h1>
            <span className="panel-subtitle">
              {wornOutfits.length ? `${wornOutfits.length} worn outfit${wornOutfits.length === 1 ? "" : "s"}` : isFuture ? "Future plan" : "No wear logged"}
            </span>
          </div>
          {isToday ? (
            <button className="secondary-button" type="button" onClick={onOpenToday}>
              <CloudSun size={16} aria-hidden="true" />
              Open Today
            </button>
          ) : isFuture ? (
            <button className="primary-button" type="button" onClick={() => onOpenPlanner(selectedDate)}>
              <Wand2 size={16} aria-hidden="true" />
              {plannerPlan ? "Open in Planner" : "Plan this day"}
            </button>
          ) : null}
        </div>

        <div className="calendar-detail-body">
          {wornOutfits.map((outfit) => (
            <CalendarOutfitSummary
              key={outfit.id}
              label={outfit.label}
              entries={outfit.entries.map((entry, index, entries) => [
                entry.slot,
                entry.item,
                entries.slice(0, index).filter((candidate) => candidate.slot === entry.slot).length
              ])}
              request={outfit.request}
              status="Worn"
              timestamp={outfit.wornAt}
            />
          ))}
          {plannerEntries.length ? (
            <CalendarOutfitSummary
              label="Planned outfit"
              entries={plannerEntries}
              request={plannerPlan.request}
              status="Planned"
            />
          ) : null}
          {unwornDayPlans.map((plan) => (
            <CalendarOutfitSummary
              key={plan.id}
              label={plan.label}
              entries={plan.entries}
              request={plan.request}
              status="Planned"
            />
          ))}
          {!wornOutfits.length && !plannerEntries.length && !unwornDayPlans.length ? (
            <div className="calendar-empty">
              <CalendarDays size={24} aria-hidden="true" />
              <strong>{isFuture ? "No outfit planned" : "Nothing recorded"}</strong>
              <span>{isFuture ? "Open this date in Planner to build and save an outfit." : "No outfit was logged for this date."}</span>
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function InsightsView({ analytics, setFilters, setQuery, setView }) {
  return (
    <section className="dashboard-stack" {...componentMeta("InsightsView")}>
      <ColorPalettePanel colors={analytics.colors} setFilters={setFilters} setQuery={setQuery} setView={setView} />

      <div className="dashboard-grid">
        <Panel title="Category value">
          <BarList rows={analytics.byCategory.map((row) => ({ ...row, label: labelFor(row.label), valueLabel: money(row.value) }))} valueKey="value" />
        </Panel>
        <Panel title="Season coverage">
          <BarList rows={analytics.bySeason} valueKey="count" />
        </Panel>
        <Panel title="Climate coverage">
          <BarList rows={analytics.byClimate} valueKey="count" />
        </Panel>
        <Panel title="Material mix">
          <BarList rows={analytics.byMaterial} valueKey="count" />
        </Panel>
        <Panel title="Brand coverage">
          <BrandCoverageList rows={analytics.byBrand} />
        </Panel>
        <Panel title="Laundry status">
          <BarList rows={analytics.byLaundry.map((row) => ({ ...row, label: labelFor(row.label) }))} valueKey="count" />
        </Panel>
        <Panel title="Formality value">
          <BarList
            rows={analytics.byFormality.map((row) => ({ ...row, label: `Level ${row.label}`, valueLabel: money(row.value) }))}
            valueKey="value"
          />
        </Panel>
      </div>

      <div className="dashboard-grid two">
        <Panel title="What to consider next" icon={ShoppingBag}>
          <ActionList rows={analytics.gaps} />
        </Panel>
        <Panel title="Underused value" icon={PackageSearch}>
          <ItemMiniList items={analytics.underused} suffix={(item) => `${item.wears} wears · ${money(item.cost)}`} />
        </Panel>
        <Panel title="Oldest pieces" icon={CalendarDays}>
          <ItemMiniList items={analytics.oldest} suffix={(item) => `${Math.round(ageMonths(item) / 12)} yr · condition ${item.condition}/5`} />
        </Panel>
        <Panel title="Care queue" icon={Archive}>
          <ItemMiniList items={analytics.careQueue} suffix={(item) => `${labelFor(item.laundry)} · condition ${item.condition}/5`} />
        </Panel>
      </div>
    </section>
  );
}

function formatHour(value) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(value));
}

function formatDay(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

function formatUpdated(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function WeatherPanel({
  settings,
  weatherCache,
  weatherStatus,
  activeWeather,
  onUpdateSettings,
  onRefreshWeather
}) {
  const [homeZip, setHomeZip] = useState(settings.homeZip ?? "");
  const [destinationZip, setDestinationZip] = useState(settings.destinationZip ?? "");
  const [collapsed, setCollapsed] = useState(false);
  const activeKind =
    settings.destinationEnabled && weatherCache.destination?.zip === activeWeather?.zip ? "destination" : "home";
  const expectedKind = settings.destinationEnabled && validZip(cleanZip(destinationZip || settings.destinationZip)) ? "destination" : "home";
  const expectedZip = expectedKind === "destination" ? cleanZip(destinationZip || settings.destinationZip) : cleanZip(homeZip || settings.homeZip);
  const hasExpectedZip = validZip(expectedZip);
  const forecastState =
    !hasExpectedZip
      ? {
          icon: CloudSun,
          title: "Add a home ZIP",
          detail: "Save a home ZIP to load current conditions."
        }
      : weatherStatus[expectedKind] === "error"
        ? {
            icon: CloudSun,
            title: "Forecast unavailable",
            detail: "Save the ZIP to try again."
          }
        : {
            icon: RefreshCcw,
            title: "Loading forecast",
            detail: "Checking current conditions."
          };
  const EmptyIcon = forecastState.icon;

  useEffect(() => setHomeZip(settings.homeZip ?? ""), [settings.homeZip]);
  useEffect(() => setDestinationZip(settings.destinationZip ?? ""), [settings.destinationZip]);

  async function saveHome(event) {
    event.preventDefault();
    const zip = cleanZip(homeZip);
    if (!validZip(zip)) {
      onRefreshWeather("home", zip, { force: true });
      return;
    }
    const forecast = await onRefreshWeather("home", zip, { force: true });
    if (forecast) onUpdateSettings({ homeZip: zip, weatherProvider: "nws" });
  }

  async function saveDestination(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const zip = cleanZip(destinationZip);
    if (!validZip(zip)) {
      onRefreshWeather("destination", zip, { force: true });
      return;
    }
    const forecast = await onRefreshWeather("destination", zip, { force: true });
    if (forecast) onUpdateSettings({ destinationZip: zip, destinationEnabled: true, weatherProvider: "nws" });
  }

  function toggleDestination(enabled) {
    onUpdateSettings({ destinationEnabled: enabled });
    const zip = cleanZip(destinationZip || settings.destinationZip);
    if (enabled && validZip(zip)) onRefreshWeather("destination", zip);
  }

  return (
    <section className={collapsed ? "weather-panel panel is-collapsed" : "weather-panel panel"} aria-label="Weather" {...componentMeta("WeatherPanel")}>
      <div className="panel-header compact">
        <div className="weather-heading">
          <h1>Weather</h1>
          {collapsed && activeWeather ? (
            <span>{activeWeather.locationName} · {activeWeather.current.tempF} F · {activeWeather.current.rainPct}% rain</span>
          ) : null}
        </div>
        <div className="panel-actions">
          <button
            className="secondary-button"
            type="button"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            <ChevronRight className={collapsed ? "" : "rotate-icon"} size={16} aria-hidden="true" />
            {collapsed ? "Expand" : "Collapse"}
          </button>
          {activeWeather ? (
            <button className="secondary-button" type="button" onClick={() => onRefreshWeather(activeKind, activeWeather.zip, { force: true })}>
              <RefreshCcw size={16} aria-hidden="true" />
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="weather-layout">
            <div className="weather-places">
              <form className="zip-form" onSubmit={saveHome}>
                <label>
                  Home ZIP
                  <input
                    inputMode="numeric"
                    value={homeZip}
                    maxLength="5"
                    onChange={(event) => setHomeZip(cleanZip(event.target.value))}
                    placeholder="01002"
                    pattern="[0-9]{5}"
                    autoComplete="postal-code"
                  />
                </label>
                <button
                  className="secondary-button"
                  type="submit"
                  aria-label="Save home ZIP"
                  disabled={weatherStatus.home === "loading"}
                >
                  <Home size={15} aria-hidden="true" />
                  {weatherStatus.home === "loading" ? "Updating" : "Save"}
                </button>
              </form>

              <label className="checkbox-line destination-toggle">
                <input
                  type="checkbox"
                  checked={settings.destinationEnabled}
                  onChange={(event) => toggleDestination(event.target.checked)}
                />
                Going somewhere
              </label>

              {settings.destinationEnabled ? (
                <form className="zip-form destination-zip-form" onSubmit={saveDestination}>
                  <label>
                    Trip ZIP
                    <input
                      inputMode="numeric"
                      value={destinationZip}
                      maxLength="5"
                      onChange={(event) => setDestinationZip(cleanZip(event.target.value))}
                      placeholder="10001"
                      required
                      aria-required="true"
                      pattern="[0-9]{5}"
                      autoComplete="postal-code"
                    />
                  </label>
                  <button
                    className="secondary-button"
                    type="submit"
                    aria-label="Save trip ZIP"
                    disabled={weatherStatus.destination === "loading"}
                  >
                    <Navigation size={15} aria-hidden="true" />
                    {weatherStatus.destination === "loading" ? "Updating" : "Save"}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="weather-main">
              {activeWeather ? (
                <WeatherLocationCard entry={activeWeather} active />
              ) : (
                <div className="weather-empty">
                  <EmptyIcon size={34} aria-hidden="true" />
                  <strong>{forecastState.title}</strong>
                  <span>{forecastState.detail}</span>
                </div>
              )}
            </div>
          </div>

          {settings.destinationEnabled ? (
            <div className="weather-secondary">
              {weatherCache.home?.current ? <WeatherLocationCard entry={weatherCache.home} label="Home" /> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function WeatherLocationCard({ entry, label, active = false }) {
  const hours = entry.restOfDay?.length ? entry.restOfDay : [];

  return (
    <section className={active ? "weather-card active" : "weather-card"} {...componentMeta("WeatherLocationCard")}>
      <div className="weather-card-top">
        <div>
          <span className="weather-label">{label ?? "Now"}</span>
          <h2>{entry.locationName}</h2>
          <small>{formatUpdated(entry.fetchedAt) ? `Updated ${formatUpdated(entry.fetchedAt)}` : ""}</small>
        </div>
        <div className="weather-temp">
          <strong>{entry.current.tempF}°</strong>
          <span>{entry.current.shortForecast}</span>
        </div>
      </div>

      <div className="weather-facts">
        <StatusChip tone="info" icon={Umbrella}>{entry.current.rainPct}% rain</StatusChip>
        <StatusChip tone="neutral" icon={Wind}>{entry.current.windMph} mph</StatusChip>
        <StatusChip tone="neutral" icon={Thermometer}>{entry.current.humidity}% humidity</StatusChip>
      </div>

      <div className="hourly-strip" aria-label="Rest of day">
        {hours.slice(0, 8).map((period) => (
          <div key={period.number}>
            <span>{formatHour(period.startTime)}</span>
            <strong>{period.tempF}°</strong>
            <small>{period.rainPct}% · {period.windMph} mph</small>
          </div>
        ))}
        {!hours.length ? <p className="muted compact-text">No more hourly periods today.</p> : null}
      </div>

      <div className="forecast-days">
        {entry.nextTwoDays?.map((day) => (
          <div key={day.date}>
            <span>{formatDay(day.date)}</span>
            <strong>{day.highF}° / {day.lowF}°</strong>
            <small>{day.rainPct}% rain · {day.summary}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel mini-panel" {...componentMeta(`Panel:${title}`)}>
      <div className="panel-title-row">
        <h1>{title}</h1>
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      </div>
      {children}
    </section>
  );
}

function BarList({ rows, valueKey }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div key={row.label} className="bar-row">
          <span>{row.label}</span>
          <div>
            <i style={{ width: `${(Number(row[valueKey] || 0) / max) * 100}%` }} />
          </div>
          <strong>{row.valueLabel ?? row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function BrandCoverageList({ rows }) {
  if (!rows.length) return <p className="muted compact-text">No brands recorded.</p>;

  return (
    <div className="brand-coverage-list">
      {rows.map((row) => (
        <div key={row.label}>
          <strong>{brandLabel(row.label)}</strong>
          <span>{row.count} items</span>
          <span>{money(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ColorPalettePanel({ colors, setFilters, setQuery, setView }) {
  const sorted = [...colors].sort(compareSwatches);
  const total = Math.max(1, sorted.reduce((sum, entry) => sum + entry.count, 0));
  let cursor = 0;
  const gradient = sorted.length
    ? sorted
        .map((entry) => {
          const start = (cursor / total) * 100;
          cursor += entry.count;
          const end = (cursor / total) * 100;
          return `${entry.swatch} ${start}% ${end}%`;
        })
        .join(", ")
    : "var(--color-panel) 0 100%";

  return (
    <div className="panel color-panel">
      <div className="panel-header">
        <div>
          <h1>Color palette</h1>
        </div>
      </div>
      <div className="color-pie-layout">
        <div className="color-pie" style={{ "--pie": gradient }} aria-label="Wardrobe colors" />
        <div className="palette-grid compact">
          {sorted.map((entry) => (
            <button
              key={`${entry.swatch}-${entry.color}`}
              className="palette-swatch"
              style={{ "--swatch": entry.swatch }}
              onClick={() => {
                setFilters(filterDefaults);
                setQuery(entry.color || "");
                setView("inventory");
              }}
              type="button"
            >
              <span />
              <strong>{entry.color || "Color"}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionList({ rows }) {
  if (!rows.length) {
    return <p className="muted compact-text">Coverage looks balanced.</p>;
  }

  return (
    <div className="action-list">
      {rows.map((row) => (
        <div key={row.label}>
          <strong>{row.label}</strong>
          <span>{row.reason}</span>
        </div>
      ))}
    </div>
  );
}

function ItemMiniList({ items, suffix }) {
  if (!items.length) {
    return <p className="muted compact-text">No items match.</p>;
  }

  return (
    <div className="mini-list">
      {items.map((item) => (
        <div key={item.id}>
          <ItemVisual item={item} size="sm" />
          <span>{item.name}</span>
          <small>{suffix(item)}</small>
        </div>
      ))}
    </div>
  );
}

function ImageFileButton({ label, icon: Icon = ImagePlus, capture = false, multiple = false, onSelect }) {
  return (
    <label className="secondary-button">
      <Icon size={16} aria-hidden="true" />
      {label}
      <input
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        onChange={(event) => {
          onSelect(event.target.files);
          event.target.value = "";
        }}
        hidden
      />
    </label>
  );
}

function ItemDetailModal({ item, onSave, onClose }) {
  const [draft, setDraft] = useState(() => normalizeItem(item));
  const titleId = `item-modal-title-${item.id}`;

  useEffect(() => {
    setDraft(normalizeItem(item));
  }, [item]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleOutfitTag(tag) {
    setDraft((current) => {
      const tags = current.outfitTags ?? [];
      return {
        ...current,
        outfitTags: tags.includes(tag) ? tags.filter((itemTag) => itemTag !== tag) : [...tags, tag]
      };
    });
  }

  function readImageFile(file, onReady) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onReady(String(reader.result));
    reader.readAsDataURL(file);
  }

  function updatePrimaryPhoto(file) {
    readImageFile(file, (dataUrl) => setField("imageDataUrl", dataUrl));
  }

  function addEvidencePhotos(fileList) {
    Array.from(fileList ?? []).forEach((file) => {
      readImageFile(file, (dataUrl) => {
        setDraft((current) => ({
          ...current,
          evidencePhotos: [
            ...(current.evidencePhotos ?? []),
            {
              id: makeId("photo"),
              role: "detail",
              dataUrl,
              capturedAt: new Date().toISOString()
            }
          ]
        }));
      });
    });
  }

  function updateEvidencePhoto(photoId, patch) {
    setDraft((current) => ({
      ...current,
      evidencePhotos: (current.evidencePhotos ?? []).map((photo) =>
        photo.id === photoId ? { ...photo, ...patch } : photo
      )
    }));
  }

  function removeEvidencePhoto(photoId) {
    setDraft((current) => ({
      ...current,
      evidencePhotos: (current.evidencePhotos ?? []).filter((photo) => photo.id !== photoId)
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave(draft);
    onClose();
  }

  return (
    <div
      className="modal-backdrop item-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form className="item-modal-form" onSubmit={handleSubmit}>
          <div className="item-modal-header">
            <div className="item-modal-title">
              <ItemVisual item={draft} size="md" />
              <div>
                <h1 id={titleId}>{draft.name || "Edit item"}</h1>
                <span>{draft.brand || "Unbranded"} · {draft.color || "Color n/a"} · {costPerWear(draft)}</span>
              </div>
            </div>
            <button className="row-remove" type="button" aria-label="Close item editor" onClick={onClose}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          <div className="item-modal-body">
            <section className="item-photo-editor" aria-label="Item photos">
              <div className="item-primary-photo">
                {draft.imageDataUrl ? (
                  <img src={draft.imageDataUrl} alt={draft.name ? `${draft.name} primary` : "Selected item"} />
                ) : (
                  <Camera size={34} aria-hidden="true" />
                )}
              </div>
              <div className="item-photo-actions">
                <strong>Primary photo</strong>
                <div>
                  <ImageFileButton
                    label="Take photo"
                    icon={Camera}
                    capture
                    onSelect={(files) => updatePrimaryPhoto(files?.[0])}
                  />
                  <ImageFileButton label="Choose photo" onSelect={(files) => updatePrimaryPhoto(files?.[0])} />
                  {draft.imageDataUrl ? (
                    <button className="secondary-button" type="button" onClick={() => setField("imageDataUrl", "")}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="evidence-photo-section">
                <div className="item-modal-section-header">
                  <strong>Extra images</strong>
                  <div className="photo-source-actions">
                    <ImageFileButton label="Take photo" icon={Camera} capture onSelect={addEvidencePhotos} />
                    <ImageFileButton label="Choose images" multiple onSelect={addEvidencePhotos} />
                  </div>
                </div>
                {draft.evidencePhotos?.length ? (
                  <div className="evidence-photo-grid">
                    {draft.evidencePhotos.map((photo) => (
                      <div className="evidence-photo-card" key={photo.id}>
                        <img className="evidence-photo-thumb" src={photo.dataUrl} alt="" />
                        <label>
                          Type
                          <select
                            value={photo.role}
                            onChange={(event) => updateEvidencePhoto(photo.id, { role: event.target.value })}
                          >
                            {evidencePhotoRoles.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="evidence-photo-actions">
                          <button
                            className="slot-action-button"
                            type="button"
                            onClick={() => setField("imageDataUrl", photo.dataUrl)}
                          >
                            Make primary
                          </button>
                          <button
                            className="row-remove"
                            type="button"
                            aria-label="Remove extra image"
                            onClick={() => removeEvidencePhoto(photo.id)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted compact-text">No extra images.</p>
                )}
              </div>
            </section>

            <div className="form-profile" {...componentMeta("ItemWeatherProfile")}>
              <strong>Weather profile</strong>
              <WeatherProfilePills item={draft} />
            </div>

            <fieldset>
              <legend>Identity</legend>
              <label>
                Name
                <input required value={draft.name} onChange={(event) => setField("name", event.target.value)} />
              </label>
              <Select label="Category" value={draft.category} onChange={(value) => setField("category", value)} options={categoryOptions} />
              <label>
                Subcategory
                <input value={draft.subcategory} onChange={(event) => setField("subcategory", event.target.value)} />
              </label>
              <label>
                Brand
                <input value={draft.brand} onChange={(event) => setField("brand", event.target.value)} />
              </label>
              <label>
                Size
                <input value={draft.size} onChange={(event) => setField("size", event.target.value)} />
              </label>
              <label>
                Color
                <input value={draft.color} onChange={(event) => setField("color", event.target.value)} />
              </label>
              <label>
                Swatch
                <input
                  type="color"
                  value={draft.swatch.startsWith("#") ? draft.swatch : "#176b73"}
                  onChange={(event) => setField("swatch", event.target.value)}
                />
              </label>
              <SelectWithCustom label="Pattern" value={draft.pattern} onChange={(value) => setField("pattern", value)} options={patternOptions} />
            </fieldset>

            <fieldset>
              <legend>Fabric and performance</legend>
              <SelectWithCustom label="Material" value={draft.material} onChange={(value) => setField("material", value)} options={materialOptions} />
              <NumberSelect label="Material %" value={draft.materialPct} onChange={(value) => setField("materialPct", value)} options={materialPctOptions} />
              <SelectWithCustom label="Fabric" value={draft.fabric} onChange={(value) => setField("fabric", value)} options={fabricOptions} />
              <SelectWithCustom label="Layer role" value={draft.layerRole} onChange={(value) => setField("layerRole", value)} options={layerRoleOptions} />
              <NumberSelect label="Warmth" value={draft.warmth} onChange={(value) => setField("warmth", value)} options={ratingOptions} />
              <NumberSelect label="Breathability" value={draft.breathability} onChange={(value) => setField("breathability", value)} options={ratingOptions} />
              <NumberSelect label="Rain" value={draft.rain} onChange={(value) => setField("rain", value)} options={ratingOptions} />
              <NumberSelect label="Wind" value={draft.wind} onChange={(value) => setField("wind", value)} options={ratingOptions} />
              <NumberSelect label="Formality" value={draft.formality} onChange={(value) => setField("formality", value)} options={oneToFiveOptions} />
              <NumberSelect label="Condition" value={draft.condition} onChange={(value) => setField("condition", value)} options={oneToFiveOptions} />
            </fieldset>

            <fieldset>
              <legend>Ownership</legend>
              <CostInput label="Cost USD" value={draft.cost} onChange={(value) => setField("cost", value)} options={costOptions} />
              <label>
                Acquired
                <input type="date" value={draft.acquired} onChange={(event) => setField("acquired", event.target.value)} />
              </label>
              <label>
                Times worn
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.wears}
                  onChange={(event) => setField("wears", Number(event.target.value || 0))}
                />
              </label>
              <label>
                Last worn
                <input type="date" value={draft.lastWorn} onChange={(event) => setField("lastWorn", event.target.value)} />
              </label>
              <Select label="Laundry" value={draft.laundry} onChange={(value) => setField("laundry", value)} options={laundryOptions} />
              <Select label="Status" value={draft.status} onChange={(value) => setField("status", value)} options={itemStatusOptions} />
              <label>
                Location
                <input value={draft.storageLocation} onChange={(event) => setField("storageLocation", event.target.value)} />
              </label>
              <label>
                Care
                <input value={draft.care} onChange={(event) => setField("care", event.target.value)} />
              </label>
              <label className="notes-field">
                Notes
                <textarea value={draft.notes} onChange={(event) => setField("notes", event.target.value)} />
              </label>
            </fieldset>

            <fieldset className="tag-fieldset">
              <legend>Seasons</legend>
              <ToggleGroup options={seasonOptions} values={draft.season ?? []} onChange={(value) => setField("season", value)} />
            </fieldset>

            <fieldset className="tag-fieldset">
              <legend>Weather</legend>
              <ToggleGroup options={climateOptions} values={draft.climate ?? []} onChange={(value) => setField("climate", value)} />
            </fieldset>

            <fieldset className="tag-fieldset">
              <legend>Outfits</legend>
              <div className="toggle-grid">
                {outfitCategories.map((category) => (
                  <label key={category.id} className="checkbox-line">
                    <input
                      checked={(draft.outfitTags ?? []).includes(category.id)}
                      type="checkbox"
                      onChange={() => toggleOutfitTag(category.id)}
                    />
                    {category.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="item-modal-footer">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Check size={16} aria-hidden="true" />
              Save item
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function InventoryView({
  items,
  allItems,
  query,
  setQuery,
  filters,
  setFilters,
  sort,
  setSort,
  onRemove,
  onSaveItem
}) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const selectedItem = allItems.find((candidate) => candidate.id === selectedItemId);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function sortBy(key) {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "asc" ? "desc" : "asc" }));
  }

  function clearFilters() {
    setFilters(filterDefaults);
    setQuery("");
  }

  const headers = [
    ["name", "Item"],
    ["brand", "Brand"],
    ["category", "Category"],
    ["size", "Size"],
    ["material", "Material"],
    ["climate", "Weather"],
    ["season", "Season"],
    ["formality", "Formality"],
    ["wears", "Wears"],
    ["costPerWear", "Cost/wear"],
    ["lastWorn", "Last worn"],
    ["laundry", "Laundry"]
  ];

  return (
    <section className="panel" {...componentMeta("InventoryView")}>
      <div className="panel-header">
        <div>
          <h1>Inventory</h1>
          <span className="panel-subtitle">{items.length} of {allItems.length}</span>
        </div>
        <button className="secondary-button" onClick={clearFilters} type="button">
          <X size={15} aria-hidden="true" />
          Clear filters
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map(([key, label]) => (
                <th key={key} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => sortBy(key)}>
                    {label}
                    <ArrowUpDown size={13} aria-hidden="true" />
                    {sort.key === key ? <span>{sort.dir === "asc" ? "Asc" : "Desc"}</span> : null}
                  </button>
                </th>
              ))}
              <th className="remove-column">Remove</th>
            </tr>
            <tr className="table-filter-row">
              <th>
                <div className="table-search">
                  <Search size={14} aria-hidden="true" />
                  <input aria-label="Search inventory" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
                </div>
              </th>
              <th>
                <input aria-label="Filter brand" value={filters.brand} onChange={(event) => updateFilter("brand", event.target.value)} placeholder="Brand" />
              </th>
              <th>
                <select aria-label="Filter category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
                  {["all", ...categoryOptions].map((option) => (
                    <option key={option} value={option}>{labelFor(option)}</option>
                  ))}
                </select>
              </th>
              <th>
                <input aria-label="Filter size" value={filters.size} onChange={(event) => updateFilter("size", event.target.value)} placeholder="Size" />
              </th>
              <th>
                <input aria-label="Filter material" value={filters.material} onChange={(event) => updateFilter("material", event.target.value)} placeholder="Material" />
              </th>
              <th>
                <select aria-label="Filter weather" value={filters.climate} onChange={(event) => updateFilter("climate", event.target.value)}>
                  {["all", ...climateOptions].map((option) => (
                    <option key={option} value={option}>{labelFor(option)}</option>
                  ))}
                </select>
              </th>
              <th>
                <select aria-label="Filter season" value={filters.season} onChange={(event) => updateFilter("season", event.target.value)}>
                  {["all", ...seasonOptions].map((option) => (
                    <option key={option} value={option}>{labelFor(option)}</option>
                  ))}
                </select>
              </th>
              <th>
                <select aria-label="Filter formality" value={filters.formality} onChange={(event) => updateFilter("formality", event.target.value)}>
                  {["all", "1", "2", "3", "4", "5"].map((option) => (
                    <option key={option} value={option}>{labelFor(option)}</option>
                  ))}
                </select>
              </th>
              <th />
              <th />
              <th />
              <th>
                <select aria-label="Filter laundry" value={filters.laundry} onChange={(event) => updateFilter("laundry", event.target.value)}>
                  {["all", ...laundryOptions].map((option) => (
                    <option key={option} value={option}>{labelFor(option)}</option>
                  ))}
                </select>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const profile = inferWeatherProfile(item);
              const selected = selectedItemId === item.id;
              return (
                <tr
                  className={selected ? "inventory-row selected" : "inventory-row"}
                  key={item.id}
                  tabIndex="0"
                  onClick={() => setSelectedItemId((current) => (current === item.id ? "" : item.id))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedItemId((current) => (current === item.id ? "" : item.id));
                    }
                  }}
                >
                  <td>
                    <div className="item-name-cell">
                      <ItemVisual item={item} size="sm" />
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.brand || "Unbranded"} · {item.color || "Color n/a"}</span>
                      </div>
                    </div>
                  </td>
                  <td>{brandLabel(item.brand)}</td>
                  <td>{labelFor(item.category)}</td>
                  <td>{item.size || "n/a"}</td>
                  <td>{item.material || "n/a"}</td>
                  <td>
                    <div className="compact-chip-row">
                      {profile.labels.slice(0, 2).map((label) => (
                        <StatusChip key={label} tone="info">{label}</StatusChip>
                      ))}
                    </div>
                  </td>
                  <td>{(item.season ?? []).map(labelFor).join(", ") || "n/a"}</td>
                  <td>{item.formality}/5</td>
                  <td>{item.wears || 0}</td>
                  <td>{costPerWear(item)}</td>
                  <td>{item.lastWorn || "never"}</td>
                  <td>
                    <StatusChip tone={item.laundry === "ready" ? "success" : "warning"}>{labelFor(item.laundry)}</StatusChip>
                  </td>
                  <td className="remove-cell">
                    <button
                      className="row-remove"
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(item.id);
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={headers.length + 1} className="empty-row">
                  No matching items.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selectedItem ? (
        <ItemDetailModal
          item={selectedItem}
          onSave={onSaveItem}
          onClose={() => setSelectedItemId("")}
        />
      ) : null}
    </section>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormalityField({ value, onChange }) {
  return (
    <label className="formality-field">
      <span className="field-label-row">
        <span>Formality</span>
        <output>{value}/5</output>
      </span>
      <input
        type="range"
        min="1"
        max="5"
        value={value}
        aria-label="Formality"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const plannerSlotLabels = {
  outerwear: "Outerwear",
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory"
};

function selectionItems(selections, slot) {
  const value = selections?.[slot];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function setItemLock(locks, slot, itemId, locked) {
  const next = { ...(locks ?? {}) };
  const currentIds = Array.isArray(next[slot]) ? next[slot] : next[slot] ? [next[slot]] : [];
  const nextIds = locked
    ? [...new Set([...currentIds, itemId])]
    : currentIds.filter((currentId) => currentId !== itemId);
  if (nextIds.length) next[slot] = nextIds;
  else delete next[slot];
  return next;
}

function replaceLockedItem(locks, slot, previousId, nextId) {
  const lockedIds = Array.isArray(locks?.[slot]) ? locks[slot] : locks?.[slot] ? [locks[slot]] : [];
  if (!previousId || !lockedIds.includes(previousId)) return locks ?? {};
  const withoutPrevious = setItemLock(locks, slot, previousId, false);
  return setItemLock(withoutPrevious, slot, nextId, true);
}

function outfitEntries(selections) {
  return Object.entries(selections ?? {}).flatMap(([slot, value]) =>
    (Array.isArray(value) ? value : [value]).filter(Boolean).map((item, index) => [slot, item, index])
  );
}

function unlockedOutfitItemIds(outfit, locks = {}) {
  const lockedIds = new Set(Object.values(locks).flatMap((value) => (Array.isArray(value) ? value : [value]).filter(Boolean)));
  return outfitEntries(outfit?.selections)
    .map(([, item]) => item.id)
    .filter((itemId) => !lockedIds.has(itemId));
}

function syncOutfitItems(outfit, nextItems) {
  if (!outfit) return outfit;
  const itemsById = new Map(nextItems.map((item) => [item.id, item]));
  const syncSelection = (value) =>
    (Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map((item) => itemsById.get(item.id))
      .filter(Boolean);
  const selections = Object.fromEntries(
    Object.entries(outfit.selections ?? {})
      .map(([slot, value]) => [slot, syncSelection(value)])
      .filter(([, selected]) => selected.length)
  );
  const alternatives = Object.fromEntries(
    Object.entries(outfit.alternatives ?? {}).map(([slot, alternativesForSlot]) => [
      slot,
      alternativesForSlot
        .map((candidate) => {
          const item = itemsById.get(candidate.item?.id);
          return item ? { ...candidate, item } : null;
        })
        .filter(Boolean)
    ])
  );
  return { ...outfit, selections, alternatives };
}

function PlannerWeatherCard({ label, entry, zip, active = false }) {
  const hasWeather = Boolean(entry?.current);

  return (
    <div className={active ? "planner-weather-card active" : "planner-weather-card"}>
      <div>
        <span>{label}</span>
        <strong>{hasWeather ? entry.locationName : zip ? `ZIP ${zip}` : "No ZIP set"}</strong>
      </div>
      {hasWeather ? (
        <div className="planner-weather-metrics">
          <StatusChip tone="info" icon={Thermometer}>{entry.current.tempF} F</StatusChip>
          <StatusChip tone="neutral" icon={Umbrella}>{entry.current.rainPct}% precip</StatusChip>
          <StatusChip tone="neutral" icon={Wind}>{entry.current.windMph} mph</StatusChip>
        </div>
      ) : (
        <span className="muted">No forecast loaded</span>
      )}
    </div>
  );
}

function PlannerWeatherLocations({ settings, weatherCache, request, plannedEventLocation, surface, eventForecastStatus }) {
  const secondary =
    surface === "today"
      ? settings?.destinationEnabled
        ? { label: "Trip", entry: weatherCache?.destination, zip: settings?.destinationZip, active: plannedEventLocation === "destination" }
        : null
      : request?.planLocationEnabled
        ? { label: "Planned location", entry: weatherCache?.plan, zip: request?.planZip, active: plannedEventLocation === "plan" }
        : null;

  return (
    <div className={`planner-weather-locations state-${eventForecastStatus?.state ?? "idle"}`}>
      <PlannerWeatherCard
        label="Home"
        entry={weatherCache?.home}
        zip={settings?.homeZip}
        active={plannedEventLocation === "home"}
      />
      {secondary ? (
        <PlannerWeatherCard
          label={secondary.label}
          entry={secondary.entry}
          zip={secondary.zip}
          active={secondary.active}
        />
      ) : null}
      {eventForecastStatus?.message ? (
        <div className="planner-weather-status">
          <MapPin size={15} aria-hidden="true" />
          <span>{eventForecastStatus.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function PlannerView({
  request,
  setRequest,
  onUpdateRequest,
  outfit,
  onRegenerate,
  onChooseItem,
  onChangeItem,
  onRemoveItem,
  onToggleItemLock,
  lockedItems,
  allItems,
  settings,
  weatherCache,
  weatherStatus,
  onRefreshWeather,
  plannedEventLocation,
  surface = "planner",
  eventForecastStatus,
  onFindEventForecast,
  onSavePlan
}) {
  const selectedItems = outfitEntries(outfit?.selections);
  const updateRequest = onUpdateRequest ?? setRequest;
  const updateAndGenerate = (patch) => updateRequest({ ...request, ...patch }, { generate: true, surface });
  const showPlanningFields = surface !== "today";

  async function savePlanLocation(event) {
    event.preventDefault();
    const zip = cleanZip(request.planZip);
    if (!validZip(zip)) {
      onRefreshWeather?.("plan", zip, { force: true });
      return;
    }
    const forecast = await onRefreshWeather?.("plan", zip, { force: true });
    if (forecast) {
      updateRequest(
        { ...request, planZip: zip, planLocationEnabled: true, eventLocation: "plan" },
        { generate: true, surface }
      );
    }
  }

  return (
    <section className="planner-grid" {...componentMeta("PlannerView")}>
      <div className="panel planner-control-panel" {...componentMeta("PlannerControls")}>
        <div className="panel-header compact">
          <div>
            <h1>Outfit planner</h1>
          </div>
          <div className="panel-actions">
            <button className="secondary-button" onClick={onRegenerate} type="button">
              <Shuffle size={16} aria-hidden="true" />
              Regenerate outfit
            </button>
            <button className="secondary-button" onClick={onFindEventForecast} type="button" disabled={eventForecastStatus?.state === "loading"}>
              <CloudSun size={16} aria-hidden="true" />
              {eventForecastStatus?.state === "loading" ? "Checking" : "Get forecast"}
            </button>
            <button className="primary-button" onClick={onSavePlan} type="button">
              <CalendarDays size={16} aria-hidden="true" />
              Save plan
            </button>
          </div>
        </div>
        <PlannerWeatherLocations
          settings={settings}
          weatherCache={weatherCache}
          request={request}
          plannedEventLocation={plannedEventLocation}
          surface={surface}
          eventForecastStatus={eventForecastStatus}
        />
        <div className="planner-schedule-controls">
          {showPlanningFields ? (
            <>
              <label>
                Date planned
                <input
                  type="date"
                  min={todayIso()}
                  value={request.eventDate}
                  onChange={(event) => updateRequest({ ...request, eventDate: event.target.value }, { surface })}
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={request.eventTime}
                  onChange={(event) => updateRequest({ ...request, eventTime: event.target.value }, { surface })}
                />
              </label>
              <form className="planner-location-form" onSubmit={savePlanLocation}>
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={request.planLocationEnabled}
                    onChange={(event) =>
                      updateAndGenerate({
                        planLocationEnabled: event.target.checked,
                        eventLocation: event.target.checked && validZip(request.planZip) ? "plan" : "home"
                      })
                    }
                  />
                  Going somewhere
                </label>
                {request.planLocationEnabled ? (
                  <>
                    <label>
                      Trip ZIP
                      <input
                        inputMode="numeric"
                        value={request.planZip}
                        maxLength="5"
                        onChange={(event) =>
                          updateRequest({ ...request, planZip: cleanZip(event.target.value) }, { surface })
                        }
                        placeholder="10001"
                        required
                        aria-required="true"
                        pattern="[0-9]{5}"
                        autoComplete="postal-code"
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="submit"
                      aria-label="Save trip ZIP"
                      disabled={weatherStatus?.plan === "loading"}
                    >
                      <Navigation size={15} aria-hidden="true" />
                      {weatherStatus?.plan === "loading" ? "Updating" : "Save"}
                    </button>
                  </>
                ) : null}
              </form>
            </>
          ) : null}
        </div>
        <div className="outfit-preference-controls planner-preference-controls">
          <Select
            label="Category"
            value={request.outfitCategory}
            onChange={(outfitCategory) => updateAndGenerate({ outfitCategory })}
            options={outfitCategories.map((category) => category.id)}
          />
          <Select
            label="Plan for"
            value={request.exposure}
            onChange={(exposure) => updateAndGenerate({ exposure })}
            options={exposureOptions}
          />
          <FormalityField
            value={request.formality}
            onChange={(formality) => updateAndGenerate({ formality })}
          />
          <label className="checkbox-line preference-checkbox">
            <input
              type="checkbox"
              checked={request.underused}
              onChange={(event) => updateAndGenerate({ underused: event.target.checked })}
            />
            Prefer underused
          </label>
        </div>
      </div>

      <div className="panel outfit-panel" {...componentMeta("OutfitPanel")}>
        <div className="panel-header">
          <div>
            <h1>Recommended outfit</h1>
            <span className="panel-subtitle">{outfit?.summary ?? "Outfit"}</span>
          </div>
        </div>
        <OutfitBoard
          selections={outfit?.selections ?? {}}
          alternatives={outfit?.alternatives ?? {}}
          sockRecommendation={recommendSocks(outfit?.selections, request)}
          allItems={allItems}
          onChooseItem={onChooseItem}
          onChangeItem={onChangeItem}
          onRemoveItem={onRemoveItem}
          onToggleItemLock={onToggleItemLock}
          lockedItems={lockedItems}
          surface={surface}
        />
        <WeatherFitList entries={selectedItems} request={request} />
        <div className="evidence-list">
          {(outfit?.reasons ?? []).map((line) => (
            <div key={line}>
              <Check size={14} aria-hidden="true" />
              <span>{line}</span>
            </div>
          ))}
          {(outfit?.missing ?? []).map((slot) => (
            <div key={slot} className="warning-line">
              <PackageSearch size={14} aria-hidden="true" />
              <span>Add a ready {slot}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NumberSelect({ label, value, onChange, options }) {
  const hasCurrentValue = options.some((option) => Number(optionValue(option)) === Number(value));
  const displayedOptions =
    hasCurrentValue || value === "" || value === null || value === undefined
      ? options
      : [
          {
            value,
            label: label.toLowerCase().includes("cost") ? money(value) : String(value)
          },
          ...options
        ];

  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {displayedOptions.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)}>
            {labelFor(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CostInput({ label, value, onChange, options }) {
  const listId = useId();
  const [text, setText] = useState(() => formatCostInputValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setText(formatCostInputValue(value));
  }, [isFocused, value]);

  function commit(nextText) {
    const parsed = parseCostInputValue(nextText);
    const nextValue = parsed ?? 0;
    onChange(nextValue);
    setText(formatCostInputValue(nextValue));
  }

  return (
    <label>
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        list={listId}
        value={text}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          const parsed = parseCostInputValue(nextText);
          onChange(parsed ?? "");
        }}
        onBlur={() => {
          setIsFocused(false);
          commit(text);
        }}
        onKeyDown={(event) => {
          if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={optionValue(option)} value={optionValue(option)} label={labelFor(option)} />
        ))}
      </datalist>
    </label>
  );
}

function parseCostInputValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function formatCostInputValue(value) {
  const parsed = parseCostInputValue(value);
  if (parsed === null) return "";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function SelectWithCustom({ label, value, onChange, options }) {
  const [customOpen, setCustomOpen] = useState(false);
  const normalizedOptions = options.map((option) => (typeof option === "object" ? option : { value: option, label: option }));
  const hasOption = normalizedOptions.some((option) => String(option.value).toLowerCase() === String(value).toLowerCase());
  const useCustom = customOpen || Boolean(value && !hasOption);

  return (
    <label className="select-custom-field">
      {label}
      <select
        value={useCustom ? "__custom__" : value}
        onChange={(event) => {
          if (event.target.value === "__custom__") {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          onChange(event.target.value);
        }}
      >
        <option value="">Select</option>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value="__custom__">Add new...</option>
      </select>
      {useCustom ? (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`New ${label.toLowerCase()}`}
        />
      ) : null}
    </label>
  );
}

function SockIcon({ recommendation }) {
  const tall = recommendation?.length === "tall";
  return (
    <div className="sock-icon" style={{ "--sock-color": recommendation?.swatch ?? "#858b90" }} aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">
        <path
          d={tall ? "M13 5h18v19c0 4 2 6 6 7l7 3v7H29c-10 0-16-6-16-16Z" : "M13 16h18v8c0 4 2 6 6 7l7 3v7H29c-10 0-16-6-16-16Z"}
        />
        <path d={tall ? "M14 10h16" : "M14 21h16"} className="sock-cuff" />
      </svg>
    </div>
  );
}

function OutfitBoard({
  selections,
  alternatives = {},
  sockRecommendation,
  allItems = [],
  onChooseItem,
  onChangeItem,
  onRemoveItem,
  onToggleItemLock,
  lockedItems = {},
  surface = "planner"
}) {
  const slots = [
    ["outerwear", "Outerwear"],
    ["top", "Top"],
    ["bottom", "Bottom"],
    ["shoes", "Shoes"],
    ["accessory", "Accessory"]
  ];
  const [picker, setPicker] = useState(null);
  const [queries, setQueries] = useState({});

  function setSlotQuery(slot, value) {
    setQueries((current) => ({ ...current, [slot]: value }));
  }

  function openPicker(slot, mode, index = 0) {
    setPicker((current) =>
      current?.slot === slot && current.mode === mode && current.index === index
        ? null
        : { slot, mode, index }
    );
  }

  function chooseFromPicker(slot, itemId) {
    if (picker?.mode === "replace") {
      onChangeItem?.(slot, picker.index, itemId, { surface });
    } else {
      onChooseItem?.(slot, itemId, { append: true, surface });
    }
    setPicker(null);
  }

  return (
    <div className="outfit-board" aria-label="Outfit preview" {...componentMeta("OutfitBoard")}>
      {slots.map(([slot, label]) => {
        const items = selectionItems(selections, slot);
        const slotPickerOpen = picker?.slot === slot;
        const excludeIds = items.map((item) => item.id);
        const lockedIds = selectionItems(lockedItems, slot);
        return (
          <div key={slot} className={`outfit-slot slot-${slot}`}>
            <span>{label}</span>
            {items.length ? (
              <div className="outfit-slot-items">
                {items.map((item, index) => (
                  <div
                    key={`${slot}-${item.id}-${index}`}
                    className={lockedIds.includes(item.id) ? "outfit-slot-item is-locked" : "outfit-slot-item"}
                  >
                    <ItemVisual item={item} size="lg" />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.color} · {item.material}</small>
                    </div>
                    <div className="slot-item-actions">
                      <label className="slot-lock-toggle">
                        <input
                          type="checkbox"
                          checked={lockedIds.includes(item.id)}
                          onChange={(event) => onToggleItemLock?.(slot, item.id, event.target.checked)}
                        />
                        Lock
                      </label>
                      <button
                        className="slot-action-button"
                        type="button"
                        onClick={() => openPicker(slot, "replace", index)}
                      >
                        Change
                      </button>
                      {items.length > 1 ? (
                        <button
                          className="row-remove"
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => onRemoveItem?.(slot, item.id, surface)}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button className="slot-add-button" type="button" onClick={() => openPicker(slot, "append")}>
                  <Plus size={14} aria-hidden="true" />
                  Add another
                </button>
              </div>
            ) : (
              <div className="outfit-slot-empty">
                <em>Open</em>
                <button className="slot-add-button" type="button" onClick={() => openPicker(slot, "append")}>
                  <Plus size={14} aria-hidden="true" />
                  Add {label.toLowerCase()}
                </button>
              </div>
            )}
            {slotPickerOpen ? (
              <SlotPicker
                slot={slot}
                title={`${picker.mode === "replace" ? "Change" : "Add"} ${plannerSlotLabels[slot] ?? slot}`}
                query={queries[slot] ?? ""}
                setQuery={(value) => setSlotQuery(slot, value)}
                allItems={allItems}
                candidates={alternatives[slot] ?? []}
                excludeIds={excludeIds}
                onChooseItem={(itemId) => chooseFromPicker(slot, itemId)}
                onCancel={() => setPicker(null)}
              />
            ) : null}
          </div>
        );
      })}
      <div className="outfit-slot slot-socks">
        <span>Socks</span>
        {sockRecommendation ? (
          <div className="sock-recommendation" aria-label={`Sock recommendation: ${sockRecommendation.name}`}>
            <SockIcon recommendation={sockRecommendation} />
            <div>
              <strong>{sockRecommendation.name}</strong>
              <small>{sockRecommendation.reason}</small>
            </div>
          </div>
        ) : (
          <div className="outfit-slot-empty">
            <em>Add shoes to get a sock match.</em>
          </div>
        )}
      </div>
    </div>
  );
}

function WeatherFitList({ entries, request }) {
  if (!entries.length) return null;

  return (
    <div className="weather-fit-list" {...componentMeta("WeatherFitList")}>
      {entries.map(([slot, item, index]) => {
        const fit = itemWeatherFit(item, request);
        const notes = [...fit.strengths, ...fit.cautions];
        return (
          <div key={`${slot}-${item.id}-${index}`}>
            <span>{index ? `${slot} ${index + 1}` : slot}</span>
            <strong>{fit.label}</strong>
            <meter min="0" max="100" value={fit.score} aria-label={`${item.name} weather fit ${fit.score} out of 100`} />
            <small>{notes.length ? notes.join(" · ") : inferWeatherProfile(item).labels.join(" · ")}</small>
          </div>
        );
      })}
    </div>
  );
}

function WeatherProfilePills({ item }) {
  const profile = inferWeatherProfile(item);
  return (
    <div className="profile-pills" {...componentMeta("WeatherProfilePills")}>
      {profile.labels.map((label) => (
        <StatusChip key={label} tone="info">
          {label}
        </StatusChip>
      ))}
    </div>
  );
}

function SlotPicker({ slot, title, query, setQuery, allItems, candidates, excludeIds = [], onChooseItem, onCancel }) {
  const normalizedQuery = query.trim().toLowerCase();
  const excluded = new Set(excludeIds);
  const selectedRecommended = new Set(candidates.map(({ item }) => item.id));
  const matches = allItems
    .filter((item) => item.status === "active" && matchesOutfitSlot(item, slot) && !excluded.has(item.id))
    .filter((item) => {
      if (!normalizedQuery) return true;
      return [item.name, item.brand, item.color, item.material, item.subcategory]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    })
    .slice(0, 8);
  const recommended = candidates
    .map(({ item }) => item)
    .filter((item) => !excluded.has(item.id))
    .filter((item) => !normalizedQuery || matches.some((match) => match.id === item.id));
  const otherMatches = matches.filter((item) => !selectedRecommended.has(item.id));
  const rows = [...recommended, ...otherMatches].slice(0, 8);

  return (
    <div className="slot-picker">
      <div className="slot-picker-header">
        <strong>{title}</strong>
        <button type="button" onClick={onCancel}>
          <X size={14} aria-hidden="true" />
          Cancel
        </button>
      </div>
      <div className="table-search">
        <Search size={14} aria-hidden="true" />
        <input
          aria-label={`Search ${plannerSlotLabels[slot] ?? slot}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${plannerSlotLabels[slot] ?? slot}`}
        />
      </div>
      <div className="slot-picker-results">
        {rows.map((item) => (
          <button key={item.id} type="button" onClick={() => onChooseItem(item.id)}>
            <ItemVisual item={item} size="sm" />
            <span>{item.name}</span>
            <small>{item.color || item.material || labelFor(item.category)}</small>
          </button>
        ))}
        {!rows.length ? <p className="muted compact-text">No matching items.</p> : null}
      </div>
    </div>
  );
}

function CaptureView({ form, setForm, onSubmit }) {
  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTag(tag) {
    setForm((current) => {
      const exists = current.outfitTags.includes(tag);
      return {
        ...current,
        outfitTags: exists ? current.outfitTags.filter((item) => item !== tag) : [...current.outfitTags, tag]
      };
    });
  }

  function readImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setField("imageDataUrl", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="panel" {...componentMeta("CaptureView")}>
      <div className="panel-header">
        <div>
          <h1>Add item</h1>
        </div>
      </div>
      <form className="capture-form" onSubmit={onSubmit}>
        <div
          className="image-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            readImage(event.dataTransfer.files?.[0]);
          }}
        >
          <div className="image-preview">
            {form.imageDataUrl ? <img src={form.imageDataUrl} alt="" /> : <Camera size={30} aria-hidden="true" />}
          </div>
          <div className="image-actions">
            <ImageFileButton label="Take photo" icon={Camera} capture onSelect={(files) => readImage(files?.[0])} />
            <ImageFileButton label="Choose photo" onSelect={(files) => readImage(files?.[0])} />
            {form.imageDataUrl ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setField("imageDataUrl", "");
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        <div className="form-profile" {...componentMeta("CaptureWeatherProfile")}>
          <strong>Weather profile</strong>
          <WeatherProfilePills item={form} />
        </div>

        <fieldset>
          <legend>Identity</legend>
          <label>
            Name
            <input required value={form.name} onChange={(event) => setField("name", event.target.value)} />
          </label>
          <Select label="Category" value={form.category} onChange={(value) => setField("category", value)} options={categoryOptions} />
          <label>
            Subcategory
            <input value={form.subcategory} onChange={(event) => setField("subcategory", event.target.value)} />
          </label>
          <label>
            Brand
            <input value={form.brand} onChange={(event) => setField("brand", event.target.value)} />
          </label>
          <label>
            Size
            <input value={form.size} onChange={(event) => setField("size", event.target.value)} />
          </label>
          <label>
            Color
            <input value={form.color} onChange={(event) => setField("color", event.target.value)} />
          </label>
          <label>
            Swatch
            <input
              type="color"
              value={form.swatch.startsWith("#") ? form.swatch : "#176b73"}
              onChange={(event) => setField("swatch", event.target.value)}
            />
          </label>
          <SelectWithCustom label="Pattern" value={form.pattern} onChange={(value) => setField("pattern", value)} options={patternOptions} />
        </fieldset>

        <fieldset>
          <legend>Fabric and performance</legend>
          <SelectWithCustom label="Material" value={form.material} onChange={(value) => setField("material", value)} options={materialOptions} />
          <NumberSelect label="Material %" value={form.materialPct} onChange={(value) => setField("materialPct", value)} options={materialPctOptions} />
          <SelectWithCustom label="Fabric" value={form.fabric} onChange={(value) => setField("fabric", value)} options={fabricOptions} />
          <SelectWithCustom label="Layer role" value={form.layerRole} onChange={(value) => setField("layerRole", value)} options={layerRoleOptions} />
          <NumberSelect label="Warmth" value={form.warmth} onChange={(value) => setField("warmth", value)} options={ratingOptions} />
          <NumberSelect label="Breathability" value={form.breathability} onChange={(value) => setField("breathability", value)} options={ratingOptions} />
          <NumberSelect label="Rain" value={form.rain} onChange={(value) => setField("rain", value)} options={ratingOptions} />
          <NumberSelect label="Wind" value={form.wind} onChange={(value) => setField("wind", value)} options={ratingOptions} />
          <NumberSelect label="Formality" value={form.formality} onChange={(value) => setField("formality", value)} options={oneToFiveOptions} />
          <NumberSelect label="Condition" value={form.condition} onChange={(value) => setField("condition", value)} options={oneToFiveOptions} />
        </fieldset>

        <fieldset>
          <legend>Ownership</legend>
          <CostInput label="Cost USD" value={form.cost} onChange={(value) => setField("cost", value)} options={costOptions} />
          <NumberSelect label="Times worn" value={form.wears} onChange={(value) => setField("wears", value)} options={wearCountOptions} />
          <label>
            Acquired
            <input type="date" value={form.acquired} onChange={(event) => setField("acquired", event.target.value)} />
          </label>
          <Select label="Laundry" value={form.laundry} onChange={(value) => setField("laundry", value)} options={laundryOptions} />
          <label>
            Location
            <input value={form.storageLocation} onChange={(event) => setField("storageLocation", event.target.value)} />
          </label>
          <label>
            Care
            <input value={form.care} onChange={(event) => setField("care", event.target.value)} />
          </label>
          <label className="notes-field">
            Notes
            <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
          </label>
        </fieldset>

        <fieldset className="tag-fieldset">
          <legend>Seasons</legend>
          <ToggleGroup options={seasonOptions} values={form.season} onChange={(value) => setField("season", value)} />
        </fieldset>

        <fieldset className="tag-fieldset">
          <legend>Weather</legend>
          <ToggleGroup options={climateOptions} values={form.climate} onChange={(value) => setField("climate", value)} />
        </fieldset>

        <fieldset className="tag-fieldset">
          <legend>Outfits</legend>
          <div className="toggle-grid">
            {outfitCategories.map((category) => (
              <label key={category.id} className="checkbox-line">
                <input checked={form.outfitTags.includes(category.id)} type="checkbox" onChange={() => toggleTag(category.id)} />
                {category.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            <Plus size={16} aria-hidden="true" />
            Save item
          </button>
          <button className="secondary-button" type="button" onClick={() => setForm(freshItemTemplate())}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}

function InstallHelpDialog({ canPrompt, onPrompt, onClose }) {
  const userAgent = window.navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(userAgent);
  const steps = isIos
    ? ["Tap Share in Safari.", "Choose Add to Home Screen.", "Confirm the name and tap Add."]
    : isAndroid
      ? ["Open the browser menu.", "Choose Install app or Add to Home screen.", "Confirm the install."]
      : ["Use this browser's install button when it appears.", "If it is not available, open the browser menu.", "Choose Install app or Create shortcut."];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <div className="panel-header compact">
          <div>
            <h1 id="install-title">Install Wardrobe as an app</h1>
            <span className="panel-subtitle">Open it from your home screen with your wardrobe saved locally.</span>
          </div>
          <button className="row-remove" type="button" aria-label="Close install guide" onClick={onClose}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="install-steps">
          {canPrompt ? (
            <button className="primary-button" type="button" onClick={onPrompt}>
              <Plus size={16} aria-hidden="true" />
              Install now
            </button>
          ) : null}
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function SettingsView({
  settings,
  onInstall,
  isInstalled,
  onExport,
  onImportClick,
  importRef,
  onImport,
  onUpdateWeatherSettings,
  onRemoveStarterWardrobe,
  starterItemCount
}) {
  return (
    <section className="settings-grid" {...componentMeta("SettingsView")}>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h1>App</h1>
          </div>
        </div>
        <div className="settings-list">
          {!isInstalled ? (
            <button className="primary-button" onClick={onInstall} type="button">
              <Plus size={16} aria-hidden="true" />
              Install as App
            </button>
          ) : null}
          <button className="secondary-button" onClick={onExport} type="button">
            <Download size={16} aria-hidden="true" />
            Export
          </button>
          <button className="secondary-button" onClick={onImportClick} type="button">
            <Upload size={16} aria-hidden="true" />
            Import
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json"
            onChange={(event) => onImport(event.target.files?.[0]).catch((error) => alert(error.message))}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h1>Weather</h1>
          </div>
        </div>
        <div className="settings-list">
          <label>
            Home ZIP
            <input
              inputMode="numeric"
              maxLength="5"
              value={settings.homeZip}
              onChange={(event) => onUpdateWeatherSettings({ homeZip: cleanZip(event.target.value), weatherProvider: "nws" })}
            />
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={settings.destinationEnabled}
              onChange={(event) => onUpdateWeatherSettings({ destinationEnabled: event.target.checked })}
            />
            Going somewhere
          </label>
          <label>
            Trip ZIP
            <input
              inputMode="numeric"
              maxLength="5"
              value={settings.destinationZip}
              onChange={(event) => onUpdateWeatherSettings({ destinationZip: cleanZip(event.target.value), weatherProvider: "nws" })}
              required={settings.destinationEnabled}
              aria-required={settings.destinationEnabled}
              pattern="[0-9]{5}"
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h1>Starter wardrobe</h1>
            <span className="panel-subtitle">{starterItemCount} sample items on this device</span>
          </div>
        </div>
        <div className="settings-list">
          <button
            className="secondary-button danger-action"
            type="button"
            onClick={onRemoveStarterWardrobe}
            disabled={!starterItemCount}
          >
            <Trash2 size={16} aria-hidden="true" />
            {starterItemCount ? "Remove starter wardrobe" : "Starter wardrobe removed"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default App;
