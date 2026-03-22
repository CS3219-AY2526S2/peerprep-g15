import axios, { type AxiosInstance } from 'axios';

// Define the Axios instance
const axiosInstance: AxiosInstance = axios.create({
    baseURL: 'http://localhost:3001',
    timeout: 10000,
    withCredentials: true,
});

export default axiosInstance;
