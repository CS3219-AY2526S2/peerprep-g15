import axios from 'axios';

const collabAxios = axios.create({
    baseURL: 'http://localhost:3004',
    timeout: 10000,
});

export default collabAxios;
