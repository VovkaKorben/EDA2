{/* <div className="prettify">{prettify(specie_data[food_id], 0)}</div> */}

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