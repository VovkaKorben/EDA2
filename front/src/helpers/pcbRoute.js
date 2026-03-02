import { prettify } from './debug.js';
import {
    snapRect, addPoint, ptInRect, pointsDistance, isPointEqual, expand,
    add, getRectWidth, getRectHeight
} from './geo.js';

const DIRECTIONS = [
    [-1, -1], [0, -1], [1, -1],//
    [-1, 0], /*[0, 0],*/[1, 0],//
    [-1, 1], [0, 1], [1, 1],//
];
const toGrid = (flatIndex, w) => [flatIndex % w, (flatIndex / w) | 0];
const toFlat = (gridIndexes, w) => gridIndexes[1] * w + gridIndexes[0];



export const preparePcbAStar = (pcbBounds, pins, wires) => {
    const r = {};

    // add margins to global bound
    r.w = getRectWidth(r.bounds)
    r.h = getRectHeight(r.bounds)



    // create weights
    r.weights = new Float32Array(r.w * r.h);
    // fill objects places 

    return r;
}



export const doPcbAStar = (grid) => {
    const reconstruct_path = (currentFlatIndex) => {
        //
    };

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
