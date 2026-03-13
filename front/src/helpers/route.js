import {
    getPrimitiveBounds, stringToCoords, parseTurtle, pinsToPoints,

    floatEqual, leq, geq,
    union, snapRectFloat, rotate, expand,
    divide,

    round, roundPoint, normalize,
    add, isPointEqual
} from './geo.js';
import { Rect } from './rect.js';
import { API_URL, ErrorCodes, ObjectType } from './utils.js';
import { prettify } from './debug.js';
import { routePcb } from './pcbAStar.js';

// import { preparePcbAStar } from './pcbRoute.js';

export const PCB_UNIT = 25.4 / 40; // inch/20 = 50mil
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



const getUsedPackageIds = ({ schemaElements: { elements }, libElements }) => {



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
            if (errors.length < 3) {
                const lib = libElements[elem.typeId];
                const elemName = `${lib.abbr}${elem.typeIndex}`;
                errors.push({ code: ErrorCodes.ERROR, message: `No package assigned for ${elemName}` });
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
        const turtle = parseTurtle(pkg.turtle, PCB_UNIT);
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

const checkPins = (libElements, packagesData) => {
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

const calculateNetworks = (wires) => {

    const getConnectedIds = (tconnPos, wiresSet) => {
        const connected = new Set()
        for (const wireId of wiresSet) {
            const wire = wires[wireId]
            if (wire.source.type === ObjectType.TCONN && isPointEqual(tconnPos, wire.source.pos)) {
                connected.add(wireId)
            }
            if (wire.target.type === ObjectType.TCONN && isPointEqual(tconnPos, wire.target.pos)) {
                connected.add(wireId)
            }
        }
        return connected
    }


    const examineWire = (wireId, wiresSet) => {
        const wire = wires[wireId]
        const collect = []
        for (const nodeName of ['source', 'target']) {

            const wireEnd = wire[nodeName];

            if (wireEnd.type === ObjectType.PIN) {
                collect.push({
                    elementId: wireEnd.elementId,
                    pinIdx: wireEnd.pinIdx
                })

            } else if (wireEnd.type === ObjectType.TCONN) {
                // get connected wires IDs
                const connected = getConnectedIds(wireEnd.pos, wiresSet)
                // remove from global wires
                for (const wireId of connected) {
                    wiresSet.delete(wireId)
                }
                //wireIds = wireIds.filter(wireId => !connected.includes(wireId));
                // check each 
                for (const wireId of connected) {
                    const examineResult = examineWire(wireId, wiresSet)
                    collect.push(...examineResult)
                }
            }
        }



        return collect
    }


    const nets = []
    let wireSet = new Set(Object.keys(wires))

    while (wireSet.size > 0) {
        const [wireId] = wireSet
        wireSet.delete(wireId)

        //  console.log(prettify(wires[wireId], 0));
        const netCollect = examineWire(wireId, wireSet);
        nets.push(netCollect)
    }
    // console.log(prettify(nets, 1))
    return nets;

}


const calcNetworkPins = (nets, pins) => {
    const result = []
    for (const net of nets) {
        const collect = []
        for (const pin of net) {

            const elemPin = pins.find(p => p.elementId === pin.elementId && p.pinName === pin.pinIdx)
            let pos = elemPin.pinPos
            pos = rotate(pos, elemPin.rotateIndex)
            pos = add(pos, elemPin.anchor)
            collect.push(pos)
        }
        result.push(collect)
    }
    return result
}

export const doRoute = async (data) => {
    const resultErrors = []
    let result = null
    try {

        // collect used packages IDs
        let { errors, packageIds } = getUsedPackageIds(data);
        if (errors.length > 0) {
            resultErrors.push(...errors)
            return {
                success: false,
                errors: resultErrors
            }
        }
        // read packages from DB
        const rawPackages = await fetchPackages(packageIds);

        // parse raw package coordinates to usable numbers
        const packagesData = convertPackages(rawPackages);

        // check all pins are exist (lib <=> phys)
        errors = checkPins(data.libElements, packagesData);
        if (errors.length > 0) {
            resultErrors.push(...errors)
            return {
                success: false,
                errors: resultErrors
            }
        }

        // create Rect-array from used element-packages (pack rect algoritm uses Rect structures)
        const packagesRects = [];
        for (const elem of Object.values(data.schemaElements.elements)) {
            const packageId = elem.packageId;

            const pkgRect = new Rect(...packagesData[packageId].bounds);
            pkgRect.elementId = elem.elementId;

            packagesRects.push(pkgRect);
        }

        // pack rects on the PCB
        const packResult = packRects(packagesRects);



        // convert packed rects to draw-ready structure
        const elements = []
        const pins = []
        for (const elem of Object.values(data.schemaElements.elements)) {
            const lib = data.libElements[elem.typeId]
            const elemId = elem.elementId;

            // find in packed 
            let packedRect = packResult.rects.find(pr => pr.elementId === elemId)
            if (!packedRect) {
                resultErrors.push({ code: ErrorCodes.ERROR, message: `ElementID ${elemId} not found in packed rects` })
                return {
                    success: false,
                    errors: resultErrors
                }
            }

            // store element rotating
            const rotateIndex = packedRect.rotateIndex

            // get real element placing
            packedRect = packedRect.toArray()
            packedRect = round(divide(packedRect, PCB_UNIT))

            // get physical package
            const pkg = packagesData[elem.packageId]

            // distance from pcb start to element
            // let elemPos = [packedRect.l, packedRect.t]
            // elemPos = roundPoint(divide(elemPos, PCB_UNIT))
            // console.log(`elemPos: ${elemPos}`)

            // element bounds
            let packageBounds = [...pkg.bounds]
            packageBounds = round(divide(packageBounds, PCB_UNIT))
            const rotatedPackageBounds = rotate(packageBounds, rotateIndex)


            // first pin (anchor) position
            let anchor = [packedRect[0] - rotatedPackageBounds[0], packedRect[1] - rotatedPackageBounds[1]]

            for (const [pinName, pinCoords] of Object.entries(pkg.pins)) {

                let pinPos = divide(pinCoords, PCB_UNIT)
                const pin = {
                    elementId: elemId,
                    pinName: pinName,
                    anchor: anchor,
                    pinPos: pinPos,
                    rotateIndex: rotateIndex
                }
                pins.push(pin);
            }

            const textPos = divide(pkg.textPos, PCB_UNIT)

            const text = `${lib.abbr}${elem.typeIndex}`
            elements.push({
                elementId: elemId,
                packageId: pkg.packageId,
                packageName: pkg.name,
                turtle: pkg.turtle,
                textPos: textPos,
                text: text,
                anchor: anchor,
                rotateIndex: rotateIndex,
                packageBounds: packageBounds
            });
        }

        // prepare pins coords for A*
        let pcbSize = [packResult.binW, packResult.binH]
        pcbSize = divide(pcbSize, PCB_UNIT)
        pcbSize = roundPoint(pcbSize)
        const pcbSizeNodes = add(pcbSize, [1, 1]) // convert size to nodes


        const pinsInNetworks = calculateNetworks(data.schemaElements.wires)
        const posInNetworks = calcNetworkPins(pinsInNetworks, pins)

        const allPinCoords = pins.map(p => {
            let pos = rotate(p.pinPos, p.rotateIndex);
            return roundPoint(add(pos, p.anchor));
        });


        const routeResult = routePcb(pcbSizeNodes, posInNetworks, allPinCoords)

        if (routeResult.errors.length > 0) {
            resultErrors.push(...routeResult.errors)
        }

        result = {
            elements: elements,
            pins: pins,
            pcbSize: pcbSize,
            nodesCount: pcbSizeNodes,
            copper: routeResult.data
        }



    } catch (e) {
        console.error(`[doRoute] ${e.message}`);
        resultErrors.push({ code: ErrorCodes.ERROR, message: e.message })
    }
    return {
        success: true,
        errors: resultErrors,
        data: result

    }
}





