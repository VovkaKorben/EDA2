import axios from 'axios';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

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
            if (isRefreshing) {
                // Если обновление уже идет, кладем запрос в очередь
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const rfToken = localStorage.getItem('refreshToken');
                if (!rfToken) throw new Error('No refresh token');

                const res = await axios.post('http://localhost:3333/api/refresh', { refreshToken: rfToken });
                const { accessToken, refreshToken } = res.data;

                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', refreshToken);

                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Выходим только если сервер явно сказал, что токен невалиден (401 или 403)
                if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
                    if (injectLogout) injectLogout();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

/*
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
*/
// Сюда мы "подселим" функцию выхода позже
export let injectLogout = null;

export const setLogoutHandler = (handler) => {
    injectLogout = handler;
};

export default api;