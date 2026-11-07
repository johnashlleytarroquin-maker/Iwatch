import { API_URL } from './config';

let token = null;
let onUnauthorized = null;

export const setToken = (t) => {
  token = t;
};
export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, path, body) {
  let res;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  // 35-second timeout to allow Render free tier to wake up from cold start
  const timeoutId = setTimeout(() => {
    if (controller) controller.abort();
  }, 35000);

  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller ? controller.signal : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`The cloud server is taking longer than usual to respond (it may be waking up from sleep). Please tap again.`);
    }
    throw new Error(`Cannot reach the cloud server. Please check your cellular data or Wi-Fi connection and try again.`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    // Session ended (expired token, or admin disabled this account): sign out
    const sessionDead = res.status === 401 || (res.status === 403 && data.error === 'Account is not active');
    if (sessionDead && token && onUnauthorized) onUnauthorized();
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  patch: (p, b) => request('PATCH', p, b || {}),
};
