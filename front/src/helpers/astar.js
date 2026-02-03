import { prettify } from './debug.js';
import { transformRect, expandBounds, expandRect, snapRect, addPoint, floatEqual, leq, geq, ptInRect, pointsDistance } from './geo.js';
//vt1 - 1 c1-1

const libElements = {
    "1":
    {
        "typeId": 1,
        "name": "resistor",
        "abbr": "R",
        "turtle": [{ "code": "R", "params": [-5, -2, 10, 4] }, { "code": "L", "params": [-10, 0, -5, 0] }, { "code": "L", "params": [5, 0, 10, 0] }],
        "pins": { "0": [-10, 0], "1": [10, 0] },
        "descr": "A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.",
        "bounds": [-10, -2, 10, 2]
    },
    "2": { "typeId": 2, "name": "capacitor", "abbr": "C", "turtle": [{ "code": "L", "params": [-1, -4, -1, 4] }, { "code": "L", "params": [1, -4, 1, 4] }, { "code": "L", "params": [-6, 0, -1, 0] }, { "code": "L", "params": [1, 0, 5, 0] }], "pins": { "0": [-6, 0], "1": [6, 0] }, "descr": "A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material", "bounds": [-6, -4, 5, 4] },
    "3": { "typeId": 3, "name": "transistor", "abbr": "VT", "turtle": [{ "code": "L", "params": [-11, 0, -2, 0] }, { "code": "L", "params": [-2, -4, -2, 4] }, { "code": "L", "params": [2, 10.66, 2, 5.66] }, { "code": "L", "params": [2, -5.66, 2, -10.66] }, { "code": "C", "params": [0, 0, 6] }, { "code": "L", "params": [-2, -1.748, 2, -5.66] }, { "code": "P", "params": [-2, 1.749, 0.122, 2.456, -1.292, 3.87, 2] }, { "code": "L", "params": [-2, 1.749, 2, 5.66] }], "pins": { "0": [-11, 0], "1": [2, 10.66], "2": [2, -10.66] }, "descr": "A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.", "bounds": [-11, -10.66, 6, 10.66] },
    "4": { "typeId": 4, "name": "diode", "abbr": "VD", "turtle": [{ "code": "P", "params": [-2.5, -2.5, 2.5, 0, -2.5, 2.5, 1] }, { "code": "L", "params": [-7.5, 0, 7.5, 0] }, { "code": "L", "params": [2.5, 2.5, 2.5, -2.5] }], "pins": { "0": [-7.5, 0], "1": [7.5, 0] }, "descr": "A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.", "bounds": [-7.5, -2.5, 7.5, 2.5] },
    "5": { "typeId": 5, "name": "test", "abbr": "test", "turtle": [], "pins": {}, "descr": "test", "bounds": [null, null, null, null] }
}
const schemaElements = {
    "elements": [
        { "id": 1770098657449, "typeId": 3, "pos": [207, 116], "rotate": 0, "typeIndex": 1 },
        { "id": 1770098660738, "typeId": 2, "pos": [156, 152], "rotate": 0, "typeIndex": 1 },
        { "id": 1770098662764, "typeId": 1, "pos": [161, 84], "rotate": 0, "typeIndex": 1 },
        { "id": 1770103147866, "typeId": 3, "pos": [175.44999999999993, 127.39999999999998], "rotate": 0, "typeIndex": 2 }],
    "wires": []
}
const toConnect = [{ id: 1770098657449, pin: 1 }, { id: 1770098660738, pin: 1 }];


const getPinCoords = (elemId, pinIndex) => {
    const element = schemaElements.elements.find((e) => e.id === elemId);
    const pinCoords = libElements[element.typeId].pins[pinIndex];
    const pt = addPoint(element.pos, pinCoords);
    return pt;
}
// console.log(prettify(libElements,2));
// console.log(prettify(schemaElements,2));
// connect 2 points //elem 1770041522505 pin 0 elem 1770040617091 pin 0

const startPinCoords = getPinCoords(toConnect[0].id, toConnect[0].pin);
const goalPinCoords = getPinCoords(toConnect[1].id, toConnect[1].pin);

const GRID_STEP = 5;
const GRID_EXPAND = 50;
const GRID_LINE = 0;
const PIN_LINE = 1;
const TOLERANCE = 0.5;
const DIRECTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
// remove duplicates 
const mergeAxis = (axis) => {
    if (axis.length < 2) return;
    axis.sort((a, b) => a[0] - b[0]);
    let p = 0;
    while (p < axis.length - 1) {
        const curr = axis[p];
        const next = axis[p + 1];
        const distance = Math.abs(next[0] - curr[0]);
        if (distance < TOLERANCE) {
            if (distance < 0.001) {
                axis.splice(p + 1, 1);
            } else if (curr[1] === GRID_LINE) {
                axis.splice(p, 1);
            } else if (next[1] === GRID_LINE) {
                axis.splice(p + 1, 1);
            } else {
                p++;
            }
        } else {
            p++;
        }
    }
    return axis.map((item) => item[0]);
};
// calc bounds for all elements
let bounds = [Infinity, Infinity, -Infinity, -Infinity];
let elemRects = [];
schemaElements.elements.forEach((e) => {
    const eRect = transformRect(libElements[e.typeId].bounds, e.pos);
    elemRects.push(eRect);
    bounds = expandBounds(bounds, eRect);
});
// add margins to global bound, when snap to grid
bounds = expandRect(bounds, GRID_EXPAND, GRID_EXPAND);
bounds = snapRect(bounds, GRID_STEP, GRID_STEP);

// fill coordinates for grid
const tmp_gridX = [];
const tmp_gridY = [];
const cols = Math.round((bounds[2] - bounds[0]) / GRID_STEP);
const rows = Math.round((bounds[3] - bounds[1]) / GRID_STEP);
for (let x = 0; x <= cols; x++) { tmp_gridX.push([bounds[0] + x * GRID_STEP, GRID_LINE]) }
for (let y = 0; y <= rows; y++) { tmp_gridY.push([bounds[1] + y * GRID_STEP, GRID_LINE]) }

// add pins coords to grid
schemaElements.elements.forEach((elem) =>
    Object.values(libElements[elem.typeId].pins).forEach((pin) => {
        const pinPoint = addPoint(pin, elem.pos);
        tmp_gridX.push([pinPoint[0], PIN_LINE])
        tmp_gridY.push([pinPoint[1], PIN_LINE])

    })
);

// sort "lines" by position, clean up and merge grid
const gridX = mergeAxis(tmp_gridX);
const gridY = mergeAxis(tmp_gridY);
const w = gridX.length;
const h = gridY.length;

// create weights

const weights = new Float32Array(w * h);

// fill element "walls"
const getRectIndexes = (rect) => {
    const startX = gridX.findLastIndex(x => leq(x, rect[0], 0.1));
    const startY = gridY.findLastIndex(y => leq(y, rect[1], 0.1));
    const endX = gridX.findIndex(x => geq(x, rect[2], 0.1));
    const endY = gridY.findIndex(y => geq(y, rect[3], 0.1));
    return [startX, startY, endX, endY];
}
const fillGrid = (rectIndexes, value) => {

    for (let y = rectIndexes[1]; y <= rectIndexes[3]; y++) {
        for (let x = rectIndexes[0]; x <= rectIndexes[2]; x++) {
            weights[y * w + x] = value;
        }
    }
}
elemRects.forEach(rect => {
    // console.log(rect);
    const rectIndexes = getRectIndexes(rect);
    // console.log(rectIndexes);
    fillGrid(rectIndexes, 10000);


})

const toFlat = (gridIndexes) => gridIndexes[1] * w + gridIndexes[0];
const toGrid = (flatIndex) => [flatIndex % w, (flatIndex / w) | 0];
const toCoords = (gridIndexes) => [gridX[gridIndexes[0]], gridY[gridIndexes[1]]]

// get start and goal coords
// const gridIndexToIndex = (point) => { return point[1] * w + point[0] };
// const indexToGridIndex = (index) => { return [index % w, Math.floor(index / w)] };

const startGridIndex = [
    gridX.findIndex(i => floatEqual(i, startPinCoords[0])),
    gridY.findIndex(i => floatEqual(i, startPinCoords[1]))
];
const goalGridIndex = [
    gridX.findIndex(i => floatEqual(i, goalPinCoords[0])),
    gridY.findIndex(i => floatEqual(i, goalPinCoords[1]))
];
const startFlatIndex = toFlat(startGridIndex);
const goalFlatIndex = toFlat(goalGridIndex);
const fieldBounds = [0, 0, w - 1, h - 1];







const doAStar = (startIndex, goalIndex) => {
    /*
    function reconstruct_path(cameFrom, current)
    total_path:= { current }
    while current in cameFrom.Keys:
        current:= cameFrom[current]
    total_path.prepend(current)
    return total_path
    */

    const dist = (flatIndex1, flatIndex2) => {
        const gridIndex1 = toGrid(flatIndex1);
        const gridIndex2 = toGrid(flatIndex2);
        const coords1 = toCoords(gridIndex1);
        const coords2 = toCoords(gridIndex2);

        return pointsDistance(coords1, coords2);


    }
    const getLowestFIndex = () => {
        let idx = 0;
        const openSetLength = openSet.length;
        for (let i = 1; i < openSetLength; i++) {
            if (fScore[openSet[i]] < fScore[openSet[idx]]) {
                idx = i;
            }

        }
        return idx;
    }

    /*
    оптимизированная хуйня
    
    const getNeighbors = (flatIndex) => {
    const r = [];
    const ix = flatIndex % w;
    const iy = (flatIndex / w) | 0;

    for (const [dx, dy] of DIRECTIONS) {
        const nx = ix + dx;
        const ny = iy + dy;

        // Проверка границ без создания массива
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            r.push(ny * w + nx);
        }
    }
    return r;
}
    */
    const getNeighbors = (flatIndex) => {
        const r = [];
        const gridIndexes = toGrid(flatIndex);
        for (const dir of DIRECTIONS) {
            const testPoint = addPoint(gridIndexes, dir);
            if (!ptInRect(fieldBounds, testPoint))
                continue;
            r.push(toFlat(testPoint));
        }
        return r;
    }
    const openSet = [startIndex];
    const cameFrom = new Array(w * h);
    const gScore = new Float32Array(w * h).fill(Infinity);
    gScore[startIndex] = 0;
    const fScore = new Float32Array(w * h).fill(Infinity);
    fScore[startIndex] = 0;

    while (openSet.length) {


        const lowestFIdx = getLowestFIndex();
        const currentFlatIndex = openSet[lowestFIdx];
        openSet.splice(lowestFIdx, 1);
        if (currentFlatIndex === goalIndex) {//return reconstruct_path(cameFrom, current)
            return true;
        }



        const neighbors = getNeighbors(currentFlatIndex);


        for (const neighbor of neighbors) {
            /*const currentFlatIndex = openSet[currentIndex]; // Для удобства
const prevIndex = cameFrom[currentFlatIndex];
let penalty = 0;

if (prevIndex !== undefined) {
    const [px, py] = toGrid(prevIndex);
    const [cx, cy] = toGrid(currentFlatIndex);
    const [nx, ny] = toGrid(neighbor);

    // Считаем векторы движения
    const dx1 = cx - px;
    const dy1 = cy - py;
    const dx2 = nx - cx;
    const dy2 = ny - cy;

    // Если вектор изменился — это поворот
    if (dx1 !== dx2 || dy1 !== dy2) {
        penalty = 50; // Подбери экспериментально (например, 10-100)
    }
}
    */


            // считаем штраф за повороты
            const prevIndex = cameFrom[currentIndex];
            let turnPenalty = 0;

            if (prevIndex !== undefined) {
                const prevPos = toGrid(prevIndex);
                const currPos = toGrid(currentIndex);
                const nextPos = toGrid(neighbor);

                // Если изменилась ось движения — это поворот
                const prevDirX = currPos[0] - prevPos[0];
                const prevDirY = currPos[1] - prevPos[1];
                const nextDirX = nextPos[0] - currPos[0];
                const nextDirY = nextPos[1] - currPos[1];

                if (prevDirX !== nextDirX || prevDirY !== nextDirY) {
                    turnPenalty = 10; // Выбери значение штрафа экспериментально
                }
            }


            // let tentative_gScore = gScore[currentIndex] + dist(currentIndex, neighbor) + weights[neighbor]+ turnPenalty;
            let tentative_gScore = gScore[currentIndex] + dist(currentIndex, neighbor);
            if (tentative_gScore < gScore[neighbor]) {
                cameFrom[neighbor] = currentIndex;
                gScore[neighbor] = tentative_gScore;
                fScore[neighbor] = tentative_gScore + dist(neighbor, goalIndex);

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor)
                }
            }
        }
    }
    return null;
}

doAStar(startFlatIndex, goalFlatIndex);




// ROUTE NOT FOUND



//console.log('gridX',prettify(gridX,0));console.log('gridY',prettify(gridY,0));
//gridY.forEach((v, i) => console.log(`${i}\t${v}`));
/*
if (!gridX.some((x) => floatEqual(x, pinPoint[0], 0.5)))
    gridX.push(pinPoint[0])
if (!gridY.some((y) => floatEqual(y, pinPoint[1], 0.5)))
    gridY.push(pinPoint[1])
*/
//        "pins": { "0": [-10, 0], "1": [10, 0] },







//

// console.log(elem1);console.log(elem2);




// console.log(prettify(gridX, 0));console.log(prettify(gridY, 0));

/*
console.log('startPinCoords',prettify(startPinCoords));
console.log('gridX',prettify(gridX,0));
console.log('gridY',prettify(gridY,0));
console.log('startPoint',prettify(startPoint,0));
console.log(gridX);
*/