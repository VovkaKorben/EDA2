import {
    getPrimitiveBounds, stringToCoords, parseTurtle, pinsToPoints,

    floatEqual, leq, geq,
    union, snapRectFloat, rotate, expand,
    divide,

    round, roundPoint, normalize,
    add, isPointEqual,
    getRectWidth,
    getRectHeight,
    multiply
} from './geo.js';
import { Rect, Point } from './rect.js';
import { API_URL, ErrorCodes, ObjectType } from './utils.js';
import { prettify } from './debug.js';
import { routePcb } from './pcbAStar.js';

// import { preparePcbAStar } from './pcbRoute.js';

export const PCB_UNIT = 25.4 / 200;
const E = 0.001;

const packRects = (inputRects) => {
    // 1. Подготовка: вычисляем чистые размеры и сортируем по площади (эвристика плотной упаковки)
    const items = inputRects.map(item => ({
        w: Math.abs(item.r - item.l),
        h: Math.abs(item.b - item.t),
        elementId: item.elementId
    })).sort((a, b) => (b.w * b.h) - (a.w * a.h));

    const packedRects = [];
    let binW = 0;
    let binH = 0;

    // Список точек (левых верхних углов), куда можно попробовать приткнуть новую фигуру
    let candidatePoints = [new Point(0, 0)];

    for (const item of items) {
        let bestScore = Infinity;
        let bestRect = null;
        let bestRotate = 0;

        // Проверяем оба варианта поворота (0 и 1)
        for (let rotate = 0; rotate < 2; rotate++) {
            const currentW = rotate === 0 ? item.w : item.h;
            const currentH = rotate === 0 ? item.h : item.w;

            for (const pt of candidatePoints) {
                // Создаем временный Rect в текущей точке
                const candidate = new Rect(pt.x, pt.y, pt.x + currentW, pt.y + currentH);

                // Координаты должны оставаться целыми
                candidate.l = Math.floor(candidate.l);
                candidate.t = Math.floor(candidate.t);
                candidate.r = Math.floor(candidate.r);
                candidate.b = Math.floor(candidate.b);

                // 2. Проверка на пересечение с уже упакованными объектами
                let collision = false;
                for (const packed of packedRects) {
                    if (candidate.intersects(packed)) {
                        collision = true;
                        break;
                    }
                }

                if (!collision) {
                    // Оцениваем, насколько "квадратной" станет корзина
                    const nextW = Math.max(binW, candidate.r);
                    const nextH = Math.max(binH, candidate.b);

                    // Ratio Score: чем ближе к 1.0, тем лучше квадрат
                    const ratio = nextW / nextH;
                    const squareScore = Math.abs(ratio - 1);

                    // Area Score: минимальное увеличение площади (вторичный признак)
                    const areaScore = nextW * nextH;

                    // Выбираем позицию с лучшей "квадратичностью"
                    if (squareScore < bestScore || (squareScore === bestScore && areaScore < (binW * binH))) {
                        bestScore = squareScore;
                        bestRect = candidate;
                        bestRotate = rotate;
                    }
                }
            }
        }

        if (bestRect) {
            // Присваиваем метаданные
            bestRect.elementId = item.elementId;
            bestRect.rotateIndex = bestRotate;

            packedRects.push(bestRect);

            // Обновляем габариты корзины
            binW = Math.max(binW, bestRect.r);
            binH = Math.max(binH, bestRect.b);

            // 3. Генерируем новые точки вставки на базе углов новой фигуры (рост вправо и вниз)
            candidatePoints.push(new Point(bestRect.r, bestRect.t));
            candidatePoints.push(new Point(bestRect.l, bestRect.b));
            candidatePoints.push(new Point(bestRect.r, 0));
            candidatePoints.push(new Point(0, bestRect.b));

            // Удаляем дубликаты точек для оптимизации скорости
            const unique = new Map();
            candidatePoints.forEach(p => unique.set(`${p.x},${p.y}`, p));
            candidatePoints = Array.from(unique.values());
        }
    }

    // Возврат результата в вашем формате
    return {
        binW: Math.round(binW),
        binH: Math.round(binH),
        rects: packedRects.map(r => ({
            l: Math.round(r.l),
            t: Math.round(r.t),
            r: Math.round(r.r),
            b: Math.round(r.b),
            elementId: r.elementId,
            rotateIndex: r.rotateIndex
        }))
    };
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
        const turtle = parseTurtle(pkg.turtle);
        // console.log(prettify(pkg, 3))
        // console.log(prettify(turtle, 3))
        const textPos = stringToCoords(pkg.textPos);



        let pins = pinsToPoints(pkg.pins);
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


        // convert pin coords to PARROTS
        for (const pinName in pins) {
            pins[pinName] = divide(pins[pinName], PCB_UNIT)

        }
        // snap bounds to grid, convert to parrots and inflate by 1
        bounds = [
            Math.floor(bounds[0] / PCB_UNIT),
            Math.floor(bounds[1] / PCB_UNIT),
            Math.ceil(bounds[2] / PCB_UNIT),
            Math.ceil(bounds[3] / PCB_UNIT)
        ]
        bounds = expand(bounds, 1)


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
    // function combine all connected pins into networks
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


    const nets = {}
    let netIndex = 1
    let wireSet = new Set(Object.keys(wires))

    while (wireSet.size > 0) {
        const [wireId] = wireSet
        wireSet.delete(wireId)

        //  console.log(prettify(wires[wireId], 0));
        const netCollect = examineWire(wireId, wireSet);
        nets[netIndex] = netCollect
        netIndex++
    }
    // console.log(prettify(nets, 1))
    return nets;

}


const calcNetworkPins = (nets, pins) => {

    // function collect pins for each network
    const networkPins = {}
    for (const [netIndex, netPins] of Object.entries(nets)) {
        networkPins[netIndex] = []
        for (const pin of netPins) {

            const elemPin = pins.find(p => p.elementId === pin.elementId && p.pinName === pin.pinIdx)
            networkPins[netIndex].push(elemPin.pinPos)
        }
    }
    return networkPins
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

        // create Rect-array from used element-packages (packing rectangle algoritm uses Rect structures)
        const packagesRects = [];
        for (const elem of Object.values(data.schemaElements.elements)) {
            const packageId = elem.packageId;
            const elementId = elem.elementId;

            // add rect
            const pkgRect = new Rect(...packagesData[packageId].bounds);
            pkgRect.elementId = elementId;
            packagesRects.push(pkgRect);
        }

        // pack rects on the PCB
        // console.log(prettify(packagesRects, 1))
        const packResult = packRects(packagesRects);
        // console.log(prettify(packResult, 2))


        // convert packed rects to draw-ready structure
        const elements = {}
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
            packedRect = [packedRect.l, packedRect.t, packedRect.r, packedRect.b]

            // get physical package
            const pkg = packagesData[elem.packageId]

            // element bounds
            let packageBounds = [...pkg.bounds]
            let rotatedPackageBounds = rotate(packageBounds, rotateIndex)
            rotatedPackageBounds = normalize(rotatedPackageBounds);

            // first pin (anchor) position
            let anchor = [packedRect[0] - rotatedPackageBounds[0], packedRect[1] - rotatedPackageBounds[1]]

            for (const [pinName, pinCoords] of Object.entries(pkg.pins)) {

                let pinPos = rotate(pinCoords, rotateIndex)
                pinPos = add(pinPos, anchor)
                const pin = {
                    elementId: elemId,
                    pinName: pinName,
                    pinPos: pinPos,
                }
                pins.push(pin);
            }
            // console.log(prettify(pins, 1))
            // const textPos = divide(pkg.textPos, PCB_UNIT)

            const text = `${lib.abbr}${elem.typeIndex}`
            elements[elemId] = {
                elementId: elemId,
                packageId: pkg.packageId,
                packageName: pkg.name,
                turtle: pkg.turtle,
                textPos: pkg.textPos,
                text: text,
                anchor: anchor,
                rotateIndex: rotateIndex,
                packageBounds: packageBounds
            }
        }

        // prepare pins coords for A*
        let pcbSize = [packResult.binW, packResult.binH]
        //pcbSize = divide(pcbSize, PCB_UNIT)        pcbSize = roundPoint(pcbSize)
        const pcbSizeNodes = add(pcbSize, [1, 1]) // convert size to nodes


        const pinsInNetworks = calculateNetworks(data.schemaElements.wires)
        const posInNetworks = calcNetworkPins(pinsInNetworks, pins)

      /*  const allPinCoords = pins.map(pin => {
            const elem = elements[pin.elementId]
            let pos = rotate(pin.pinPos, elem.rotateIndex)
            pos = add(pos, elem.anchor);
            return pos
        });
*/


        const routeResult = routePcb(pcbSizeNodes, posInNetworks, pins)

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





