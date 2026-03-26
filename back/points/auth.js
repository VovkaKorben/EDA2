
import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcrypt';
import dotenv from 'dotenv'
dotenv.config()
import { openDb } from '../dbUtils.js'
import { authMiddleware } from '../middleware/middleAuth.js';

const MS_DAY = 1000 * 60 * 60 * 24

const router = express.Router();
const encrypt_password = async (password) => { return bcrypt.hash(password, 10); }
// generate JWT tokens
const generateTokens = (payload) => ({
    accessToken: jwt.sign(payload, process.env.ACCESS_SECRET, { expiresIn: '15m' }),
    refreshToken: jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: `${process.env.TOKEN_VALID}d` })
});
// delete old tokens (once per hour)
setInterval(async () => {
    const db = await openDb();
    await db.run('DELETE FROM pend_users WHERE valid < ?', [Date.now()]);
}, 60 * 60 * 1000);


// ------------------------------------------- confirm user email
router.post('/api/login', async (req, res) => {

    try {

        const { email, password } = req.body;
        const trimmedEmail = email.trim()
        const trimmedPassword = password.trim()

        const db = await openDb();
        if (!trimmedEmail || !trimmedPassword)
            return res.status(200).json({
                success: false,
                code: 2, message: 'E-mail or password is empty!'
            });


        // const encryptedPassword = encrypt_password(trimmedPassword)

        //check user with email exists
        const loginSql = `SELECT * FROM users WHERE email = ?`;
        let loginResult = await db.get(loginSql, [trimmedEmail]);
        if (!loginResult)
            return res.status(200).json({
                success: false,
                code: 2, message: 'E-mail not found.'
            });
        if (!await bcrypt.compare(trimmedPassword, loginResult.password))
            return res.status(200).json({
                success: false,
                code: 2, message: 'Invalid password!'
            });

        // generate tokens
        const userId = loginResult.user_id
        const auth_tokens = generateTokens({
            id: userId,
            login: trimmedEmail
        })
        const saveTokenData = {
            ':user_id': userId,
            ':token': auth_tokens.refreshToken,
            ':expires': Date.now() + process.env.TOKEN_VALID * MS_DAY
        }
        const saveTokenSql = `
                INSERT INTO tokens (user_id, token, expires)
                VALUES(:user_id, :token, :expires)
                ON CONFLICT(user_id) DO UPDATE SET
                    token = excluded.token,
                    expires = excluded.expires
        `
        await db.run(saveTokenSql, saveTokenData)

        return res.status(200).json({
            success: true,
            code: 0,
            accessToken: auth_tokens.accessToken,
            refreshToken: auth_tokens.refreshToken
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            // code: 2, message: err.stack//////
        });
    }

})


// ------------------------------------------- change password
router.post('/api/password', async (req, res) => {
    // change password to new

})
// ------------------------------------------- send to user link with new password generation
router.get('/api/forgot', async (req, res) => {

})

// ------------------------------------------- confirm user email
router.get('/api/confirm/:confirm', async (req, res) => {

    try {
        const db = await openDb();
        const { confirm } = req.params;

        // look up for confirm link
        const pendUserSql = 'SELECT * FROM pend_users WHERE confirm = ?'
        const pendUserResult = await db.get(pendUserSql, [confirm]);
        if (!pendUserResult)
            return res.status(200).json({
                success: false,
                code: 2, message: 'Confirmation link not found!'
            });

        // start transaction
        try {
            await db.run('BEGIN');
            // copy data from pend to main
            const userInsertResult = await db.run('INSERT INTO users (email,password) VALUES (?,?)', [pendUserResult.email, pendUserResult.password]);

            // delete pend data
            await db.run('DELETE FROM pend_users WHERE confirm = ?', [confirm]);


            // generate tokens
            const userId = userInsertResult.lastID;
            const auth_tokens = generateTokens({
                id: userId,
                login: pendUserResult.email
            });
            const saveTokenData = {
                ':user_id': userId,
                ':token': auth_tokens.refreshToken,
                ':expires': Date.now() + process.env.TOKEN_VALID * MS_DAY
            }
            const saveTokenSql = 'INSERT INTO tokens (user_id, token, expires) VALUES (:user_id, :token, :expires)';

            // write tokens to db and finish transaction
            await db.run(saveTokenSql, saveTokenData);
            await db.run('COMMIT');

            // return success + tokens
            res.status(200).json({
                success: true,
                code: 0,
                message: 'auth ok',
                accessToken: auth_tokens.accessToken,
                refreshToken: auth_tokens.refreshToken
            });

        } catch (err) {
            await db.run('ROLLBACK');
            throw err;
        }

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }

})

// ------------------------------------------- register new user
router.post('/api/register', async (req, res) => {
    // put data to pend-table
    // send email with link to user
    try {

        const { email, password } = req.body;
        const trimmedEmail = email.trim()
        const trimmedPassword = password.trim()

        const db = await openDb();
        if (!trimmedEmail || !trimmedPassword)
            return res.status(200).json({
                success: false,
                code: 1, message: 'E-mail or password is empty!'
            });

        //check email exists in both tables
        const checkSql = `SELECT email FROM users WHERE email = ? UNION SELECT email FROM pend_users WHERE email = ?`;
        let checkResult = await db.all(checkSql, [trimmedEmail, trimmedEmail]);
        if (checkResult.length !== 0)
            return res.status(200).json({
                success: false,
                code: 2, message: 'E-mail already taken!'
            });

        const confirm = crypto.randomBytes(32).toString('base64url')
        const pendAddData = {
            ':email': trimmedEmail,
            ':password': await encrypt_password(trimmedPassword),
            ':confirm': confirm,
            ':valid': Date.now() + process.env.REGISTRATION_TOKEN_VALID,
        }


        const pendAddSql = 'INSERT INTO pend_users (email,password,confirm,valid) VALUES (:email,:password,:confirm,:valid)'
        const pendAddResult = await db.run(pendAddSql, pendAddData);

        const emailContent = `Copy this link and paste to browser as url ${process.env.API_URL}:${process.env.API_PORT}/api/confirm/${confirm}`
        const emailData = {
            email: trimmedEmail,
            subject: `Simple EDA registration`,
            text: emailContent

        }


        //  await sendMail(emailData)
        return res.status(200).json({
            success: true,
            code: 0, message: `Confirmation link sent to your e-mail ${emailContent}`,
            // for rest-tesing
            confirm: confirm
        });

    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            success: false,
            code: 2, message: err.stack
        });
    }
});



router.post('/api/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ success: false, message: 'No token' });

        const db = await openDb();

        // 1. Сначала проверяем, есть ли такой токен в нашей базе
        const tokenInDb = await db.get('SELECT * FROM tokens WHERE token = ?', [refreshToken]);
        if (!tokenInDb) {
            return res.status(403).json({ success: false, message: 'Token not in DB or revoked' });
        }

        // 2. Проверяем подпись и срок жизни самого JWT
        jwt.verify(refreshToken, process.env.REFRESH_SECRET, async (err, decoded) => {
            if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });

            // 3. Генерируем новую пару
            const tokens = generateTokens({ id: decoded.id, login: decoded.login });

            // 4. Обновляем токен в базе (UPSERT)
            const updateTokenSql = `
                UPDATE tokens 
                SET token = :token, expires = :expires 
                WHERE user_id = :user_id
            `;
            const updateData = {
                ':token': tokens.refreshToken,
                ':expires': Date.now() + process.env.TOKEN_VALID * MS_DAY,
                ':user_id': decoded.id
            };

            await db.run(updateTokenSql, updateData);

            // 5. Отдаем новую пару клиенту
            res.json({
                success: true,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            });
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.stack });
    }
});


router.delete('/api/dev/clear/:email', async (req, res) => {
    const db = await openDb();
    const { email } = req.params;
    await db.run('DELETE FROM users WHERE email = ?', [email]);
    await db.run('DELETE FROM pend_users WHERE email = ?', [email]);
    await db.run('DELETE FROM tokens WHERE user_id NOT IN (SELECT id FROM users)');
    res.status(200).send('Clean');
});

// Эндпоинт для получения данных о себе
router.get('/api/me', authMiddleware, (req, res) => {
    // Данные уже лежат в req.user благодаря authMiddleware
    res.status(200).json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.login // Та самая почта из токена
        }
    });
});


export default router;