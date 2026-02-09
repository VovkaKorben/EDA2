// import { API_URL } from './utils.js';
const API_URL = 'http://localhost:3100/api/';
import { getPrimitiveBounds, expandBounds, rotatePrimitive, rotatePoint } from './geo.js';

export const LoadElems = async () => {
    const resp = await fetch(`${API_URL}library`);
    const result = await resp.json();
    const elem_data = {};

    if (!(resp.ok && result.success))
        return;

    result.data.forEach((rawElem) => {
        // explode primitives to objects
        const rawPrimitives = [];
        if (rawElem.turtle) {
            const primitiveGroup = [...rawElem.turtle.matchAll(/([A-Z])\((.*?)\)/gim)]
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
            rawPins[pin[1]] = [+pin[2], +pin[3]];
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

            // rotate pins
            for (let [pinName, pinCoords] of Object.entries(rawPins)) {
                pins[rotateIndex][pinName] = rotatePoint(pinCoords, rotateIndex);

            }

        }


        elem_data[rawElem.typeId] =
        {
            typeId: rawElem.typeId,
            abbr: rawElem.abbr,
            descr: rawElem.descr,
            name: rawElem.name,
            turtle: turtle,
            pins: pins,
            bounds: bounds
        };

    });
    return elem_data;

}