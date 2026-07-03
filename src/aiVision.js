export const aiVisionProviderOptions = [
  { value: "off", label: "Off" },
  { value: "wardrobe", label: "Wardrobe Vision API" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Claude" },
  { value: "google", label: "Google" }
];

export const defaultAiVisionSettings = {
  provider: "off",
  endpoint: "",
  model: "",
  apiKey: ""
};

const providerDefaults = {
  wardrobe: { endpoint: "", model: "" },
  openai: { endpoint: "https://api.openai.com/v1/responses", model: "gpt-5.5" },
  anthropic: { endpoint: "https://api.anthropic.com/v1/messages", model: "claude-opus-4-8" },
  google: { endpoint: "https://generativelanguage.googleapis.com/v1beta/interactions", model: "gemini-3.5-flash" }
};

const categoryValues = [
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
];

const seasonValues = ["spring", "summer", "fall", "winter"];
const climateValues = ["hot", "mild", "cool", "cold", "rain", "wind", "snow"];
const outfitTagValues = ["daily", "professional", "formal", "athletic", "travel", "weather_protective"];

export const wardrobeEnrichmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    category: { type: "string", enum: categoryValues },
    subcategory: { type: "string" },
    brand: { type: "string" },
    size: { type: "string" },
    color: { type: "string" },
    swatch: { type: "string", description: "A best-effort #RRGGBB color for the dominant visible garment color." },
    material: { type: "string" },
    materialPct: { type: "number", minimum: 0, maximum: 100 },
    fabric: { type: "string" },
    pattern: { type: "string" },
    warmth: { type: "number", minimum: 0, maximum: 5 },
    breathability: { type: "number", minimum: 0, maximum: 5 },
    rain: { type: "number", minimum: 0, maximum: 5 },
    wind: { type: "number", minimum: 0, maximum: 5 },
    formality: { type: "number", minimum: 1, maximum: 5 },
    condition: { type: "number", minimum: 1, maximum: 5 },
    season: { type: "array", items: { type: "string", enum: seasonValues } },
    climate: { type: "array", items: { type: "string", enum: climateValues } },
    layerRole: { type: "string" },
    care: { type: "string" },
    outfitTags: { type: "array", items: { type: "string", enum: outfitTagValues } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string" } },
    notes: { type: "string" }
  },
  required: [
    "name",
    "category",
    "subcategory",
    "brand",
    "size",
    "color",
    "swatch",
    "material",
    "materialPct",
    "fabric",
    "pattern",
    "warmth",
    "breathability",
    "rain",
    "wind",
    "formality",
    "condition",
    "season",
    "climate",
    "layerRole",
    "care",
    "outfitTags",
    "confidence",
    "evidence",
    "notes"
  ]
};

const enrichmentPrompt = `You are extracting editable wardrobe inventory metadata from a clothing image.

Return only JSON matching this schema:
${JSON.stringify(wardrobeEnrichmentSchema)}

Rules:
- Use visible evidence first: labels, logos, fabric texture, closures, silhouette, tags, and printed text.
- Do not invent a brand, size, exact material, care instruction, model year, or price if it is not visible.
- Use empty strings for unknown text fields, empty arrays for unknown multi-value fields, and confidence below 0.5 when uncertain.
- Ratings are wardrobe performance estimates: warmth, breathability, rain resistance, wind resistance, formality, and condition.
- Choose the closest category enum. Put the more specific garment name in subcategory.
- Include short evidence strings for the fields you filled.`;

export function normalizeAiVisionSettings(settings) {
  const provider = settings?.provider ?? defaultAiVisionSettings.provider;
  const defaults = providerDefaults[provider] ?? {};
  return {
    ...defaultAiVisionSettings,
    provider,
    endpoint: String(settings?.endpoint || defaults.endpoint || "").trim(),
    model: String(settings?.model || defaults.model || "").trim(),
    apiKey: settings?.apiKey ?? ""
  };
}

export function aiVisionDefaultsForProvider(provider) {
  return normalizeAiVisionSettings({ provider, ...(providerDefaults[provider] ?? {}) });
}

export function isAiVisionConfigured(settings) {
  return aiVisionConfigStatus(settings).ready;
}

export function aiVisionConfigStatus(settings) {
  const config = normalizeAiVisionSettings(settings);
  if (config.provider === "off") {
    return {
      ready: false,
      tone: "neutral",
      message: "Choose a provider.",
      missing: ["Provider"]
    };
  }

  const missing = [];
  if (!config.endpoint) missing.push("API endpoint");
  if (config.provider !== "wardrobe" && !config.model) missing.push("Model");
  if (config.provider !== "wardrobe" && !String(config.apiKey ?? "").trim()) missing.push("API key");

  return {
    ready: missing.length === 0,
    tone: missing.length ? "warning" : "success",
    message: missing.length ? `${missing.join(", ")} required.` : "Ready",
    missing
  };
}

export async function enrichItemFromImage({ config, imageDataUrl, item }) {
  if (!imageDataUrl) throw new Error("Add a photo before enrichment.");
  const normalizedConfig = normalizeAiVisionSettings(config);
  if (!isAiVisionConfigured(normalizedConfig)) throw new Error("Configure an AI vision provider first.");

  if (normalizedConfig.provider === "wardrobe") {
    const observation = await callWardrobeVisionApi(normalizedConfig, imageDataUrl, item);
    return draftFromWardrobeObservation(observation);
  }

  const response =
    normalizedConfig.provider === "openai"
      ? await callOpenAi(normalizedConfig, imageDataUrl)
      : normalizedConfig.provider === "anthropic"
        ? await callAnthropic(normalizedConfig, imageDataUrl)
        : await callGoogle(normalizedConfig, imageDataUrl);
  return normalizeDraft(response);
}

export function mergeAiDraftIntoItem(item, draft, template) {
  const normalized = normalizeDraft(draft);
  const next = { ...item };
  const fields = [
    "name",
    "category",
    "subcategory",
    "brand",
    "size",
    "color",
    "swatch",
    "material",
    "materialPct",
    "fabric",
    "pattern",
    "warmth",
    "breathability",
    "rain",
    "wind",
    "formality",
    "condition",
    "season",
    "climate",
    "layerRole",
    "care",
    "outfitTags"
  ];

  fields.forEach((field) => {
    const value = normalized[field];
    if (!hasUsefulValue(value)) return;
    if (shouldApplyDraftValue(item[field], template?.[field])) next[field] = value;
  });

  const evidence = normalized.evidence?.filter(Boolean) ?? [];
  if (normalized.notes || evidence.length) {
    const aiNote = ["AI draft", normalized.notes, evidence.length ? `Evidence: ${evidence.join("; ")}` : ""]
      .filter(Boolean)
      .join(" - ");
    next.notes = next.notes?.trim() ? `${next.notes.trim()}\n${aiNote}` : aiNote;
  }

  return next;
}

async function callWardrobeVisionApi(config, imageDataUrl, item) {
  const blob = await dataUrlToBlob(imageDataUrl);
  const formData = new FormData();
  formData.append("file", blob, `wardrobe-${Date.now()}.${extensionFromMime(blob.type)}`);
  formData.append("image_role", "item_photo");
  if (item?.id) formData.append("external_item_id", item.id);

  const headers = {};
  const apiKey = cleanApiKey(config.apiKey);
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchProvider(config.endpoint, { method: "POST", headers, body: formData });
  return readJsonResponse(response);
}

async function callOpenAi(config, imageDataUrl) {
  const apiKey = cleanApiKey(config.apiKey);
  const response = await fetchProvider(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      store: false,
      temperature: 0.1,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: enrichmentPrompt },
            { type: "input_image", image_url: imageDataUrl, detail: "auto" }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "wardrobe_item_enrichment",
          strict: false,
          schema: wardrobeEnrichmentSchema
        }
      }
    })
  });
  const payload = await readJsonResponse(response);
  return parseModelJson(payload.output_text ?? extractOpenAiText(payload));
}

async function callAnthropic(config, imageDataUrl) {
  const { mimeType, base64 } = splitDataUrl(imageDataUrl);
  const apiKey = cleanApiKey(config.apiKey);
  const response = await fetchProvider(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1400,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: enrichmentPrompt }
          ]
        }
      ]
    })
  });
  const payload = await readJsonResponse(response);
  return parseModelJson(extractAnthropicText(payload));
}

async function callGoogle(config, imageDataUrl) {
  const { mimeType, base64 } = splitDataUrl(imageDataUrl);
  const apiKey = cleanApiKey(config.apiKey);
  const response = await fetchProvider(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        { type: "text", text: enrichmentPrompt },
        { type: "image", data: base64, mime_type: mimeType }
      ]
    })
  });
  const payload = await readJsonResponse(response);
  return parseModelJson(payload.output_text ?? extractGoogleText(payload));
}

async function readJsonResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.detail ??
      payload?.error?.message ??
      payload?.message ??
      `Provider request failed with ${response.status}`;
    throw new Error(providerErrorMessage(response.status, detail));
  }
  return payload;
}

async function fetchProvider(endpoint, options) {
  try {
    return await fetch(endpoint, options);
  } catch (error) {
    throw new Error(`AI endpoint unreachable. Check the endpoint URL, HTTPS, and network access. ${error.message}`);
  }
}

function cleanApiKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function providerErrorMessage(status, detail) {
  if (status === 401) return "Unauthorized. Check the AI token in Settings.";
  if (status === 404) return "Endpoint not found. Check the full AI endpoint URL in Settings.";
  if (status === 405) return "Endpoint does not accept image uploads. Check the AI endpoint URL in Settings.";
  return detail || `Provider request failed with ${status}`;
}

function splitDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Photo data is not a supported image.");
  return { mimeType: match[1], base64: match[2] };
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function extensionFromMime(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

function parseModelJson(text) {
  if (!text) throw new Error("Provider returned no enrichment text.");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Provider did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function extractOpenAiText(payload) {
  const content = payload?.output?.flatMap((entry) => entry.content ?? []) ?? [];
  return content.find((entry) => entry.type === "output_text" || entry.type === "text")?.text ?? "";
}

function extractAnthropicText(payload) {
  return (payload?.content ?? [])
    .filter((entry) => entry.type === "text")
    .map((entry) => entry.text)
    .join("\n");
}

function extractGoogleText(payload) {
  if (payload?.text) return payload.text;
  const output = payload?.output?.flatMap((entry) => entry.content ?? entry.parts ?? []) ?? [];
  const candidateParts = payload?.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  return [...output, ...candidateParts].map((entry) => entry.text ?? "").filter(Boolean).join("\n");
}

function draftFromWardrobeObservation(observation) {
  const categoryHypotheses = observation?.category_hypotheses ?? observation?.categoryHypotheses ?? observation?.categories ?? [];
  const categoryText = firstText(categoryHypotheses[0]?.category ?? observation?.category);
  const material = firstText(
    observation?.material_hypotheses?.[0]?.material ??
      observation?.materialHypotheses?.[0]?.material ??
      observation?.materials?.[0]
  );
  const visibleText = (observation?.visible_text ?? observation?.visibleText ?? [])
    .map((entry) => firstText(entry?.text ?? entry))
    .filter(Boolean);
  const brand = firstText(
    observation?.brand ??
      observation?.brands?.[0] ??
      observation?.logos?.[0]?.brand_guess ??
      observation?.logos?.[0]?.text ??
      observation?.visible_logos?.[0]?.brand_guess ??
      observation?.visible_logos?.[0]?.text ??
      observation?.visibleLogos?.[0]?.brand_guess ??
      observation?.visibleLogos?.[0]?.text
  );
  const constructionDetails = (observation?.construction_details ?? observation?.constructionDetails ?? [])
    .map((entry) => firstText(entry?.detail ?? entry))
    .filter(Boolean);
  const specificCategory = categoryText || "clothing item";
  const category = normalizeCategory(specificCategory);

  return normalizeDraft({
    name: [brand, specificCategory].filter(Boolean).join(" ") || specificCategory,
    category,
    subcategory: specificCategory,
    brand,
    material,
    materialPct: material ? inferMaterialPct(visibleText, material) : 0,
    fabric: inferFabric(specificCategory, visibleText),
    pattern: inferPattern(visibleText),
    season: seasonsForCategory(category, specificCategory),
    climate: climateForCategory(category, specificCategory, material),
    layerRole: layerRoleForCategory(category, specificCategory),
    outfitTags: outfitTagsForCategory(category),
    confidence: Number(categoryHypotheses[0]?.confidence ?? observation?.confidence ?? 0.45),
    evidence: [
      categoryText ? `Category: ${categoryText}` : "",
      material ? `Material: ${material}` : "",
      brand ? `Brand/logo: ${brand}` : "",
      ...constructionDetails.slice(0, 3).map((text) => `Detail: ${text}`),
      ...visibleText.slice(0, 4).map((text) => `Visible text: ${text}`)
    ].filter(Boolean),
    notes: [
      visibleText.length ? `Visible text: ${visibleText.join("; ")}` : "",
      constructionDetails.length ? `Construction: ${constructionDetails.join("; ")}` : ""
    ]
      .filter(Boolean)
      .join(" ")
  });
}

function normalizeDraft(draft) {
  const category = categoryValues.includes(draft?.category) ? draft.category : normalizeCategory(draft?.category);
  return {
    name: cleanText(draft?.name),
    category,
    subcategory: cleanText(draft?.subcategory),
    brand: cleanText(draft?.brand),
    size: cleanText(draft?.size),
    color: cleanText(draft?.color),
    swatch: normalizeHex(draft?.swatch),
    material: cleanText(draft?.material),
    materialPct: clampNumber(draft?.materialPct, 0, 100),
    fabric: cleanText(draft?.fabric),
    pattern: cleanText(draft?.pattern),
    warmth: clampNumber(draft?.warmth, 0, 5),
    breathability: clampNumber(draft?.breathability, 0, 5),
    rain: clampNumber(draft?.rain, 0, 5),
    wind: clampNumber(draft?.wind, 0, 5),
    formality: clampNumber(draft?.formality, 1, 5),
    condition: clampNumber(draft?.condition, 1, 5),
    season: normalizeArray(draft?.season, seasonValues),
    climate: normalizeArray(draft?.climate, climateValues),
    layerRole: cleanText(draft?.layerRole),
    care: cleanText(draft?.care),
    outfitTags: normalizeArray(draft?.outfitTags, outfitTagValues),
    confidence: clampNumber(draft?.confidence, 0, 1),
    evidence: Array.isArray(draft?.evidence) ? draft.evidence.map(cleanText).filter(Boolean) : [],
    notes: cleanText(draft?.notes)
  };
}

function normalizeCategory(value) {
  const text = String(value ?? "").toLowerCase();
  if (/shoe|sneaker|boot|loafer|sandal/.test(text)) return "shoes";
  if (/coat|jacket|parka|shell|blazer|cardigan|hoodie|sweater/.test(text)) return "outerwear";
  if (/pant|jean|trouser|short|skirt/.test(text)) return "bottom";
  if (/dress/.test(text)) return "dress";
  if (/suit/.test(text)) return "suit";
  if (/sock/.test(text)) return "socks";
  if (/underwear|brief|boxer|bra/.test(text)) return "underwear";
  if (/sleep|pajama/.test(text)) return "sleepwear";
  if (/swim/.test(text)) return "swimwear";
  if (/hat|belt|scarf|tie|glove|bag|watch/.test(text)) return "accessory";
  if (/athletic|running|training|gym/.test(text)) return "athletic";
  return "top";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function firstText(value) {
  return cleanText(value);
}

function normalizeHex(value) {
  const text = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "";
}

function normalizeArray(value, allowed) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => cleanText(entry)).filter((entry, index, entries) => allowed.includes(entry) && entries.indexOf(entry) === index);
}

function clampNumber(value, min, max) {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function hasUsefulValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return Boolean(String(value ?? "").trim());
}

function shouldApplyDraftValue(current, template) {
  if (Array.isArray(current)) return arraysEqual(current, template) || current.length === 0;
  if (typeof current === "number") return current === template || !Number.isFinite(current);
  return !String(current ?? "").trim() || current === template;
}

function arraysEqual(first = [], second = []) {
  if (!Array.isArray(first) || !Array.isArray(second)) return false;
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

function inferMaterialPct(textRows, material) {
  const joined = textRows.join(" ");
  const exact = joined.match(/(\d{1,3})\s*%?\s+[a-z ]{0,20}/i);
  if (exact && joined.toLowerCase().includes(material.toLowerCase())) return clampNumber(exact[1], 0, 100);
  return 100;
}

function inferFabric(category, visibleText) {
  const text = `${category} ${visibleText.join(" ")}`.toLowerCase();
  if (/denim|jean/.test(text)) return "denim";
  if (/oxford/.test(text)) return "oxford cloth";
  if (/chambray/.test(text)) return "chambray";
  if (/flannel/.test(text)) return "flannel";
  if (/fleece/.test(text)) return "fleece";
  if (/jersey|tee|t-shirt/.test(text)) return "jersey knit";
  if (/shell|waterproof/.test(text)) return "waterproof shell";
  if (/twill/.test(text)) return "twill";
  return "";
}

function inferPattern(textRows) {
  const text = textRows.join(" ").toLowerCase();
  if (/stripe/.test(text)) return "stripe";
  if (/plaid|check/.test(text)) return "plaid";
  if (/print|graphic/.test(text)) return "graphic";
  return "solid";
}

function seasonsForCategory(category, subcategory) {
  const text = `${category} ${subcategory}`.toLowerCase();
  if (/short|linen|tank|swim/.test(text)) return ["summer"];
  if (/coat|parka|wool|down|sweater|fleece/.test(text)) return ["fall", "winter"];
  return ["spring", "fall"];
}

function climateForCategory(category, subcategory, material) {
  const text = `${category} ${subcategory} ${material}`.toLowerCase();
  if (/linen|short|tank|swim/.test(text)) return ["hot"];
  if (/shell|rain|waterproof/.test(text)) return ["rain", "wind"];
  if (/down|wool|fleece|parka/.test(text)) return ["cold", "cool"];
  return ["mild"];
}

function layerRoleForCategory(category, subcategory) {
  const text = `${category} ${subcategory}`.toLowerCase();
  if (category === "shoes") return "footwear";
  if (category === "accessory") return "accessory";
  if (category === "dress" || category === "suit") return "one-piece";
  if (/shell|jacket|coat|parka/.test(text)) return "shell";
  if (/sweater|fleece|hoodie|cardigan/.test(text)) return "mid";
  return "base";
}

function outfitTagsForCategory(category) {
  if (category === "suit") return ["formal", "professional"];
  if (category === "athletic") return ["athletic"];
  return ["daily"];
}
