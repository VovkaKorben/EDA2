import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3333/api'
});

// Интерцептор запроса: подкладывает токен в каждый запрос
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const rfToken = localStorage.getItem('refreshToken');
                // Используем чистый axios, чтобы не зациклить интерцептор
                const res = await axios.post('http://localhost:3333/api/refresh', { refreshToken: rfToken });
                
                localStorage.setItem('accessToken', res.data.accessToken);
                localStorage.setItem('refreshToken', res.data.refreshToken);

                originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                if (injectLogout) injectLogout();
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

// Сюда мы "подселим" функцию выхода позже
export let injectLogout = null;

export const setLogoutHandler = (handler) => {
    injectLogout = handler;
};

export default api;