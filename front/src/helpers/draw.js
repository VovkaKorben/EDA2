
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


export const drawTurtle = (ctx, turtle, zoom) => {
    ctx.beginPath();
    switch (turtle.code) {

        case 'A': {// circle
            // ctx.beginPath();
            let center = multiply(turtle.center, zoom);
            center = roundPoint(center);


            ctx.arc(...center, Math.round(turtle.radius * zoom), turtle.start, turtle.end);
            break;
        }


        case 'P': {// polyline


            turtle.points.forEach((pt, i) => {
                let apt = multiply(pt, zoom);
                apt = roundPoint(apt);

                if (i === 0) {
                    ctx.moveTo(...apt);
                } else {
                    ctx.lineTo(...apt);
                }
            });


            break;
        }



    }
    switch (turtle.style) {

        case 1: ctx.closePath(); ctx.stroke(); break;// 1 closed
        case 2: ctx.closePath(); ctx.stroke(); ctx.fill(); break;  // 2 filled 
        case 0:
        default:
            ctx.stroke(); break; // 0 simple primitive
    }
}

export const drawElement = (ctx, elem) => {
    ctx.save();
    try {
        const tr = [
            Math.round(elem.pos[0] * dpr) / dpr + 0.5 / dpr,
            Math.round(elem.pos[1] * dpr) / dpr + 0.5 / dpr]
        ctx.translate(...tr);
        ctx.rotate(elem.rotateIndex * Math.PI / 2);
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

        for (const [pinIndex, pinCoords] of Object.entries(elem.pins[elem.rotateIndex])) {
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
        ctx.fillText(`${elem.abbr}${elem.typeIndex} (id: ${elem.elementId})`, 0, -40);


    }

    finally { ctx.restore(); }

}