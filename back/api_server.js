import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';


import { errorHandler, notFound } from './middleware/error.js';
import { openDb } from './dbUtils.js';
const API_PORT = 3100;
const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

const server = app.listen(API_PORT, () => {
    console.log(`🟩 API started on http://localhost:${API_PORT}`);
});







app.get('/api/library', async (req, res) => {

    try {
        const db = await openDb();
        const data = await db.all(`select * from library`);
        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            error: err.stack
        });
    }
});
app.get('/api/packages', async (req, res) => {

    try {
        const db = await openDb();
        const data = await db.all(`select * from phys`);
        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            error: err.stack
        });
    }
});

// Функция для очистки ресурсов
const gracefulShutdown = async (signal) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down...`);

    server.close(async () => {
        console.log('🛑 HTTP server closed.');

        try {
            const db = await openDb();
            await db.close();
            console.log('🗄️  Database connection closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error during database closure:', err);
            process.exit(1);
        }
    });
};

// Слушатели сигналов
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));



app.use(notFound);
app.use(errorHandler);


