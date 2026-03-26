import express from 'express';
import { openDb } from '../dbUtils.js'
import { authMiddleware } from '../middleware/middleAuth.js';

const router = express.Router();

// ------------------------------------------- projects list with preview
router.get('/api/projects', authMiddleware, async (req, res) => {

    try {
        const db = await openDb();
        const userId = req.user.id


        // look up for confirm link
        const projectListSql = 'SELECT projectId,name,preview,modified FROM projects WHERE userId = ?'
        const projectListResult = await db.all(projectListSql, [userId]);
        if (!projectListResult)
            return res.status(200).json({
                success: false,
                code: 2, message: 'Confirmation link not found!'
            });


        return res.status(200).json({
            success: true,
            data: projectListResult
        });
    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }

})

// load project - USER VERIFICATION removed
router.get('/api/projects/:projectId', authMiddleware, async (req, res) => {

    try {

        const db = await openDb();
        const { projectId } = req.params;

        // look up for confirm link
        const projectLoadSql = 'SELECT projectId,name,schema FROM projects WHERE projectId = ?'
        const projectLoadResult = await db.get(projectLoadSql, [projectId]);
        if (!projectLoadResult)
            return res.status(200).json({
                success: false,
                code: 2, message: 'project not found!'
            });


        return res.status(200).json({
            success: true,
            data: projectLoadResult
        });
    } catch (err) {
        console.error('error:', err);
        res.status(400).json({
            success: false,
            code: 2, message: err.stack
        });
    }

})
// save new project
router.post('/api/projects', authMiddleware, async (req, res) => {
    try {
        const db = await openDb()
        const userId = req.user.id
        const { name, schema, preview, created, modified } = req.body;
        const saveProjectSql = `INSERT INTO projects (userId,name,schema,preview,created,modified) VALUES (?,?,?,?,?,?)`
        const saveProjectResult = await db.run(saveProjectSql, [userId, name, JSON.stringify(schema), preview, created, modified]);


        const newProject = {
            projectId: saveProjectResult.lastID, // Вот здесь берем автоинкрементный ID
            userId,
            name,
            schema,
            preview,
            created,
            modified
        };

        return res.status(201).json({
            success: true,
            data: newProject
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }
})

// delete
router.delete('/api/projects/:projectId', authMiddleware, async (req, res) => {
    try {
        const db = await openDb()
        const userId = req.user.id
        const { projectId } = req.params;
        const deleteProjectSql = `DELETE FROM projects WHERE userId = ? and projectId = ?`
        const deleteProjectResult = await db.run(deleteProjectSql, [userId, projectId]);


        if (deleteProjectResult.changes)
            return res.status(201).json({ success: true });

        return res.status(400).json({
            success: false,
            code: 1, message: 'cannot delete project'
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }
})

// rename
router.patch('/api/projects/:projectId', authMiddleware, async (req, res) => {
    try {


        const db = await openDb()
        const userId = req.user.id
        const { projectId } = req.params;
        const { newName, modified } = req.body;



        const renameProjectSql = `UPDATE projects SET name = ?, modified = ? WHERE userId = ? and projectId = ?`
        const renameProjectResult = await db.run(renameProjectSql, [newName, modified, userId, projectId]);


        if (renameProjectResult.changes)
            return res.status(200).json({ success: true });

        return res.status(404).json({
            success: false,
            code: 1, message: 'cannot rename project'
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }
})

export default router;