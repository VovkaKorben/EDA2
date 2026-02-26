import { prettify } from './debug.js';
import { GRID_SIZE } from './draw.js';
import { Rect, Point } from './rect.js';
import { API_URL, ErrorCodes } from './utils.js';

export const adjustCtx = (v) => Math.round(v) + 0.5;
export const adjustPoint = (pt) => [Math.round(pt[0]) + 0.5, Math.round(pt[1]) + 0.5];

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && value.constructor === Object;
}


export const stringToCoords = (coordsString) => {
    const exploded = coordsString.split(',');
    const n = exploded.map(v => +v);

    return n;


}

export const pinsToPoints = (pinString) => {
    const rawPins = {};
    let pinsGroup = pinString || '';
    pinsGroup = pinsGroup.replace(/\s/g, '');
    pinsGroup = [...pinsGroup.matchAll(/([^:;]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?);?/g)]
    for (const pin of pinsGroup) {
        rawPins[pin[1]] = [+pin[2], +pin[3]];
    }
    return rawPins;

};
export const _toFixed = (value, decimals = 2) => {
    let fixed;
    if (Array.isArray(value)) {
        fixed = value.map(x => `${x.toFixed(decimals)}`);
    } else if (isPlainObject(value)) {

        fixed = Object.entries(value).map(k => {

            const x = `${k[0]}: ${k[1].toFixed(decimals)}`;
            return x;
        });

    } else fixed = ['???'];

    return fixed.join(', ');
}

export const rotate = (figure, rotateIndex) => {

    const result = [];
    // const maxCnt = (Math.floor(figure.length / 2)) * 2
    for (let idx = 0; idx < figure.length; idx += 2) {
        switch (rotateIndex) {
            case 0: // 0 deg
                result[idx + 0] = figure[idx + 0]
                result[idx + 1] = figure[idx + 1]
                break;
            case 1: // 90 deg
                result[idx + 0] = -figure[idx + 1]
                result[idx + 1] = figure[idx + 0]
                break;

            case 2: // 180 deg
                result[idx + 0] = -figure[idx + 0]
                result[idx + 1] = figure[idx + 1]
                break;

            case 3: // 270 deg
                result[idx + 0] = figure[idx + 1]
                result[idx + 1] = -figure[idx + 0]
                break;
        }
    }
    return result;
}


export const union = (rect, other) => {
    const otherLength = other.length;
    return [
        Math.min(rect[0], other[0]),
        Math.min(rect[1], other[1]),
        Math.max(rect[2], other[2 % otherLength]),
        Math.max(rect[3], other[3 % otherLength])
    ];
}
export const multiply = (figure, value) => {

    return figure.map(d => d * value);
}
export const divide = (figure, value) => {

    return figure.map(d => d / value);
}



export const add = (figure, other) => {
    const otherLength = other.length;
    const result = figure.map((v, i) => {
        const otherIndex = i % otherLength;
        return v + other[otherIndex];
    });
    return result;
}
export const expand = (rect, x, y = x) => {
    return [rect[0] - x, rect[1] - y, rect[2] + x, rect[3] + y]
}
export const getPrimitiveBounds = (prim) => {



    switch (prim.code) {


        case 'A': // arc - for simplification
            {
                let primBounds = [...prim.center, ...prim.center]
                primBounds = expand(primBounds, prim.radius);
                return primBounds;
            }
        case 'P': // polyline/polygon
            {
                let primBounds = [Infinity, Infinity, -Infinity, -Infinity]
                for (const pt of prim.points) {
                    primBounds = union(primBounds, pt);
                }
                return primBounds;
            }
        default: throw new Error(`Invalid primitive:`);
    }


}


export const getRectWidth = (rect) => rect[2] - rect[0];
export const getRectHeight = (rect) => rect[3] - rect[1];
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



export const snapRect = (rect) => {
    const [x1, y1, x2, y2] = rect;
    return [Math.floor(x1), Math.floor(y1), Math.ceil(x2), Math.ceil(y2)];
}

export const snapRectFloat = (rect, value = 1) => {
    let [x1, y1, x2, y2] = rect;
    x1 = Math.floor(x1 / value) * value
    y1 = Math.floor(y1 / value) * value
    x2 = Math.ceil(x2 / value) * value
    y2 = Math.ceil(y2 / value) * value

    return [x1, y1, x2, y2];
}


export const isPointEqual = (pt1, pt2) => pt1[0] === pt2[0] && pt1[1] === pt2[1];

export const parseTurtle = (turtleString) => {
    //console.log(turtleString);
    try {
        const rawPrimitives = [];

        let trimTurtle = turtleString;
        if (trimTurtle) {
            trimTurtle = trimTurtle.replace(/\s/g, '');

            const primitiveGroup = [...trimTurtle.matchAll(/([A-Z])\((.*?)\)/gim)]
            // split each primitive to CODE + PARAMS
            for (const prim of primitiveGroup) {
                //const parsedPrim = {
                const code = prim[1].toUpperCase();
                const rawParams = prim[2].split(',').map((i) => parseFloat(i));

                let params = {};
                switch (code) {
                    case "P": { // polyline
                        params.points = [];

                        for (let p = 0; p < Math.floor(rawParams.length / 2); p++) {
                            params.points[p] = rawParams.slice(p * 2, p * 2 + 2);
                        }
                        // if params count is odd get last as style
                        params.style = rawParams.length % 2 ? rawParams.at(-1) : 0;
                        break;
                    }
                    case "A":
                        // C- code
                        // console.log(rawParams);
                        params.center = rawParams.slice(0, 2);
                        params.radius = rawParams[2];
                        params.start = (rawParams.length > 3 ? rawParams[3] : 0) * Math.PI / 180;
                        params.end = (rawParams.length > 4 ? rawParams[4] : 360) * Math.PI / 180;
                        break;
                    default:
                        throw new Error(`Invalid primitive code <${code}>`);
                    // console.error(`Invalid primitive code <${code}>`);
                }

                rawPrimitives.push({
                    code: code,
                    ...params
                });
            }


        }
        return rawPrimitives;
    } catch (e) {
        throw new Error(`Parsing '${turtleString}' error: ${e.message}`);

    }
};
export const LoadElems = async (elems, errors) => {

    const loadLib = async (elems, errors) => {

        const resp = await fetch(`${API_URL}library`);
        const result = await resp.json();

        // return elem_data;
        if (!(resp.ok && result.success)) {

            errors.push({ code: ErrorCodes.ERROR, message: 'error fetch data in loadLib' });
            return;
        }
        let cnt = 0;
        result.data.forEach((rawLib) => {
            try { // explode primitives to objects
                const turtle = parseTurtle(rawLib.turtle);

                // explode pins to coords
                const rawPins = pinsToPoints(rawLib.pins);

                // prepare for element rotating
                //    [];// Array.from({ length: 4 }, () => []);
                const pins = Array.from({ length: 4 }, () => ({}));

                let rawBounds = [Infinity, Infinity, -Infinity, -Infinity]
                for (const prim of turtle) {
                    // get bounds for current and accumulate
                    const primitiveBounds = getPrimitiveBounds(prim);
                    rawBounds = union(rawBounds, primitiveBounds);
                }
                rawBounds = divide(rawBounds, GRID_SIZE);

                const bounds = [];
                for (let rotateIndex = 0; rotateIndex < 4; rotateIndex++) {

                    bounds[rotateIndex] = rotate(rawBounds, rotateIndex);


                    // rotate pins
                    for (let [pinName, pinCoords] of Object.entries(rawPins)) {
                        pinCoords = divide(pinCoords, GRID_SIZE);
                        pinCoords = rotate(pinCoords, rotateIndex);
                        pins[rotateIndex][pinName] = pinCoords;


                    }

                }


                elems[rawLib.typeId] =
                {
                    typeId: rawLib.typeId,
                    abbr: rawLib.abbr,
                    descr: rawLib.descr,
                    name: rawLib.name,
                    turtle: turtle,
                    pins: pins,
                    bounds: bounds,
                    packages: {}
                };


                cnt++;
            } catch (e) {
                throw new Error(`${e.message} (typeId: ${rawLib.typeId})`);
            }
        });
        // console.log(prettify(elems, 3));
        errors.push({ code: ErrorCodes.INFO, message: `Loaded ${cnt} elements into library` });

    }

    const loadPackage = async (elems, errors) => {
        const resp = await fetch(`${API_URL}packages`);
        const result = await resp.json();

        // return elem_data;
        if (!(resp.ok && result.success)) {
            errors.push({ code: ErrorCodes.ERROR, message: 'error fetch data in loadPackage' });

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
            elems[phys.typeId].packages[phys.packageId] = phys.name;

        })




    }

    try {
        await loadLib(elems, errors);
        await loadPackage(elems, errors);
    } catch (e) {

        console.error(`error while LoadElems: ${e.message}`);
        console.error(`stack: ${e.stack}`);
    }


}
