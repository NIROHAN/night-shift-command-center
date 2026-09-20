/* ==========================================================================
   Cloud Synchronization Engine (Multi-Device Shared Persistence)
   Supports:
   1. Google Firebase Firestore (via native REST API - zero bundle bloat)
   2. Vercel Serverless API (/api/shifts) with KV / Upstash
   3. JSONBin.io / Generic Cloud REST Store
   4. Automatic configuration via import.meta.env or URL invite token
   ========================================================================== */

const CLOUD_CONFIG_KEY = "night_shift_cloud_config_v1";
const LAST_SYNC_KEY = "night_shift_last_sync_timestamp";

export function getStoredCloudConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Error reading cloud config", e);
  }

  // Fallback to Vite Environment Variables (set in Vercel or .env)
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

  if (env.VITE_FIREBASE_PROJECT_ID) {
    return {
      provider: "firebase",
      firebaseProjectId: env.VITE_FIREBASE_PROJECT_ID,
      firebaseApiKey: env.VITE_FIREBASE_API_KEY || "",
      autoSync: true
    };
  }

  if (env.VITE_JSONBIN_BIN_ID) {
    return {
      provider: "jsonbin",
      jsonBinId: env.VITE_JSONBIN_BIN_ID,
      jsonBinKey: env.VITE_JSONBIN_API_KEY || "",
      autoSync: true
    };
  }

  if (env.VITE_CLOUD_API_URL) {
    return {
      provider: "api",
      apiUrl: env.VITE_CLOUD_API_URL,
      apiKey: env.VITE_CLOUD_API_KEY || "",
      autoSync: true
    };
  }

  // Default to local Vercel API endpoint (/api/shifts) if on hosted domain
  return {
    provider: "none",
    autoSync: false
  };
}

export function saveStoredCloudConfig(config) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
      return true;
    }
  } catch (e) {
    console.error("Failed to save cloud config", e);
  }
  return false;
}

export function getStoredLastSync() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(LAST_SYNC_KEY) || null;
    }
  } catch (e) { }
  return null;
}

export function setStoredLastSync(timeString) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_SYNC_KEY, timeString);
    }
  } catch (e) { }
}

export function parseUrlCloudConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const syncProvider = params.get('sync_provider');
    if (!syncProvider) return null;

    let config = null;
    if (syncProvider === 'firebase') {
      config = {
        provider: 'firebase',
        firebaseProjectId: params.get('fb_proj') || '',
        firebaseApiKey: params.get('fb_key') || '',
        autoSync: true
      };
    } else if (syncProvider === 'jsonbin') {
      config = {
        provider: 'jsonbin',
        jsonBinId: params.get('bin_id') || '',
        jsonBinKey: params.get('bin_key') || '',
        autoSync: true
      };
    } else if (syncProvider === 'api') {
      config = {
        provider: 'api',
        apiUrl: params.get('api_url') || '/api/shifts',
        apiKey: params.get('api_key') || '',
        autoSync: true
      };
    }

    if (config) {
      saveStoredCloudConfig(config);
      // Clean query params from URL without reload
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return config;
    }
  } catch (e) {
    console.warn("Failed parsing URL cloud config", e);
  }
  return null;
}

/* ==========================================================================
   Cloud Provider Implementations
   ========================================================================== */

// 1. Firebase Firestore REST API (Official Google Firestore REST)
async function fetchFromFirestore(config) {
  const { firebaseProjectId, firebaseApiKey } = config;
  if (!firebaseProjectId) throw new Error("Firebase Project ID is required");

  let url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/shifts`;
  if (firebaseApiKey) url += `?key=${encodeURIComponent(firebaseApiKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return {};
    const errText = await res.text();
    throw new Error(`Firestore fetch error [${res.status}]: ${errText}`);
  }

  const json = await res.json();
  const docs = json.documents || [];
  const shifts = {};

  for (const doc of docs) {
    try {
      const docName = doc.name.split('/').pop();
      const rawData = doc.fields?.data?.stringValue;
      if (rawData) {
        shifts[docName] = JSON.parse(rawData);
      }
    } catch (err) {
      console.warn("Error parsing Firestore doc", err);
    }
  }

  return shifts;
}

async function saveToFirestore(config, dateKey, shiftRecord) {
  const { firebaseProjectId, firebaseApiKey } = config;
  if (!firebaseProjectId) throw new Error("Firebase Project ID is required");

  let url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/shifts/${dateKey}`;
  if (firebaseApiKey) url += `?key=${encodeURIComponent(firebaseApiKey)}`;

  const payload = {
    fields: {
      data: { stringValue: JSON.stringify(shiftRecord) },
      updatedAt: { stringValue: new Date().toISOString() },
      lead: { stringValue: shiftRecord?.meta?.lead || "" }
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore save error [${res.status}]: ${errText}`);
  }

  return await res.json();
}

// 2. JSONBin.io v3 API
async function fetchFromJsonBin(config) {
  const { jsonBinId, jsonBinKey } = config;
  if (!jsonBinId) throw new Error("JSONBin Bin ID is required");

  const headers = {};
  if (jsonBinKey) headers['X-Master-Key'] = jsonBinKey;

  const res = await fetch(`https://api.jsonbin.io/v3/b/${jsonBinId}/latest`, { headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`JSONBin fetch error [${res.status}]: ${errText}`);
  }

  const json = await res.json();
  return json.record?.shifts || json.record || {};
}

async function saveToJsonBin(config, shiftsMap) {
  const { jsonBinId, jsonBinKey } = config;
  if (!jsonBinId) throw new Error("JSONBin Bin ID is required");

  const headers = { 'Content-Type': 'application/json' };
  if (jsonBinKey) headers['X-Master-Key'] = jsonBinKey;

  const res = await fetch(`https://api.jsonbin.io/v3/b/${jsonBinId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ shifts: shiftsMap, updatedAt: new Date().toISOString() })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`JSONBin save error [${res.status}]: ${errText}`);
  }

  return await res.json();
}

// 3. Vercel Serverless Function / Custom API (/api/shifts)
async function fetchFromApi(config) {
  const url = config.apiUrl || '/api/shifts';
  const headers = {};
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) return null; // API not deployed or empty
    throw new Error(`API fetch failed with status ${res.status}`);
  }
  const json = await res.json();
  return json.shifts || json;
}

async function saveToApi(config, dateKey, shiftRecord, allShifts) {
  const url = config.apiUrl || '/api/shifts';
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dateKey,
      shift: shiftRecord,
      shifts: allShifts,
      updatedAt: new Date().toISOString()
    })
  });

  if (!res.ok) {
    throw new Error(`API save failed with status ${res.status}`);
  }
  return await res.json();
}

/* ==========================================================================
   Public Cloud Sync Methods
   ========================================================================== */

export async function fetchShiftsFromCloud(customConfig = null) {
  const config = customConfig || getStoredCloudConfig();
  if (!config || config.provider === 'none') {
    return { success: false, shifts: null, message: "No cloud sync provider configured" };
  }

  try {
    let shifts = null;
    if (config.provider === 'firebase') {
      shifts = await fetchFromFirestore(config);
    } else if (config.provider === 'jsonbin') {
      shifts = await fetchFromJsonBin(config);
    } else if (config.provider === 'api') {
      shifts = await fetchFromApi(config);
    }

    if (shifts && typeof shifts === 'object') {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setStoredLastSync(now);
      return { success: true, shifts, lastSync: now, provider: config.provider };
    }
    return { success: false, shifts: null, message: "Empty or invalid response from cloud store" };
  } catch (err) {
    console.error("Cloud fetch error:", err);
    return { success: false, shifts: null, error: err.message };
  }
}

export async function pushShiftToCloud(dateKey, shiftRecord, allShifts = null) {
  const config = getStoredCloudConfig();
  if (!config || config.provider === 'none') return { success: false, message: "Not configured" };

  try {
    if (config.provider === 'firebase') {
      await saveToFirestore(config, dateKey, shiftRecord);
    } else if (config.provider === 'jsonbin') {
      const payload = allShifts || { [dateKey]: shiftRecord };
      await saveToJsonBin(config, payload);
    } else if (config.provider === 'api') {
      await saveToApi(config, dateKey, shiftRecord, allShifts);
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStoredLastSync(now);
    return { success: true, lastSync: now };
  } catch (err) {
    console.error("Cloud push error:", err);
    return { success: false, error: err.message };
  }
}

export async function pushAllShiftsToCloud(shiftsMap) {
  const config = getStoredCloudConfig();
  if (!config || config.provider === 'none') return { success: false };

  try {
    if (config.provider === 'firebase') {
      const dates = Object.keys(shiftsMap);
      for (const d of dates) {
        await saveToFirestore(config, d, shiftsMap[d]);
      }
    } else if (config.provider === 'jsonbin') {
      await saveToJsonBin(config, shiftsMap);
    } else if (config.provider === 'api') {
      await saveToApi(config, 'bulk', null, shiftsMap);
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setStoredLastSync(now);
    return { success: true, lastSync: now };
  } catch (err) {
    console.error("Bulk cloud sync error:", err);
    return { success: false, error: err.message };
  }
}

export async function testCloudConnection(config) {
  try {
    if (config.provider === 'firebase') {
      if (!config.firebaseProjectId) throw new Error("Firebase Project ID is required");
      // Test read
      const shifts = await fetchFromFirestore(config);
      return { success: true, message: `Connected to Firebase Firestore (${Object.keys(shifts).length} shifts found)` };
    } else if (config.provider === 'jsonbin') {
      if (!config.jsonBinId) throw new Error("Bin ID is required");
      const data = await fetchFromJsonBin(config);
      return { success: true, message: `Connected to JSONBin.io (${Object.keys(data).length} shifts found)` };
    } else if (config.provider === 'api') {
      const data = await fetchFromApi(config);
      return { success: true, message: "Connected to Serverless API endpoint" };
    }
    return { success: false, message: "Please choose a cloud provider" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
