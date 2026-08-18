const databaseName = "wardrobe-local-v2";
const databaseVersion = 3;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("wearLogs")) {
        db.createObjectStore("wearLogs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("weatherCache")) {
        db.createObjectStore("weatherCache", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("outfitDays")) {
        db.createObjectStore("outfitDays", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readonly");
  const values = await requestToPromise(transaction.objectStore(storeName).getAll());
  db.close();
  return values;
}

async function replaceAll(storeName, values) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.clear();
  values.forEach((value) => store.put(value));
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadItems() {
  return getAll("items");
}

export async function saveItems(items) {
  await replaceAll("items", items);
}

export async function loadWearLogs() {
  return getAll("wearLogs");
}

export async function saveWearLogs(logs) {
  await replaceAll("wearLogs", logs);
}

export async function loadOutfitDays() {
  return getAll("outfitDays");
}

export async function saveOutfitDays(days) {
  await replaceAll("outfitDays", days);
}

export async function loadWeatherCache() {
  const db = await openDatabase();
  const transaction = db.transaction("weatherCache", "readonly");
  const cache = await requestToPromise(transaction.objectStore("weatherCache").get("main"));
  db.close();
  return cache ?? null;
}

export async function saveWeatherCache(cache) {
  const db = await openDatabase();
  const transaction = db.transaction("weatherCache", "readwrite");
  transaction.objectStore("weatherCache").put({ ...cache, id: "main" });
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadSettings() {
  const db = await openDatabase();
  const transaction = db.transaction("settings", "readonly");
  const settings = await requestToPromise(transaction.objectStore("settings").get("main"));
  db.close();
  return settings ?? null;
}

export async function saveSettings(settings) {
  const db = await openDatabase();
  const transaction = db.transaction("settings", "readwrite");
  transaction.objectStore("settings").put({ ...settings, id: "main" });
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
