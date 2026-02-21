const TOKEN_KEY = 'chesscoach.supabase.session.v1';
const listeners = new Set();

function getConfig() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function isAuthConfigured() {
  const { url, anonKey } = getConfig();
  return Boolean(url && anonKey);
}

export function getCurrentUser() {
  const session = readSession();
  return session?.user || null;
}

export async function loginWithPassword(email, password) {
  const { url, anonKey } = getConfig();
  if (!url || !anonKey) {
    throw new Error('Missing Supabase auth environment variables.');
  }
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error('Invalid email or password.');
  }
  const payload = await response.json();
  const session = { accessToken: payload.access_token, user: payload.user };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  emitAuthState();
  return session;
}

export async function logoutUser() {
  localStorage.removeItem(TOKEN_KEY);
  emitAuthState();
}

export function subscribeToAuthState(callback) {
  listeners.add(callback);
  callback(getCurrentUser());
  return () => listeners.delete(callback);
}

function emitAuthState() {
  const user = getCurrentUser();
  listeners.forEach((listener) => listener(user));
}

function readSession() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
