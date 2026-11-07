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
  const timeoutId = setTimeout(() => {
    if (controller) controller.abort();
  }, 9000); // 9 second timeout

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
      throw new Error(`Connection timed out (${API_URL}). Please ensure the server ('npm start') is running on your computer.`);
    }
    throw new Error(`Cannot reach server at ${API_URL}. Check your Wi-Fi connection and make sure 'npm start' is running.`);
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
