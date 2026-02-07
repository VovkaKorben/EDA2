import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import { dpr } from '../helpers/utils.js';
import { drawElement, drawPins, drawName } from '../helpers/draw.js';
import { clamp, multiplyPoint, addPoint, pointsDistance, transformRect, ptInRect } from '../helpers/geo.js';
import { prettify } from '../helpers/debug.js';
const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32];
const DRAG_BUTTON = 0;
const DEFAULT_VIEW = { zoomIndex: 0, zoom: 1, x: 0, y: 0 };

const DragMode = Object.freeze({

    SCROLL: 'SCROLL',
    ROUTING: 'ROUTING',
    ELEMENT: 'ELEMENT'
});
const ObjectType = Object.freeze({
    PIN: 'PIN',
    ELEMENT: 'ELEMENT',
    WIRE: 'WIRE'
});

const DrawColor = Object.freeze({
    NONE: 'black',
    HOVERED: '#5577FF',
    SELECTED: 'blue'
});
const SchemaCanvas = forwardRef(({ libElements, schemaElements, onAddElement, hoveredChanged, selectedChanged, elemChanged }, ref) => {
    const applyRotate = (elem) => {
        const rotatedTurtle = {};
        const rotatedPins = {};

    }

    const canvasRef = useRef(null);
    const dragMode = useRef(null);
    // const [selectedPin, setSelectedPin] = useState(null);

    const [hovered, setHovered] = useState(null);
    const [selected, setSelected] = useState(null);

    // const selectedElements = useRef(new Set());
    // const selectedWires = useRef(new Set());
    // const [activeRoute, setActiveRoute] = useState(null);
    const lastPos = useRef(false);

    // debug
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [globalPos, setGlobalPos] = useState([0, 0]);


    const [view, setView] = useState(() => {
        //    return DEFAULT_VIEW;
        const saved = localStorage.getItem('view'); return saved ? JSON.parse(saved) : DEFAULT_VIEW;
    });

    const ScreenToGlobal = (mx, my) => {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        let x = (mx - canvasRect.left + view.x) / view.zoom;
        let y = (my - canvasRect.top + view.y) / view.zoom;
        return [x, y];
    }

    /*const GlobalToScreen = useCallback((pt) => {
        const x = pt[0] * view.zoom - view.x;
        const y = pt[1] * view.zoom - view.y;
        return [x, y];

}, [view]);
*/


    useImperativeHandle(ref, () => ({ resetView: () => { setView(DEFAULT_VIEW); } }));


    const drawAll = useCallback(() => {
        const GlobalToScreen = (pt) => {
            const x = pt[0] * view.zoom - view.x;
            const y = pt[1] * view.zoom - view.y;
            return [x, y];
        };
        const RectGlobalToScreen = (rect) => {
            const x1 = rect[0] * view.zoom - view.x;
            const y1 = rect[1] * view.zoom - view.y;
            const x2 = rect[2] * view.zoom - view.x;
            const y2 = rect[3] * view.zoom - view.y;
            return [x1, y1, x2 - x1, y2 - y1];

        };
        const pinToCoords = (pin) => {
            const elem = schemaElements.elements[pin.elementId];
            const pinCoords = libElements[elem.typeId].pins[elem.rotate][pin.pinIdx];
            const pt = addPoint(elem.pos, pinCoords);
            return pt;
        };

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);



        // each element on schematic
        Object.values(schemaElements.elements).forEach(elem => {
            const libElement = libElements[elem.typeId];


            let drawColor = DrawColor.NONE;

            if (hovered && hovered.type === ObjectType.ELEMENT && elem.id === hovered.elementId)
                drawColor = DrawColor.HOVERED;
            if (selected && selected.type === ObjectType.ELEMENT && elem.id === selected.elementId)
                drawColor = DrawColor.SELECTED;


            const toDraw = {
                ...libElement,
                pos: GlobalToScreen(elem.pos),
                zoom: view.zoom,
                rotate: elem.rotate,
                typeIndex: elem.typeIndex,
                drawColor: drawColor
            };
            drawElement(toDraw, ctx);
            drawPins(toDraw, ctx);
            drawName(toDraw, ctx);
        });

        if (hovered && hovered.type === ObjectType.PIN) {
            let pinCoords = pinToCoords(hovered);
            pinCoords = GlobalToScreen(pinCoords);


            ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
            ctx.beginPath();
            ctx.arc(pinCoords[0], pinCoords[1], 5, 0, 2 * Math.PI);
            ctx.fill();
        }


        //



        // Тут позже добавим рисование сетки и проводов
    }, [view, libElements, schemaElements,  hovered, selected]); // Пересоздаем функцию только если изменился зум, позиция или массив элементов
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
                zoom: zoomLevels[newZoomIndex],
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

        const pos = [
            (e.clientX - canvasRect.left + view.x) / view.zoom,
            (e.clientY - canvasRect.top + view.y) / view.zoom
        ]

        // get first available element index
        let newTypeIndex = 1;
        const searchType = libElements[data.typeId].abbr.toUpperCase();
        const fil = Object.values(schemaElements.elements).filter((e) => libElements[e.typeId].abbr.toUpperCase() === searchType);
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
        applyRotate(newElement);
        onAddElement(newElement);
    };
    const handleDragOver = (e) => {
        e.preventDefault(); // РАЗРЕШАЕМ DROP
    };



    const findPinAt = (checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            for (const [pinName, pinValue] of Object.entries(libElement.pins[elem.rotate])) {
                let pinCoords = addPoint(pinValue, elem.pos);
                const pointsDist = pointsDistance(pinCoords, checkPoint);
                if (pointsDist <= 3) {
                    return { elementId: elem.id, pinIdx: pinName };
                }
            }
        }
        return null;
    }
    const findElemAt = (checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            const elemRect = transformRect(libElement.bounds[elem.rotate], elem.pos);
            // console.log(`${libElement.abbr}${elem.typeIndex}: ${prettify(elemRect, 0)}`);
            if (ptInRect(elemRect, checkPoint)) {
                return { elementId: elem.id };
            }

        }
        return null;
    }
    const getObjectUnderCursor = (pt) => {
        const pinCheck = findPinAt(pt);
        if (pinCheck !== null)
            return { type: ObjectType.PIN, ...pinCheck };
        const elemCheck = findElemAt(pt);
        if (elemCheck !== null)
            return { type: ObjectType.ELEMENT, ...elemCheck };
        //{ type: 'WIRE', wireId: 505 }
        return null;

    }

    const handleMouseDown = (e) => {
        if (e.button !== DRAG_BUTTON) return;
        const pt = ScreenToGlobal(e.clientX, e.clientY);
        const obj = getObjectUnderCursor(pt);
        selectedChanged(obj);
        setSelected(obj);

        if (obj) {
            if (obj.type === ObjectType.ELEMENT) {
                dragMode.current = DragMode.ELEMENT;
            } else if (obj.type === ObjectType.PIN) {
                dragMode.current = DragMode.ROUTING;
            }
            //  else wire....

        } else  // none from above - simple canvas drag
            dragMode.current = DragMode.SCROLL;

        lastPos.current = { x: e.clientX, y: e.clientY };






        // Drag.current = true;

    };


    const handleMouseMove = (e) => {
        const pt = ScreenToGlobal(e.clientX, e.clientY);
        setHovered(() => {
            const obj = getObjectUnderCursor(pt);
            hoveredChanged(obj);
            return obj;
        });

        // JUST FOR DEBUG --------------------
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const mp = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        setMousePos(mp);
        setGlobalPos(pt);
        // DEBUG END -------------------------

        if (dragMode.current) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            switch (dragMode.current) {
                case DragMode.SCROLL: {
                    setView(prev => (
                        { ...prev, x: prev.x - dx, y: prev.y - dy }
                    ));
                } break;
                case DragMode.ELEMENT: {

                    // schemaElements = schemaElements
                    //
                    // alert(1);
                    const newElem = { ...schemaElements.elements[selected.elementId] };
                    newElem.pos = addPoint(newElem.pos, [dx / view.zoom, dy / view.zoom]);
                    elemChanged(newElem);
                } break;

            }
            lastPos.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleMouseUp = (e) => {
        //console.log(`zoom: ${ zoomLevels[view.zoomIndex]} | ${ prettify(view, 0) } local : ${ prettify(mousePos, 0) } | global: ${ prettify(globalPos, 0) }`);
        if (e.button !== DRAG_BUTTON) return;
        dragMode.current = null;
    };


    return (
        <React.Fragment>
            {`zIdx:${view.zoomIndex} zVal:${view.zoom} | V: [${view.x.toFixed(2)}, ${view.y.toFixed(2)}] | Mouse: [${mousePos.x.toFixed(2)}, ${mousePos.y.toFixed(2)}] | Global: [${globalPos[0].toFixed(2)}, ${globalPos[1].toFixed(2)}]`}<br />
            {/* hovered: {prettify(hovered, 0)} */}
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
