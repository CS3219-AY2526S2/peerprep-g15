import axios from 'axios';
import authAxios from './authAxios';
import { useNavigate } from 'react-router';

const userAxios = axios.create({
    baseURL: 'http://localhost:3001',
    withCredentials: true,
});

userAxios.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('accessToken');

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

userAxios.interceptors.response.use(
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

                return userAxios(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('name');
                const navigate = useNavigate();
                navigate('/');
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    },
);

export default userAxios;
