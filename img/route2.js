import { API_URL } from '../front/src/helpers/utils.js';
// import { prettify } from './debug.js';
import {
    expandPoint, getPrimitiveBounds, expandBounds, stringToPoint, turtleToParams, pinsToPoints, expandBoundsByPoint,
    getRectWidth, getRectHeight,
    floatEqual, leq, geq
} from '../front/src/helpers/geo.js';
// import { prettify } from './debug.js';
import { Rect } from '../front/src/helpers/rect.js';

// 1. берем черепашку,считаем границы
// 2. берем текст, считаем точку 2.5мм вверх+вниз, расширяем
// 2А. добавляем пины!!
// 3. опционально - ещё расширяем на 1-2мм, чтобы не впритык было
// 4. на выходе - прямоугольник для размещения

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
    const pins = pinsToPoints(p.pins);
    const textpos = stringToPoint(p.textpos);
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
        const canGrowRight = (binW + rect.w) * Math.max(binH, rect.h);
        const canGrowDown = (binH + rect.h) * Math.max(binW, rect.w);
        let newFree;

        if (canGrowRight < canGrowDown) {
            // Добавляем свободную область справа (right = binW + rect.w)
            newFree = new Rect(binW, 0, binW + rect.w, Math.max(binH, rect.h));
            binW += rect.w;
            binH = Math.max(binH, rect.h);
        } else {
            // Добавляем свободную область снизу (bottom = binH + rect.h)
            newFree = new Rect(0, binH, Math.max(binW, rect.w), binH + rect.h);
            binH += rect.h;
            binW = Math.max(binW, rect.w);
        }

        freeRects.push(newFree);
        stitchFreeRects(newFree);
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
                // Если область i полностью поглощена областью j — помечаем на удаление
                if (list[i].inRect(list[j])) {
                    redundant.add(i);
                }

            }
        }
        const cleaned = list.filter((r, i) => !redundant.has(i));
        return cleaned;
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

        rect.l = bestFreeRect.l;
        rect.t = bestFreeRect.t;
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










export const doRoute = async (data) => {
    try {

        /*const packagesResult = await initPackages(data);
        if (packagesResult.errors.length > 0)
            console.error(packagesResult.errors);
        const rawPackages = packagesResult.packages;
*/
        const rawPackages = pk;
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









const data =
{
    "schemaElements": { "elements": { "0": { "id": 0, "typeId": 3, "pos": [76, 46], "rotate": 0, "typeIndex": 1, "packageId": 9 }, "1": { "id": 1, "typeId": 13, "pos": [67, 35], "rotate": 0, "typeIndex": 1, "packageId": "20" }, "2": { "id": 2, "typeId": 18, "pos": [58, 42], "rotate": 0, "typeIndex": 1, "packageId": "11" } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 0, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [70, 46] }, "path": [[73, 46], [70, 46]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [63, 42] }, "path": [[65, 35], [63, 35], [63, 42]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [63, 42] }, "path": [[62, 42], [63, 42]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [63, 42] }, "target": { "type": "TCONN", "pos": [63, 46] }, "path": [[63, 42], [63, 46]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[70, 46], [70, 40]] }, "5": { "wireId": 5, "source": { "type": "TCONN", "pos": [70, 46] }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[69, 35], [70, 35], [70, 40]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 0, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[77, 43], [77, 40], [70, 40]] }, "7": { "wireId": 7, "source": { "type": "TCONN", "pos": [70, 46] }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[70, 46], [67, 46]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[58, 45], [58, 46]] }, "9": { "wireId": 9, "source": { "type": "TCONN", "pos": [63, 46] }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[63, 46], [58, 46]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN3" }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[54, 42], [53, 42], [53, 46], [58, 46]] }, "11": { "wireId": 11, "source": { "type": "TCONN", "pos": [63, 46] }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[63, 46], [67, 46]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 0, "pinIdx": "E" }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[77, 49], [77, 50], [67, 50], [67, 46]] } } },
    "libElements": { "1": { "typeId": 1, "abbr": "R", "descr": "A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.", "name": "resistor", "turtle": [[{ "code": "R", "params": [-5, -2, 10, 4] }, { "code": "L", "params": [-10, 0, -5, 0] }, { "code": "L", "params": [5, 0, 10, 0] }], [{ "code": "R", "params": [2, -5, -4, 10] }, { "code": "L", "params": [0, -10, 0, -5] }, { "code": "L", "params": [0, 5, 0, 10] }], [{ "code": "R", "params": [5, 2, -10, -4] }, { "code": "L", "params": [10, 0, 5, 0] }, { "code": "L", "params": [-5, 0, -10, 0] }], [{ "code": "R", "params": [-2, 5, 4, -10] }, { "code": "L", "params": [0, 10, 0, 5] }, { "code": "L", "params": [0, -5, 0, -10] }]], "pins": [{ "0": [-10, 0], "1": [10, 0] }, { "0": [0, -10], "1": [0, 10] }, { "0": [10, 0], "1": [-10, 0] }, { "0": [0, 10], "1": [0, -10] }], "bounds": [[-10, -2, 10, 2], [-2, -10, 2, 10], [-10, -2, 10, 2], [-2, -10, 2, 10]] }, "2": { "typeId": 2, "abbr": "C", "descr": "A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material", "name": "capacitor", "turtle": [[{ "code": "L", "params": [-1, -4, -1, 4] }, { "code": "L", "params": [1, -4, 1, 4] }, { "code": "L", "params": [-6, 0, -1, 0] }, { "code": "L", "params": [1, 0, 6, 0] }], [{ "code": "L", "params": [4, -1, -4, -1] }, { "code": "L", "params": [4, 1, -4, 1] }, { "code": "L", "params": [0, -6, 0, -1] }, { "code": "L", "params": [0, 1, 0, 6] }], [{ "code": "L", "params": [1, 4, 1, -4] }, { "code": "L", "params": [-1, 4, -1, -4] }, { "code": "L", "params": [6, 0, 1, 0] }, { "code": "L", "params": [-1, 0, -6, 0] }], [{ "code": "L", "params": [-4, 1, 4, 1] }, { "code": "L", "params": [-4, -1, 4, -1] }, { "code": "L", "params": [0, 6, 0, 1] }, { "code": "L", "params": [0, -1, 0, -6] }]], "pins": [{ "0": [-6, 0], "1": [6, 0] }, { "0": [0, -6], "1": [0, 6] }, { "0": [6, 0], "1": [-6, 0] }, { "0": [0, 6], "1": [0, -6] }], "bounds": [[-6, -4, 6, 4], [-4, -6, 4, 6], [-6, -4, 6, 4], [-4, -6, 4, 6]] }, "3": { "typeId": 3, "abbr": "VT", "descr": "A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.", "name": "transistor", "turtle": [[{ "code": "L", "params": [-11, 0, -2, 0] }, { "code": "L", "params": [-2, -4, -2, 4] }, { "code": "L", "params": [2, 10.66, 2, 5.66] }, { "code": "L", "params": [2, -5.66, 2, -10.66] }, { "code": "C", "params": [0, 0, 6] }, { "code": "L", "params": [-2, -1.748, 2, -5.66] }, { "code": "P", "params": [-2, 1.749, 0.122, 2.456, -1.292, 3.87, 2] }, { "code": "L", "params": [-2, 1.749, 2, 5.66] }], [{ "code": "L", "params": [0, -11, 0, -2] }, { "code": "L", "params": [4, -2, -4, -2] }, { "code": "L", "params": [-10.66, 2, -5.66, 2] }, { "code": "L", "params": [5.66, 2, 10.66, 2] }, { "code": "C", "params": [0, 0, 6] }, { "code": "L", "params": [1.748, -2, 5.66, 2] }, { "code": "P", "params": [-1.749, -2, -2.456, 0.122, -3.87, -1.292, 2] }, { "code": "L", "params": [-1.749, -2, -5.66, 2] }], [{ "code": "L", "params": [11, 0, 2, 0] }, { "code": "L", "params": [2, 4, 2, -4] }, { "code": "L", "params": [-2, -10.66, -2, -5.66] }, { "code": "L", "params": [-2, 5.66, -2, 10.66] }, { "code": "C", "params": [0, 0, 6] }, { "code": "L", "params": [2, 1.748, -2, 5.66] }, { "code": "P", "params": [2, -1.749, -0.122, -2.456, 1.292, -3.87, 2] }, { "code": "L", "params": [2, -1.749, -2, -5.66] }], [{ "code": "L", "params": [0, 11, 0, 2] }, { "code": "L", "params": [-4, 2, 4, 2] }, { "code": "L", "params": [10.66, -2, 5.66, -2] }, { "code": "L", "params": [-5.66, -2, -10.66, -2] }, { "code": "C", "params": [0, 0, 6] }, { "code": "L", "params": [-1.748, 2, -5.66, -2] }, { "code": "P", "params": [1.749, 2, 2.456, -0.122, 3.87, 1.292, 2] }, { "code": "L", "params": [1.749, 2, 5.66, -2] }]], "pins": [{ "B": [-11, 0], "E": [2, 10.66], "C": [2, -10.66] }, { "B": [0, -11], "E": [-10.66, 2], "C": [10.66, 2] }, { "B": [11, 0], "E": [-2, -10.66], "C": [-2, 10.66] }, { "B": [0, 11], "E": [10.66, -2], "C": [-10.66, -2] }], "bounds": [[-11, -10.66, 6, 10.66], [-10.66, -11, 10.66, 6], [-6, -10.66, 11, 10.66], [-10.66, -6, 10.66, 11]] }, "4": { "typeId": 4, "abbr": "VD", "descr": "A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.", "name": "diode", "turtle": [[{ "code": "P", "params": [-2.5, -2.5, 2.5, 0, -2.5, 2.5, 1] }, { "code": "L", "params": [-7.5, 0, 7.5, 0] }, { "code": "L", "params": [2.5, 2.5, 2.5, -2.5] }], [{ "code": "P", "params": [2.5, -2.5, 0, 2.5, -2.5, -2.5, 1] }, { "code": "L", "params": [0, -7.5, 0, 7.5] }, { "code": "L", "params": [-2.5, 2.5, 2.5, 2.5] }], [{ "code": "P", "params": [2.5, 2.5, -2.5, 0, 2.5, -2.5, 1] }, { "code": "L", "params": [7.5, 0, -7.5, 0] }, { "code": "L", "params": [-2.5, -2.5, -2.5, 2.5] }], [{ "code": "P", "params": [-2.5, 2.5, 0, -2.5, 2.5, 2.5, 1] }, { "code": "L", "params": [0, 7.5, 0, -7.5] }, { "code": "L", "params": [2.5, -2.5, -2.5, -2.5] }]], "pins": [{ "A": [-7.5, 0], "C": [7.5, 0] }, { "A": [0, -7.5], "C": [0, 7.5] }, { "A": [7.5, 0], "C": [-7.5, 0] }, { "A": [0, 7.5], "C": [0, -7.5] }], "bounds": [[-7.5, -2.5, 7.5, 2.5], [-2.5, -7.5, 2.5, 7.5], [-7.5, -2.5, 7.5, 2.5], [-2.5, -7.5, 2.5, 7.5]] }, "5": { "typeId": 5, "abbr": "test", "descr": "test", "name": "test", "turtle": [[], [], [], []], "pins": [{}, {}, {}, {}], "bounds": [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]] } },
    "saved": { "elements": { "0": { "id": 0, "typeId": 3, "pos": [76, 46], "rotate": 0, "typeIndex": 1, "packageId": "9" }, "1": { "id": 1, "typeId": 13, "pos": [67, 35], "rotate": 0, "typeIndex": 1, "packageId": "20" }, "2": { "id": 2, "typeId": 18, "pos": [58, 42], "rotate": 0, "typeIndex": 1, "packageId": "11" } }, "wires": { "0": { "wireId": 0, "source": { "type": "PIN", "elementId": 0, "pinIdx": "B" }, "target": { "type": "TCONN", "pos": [70, 46] }, "path": [[73, 46], [70, 46]] }, "1": { "wireId": 1, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [63, 42] }, "path": [[65, 35], [63, 35], [63, 42]] }, "2": { "wireId": 2, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN2" }, "target": { "type": "TCONN", "pos": [63, 42] }, "path": [[62, 42], [63, 42]] }, "3": { "wireId": 3, "source": { "type": "TCONN", "pos": [63, 42] }, "target": { "type": "TCONN", "pos": [63, 46] }, "path": [[63, 42], [63, 46]] }, "4": { "wireId": 4, "source": { "type": "PIN", "elementId": 1, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[70, 46], [70, 40]] }, "5": { "wireId": 5, "source": { "type": "TCONN", "pos": [70, 46] }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[69, 35], [70, 35], [70, 40]] }, "6": { "wireId": 6, "source": { "type": "PIN", "elementId": 0, "pinIdx": "C" }, "target": { "type": "TCONN", "pos": [70, 40] }, "path": [[77, 43], [77, 40], [70, 40]] }, "7": { "wireId": 7, "source": { "type": "TCONN", "pos": [70, 46] }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[70, 46], [67, 46]] }, "8": { "wireId": 8, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN1" }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[58, 45], [58, 46]] }, "9": { "wireId": 9, "source": { "type": "TCONN", "pos": [63, 46] }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[63, 46], [58, 46]] }, "10": { "wireId": 10, "source": { "type": "PIN", "elementId": 2, "pinIdx": "PIN3" }, "target": { "type": "TCONN", "pos": [58, 46] }, "path": [[54, 42], [53, 42], [53, 46], [58, 46]] }, "11": { "wireId": 11, "source": { "type": "TCONN", "pos": [63, 46] }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[63, 46], [67, 46]] }, "12": { "wireId": 12, "source": { "type": "PIN", "elementId": 0, "pinIdx": "E" }, "target": { "type": "TCONN", "pos": [67, 46] }, "path": [[77, 49], [77, 50], [67, 50], [67, 46]] } } },
    "view": { "zoomIndex": 7, "zoom": 8, "interval": 20, "x": 49.77083333333335, "y": 23.26666666666668 }
}
//const sch = data.schemaElements;
//const lib = data.libElements;




    
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
    const pins = pinsToPoints(p.pins);
    const textpos = stringToPoint(p.textpos);
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

