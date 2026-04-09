import express from 'express';
import cors from 'cors';


import { errorHandler, notFound } from './middleware/error.js';

import { sendMail } from './mailer.js';
import { openDb } from './dbUtils.js'

import projectRouter from './points/project.js'
import libraryRouter from './points/library.js'
import authRouter from './points/auth.js'

import dotenv from 'dotenv'
dotenv.config()

const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies


app.use('', projectRouter);
app.use('', libraryRouter);
app.use('', authRouter);





const server = app.listen(process.env.API_PORT, () => {
    console.log(`🟩 API started on ${process.env.API_URL}:${process.env.API_PORT}`);
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
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
app.use(notFound);
app.use(errorHandler);



