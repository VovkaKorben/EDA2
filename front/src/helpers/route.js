import {
    expandPoint, getPrimitiveBounds, expandBounds, extractCoords, turtleToParams, pinsToParams, expandBoundsByPoint,
    getRectWidth, getRectHeight,
    floatEqual, leq, geq
} from './geo.js';
import { Rect } from './rect.js';

const packRects = (inputRects) => {
    let binW = 0;
    let binH = 0;
    let freeRects = [];
    const packedRects = [];

    // place find (BSSF)
    const findBestFit = (rect, freeRects) => {
        let bestRect = null;
        let minShortSideFit = Infinity;
        let rotated = false;

        for (const free of freeRects) {
            // Проверка без поворота
            if (geq(free.w, rect.w) && geq(free.h, rect.h)) {
                const leftoverW = free.w - rect.w;
                const leftoverH = free.h - rect.h;
                const shortSideFit = Math.min(leftoverW, leftoverH);

                if (shortSideFit < minShortSideFit) {
                    minShortSideFit = shortSideFit;
                    bestRect = free;
                    rotated = false;
                }
            }
            // Проверка с поворотом на 90 градусов
            if (geq(free.w, rect.h) && geq(free.h, rect.w)) {
                const leftoverW = free.w - rect.h;
                const leftoverH = free.h - rect.w;
                const shortSideFit = Math.min(leftoverW, leftoverH);

                if (shortSideFit < minShortSideFit) {
                    minShortSideFit = shortSideFit;
                    bestRect = free;
                    rotated = true;
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
        let isRotated = fit.rotated;

        // 3. Размещаем прямоугольник с учетом возможного поворота
        const finalW = isRotated ? rect.h : rect.w;
        const finalH = isRotated ? rect.w : rect.h;

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
};





/*
const inpRects = [{ "l": 539, "t": 144, "r": 637, "b": 177 }, { "l": 42, "t": 254, "r": 71, "b": 336 }, { "l": 573, "t": 237, "r": 611, "b": 306 }, { "l": 500, "t": 361, "r": 525, "b": 384 }, { "l": 31, "t": 219, "r": 94, "b": 319 }, { "l": 371, "t": 1, "r": 393, "b": 18 }, { "l": 327, "t": 293, "r": 410, "b": 346 }, { "l": 214, "t": 310, "r": 314, "b": 391 }, { "l": 163, "t": 351, "r": 194, "b": 378 }, { "l": 100, "t": 58, "r": 131, "b": 85 }, { "l": 90, "t": 160, "r": 180, "b": 183 }, { "l": 63, "t": 303, "r": 78, "b": 393 }, { "l": 374, "t": 175, "r": 406, "b": 270 }, { "l": 402, "t": 337, "r": 458, "b": 393 }, { "l": 262, "t": 189, "r": 339, "b": 211 }, { "l": 466, "t": 252, "r": 500, "b": 326 }, { "l": 355, "t": 260, "r": 404, "b": 310 }, { "l": 560, "t": 50, "r": 653, "b": 79 }, { "l": 576, "t": 58, "r": 604, "b": 81 }, { "l": 96, "t": 226, "r": 130, "b": 324 }, { "l": 51, "t": 303, "r": 91, "b": 402 }, { "l": 364, "t": 84, "r": 418, "b": 183 }, { "l": 525, "t": 138, "r": 570, "b": 166 }, { "l": 68, "t": 230, "r": 135, "b": 329 }, { "l": 288, "t": 218, "r": 380, "b": 307 }, { "l": 577, "t": 344, "r": 665, "b": 376 }, { "l": 494, "t": 71, "r": 573, "b": 112 }, { "l": 382, "t": 246, "r": 442, "b": 322 }, { "l": 371, "t": 310, "r": 454, "b": 408 }, { "l": 182, "t": 254, "r": 196, "b": 312 }, { "l": 542, "t": 50, "r": 565, "b": 149 }, { "l": 481, "t": 287, "r": 514, "b": 306 }, { "l": 433, "t": 350, "r": 504, "b": 420 }, { "l": 363, "t": 367, "r": 428, "b": 438 }, { "l": 210, "t": 117, "r": 292, "b": 198 }, { "l": 178, "t": 214, "r": 195, "b": 265 }, { "l": 277, "t": 359, "r": 308, "b": 457 }, { "l": 449, "t": 266, "r": 478, "b": 297 }, { "l": 187, "t": 348, "r": 287, "b": 389 }, { "l": 447, "t": 121, "r": 522, "b": 143 }, { "l": 526, "t": 160, "r": 594, "b": 225 }, { "l": 496, "t": 372, "r": 562, "b": 454 }, { "l": 240, "t": 267, "r": 307, "b": 314 }, { "l": 230, "t": 185, "r": 275, "b": 274 }, { "l": 546, "t": 287, "r": 565, "b": 298 }, { "l": 149, "t": 227, "r": 194, "b": 297 }, { "l": 21, "t": 177, "r": 31, "b": 266 }, { "l": 290, "t": 243, "r": 360, "b": 335 }, { "l": 476, "t": 97, "r": 538, "b": 125 }, { "l": 197, "t": 103, "r": 252, "b": 187 }, { "l": 350, "t": 380, "r": 397, "b": 423 }, { "l": 166, "t": 71, "r": 244, "b": 95 }, { "l": 359, "t": 275, "r": 381, "b": 349 }, { "l": 518, "t": 64, "r": 602, "b": 123 }, { "l": 375, "t": 269, "r": 465, "b": 350 }, { "l": 588, "t": 2, "r": 620, "b": 86 }, { "l": 480, "t": 209, "r": 509, "b": 228 }, { "l": 246, "t": 192, "r": 327, "b": 277 }, { "l": 493, "t": 198, "r": 513, "b": 278 }, { "l": 363, "t": 224, "r": 417, "b": 244 }, { "l": 539, "t": 111, "r": 579, "b": 210 }, { "l": 296, "t": 131, "r": 327, "b": 230 }, { "l": 460, "t": 51, "r": 558, "b": 134 }, { "l": 31, "t": 244, "r": 95, "b": 340 }, { "l": 433, "t": 390, "r": 504, "b": 459 }, { "l": 333, "t": 259, "r": 382, "b": 337 }, { "l": 411, "t": 376, "r": 443, "b": 393 }, { "l": 44, "t": 381, "r": 137, "b": 478 }, { "l": 451, "t": 210, "r": 525, "b": 263 }, { "l": 600, "t": 216, "r": 623, "b": 257 }, { "l": 150, "t": 233, "r": 215, "b": 301 }, { "l": 64, "t": 97, "r": 108, "b": 108 }, { "l": 109, "t": 49, "r": 131, "b": 65 }, { "l": 166, "t": 147, "r": 182, "b": 181 }, { "l": 504, "t": 151, "r": 548, "b": 176 }, { "l": 147, "t": 148, "r": 212, "b": 180 }, { "l": 82, "t": 307, "r": 163, "b": 325 }, { "l": 306, "t": 208, "r": 324, "b": 256 }, { "l": 229, "t": 216, "r": 250, "b": 285 }, { "l": 79, "t": 105, "r": 100, "b": 192 }, { "l": 473, "t": 380, "r": 540, "b": 425 }, { "l": 404, "t": 99, "r": 440, "b": 172 }, { "l": 201, "t": 88, "r": 273, "b": 100 }, { "l": 293, "t": 391, "r": 359, "b": 464 }, { "l": 383, "t": 248, "r": 424, "b": 331 }, { "l": 146, "t": 205, "r": 215, "b": 219 }, { "l": 170, "t": 74, "r": 204, "b": 100 }, { "l": 438, "t": 85, "r": 475, "b": 105 }, { "l": 415, "t": 120, "r": 430, "b": 149 }, { "l": 18, "t": 280, "r": 80, "b": 300 }, { "l": 354, "t": 37, "r": 366, "b": 131 }, { "l": 383, "t": 234, "r": 467, "b": 265 }, { "l": 514, "t": 396, "r": 545, "b": 419 }, { "l": 129, "t": 268, "r": 216, "b": 308 }, { "l": 419, "t": 254, "r": 472, "b": 303 }, { "l": 413, "t": 131, "r": 449, "b": 182 }, { "l": 174, "t": 13, "r": 264, "b": 61 }, { "l": 522, "t": 104, "r": 613, "b": 192 }, { "l": 113, "t": 389, "r": 180, "b": 478 }, { "l": 379, "t": 255, "r": 463, "b": 353 }]

const ir = inpRects.map(r => new Rect(r.l, r.t, r.r, r.b));
const r = packRects(ir);
const exportPackedToJson = ({ binW, binH, rects }) => {
    const data = {
        binW: binW,
        binH: binH,
        rects: rects.map(r => ({ l: r.l, t: r.t, r: r.r, b: r.b }))
    };
    return JSON.stringify(data);
};  
console.log(exportPackedToJson(r));
*/






const fetchPackages = async (packageIds) => {
    try {
        const resp = await fetch(`${API_URL}packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([...packageIds])
        });
        const result = await resp.json();
        if (!(resp.ok && result.success)) throw new Error('error fetch data while loading packages');
        return result.data;
    } catch (err) {
        throw new Error(`Network or Server error: ${err.message}`);
    }
};


const initPackages = async ({ schemaElements: { elements }, libElements }) => {
    try {
        let errorsCount = 0;

        const packageIds = new Set();
        const result = { errors: [] };
        // check all components has packageId
        for (const elem of Object.values(elements)) {
            const packageId = elem.packageId;
            const packageAssigned = packageId !== null;
            if (packageAssigned) {
                packageIds.add(packageId);
            }
            else {
                if (errorsCount < 3) {
                    const lib = libElements[elem.typeId];
                    const elemName = `${lib.abbr}${elem.typeIndex}`;
                    data.errors.push(`No packageId assigned for ${elemName}`);
                    errorsCount++;
                } else {
                    data.errors.push(`Showed names for first 3 elems`);
                    break;
                }
            }

        };
        if (errorsCount === 0) {

            // fetch packages IDs from db
            result.packages = await fetchPackages(packageIds);
        }

        return result;
    } catch (err) { throw new Error(`initPackages error: ${err.message}`); }


};

const processPackage = (p) => {
    // console.log(prettify(p,0));


    // extract coords from strings
    const turtle = turtleToParams(p.turtle);
    const pins = pinsToParams(p.pins);
    const textpos = extractCoords(p.textpos);
    // console.log(pkg);

    // calculate turtle bounds
    let bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const prim of turtle) {
        const primitiveBounds = getPrimitiveBounds(prim);
        bounds = expandBounds(bounds, primitiveBounds);
    }

    // expand text pos point
    const textRect = expandPoint(textpos, 0, 1.5); // text height 1.5*2 = 3mm
    bounds = expandBounds(bounds, textRect);

    // expand bound with pins
    Object.values(pins).forEach(pin => bounds = expandBoundsByPoint(bounds, pin));

    const pkg = {
        ...p,
        turtle: turtle,
        pins: pins,
        textpos: textpos,
        bounds: bounds,
        w: getRectWidth(bounds),
        h: getRectHeight(bounds),

    };
    // console.log(prettify(pkg, 1));
    return pkg;
};
const expandPackages = (packages) => {
    const result = {};
    for (const raw of packages) {

        const processed = processPackage(raw);
        result[processed.packageId] = processed;

    }



    return result;

};


const getUsedPackageIds = ({ schemaElements: { elements }, libElements }) => {


    let errorsCount = 0;
    const result = {
        packageIds: new Set(),
        errors: [],
    };

    // check all components has packageId
    for (const elem of Object.values(elements)) {
        const packageId = elem.packageId;
        const packageAssigned = packageId !== null;
        if (packageAssigned) {
            result.packageIds.add(packageId);
        }
        else {
            if (errorsCount < 3) {
                const lib = libElements[elem.typeId];
                const elemName = `${lib.abbr}${elem.typeIndex}`;
                result.errors.push(`No packageId assigned for ${elemName}`);
                errorsCount++;
            } else {
                result.errors.push(`Showed names for first 3 elems`);
                break;
            }
        }

    };
    return result;

}
export const doRoute = async (data) => {
    try {
        const packagesResult = getUsedPackageIds(data);
        if (packagesResult.errors.length > 0) {
            console.error(packagesResult.errors);
            return;
        }
        const usedPackageIds = [...packagesResult.packageIds];

        const  = await initPackages(data);
        if (packagesResult.errors.length > 0)
            console.error(packagesResult.errors);
        const rawPackages = packagesResult.packages;

        // const rawPackages = pk;
        const packages = expandPackages(rawPackages);

        // collecting rects from elements
        const elemRects = [];
        for (const elem of Object.values(data.schemaElements.elements)) {
            const packageId = elem.packageId;
            const pkg = packages[packageId];
            const rect = {
                elemId: elem.id,
                rect: new Rect(0, 0, pkg.w, pkg.h),
                rotate: 0,
            }
            elemRects.push(rect);

        }
        packRects(elemRects);



        // console.log(rawPackages);
        // console.log(packages);
    } catch (err) {
        console.error(err.message);
    }
}








const data = { "schemaElements": { "elements": { "0": { "id": 0, "typeId": 17, "pos": [50, 38], "rotate": 3, "typeIndex": 1, "packageId": "24" }, "1": { "id": 1, "typeId": 13, "pos": [60, 38], "rotate": 3, "typeIndex": 1, "packageId": "7" }, "2": { "id": 2, "typeId": 2, "pos": [58, 24], "rotate": 1, "typeIndex": 2, "packageId": "21" }, "3": { "id": 3, "typeId": 19, "pos": [58, 13], "rotate": 0, "typeIndex": 1, "packageId": "23" }, "4": { "id": 4, "typeId": 2, "pos": [67, 30], "rotate": 0, "typeIndex": 3, "packageId": "21" }, "5": { "id": 5, "typeId": 5, "pos": [82, 30], "rotate": 0, "typeIndex": 1, "packageId": "22" }, "7": { "id": 7, "typeId": 2, "pos": [100, 16], "rotate": 1, "typeIndex": 4, "packageId": "21" }, "8": { "id": 8, "typeId": 15, "pos": [110, 36], "rotate": 1, "typeIndex": 1, "packageId": "14" }, "9": { "id": 9, "typeId": 2, "pos": [83, 38], "rotate": 1, "typeIndex": 5, "packageId": "21" }, "10": { "id": 10, "typeId": 1, "pos": [75, 24], "rotate": 1, "typeIndex": 1, "packageId": "12" }, "11": { "id": 11, "typeId": 18, "pos": [75, 14], "rotate": 3, "typeIndex": 2, "packageId": "8" }, "12": { "id": 12, "typeId": 14, "pos": [110, 14], "rotate": 1, "typeIndex": 1, "packageId": "19" }, "13": { "id": 13, "typeId": 14, "pos": [67, 24], "rotate": 0, "typeIndex": 2, "packageId": "19" } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 8, "pinIdx": "+" }, "target": { "type": "PIN", "elementId": 12, "pinIdx": "PIN2" }, "path": [[110, 34], [110, 17]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[50, 42], [50, 43], [60, 43]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 8, "pinIdx": "-" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[110, 38], [110, 43], [100, 43]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[83, 43], [100, 43]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[69, 30], [70, 30]] }, "5": { "wireId": 5, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [83, 43] }, "path": [[83, 40], [83, 43]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 5, "pinIdx": "E" }, "path": [[83, 36], [83, 33]] }, "7": { "wireId": 7, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[75, 10], [75, 9], [80, 9]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 12, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[110, 11], [110, 9], [100, 9]] }, "9": { "wireId": 9, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[100, 14], [100, 9]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 5, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[79, 30], [75, 30]] }, "11": { "wireId": 11, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[100, 18], [100, 43]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 10, "pinIdx": "1" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[75, 28], [75, 30]] }, "13": { "wireId": 13, "source": { "type": "PIN", "elementId": 10, "pinIdx": "0" }, "target": { "type": "PIN", "elementId": 11, "pinIdx": "PIN3" }, "path": [[75, 20], [75, 18]] }, "14": { "wireId": 14, "source": { "type": "TCONN", "pos": [100, 9] }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[100, 9], [83, 9]] }, "15": { "wireId": 15, "source": { "type": "PIN", "elementId": 5, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[83, 27], [83, 9]] }, "16": { "wireId": 16, "source": { "type": "TCONN", "pos": [83, 9] }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[83, 9], [80, 9]] }, "17": { "wireId": 17, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[78, 14], [80, 14], [80, 9]] }, "18": { "wireId": 18, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[65, 30], [64, 30]] }, "19": { "wireId": 19, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[50, 34], [50, 30], [58, 30]] }, "20": { "wireId": 20, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[58, 26], [58, 30]] }, "21": { "wireId": 21, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 3, "pinIdx": "PIN1" }, "path": [[58, 22], [58, 15]] }, "22": { "wireId": 22, "source": { "type": "TCONN", "pos": [75, 30] }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[75, 30], [70, 30]] }, "23": { "wireId": 23, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[70, 24], [70, 30]] }, "24": { "wireId": 24, "source": { "type": "TCONN", "pos": [58, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[58, 30], [60, 30]] }, "25": { "wireId": 25, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[64, 24], [64, 30]] }, "26": { "wireId": 26, "source": { "type": "TCONN", "pos": [64, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[64, 30], [60, 30]] }, "27": { "wireId": 27, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[60, 36], [60, 30]] }, "28": { "wireId": 28, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[83, 43], [60, 43]] }, "29": { "wireId": 29, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[60, 40], [60, 43]] } } }, "saved": { "elements": { "0": { "id": 0, "typeId": 17, "pos": [50, 38], "rotate": 3, "typeIndex": 1, "packageId": "24" }, "1": { "id": 1, "typeId": 13, "pos": [60, 38], "rotate": 3, "typeIndex": 1, "packageId": "7" }, "2": { "id": 2, "typeId": 2, "pos": [58, 24], "rotate": 1, "typeIndex": 2, "packageId": "21" }, "3": { "id": 3, "typeId": 19, "pos": [58, 13], "rotate": 0, "typeIndex": 1, "packageId": "23" }, "4": { "id": 4, "typeId": 2, "pos": [67, 30], "rotate": 0, "typeIndex": 3, "packageId": "21" }, "5": { "id": 5, "typeId": 5, "pos": [82, 30], "rotate": 0, "typeIndex": 1, "packageId": "22" }, "7": { "id": 7, "typeId": 2, "pos": [100, 16], "rotate": 1, "typeIndex": 4, "packageId": "21" }, "8": { "id": 8, "typeId": 15, "pos": [110, 36], "rotate": 1, "typeIndex": 1, "packageId": "14" }, "9": { "id": 9, "typeId": 2, "pos": [83, 38], "rotate": 1, "typeIndex": 5, "packageId": "21" }, "10": { "id": 10, "typeId": 1, "pos": [75, 24], "rotate": 1, "typeIndex": 1, "packageId": "12" }, "11": { "id": 11, "typeId": 18, "pos": [75, 14], "rotate": 3, "typeIndex": 2, "packageId": "8" }, "12": { "id": 12, "typeId": 14, "pos": [110, 14], "rotate": 1, "typeIndex": 1, "packageId": "19" }, "13": { "id": 13, "typeId": 14, "pos": [67, 24], "rotate": 0, "typeIndex": 2, "packageId": "19" } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 8, "pinIdx": "+" }, "target": { "type": "PIN", "elementId": 12, "pinIdx": "PIN2" }, "path": [[110, 34], [110, 17]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[50, 42], [50, 43], [60, 43]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 8, "pinIdx": "-" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[110, 38], [110, 43], [100, 43]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[83, 43], [100, 43]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[69, 30], [70, 30]] }, "5": { "wireId": 5, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [83, 43] }, "path": [[83, 40], [83, 43]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 5, "pinIdx": "E" }, "path": [[83, 36], [83, 33]] }, "7": { "wireId": 7, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[75, 10], [75, 9], [80, 9]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 12, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[110, 11], [110, 9], [100, 9]] }, "9": { "wireId": 9, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[100, 14], [100, 9]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 5, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[79, 30], [75, 30]] }, "11": { "wireId": 11, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[100, 18], [100, 43]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 10, "pinIdx": "1" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[75, 28], [75, 30]] }, "13": { "wireId": 13, "source": { "type": "PIN", "elementId": 10, "pinIdx": "0" }, "target": { "type": "PIN", "elementId": 11, "pinIdx": "PIN3" }, "path": [[75, 20], [75, 18]] }, "14": { "wireId": 14, "source": { "type": "TCONN", "pos": [100, 9] }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[100, 9], [83, 9]] }, "15": { "wireId": 15, "source": { "type": "PIN", "elementId": 5, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[83, 27], [83, 9]] }, "16": { "wireId": 16, "source": { "type": "TCONN", "pos": [83, 9] }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[83, 9], [80, 9]] }, "17": { "wireId": 17, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[78, 14], [80, 14], [80, 9]] }, "18": { "wireId": 18, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[65, 30], [64, 30]] }, "19": { "wireId": 19, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[50, 34], [50, 30], [58, 30]] }, "20": { "wireId": 20, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[58, 26], [58, 30]] }, "21": { "wireId": 21, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 3, "pinIdx": "PIN1" }, "path": [[58, 22], [58, 15]] }, "22": { "wireId": 22, "source": { "type": "TCONN", "pos": [75, 30] }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[75, 30], [70, 30]] }, "23": { "wireId": 23, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[70, 24], [70, 30]] }, "24": { "wireId": 24, "source": { "type": "TCONN", "pos": [58, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[58, 30], [60, 30]] }, "25": { "wireId": 25, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[64, 24], [64, 30]] }, "26": { "wireId": 26, "source": { "type": "TCONN", "pos": [64, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[64, 30], [60, 30]] }, "27": { "wireId": 27, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[60, 36], [60, 30]] }, "28": { "wireId": 28, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[83, 43], [60, 43]] }, "29": { "wireId": 29, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[60, 40], [60, 43]] } } }, "view": { "zoomIndex": 6, "zoom": 6, "interval": 15, "x": 36.44000000000003, "y": -4.676666666666673 } }

doRoute(data);