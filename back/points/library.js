import express from 'express';
import { openDb } from '../dbUtils.js'
const router = express.Router();

router.get('/api/library', async (req, res) => {

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
router.get('/api/packages', async (req, res) => {

    try {
        const db = await openDb();
        const data = await db.all(`select packageId,typeId,name from phys order by name`);
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
router.post('/api/packages', async (req, res) => {

    try {
        const db = await openDb();

        const ids = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Массив ID не передан' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT * FROM phys WHERE packageId IN (${placeholders})`;
        const data = await db.all(sql, ids);
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

export default router;