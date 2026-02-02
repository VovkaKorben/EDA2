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






app.use(notFound);
app.use(errorHandler);


