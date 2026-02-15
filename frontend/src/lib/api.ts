import axios, { type AxiosRequestConfig } from 'axios';
import { authStorage } from './authStorage';

// Create axios instance with base configuration
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth token
api.interceptors.request.use(
    (config) => {
        const token = authStorage.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized (e.g., redirect to login)
            authStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export interface RequestConfig extends AxiosRequestConfig {
    skipAuth?: boolean;
}

export default api;
