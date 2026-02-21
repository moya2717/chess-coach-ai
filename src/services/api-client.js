import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export async function apiGet(path, params = {}) {
  const response = await client.get(path, { params });
  return response.data;
}

export async function apiPost(path, payload = {}) {
  const response = await client.post(path, payload);
  return response.data;
}
