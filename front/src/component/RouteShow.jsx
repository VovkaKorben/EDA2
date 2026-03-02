import React, { useRef, useState, useEffect, useCallback, } from 'react';

import { dpr } from '../helpers/draw.js';
import { prettify } from '../helpers/debug.js';
import { doRoute, PCB_UNIT } from '../helpers/route.js';
import { ErrorCodes } from '../helpers/utils.js';
import { adjustCtx, multiply, rotate, normalize, adjustPoint, getRectWidth, getRectHeight, add } from '../helpers/geo.js';
import '../css/route.css'
// import { Rect, Point } from '../helpers/rect.js';
const pixInMm = 3.78;
const RouteShow = ({ libElements, schemaElements, onError }) => {

    const canvasRef = useRef(null);
    const [routeData, setRouteData] = useState(null);

    const drawRoute = useCallback(() => {
        try {
            const zoom = 18;

            //const zoomRect = (rct, z) => { return rct.map(v => v * z) }
            const adjustRect = (rct) => {

                const adj = [
                    adjustCtx(rct[0]),
                    adjustCtx(rct[1]),
                    Math.round(rct[2] - rct[0]),
                    Math.round(rct[3] - rct[1]),
                ]
                return adj;
            }
            /*   const rectCenter = (rct) => {
                   return [
                       rct[0] + (rct[2] - rct[0]) / 2,
                       rct[1] + (rct[3] - rct[1]) / 2
                   ]
               }
                   */

            const drawDebugGrid = () => {//
                ctx.strokeStyle = '#00000035'
                const bw = rd.bin[0] / PCB_UNIT
                const bh = rd.bin[1] / PCB_UNIT
                const sz = 5


                ctx.save()
                try {
                    ctx.beginPath()
                    for (let y = 0; y < bh; y++)
                        for (let x = 0; x < bw; x++) {

                            let startPt = multiply([x, y], PCB_UNIT)
                            startPt = multiply(startPt, zoom)
                            startPt = adjustPoint(startPt)
                            let s = add(startPt, [-sz / 2, 0])
                            let e = add(startPt, [sz / 2, 0])
                            ctx.moveTo(...s)
                            ctx.lineTo(...e)

                             s = add(startPt, [0,-sz / 2])
                             e = add(startPt, [0,sz / 2])
                            ctx.moveTo(...s)
                            ctx.lineTo(...e)


                        }
                    ctx.stroke()

                } finally {
                    ctx.restore()

                }
            }
            const drawElements = () => {//

                // elements
                ctx.strokeStyle = '#ff0000';

                rd.elements.forEach(elem => {
                    let elemPos = multiply(elem.pos, zoom);
                    elemPos = adjustPoint(elemPos);

                    ctx.save()
                    try {
                        ctx.translate(...elemPos);
                        ctx.beginPath();
                        ctx.arc(0, 0, 2, 0, 2 * Math.PI);
                        ctx.fill();

                        let rotatedBounds = rotate(elem.bounds, elem.rotate);
                        rotatedBounds = normalize(rotatedBounds)
                        let zeroRect = [0, 0, getRectWidth(rotatedBounds), getRectHeight(rotatedBounds)]
                        zeroRect = multiply(zeroRect, zoom);

                        ctx.strokeRect(...zeroRect);



                    }
                    finally {
                        ctx.restore();
                    }
                    // for (let x = 0; x < 4; x++) { let nb = rotate(elem.bounds, x); nb = normalize(nb); console.log(nb); }
                    // const startPoint = rawParams.slice(p * 2, p * 2 + 2);

                });



            }
            const drawText = () => {//
                const textHeight = pixInMm * 2 * 1.5;
                ctx.save()
                try {
                    // ctx.scale(3.78, 3.78);
                    ctx.font = `${textHeight}px "pcb"`;
                    ctx.fillStyle = 'black'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';        //ctx.textAlign = 'center';        ctx.textBaseline = 'middle';
                    rd.elements.forEach(elem => {
                        let elemPos = multiply(elem.pos, zoom);
                        elemPos = add(elemPos, [3, 3]);
                        ctx.fillText(elem.text, ...elemPos);
                        elemPos = add(elemPos, [0, textHeight]);
                        ctx.fillText(elem.rotate, ...elemPos);

                        elemPos = add(elemPos, [0, textHeight]);
                        ctx.fillText(elem.elementId, ...elemPos);

                    });
                }
                finally {
                    ctx.restore();
                }


            }
            const drawPins = () => {
                ctx.fillStyle = '#550000'
                rd.pins.forEach(pin => {
                    let pinPos = pin.pinPos
                    pinPos = multiply(pinPos, PCB_UNIT)
                    pinPos = multiply(pinPos, zoom)
                    ctx.beginPath()
                    ctx.arc(...pinPos, 3, 0, 2 * Math.PI)
                    ctx.fill()
                })

            }





            const canvas = canvasRef.current;
            if (!canvas || !routeData) return;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // shortcut
            const rd = routeData.data;

            // draw PCB bound
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#00692555';
            let binRect = [0, 0, ...rd.bin];
            let pcbRect = multiply(binRect, zoom);
            pcbRect = adjustRect(pcbRect);
            ctx.strokeRect(...pcbRect);

            drawDebugGrid()
            drawElements()
            drawPins()
            drawText()



        } catch (e) {
            console.error(e.message);
        }


    }, [routeData]);

    // initial 
    useEffect(() => {
        const runRouting = async () => {
            onError?.([{ code: ErrorCodes.INFO, message: 'Init trace' }]);

            try {
                const result = await doRoute({ libElements, schemaElements });
                setRouteData(result);
                // check calculation
                if (result.errors?.length > 0) {
                    onError?.(result.errors);
                } else {
                    onError?.([{
                        code: ErrorCodes.INFO,
                        message: `PCB size: ${result.data.bin[0]}*${result.data.bin[1]}mm`
                    }]);
                }

            } catch (e) {
                onError?.([{ code: ErrorCodes.ERROR, message: `Route critical error: ${e.message}` }]);
            }
        };

        if (Object.keys(libElements).length > 0) runRouting();
    }, [libElements, schemaElements, onError]);




    useEffect(() => {
        const frameId = requestAnimationFrame(() => { drawRoute(); });
        return () => cancelAnimationFrame(frameId);
    }, [drawRoute]);

    // update canvas size
    useEffect(() => {

        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleUpdate = () => {
            const { clientWidth, clientHeight } = canvas;
            canvas.width = clientWidth * dpr;
            canvas.height = clientHeight * dpr;
            drawRoute();
        };
        const resizeObserver = new ResizeObserver(handleUpdate);
        resizeObserver.observe(canvas);

        document.fonts.ready.then(handleUpdate);

        return () => resizeObserver.disconnect();
    }, [drawRoute]);

    return (
        <React.Fragment>

            <canvas
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    border: '0px',
                    background: '#fff',

                }}
            />
        </React.Fragment>

    );
};



export default RouteShow;
