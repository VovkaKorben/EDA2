import { prettify } from './debug.js';
import { expandRect, snapRect, addPoint, transformRect, ptInRect, pointsDistance, subPoint, isPointEqual } from './geo.js';
const GRID_EXPAND = 20; // in parrots
const DIRECTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const COMPONENT_WEIGHT = 10000;
const WIRE_WEIGHT = 100;

const toGrid = (flatIndex, w) => [flatIndex % w, (flatIndex / w) | 0];
const toFlat = (gridIndexes, w) => gridIndexes[1] * w + gridIndexes[0];

export const parrotsToFlat = (grid, point) => {
    let [x, y] = point;
    x = x - grid.x;
    y = y - grid.y;
    const flatIndex = y * grid.w + x;
    return flatIndex;


}
// convert flat indexes to parrots
export const flatToParrots = (grid, flatIndexes) => {

    // convert flat index to grid indexes
    const parrots = flatIndexes.map((flatIndex) => {
        let coords = toGrid(flatIndex, grid.w);
        coords = addPoint(coords, [grid.x, grid.y]);
        return coords;
    });
    return parrots;
}
// from full-pointed path create short, key-pointed 
export const collapseRoute = (parrots) => {
    if (parrots.length < 2) return parrots;

    const path = [parrots[0]];
    let prevDir = null;

    for (let i = 1; i < parrots.length; i++) {
        const dx = parrots[i][0] - parrots[i - 1][0];
        const dy = parrots[i][1] - parrots[i - 1][1];

        // Пропускаем дубликаты точек (нулевое смещение)
        if (dx === 0 && dy === 0) continue;

        // Направление как вектор из знаков (-1, 0, 1)
        const currentDir = [Math.sign(dx), Math.sign(dy)];

        if (prevDir && !isPointEqual(prevDir, currentDir)) {
            // Если направление изменилось, сохраняем угол
            path.push(parrots[i - 1]);
        }
        prevDir = currentDir;
    }

    path.push(parrots[parrots.length - 1]);
    return path;
};
/*export const collapseRoute = (parrots) => {
    // console.log(prettify(route, 0));
    let path = [];
    if (parrots.length > 1) {


        // simplify path
        let prevDirection;
        path.push(parrots[0]);
        for (let i = 1; i < parrots.length; i++) {

            const dirCoords = subPoint(parrots[i], parrots[i - 1]);
            const direction = DIRECTIONS.findIndex(t => t[0] === dirCoords[0] && t[1] === dirCoords[1]);

            // console.log(`${gridIndexes[i - 1]} -> ${gridIndexes[i]}    C:${dirCoords} DI:${direction}`);

            if (i > 1) {
                if (prevDirection !== direction) {
                    path.push(parrots[i - 1]);
                    // console.log(`***point`)
                }
            }
            prevDirection = direction;
        }
        path.push(parrots[parrots.length - 1]);

    }
    return path;
}*/
// create full path from key-pointed
export const expandPath = (parrots) => {
    // console.log(prettify(path,0));
    if (parrots.length === 0) return [];
    const r = [];
    let prev;
    parrots.forEach((pt, i) => {
        if (i === 0) {
            r.push(pt);
        } else {
            const dx = Math.sign(pt[0] - prev[0]);
            const dy = Math.sign(pt[1] - prev[1]);
            do {
                prev = addPoint(prev, [dx, dy]);
                r.push(prev);
            }
            while (!isPointEqual(pt, prev));
        }
        prev = pt;
    })
    // console.log(prettify(r,0));
    return r;
}
// search node in path and split path into two parts
export const splitPath = (path, node) => {
    const nodeIndex = path.findIndex(n => isPointEqual(n, node));
    const path1 = path.slice(0, nodeIndex + 1);
    const path2 = path.slice(nodeIndex);
    const path2rev = path2.reverse();
    return [path1, path2rev]
}
// from paths array connect closest points
export const mergePaths = (paths) => {

    if (paths.length === 0) return [];
    let merged = [...paths.pop()];
    while (paths.length > 0) {

        const mergedStart = merged[0];
        const mergedEnd = merged.at(-1);

        for (let i = 0; i < paths.length; i++) {

            const testPath = paths[i];
            const testStart = testPath[0];
            const testEnd = testPath.at(-1);
            let found = false;
            if (isPointEqual(mergedEnd, testStart)) {
                merged.push(...testPath);
                found = true;
            } else if (isPointEqual(mergedEnd, testEnd)) {
                merged.push(...testPath.reverse());
                found = true;
            } else if (isPointEqual(mergedStart, testEnd)) {
                merged.unshift(...testPath);
                found = true;
            } else if (isPointEqual(mergedStart, testStart)) {
                merged.unshift(...testPath.reverse());
                found = true;
            }

            if (found) {
                paths.splice(i, 1);
                break;
            }
        }
    }
    return merged;
}

export const prepareAStarGrid = (parrotBounds, libElements, schemaElements) => {
    const r = {};

    // add margins to global bound
    r.bounds = expandRect(parrotBounds, GRID_EXPAND, GRID_EXPAND);
    r.x = r.bounds[0];
    r.y = r.bounds[1];
    r.w = r.bounds[2] - r.bounds[0] + 1;
    r.h = r.bounds[3] - r.bounds[1] + 1;

    r.zeroBounds = [0, 0, r.w - 1, r.h - 1];


    // create weights
    r.weights = new Float32Array(r.w * r.h);
    // fill objects places 
    const fillGrid = (rect, value) => {
        // Вычисляем локальные индексы начала и конца в массиве весов
        const sx = rect[0] - r.x;
        const sy = rect[1] - r.y;
        const ex = rect[2] - r.x;
        const ey = rect[3] - r.y;

        // Итерируемся строго от начального индекса до конечного (включительно)
        for (let y = sy; y <= ey; y++) {
            // Защита от выхода за границы массива (на всякий случай)
            if (y < 0 || y >= r.h) continue;

            const rowOffset = y * r.w;
            for (let x = sx; x <= ex; x++) {
                if (x < 0 || x >= r.w) continue;

                r.weights[rowOffset + x] = value;
            }
        }
    }
    // adding weights for ELEMENTS
    Object.values(schemaElements.elements).forEach((elem) => {
        let elemRect = libElements[elem.typeId].bounds[elem.rotate];
        elemRect = transformRect(elemRect, elem.pos);
        elemRect = snapRect(elemRect);
        fillGrid(elemRect, COMPONENT_WEIGHT);
    })

    // adding weights for WIRES
    Object.values(schemaElements.wires).forEach((wire) => {
        const expandedPath = expandPath(wire.path);
        for (let pt of expandedPath) {
            if (ptInRect(r.bounds, pt)) {
                const flatIndex = parrotsToFlat(r, pt);
                r.weights[flatIndex] = WIRE_WEIGHT;
            }
        }
    })
    return r;
}



export const doAStar = (grid) => {




    const reconstruct_path = (current) => {
        const total_path = [current];
        while (cameFrom[current]) {
            current = cameFrom[current];
            total_path.push(current)
        }
        const reversed = total_path.reverse();
        return reversed;
    }

    const dist = (flatIndex1, flatIndex2) => {
        const gridIndex1 = toGrid(flatIndex1, grid.w);
        const gridIndex2 = toGrid(flatIndex2, grid.w);
        const d = pointsDistance(gridIndex1, gridIndex2);
        return d;


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

    const getNeighbors = (flatIndex) => {
        const r = [];
        const gridIndexes = toGrid(flatIndex, grid.w);
        for (const dir of DIRECTIONS) {
            const testPoint = addPoint(gridIndexes, dir);
            if (!ptInRect(grid.zeroBounds, testPoint))
                continue;
            r.push(toFlat(testPoint, grid.w));
        }
        return r;
    }
    const openSet = [grid.startIdx];
    const cameFrom = new Array(grid.w * grid.h).fill(null);
    const gScore = new Float32Array(grid.w * grid.h).fill(Infinity);
    gScore[grid.startIdx] = 0;
    const fScore = new Float32Array(grid.w * grid.h).fill(Infinity);
    fScore[grid.startIdx] = 0;

    while (openSet.length) {


        const lowestFIdx = getLowestFIndex();
        const currentFlatIndex = openSet[lowestFIdx];
        openSet.splice(lowestFIdx, 1);
        if (currentFlatIndex === grid.goalIdx) {
            return reconstruct_path(currentFlatIndex);
        }


        const prevIndex = cameFrom[currentFlatIndex];
        const neighbors = getNeighbors(currentFlatIndex);


        for (const neighbor of neighbors) {
            // считаем штраф за повороты
            let turnPenalty = 0;
            if (prevIndex !== null) {
                const prevPos = toGrid(prevIndex, grid.w);
                const currPos = toGrid(currentFlatIndex, grid.w);
                const nextPos = toGrid(neighbor, grid.w);

                // Если изменилась ось движения — это поворот
                const prevDirX = currPos[0] - prevPos[0];
                const prevDirY = currPos[1] - prevPos[1];
                const nextDirX = nextPos[0] - currPos[0];
                const nextDirY = nextPos[1] - currPos[1];

                if (prevDirX !== nextDirX || prevDirY !== nextDirY) {
                    turnPenalty = 10; // Выбери значение штрафа экспериментально
                }
            }

            //            let tentative_gScore = gScore[currentFlatIndex] + dist(currentFlatIndex, neighbor) + grid.weights[neighbor] + turnPenalty;
            let tentative_gScore = gScore[currentFlatIndex] + grid.weights[neighbor] + turnPenalty + 1; // distance is always 1 parrot
            if (tentative_gScore < gScore[neighbor]) {
                cameFrom[neighbor] = currentFlatIndex;
                gScore[neighbor] = tentative_gScore;
                fScore[neighbor] = tentative_gScore + dist(neighbor, grid.goalIdx);

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor)
                }
            }
        }
    }
    return null;
}


/*

const le = { "1": { "typeId": 1, "abbr": "R", "descr": "A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.", "name": "resistor", "turtle": [[{ "code": "R", "params": [-5, -2, 10, 4] }, { "code": "L", "params": [-10, 0, -5, 0] }, { "code": "L", "params": [5, 0, 10, 0] }], [{ "code": "R", "params": [2, -5, -4, 10] }, { "code": "L", "params": [0, -10, 0, -5] }, { "code": "L", "params": [0, 5, 0, 10] }], [{ "code": "R", "params": [5, 2, -10, -4] }, { "code": "L", "params": [10, 0, 5, 0] }, { "code": "L", "params": [-5, 0, -10, 0] }], [{ "code": "R", "params": [-2, 5, 4, -10] }, { "code": "L", "params": [0, 10, 0, 5] }, { "code": "L", "params": [0, -5, 0, -10] }]], "pins": [{ "0": [-4, 0], "1": [4, 0] }, { "0": [0, -4], "1": [0, 4] }, { "0": [4, 0], "1": [-4, 0] }, { "0": [0, 4], "1": [0, -4] }], "bounds": [[-4, -0.8, 4, 0.8], [-0.8, -4, 0.8, 4], [-4, -0.8, 4, 0.8], [-0.8, -4, 0.8, 4]] }, "2": { "typeId": 2, "abbr": "C", "descr": "A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material", "name": "capacitor", "turtle": [[{ "code": "L", "params": [-5, 0, -1, 0] }, { "code": "L", "params": [1, -4, 1, 4] }, { "code": "L", "params": [-1, -4, -1, 4] }, { "code": "L", "params": [1, 0, 5, 0] }], [{ "code": "L", "params": [0, -5, 0, -1] }, { "code": "L", "params": [4, 1, -4, 1] }, { "code": "L", "params": [4, -1, -4, -1] }, { "code": "L", "params": [0, 1, 0, 5] }], [{ "code": "L", "params": [5, 0, 1, 0] }, { "code": "L", "params": [-1, 4, -1, -4] }, { "code": "L", "params": [1, 4, 1, -4] }, { "code": "L", "params": [-1, 0, -5, 0] }], [{ "code": "L", "params": [0, 5, 0, 1] }, { "code": "L", "params": [-4, -1, 4, -1] }, { "code": "L", "params": [-4, 1, 4, 1] }, { "code": "L", "params": [0, -1, 0, -5] }]], "pins": [{ "PIN1": [2, 0], "PIN2": [-2, 0] }, { "PIN1": [0, 2], "PIN2": [0, -2] }, { "PIN1": [-2, 0], "PIN2": [2, 0] }, { "PIN1": [0, -2], "PIN2": [0, 2] }], "bounds": [[-2, -1.6, 2, 1.6], [-1.6, -2, 1.6, 2], [-2, -1.6, 2, 1.6], [-1.6, -2, 1.6, 2]] }, "3": { "typeId": 3, "abbr": "VT", "descr": "A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.", "name": "pnp transistor", "turtle": [[{ "code": "P", "params": [-1.55, 1.357, 0.17, 1.536, -0.66, 2.845, 2] }, { "code": "P", "params": [-1.55, 1.357, 2.5, 3.927, 2.5, 7.5, 0] }, { "code": "P", "params": [-1.55, -1.357, 2.5, -3.928, 2.5, -7.5, 0] }, { "code": "L", "params": [-7.5, 0, -1.55, 0] }, { "code": "L", "params": [-1.55, 3.103, -1.55, -3.103] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [-1.357, -1.55, -1.536, 0.17, -2.845, -0.66, 2] }, { "code": "P", "params": [-1.357, -1.55, -3.927, 2.5, -7.5, 2.5, 0] }, { "code": "P", "params": [1.357, -1.55, 3.928, 2.5, 7.5, 2.5, 0] }, { "code": "L", "params": [0, -7.5, 0, -1.55] }, { "code": "L", "params": [-3.103, -1.55, 3.103, -1.55] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [1.55, -1.357, -0.17, -1.536, 0.66, -2.845, 2] }, { "code": "P", "params": [1.55, -1.357, -2.5, -3.927, -2.5, -7.5, 0] }, { "code": "P", "params": [1.55, 1.357, -2.5, 3.928, -2.5, 7.5, 0] }, { "code": "L", "params": [7.5, 0, 1.55, 0] }, { "code": "L", "params": [1.55, -3.103, 1.55, 3.103] }, { "code": "C", "params": [0, 0, 4.66] }], [{ "code": "P", "params": [1.357, 1.55, 1.536, -0.17, 2.845, 0.66, 2] }, { "code": "P", "params": [1.357, 1.55, 3.927, -2.5, 7.5, -2.5, 0] }, { "code": "P", "params": [-1.357, 1.55, -3.928, -2.5, -7.5, -2.5, 0] }, { "code": "L", "params": [0, 7.5, 0, 1.55] }, { "code": "L", "params": [3.103, 1.55, -3.103, 1.55] }, { "code": "C", "params": [0, 0, 4.66] }]], "pins": [{ "PIN1": [1, -3], "PIN2": [-3, 0], "PIN3": [1, 3] }, { "PIN1": [3, 1], "PIN2": [0, -3], "PIN3": [-3, 1] }, { "PIN1": [-1, 3], "PIN2": [3, 0], "PIN3": [-1, -3] }, { "PIN1": [-3, -1], "PIN2": [0, 3], "PIN3": [3, -1] }], "bounds": [[-3, -3, 1.864, 3], [-3, -3, 3, 1.864], [-1.864, -3, 3, 3], [-3, -1.864, 3, 3]] }, "4": { "typeId": 4, "abbr": "VD", "descr": "A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.", "name": "diode", "turtle": [[{ "code": "L", "params": [2.5, 2.5, 2.5, -2.5] }, { "code": "P", "params": [-2.5, -2.5, 2.5, 0, -2.5, 2.5, 1] }, { "code": "L", "params": [-5, 0, 5, 0] }], [{ "code": "L", "params": [-2.5, 2.5, 2.5, 2.5] }, { "code": "P", "params": [2.5, -2.5, 0, 2.5, -2.5, -2.5, 1] }, { "code": "L", "params": [0, -5, 0, 5] }], [{ "code": "L", "params": [-2.5, -2.5, -2.5, 2.5] }, { "code": "P", "params": [2.5, 2.5, -2.5, 0, 2.5, -2.5, 1] }, { "code": "L", "params": [5, 0, -5, 0] }], [{ "code": "L", "params": [2.5, -2.5, -2.5, -2.5] }, { "code": "P", "params": [-2.5, 2.5, 0, -2.5, 2.5, 2.5, 1] }, { "code": "L", "params": [0, 5, 0, -5] }]], "pins": [{ "PIN1": [2, 0], "PIN2": [-2, 0] }, { "PIN1": [0, 2], "PIN2": [0, -2] }, { "PIN1": [-2, 0], "PIN2": [2, 0] }, { "PIN1": [0, -2], "PIN2": [0, 2] }], "bounds": [[-2, -1, 2, 1], [-1, -2, 1, 2], [-2, -1, 2, 1], [-1, -2, 1, 2]] } }
const se = { "elements": { "1770957831203": { "id": 1770957831203, "typeId": 3, "pos": [52, 45], "rotate": 0, "typeIndex": 1 }, "1770957832868": { "id": 1770957832868, "typeId": 3, "pos": [64, 53], "rotate": 0, "typeIndex": 2 } }, "wires": [] }
const pb = [41, 36, 77, 88,];
const gr = prepareAStarGrid(pb, le, se);
console.log(gr);
const startPt = [53, 48];
const goalPt = [65, 56];
gr.startIdx = coordsToFlat(gr, startPt);
gr.goalIdx = coordsToFlat(gr, goalPt);
const indexRoute = doAStar(gr);
console.log(indexRoute);
const coordsRoute = collapseRoute(gr, indexRoute);
console.log(coordsRoute);









*/