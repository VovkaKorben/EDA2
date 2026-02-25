import React, { useRef, useState, useEffect, useCallback, } from 'react';

import { dpr } from '../helpers/draw.js';
import { prettify } from '../helpers/debug.js';
import { doRoute } from '../helpers/route.js';
import { ErrorCodes } from '../helpers/utils.js';
import { adjustCtx } from '../helpers/geo.js';
import '../css/route.css'
// import { Rect, Point } from '../helpers/rect.js';

const RouteShow = ({ libElements, schemaElements, onError }) => {

    const canvasRef = useRef(null);
    const [routeData, setRouteData] = useState(null);

    const drawRoute = useCallback(() => {
        const zoom = 7;
        const zoomRect = (rct, z) => { return rct.map(v => v * z) }
        const adjustRect = (rct) => {

            const adj = [
                adjustCtx(rct[0]),
                adjustCtx(rct[1]),
                Math.round(rct[2] - rct[0]),
                Math.round(rct[3] - rct[1]),
            ]
            return adj;
        }
        const rectCenter = (rct) => {
            return [
                rct[0] + (rct[2] - rct[0]) / 2,
                rct[1] + (rct[3] - rct[1]) / 2
            ]
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
        let binRect = [0, 0, rd.binW, rd.binH];
        let pcbRect = zoomRect(binRect, zoom);
        pcbRect = adjustRect(pcbRect);
        ctx.strokeRect(...pcbRect);


        ctx.font = '24px "pcb"';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';


        // const pt = addPoint(pt, [7, -7]);



        // elements
        ctx.strokeStyle = '#ff0000';
        rd.rects.forEach(rect => {
            const elemArray = rect.toArray();
            const elemRect = zoomRect(elemArray, zoom);
            const adj = adjustRect(elemRect);
            ctx.strokeRect(...adj);

            ctx.fillText(rect.elementId, ...rectCenter(elemRect));


        });


    }, [routeData]);
    //  const drawRef = useRef(drawRoute);

    // initial 
    useEffect(() => {
        const runRouting = async () => {
            // Сигнализируем о старте
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
                        message: `PCB size: ${result.data.binW}*${result.data.binH}mm`
                    }]);
                }

            } catch (e) {
                onError?.([{ code: ErrorCodes.ERROR, message: `Route critical error: ${e.message}` }]);
            }
        };

        if (Object.keys(libElements).length > 0) runRouting();
    }, [libElements, schemaElements, onError]);

    /*
     useEffect(() => {
         if (!routeData) return;
 
         const log = [];
         if (routeData.errors?.length > 0) {
             log.push(...routeData.errors);
         } else {
             log.push({
                 code: ErrorCodes.INFO,
                 message: `PCB size: ${routeData.data.binW}*${routeData.data.binH}mm`
             });
         }
 
 
 
 
         if (log.length > 0) {
             onError?.(log);
         }
     }, [routeData, onError]);
     */
    // font update 
    useEffect(() => {
        document.fonts.ready.then(() => {
            if (drawRoute) drawRoute();
        });
    }, [drawRoute]);


    useEffect(() => {
        // drawRef.current = drawRoute;
        const frameId = requestAnimationFrame(() => {
            drawRoute();
        });

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
