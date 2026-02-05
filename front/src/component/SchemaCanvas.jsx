import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import { dpr } from '../helpers/utils.js';
import { drawElement, drawPins } from '../helpers/draw.js';
import { clamp } from '../helpers/geo.js';
import { prettify } from '../helpers/debug.js';
const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32];
const DRAG_BUTTON = 0;


const DragMode = Object.freeze({
    NONE: 'NONE',
    DRAGGING: 'DRAGGING',
    ROUTING: 'ROUTING',
    SELECTED: 'SELECTED'
});
const SchemaCanvas = forwardRef(({ libElements, schemaElements, onAddElement }, ref) => {


    const canvasRef = useRef(null);
    const Drag = useRef(DragMode.NONE);

    const DEFAULT_VIEW = { zoomIndex: 0, x: 0, y: 0 };
    const [view, setView] = useState(() => {
        //    return DEFAULT_VIEW;
        const saved = localStorage.getItem('view'); return saved ? JSON.parse(saved) : DEFAULT_VIEW;
    });
    useImperativeHandle(ref, () => ({ resetView: () => { setView(DEFAULT_VIEW); } }));


    const findPinAt = (point) => {


        const pos = [(point[0] + view.x) / tz, (point[1] + view.y) / tz];
        // Теперь pos будет точно таким же, как globalPos
        console.log("Поиск пина в координатах мира:", pos);
        schemaElements.elements.forEach(elem => {
            const libElement = libElements[elem.typeId];
            libElement.pins.forEach(pin => {

            });


        });



    }

    const drawAll = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const zoom = zoomLevels[view.zoomIndex];
        //console.log('--------------------------------');

        // each element on schematic
        schemaElements.elements.forEach(elem => {
            const libElement = libElements[elem.typeId];


            const toDraw = {
                ...libElement,
                pos: [elem.pos[0] * zoom - view.x, elem.pos[1] * zoom - view.y],
                zoom: zoom,
                rotate: elem.rotate,
            };
            drawElement(toDraw, ctx);
            drawPins(toDraw, ctx);
        });

        // Тут позже добавим рисование сетки и проводов
    }, [view, libElements, schemaElements]); // Пересоздаем функцию только если изменился зум, позиция или массив элементов
    const drawRef = useRef(drawAll);
    useEffect(() => { drawRef.current = drawAll; }, [drawAll]);

    useEffect(() => {// ResizeObserver
        drawRef.current();
    }, [drawAll]);
    useEffect(() => {// update canvas size
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => {
            const { clientWidth, clientHeight } = canvas;
            canvas.width = clientWidth * dpr;
            canvas.height = clientHeight * dpr;
            drawRef.current();
        });
        resizeObserver.observe(canvas);

        return () => resizeObserver.disconnect();
    }, []);
    // POS + ZOOM
    useEffect(() => {
        localStorage.setItem('view', JSON.stringify(view));
    }, [view]);
    const handleWheel = (e) => {
        const canvasRect = e.currentTarget.getBoundingClientRect()
        const mousePos = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top
        }
        const wheel_dir = Math.sign(e.deltaY);
        setView(prev => {
            const oldZoom = zoomLevels[prev.zoomIndex];
            const newZoomIndex = clamp(prev.zoomIndex + wheel_dir, 0, zoomLevels.length - 1);
            const newZoom = zoomLevels[newZoomIndex];

            const new_view = {
                zoomIndex: newZoomIndex,
                x: (mousePos.x + prev.x) * (newZoom / oldZoom) - mousePos.x,
                y: (mousePos.y + prev.y) * (newZoom / oldZoom) - mousePos.y,
            };
            return new_view;
        });
    };

    /*
     const handleDrop = (e) => {
            e.preventDefault();
            const data = JSON.parse(e.dataTransfer.getData('compData'));
    
            // Считаем координаты относительно холста
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
    
            // Передаём наверх в App информацию: ЧТО и КУДА бросили
            onElementDropped(data, x, y);
        };*/
    const handleDrop = (e) => {
        e.preventDefault();
        // convert drag to object
        const data = JSON.parse(e.dataTransfer.getData('compData'));

        // calculate insertion position
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const zoom = zoomLevels[view.zoomIndex];
        const pos = [
            (e.clientX - canvasRect.left + view.x) / zoom,
            (e.clientY - canvasRect.top + view.y) / zoom
        ]

        // get first available element index
        let newTypeIndex = 1;
        const searchType = libElements[data.typeId].abbr.toUpperCase();
        const fil = schemaElements.elements.filter((e) => libElements[e.typeId].abbr.toUpperCase() === searchType);
        const m = fil.map((e) => e.typeIndex);
        m.sort((a, b) => a - b);
        for (const e of m) {
            if (e !== newTypeIndex)
                break;
            newTypeIndex++
        }








        const newElement = {
            id: Date.now(),
            typeId: data.typeId,
            pos: pos,
            rotate: 0,
            typeIndex: newTypeIndex
        };
        onAddElement(newElement);
    };



    const handleDragOver = (e) => {
        e.preventDefault(); // РАЗРЕШАЕМ DROP
    };



    const lastPos = useRef(false);

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const tz = zoomLevels[view.zoomIndex];
    const globalPos = {
        x: (mousePos.x + view.x) / tz,
        y: (mousePos.y + view.y) / tz
    }

    const handleMouseDown = (e) => {
        if (e.button !== DRAG_BUTTON) return;
        // check pins
        const rect = canvasRef.current.getBoundingClientRect();
        const mp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        // setMousePos(mp);


        findPinAt([mp.x, mp.y]);


        // check elems


        // none from above - simple canvas drag
        Drag.current = DragMode.DRAGGING;

        // Drag.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e) => {

        const rect = canvasRef.current.getBoundingClientRect();
        const mp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setMousePos(mp);


        findPinAt([mp.x, mp.y]);

        switch (Drag.current) {
            case DragMode.DRAGGING: {
                const dx = e.clientX - lastPos.current.x;
                const dy = e.clientY - lastPos.current.y;
                setView(prev => (
                    { ...prev, x: prev.x - dx, y: prev.y - dy }
                ));
                lastPos.current = { x: e.clientX, y: e.clientY };
            }
                break;


        }

        // const pin = findPinAt(


        /* 
     
          // canvas drag handler
          if (isDragging.current) {
             
              return;
          }
    */
        // simple mouse move

    };
    const handleMouseUp = (e) => {
        //console.log(`zoom: ${zoomLevels[view.zoomIndex]} | ${prettify(view, 0)} local : ${prettify(mousePos, 0)} | global: ${prettify(globalPos, 0)}`);
        if (e.button !== DRAG_BUTTON) return;
        Drag.current = DragMode.NONE;
    };


    return (
        <React.Fragment>
            {`Z: ${zoomLevels[view.zoomIndex]} | V: [${view.x.toFixed(2)}, ${view.y.toFixed(2)}] | L: [${mousePos.x.toFixed(2)}, ${mousePos.y.toFixed(2)}] | G: [${globalPos.x.toFixed(2)}, ${globalPos.y.toFixed(2)}]`}
            {/* zoom: {zoomLevels[view.zoomIndex]} | {prettify(view, 0)} local : {prettify(mousePos, 0)} | global: {prettify(globalPos, 0)} */}
            <canvas
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onWheel={handleWheel}
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                    width: '90%',
                    height: '90%',
                    display: 'block',
                    border: '2px solid #333',
                    background: '#fff',
                    // cursor: 'crosshair'
                }}
            />
        </React.Fragment>

    );
});


SchemaCanvas.displayName = 'SchemaCanvas';
export default SchemaCanvas;
