
import { addPoint, multiplyPoint } from './geo.js';


export const dpr = (globalThis.window !== undefined) ? (window.devicePixelRatio || 1) : null;
console.log(dpr);
export const GRID_SIZE = 2.5;

export const adjustCtx = (v) => Math.round(v) + 0.5;
export const adjustPoint = (pt) => [Math.round(pt[0]) + 0.5, Math.round(pt[1]) + 0.5];

export const drawWire = (ctx, path, width, color, parrotsToScreen) => {
    ctx.fillStyle = color;

    ctx.lineWidth = width / dpr;
    ctx.strokeStyle = color;
    ctx.beginPath();
    path.forEach((pt, i) => {
        let screenPos = parrotsToScreen(pt);
        screenPos = adjustPoint(screenPos);
        if (i === 0) {
            ctx.moveTo(...screenPos);
        } else {
            ctx.lineTo(...screenPos);
        }

    });
    ctx.stroke();
}

/**
 * Отрисовка сетки весов A* для отладки
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Object} grid - объект из prepareAStarGrid
 * @param {Function} parrotsToScreen - твоя функция (px, py) => [sx, sy]
 */
export const drawGridDebug = (ctx, grid, parrotsToScreen) => {
    if (!grid || !grid.weights) return;

    const rctSize = 5;
    ctx.save();


    // 2. Рисуем "веса" (препятствия)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.25)'; // Красные квадраты для стен

    for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) {
            const weight = grid.weights[y * grid.w + x];

            if (weight > 0) {
                // Переводим координаты попугая в экранные пиксели
                const [sx, sy] = parrotsToScreen([grid.x + x, grid.y + y]);

                // Размер одного "попугая" на экране — это и есть наш interval
                // Для дебага можно просто взять небольшой фикс, чтобы не искать интервал
                ctx.fillRect(sx - rctSize / 2, sy - rctSize / 2, rctSize, rctSize);
            }
        }
    }

    ctx.restore();
};

export const drawElement = (ctx, elem) => {
    ctx.save();
    try {
        // ctx.translate(Math.round(elem.pos.x), Math.round(elem.pos.y));
        // Округляем до целого физического пикселя, затем возвращаем в логику
        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = elem.width / dpr;
        ctx.strokeStyle = elem.color;
        ctx.fillStyle = elem.color;

        for (const prim of elem.turtle[elem.rotate]) {

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
                        case 2: ctx.closePath(); ctx.stroke(); ctx.fill(); break;  // 2 filled polygon
                    }

                } break;
                case 'A': { // Arc (centerX,centerY,radius, start degree,end degree,mode)
                    let [x, y, r, a1, a2, style] = prim.params;
                    x = Math.round(x * elem.zoom) + 0.5;
                    y = Math.round(y * elem.zoom) + 0.5;
                    r = Math.round(r * elem.zoom);

                    ctx.arc(x, y, r, a1, a2);
                    switch (style) {
                        case 0: ctx.stroke(); break; // 0 arc
                        case 1: ctx.closePath(); ctx.stroke(); break;// 1 closed arc
                        case 2: ctx.closePath(); ctx.fill(); break;  // 2 filled arc
                    }
                } break;
            }
        }
    } finally { ctx.restore(); }

}
export const drawPins = (elem, ctx) => {
    ctx.save();
    try {

        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = 1 / dpr;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const [pinIndex, pinCoords] of Object.entries(elem.pins[elem.rotate])) {
            // let pt = addPoint(pinCoords, elem.pos);
            let pt = multiplyPoint(pinCoords, elem.zoom);
            pt = addPoint(pt, [7, -7]);
            ctx.fillText(pinIndex, pt[0], pt[1]);
        }

    }

    finally { ctx.restore(); }

}
export const drawName = (elem, ctx) => {
    ctx.save();
    try {

        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = 1 / dpr;
        ctx.font = '15px sans-serif';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';


        // const pt = addPoint(pt, [7, -7]);
        ctx.fillText(`${elem.abbr}${elem.typeIndex}`, 0, -40);


    }

    finally { ctx.restore(); }

}