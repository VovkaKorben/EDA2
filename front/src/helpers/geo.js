
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

export const getWH = (arr) => {
    // ... логика ...
    return [arr[2] - arr[0], arr[3] - arr[1]]; // Возвращаем один массив
};

export const clamp = (v, min, max) => {
    if (v < min)
        return min;
    if (v > max)
        return max;
    return v;


}

export const pointsDistance = (pt1, pt2) => {
    return Math.SQRT2(
        Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2)
    )

}
export const ptInRect = (rect, point) => {
    return point[0] >= rect[0] &&
        point[0] <= rect[2] &&
        point[1] >= rect[1] &&
        point[1] <= rect[3];

}
export const floatEqual = (f1, f2, e = Number.EPSILON) => {
    return Math.abs(f1 - f2) < e;
}
export const leq = (a, b, e = Number.EPSILON) => {
    return (a < b) || (Math.abs(a - b) < e);
}
export const geq = (a, b, e = Number.EPSILON) => {
    return (a > b) || (Math.abs(a - b) < e);
}

export const addPoint = (point, delta) => {
    return [point[0] + delta[0], point[1] + delta[1]]
}
export const multiplyPoint = (point, m) => {
    return [point[0] * m, point[1] * m]
}
export const transformRect = (rect, delta) => {
    return [rect[0] + delta[0], rect[1] + delta[1], rect[2] + delta[0], rect[3] + delta[1]]
}

export const expandRect = (rect, x, y) => {
    return [rect[0] - x, rect[1] - y, rect[2] + x, rect[3] + y]
}

export const snapRect = (rect, snapX, snapY) => {
    return [
        Math.floor(rect[0] / snapX) * snapX,
        Math.floor(rect[1] / snapX) * snapY,
        Math.ceil(rect[2] / snapX) * snapX,
        Math.ceil(rect[3] / snapX) * snapY,

    ]
}