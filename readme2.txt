https://github.com/VovkaKorben/EDA.git

плата 50*100 мм
шаг сетки 0,125
итого узлов 50/0,125 = 400-2 (минус край)
итого узлов 50/0,125 = 800-2 (минус край)
всего узлов 398*798 = 317604







mouse move
-------------------------
drag mode: IDLE
findPinAt? highlight pin - если к нему ЕЩЕ нет проводов
findElemAt? highlight elem
findWireAt? highlight wire segment

drag mode: DRAG
----------------------
mouse on elem -> drag elem(s) + recalc wires
else drag canvas


mouse down
-------------------------

click at pin: если к нему ЕЩЕ нет проводов, запускаем А* on-the-fly (rubber mode)
click at elem: (no shift ->  clear all selected)  toggle curr elem selection 
click at wire: select wire (segment/all ?)


keyboards event
-------------------------------
esc - отменяет резинку провода
del - если выбран элемент(ы)/провод - удаляет его (для провода наверно всё удаляет, чтобы наш Т-коннект не остался в воздухе)



Это работает по простым правилам (при повороте против часовой стрелки):90 градусов: меняешь местами X и Y, затем у нового X меняешь знак на противоположный. Было $(x, y)$ — стало $(-y, x)$.180 градусов: координаты остаются на своих местах, но у обеих меняется знак. Было $(x, y)$ — стало $(-x, -y)$.270 градусов (или -90): меняешь местами X и Y, затем у нового Y меняешь знак. Было $(x, y)$ — стало $(y, -x)$.



// Логика для getObjectUnderCursor
const TOLERANCE = 0.3; // Допуск в "попугаях" для удобства клика

for (const wire of wires) {
    for (let i = 0; i < wire.path.length - 1; i++) {
        const [x1, y1] = wire.path[i];
        const [x2, y2] = wire.path[i + 1];
        const [mx, my] = mouseParrotPos; // Позиция мыши в попугаях

        // Если это горизонтальный сегмент (y одинаковый)
        if (y1 === y2) {
            if (Math.abs(my - y1) < TOLERANCE && 
                mx >= Math.min(x1, x2) - TOLERANCE && 
                mx <= Math.max(x1, x2) + TOLERANCE) {
                return { type: ObjectType.WIRE, wireId: wire.id, pos: [Math.round(mx), y1] };
            }
        }
        // Если это вертикальный сегмент (x одинаковый)
        else if (x1 === x2) {
            if (Math.abs(mx - x1) < TOLERANCE && 
                my >= Math.min(y1, y2) - TOLERANCE && 
                my <= Math.max(y1, y2) + TOLERANCE) {
                return { type: ObjectType.WIRE, wireId: wire.id, pos: [x1, Math.round(my)] };
            }
        }
    }
}


навели
компонент/пин/провод/т-конн - подсветился


компонент тягать можем
провод/пин/т-конн нет


режим роута 
не работает зум и перемещение холста




 // if (dragMode.current === DragModeType.ROUTING && aStarRef.current) { drawGridDebug(ctx, aStarRef.current, GlobalToScreen); }
        // elementes

        /* Object.values(schemaElements.elements).forEach(elem => {// each element on schematic
             // Рисуем сетку А*, если мы в режиме роутинга
 
 
             // Подсветка пинов и узлов (PIN / TCONN) 
             if (hovered.type === ObjectType.PIN || hovered.type === ObjectType.TCONN) {
                 let drawPoint;
                 if (hovered.type === ObjectType.PIN) {
                     drawPoint = pinToCoords(hovered);
 
                 } else if (hovered.type === ObjectType.TCONN) {
                     //
                 }
                 drawPoint = GlobalToScreen(drawPoint);
                 ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
                 ctx.beginPath();
                 ctx.arc(...drawPoint, 5, 0, 2 * Math.PI);
                 ctx.fill();
             }
         });
         */
        /*
        // Отрисовка проводов (существующих)
            schemaElements.wires.forEach(wire => {
            let isHovered = (hovered.type === ObjectType.WIRE && hovered.wireId === wire.id);
            // Рисуем линию. Если isHovered — делаем её толще или ярче.
        });
 
        // Отрисовка элементов и их пинов
       
*/
        // wires



const packRects5 = (inputRects) => {
    // Фиксируем исходные размеры, так как геттеры в Rect зависят от l/r
    const items = inputRects.map(r => ({
        obj: r,
        w: r.r - r.l,
        h: r.b - r.t
    }));

    // Сортировка по длинной стороне (традиционно для плотной упаковки)
    items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

    let binW = 0;
    let binH = 0;
    let freeRects = [];
    const packedRects = [];
    const E = 0.001;

    // Вспомогательная функция для вставки нового свободного ректа с проверкой на поглощение
    const addFreeRect = (rect) => {
        if (rect.w <= E || rect.h <= E) return;
        // Если новая область уже внутри существующей — игнорируем
        for (let i = 0; i < freeRects.length; i++) {
            if (rect.inRect(freeRects[i])) return;
        }
        // Удаляем те, что теперь оказались внутри новой
        freeRects = freeRects.filter(f => !f.inRect(rect));
        freeRects.push(rect);
    };

    for (const item of items) {
        let bestIdx = -1;
        let minShortSide = Infinity;
        let rotated = false;

        // 1. Поиск лучшего места (Best Short Side Fit)
        for (let i = 0; i < freeRects.length; i++) {
            const f = freeRects[i];
            // Без поворота
            if (f.w >= item.w - E && f.h >= item.h - E) {
                const ss = Math.min(f.w - item.w, f.h - item.h);
                if (ss < minShortSide) { minShortSide = ss; bestIdx = i; rotated = false; }
            }
            // С поворотом
            if (f.w >= item.h - E && f.h >= item.w - E) {
                const ss = Math.min(f.w - item.h, f.h - item.w);
                if (ss < minShortSide) { minShortSide = ss; bestIdx = i; rotated = true; }
            }
        }

        // 2. Расширение (если не влезло)
        if (bestIdx === -1) {
            const canGrowRight = (binW <= binH);
            const w = rotated ? item.h : item.w;
            const h = rotated ? item.w : item.h;

            if (canGrowRight) {
                const growW = Math.max(item.w, item.h); // запас под поворот
                const newArea = new Rect(binW, 0, binW + growW, Math.max(binH, growW));
                // Добавляем новую полосу и объединяем с потенциальными дырами
                addFreeRect(newArea);
                binW += growW;
                binH = Math.max(binH, growW);
            } else {
                const growH = Math.max(item.w, item.h);
                const newArea = new Rect(0, binH, Math.max(binW, growH), binH + growH);
                addFreeRect(newArea);
                binH += growH;
                binW = Math.max(binW, growH);
            }
            
            // Повторный поиск после расширения
            return packRects(inputRects); 
        }

        // 3. Размещение
        const f = freeRects[bestIdx];
        const w = rotated ? item.h : item.w;
        const h = rotated ? item.w : item.h;

        const rect = item.obj;
        rect.l = f.l;
        rect.t = f.t;
        rect.r = rect.l + w;
        rect.b = rect.t + h;
        rect.rotateIndex = rotated ? 1 : 0;
        packedRects.push(rect);

        // 4. Расщепление ВСЕХ пересекающихся свободных прямоугольников
        const nextFree = [];
        const placed = new Rect(rect.l, rect.t, rect.r, rect.b);

        for (const free of freeRects) {
            if (!free.intersects(placed)) {
                nextFree.push(free);
                continue;
            }
            // Делим на 4 части
            if (placed.t > free.t) nextFree.push(new Rect(free.l, free.t, free.r, placed.t));
            if (placed.b < free.b) nextFree.push(new Rect(free.l, placed.b, free.r, free.b));
            if (placed.l > free.l) nextFree.push(new Rect(free.l, free.t, placed.l, free.b));
            if (placed.r < free.r) nextFree.push(new Rect(placed.r, free.t, free.r, free.b));
        }
        
        // Очистка списка (удаление дубликатов и вложенных)
        freeRects = [];
        nextFree.forEach(addFreeRect);
    }

    // Подрезаем итоговые габариты до реально занятых
    binW = Math.max(...packedRects.map(r => r.r), 0);
    binH = Math.max(...packedRects.map(r => r.b), 0);

    return { binW, binH, rects: packedRects };
};

const packRects = (inputRects) => {
    let binW = 0;
    let binH = 0;
    let freeRects = [];
    const packedRects = [];

    // place find (BSSF)
    const findBestFit = (rect, freeRects) => {
        let bestRect = null;
        let minShortSideFit = Infinity;
        let rotated = 0;

        for (const free of freeRects) {
            // Проверка без поворота
            if (geq(free.w, rect.w, E) && geq(free.h, rect.h, E)) {
                const leftoverW = free.w - rect.w;
                const leftoverH = free.h - rect.h;
                const shortSideFit = Math.min(leftoverW, leftoverH);

                if (shortSideFit < minShortSideFit) {
                    minShortSideFit = shortSideFit;
                    bestRect = free;
                    rotated = 0;
                }
            }
            // Проверка с поворотом на 90 градусов
            if (geq(free.w, rect.h, E) && geq(free.h, rect.w, E)) {
                const leftoverW = free.w - rect.h;
                const leftoverH = free.h - rect.w;
                const shortSideFit = Math.min(leftoverW, leftoverH);

                if (shortSideFit < minShortSideFit) {
                    minShortSideFit = shortSideFit;
                    bestRect = free;
                    rotated = 1;
                }
            }
        }
        return { bestRect, rotated };
    }


    // РАСШИРЕНИЕ КОНТЕЙНЕРА
    const expandBin = (rect) => {
        // const canGrowRight = (binW + rect.w) * Math.max(binH, rect.h);
        // const canGrowDown = (binH + rect.h) * Math.max(binW, rect.w);
        // if (canGrowRight < canGrowDown) {
        if (leq(binW, binH)) {
            // Добавляем основную свободную область справа
            const newFreeRight = new Rect(binW, 0, binW + rect.w, Math.max(binH, rect.h));
            freeRects.push(newFreeRight);

            // Спасаем угловую зону снизу (если фигура выше текущей корзины)
            if (rect.h > binH) {
                const newFreeBottom = new Rect(0, binH, binW, rect.h);
                freeRects.push(newFreeBottom);
                stitchFreeRects(newFreeBottom);
            }

            binW += rect.w;
            binH = Math.max(binH, rect.h);
            stitchFreeRects(newFreeRight);
        } else {
            // Добавляем основную свободную область снизу
            const newFreeBottom = new Rect(0, binH, Math.max(binW, rect.w), binH + rect.h);
            freeRects.push(newFreeBottom);

            // Спасаем угловую зону справа (если фигура шире текущей корзины)
            if (rect.w > binW) {
                const newFreeRight = new Rect(binW, 0, rect.w, binH);
                freeRects.push(newFreeRight);
                stitchFreeRects(newFreeRight);
            }

            binH += rect.h;
            binW = Math.max(binW, rect.w);
            stitchFreeRects(newFreeBottom);
        }
    }

    // ОБНОВЛЕНИЕ СВОБОДНЫХ ОБЛАСТЕЙ
    const updateFreeRects = (placedRect) => {
        const newList = [];
        for (const free of freeRects) {
            if (free.intersects(placedRect)) {
                // cut first free into 4 pieces

                if (placedRect.t > free.t) { // top
                    newList.push(new Rect(free.l, free.t, free.r, placedRect.t));
                }
                if (placedRect.b < free.b) { // bottom
                    newList.push(new Rect(free.l, placedRect.b, free.r, free.b));
                }
                if (placedRect.l > free.l) { // left
                    newList.push(new Rect(free.l, free.t, placedRect.l, free.b));
                }
                if (placedRect.r < free.r) { // right
                    newList.push(new Rect(placedRect.r, free.t, free.r, free.b));
                }
            } else {
                newList.push(free)
            }
        }
        // Удаляем дубликаты и те, что внутри других
        freeRects = cleanUp(newList)
    }

    const cleanUp = (list) => {
        const listLen = list.length;
        const redundant = new Set();
        for (let i = 0; i < listLen; i++) {
            for (let j = 0; j < listLen; j++) {
                if (i === j) continue;
                // Если область i полностью поглощена областью j
                if (list[i].inRect(list[j])) {
                    // Если они идентичны, выживает та, у которой индекс меньше
                    if (!list[j].inRect(list[i]) || i > j) {
                        redundant.add(i);
                    }
                }
            }
        }
        return list.filter((r, i) => !redundant.has(i));
    }


    const stitchFreeRects = (newArea) => {
        // Перебираем с конца, чтобы безопасно удалять элементы
        for (let i = freeRects.length - 1; i >= 0; i--) {
            const current = freeRects[i];

            if (current === newArea) continue;

            // 1. Попытка слияния по горизонтали (если стоят бок о бок)
            if (floatEqual(current.t, newArea.t) && floatEqual(current.b, newArea.b)) {
                // Если текущий прямоугольник примыкает СЛЕВА к новому
                if (floatEqual(current.r, newArea.l)) {
                    newArea.l = current.l;
                    freeRects.splice(i, 1);
                }
                // Если текущий прямоугольник примыкает СПРАВА к новому
                else if (floatEqual(newArea.r, current.l)) {
                    newArea.r = current.r;
                    freeRects.splice(i, 1);
                }
            }
            // 2. Попытка слияния по вертикали (если стоят друг на друге)
            else if (floatEqual(current.l, newArea.l) && floatEqual(current.r, newArea.r)) {
                // Если текущий прямоугольник примыкает СВЕРХУ к новому
                if (floatEqual(current.b, newArea.t)) {
                    newArea.t = current.t;
                    freeRects.splice(i, 1);
                }
                // Если текущий прямоугольник примыкает СНИЗУ к новому
                else if (floatEqual(newArea.b, current.t)) {
                    newArea.b = current.b;
                    freeRects.splice(i, 1);
                }
            }
        }
    }

    try {
        // Sort inputRects by Area descending
        inputRects.sort((a, b) => b.area - a.area);

        for (let rect of inputRects) {
            // 1. Пытаемся найти место в текущих границах
            let fit = findBestFit(rect, freeRects);

            // 2. Если место не найдено, расширяем контейнер
            if (fit.bestRect === null) {
                expandBin(rect);
                fit = findBestFit(rect, freeRects);
            }

            let bestFreeRect = fit.bestRect;
            rect.rotateIndex = fit.rotated;

            // 3. Размещаем прямоугольник с учетом возможного поворота
            const finalW = rect.rotateIndex ? rect.h : rect.w;
            const finalH = rect.rotateIndex ? rect.w : rect.h;

            rect.l = bestFreeRect.l //+ (bestFreeRect.w - finalW) / 2;
            rect.t = bestFreeRect.t //+ (bestFreeRect.h - finalH) / 2;
            rect.r = rect.l + finalW;
            rect.b = rect.t + finalH;
            packedRects.push(rect);

            // 4. Обновляем список свободных областей (Split & Prune)
            updateFreeRects(rect);
        }
        return {
            binW: binW,
            binH: binH,
            rects: packedRects
        }
    } catch (e) {

        throw new Error(`packRects error: ${e.message}`);
    }
};
