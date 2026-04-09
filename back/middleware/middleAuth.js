import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

// Миддлвара для защиты эндпоинтов
export const authMiddleware = (req, res, next) => {

    if (process.env.NODE_ENV === 'development') {
        req.user = { id: 4}; // Тестовый пользователь для работы эндпоинтов проектов
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_SECRET, (err, user) => {
        if (err) return res.sendStatus(401); // Сюда прилетит, если токен протух
        req.user = user;
        next();
    });
};

