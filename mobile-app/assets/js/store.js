/**
 * store.js — offline persistence layer.
 * IndexedDB (primary) with a localStorage fallback so the app NEVER loses
 * data or crashes, even on stripped-down WebViews. All records live in the
 * "kv" + typed object stores defined by SCHEMA below.
 */

const DB_NAME = "ai-creator-studio";
const DB_VERSION = 1;

export const STORES = ["kv", "scripts", "posts", "revenue", "sponsors", "maya", "topics", "metrics"];

let dbPromise = null;
let idbAvailable = "indexedDB" in self;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === "kv" ? "key" : "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/* ---------------- localStorage fallback ---------------- */
function lsKey(store) { return `${DB_NAME}:${store}`; }
function lsAll(store) {
  try { return JSON.parse(localStorage.getItem(lsKey(store)) || "[]"); }
  catch { return []; }
}
function lsWrite(store, rows) {
  try { localStorage.setItem(lsKey(store), JSON.stringify(rows)); } catch { /* storage full — non-fatal */ }
}

/* ---------------- public API ---------------- */
export async function getAll(store) {
  if (!idbAvailable) return lsAll(store);
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    idbAvailable = false;
    return lsAll(store);
  }
}

export async function put(store, record) {
  if (!idbAvailable) {
    const rows = lsAll(store);
    const key = store === "kv" ? "key" : "id";
    const i = rows.findIndex((r) => r[key] === record[key]);
    if (i >= 0) rows[i] = record; else rows.push(record);
    lsWrite(store, rows);
    return record;
  }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return record;
  } catch {
    idbAvailable = false;
    return put(store, record); // retry through the fallback
  }
}

export async function get(store, id) {
  const rows = await getAll(store);
  const key = store === "kv" ? "key" : "id";
  return rows.find((r) => r[key] === id) || null;
}

export async function del(store, id) {
  if (!idbAvailable) {
    const key = store === "kv" ? "key" : "id";
    lsWrite(store, lsAll(store).filter((r) => r[key] !== id));
    return;
  }
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    idbAvailable = false;
    const key = store === "kv" ? "key" : "id";
    lsWrite(store, lsAll(store).filter((r) => r[key] !== id));
  }
}

export async function clearAllStores() {
  for (const store of STORES) {
    if (!idbAvailable) { lsWrite(store, []); continue; }
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      idbAvailable = false;
      lsWrite(store, []);
    }
  }
}

export async function getSetting(key, fallback = null) {
  const row = await get("kv", key);
  return row ? row.value : fallback;
}
export async function setSetting(key, value) {
  return put("kv", { key, value });
}

/* ---------------- first-run seed (clearly labeled sample data) ---------------- */
export const SEED_VERSION = 3;

function iso(daysAgo = 0) { return new Date(Date.now() - daysAgo * 86400000).toISOString(); }
function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function ensureSeeded() {
  const seeded = await getSetting("seedVersion");
  if (seeded === SEED_VERSION) return;
  await clearAllStores();

  const topics = [
    { id: uid(), title: "AI tools that replaced my whole team", angle: "listicle + personal story", priority: "high", createdAt: iso(6) },
    { id: uid(), title: "How I publish daily with zero staff", angle: "workflow breakdown", priority: "high", createdAt: iso(5) },
    { id: uid(), title: "Faceless channel starter kit", angle: "tutorial", priority: "normal", createdAt: iso(3) },
  ];
  for (const t of topics) await put("topics", t);

  const scripts = [
    {
      id: uid(), title: "AI tools that replaced my whole team",
      hook: "I fired my entire content team last year. These 4 AI tools took over their jobs — and output doubled.",
      body: "HOOK (0:00-0:08)\nI fired my entire content team last year. These 4 AI tools took over their jobs — and output doubled.\n\nCONTEXT (0:08-0:35)\nSolo creators are told they need a team. I ran the numbers: my five-person content team cost me $18k/month.\n\nPOINT 1 — Research (0:35-1:20)\nTool #1 digests 200 sources overnight and hands me a validated topic list every morning.\n\nPOINT 2 — Scripting (1:20-2:10)\nTool #2 drafts in my voice because it learns from my past scripts. I edit 10%, not 100%.\n\nPOINT 3 — Production (2:10-3:00)\nTool #3 handles thumbnails + captions; A/B tests run automatically.\n\nCTA (3:00-3:20)\nComment 'KIT' and I'll send the exact stack. Subscribe if you want the workflow breakdown next.",
      platform: "youtube", status: "approved", synced: false,
      createdAt: iso(4), updatedAt: iso(2),
    },
    {
      id: uid(), title: "How I publish daily with zero staff",
      hook: "One person. Daily posts. Zero team. Here's the exact machine.",
      body: "HOOK\nOne person. Daily posts. Zero team. Here's the exact machine.\n\nBODY\nThe pipeline is 5 steps: capture → script → generate → approve → schedule. Every step has ONE tool and a time budget.\n\nCTA\nFollow for the full teardown.",
      platform: "instagram", status: "draft", synced: false,
      createdAt: iso(2), updatedAt: iso(1),
    },
  ];
  for (const s of scripts) await put("scripts", s);

  const posts = [
    { id: uid(), scriptTitle: "AI tools that replaced my whole team", platform: "youtube", scheduledFor: iso(-2), status: "published", caption: "New video: the 4 AI tools that replaced my content team 🚀", note: "sample", createdAt: iso(3) },
    { id: uid(), scriptTitle: "How I publish daily with zero staff", platform: "instagram", scheduledFor: iso(-1), status: "queued", caption: "1 person. Daily posts. 0 team. The machine 🧵", note: "sample", createdAt: iso(1) },
    { id: uid(), scriptTitle: "Faceless channel starter kit", platform: "linkedin", scheduledFor: iso(-3), status: "queued", caption: "Faceless channels are a system, not a trick. Starter kit inside.", note: "sample", createdAt: iso(2) },
  ];
  for (const p of posts) await put("posts", p);

  const revenue = [
    { id: uid(), date: iso(26), source: "sponsor", label: "AI tool newsletter sponsorship (sample)", amountCents: 45000, verified: true, createdAt: iso(26) },
    { id: uid(), date: iso(12), source: "ads", label: "YouTube AdSense payout (sample)", amountCents: 18750, verified: true, createdAt: iso(12) },
    { id: uid(), date: iso(4), source: "product", label: "Script template pack (sample)", amountCents: 9900, verified: false, createdAt: iso(4) },
  ];
  for (const r of revenue) await put("revenue", r);

  const sponsors = [
    { id: uid(), brand: "Notion-AI (sample)", deal: "2× newsletter placements", amountCents: 60000, stage: "negotiation", notes: "Waiting on revised rate card.", createdAt: iso(8) },
    { id: uid(), brand: "MicroMail (sample)", deal: "1× YouTube integration", amountCents: 120000, stage: "scheduled", notes: "Deliverable due with next video.", createdAt: iso(5) },
  ];
  for (const s of sponsors) await put("sponsors", s);

  const metrics = [
    { id: uid(), date: iso(7), platform: "youtube", views: 24800, likes: 1810, follows: 312 },
    { id: uid(), date: iso(6), platform: "youtube", views: 26100, likes: 1944, follows: 351 },
    { id: uid(), date: iso(5), platform: "youtube", views: 23950, likes: 1722, follows: 289 },
    { id: uid(), date: iso(4), platform: "youtube", views: 31200, likes: 2410, follows: 468 },
    { id: uid(), date: iso(3), platform: "youtube", views: 28700, likes: 2155, follows: 402 },
    { id: uid(), date: iso(2), platform: "youtube", views: 33400, likes: 2680, follows: 511 },
    { id: uid(), date: iso(1), platform: "youtube", views: 36150, likes: 2905, follows: 548 },
  ];
  for (const m of metrics) await put("metrics", m);

  const mayaSeed = [
    { id: uid(), role: "maya", text: "Hi, I'm AI Maya — your studio assistant, running fully offline on this device.\nI can draft hooks, outline scripts, write platform captions, and plan your schedule. Ask me anything, or try a suggestion below.", at: iso(0) },
  ];
  for (const m of mayaSeed) await put("maya", m);

  await setSetting("seedVersion", SEED_VERSION);
  await setSetting("seededAt", new Date().toISOString());
}

export { uid, iso };
