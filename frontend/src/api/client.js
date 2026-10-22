// One small client for every backend call.
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "adinsight_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

function toMessage(detail, status) {
  if (!detail) return `Request failed (${status})`;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  return JSON.stringify(detail);
}

export function qs(params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) p.append(k, Array.isArray(v) ? v.join(",") : v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function request(method, path, { body, params, raw } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running at " + BASE + "?");
  }
  if (res.status === 401 && token && !path.startsWith("/auth/login")) onUnauthorized();
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch { /* ignore */ }
    throw new Error(toMessage(detail, res.status));
  }
  return raw ? res : res.json();
}

export const api = {
  get: (path, params) => request("GET", path, { params }),
  post: (path, body, params) => request("POST", path, { body, params }),
  put: (path, body) => request("PUT", path, { body }),
  del: (path) => request("DELETE", path),
  async download(path, params, filename) {
    const res = await request("GET", path, { params, raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
