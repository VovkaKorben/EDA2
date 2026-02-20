import { API_URL } from './utils.js';
// import { prettify } from './debug.js';
import {
    expandPoint, getPrimitiveBounds, expandBounds, extractCoords, turtleToParams, pinsToParams, expandBoundsByPoint,
    getRectWidth, getRectHeight,
    floatEqual
} from './geo.js';
// import { prettify } from './debug.js';
import { Rect } from './rect.js';

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

const packRects = (inputRects) => {
    let binW = 0;
    let binH = 0;
    let freeRects = [];
    const packedRects = [];

    // place find (BSSF)
    const findBestFit = (rect, freeRects) => {
        let bestRect = null;
        let minShortSideFit = Infinity

        for (const free of freeRects) {
            if (free.w >= rect.w && free.h >= rect.h) {
                const leftoverW = free.w - rect.w
                const leftoverH = free.h - rect.h
                const shortSideFit = Math.min(leftoverW, leftoverH)

                if (shortSideFit < minShortSideFit) {
                    minShortSideFit = shortSideFit;
                    bestRect = free;
                }
            }
        }
        return bestRect
    }

    // РАСШИРЕНИЕ КОНТЕЙНЕРА
    const expandBin = (rect) => {
        const canGrowRight = (binW + rect.w) * Math.max(binH, rect.h)
        const canGrowDown = (binH + rect.h) * Math.max(binW, rect.w)
        let newFree;
        if (canGrowRight < canGrowDown) {
            // Добавляем свободную область справа
            newFree = Rect(binW, 0, rect.w, Math.max(binH, rect.h))
            binW += rect.w
            binH = Math.max(binH, rect.h)
        } else {
            // Добавляем свободную область снизу
            newFree = Rect(0, binH, Math.max(binW, rect.w), rect.h)
            binH += rect.h
            binW = Math.max(binW, rect.w)
        }
        freeRects.Add(newFree)
        // После расширения нужно выполнить слияние свободных областей,
        // чтобы "сшить" новую область с существующими у края.
        stitchFreeRects(newFree)
    }


    // ОБНОВЛЕНИЕ СВОБОДНЫХ ОБЛАСТЕЙ
    const updateFreeRects = (placedRect) => {
        const newList = [];
        for (const free of freeRects)
            if (free.intersects(placedRect)) {
                // cut first free into 4 pieces

                if (placedRect.t > free.t) {// top
                    newList.Add(Rect(free.x, free.y, free.w, placedRect.y - free.y))
                }

                if (placedRect.b < free.b) {// bottom
                    newList.Add(Rect(free.x, placedRect.y + placedRect.h, free.w, free.y + free.h - (placedRect.y + placedRect.h)))
                }

                if (placedRect.l > free.l) { // left
                    newList.Add(Rect(free.x, free.y, placedRect.x - free.x, free.h))
                }


                if (placedRect.r < free.r) { // right
                    newList.Add(Rect(placedRect.x + placedRect.w, free.y, free.x + free.w - (placedRect.x + placedRect.w), free.h))
                }
            } else {
                newList.Add(free)
            }

        // Удаляем дубликаты и те, что внутри других
        freeRects = cleanUp(newList)
    }


    const cleanUp = (list) => {
        const listLen = list.Length;
        const redundant = new Set();
        for (let i = 0; i < listLen; i++) {
            for (let j = 0; j < listLen; j++) {

                if (i === j) continue;
                // Если область i полностью поглощена областью j — помечаем на удаление
                if (list[i].inside(list[i])) {
                    redundant.add(i);
                }
                const cleaned = list.filter((r, i) => redundant.has(i));
                return cleaned;
            }
        }
    }



    const stitchFreeRects = (newArea) => {
        // Перебираем с конца, чтобы безопасно удалять элементы
        for (let i = freeRects.length - 1; i >= 0; i--) {
            const current = freeRects[i];

            // Пропускаем саму себя
            if (current === newArea) continue;

            // 1. Попытка слияния по горизонтали (если стоят бок о бок)
            if (floatEqual(current.y, newArea.y) && floatEqual(current.h, newArea.h)) {
                // Если текущий прямоугольник примыкает СЛЕВА к новому
                if (floatEqual(current.r, newArea.x)) {
                    newArea.l = current.l
                    newArea.w += current.w
                    freeRects.RemoveAt(i)
                }
                // Если текущий прямоугольник примыкает СПРАВА к новому
                else if (floatEqual(newArea.r, current.x)) {
                    newArea.w += current.w
                    freeRects.RemoveAt(i)
                }
            }

            // 2. Попытка слияния по вертикали (если стоят друг на друге)
            else if (current.x == newArea.x && current.w == newArea.w) {
                // Если текущий прямоугольник примыкает СВЕРХУ к новому
                if (floatEqual(current.b, newArea.y)) {
                    newArea.y = current.y
                    newArea.h += current.h
                    freeRects.RemoveAt(i)
                }
                // Если текущий прямоугольник примыкает СНИЗУ к новому
                else if (floatEqual(newArea.b, current.y)) {
                    newArea.h += current.h
                    freeRects.RemoveAt(i)
                }
            }
        }
    }


    // Sort inputRects by Area descending
    inputRects.sort((a, b) => a.area < b.area);

    for (let rect of inputRects) {
        // 1. Пытаемся найти место в текущих границах
        let bestFreeRect = findBestFit(rect, freeRects)

        // 2. Если место не найдено, расширяем контейнер
        if (bestFreeRect === null) {
            expandBin(rect)
            bestFreeRect = findBestFit(rect, freeRects)
        }
        // 3. Размещаем прямоугольник
        rect.x = bestFreeRect.x
        rect.y = bestFreeRect.y
        packedRects.Add(rect)

        // 4. Обновляем список свободных областей (Split & Prune)
        updateFreeRects(rect)
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
                rect: Rect(0, 0, pkg.w, pkg.h),
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






const pk = [
    {
        packageId: 9,
        typeId: 3,
        name: '2N2222',
        pins: 'E: 2.54, 0; B: 1.27, 0; C: 0, 0',
        textpos: '1.27, 3.8',
        turtle: 'P(3.1674,1.3,3.57,0,1.27,-2.3,-1.03,0,-0.6274,1.3,0);\r\n' +
            'P(-0.6274,1.3,3.1674,1.3,0);'
    },
    {
        packageId: 11,
        typeId: 18,
        name: 'Alps RK09',
        pins: 'PIN1: 5.08, 0; PIN2: 2.54, 0; PIN3: 0, 0',
        textpos: '2.4487, -4.1213',
        turtle: 'P(-3.2513,12.5,8.1487,12.5,8.1487,0,-3.2513,0)'
    },
    {
        packageId: 20,
        typeId: 13,
        name: 'Polyvaricon',
        pins: 'PIN1: 15.24, -15.24; PIN2: 0, -15.24; PIN3: 15.24, 0; PIN4: 0, 0',
        textpos: '7.62, -20.6946',
        turtle: 'P(-2.88,2.88,18.12,2.88,18.12,-18.12,0.2554,-18.12,-2.88,-14.9845)'
    }
];

doRoute(data);

