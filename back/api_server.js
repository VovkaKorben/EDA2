import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';


import { errorHandler, notFound } from './middleware/error.js';
import { openDb } from './dbUtils.js'
const API_URL = 'http://localhost'
const API_PORT = 3333;
const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies


const ACCESS_SECRET = '^DFbgg34A!&$9874FN2AGFH67d@f1a15g45373'
const REFRESH_SECRET = '13sf354ksl;gk-40090s())ou1ssgrceMa@YFHpscvl23r'
const TOKEN_VALID = 7
const REGISTRATION_TOKEN_VALID = 24 * 60 * 60 * 1000 // 1 day

const now = () => { return Date.now(); }
const encrypt_password = async (password) => { return bcrypt.hash(password, 10); }


var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "cdf85978898207",
        pass: "10306a26daa846"
    }
});
const sendMail = async ({ email, subject, text }) => {
    const info = await transport.sendMail({
        from: '"Simple EDA" <robot@simpleeda.edu>',
        to: email,
        subject: subject,
        text: text,
    });

    //console.log("Message sent:", info.messageId);
}

const server = app.listen(API_PORT, () => {
    console.log(`🟩 API started on ${API_URL}:${API_PORT}`);
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
app.post('/api/packages', async (req, res) => {

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

// generate JWT tokens
const generateTokens = (payload) => ({
    accessToken: jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' }),
    refreshToken: jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${TOKEN_VALID}d` })
});
// delete old tokens (once per hour)
setInterval(async () => {
    const db = await openDb();
    await db.run('DELETE FROM pend_users WHERE valid < ?', [now()]);
}, 60 * 60 * 1000);


// ------------------------------------------- confirm user email
app.post('/api/login', async (req, res) => {

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
            ':expires': now() + (TOKEN_VALID * 24 * 60 * 60 * 1000)
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
app.post('/api/password', async (req, res) => {
    // change password to new

})
// ------------------------------------------- send to user link with new password generation
app.get('/api/forgot', async (req, res) => {

})

// ------------------------------------------- confirm user email
app.get('/api/confirm/:confirm', async (req, res) => {

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
                ':expires': now() + (TOKEN_VALID * 24 * 60 * 60 * 1000)
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
app.post('/api/register', async (req, res) => {
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
            ':valid': now() + REGISTRATION_TOKEN_VALID,
        }


        const pendAddSql = 'INSERT INTO pend_users (email,password,confirm,valid) VALUES (:email,:password,:confirm,:valid)'
        const pendAddResult = await db.run(pendAddSql, pendAddData);

        const emailContent = `Copy this link and paste to browser as url ${API_URL}:${API_PORT}/api/confirm/${confirm}`
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

// Миддлвара для защиты эндпоинтов
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, ACCESS_SECRET, (err, user) => {
        if (err) return res.sendStatus(401); // Сюда прилетит, если токен протух
        req.user = user;
        next();
    });
};

// Пример защищенного эндпоинта с MySQL
app.get('/items', authMiddleware, async (req, res, next) => {
    try {
        // Допустим, тут ошибка в SQL
        // const [rows] = await db.query('SELECT * FROM non_existing_table'); 
        res.json({ data: 'Успех' });
    } catch (err) {
        next(err); // Отправляем ошибку в нашу «обвязку»
    }
});


app.post('/api/refresh', async (req, res) => {
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
        jwt.verify(refreshToken, REFRESH_SECRET, async (err, decoded) => {
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
                ':expires': Date.now() + (TOKEN_VALID * 24 * 60 * 60 * 1000),
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


app.delete('/api/dev/clear/:email', async (req, res) => {
    const db = await openDb();
    const { email } = req.params;
    await db.run('DELETE FROM users WHERE email = ?', [email]);
    await db.run('DELETE FROM pend_users WHERE email = ?', [email]);
    await db.run('DELETE FROM tokens WHERE user_id NOT IN (SELECT id FROM users)');
    res.status(200).send('Clean');
});

// Эндпоинт для получения данных о себе
app.get('/api/me', authMiddleware, (req, res) => {
    // Данные уже лежат в req.user благодаря authMiddleware
    res.status(200).json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.login // Та самая почта из токена
        }
    });
});

// ------------------------------------------- projects list with preview
app.get('/api/projects', authMiddleware, async (req, res) => {

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



