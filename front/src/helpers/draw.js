import { dpr } from './utils.js';
import { addPoint, multiplyPoint } from './geo.js';

export const drawElement = (elem, ctx) => {
    ctx.save();
    try {
        // ctx.translate(Math.round(elem.pos.x), Math.round(elem.pos.y));
        // Округляем до целого физического пикселя, затем возвращаем в логику
        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
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





export const drawPins = (elem, ctx) => {
    ctx.save();
    try {

        ctx.translate(Math.round(elem.pos[0] * dpr) / dpr, Math.round(elem.pos[1] * dpr) / dpr);
        ctx.lineWidth = 1 / dpr;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const [pinIndex, pinCoords] of Object.entries(elem.pins)) {
            // let pt = addPoint(pinCoords, elem.pos);
            let pt = multiplyPoint(pinCoords, elem.zoom);
            pt = addPoint(pt, [7, -7]);
            ctx.fillText(pinIndex, pt[0], pt[1]);
        }

    }

    finally { ctx.restore(); }

}