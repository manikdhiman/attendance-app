import axios from 'axios';

// Defaults directly to your live Render backend if env variable is missing
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://attendance-app-xzxf.onrender.com/api',
});

// Attach token interceptor if present
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;