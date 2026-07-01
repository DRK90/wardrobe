const zipPattern = /^\d{5}$/;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseWindSpeed(value) {
  const numbers = String(value ?? "").match(/\d+/g)?.map(Number) ?? [];
  return numbers.length ? Math.max(...numbers) : 0;
}

function mostCommon(values) {
  const counts = values.reduce((map, value) => {
    if (!value) return map;
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map());
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function seasonForDate(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function eventDateTime(dateText, timeText = "12:00") {
  if (!dateText) return null;
  const date = new Date(`${dateText}T${timeText || "12:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeZip(zip) {
  return String(zip ?? "").trim().slice(0, 5);
}

function normalizeHourlyPeriod(period) {
  return {
    number: period.number,
    name: period.name,
    startTime: period.startTime,
    endTime: period.endTime,
    tempF: Number(period.temperature ?? 0),
    rainPct: Number(period.probabilityOfPrecipitation?.value ?? 0),
    humidity: Number(period.relativeHumidity?.value ?? 0),
    windMph: parseWindSpeed(period.windSpeed),
    windDirection: period.windDirection ?? "",
    shortForecast: period.shortForecast ?? "",
    isDaytime: Boolean(period.isDaytime)
  };
}

function summarizeDays(periods, todayKey = localDateKey()) {
  const groups = periods.reduce((map, period) => {
    const key = localDateKey(new Date(period.startTime));
    if (key <= todayKey) return map;
    const values = map.get(key) ?? [];
    values.push(period);
    map.set(key, values);
    return map;
  }, new Map());

  return [...groups.entries()].slice(0, 2).map(([date, values]) => ({
    date,
    highF: Math.max(...values.map((period) => period.tempF)),
    lowF: Math.min(...values.map((period) => period.tempF)),
    rainPct: Math.max(...values.map((period) => period.rainPct)),
    windMph: Math.max(...values.map((period) => period.windMph)),
    summary: mostCommon(values.map((period) => period.shortForecast))
  }));
}

export function cleanZip(zip) {
  return normalizeZip(zip).replace(/\D/g, "");
}

export function validZip(zip) {
  return zipPattern.test(cleanZip(zip));
}

export function weatherCacheDate() {
  return localDateKey();
}

export function isWeatherFresh(entry) {
  return Boolean(entry?.cacheDate && entry.cacheDate === weatherCacheDate());
}

export function activeWeatherEntry(settings, weatherCache) {
  if (settings.destinationEnabled && weatherCache?.destination?.current) return weatherCache.destination;
  if (weatherCache?.home?.current) return weatherCache.home;
  return null;
}

export function weatherToRequest(entry, currentRequest) {
  if (!entry?.current) return currentRequest;
  return {
    ...currentRequest,
    tempF: entry.current.tempF,
    rainPct: entry.current.rainPct,
    windMph: entry.current.windMph,
    season: seasonForDate(new Date(entry.current.startTime))
  };
}

export function eventWeatherForRequest(entry, currentRequest) {
  const date = eventDateTime(currentRequest.eventDate, currentRequest.eventTime);
  if (!entry?.forecastHours?.length || !date) return null;

  const direct = entry.forecastHours.find((period) => {
    const start = new Date(period.startTime);
    const end = new Date(period.endTime);
    return date >= start && date < end;
  });
  const dateKey = localDateKey(date);
  const sameDay = entry.forecastHours
    .filter((period) => localDateKey(new Date(period.startTime)) === dateKey)
    .sort((a, b) => Math.abs(new Date(a.startTime) - date) - Math.abs(new Date(b.startTime) - date))[0];
  const period = direct ?? sameDay;
  if (!period) return null;

  return {
    request: {
      ...currentRequest,
      tempF: period.tempF,
      rainPct: period.rainPct,
      windMph: period.windMph,
      season: seasonForDate(date)
    },
    period,
    locationName: entry.locationName
  };
}

export async function fetchZipForecast(zip) {
  const normalizedZip = cleanZip(zip);
  if (!validZip(normalizedZip)) throw new Error("Enter a 5-digit ZIP code.");

  const zipResponse = await fetch(`https://api.zippopotam.us/us/${normalizedZip}`);
  if (!zipResponse.ok) throw new Error("ZIP code not found.");
  const zipData = await zipResponse.json();
  const place = zipData.places?.[0];
  if (!place) throw new Error("ZIP code not found.");

  const lat = Number(place.latitude);
  const lon = Number(place.longitude);
  const locationName = `${place["place name"]}, ${place["state abbreviation"]}`;

  const pointResponse = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: { Accept: "application/geo+json" }
  });
  if (!pointResponse.ok) throw new Error("Forecast unavailable.");
  const pointData = await pointResponse.json();
  const hourlyUrl = pointData.properties?.forecastHourly;
  if (!hourlyUrl) throw new Error("Hourly forecast unavailable.");

  const hourlyResponse = await fetch(hourlyUrl, { headers: { Accept: "application/geo+json" } });
  if (!hourlyResponse.ok) throw new Error("Hourly forecast unavailable.");
  const hourlyData = await hourlyResponse.json();
  const periods = (hourlyData.properties?.periods ?? []).map(normalizeHourlyPeriod);
  if (!periods.length) throw new Error("Hourly forecast unavailable.");

  const now = new Date();
  const todayKey = localDateKey(now);
  const current = periods.find((period) => new Date(period.endTime) > now) ?? periods[0];
  const restOfDay = periods
    .filter((period) => {
      const start = new Date(period.startTime);
      return start >= now && localDateKey(start) === todayKey;
    })
    .slice(0, 12);

  return {
    zip: normalizedZip,
    locationName,
    lat,
    lon,
    cacheDate: weatherCacheDate(),
    fetchedAt: new Date().toISOString(),
    current,
    restOfDay,
    forecastHours: periods,
    nextTwoDays: summarizeDays(periods, todayKey),
    office: pointData.properties?.gridId ?? "",
    source: "National Weather Service"
  };
}
