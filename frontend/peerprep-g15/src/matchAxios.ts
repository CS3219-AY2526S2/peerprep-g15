import axios, { type AxiosInstance } from 'axios';
import authAxios from './authAxios';

const matchAxios: AxiosInstance = axios.create({
    baseURL: 'http://localhost:3003',
    timeout: 20000,
    withCredentials: true,
});

matchAxios.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

matchAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshResponse = await authAxios.post('/auth/refresh');

                const newAccessToken = refreshResponse.data.accessToken;
                localStorage.setItem('accessToken', newAccessToken);

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                console.log('Token refreshed, retrying original request with new token');

                return matchAxios(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('name');
                window.location.href = '/';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    },
);

export default matchAxios;
