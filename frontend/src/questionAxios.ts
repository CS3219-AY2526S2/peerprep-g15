import axios, { type AxiosInstance } from 'axios';
import authAxios from './authAxios';

const questionAxios: AxiosInstance = axios.create({
    baseURL: 'http://localhost:3002',
    timeout: 10000,
    withCredentials: true,
});

questionAxios.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

questionAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            console.log('error 401 detected, attempting token refresh:', error);

            try {
                const refreshResponse = await authAxios.post('/auth/refresh');

                const newAccessToken = refreshResponse.data.accessToken;
                localStorage.setItem('accessToken', newAccessToken);

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                console.log('Token refreshed, retrying original request with new token');

                return questionAxios(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('name');
                window.location.href = '/';
                console.error('Token refresh failed, redirecting to login', refreshError);
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    },
);

export default questionAxios;
