import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import { ObjectType, DragMode, DrawColor } from '../helpers/utils.js';
import { dpr, drawElement, drawPins, drawName, adjustPoint, drawGridDebug } from '../helpers/draw.js';
import { clamp, addPoint, pointsDistance, transformRect, ptInRect } from '../helpers/geo.js';
import { prettify, prettify_v2 } from '../helpers/debug.js';
import { prepareAStarGrid, coordsToFlat, doAStar, routeToCoords } from '../helpers/astar.js';
const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32];
const DRAG_BUTTON = 0;
const DEFAULT_VIEW = { zoomIndex: 0, zoom: 1, x: 0, y: 0 };

const SchemaCanvas = forwardRef(({
    libElements, schemaElements,

    hovered, selected,
    hoveredChanged, selectedChanged,

    onElemChanged, onElemDeleted
}, ref) => {

    const canvasRef = useRef(null);
    const dragMode = useRef(null);
    //useEffect(() => {        console.log(`dragMode: ${dragMode.current}`);    }, [dragMode.current]);


    const schemaRef = useRef(schemaElements);
    useEffect(() => { schemaRef.current = schemaElements; }, [schemaElements]);
    const selectedRef = useRef(selected);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    const [view, setView] = useState(() => { const saved = localStorage.getItem('view'); return saved ? JSON.parse(saved) : DEFAULT_VIEW; });
    useEffect(() => { localStorage.setItem('view', JSON.stringify(view)); }, [view]);
    const viewRef = useRef(view);
    useEffect(() => { viewRef.current = view; }, [view]);
    useImperativeHandle(ref, () => ({ resetView: () => { setView(DEFAULT_VIEW); } }));

    const lastPos = useRef(false);

    // debug
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [globalPos, setGlobalPos] = useState([0, 0]);




    const [activeRoute, setActiveRoute] = useState(null);
    const aStarRef = useRef(null);
    const initAStar = useCallback((startCoords) => {
        // calculate visible area
        const { width, height } = canvasRef.current.getBoundingClientRect();
        // 1. Берем смещение в пикселях и переводим в глобальные единицы
        const x1 = view.x / view.zoom;
        const y1 = view.y / view.zoom;

        // 2. Добавляем размер экрана, тоже деленный на зум
        const x2 = x1 + (width / view.zoom);
        const y2 = y1 + (height / view.zoom);

        const globalBounds = [x1, y1, x2, y2];
        aStarRef.current = prepareAStarGrid(globalBounds, libElements, schemaElements);
        if (aStarRef.current) {
            const startIdx = coordsToFlat(aStarRef.current, startCoords);
            aStarRef.current = {
                ...aStarRef.current,
                startIdx: startIdx,
                goalIdx: null
            }
        }
        // console.log(aStarRef.current);
        return !!aStarRef.current;
    }, [view, libElements, schemaElements]);
    const routeAStar = (goalCoords) => {
        // check for A* grid initialized
        if (!aStarRef.current) return;

        // get Goal-Flat-Index from mouse
        const goalIdx = coordsToFlat(aStarRef.current, goalCoords);

        // check goal is really changed
        if (aStarRef.current.goalIdx === goalIdx) return;
        aStarRef.current.goalIdx = goalIdx;

        // calc flat-indexes
        const indexRoute = doAStar(aStarRef.current);
        // convert flat-indexes to global-coords
        const coordsRoute = routeToCoords(aStarRef.current, indexRoute);


        // console.log(prettify(coordsRoute, 0));
        setActiveRoute(coordsRoute);

    }


    const ScreenToGlobal = useCallback((mx, my) => {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        let x = (mx - canvasRect.left + viewRef.current.x) / viewRef.current.zoom;
        let y = (my - canvasRect.top + viewRef.current.y) / viewRef.current.zoom;
        return [x, y];
    }, []);

    /*const GlobalToScreen = useCallback((pt) => {
        const x = pt[0] * viewRef.current.zoom - viewRef.current.x;
        const y = pt[1] * viewRef.current.zoom - viewRef.current.y;
        return [x, y];
     
    }, [view]);
    */




    // DRAW ---------------------------------------------------------
    const drawAll = useCallback(() => {
        const GlobalToScreen = (pt) => {
            const x = pt[0] * viewRef.current.zoom - viewRef.current.x;
            const y = pt[1] * viewRef.current.zoom - viewRef.current.y;
            return [x, y];
        };

        /*  const RectGlobalToScreen = (rect) => {
              const x1 = rect[0] * viewRef.current.zoom - viewRef.current.x;
              const y1 = rect[1] * viewRef.current.zoom - viewRef.current.y;
              const x2 = rect[2] * viewRef.current.zoom - viewRef.current.x;
              const y2 = rect[3] * viewRef.current.zoom - viewRef.current.y;
              return [x1, y1, x2 - x1, y2 - y1];
     
          };*/
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


        // Рисуем сетку А*, если мы в режиме роутинга
        if (dragMode.current === DragMode.ROUTING && aStarRef.current) { drawGridDebug(ctx, aStarRef.current, GlobalToScreen); }

        // if 
        if (hovered && hovered.type === ObjectType.PIN) {
            let pinCoords = pinToCoords(hovered);
            pinCoords = GlobalToScreen(pinCoords);


            ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
            ctx.beginPath();
            ctx.arc(pinCoords[0], pinCoords[1], 5, 0, 2 * Math.PI);
            ctx.fill();
        }


        Object.values(schemaElements.elements).forEach(elem => {// each element on schematic
            const libElement = libElements[elem.typeId];
            if (libElement) {


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
            }
        });



        if (activeRoute) {
            ctx.beginPath();
            try {
                activeRoute.forEach((pt, i) => {
                    const screenPt = GlobalToScreen(pt);
                    const adjusted = adjustPoint(screenPt);

                    if (i === 0) {
                        ctx.moveTo(...adjusted);
                    } else {
                        ctx.lineTo(...adjusted);
                    }


                })
            } finally {
                ctx.stroke();
            }
        }

    }, [libElements, schemaElements, hovered, selected, view, activeRoute]);
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

    // KEYBOARD ------------------------------------------------
    useEffect(() => {  // keyboard processing

        const rotateElement = (reset) => {
            const selected = selectedRef.current;
            if (!(selected && selected.type === ObjectType.ELEMENT)) return;
            const elements = schemaRef.current.elements;
            const elem = elements[selected.elementId];
            const newRotate = reset ? 0 : (elem.rotate + 1) % 4;
            const updatedElem = { ...elem, rotate: newRotate };
            onElemChanged(updatedElem);
        };



        const handleKeyDown = (event) => {
            switch (event.code) {
                case 'KeyR': rotateElement(false); break;
                case 'KeyT': rotateElement(true); break;
                case 'Delete': {
                    if (dragMode.current === null && selectedRef.current && selectedRef.current.type === ObjectType.ELEMENT) {
                        selectedChanged(null);
                        onElemDeleted(selectedRef.current.elementId);
                    }
                } break;

                case 'Digit1':
                    //       console.log(prettify(aStarRef.current, 1)); break;
                    console.log(prettify_v2(aStarRef.current, 0)); break;
                case 'Escape':
                    if (dragMode.current === DragMode.ROUTING) {
                        dragMode.current = null;
                        setActiveRoute(null);
                        aStarRef.current = null;
                    }; break;

            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onElemChanged, onElemDeleted, selectedChanged]);


    // WHEEL -------------------------------------------------------------------
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

    // DROP ------------------------------------------------
    const handleDrop = (e) => {
        e.preventDefault();
        // convert drag to object
        const data = JSON.parse(e.dataTransfer.getData('compData'));

        // calculate insertion position
        const canvasRect = canvasRef.current.getBoundingClientRect();

        const pos = [
            (e.clientX - canvasRect.left + viewRef.current.x) / viewRef.current.zoom,
            (e.clientY - canvasRect.top + viewRef.current.y) / viewRef.current.zoom
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

        onElemChanged(newElement, true);
    };
    // DRAG OVER --------------------------------------------------------
    const handleDragOver = (e) => {
        e.preventDefault();
    };



    const findPinAt = useCallback((checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            for (const [pinName, pinValue] of Object.entries(libElement.pins[elem.rotate])) {
                let pinCoords = addPoint(pinValue, elem.pos);
                const pointsDist = pointsDistance(pinCoords, checkPoint);
                if (pointsDist <= 3) {
                    return { elementId: elem.id, pinIdx: pinName, pinCoords: pinCoords };
                }
            }
        }
        return null;
    }, [libElements, schemaElements]);
    const findElemAt = useCallback((checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            const elemRect = transformRect(libElement.bounds[elem.rotate], elem.pos);
            if (ptInRect(elemRect, checkPoint)) {
                return { elementId: elem.id };
            }

        }
        return null;
    }, [libElements, schemaElements]);

    const getObjectUnderCursor = useCallback((pt) => {
        const pinCheck = findPinAt(pt);
        if (pinCheck !== null)
            return { type: ObjectType.PIN, ...pinCheck };
        const elemCheck = findElemAt(pt);
        if (elemCheck !== null)
            return { type: ObjectType.ELEMENT, ...elemCheck };
        //{ type: 'WIRE', wireId: 505 }
        return null;

    }, [findPinAt, findElemAt]);
    // MOUSE DOWN ------------------------------------------------
    const handleMouseDown = useCallback((e) => {
        if (e.button !== DRAG_BUTTON) return;
        const pt = ScreenToGlobal(e.clientX, e.clientY);
        const obj = getObjectUnderCursor(pt);
        selectedChanged(obj);

        if (obj) {
            if (obj.type === ObjectType.ELEMENT) {
                dragMode.current = DragMode.ELEMENT;
            } else if (obj.type === ObjectType.PIN) {

                const resultInitAStar = initAStar(obj.pinCoords);
                console.log(`resultInitAStar: ${resultInitAStar}`);
                if (resultInitAStar)
                    dragMode.current = DragMode.ROUTING;
                // console.log(`dragMode: ${dragMode.current}`);
            }
            //  else wire....

        } else  // none from above - simple canvas drag
            dragMode.current = DragMode.SCROLL;
        lastPos.current = { x: e.clientX, y: e.clientY };
    }, [ScreenToGlobal, getObjectUnderCursor, selectedChanged, initAStar]);

    // MOUSE MOVE ------------------------------------------------
    const handleMouseMove = (e) => {
        const pt = ScreenToGlobal(e.clientX, e.clientY);

        const obj = getObjectUnderCursor(pt);
        hoveredChanged(obj);


        // JUST FOR DEBUG --------------------
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const mp = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
        setMousePos(mp);
        setGlobalPos(pt);
        // DEBUG END -------------------------
        // console.log(`dragMode: ${dragMode.current}`);
        if (dragMode.current) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            switch (dragMode.current) {
                case DragMode.SCROLL:

                    viewRef.current.x -= dx;
                    viewRef.current.y -= dy;
                    setView({ ...viewRef.current });
                    break;
                case DragMode.ELEMENT: {

                    const newElem = { ...schemaElements.elements[selectedRef.current.elementId] };
                    newElem.pos = addPoint(newElem.pos, [dx / viewRef.current.zoom, dy / viewRef.current.zoom]);
                    onElemChanged(newElem, false);
                } break;
                case DragMode.ROUTING: {
                    routeAStar(pt);

                } break;

            }
            lastPos.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleMouseUp = (e) => {

        if (e.button !== DRAG_BUTTON) return;
        if (dragMode.current !== DragMode.ROUTING) {
            dragMode.current = null;
        }
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
