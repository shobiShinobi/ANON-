// Central API client.
//
// Identity model: the 12-word seed is the user's *private key*. It lives ONLY in
// this browser's localStorage (like a crypto wallet) and is sent to the server
// only to authenticate, never stored there in plaintext. The short-lived JWT
// access token is kept in memory (not localStorage) so an XSS bug can't trivially
// exfiltrate a long-lived credential. On expiry we silently re-auth from the seed.

// Same-origin by default. In dev, Vite proxies /api, /uploads and /ws to the
// backend (see vite.config.mjs); in prod, Express serves the built app and API
// from one origin. Override with VITE_API_URL only for split deployments.
const API_BASE = import.meta.env.VITE_API_URL || '';

export const WS_URL = (() => {
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + '/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
})();

const IDENTITY_KEY = 'anon_identity'; // { id, seed }
let accessToken = null;

// ---- identity storage (the "client-held key") ----
export function loadIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveIdentity(identity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}
export function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
  accessToken = null;
}
export function setToken(t) {
  accessToken = t;
}

export function imageUrl(p) {
  if (!p) return null;
  return p.startsWith('http') ? p : `${API_BASE}${p}`;
}

// ---- email hashing (campus verification, computed client-side) ----
export async function hashEmail(email) {
  const buf = new TextEncoder().encode(email.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---- core request wrapper ----
async function request(path, { method = 'GET', body, auth = false, isForm = false, _retry = false } = {}) {
  const headers = {};
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Network error: could not reach the node.', 0);
  }

  // Token expired → attempt one silent re-auth from the stored seed, then retry.
  if (res.status === 401 && auth && !_retry) {
    const reauthed = await silentLogin();
    if (reauthed) return request(path, { method, body, auth, isForm, _retry: true });
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---- auth ----
export async function register({ email, seed, displayName }) {
  const emailHash = await hashEmail(email);
  const data = await request('/api/auth/register', { method: 'POST', body: { emailHash, seed, displayName } });
  accessToken = data.token;
  saveIdentity({ id: data.id, seed });
  return data;
}

export async function login({ id, seed }) {
  const data = await request('/api/auth/login', { method: 'POST', body: { id, seed } });
  accessToken = data.token;
  saveIdentity({ id, seed });
  return data;
}

// Silent re-login using the seed already in localStorage. Returns true on success.
export async function silentLogin() {
  const identity = loadIdentity();
  if (!identity?.id || !identity?.seed) return false;
  try {
    const data = await request('/api/auth/login', { method: 'POST', body: { id: identity.id, seed: identity.seed } });
    accessToken = data.token;
    return true;
  } catch {
    return false;
  }
}

// ---- data ----
export const getMe = () => request('/api/me', { auth: true });
export const getPublicProfile = (id) => request(`/api/users/${id}`);
export const getMana = () => request('/api/me/mana', { auth: true });
export const getFeed = () => request('/api/feed');
export const updateProfile = (patch) => request('/api/me', { method: 'PATCH', auth: true, body: patch });
export const destroyIdentity = () => request('/api/me', { method: 'DELETE', auth: true });

export async function postRumor({ text, imageFile }) {
  const form = new FormData();
  if (text) form.append('text', text);
  if (imageFile) form.append('image', imageFile);
  return request('/api/rumors', { method: 'POST', auth: true, body: form, isForm: true });
}

export const votePost = (id, vote) =>
  request(`/api/rumors/${id}/votes`, { method: 'POST', auth: true, body: { vote } });
