{/* <div className="prettify">{prettify(specie_data[food_id], 0)}</div> */ }

/**
 * Выводит объект JavaScript (JSON) в строку с ограничением глубины форматирования.
 * @param {object} obj - Объект для форматирования.
 * @param {number} maxDepth - Максимальный уровень вложенности для построчного форматирования (0 для корневого объекта).
 * @param {number} [currentDepth=0] - Текущий уровень вложенности (для рекурсии).
 * @param {number} [indentSpaces=2] - Количество пробелов для отступа.
 * @returns {string} Строковое представление JSON.
 */
export function prettify(obj, maxDepth, currentDepth = 0, indentSpaces = 2) {
    // Если объект имеет тип, который не является объектом (или массивом) ИЛИ это null,
    // просто возвращаем его строковое представление.
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    // Если текущая глубина превышает максимальную, 
    // форматируем весь оставшийся объект в ОДНУ строку.
    if (currentDepth >= maxDepth) {
        return JSON.stringify(obj);
    }

    const indent = ' '.repeat(indentSpaces);
    let output = '';

    if (Array.isArray(obj)) {
        output += '[\n';
        for (let i = 0; i < obj.length; i++) {
            const value = prettify(obj[i], maxDepth, currentDepth + 1, indentSpaces);

            // Добавляем отступ для текущего уровня
            output += indent.repeat(currentDepth + 1) + value;

            // Добавляем запятую и новую строку, если это не последний элемент
            if (i < obj.length - 1) {
                output += ',\n';
            } else {
                output += '\n';
            }
        }
        output += indent.repeat(currentDepth) + ']';
    } else { // Обработка объектов
        const keys = Object.keys(obj);
        output += '{\n';

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = prettify(obj[key], maxDepth, currentDepth + 1, indentSpaces);

            // Форматируем "ключ": значение
            output += indent.repeat(currentDepth + 1) + JSON.stringify(key) + ': ' + value;

            // Добавляем запятую и новую строку, если это не последний элемент
            if (i < keys.length - 1) {
                output += ',\n';
            } else {
                output += '\n';
            }
        }
        output += indent.repeat(currentDepth) + '}';
    }

    return output;
}

/**
 * Улучшенная версия prettify с поддержкой типизированных массивов (Float32Array и др.)
 */
export function prettify_v2(obj, maxDepth, currentDepth = 0, indentSpaces = 2) {
    // 1. Обработка строк с обрезкой
    if (typeof obj === 'string') {
        const truncated = obj.length > 50 ? obj.slice(0, 50) + '...' : obj;
        return JSON.stringify(truncated);
    }

    // 2. Базовые типы (числа, null и т.д.)
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    // 3. Рекурсивная обрезка при достижении лимита глубины
    if (currentDepth >= maxDepth) {
        const tr = (v) => {
            if (typeof v === 'string') return v.length > 50 ? v.slice(0, 50) + '...' : v;
            if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) {
                return Array.isArray(v) ? v.map(tr) : Object.fromEntries(Object.entries(v).map(([k, val]) => [k, tr(val)]));
            }
            return v;
        };
        return JSON.stringify(tr(obj));
    }

    const indent = ' '.repeat(indentSpaces);
    let output = '';

    // Проверяем: обычный ли это массив ИЛИ типизированный (Float32Array и т.д.)
    const isArrayLike = Array.isArray(obj) || ArrayBuffer.isView(obj);

    if (isArrayLike) {
        output += '[\n';
        // Для типизированных массивов цикл for работает так же корректно
        for (let i = 0; i < obj.length; i++) {
            const value = prettify_v2(obj[i], maxDepth, currentDepth + 1, indentSpaces);
            output += indent.repeat(currentDepth + 1) + value;

            if (i < obj.length - 1) {
                output += ',\n';
            } else {
                output += '\n';
            }
        }
        output += indent.repeat(currentDepth) + ']';
    } else {
        const keys = Object.keys(obj);
        output += '{\n';

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // const value = prettify_v2(obj[key], maxDepth, currentDepth + 1, indentSpaces);

            // Стало (точечная замена):
            let valRaw = obj[key];
            if (typeof valRaw === 'string' && valRaw.length > 50) valRaw = valRaw.slice(0, 50) + '...';
            const value = (currentDepth + 1 >= maxDepth && typeof valRaw === 'object' && valRaw !== null)
                ? JSON.stringify(valRaw)
                : prettify_v2(valRaw, maxDepth, currentDepth + 1, indentSpaces);


            output += indent.repeat(currentDepth + 1) + JSON.stringify(key) + ': ' + value;

            if (i < keys.length - 1) {
                output += ',\n';
            } else {
                output += '\n';
            }
        }
        output += indent.repeat(currentDepth) + '}';
    }

    return output;
}

export function prettify_v3(obj, maxDepth, currentDepth = 0, indentSpaces = 2) {
    // 1. Если это строка — режем сразу
    if (typeof obj === 'string') {
        const truncated = obj.length > 50 ? obj.slice(0, 50) + '...' : obj;
        return JSON.stringify(truncated);
    }

    // 2. Если не объект — возвращаем как есть
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    // 3. ФИКС: Убрали выход по currentDepth >= maxDepth отсюда.
    // Теперь функция всегда заходит в отрисовку структуры.

    const indent = ' '.repeat(indentSpaces);
    let output = '';
    const isArrayLike = Array.isArray(obj) || ArrayBuffer.isView(obj);

    if (isArrayLike) {
        output += '[\n';
        for (let i = 0; i < obj.length; i++) {
            // Если достигли глубины — схлопываем вложенности в строку, если нет — рекурсия
            const value = (currentDepth >= maxDepth) 
                ? JSON.stringify(obj[i]) 
                : prettify_v2(obj[i], maxDepth, currentDepth + 1, indentSpaces);
            
            output += indent.repeat(currentDepth + 1) + value;
            output += (i < obj.length - 1) ? ',\n' : '\n';
        }
        output += indent.repeat(currentDepth) + ']';
    } else {
        const keys = Object.keys(obj);
        output += '{\n';
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const valRaw = obj[key];

            // Если глубина достигнута — пишем значение в строку, иначе идем вглубь
            // При этом строки внутри JSON.stringify(valRaw) не порежутся сами по себе,
            // поэтому для строк вызываем prettify_v2 принудительно.
            const value = (typeof valRaw !== 'string' && currentDepth >= maxDepth)
                ? JSON.stringify(valRaw)
                : prettify_v2(valRaw, maxDepth, currentDepth + 1, indentSpaces);

            output += indent.repeat(currentDepth + 1) + JSON.stringify(key) + ': ' + value;
            output += (i < keys.length - 1) ? ',\n' : '\n';
        }
        output += indent.repeat(currentDepth) + '}';
    }

    return output;
}

export function pprint(value, depth = 1) { console.log(prettify(value, depth)); }