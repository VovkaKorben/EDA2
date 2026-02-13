import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import { ObjectType, DragModeType, DrawColor } from '../helpers/utils.js';
import { drawElement, drawPins, drawName, adjustPoint, drawGridDebug, adjustCtx, GRID_SIZE, dpr } from '../helpers/draw.js';
// import { dpr } from '../helpers/dpr.js';
import { clamp, addPoint, pointsDistance, transformRect, ptInRect, roundPoint } from '../helpers/geo.js';
import { prettify, prettify_v2 } from '../helpers/debug.js';
import { prepareAStarGrid, coordsToFlat, doAStar, simplifyRoute } from '../helpers/astar.js';

const BOLD_EACH = 10;
const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32];
const _initZoom = 1;
const DEFAULT_VIEW = {
    zoomIndex: _initZoom,
    zoom: zoomLevels[_initZoom],
    x: 0, y: 0,
    interval: GRID_SIZE * zoomLevels[_initZoom]
};

const DRAG_BUTTON = 0;


const SchemaCanvas = forwardRef(({
    libElements, schemaElements,

    hovered, selected,
    hoveredChanged, selectedChanged,

    onElemChanged, onElemDeleted,
    onWireChanged
}, ref) => {

    const canvasRef = useRef(null);
    const dragMode = useRef(null);
    //useEffect(() => {        console.log(`dragMode: ${dragMode.current}`);    }, [dragMode.current]);


    const schemaRef = useRef(schemaElements);
    const selectedRef = useRef(selected);
    const [view, setView] = useState(() => { const saved = localStorage.getItem('view'); return saved ? JSON.parse(saved) : DEFAULT_VIEW; });
    const viewRef = useRef(view);
    const lastPos = useRef(false);


    useEffect(() => { schemaRef.current = schemaElements; }, [schemaElements]);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { localStorage.setItem('view', JSON.stringify(view)); }, [view]);

    useEffect(() => { viewRef.current = view; }, [view]);
    useImperativeHandle(ref, () => ({ resetView: () => { setView(DEFAULT_VIEW); } }));



    // debug
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [parrotsPos, setParrotsPos] = useState([0, 0]);




    const [activeRoute, setActiveRoute] = useState(null);
    const aStarRef = useRef(null);
    const initAStar = useCallback((startCoords) => {
        // calculate visible area
        const { width, height } = canvasRef.current.getBoundingClientRect();
        const { x, y, interval } = viewRef.current;


        const x1 = Math.floor(x);
        const y1 = Math.floor(y);

        // 2. Добавляем размер экрана, тоже деленный на зум
        const x2 = x1 + Math.ceil(width / interval);
        const y2 = y1 + Math.ceil(height / interval);

        const parrotBounds = [x1, y1, x2, y2];
        aStarRef.current = prepareAStarGrid(parrotBounds, libElements, schemaElements);
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
    }, [libElements, schemaElements]);
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
        const simpleRoute = simplifyRoute(aStarRef.current, indexRoute);


        // console.log(prettify(coordsRoute, 0));
        setActiveRoute(simpleRoute);

    }


    const screenToParrots = useCallback((screenX, screenY) => {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const { x, y, interval } = viewRef.current;
        const parrotX = (screenX - canvasRect.left) / interval + x;
        const parrotY = (screenY - canvasRect.top) / interval + y;
        return [parrotX, parrotY];
    }, []);
    const parrotsToScreen = (parrots) => {
        const [px, py] = parrots;
        const { x, y, interval } = viewRef.current;
        const screenX = (px - x) * interval;
        const screenY = (py - y) * interval;
        return [screenX, screenY];
    };
    /*const GlobalToScreen = useCallback((pt) => {
        const x = pt[0] * viewRef.current.zoom - viewRef.current.x;
        const y = pt[1] * viewRef.current.zoom - viewRef.current.y;
        return [x, y];
     
    }, [view]);
    */




    // DRAW ---------------------------------------------------------
    const drawAll = useCallback(() => {

        const pinToCoords = (pin) => {
            const elem = schemaElements.elements[pin.elementId];
            const pinCoords = libElements[elem.typeId].pins[elem.rotate][pin.pinIdx];
            const pt = addPoint(elem.pos, pinCoords);
            return pt;
        };

        const drawGrid = () => {
            ctx.save();

            ctx.lineWidth = 1;


            const parrotX = Math.ceil(view.x);
            const parrotY = Math.ceil(view.y);
            const startX = (parrotX - view.x) * view.interval;
            const startY = (parrotY - view.y) * view.interval;
            try {
                // thin lines
                ctx.beginPath();
                ctx.strokeStyle = '#00000015'; // Сделала чуть прозрачнее для 2.5мм
                let currentParrot = parrotX;
                for (let x = startX; x < canvas.width; x += view.interval) {
                    if (currentParrot % BOLD_EACH) {
                        const ax = adjustCtx(x);
                        ctx.moveTo(ax, 0);
                        ctx.lineTo(ax, canvas.height);
                    }
                    currentParrot++;
                }
                currentParrot = parrotY;
                for (let y = startY; y < canvas.height; y += view.interval) {
                    if (currentParrot % BOLD_EACH) {
                        const ay = adjustCtx(y);
                        ctx.moveTo(0, ay);
                        ctx.lineTo(canvas.width, ay);
                    }
                    currentParrot++;

                }
                ctx.stroke();

                // thick lines
                ctx.beginPath();
                ctx.strokeStyle = '#00000035'; // Сделала чуть прозрачнее для 2.5мм
                currentParrot = parrotX;
                for (let x = startX; x < canvas.width; x += view.interval) {
                    if (!(currentParrot % BOLD_EACH)) {
                        const ax = adjustCtx(x);
                        ctx.moveTo(ax, 0);
                        ctx.lineTo(ax, canvas.height);
                    }
                    currentParrot++;
                }
                currentParrot = parrotY;
                for (let y = startY; y < canvas.height; y += view.interval) {
                    if (!(currentParrot % BOLD_EACH)) {
                        const ay = adjustCtx(y);
                        ctx.moveTo(0, ay);
                        ctx.lineTo(canvas.width, ay);
                    }
                    currentParrot++;

                }
                ctx.stroke();


            } finally {
                ctx.restore();
            }
        }
        const drawWires = () => {

            const tconn = new Set();
            ctx.beginPath();
            Object.values(schemaElements.wires).forEach(wire => {// each element on schematic
                // console.log(prettify(wire, 1));
                // for T-connectors store circles positions
                if (wire.source.type === ObjectType.TCONN) { tconn.add(1); }
                if (wire.target.type === ObjectType.TCONN) { tconn.add(1); }



                ctx.strokeStyle = 'black';
                wire.path.forEach((pt, i) => {
                    let screenPos = parrotsToScreen(pt);
                    screenPos = adjustPoint(screenPos);
                    if (i === 0) {
                        ctx.moveTo(...screenPos);
                    } else {
                        ctx.lineTo(...screenPos);
                    }

                });


            });
            ctx.stroke();

        };


        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // background grid
        drawGrid();

        // elementes
        Object.values(schemaElements.elements).forEach(elem => {// each element on schematic
            const libElement = libElements[elem.typeId];
            if (libElement) {


                let drawColor = DrawColor.NONE;

                if (hovered.type === ObjectType.ELEMENT && elem.id === hovered.elementId)
                    drawColor = DrawColor.HOVERED;
                if (selected.type === ObjectType.ELEMENT && elem.id === selected.elementId)
                    drawColor = DrawColor.SELECTED;


                const toDraw = {
                    ...libElement,
                    pos: parrotsToScreen(elem.pos),
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

        // wires
        drawWires();


        if (activeRoute) {
            ctx.beginPath();
            try {
                activeRoute.forEach((pt, i) => {
                    const screenPt = parrotsToScreen(pt);
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
        // Рисуем сетку А*, если мы в режиме роутинга
        if (dragMode.current === DragModeType.ROUTING && aStarRef.current) { drawGridDebug(ctx, aStarRef.current, parrotsToScreen); }

        // if 
        if (hovered.type === ObjectType.PIN) {
            let pinCoords = pinToCoords(hovered);
            pinCoords = parrotsToScreen(pinCoords);


            ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
            ctx.beginPath();
            ctx.arc(...pinCoords, 5, 0, 2 * Math.PI);
            ctx.fill();
        }








    }, [libElements, schemaElements, hovered, selected, view, activeRoute]);
    const drawRef = useRef(drawAll);
    useEffect(() => { drawRef.current = drawAll; }, [drawAll]);

    useEffect(() => {// ResizeObserver
        drawRef.current();
    }, [drawAll]);
    useEffect(() => {// update canvas size
        dragMode.current = DragModeType.NONE;
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
            if (selected.type !== ObjectType.ELEMENT) return;
            const elements = schemaRef.current.elements;
            const elem = elements[selected.elementId];
            const newRotate = reset ? 0 : (elem.rotate + 1) % 4;
            const updatedElem = { ...elem, rotate: newRotate };
            onElemChanged(updatedElem);
        };



        const handleKeyDown = (event) => {
            switch (event.code) {
                case 'KeyQ': {
                    /*   const s = { type: 'PIN', elementId: 1770957831203, pinIdx: 'PIN1', pinCoords: Array(2) };
                       const g = { type: 'PIN', elementId: 1770957832868, pinIdx: 'PIN2', pinCoords: Array(2) };
                       connect_wire(s, g);
                       */

                    break;
                }
                case 'KeyR': rotateElement(false); break;
                case 'KeyT': rotateElement(true); break;
                case 'Delete': {
                    if (dragMode.current === DragModeType.NONE && selectedRef.current.type === ObjectType.ELEMENT) {
                        selectedChanged({ type: ObjectType.NONE });
                        onElemDeleted(selectedRef.current.elementId);
                    }
                } break;

                case 'Digit1':
                    //       console.log(prettify(aStarRef.current, 1)); break;
                    console.log(prettify_v2(aStarRef.current, 0)); break;
                case 'Escape':
                    if (dragMode.current === DragModeType.ROUTING) {
                        dragMode.current = DragModeType.NONE;
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
            const newZoomIndex = clamp(prev.zoomIndex + wheel_dir, 0, zoomLevels.length - 1);
            const newZoom = zoomLevels[newZoomIndex];
            const newInterval = newZoom * GRID_SIZE;

            const new_view = {
                zoomIndex: newZoomIndex,
                zoom: newZoom,
                interval: newInterval,
                x: prev.x + (mousePos.x / prev.interval) - (mousePos.x / newInterval),
                y: prev.y + (mousePos.y / prev.interval) - (mousePos.y / newInterval)

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
        let insertPos = screenToParrots(e.clientX, e.clientY);
        insertPos = roundPoint(insertPos);
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
            pos: insertPos,
            rotate: 0,
            typeIndex: newTypeIndex
        };

        onElemChanged(newElement, true);
    };
    // DRAG OVER --------------------------------------------------------
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const getPinCoords = (obj) => {
        const elem = schemaRef.current.elements[obj.elementId];
        if (!elem) return null;
        const lib = libElements[elem.typeId];
        if (!lib) return null;

        let pinCoords = lib.pins[elem.rotate][obj.pinIdx];
        pinCoords = addPoint(elem.pos, pinCoords);
        return pinCoords;

    }

    const findPinAt = useCallback((checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            if (libElement) {
                for (const [pinName, pinValue] of Object.entries(libElement.pins[elem.rotate])) {
                    const pinCoords = addPoint(pinValue, elem.pos);
                    const parrotDist = pointsDistance(pinCoords, checkPoint);
                    if (parrotDist <= 0.5) {
                        return {
                            elementId: elem.id,
                            pinIdx: pinName,
                            // pinCoords: pinCoords
                        };
                    }
                }
            }
        }
        return null;
    }, [libElements, schemaElements]);
    const findElemAt = useCallback((checkPoint) => {
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            if (libElement) {
                const elemRect = transformRect(libElement.bounds[elem.rotate], elem.pos);
                if (ptInRect(elemRect, checkPoint)) {
                    return { elementId: elem.id };
                }
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
        return { type: ObjectType.NONE };

    }, [findPinAt, findElemAt]);

    const connect_wire = (start, target) => {
        console.log(start);
        console.log(target);

        // get integer IDs
        const existingIDs = Object.keys(schemaRef.current.wires).map(v => +v);
        let newID = 0;
        while (existingIDs.includes(newID)) {
            newID++;
        };

        if (start.type === ObjectType.WIRE || target.type === ObjectType.WIRE) { // one of ends are WIRE



        } else { // PIN to PIN connection
            const newWire = {
                id: newID,
                source: start,
                target: target,
                path: activeRoute
            }
            onWireChanged(newWire, true);

        }


    }

    // ----------------------------------------         MOUSE DOWN
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const handleMouseDown = useCallback((e) => {
        // return;
        if (e.button !== DRAG_BUTTON) return;
        const pt = screenToParrots(e.clientX, e.clientY);
        //const obj = { type: ObjectType.NONE }
        const obj = getObjectUnderCursor(pt);


        switch (dragMode.current) {


            case DragModeType.ROUTING: {
                switch (obj.type) {

                    case ObjectType.PIN:
                    case ObjectType.WIRE: {
                        connect_wire(selected, obj);
                        dragMode.current = DragModeType.NONE;

                        break;
                    }


                }
                break;
            }
            case DragModeType.NONE: {
                selectedChanged(obj);
                switch (obj.type) {
                    case ObjectType.ELEMENT:
                        {
                            dragMode.current = DragModeType.ELEMENT;
                            const elem = schemaRef.current.elements[obj.elementId];
                            // Запоминаем стартовую позицию мыши и элемента
                            lastPos.current = {
                                startX: e.clientX,
                                startY: e.clientY,
                                elemStartX: elem.pos[0],
                                elemStartY: elem.pos[1]
                            }; break;
                        }

                    case ObjectType.PIN: {
                        const pinCoords = getPinCoords(obj);
                        const resultInitAStar = initAStar(pinCoords);
                        if (resultInitAStar) dragMode.current = DragModeType.ROUTING;
                        // lastPos.current = { x: e.clientX, y: e.clientY };
                        break;
                    };

                    case ObjectType.NONE: {
                        dragMode.current = DragModeType.SCROLL;
                        // Запоминаем стартовую позицию мыши и камеры
                        lastPos.current = {
                            startX: e.clientX,
                            startY: e.clientY,
                            parrotStartX: viewRef.current.x,
                            parrotStartY: viewRef.current.y
                        };
                        break;
                    };

                };
                break;
            }
        }
    }, [screenToParrots, getObjectUnderCursor, selectedChanged, initAStar, activeRoute, selected]);



    // ----------------------------------------         MOUSE MOVE
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const handleMouseMove = (e) => {

        const pt = screenToParrots(e.clientX, e.clientY);
        if (dragMode.current === DragModeType.NONE) {
            const obj = getObjectUnderCursor(pt);
            hoveredChanged(obj);
        }

        // DEBUG
        const canvasRect = canvasRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top });
        setParrotsPos(roundPoint(pt));
        // DEBUG END

        const { startX, startY } = lastPos.current;
        const { interval, zoom } = viewRef.current;
        switch (dragMode.current) {
            case DragModeType.SCROLL: {
                const { parrotStartX, parrotStartY } = lastPos.current;
                viewRef.current.x = parrotStartX - (e.clientX - startX) / interval;
                viewRef.current.y = parrotStartY - (e.clientY - startY) / interval;
                setView({ ...viewRef.current });
            } break;

            case DragModeType.ELEMENT: {
                const { elemStartX, elemStartY, startX, startY } = lastPos.current;
                const { interval } = viewRef.current;
                const id = selectedRef.current.elementId;
                const newElem = { ...schemaRef.current.elements[id] };

                const dx = (e.clientX - startX) / interval;
                const dy = (e.clientY - startY) / interval;
                newElem.pos = [Math.round(elemStartX + dx), Math.round(elemStartY + dy)];
                /*    newElem.pos = [
                        elemStartX + (e.clientX - startX) / zoom,
                        elemStartY + (e.clientY - startY) / zoom
                    ];*/
                onElemChanged(newElem, false);
                break;
            }

            case DragModeType.ROUTING: {
                const roundedTarget = roundPoint(pt);
                routeAStar(roundedTarget);
                break;
            }
        }
    };

    const handleMouseUp = (e) => {

        if (e.button !== DRAG_BUTTON) return;
        if (dragMode.current !== DragModeType.ROUTING) {
            dragMode.current = DragModeType.NONE;
        }
    };


    return (
        <React.Fragment>
            {`zIdx:${view.zoomIndex} zVal:${view.zoom} | V: [${view.x.toFixed(2)}, ${view.y.toFixed(2)}] | Mouse: [${mousePos.x.toFixed(2)}, ${mousePos.y.toFixed(2)}] | Parrots: [${parrotsPos[0]}, ${parrotsPos[1]}]`}<br />
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
                    border: '0px',
                    background: '#fff',
                    // cursor: 'crosshair'
                }}
            />
        </React.Fragment>

    );
});


SchemaCanvas.displayName = 'SchemaCanvas';
export default SchemaCanvas;
