import axios from 'axios';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance with base URL
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Log errors in dev only
        if (import.meta.env.DEV) {
            console.error('API Error:', error.response?.data || error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
