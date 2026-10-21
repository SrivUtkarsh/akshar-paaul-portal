// Central request helper: all REST calls go through this file, and the JWT is
// added here rather than repeated by each page component.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export function authToken() {
  return localStorage.getItem('akshar_token');
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = authToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // Do not set Content-Type for FormData; the browser adds its multipart boundary.
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const result = isJson ? await response.json() : await response.blob();
  if (!response.ok) {
    const error = new Error(result?.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export const jsonBody = (value) => JSON.stringify(value);
