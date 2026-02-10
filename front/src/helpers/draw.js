// import { dpr } from './utils.js';
import { addPoint, multiplyPoint } from './geo.js';


export const dpr = window.devicePixelRatio || 1;
export const adjustPoint = (pt) => [Math.round(pt[0]) + 0.5, Math.round(pt[1]) + 0.5];

export const drawGridDebug = (ctx, grid, GlobalToScreen) => {
    ctx.save();


    // 2. Рисуем "веса" (препятствия) как точки на пересечениях
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) {
            if (grid.weights[y * grid.w + x] > 0) {
                const [sx, sy] = GlobalToScreen([grid.gridX[x], grid.gridY[y]]);
                // Квадратик 5x5, центрированный ровно на перекрестии линий
                ctx.fillRect(sx - 4, sy - 4, 9, 9);
            }
        }
    }

    // 1. Рисуем линии сетки
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)'; // Очень бледные линии
    ctx.lineWidth = 0.5;

    // Вертикальные линии
    grid.gridX.forEach(x => {
        const [screenX] = GlobalToScreen([x, 0]);
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, ctx.canvas.height);
        ctx.stroke();
    });

    // Горизонтальные линии
    grid.gridY.forEach(y => {
        const [, screenY] = GlobalToScreen([0, y]);
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(ctx.canvas.width, screenY);
        ctx.stroke();
    });

    // 2. Рисуем "веса" (препятствия)
    // ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; // Полупрозрачные красные квадраты

    ctx.restore();
};

export const drawElement = (elem, ctx) => {
    ctx.save();
    try {
        // ctx.translate(Math.round(elem.pos.x), Math.round(elem.pos.y));
        // Округляем до целого физического пикселя, затем возвращаем в логику
        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = 1 / dpr;
        ctx.strokeStyle = elem.drawColor;
        ctx.fillStyle = elem.drawColor;

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
                        case 2: ctx.closePath(); ctx.fill(); break;  // 2 filled polygon
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