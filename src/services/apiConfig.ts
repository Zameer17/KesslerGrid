// Central API Base URL Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
    : (import.meta.env.DEV ? 'http://localhost:5000' : '');
