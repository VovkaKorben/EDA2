
import { addPoint, multiply, adjustPoint, roundPoint, adjustCtx } from './geo.js';

// import { Point, Rect } from './rect.js';
export const dpr = (globalThis.window !== undefined) ? (window.devicePixelRatio || 1) : null;
// console.log(dpr);
export const GRID_SIZE = 2.5;



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

export const drawTurtle = (ctx, turtle, zoom) => {

    switch (turtle.code) {

        case 'A': {// circle
            ctx.beginPath();
            let apt = multiply(turtle.center, zoom);
            apt = roundPoint(apt);

            ctx.arc(...apt, Math.round(turtle.radius * zoom), turtle.start, turtle.end);
            ctx.stroke();
            break;
        }


        case 'P': {// polyline
            ctx.beginPath();

            turtle.points.forEach((pt, i) => {
                let apt = multiply(pt, zoom);
                apt = roundPoint(apt);

                if (i === 0) {
                    ctx.moveTo(...apt);
                } else {
                    ctx.lineTo(...apt);
                }
            });

            switch (turtle.style) {
                case 0: ctx.stroke(); break; // 0 polyline
                case 1: ctx.closePath(); ctx.stroke(); break;// 1 polygon
                case 2: ctx.closePath(); ctx.stroke(); ctx.fill(); break;  // 2 filled polygon
            }
            break;
        }



    }
}

export const drawElement = (ctx, elem) => {
    ctx.save();
    try {
        const tr = [
            Math.round(elem.pos[0] * dpr) / dpr + 0.5 / dpr,
            Math.round(elem.pos[1] * dpr) / dpr + 0.5 / dpr]
        ctx.translate(...tr);
        ctx.rotate(elem.rotate * Math.PI / 2);
        // ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = elem.width / dpr;
        ctx.strokeStyle = elem.color;
        ctx.fillStyle = elem.color;

        for (const prim of elem.turtle) {


            drawTurtle(ctx, prim, elem.zoom);

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
            let pt = multiply(pinCoords, elem.zoom);
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