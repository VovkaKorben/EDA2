import { dpr } from './utils.js';

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


export const drawElement = (elem, ctx) => {
    ctx.save();
    try {
        // ctx.translate(Math.round(elem.pos.x), Math.round(elem.pos.y));
        // Округляем до целого физического пикселя, затем возвращаем в логику
        ctx.translate(Math.round(elem.pos.x * dpr) / dpr, Math.round(elem.pos.y * dpr) / dpr);
        ctx.lineWidth = 1 / dpr;

        for (const prim of elem.turtle) {

            ctx.beginPath();
            switch (prim.code) {
                case 'R': {// rectangle
                    let [x, y, w, h] = prim.params;
                    x = Math.round(x * elem.zoom) + 0.5;
                    y = Math.round(y * elem.zoom) + 0.5;
                    w = Math.round(w * elem.zoom);
                    h = Math.round(h * elem.zoom);
                    ctx.rect(x, y, w, h);
                    ctx.stroke();
                } break;
                case 'L': {// line
                    let [x, y, x2, y2] = prim.params;
                    x = Math.round(x * elem.zoom) + 0.5;
                    y = Math.round(y * elem.zoom) + 0.5;
                    x2 = Math.round(x2 * elem.zoom) + 0.5;
                    y2 = Math.round(y2 * elem.zoom) + 0.5;

                    ctx.moveTo(x, y);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                } break;
                case 'C': {// circle
                    let [x, y, r] = prim.params;
                    x = Math.round(x * elem.zoom) + 0.5;
                    y = Math.round(y * elem.zoom) + 0.5;
                    r = Math.round(r * elem.zoom);

                    ctx.arc(x, y, r, 0, 2 * Math.PI);
                    ctx.stroke();
                } break;
                case 'P': {// polyline
                    const paramsLen = prim.params.length;
                    for (let p = 0; (p + 1) < paramsLen; p += 2) {
                        let [x, y] = prim.params.slice(p, p + 2);
                        x = Math.round(x * elem.zoom) + 0.5;
                        y = Math.round(y * elem.zoom) + 0.5;
                        if (p === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }

                    }

                    // check if params count is odd, get last
                    let style = 0;
                    if (paramsLen % 2) {
                        style = prim.params[paramsLen - 1];
                    }
                    switch (style) {
                        case 0: ctx.stroke(); break; // 0 polyline
                        case 1: ctx.closePath(); ctx.stroke(); break;// 1 polygon
                        case 2: ctx.closePath(); ctx.fill(); break;  // 2 filled polygon
                    }

                } break;
            }
        }
    } finally { ctx.restore(); }

}