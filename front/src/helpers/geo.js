import { GRID_SIZE } from './draw.js';
import { API_URL } from './utils.js';


export const getPrimitiveBounds = (prim) => {


    let primBounds = [Infinity, Infinity, -Infinity, -Infinity];
    switch (prim.code) {


        case 'R': { // rectangle
            const [x, y, w, h] = prim.params;
            const x2 = x + w, y2 = y + h;
            primBounds = [
                Math.min(x, x2), Math.min(y, y2),
                Math.max(x, x2), Math.max(y, y2)
            ];
        }
            break;
        case 'L': // line
            {
                const [x, y, x2, y2] = prim.params;
                primBounds = [
                    Math.min(x, x2), Math.min(y, y2),
                    Math.max(x, x2), Math.max(y, y2)
                ];
                break;
            }
        case 'C': // circle
        case 'A': // arc - for simplification
            {
                const [x, y, r] = prim.params;
                primBounds = [x - r, y - r, x + r, y + r];
                break;
            }
        case 'P': // polyline/polygon
            {
                for (let p = 0; p < prim.params.length - 1; p += 2) {
                    let [x, y] = prim.params.slice(p, p + 2);
                    primBounds = expandBounds(primBounds, [x, y, x, y]);
                }
                break;
            }
    }
    return primBounds;

}

export const expandBounds = (current, add) => {

    return [
        Math.min(current[0], add[0]), Math.min(current[1], add[1]),
        Math.max(current[2], add[2]), Math.max(current[3], add[3])
    ]

}

export const getWH = (arr) => { return [arr[2] - arr[0], arr[3] - arr[1]]; };
export const clamp = (v, min, max) => { if (v < min) return min; if (v > max) return max; return v; }

export const pointsDistance = (pt1, pt2) => {
    return Math.sqrt(
        Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2)
    )

}
export const ptInRect = (rect, point) => {
    return point[0] >= rect[0] &&
        point[0] <= rect[2] &&
        point[1] >= rect[1] &&
        point[1] <= rect[3];

}
export const floatEqual = (f1, f2, e = Number.EPSILON) => { return Math.abs(f1 - f2) < e; }
export const leq = (a, b, e = Number.EPSILON) => { return (a < b) || (Math.abs(a - b) < e); }
export const geq = (a, b, e = Number.EPSILON) => { return (a > b) || (Math.abs(a - b) < e); }
export const roundPoint = (pt) => [Math.round(pt[0]), Math.round(pt[1])];
export const addPoint = (point, delta) => {
    return [point[0] + delta[0], point[1] + delta[1]]
}
export const subPoint = (point, delta) => {
    return [point[0] - delta[0], point[1] - delta[1]]
}
export const multiplyPoint = (point, m) => {
    return [point[0] * m, point[1] * m]
}
export const transformRect = (rect, delta) => {
    return [rect[0] + delta[0], rect[1] + delta[1], rect[2] + delta[0], rect[3] + delta[1]]
}
export const multiplyRect = (rect, m) => {
    return [rect[0] * m, rect[1] * m, rect[2] * m, rect[3] * m]
}
export const expandRect = (rect, x, y) => {
    return [rect[0] - x, rect[1] - y, rect[2] + x, rect[3] + y]
}

export const snapRect = (rect) => {
    const [x1, y1, x2, y2] = rect;
    return [Math.floor(x1), Math.floor(y1), Math.ceil(x2), Math.ceil(y2)];
}
export const rotatePoint = (pt, rotateIndex) => {
    switch (rotateIndex) {
        case 0: return [pt[0], pt[1]];
        case 1: return [-pt[1], pt[0]];
        case 2: return [-pt[0], -pt[1]];
        case 3: return [pt[1], -pt[0]];
        default: throw new Error(`Invalid rotate index: ${rotateIndex}`);
    }
}

export const rotatePrimitive = (prim, rotateIndex) => {



    try {
        const p = prim.params;
        let params;
        switch (prim.code) {
            case 'R': // Rectangle
                {
                    //    const point1 = multiplyPoint([...p.slice(0, 2)], 1 / GRID_SIZE);
                    //  const point2 = multiplyPoint([...p.slice(2, 4)], 1 / GRID_SIZE);
                    params = [
                        ...rotatePoint([...p.slice(0, 2)], rotateIndex),
                        ...rotatePoint([...p.slice(2, 4)], rotateIndex)
                    ];
                    break;
                }
            case 'L': // Line
                {
                    // const point1 = multiplyPoint([...p.slice(0, 2)], 1 / GRID_SIZE);
                    // const point2 = multiplyPoint([...p.slice(2, 4)], 1 / GRID_SIZE);
                    params = [
                        ...rotatePoint([...p.slice(0, 2)], rotateIndex),
                        ...rotatePoint([...p.slice(2, 4)], rotateIndex)
                    ];
                    break;
                }
            case 'C': // Circle

                params = [
                    ...rotatePoint(p.slice(0, 2), rotateIndex),
                    ...p.slice(2, 3)
                ];
                break;
            case 'P': // Polyline / Polygon
                {
                    params = [];
                    const pointsCount = (p.length / 2) | 0;
                    for (let ptIndex = 0; ptIndex < pointsCount; ptIndex++) {
                        params.push(...rotatePoint(p.slice(ptIndex * 2, ptIndex * 2 + 2), rotateIndex));
                    }
                    // append poly mode
                    params.push(...p.slice(pointsCount * 2, pointsCount * 2 + 1));

                } break;

            case 'A':// Arc
                {
                    const center = rotatePoint(p.slice(0, 2), rotateIndex)
                    const [degStart] = p.slice(3, 4);
                    const radStart = ((degStart + rotateIndex * 90) % 360) / 180 * Math.PI;
                    let [degEnd] = p.slice(4, 5);
                    const radEnd = ((degEnd + rotateIndex * 90) % 360) / 180 * Math.PI;

                    params = [
                        ...center,
                        ...p.slice(2, 3),
                        radStart, radEnd,
                        ...p.slice(5, 6)
                    ];

                    // console.log('arc');

                }; break;


            default: throw new Error(`Invalid primitive code: ${prim.code}`);
        }
        return { 'code': prim.code, params: params };
    } catch (e) {
        console.error(`error: ${e}`);
        return { 'code': prim.code, params: [] };
    }
}
export const isPointEqual = (pt1, pt2) => pt1[0] === pt2[0] && pt1[1] === pt2[1];

export const LoadElems = async (elems, errors) => {

    const loadLib = async (elems, errors) => {
        const resp = await fetch(`${API_URL}library`);
        const result = await resp.json();

        // return elem_data;
        if (!(resp.ok && result.success)) {
            errors.push('error fetch data in loadLib');
            return;
        }
        let cnt = 0;
        result.data.forEach((rawElem) => {
            // explode primitives to objects
            const rawPrimitives = [];

            let trimTurtle = rawElem.turtle;
            if (trimTurtle) {
                trimTurtle = trimTurtle.replace(/\s/g, '');

                const primitiveGroup = [...trimTurtle.matchAll(/([A-Z])\((.*?)\)/gim)]
                // split each primitive to CODE + PARAMS
                for (const prim of primitiveGroup) {
                    const parsedPrim = {
                        code: prim[1].toUpperCase(),
                        params: prim[2].split(',').map((i) => parseFloat(i))
                    };
                    rawPrimitives.push(parsedPrim);
                }

            }
            // explode pins to coords
            const rawPins = {};

            let pinsGroup = rawElem.pins || '';
            pinsGroup = pinsGroup.replace(/\s/g, '');
            pinsGroup = [...pinsGroup.matchAll(/([^:;]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?);?/g)]
            for (const pin of pinsGroup) {
                rawPins[pin[1]] = [pin[2] / GRID_SIZE, pin[3] / GRID_SIZE];
            }

            // prepare for element rotating
            const turtle = Array.from({ length: 4 }, () => []);
            const pins = Array.from({ length: 4 }, () => ({}));
            const bounds = Array.from({ length: 4 }, () => [Infinity, Infinity, -Infinity, -Infinity]);

            for (let rotateIndex = 0; rotateIndex < 4; rotateIndex++) {

                // rotate all primitives
                // bounds[rotateIndex] =;
                for (const prim of rawPrimitives) {
                    const rotatedPrimitive = rotatePrimitive(prim, rotateIndex);
                    turtle[rotateIndex].push(rotatedPrimitive);

                    // get bounds for current and accumulate
                    const primitiveBounds = getPrimitiveBounds(rotatedPrimitive);
                    bounds[rotateIndex] = expandBounds(bounds[rotateIndex], primitiveBounds);

                }
                bounds[rotateIndex] = multiplyRect(bounds[rotateIndex], 1 / GRID_SIZE);
                // rotate pins
                for (let [pinName, pinCoords] of Object.entries(rawPins)) {
                    pins[rotateIndex][pinName] = rotatePoint(pinCoords, rotateIndex);

                }

            }


            elems[rawElem.typeId] =
            {
                typeId: rawElem.typeId,
                abbr: rawElem.abbr,
                descr: rawElem.descr,
                name: rawElem.name,
                turtle: turtle,
                pins: pins,
                bounds: bounds,
                packages: {}
            };
            cnt++;
        });
        errors.push(`Loaded ${cnt} elements into library`);

    }

    const loadPackage = async (elems, errors) => {
        const resp = await fetch(`${API_URL}packages`);
        const result = await resp.json();

        // return elem_data;
        if (!(resp.ok && result.success)) {
            errors.push('error fetch data in loadPackage');
            return;
        }

        result.data.forEach((phys) => {

            // parse turtle
            const rawPrimitives = [];
            let trimTurtle = phys.turtle;
            if (trimTurtle) {
                trimTurtle = trimTurtle.replace(/\s/g, '');

                const primitiveGroup = [...trimTurtle.matchAll(/([A-Z])\((.*?)\)/gim)]
                // split each primitive to CODE + PARAMS
                for (const prim of primitiveGroup) {
                    const parsedPrim = {
                        code: prim[1].toUpperCase(),
                        params: prim[2].split(',').map((i) => parseFloat(i))
                    };
                    rawPrimitives.push(parsedPrim);
                }

            }



            // put package name to corresponding element
            elems[phys.typeId].packages[phys.physId] = phys.name;

        })




    }


    await loadLib(elems, errors);
    await loadPackage(elems, errors);



}