import axios from 'axios';

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : '/';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export async function apiGet(path, params = {}) {
  const response = await client.get(path, { params });
  return response.data;
}

export async function apiPost(path, payload = {}, config = {}) {
  const response = await client.post(path, payload, config);
  return response.data;
}
