import { prettify } from './debug.js';
import {
     snapRect, addPoint,  ptInRect, pointsDistance,  isPointEqual,expand,
    add
} from './geo.js';
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
    r.bounds = expand(parrotBounds, GRID_EXPAND);
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
        elemRect = add(elemRect, elem.pos);
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
