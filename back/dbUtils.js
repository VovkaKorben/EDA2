import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/*
export async function openDb() {
    return open({
        filename: './test.db', // Путь к вашему файлу БД
        driver: sqlite3.Database
    });
}
*/

// Хелпер для красивой подстановки параметров вместо '?'
function formatSqlLog(sql, params) {
    if (!params || params.length === 0) return sql;

    let paramIndex = 0;
    // Заменяем каждый знак вопроса на параметр
    return sql.replace(/\?/g, () => {
        if (paramIndex >= params.length) return '?'; // На случай ошибок

        const val = params[paramIndex++];

        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val}'`; // Оборачиваем строки в кавычки
        if (val instanceof Date) return `'${val.toISOString()}'`; // Даты в строки
        return val; // Числа и булевы оставляем как есть
    });
}




export async function openDb(debug = false) {
    sqlite3.verbose();
    const dbPath = path.resolve(__dirname, 'db.db3');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    if (!debug) {
        return db;
    }

    const methodsToLog = ['run', 'get', 'all', 'exec'];

    methodsToLog.forEach((methodName) => {
        const originalMethod = db[methodName].bind(db);

        db[methodName] = async function (sql, params) {
            // 1. Формируем красивый SQL
            const completeQuery = formatSqlLog(sql, params);

            console.log(`\n🟦 [SQL ${methodName.toUpperCase()}]:`);
            console.log(`   📝 ${completeQuery}`);

            // 2. Выполняем реальный запрос
            const result = await originalMethod(sql, params);

            // 3. Логируем результат (НОВОЕ)
            let rowsLog = '';

            if (methodName === 'run') {
                // Для INSERT/UPDATE/DELETE выводим изменения и ID
                rowsLog = `Changes: ${result.changes}, LastID: ${result.lastID}`;
            } else if (methodName === 'all') {
                // Для SELECT (список) выводим длину массива
                rowsLog = `Rows returned: ${result.length}`;
            } else if (methodName === 'get') {
                // Для SELECT (одна запись) проверяем, нашлось ли что-то
                rowsLog = result ? 'Rows returned: 1' : 'Rows returned: 0';
            }

            if (rowsLog) {
                console.log(`   📊 ${rowsLog}`);
            }

            console.log('------------------------------------------------');

            return result;
        };
    });
    return db;

}