/**
 * sync.js — optional connection to the full studio server (Next.js app).
 *
 * Design:
 *  - The app is 100% usable offline; this module only ADDS sync when the
 *    user configures a server in Settings.
 *  - Ping uses GET /api/auth/csrf (public endpoint) as the health probe.
 *  - Login uses the standard next-auth credentials flow with cookies.
 *  - Pull/push hit real API routes; all failures surface as human-readable
 *    messages (offline, CORS, wrong credentials, HTTP error) — never silent,
 *    never a crash.
 */

import { getSetting, setSetting, getAll, put } from "./store.js";

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

function friendlyError(e, serverUrl) {
  if (e && e.name === "AbortError") return "Timed out — the server didn't answer in 6s.";
  if (e instanceof TypeError) {
    return `Can't reach ${serverUrl}. Causes: server is down, wrong address, no network, or the server hasn't enabled CORS for this app (set MOBILE_SYNC_ORIGIN on the server).`;
  }
  return e && e.message ? e.message : "Unknown network error.";
}

export async function getSyncConfig() {
  const url = await getSetting("serverUrl", "__SERVER_URL__");
  const email = await getSetting("syncEmail", "");
  return { serverUrl: normalize(url), email };
}

export function normalize(url) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(u) ? u : "";
}

/** Health probe: GET /api/auth/csrf (public, no auth). */
export async function ping(serverUrl) {
  const base = normalize(serverUrl);
  if (!base) return { ok: false, reason: "No server URL configured — the app runs fully offline." };
  const { signal, done } = withTimeout(6000);
  try {
    const res = await fetch(`${base}/api/auth/csrf`, { signal, headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, reason: `Server responded HTTP ${res.status}.` };
    const data = await res.json().catch(() => null);
    if (!data || !data.csrfToken) return { ok: false, reason: "Reachable, but this doesn't look like an AI Creator Studio server (no csrf token)." };
    return { ok: true, serverUrl: base };
  } catch (e) {
    return { ok: false, reason: friendlyError(e, base) };
  } finally {
    done();
  }
}

/** Credentials login against next-auth. Returns {ok, reason?, user?}. */
export async function login(serverUrl, email, password) {
  const base = normalize(serverUrl);
  if (!base) return { ok: false, reason: "Set a server URL first." };
  try {
    const csrfRes = await fetch(`${base}/api/auth/csrf`, { headers: { accept: "application/json" } });
    if (!csrfRes.ok) return { ok: false, reason: `Health check failed (HTTP ${csrfRes.status}).` };
    const { csrfToken } = await csrfRes.json();

    const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/dashboard` });
    const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "include",
      redirect: "manual",
    });
    if (loginRes.type === "opaqueredirect" || loginRes.ok || loginRes.status === 302 || loginRes.status === 0) {
      // verify session for real instead of trusting a redirect
      const session = await sessionInfo(base);
      if (session.authenticated) {
        await setSetting("syncEmail", email);
        await setSetting("serverUrl", base);
        return { ok: true, user: session.user };
      }
      return { ok: false, reason: "Server rejected the credentials (session not created). Check email/password." };
    }
    return { ok: false, reason: `Login failed (HTTP ${loginRes.status}).` };
  } catch (e) {
    return { ok: false, reason: friendlyError(e, base) };
  }
}

export async function sessionInfo(serverUrl) {
  const base = normalize(serverUrl);
  if (!base) return { authenticated: false };
  const { signal, done } = withTimeout(6000);
  try {
    const res = await fetch(`${base}/api/auth/session`, { credentials: "include", headers: { accept: "application/json" }, signal });
    const data = await res.json();
    if (data && data.user && data.user.email) return { authenticated: true, user: data.user };
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  } finally {
    done();
  }
}

/** Pull the latest morning brief snapshot from the server (read-only). */
export async function pullBrief(serverUrl) {
  const base = normalize(serverUrl);
  const { signal, done } = withTimeout(8000);
  try {
    const res = await fetch(`${base}/api/reports/morning-brief`, { credentials: "include", headers: { accept: "application/json" }, signal });
    if (res.status === 401) return { ok: false, reason: "Not signed in — use Login & sync first." };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status} while fetching the brief.` };
    const data = await res.json();
    await put("kv", { key: "lastBrief", value: { pulledAt: new Date().toISOString(), serverUrl: base, brief: data } });
    return { ok: true, brief: data };
  } catch (e) {
    return { ok: false, reason: friendlyError(e, base) };
  } finally {
    done();
  }
}

/** Push a local script draft into the server workspace. */
export async function pushScript(serverUrl, script) {
  const base = normalize(serverUrl);
  const { signal, done } = withTimeout(8000);
  try {
    const res = await fetch(`${base}/api/scripts`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: script.title, hook: script.hook, body: script.body, platform: script.platform }),
      signal,
    });
    if (res.status === 401) return { ok: false, reason: "Not signed in — use Login & sync first." };
    if (!res.ok) return { ok: false, reason: `Server refused the push (HTTP ${res.status}).` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id || data.script?.id || null };
  } catch (e) {
    return { ok: false, reason: friendlyError(e, base) };
  } finally {
    done();
  }
}

/** Push every unsynced local script; returns a summary (no silent skips). */
export async function pushAllUnsynced(serverUrl) {
  const scripts = (await getAll("scripts")).filter((s) => !s.synced);
  const results = [];
  for (const s of scripts) {
    const r = await pushScript(serverUrl, s);
    if (r.ok) {
      await put("scripts", { ...s, synced: true, syncedAt: new Date().toISOString() });
    }
    results.push({ title: s.title, ok: r.ok, reason: r.reason });
  }
  return { pushed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok), total: results.length };
}
