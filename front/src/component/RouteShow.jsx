import React, { useRef, useMemo, useEffect, useCallback, } from 'react';

import { dpr } from '../helpers/draw.js';
import { prettify } from '../helpers/debug.js';
import { doRoute } from '../helpers/route.js';
import { ErrorCodes } from '../helpers/utils.js';
// import { Rect, Point } from '../helpers/rect.js';

const RouteShow = ({ libElements, schemaElements, onError }) => {

    const canvasRef = useRef(null);
    // const [routeData, setRouteData] = useState(null);

    const doRoute = (lib, elements) => {
        // Проверка входных данных
        if (!lib || !elements) return null;

        try {
            // Твоя сложная математика
            const result = { /* ... */ };

            // Если результат пустой или невозможный
            if (result.points.length === 0) return null;

            return result;
        } catch (e) {
            console.error("Ошибка трассировки:", e);
            return null;
        }
    };


    const routeData = useMemo(() => {
        // onError([{ code: ErrorCodes.INFO, message: 'Route starting...' }]);
        return doRoute(libElements, schemaElements);
    }, [libElements, schemaElements]);


    useEffect(() => {
        onError([{ code: ErrorCodes.INFO, message: '--- Запуск трассировки ---' }]);
    }, [onError]);
    useEffect(() => {
        if (routeData) {
            // Если расчет прошел успешно
            onError([{ code: ErrorCodes.INFO, message: 'Маршрут построен успешно' }]);
        } else {
            // Если doRoute вернул null (ошибка внутри)
            onError([{ code: ErrorCodes.ERROR, message: 'Ошибка при расчете маршрута' }]);
        }
    }, [routeData, onError]);

    const drawRoute = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !routeData) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // draw route data

    }, [routeData]);
    const drawRef = useRef(drawRoute);
    useEffect(() => {
        drawRef.current = drawRoute;
        const frameId = requestAnimationFrame(() => {
            drawRoute();
        });

        return () => cancelAnimationFrame(frameId);
    }, [drawRoute]);
    useEffect(() => {// update canvas size

        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => {
            const { clientWidth, clientHeight } = canvas;
            canvas.width = clientWidth * dpr;
            canvas.height = clientHeight * dpr;
            if (drawRef.current) drawRef.current();
        });
        resizeObserver.observe(canvas);

        return () => resizeObserver.disconnect();
    }, []);

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
