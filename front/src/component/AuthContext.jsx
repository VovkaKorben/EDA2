import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { setLogoutHandler } from '../helpers/api.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

    const isInitializing = useRef(false);
    // executed once at start
    const [user, setUser] = useState(() => {
        if (localStorage.getItem('refreshToken')) {
            return { email: null, id: null, isLoading: true };
        }
        return null;
    });


    const logout = useCallback(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
    }, []);

    const initialize = useCallback(async () => {
        if (isInitializing.current) return;

        const rfToken = localStorage.getItem('refreshToken');
        if (!rfToken) {
            setUser(null);
            return;
        }

        isInitializing.current = true;
        try {
            const res = await api.get('/me');
            if (res.data?.user) {
                setUser({ ...res.data.user, isLoading: false });
            }
        } catch (e) {
            // Если запрос провалился даже после попытки рефреша в api.js
            logout();
        } finally {
            isInitializing.current = false;
        }
    }, [logout]);

    const login = useCallback(async (tokens) => {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        await initialize();
    }, [initialize]);

    useEffect(() => {
        setLogoutHandler(logout);
        initialize();
    }, [logout, initialize]);


    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};