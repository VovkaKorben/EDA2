import {
    getPrimitiveBounds, stringToCoords, parseTurtle, pinsToPoints,
    getRectWidth, getRectHeight,
    floatEqual, leq, geq,
    union, snapRectFloat, rotate, expand,
    divide,
    snapRect,
    roundPoint
} from './geo.js';
import { Rect } from './rect.js';
import { API_URL, ErrorCodes } from './utils.js';
import { prettify } from './debug.js';

export const PCB_UNIT = 25.4 / 20; // inch/20 = 50mil
const E = 0.001;
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
            rect.rotate = fit.rotated;

            // 3. Размещаем прямоугольник с учетом возможного поворота
            const finalW = rect.rotate ? rect.h : rect.w;
            const finalH = rect.rotate ? rect.w : rect.h;

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



const getUsedPackageIds = ({ schemaElements: { elements }, libElements }) => {


    let errorsCount = 0;

    const packageIds = new Set();
    const errors = [];


    // check all components has packageId
    for (const elem of Object.values(elements)) {
        const packageId = elem.packageId;
        const packageAssigned = packageId !== null;
        if (packageAssigned) {
            packageIds.add(parseInt(packageId, 10));
        }
        else {
            if (errorsCount < 3) {
                const lib = libElements[elem.typeId];
                const elemName = `${lib.abbr}${elem.typeIndex}`;
                errors.push({ code: ErrorCodes.ERROR, message: `No package assigned for ${elemName}` });
                errorsCount++;
            } else {
                errors.push({ code: ErrorCodes.INFO, message: 'Showed names for first 3 elems' });
                break;
            }
        }

    };
    return {
        errors: errors,
        packageIds: [...packageIds]
    };

}


const fetchPackages = async (packageIds) => {
    try {
        const resp = await fetch(`${API_URL}packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packageIds)
        });
        const result = await resp.json();
        if (!(resp.ok && result.success)) throw new Error('error fetch data while loading packages');

        const objData = {};
        result.data.forEach(p => objData[p.packageId] = p);
        return objData;
    } catch (err) {
        throw new Error(`Network or Server error: ${err.message}`);
    }
};

const convertPackage = (pkg) => {
    try {
        // console.log(prettify(p,0));


        // extract coords from strings
        const turtle = parseTurtle(pkg.turtle);
        const pins = pinsToPoints(pkg.pins);
        const textPos = stringToCoords(pkg.textPos);
        // console.log(pkg);

        // calculate turtle bounds
        let bounds = [Infinity, Infinity, -Infinity, -Infinity];
        for (const prim of turtle) {
            const primitiveBounds = getPrimitiveBounds(prim);
            bounds = union(bounds, primitiveBounds);
        }

        // expand text pos point
        let textRect = [...textPos, ...textPos];
        textRect = expand(textRect, 0, 1.5); // text height 1.5*2 = 3mm
        bounds = union(bounds, textRect);


        // expand bound with pins
        Object.values(pins).forEach(pin => bounds = union(bounds, pin));

        // snap bounds to grid
        bounds = snapRectFloat(bounds, PCB_UNIT);


        const result = {
            ...pkg,
            turtle: turtle,
            pins: pins,
            textPos: textPos,
            bounds: bounds,
        };
        // console.log(prettify(pkg, 1));
        return result;
    } catch (e) {
        throw new Error(`convertPackage ${e.message}`);
    }
};
const convertPackages = (packages) => {
    const result = {};
    for (let packageId in packages) {
        if (Object.hasOwn(packages, packageId)) {
            // if (packages.hasOwnProperty(packageId)) {
            result[packageId] = convertPackage(packages[packageId]);
        }
    }
    return result;
};

const checkPins = ({ schemaElements: { elements }, libElements }, packagesData) => {
    for (const packageId in packagesData) {
        const pkg = packagesData[packageId]
        const packagePinsNames = Object.keys(pkg.pins).map(n => n.toUpperCase());
        const lib = libElements[pkg.typeId];
        const schemaPins = lib.pins[0]; // from 0deg rotate
        const schemaPinsNames = Object.keys(schemaPins).map(n => n.toUpperCase());

        const missingPins = schemaPinsNames.filter(pinName => !packagePinsNames.includes(pinName));
        if (missingPins.length) {

            return [{ code: ErrorCodes.ERROR, message: `Missing pins (${missingPins.join(',')}) for ${lib.abbr} in package ${pkg.name} (ID: ${pkg.packageId})` }];
        }

    }
    return [];
}

export const doRoute = async (data) => {

    try {

        // collect used packages IDs
        let { errors, packageIds } = getUsedPackageIds(data);
        if (errors.length > 0) {
            //console.error(errors);
            return { errors: errors };
        }
        // read packages from DB
        const rawPackages = await fetchPackages(packageIds);

        // convert coordinates
        const packagesData = convertPackages(rawPackages);

        // check all pins are exist (lib <=> phys)
        errors = checkPins(data, packagesData);
        if (errors.length > 0) {
            return { errors: errors };
        }

        // create Rect-array from used element-packages

        const packagesRects = [];
        for (const elem of Object.values(data.schemaElements.elements)) {
            const packageId = elem.packageId;

            const pkgRect = new Rect(...packagesData[packageId].bounds);
            pkgRect.elementId = elem.elementId;

            packagesRects.push(pkgRect);
            console.log(pkgRect.w, pkgRect.h);
        }

        // pack rects on the PCB
        const packResult = packRects(packagesRects);
        packResult.binW = Math.ceil(packResult.binW);
        packResult.binH = Math.ceil(packResult.binH);


        // convert packed rects to draw-structure
        const toDraw = {}
        for (const elem of Object.values(data.schemaElements.elements)) {
            const lib = data.libElements[elem.typeId]
            const elemId = elem.elementId;

            // find in packed 
            const packedRect = packResult.rects.find(pr => pr.elementId === elemId)
            if (!packedRect) {
                return [{ code: ErrorCodes.ERROR, message: `ElementID ${elemId} not found in packed rects` }]
            }
            const { packageId } = elem;
            const pkg = packagesData[packageId];


            const textPos = rotate(pkg.textPos, packedRect.rotate)
            const text = `${lib.abbr}${elem.typeIndex}`

            toDraw[elemId] = {
                elementId: elemId,
                packageId: packageId,
                textPos: textPos,
                text: text,
                pos: [packedRect.l, packedRect.t]
            }
            // rotate points
            console.log(packedRect);

        }




        // console.log(prettify(packResult, 2));
        return { data: toDraw }
    } catch (err) {
        console.error(`[doRoute] ${err.message}`);
    }
}






/*

const data = {
    "schemaElements": { "elements": { "0": { "elementId": 0, "typeId": 17, "pos": [50, 38], "rotate": 3, "typeIndex": 1, "packageId": 24 }, "1": { "elementId": 1, "typeId": 13, "pos": [60, 38], "rotate": 3, "typeIndex": 1, "packageId": 7 }, "2": { "elementId": 2, "typeId": 2, "pos": [58, 24], "rotate": 1, "typeIndex": 2, "packageId": 21 }, "3": { "elementId": 3, "typeId": 19, "pos": [58, 13], "rotate": 0, "typeIndex": 1, "packageId": 23 }, "4": { "elementId": 4, "typeId": 2, "pos": [67, 30], "rotate": 0, "typeIndex": 3, "packageId": 21 }, "5": { "elementId": 5, "typeId": 5, "pos": [82, 30], "rotate": 0, "typeIndex": 1, "packageId": 22 }, "7": { "elementId": 7, "typeId": 2, "pos": [100, 16], "rotate": 1, "typeIndex": 4, "packageId": 21 }, "8": { "elementId": 8, "typeId": 15, "pos": [110, 36], "rotate": 1, "typeIndex": 1, "packageId": 14 }, "9": { "elementId": 9, "typeId": 2, "pos": [83, 38], "rotate": 1, "typeIndex": 5, "packageId": 21 }, "10": { "elementId": 10, "typeId": 1, "pos": [75, 24], "rotate": 1, "typeIndex": 1, "packageId": 12 }, "11": { "elementId": 11, "typeId": 18, "pos": [75, 14], "rotate": 3, "typeIndex": 2, "packageId": 8 }, "12": { "elementId": 12, "typeId": 14, "pos": [110, 14], "rotate": 1, "typeIndex": 1, "packageId": 19 }, "13": { "elementId": 13, "typeId": 14, "pos": [67, 24], "rotate": 0, "typeIndex": 2, "packageId": 19 } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 8, "pinIdx": "+" }, "target": { "type": "PIN", "elementId": 12, "pinIdx": "PIN2" }, "path": [[110, 34], [110, 17]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[50, 42], [50, 43], [60, 43]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 8, "pinIdx": "-" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[110, 38], [110, 43], [100, 43]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[83, 43], [100, 43]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[69, 30], [70, 30]] }, "5": { "wireId": 5, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [83, 43] }, "path": [[83, 40], [83, 43]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 5, "pinIdx": "E" }, "path": [[83, 36], [83, 33]] }, "7": { "wireId": 7, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[75, 10], [75, 9], [80, 9]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 12, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[110, 11], [110, 9], [100, 9]] }, "9": { "wireId": 9, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[100, 14], [100, 9]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 5, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[79, 30], [75, 30]] }, "11": { "wireId": 11, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[100, 18], [100, 43]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 10, "pinIdx": "1" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[75, 28], [75, 30]] }, "13": { "wireId": 13, "source": { "type": "PIN", "elementId": 10, "pinIdx": "0" }, "target": { "type": "PIN", "elementId": 11, "pinIdx": "PIN3" }, "path": [[75, 20], [75, 18]] }, "14": { "wireId": 14, "source": { "type": "TCONN", "pos": [100, 9] }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[100, 9], [83, 9]] }, "15": { "wireId": 15, "source": { "type": "PIN", "elementId": 5, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[83, 27], [83, 9]] }, "16": { "wireId": 16, "source": { "type": "TCONN", "pos": [83, 9] }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[83, 9], [80, 9]] }, "17": { "wireId": 17, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[78, 14], [80, 14], [80, 9]] }, "18": { "wireId": 18, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[65, 30], [64, 30]] }, "19": { "wireId": 19, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[50, 34], [50, 30], [58, 30]] }, "20": { "wireId": 20, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[58, 26], [58, 30]] }, "21": { "wireId": 21, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 3, "pinIdx": "PIN1" }, "path": [[58, 22], [58, 15]] }, "22": { "wireId": 22, "source": { "type": "TCONN", "pos": [75, 30] }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[75, 30], [70, 30]] }, "23": { "wireId": 23, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[70, 24], [70, 30]] }, "24": { "wireId": 24, "source": { "type": "TCONN", "pos": [58, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[58, 30], [60, 30]] }, "25": { "wireId": 25, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[64, 24], [64, 30]] }, "26": { "wireId": 26, "source": { "type": "TCONN", "pos": [64, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[64, 30], [60, 30]] }, "27": { "wireId": 27, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[60, 36], [60, 30]] }, "28": { "wireId": 28, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[83, 43], [60, 43]] }, "29": { "wireId": 29, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[60, 40], [60, 43]] } } }, "saved": { "elements": { "0": { "elementId": 0, "typeId": 17, "pos": [50, 38], "rotate": 3, "typeIndex": 1, "packageId": 24 }, "1": { "elementId": 1, "typeId": 13, "pos": [60, 38], "rotate": 3, "typeIndex": 1, "packageId": 7 }, "2": { "elementId": 2, "typeId": 2, "pos": [58, 24], "rotate": 1, "typeIndex": 2, "packageId": 21 }, "3": { "elementId": 3, "typeId": 19, "pos": [58, 13], "rotate": 0, "typeIndex": 1, "packageId": 23 }, "4": { "elementId": 4, "typeId": 2, "pos": [67, 30], "rotate": 0, "typeIndex": 3, "packageId": 21 }, "5": { "elementId": 5, "typeId": 5, "pos": [82, 30], "rotate": 0, "typeIndex": 1, "packageId": 22 }, "7": { "elementId": 7, "typeId": 2, "pos": [100, 16], "rotate": 1, "typeIndex": 4, "packageId": 21 }, "8": { "elementId": 8, "typeId": 15, "pos": [110, 36], "rotate": 1, "typeIndex": 1, "packageId": 14 }, "9": { "elementId": 9, "typeId": 2, "pos": [83, 38], "rotate": 1, "typeIndex": 5, "packageId": 21 }, "10": { "elementId": 10, "typeId": 1, "pos": [75, 24], "rotate": 1, "typeIndex": 1, "packageId": 12 }, "11": { "elementId": 11, "typeId": 18, "pos": [75, 14], "rotate": 3, "typeIndex": 2, "packageId": 8 }, "12": { "elementId": 12, "typeId": 14, "pos": [110, 14], "rotate": 1, "typeIndex": 1, "packageId": 19 }, "13": { "elementId": 13, "typeId": 14, "pos": [67, 24], "rotate": 0, "typeIndex": 2, "packageId": 19 } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 8, "pinIdx": "+" }, "target": { "type": "PIN", "elementId": 12, "pinIdx": "PIN2" }, "path": [[110, 34], [110, 17]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[50, 42], [50, 43], [60, 43]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 8, "pinIdx": "-" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[110, 38], [110, 43], [100, 43]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[83, 43], [100, 43]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[69, 30], [70, 30]] }, "5": { "wireId": 5, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [83, 43] }, "path": [[83, 40], [83, 43]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 9, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 5, "pinIdx": "E" }, "path": [[83, 36], [83, 33]] }, "7": { "wireId": 7, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[75, 10], [75, 9], [80, 9]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 12, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[110, 11], [110, 9], [100, 9]] }, "9": { "wireId": 9, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [100, 9] }, "path": [[100, 14], [100, 9]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 5, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[79, 30], [75, 30]] }, "11": { "wireId": 11, "source": { "type": "PIN", "elementId": 7, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [100, 43] }, "path": [[100, 18], [100, 43]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 10, "pinIdx": "1" }, "target": { "type": "TCONN", "pos": [75, 30] }, "path": [[75, 28], [75, 30]] }, "13": { "wireId": 13, "source": { "type": "PIN", "elementId": 10, "pinIdx": "0" }, "target": { "type": "PIN", "elementId": 11, "pinIdx": "PIN3" }, "path": [[75, 20], [75, 18]] }, "14": { "wireId": 14, "source": { "type": "TCONN", "pos": [100, 9] }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[100, 9], [83, 9]] }, "15": { "wireId": 15, "source": { "type": "PIN", "elementId": 5, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [83, 9] }, "path": [[83, 27], [83, 9]] }, "16": { "wireId": 16, "source": { "type": "TCONN", "pos": [83, 9] }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[83, 9], [80, 9]] }, "17": { "wireId": 17, "source": { "type": "PIN", "elementId": 11, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [80, 9] }, "path": [[78, 14], [80, 14], [80, 9]] }, "18": { "wireId": 18, "source": { "type": "PIN", "elementId": 4, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[65, 30], [64, 30]] }, "19": { "wireId": 19, "source": { "type": "PIN", "elementId": 0, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[50, 34], [50, 30], [58, 30]] }, "20": { "wireId": 20, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 30] }, "path": [[58, 26], [58, 30]] }, "21": { "wireId": 21, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "PIN", "elementId": 3, "pinIdx": "PIN1" }, "path": [[58, 22], [58, 15]] }, "22": { "wireId": 22, "source": { "type": "TCONN", "pos": [75, 30] }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[75, 30], [70, 30]] }, "23": { "wireId": 23, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [70, 30] }, "path": [[70, 24], [70, 30]] }, "24": { "wireId": 24, "source": { "type": "TCONN", "pos": [58, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[58, 30], [60, 30]] }, "25": { "wireId": 25, "source": { "type": "PIN", "elementId": 13, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [64, 30] }, "path": [[64, 24], [64, 30]] }, "26": { "wireId": 26, "source": { "type": "TCONN", "pos": [64, 30] }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[64, 30], [60, 30]] }, "27": { "wireId": 27, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [60, 30] }, "path": [[60, 36], [60, 30]] }, "28": { "wireId": 28, "source": { "type": "TCONN", "pos": [83, 43] }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[83, 43], [60, 43]] }, "29": { "wireId": 29, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [60, 43] }, "path": [[60, 40], [60, 43]] } } }, "view": { "zoomIndex": 6, "zoom": 6, "interval": 15, "x": 36.44000000000003, "y": -4.676666666666673 },

    "libElements":
        { "1": { "typeId": 1, "abbr": "R", "descr": "A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.", "name": "resistor", "turtle": [[{ "code": "R", "params": [-5, -2, 10, 4] }, { "code": "L", "params": [-10, 0, -5, 0] }, { "code": "L", "params": [5, 0, 10, 0] }], [{ "code": "R", "params": [2, -5, -4, 10] }, { "code": "L", "params": [0, -10, 0, -5] }, { "code": "L", "params": [0, 5, 0, 10] }], [{ "code": "R", "params": [5, 2, -10, -4] }, { "code": "L", "params": [10, 0, 5, 0] }, { "code": "L", "params": [-5, 0, -10, 0] }], [{ "code": "R", "params": [-2, 5, 4, -10] }, { "code": "L", "params": [0, 10, 0, 5] }, { "code": "L", "params": [0, -5, 0, -10] }]], "pins": [{ "0": [null, null], "1": [null, null] }, { "0": [null, null], "1": [null, null] }, { "0": [null, null], "1": [null, null] }, { "0": [null, null], "1": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "12": "CFR-25", "13": "MF-25" } }, "2": { "typeId": 2, "abbr": "C", "descr": "A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material", "name": "capacitor", "turtle": [[{ "code": "L", "params": [-5, 0, -1, 0] }, { "code": "L", "params": [1, -4, 1, 4] }, { "code": "L", "params": [-1, -4, -1, 4] }, { "code": "L", "params": [1, 0, 5, 0] }], [{ "code": "L", "params": [0, -5, 0, -1] }, { "code": "L", "params": [4, 1, -4, 1] }, { "code": "L", "params": [4, -1, -4, -1] }, { "code": "L", "params": [0, 1, 0, 5] }], [{ "code": "L", "params": [5, 0, 1, 0] }, { "code": "L", "params": [-1, 4, -1, -4] }, { "code": "L", "params": [1, 4, 1, -4] }, { "code": "L", "params": [-1, 0, -5, 0] }], [{ "code": "L", "params": [0, 5, 0, 1] }, { "code": "L", "params": [-4, -1, 4, -1] }, { "code": "L", "params": [-4, 1, 4, 1] }, { "code": "L", "params": [0, -1, 0, -5] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "21": "cond" } }, "3": { "typeId": 3, "abbr": "VT", "descr": "A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.", "name": "pnp transistor", "turtle": [[{ "code": "P", "params": [-1.55, 1.357, 0.17, 1.536, -0.66, 2.845, 2] }, { "code": "P", "params": [-1.55, 1.357, 2.5, 3.927, 2.5, 7.5, 0] }, { "code": "P", "params": [-1.55, -1.357, 2.5, -3.928, 2.5, -7.5, 0] }, { "code": "L", "params": [-7.5, 0, -1.55, 0] }, { "code": "L", "params": [-1.55, 3.103, -1.55, -3.103] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [-1.357, -1.55, -1.536, 0.17, -2.845, -0.66, 2] }, { "code": "P", "params": [-1.357, -1.55, -3.927, 2.5, -7.5, 2.5, 0] }, { "code": "P", "params": [1.357, -1.55, 3.928, 2.5, 7.5, 2.5, 0] }, { "code": "L", "params": [0, -7.5, 0, -1.55] }, { "code": "L", "params": [-3.103, -1.55, 3.103, -1.55] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [1.55, -1.357, -0.17, -1.536, 0.66, -2.845, 2] }, { "code": "P", "params": [1.55, -1.357, -2.5, -3.927, -2.5, -7.5, 0] }, { "code": "P", "params": [1.55, 1.357, -2.5, 3.928, -2.5, 7.5, 0] }, { "code": "L", "params": [7.5, 0, 1.55, 0] }, { "code": "L", "params": [1.55, -3.103, 1.55, 3.103] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [1.357, 1.55, 1.536, -0.17, 2.845, 0.66, 2] }, { "code": "P", "params": [1.357, 1.55, 3.927, -2.5, 7.5, -2.5, 0] }, { "code": "P", "params": [-1.357, 1.55, -3.928, -2.5, -7.5, -2.5, 0] }, { "code": "L", "params": [0, 7.5, 0, 1.55] }, { "code": "L", "params": [3.103, 1.55, -3.103, 1.55] }, { "code": "C", "params": [0, 0, 4.66] }]], "pins": [{ "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "1": "BC547C", "9": "2N2222", "10": "2N3904" } }, "4": { "typeId": 4, "abbr": "VD", "descr": "A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.", "name": "diode", "turtle": [[{ "code": "L", "params": [2.5, 2.5, 2.5, -2.5] }, { "code": "P", "params": [-2.5, -2.5, 2.5, 0, -2.5, 2.5, 1] }, { "code": "L", "params": [-5, 0, 5, 0] }], [{ "code": "L", "params": [-2.5, 2.5, 2.5, 2.5] }, { "code": "P", "params": [2.5, -2.5, 0, 2.5, -2.5, -2.5, 1] }, { "code": "L", "params": [0, -5, 0, 5] }], [{ "code": "L", "params": [-2.5, -2.5, -2.5, 2.5] }, { "code": "P", "params": [2.5, 2.5, -2.5, 0, 2.5, -2.5, 1] }, { "code": "L", "params": [5, 0, -5, 0] }], [{ "code": "L", "params": [2.5, -2.5, -2.5, -2.5] }, { "code": "P", "params": [-2.5, 2.5, 0, -2.5, 2.5, 2.5, 1] }, { "code": "L", "params": [0, 5, 0, -5] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": {} }, "5": { "typeId": 5, "abbr": "VT", "descr": null, "name": "npn", "turtle": [[{ "code": "P", "params": [-1.55, 1.357, 2.5, 3.927, 2.5, 7.5, 0] }, { "code": "P", "params": [-1.55, -1.357, 2.5, -3.928, 2.5, -7.5, 0] }, { "code": "L", "params": [-7.5, 0, -1.55, 0] }, { "code": "L", "params": [-1.55, 3.103, -1.55, -3.103] }, { "code": "C", "params": [0, 0, 4.66] }, { "code": "P", "params": [2.5, 3.927, 0.77, 3.748, 1.61, 2.439, 2] }], [{ "code": "P", "params": [-1.357, -1.55, -3.927, 2.5, -7.5, 2.5, 0] }, { "code": "P", "params": [1.357, -1.55, 3.928, 2.5, 7.5, 2.5, 0] }, { "code": "L", "params": [0, -7.5, 0, -1.55] }, { "code": "L", "params": [-3.103, -1.55, 3.103, -1.55] }, { "code": "C", "params": [0, 0, 4.66] }, { "code": "P", "params": [-3.927, 2.5, -3.748, 0.77, -2.439, 1.61, 2] }], [{ "code": "P", "params": [1.55, -1.357, -2.5, -3.927, -2.5, -7.5, 0] }, { "code": "P", "params": [1.55, 1.357, -2.5, 3.928, -2.5, 7.5, 0] }, { "code": "L", "params": [7.5, 0, 1.55, 0] }, { "code": "L", "params": [1.55, -3.103, 1.55, 3.103] }, { "code": "C", "params": [0, 0, 4.66] }, { "code": "P", "params": [-2.5, -3.927, -0.77, -3.748, -1.61, -2.439, 2] }], [{ "code": "P", "params": [1.357, 1.55, 3.927, -2.5, 7.5, -2.5, 0] }, { "code": "P", "params": [-1.357, 1.55, -3.928, -2.5, -7.5, -2.5, 0] }, { "code": "L", "params": [0, 7.5, 0, 1.55] }, { "code": "L", "params": [3.103, 1.55, -3.103, 1.55] }, { "code": "C", "params": [0, 0, 4.66] }, { "code": "P", "params": [3.927, -2.5, 3.748, -0.77, 2.439, -1.61, 2] }]], "pins": [{ "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }, { "C": [null, null], "B": [null, null], "E": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "22": "BC547C" } }, "13": { "typeId": 13, "abbr": "C", "descr": null, "name": "var cap", "turtle": [[{ "code": "L", "params": [-5, 0, -1, 0] }, { "code": "L", "params": [1, -4, 1, 4] }, { "code": "L", "params": [-1, -4, -1, 4] }, { "code": "L", "params": [1, 0, 5, 0] }, { "code": "P", "params": [4, 4, 3.29, 1.879, 1.88, 3.293, 2] }, { "code": "L", "params": [-4, -4, 4, 4] }], [{ "code": "L", "params": [0, -5, 0, -1] }, { "code": "L", "params": [4, 1, -4, 1] }, { "code": "L", "params": [4, -1, -4, -1] }, { "code": "L", "params": [0, 1, 0, 5] }, { "code": "P", "params": [-4, 4, -1.879, 3.29, -3.293, 1.88, 2] }, { "code": "L", "params": [4, -4, -4, 4] }], [{ "code": "L", "params": [5, 0, 1, 0] }, { "code": "L", "params": [-1, 4, -1, -4] }, { "code": "L", "params": [1, 4, 1, -4] }, { "code": "L", "params": [-1, 0, -5, 0] }, { "code": "P", "params": [-4, -4, -3.29, -1.879, -1.88, -3.293, 2] }, { "code": "L", "params": [4, 4, -4, -4] }], [{ "code": "L", "params": [0, 5, 0, 1] }, { "code": "L", "params": [-4, -1, 4, -1] }, { "code": "L", "params": [-4, 1, 4, 1] }, { "code": "L", "params": [0, -1, 0, -5] }, { "code": "P", "params": [4, -4, 1.879, -3.29, 3.293, -1.88, 2] }, { "code": "L", "params": [-4, 4, 4, -4] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "7": "PVC-2L20T", "20": "Polyvaricon" } }, "14": { "typeId": 14, "abbr": "S", "descr": null, "name": "switch", "turtle": [[{ "code": "L", "params": [-7.5, 0, -2.5, 0] }, { "code": "P", "params": [-2.5, -2.5, 2.5, 0, 7.5, 0, 0] }], [{ "code": "L", "params": [0, -7.5, 0, -2.5] }, { "code": "P", "params": [2.5, -2.5, 0, 2.5, 0, 7.5, 0] }], [{ "code": "L", "params": [7.5, 0, 2.5, 0] }, { "code": "P", "params": [2.5, 2.5, -2.5, 0, -7.5, 0, 0] }], [{ "code": "L", "params": [0, 7.5, 0, 2.5] }, { "code": "P", "params": [-2.5, 2.5, 0, -2.5, 0, -7.5, 0] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "18": "SK12D07", "19": "MSS-12D07" } }, "15": { "typeId": 15, "abbr": "G", "descr": null, "name": "battery", "turtle": [[{ "code": "L", "params": [-5, 0, -3.5, 0] }, { "code": "L", "params": [3.5, 0, 5, 0] }, { "code": "L", "params": [3.5, -2, 3.5, 2] }, { "code": "L", "params": [2.5, -3, 2.5, 3] }, { "code": "L", "params": [1.5, 0, 2.5, 0] }, { "code": "L", "params": [-0.5, 0, 0.5, 0] }, { "code": "L", "params": [-1.5, 0, -2.5, 0] }, { "code": "L", "params": [-2.5, -2, -2.5, 2] }, { "code": "L", "params": [-3.5, -3, -3.5, 3] }], [{ "code": "L", "params": [0, -5, 0, -3.5] }, { "code": "L", "params": [0, 3.5, 0, 5] }, { "code": "L", "params": [2, 3.5, -2, 3.5] }, { "code": "L", "params": [3, 2.5, -3, 2.5] }, { "code": "L", "params": [0, 1.5, 0, 2.5] }, { "code": "L", "params": [0, -0.5, 0, 0.5] }, { "code": "L", "params": [0, -1.5, 0, -2.5] }, { "code": "L", "params": [2, -2.5, -2, -2.5] }, { "code": "L", "params": [3, -3.5, -3, -3.5] }], [{ "code": "L", "params": [5, 0, 3.5, 0] }, { "code": "L", "params": [-3.5, 0, -5, 0] }, { "code": "L", "params": [-3.5, 2, -3.5, -2] }, { "code": "L", "params": [-2.5, 3, -2.5, -3] }, { "code": "L", "params": [-1.5, 0, -2.5, 0] }, { "code": "L", "params": [0.5, 0, -0.5, 0] }, { "code": "L", "params": [1.5, 0, 2.5, 0] }, { "code": "L", "params": [2.5, 2, 2.5, -2] }, { "code": "L", "params": [3.5, 3, 3.5, -3] }], [{ "code": "L", "params": [0, 5, 0, 3.5] }, { "code": "L", "params": [0, -3.5, 0, -5] }, { "code": "L", "params": [-2, -3.5, 2, -3.5] }, { "code": "L", "params": [-3, -2.5, 3, -2.5] }, { "code": "L", "params": [0, -1.5, 0, -2.5] }, { "code": "L", "params": [0, 0.5, 0, -0.5] }, { "code": "L", "params": [0, 1.5, 0, 2.5] }, { "code": "L", "params": [-2, 2.5, 2, 2.5] }, { "code": "L", "params": [-3, 3.5, 3, 3.5] }]], "pins": [{ "-": [null, null], "+": [null, null] }, { "-": [null, null], "+": [null, null] }, { "-": [null, null], "+": [null, null] }, { "-": [null, null], "+": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "14": "DG301", "15": "KF301" } }, "17": { "typeId": 17, "abbr": "L", "descr": null, "name": "coil", "turtle": [[{ "code": "L", "params": [-10, 0, -7.06, 0] }, { "code": "L", "params": [7.06, 0, 10, 0] }, { "code": "A", "params": [5.295, 0, 1.765, 3.141592653589793, 0, 0] }, { "code": "A", "params": [1.765, 0, 1.765, 3.141592653589793, 0, 0] }, { "code": "A", "params": [-1.765, 0, 1.765, 3.141592653589793, 0, 0] }, { "code": "A", "params": [-5.295, 0, 1.765, 3.141592653589793, 0, 0] }], [{ "code": "L", "params": [0, -10, 0, -7.06] }, { "code": "L", "params": [0, 7.06, 0, 10] }, { "code": "A", "params": [0, 5.295, 1.765, 4.71238898038469, 1.5707963267948966, 0] }, { "code": "A", "params": [0, 1.765, 1.765, 4.71238898038469, 1.5707963267948966, 0] }, { "code": "A", "params": [0, -1.765, 1.765, 4.71238898038469, 1.5707963267948966, 0] }, { "code": "A", "params": [0, -5.295, 1.765, 4.71238898038469, 1.5707963267948966, 0] }], [{ "code": "L", "params": [10, 0, 7.06, 0] }, { "code": "L", "params": [-7.06, 0, -10, 0] }, { "code": "A", "params": [-5.295, 0, 1.765, 0, 3.141592653589793, 0] }, { "code": "A", "params": [-1.765, 0, 1.765, 0, 3.141592653589793, 0] }, { "code": "A", "params": [1.765, 0, 1.765, 0, 3.141592653589793, 0] }, { "code": "A", "params": [5.295, 0, 1.765, 0, 3.141592653589793, 0] }], [{ "code": "L", "params": [0, 10, 0, 7.06] }, { "code": "L", "params": [0, -7.06, 0, -10] }, { "code": "A", "params": [0, -5.295, 1.765, 1.5707963267948966, 4.71238898038469, 0] }, { "code": "A", "params": [0, -1.765, 1.765, 1.5707963267948966, 4.71238898038469, 0] }, { "code": "A", "params": [0, 1.765, 1.765, 1.5707963267948966, 4.71238898038469, 0] }, { "code": "A", "params": [0, 5.295, 1.765, 1.5707963267948966, 4.71238898038469, 0] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "24": "ANT" } }, "18": { "typeId": 18, "abbr": "R", "descr": null, "name": "var res", "turtle": [[{ "code": "L", "params": [5, 0, 10, 0] }, { "code": "L", "params": [-10, 0, -5, 0] }, { "code": "R", "params": [-5, -2, 10, 4] }, { "code": "L", "params": [0, 2, 0, 7.5] }, { "code": "P", "params": [0, 2, -1, 4, 1, 4, 2] }], [{ "code": "L", "params": [0, 5, 0, 10] }, { "code": "L", "params": [0, -10, 0, -5] }, { "code": "R", "params": [2, -5, -4, 10] }, { "code": "L", "params": [-2, 0, -7.5, 0] }, { "code": "P", "params": [-2, 0, -4, -1, -4, 1, 2] }], [{ "code": "L", "params": [-5, 0, -10, 0] }, { "code": "L", "params": [10, 0, 5, 0] }, { "code": "R", "params": [5, 2, -10, -4] }, { "code": "L", "params": [0, -2, 0, -7.5] }, { "code": "P", "params": [0, -2, 1, -4, -1, -4, 2] }], [{ "code": "L", "params": [0, -5, 0, -10] }, { "code": "L", "params": [0, 10, 0, 5] }, { "code": "R", "params": [-2, 5, 4, -10] }, { "code": "L", "params": [2, 0, 7.5, 0] }, { "code": "P", "params": [2, 0, 4, 1, 4, -1, 2] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null], "PIN3": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null], "PIN3": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null], "PIN3": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null], "PIN3": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "8": "Bourns PTV09", "11": "Alps RK09" } }, "19": { "typeId": 19, "abbr": "W", "descr": null, "name": "antenna", "turtle": [[{ "code": "P", "params": [2.89, -5, 0, 0, -2.89, -5, 0] }, { "code": "L", "params": [0, 5, 0, -5] }], [{ "code": "P", "params": [5, 2.89, 0, 0, 5, -2.89, 0] }, { "code": "L", "params": [-5, 0, 5, 0] }], [{ "code": "P", "params": [-2.89, 5, 0, 0, 2.89, 5, 0] }, { "code": "L", "params": [0, -5, 0, 5] }], [{ "code": "P", "params": [-5, -2.89, 0, 0, -5, 2.89, 0] }, { "code": "L", "params": [5, 0, -5, 0] }]], "pins": [{ "PIN1": [null, null] }, { "PIN1": [null, null] }, { "PIN1": [null, null] }, { "PIN1": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "23": "DG301" } }, "20": { "typeId": 20, "abbr": "B", "descr": null, "name": "speaker", "turtle": [[{ "code": "R", "params": [-4, -1.5, 8, 3] }, { "code": "L", "params": [4, 0, 10, 0] }, { "code": "L", "params": [-10, 0, -4, 0] }, { "code": "P", "params": [-5.5, 1.5, 5.5, 1.5, 5.5, 2.5, -5.5, 2.5, 2] }], [{ "code": "R", "params": [1.5, -4, -3, 8] }, { "code": "L", "params": [0, 4, 0, 10] }, { "code": "L", "params": [0, -10, 0, -4] }, { "code": "P", "params": [-1.5, -5.5, -1.5, 5.5, -2.5, 5.5, -2.5, -5.5, 2] }], [{ "code": "R", "params": [4, 1.5, -8, -3] }, { "code": "L", "params": [-4, 0, -10, 0] }, { "code": "L", "params": [10, 0, 4, 0] }, { "code": "P", "params": [5.5, -1.5, -5.5, -1.5, -5.5, -2.5, 5.5, -2.5, 2] }], [{ "code": "R", "params": [-1.5, 4, 3, -8] }, { "code": "L", "params": [0, -4, 0, -10] }, { "code": "L", "params": [0, 10, 0, 4] }, { "code": "P", "params": [1.5, 5.5, 1.5, -5.5, 2.5, -5.5, 2.5, 5.5, 2] }]], "pins": [{ "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }, { "PIN1": [null, null], "PIN2": [null, null] }], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]], "packages": { "16": "DG301", "17": "KF301" } } }
}



*/




//doRoute(data);
