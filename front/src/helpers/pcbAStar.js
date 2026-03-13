import { prettify_v2 } from './debug.js';
import {
    addPoint, ptInRect, pointsDistanceSimple, pointsDistance, isPointEqual
} from './geo.js';
// import fs from 'fs';
import { ErrorCodes } from './utils.js';

// 0 - direction, 1/2 - neighbors
const DIR_DIAG = [
    [[-1, -1], [0, -1], [-1, 0]],
    [[-1, 1], [0, 1], [-1, 0]],
    [[1, -1], [0, -1], [1, 0]],
    [[1, 1], [0, 1], [1, 0]]

]
const DIR_STRAIGHT = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const toGrid = (flatIndex, w) => [flatIndex % w, (flatIndex / w) | 0]
const toFlat = (gridCoord, w) => gridCoord[1] * w + gridCoord[0]
const sortNet = (net) => {
    const sorted = []
    const remains = [...net]

    let firstPoint = remains.pop()
    sorted.push(firstPoint)

    while (remains.length) {
        let nearestIndex = 0
        let dist = Infinity
        for (let i = remains.length - 1; i >= 0; i--) {

            const d = pointsDistanceSimple(firstPoint, remains[i])
            if (d < dist) {
                dist = d
                nearestIndex = i
            }


        }
        sorted.push(remains.splice(nearestIndex, 1)[0])
    }
    return sorted;
}
const sortNets = (nets) => {
    const sortedNets = {}

    nets.forEach((net, netIndex) => {
        const sortedNet = sortNet(net)
        sortedNets[netIndex + 1] = sortedNet
    })
    return sortedNets

}

const simplifyPath = (routeA) => {
    const route = [...routeA]
    if (route.length <= 2) return route;

    const vertices = [route[0]];

    for (let i = 1; i < route.length - 1; i++) {
        const prev = route[i - 1];
        const curr = route[i];
        const next = route[i + 1];

        // Вычисляем векторы направления
        const dx1 = curr[0] - prev[0];
        const dy1 = curr[1] - prev[1];
        const dx2 = next[0] - curr[0];
        const dy2 = next[1] - curr[1];

        // Если направление изменилось (dx или dy не совпадают) — это угол
        if (dx1 !== dx2 || dy1 !== dy2) {
            vertices.push(curr);
        }
    }

    vertices.push(route[route.length - 1]);
    return vertices;
};
const octileDistance = (pt1, pt2) => {
    const dx = Math.abs(pt1[0] - pt2[0]);
    const dy = Math.abs(pt1[1] - pt2[1]);
    const F = Math.sqrt(2) - 1;
    return (dx < dy) ? F * dx + dy : F * dy + dx;
}
export const preparePcbAStar = (bounds, nets, allPins) => {
    const grid = {};

    // add margins to global bound
    grid.w = bounds[0]
    grid.h = bounds[1]
    grid.bounds = [0, 0, bounds[0] - 1, bounds[1] - 1]
    grid.sortedNets = nets

    // create weights
    grid.pcb = new Uint32Array(grid.w * grid.h).fill(0);

    // store all nets already in copper
    grid.nets = {}
    grid.draw = {}
    // fill initial pins
    for (const [netIndex, net] of Object.entries(nets)) {
        grid.nets[netIndex] = [net[0]]

        // set all pins a taken
        net.forEach(pinPos => {
            const flatIndex = toFlat(pinPos, grid.w);
            grid.pcb[flatIndex] = netIndex;
        });

    }


    // 2. Теперь даем "имена" всем остальным пинам
    // Начнем нумерацию с (количество сетей + 1)
    let orphanId = Object.keys(nets).length + 1;

    allPins.forEach(pinPos => {
        const flatIndex = toFlat(pinPos, grid.w);
        // Если в этой клетке всё еще 0, значит пин не принадлежит ни одной сети
        if (grid.pcb[flatIndex] === 0) {
            grid.pcb[flatIndex] = orphanId++;
        }
    });

    return grid;
}

export const doPcbAStar = (grid, start, netIndex) => {

    const reconstruct_path = (currentFlatIndex) => {
        const totalPath = [];
        let curr = currentFlatIndex;
        while (curr !== null) {
            totalPath.push(toGrid(curr, grid.w));
            curr = cameFrom[curr];
        }
        return totalPath.reverse();
    };
    const getLowestFIndex = () => {
        let idx = 0
        const openSetLength = openSet.length
        for (let i = 1; i < openSetLength; i++) {
            if (fScore[openSet[i]] < fScore[openSet[idx]]) {
                idx = i
            }

        }
        return idx
    }
    const getNeighbors = (flatIndex) => {
        const neighbors = []
        const startPoint = toGrid(flatIndex, grid.w)
        // check diagonal directions
        for (const dir of DIR_DIAG) {
            const testPoint = addPoint(startPoint, dir[0])
            if (!ptInRect(grid.bounds, testPoint)) continue

            const testFlat = toFlat(testPoint, grid.w)
            if (grid.pcb[testFlat] !== netIndex && grid.pcb[testFlat] !== 0) continue

            let testPointDiag = addPoint(startPoint, dir[1])
            let testFlatDiag = toFlat(testPointDiag, grid.w)
            if (grid.pcb[testFlatDiag] !== netIndex && grid.pcb[testFlatDiag] !== 0) continue

            testPointDiag = addPoint(startPoint, dir[2])
            testFlatDiag = toFlat(testPointDiag, grid.w)
            if (grid.pcb[testFlatDiag] !== netIndex && grid.pcb[testFlatDiag] !== 0) continue

            neighbors.push(toFlat(testPoint, grid.w));
        }
        // check straight directions
        for (const dir of DIR_STRAIGHT) {
            const testPoint = addPoint(startPoint, dir)
            if (!ptInRect(grid.bounds, testPoint)) continue

            // check point is free
            const testFlat = toFlat(testPoint, grid.w)
            if (grid.pcb[testFlat] !== netIndex && grid.pcb[testFlat] !== 0) continue

            neighbors.push(toFlat(testPoint, grid.w));
        }


        return neighbors;
    }
    const getNetMinDistance = (coords) => {
        let dist = Infinity;
        for (const pt of grid.nets[netIndex]) {
            const tmpDist = octileDistance(coords, pt)
            dist = Math.min(dist, tmpDist)
        }
        return dist;
    }


    const startFlat = toFlat(start, grid.w)
    const openSet = [startFlat];
    const cameFrom = new Array(grid.w * grid.h).fill(null);
    const gScore = new Float32Array(grid.w * grid.h).fill(Infinity);
    gScore[startFlat] = 0;
    const fScore = new Float32Array(grid.w * grid.h).fill(Infinity);
    fScore[startFlat] = getNetMinDistance(start);

    while (openSet.length) {


        const lowestFIdx = getLowestFIndex();
        const currentFlatIndex = openSet[lowestFIdx];
        openSet.splice(lowestFIdx, 1);


        const currentCoord = toGrid(currentFlatIndex, grid.w)
        // check for goal
        const goalIndex = grid.nets[netIndex].findIndex(n => isPointEqual(n, currentCoord))
        if (goalIndex !== -1) {
            return reconstruct_path(currentFlatIndex)
        }



        const neighbors = getNeighbors(currentFlatIndex);


        for (const neighbor of neighbors) {
            const neighborCoord = toGrid(neighbor, grid.w);

            // Внутри цикла соседей:
            const isDiagonal = (neighborCoord[0] !== currentCoord[0] && neighborCoord[1] !== currentCoord[1]);
            const stepDistance = isDiagonal ? 1.414 : 1.0;
            const weight = grid.pcb[neighbor] === netIndex ? 0 : stepDistance;

            let turnPenalty = 0;
            const parentFlat = cameFrom[currentFlatIndex];
            if (parentFlat !== null) {
                const prevCoord = toGrid(parentFlat, grid.w);
                const prevDx = currentCoord[0] - prevCoord[0];
                const prevDy = currentCoord[1] - prevCoord[1];
                const currDx = neighborCoord[0] - currentCoord[0];
                const currDy = neighborCoord[1] - currentCoord[1];

                if (prevDx !== currDx || prevDy !== currDy) {
                    // Вычисляем косинус угла между векторами для определения крутизны поворота
                    // Числитель: скалярное произведение. Знаменатель: произведение длин.
                    const dot = prevDx * currDx + prevDy * currDy;
                    const lenPrev = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
                    const lenCurr = Math.sqrt(currDx * currDx + currDy * currDy);
                    const cosTheta = dot / (lenPrev * lenCurr);

                    if (cosTheta > 0.5) {
                        // Угол 45 градусов (cos 45 ≈ 0.7)
                        turnPenalty = 0.1;
                    } else if (cosTheta > -0.1 && cosTheta < 0.1) {
                        // Угол 90 градусов (cos 90 = 0)
                        turnPenalty = 3.0;
                    } else {
                        // Угол 135 градусов (cos 135 ≈ -0.7)
                        turnPenalty = 15.0;
                    }
                }
            }

            let tentative_gScore = gScore[currentFlatIndex] + weight + turnPenalty;

            if (tentative_gScore < gScore[neighbor]) {
                cameFrom[neighbor] = currentFlatIndex;
                gScore[neighbor] = tentative_gScore;

                // Tie-breaker: чуть-чуть увеличиваем эвристику (на 0.1%), 
                // чтобы алгоритм активнее выбирал путь к цели, а не топтался на месте
                const h = getNetMinDistance(neighborCoord);
                fScore[neighbor] = tentative_gScore + h * 1.001;

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return null;
}


export const routePcb = (pcbSize, nets,allPins) => {
    const resultErrors = []
    let data = null
    try {

        // optimize nets by distance
        const sortedNets = sortNets(nets)

        // init A*
        const grid = preparePcbAStar(pcbSize, sortedNets,allPins)
        /*
        ставим первый пин в сетку
        и к меди тянем от 2(сейчас это только 1 пин)
        полученную медь записываем в отдельный массив
        дальше тянем от 3 уже к этой меди и тд
        */
        let stopped = false
        for (let netIndex = 1; netIndex <= Object.keys(sortedNets).length; netIndex++) {

            for (let pinIndex = 1; pinIndex < sortedNets[netIndex].length; pinIndex++) {

                const pinPos = sortedNets[netIndex][pinIndex]
                const route = doPcbAStar(grid, pinPos, netIndex)
                if (!route) {
                    stopped = true
                    break
                }


                const simplified = simplifyPath(route)
                if (!Object.hasOwn(grid.draw, netIndex)) {
                    grid.draw[netIndex] = []
                }

                grid.draw[netIndex].push(simplified)

                // trash last point, to avoid duplicates
                route.pop()
                // put route to copper and grid
                route.forEach(pt => {
                    const flatIndex = toFlat(pt, grid.w);
                    grid.pcb[flatIndex] = netIndex;
                    grid.nets[netIndex].push(pt);
                });

            }
            if (stopped) break
        }


        if (stopped) {
            resultErrors.push({ code: ErrorCodes.ERROR, message: 'routePcb: route failed' })
        }
        data = grid.draw

    } catch (e) {

        resultErrors.push({ code: ErrorCodes.ERROR, message: e.message })
        resultErrors.push({ code: ErrorCodes.ERROR, message: e.stack })
    }
    return {
        errors: resultErrors,
        data: data

    }

}
/*

const routeTest = () => {
    const nets = [[[2, 5], [10, 2], [9, 2]], [[11, 2], [11, 15], [1, 5], [11, 9]], [[10, 15], [9, 9], [0, 5], [10, 9]]]
    const pcbSize = [13, 30]
    routePcb(pcbSize, nets)
}
routeTest()



    //const gridData = JSON.stringify(grid);
        // const gridData = prettify_v2(grid, 2);
        //fs.writeFileSync('grid.json', gridData);

*/