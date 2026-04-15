import authAxios from './authAxios';

export async function refreshAccessToken(): Promise<string> {
    const res = await authAxios.post('/auth/refresh');
    const newToken = res.data.accessToken;
    localStorage.setItem('accessToken', newToken);
    return newToken;
}
