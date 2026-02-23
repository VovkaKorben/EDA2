import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

import { ObjectType, DragModeType, DrawColor } from '../helpers/utils.js';
import { drawElement, drawPins, drawName, drawWire, adjustPoint, drawGridDebug, adjustCtx, GRID_SIZE, dpr } from '../helpers/draw.js';
// import { dpr } from '../helpers/dpr.js';
import {

    _toFixed,
    clamp,
    add,
    addPoint, pointsDistance, transformRect, ptInRect, roundPoint, isPointEqual
} from '../helpers/geo.js';
import { prettify, prettify_v2, pprint } from '../helpers/debug.js';
import { prepareAStarGrid, parrotsToFlat, doAStar, collapseRoute, flatToParrots, expandPath, splitPath, mergePaths } from '../helpers/astar.js';
import { Rect, Point } from '../helpers/rect.js';
const GRID_BOLD_EACH = 10;
const SELECT_TOLERANCE = 0.5;
const zoomLevels = [1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32];
const _initZoom = 1;
const DEFAULT_VIEW = {
    zoomIndex: _initZoom,
    zoom: zoomLevels[_initZoom],
    pos: { x: 0, y: 0 },
    interval: GRID_SIZE * zoomLevels[_initZoom]
};

const DRAG_BUTTON = 0;


const SchemaCanvas = forwardRef(({
    libElements, schemaElements,

    hovered, selected,
    hoveredChanged, selectedChanged,

    onElemChanged, onElemDeleted,
    onWiresChanged
}, ref) => {

    const canvasRef = useRef(null);
    const dragMode = useRef(DragModeType.NONE);


    const schemaRef = useRef(schemaElements);
    const selectedRef = useRef(selected);
    const [view, setView] = useState(() => {
        const saved = localStorage.getItem('view');
        return saved ? JSON.parse(saved) : DEFAULT_VIEW;
    });
    const viewRef = useRef(view);
    const lastPos = useRef(null);


    useEffect(() => { schemaRef.current = schemaElements; }, [schemaElements]);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { localStorage.setItem('view', JSON.stringify(view)); }, [view]);

    useEffect(() => { viewRef.current = view; }, [view]);
    useImperativeHandle(ref, () => ({ resetView: () => { setView(DEFAULT_VIEW); } }));



    // debug
    const [mousePos, setMousePos] = useState([0, 0])
    const [parrotsPos, setParrotsPos] = useState([0, 0])




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
            const startIdx = parrotsToFlat(aStarRef.current, startCoords);
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
        const goalIdx = parrotsToFlat(aStarRef.current, goalCoords);

        // check goal is really changed
        if (aStarRef.current.goalIdx === goalIdx) return;
        aStarRef.current.goalIdx = goalIdx;

        // calc flat-indexes
        const indexRoute = doAStar(aStarRef.current);
        // console.log(prettify(indexRoute, 0));

        // convert flat-indexes to global-coords
        let simpleRoute = flatToParrots(aStarRef.current, indexRoute);
        simpleRoute = collapseRoute(simpleRoute);


        // console.log(prettify(coordsRoute, 0));
        setActiveRoute(simpleRoute);

    }


    const screenToParrots = useCallback((screenX, screenY) => {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const { pos, interval } = viewRef.current;
        const parrotX = (screenX - canvasRect.left) / interval + pos.x;
        const parrotY = (screenY - canvasRect.top) / interval + pos.y;
        return [parrotX, parrotY];
    }, []);
    const parrotsToScreen = (parrots) => {

        //const [px, py] = parrots;
        const { pos, interval } = viewRef.current;
        const screenX = (parrots.x - pos.x) * interval;
        const screenY = (parrots.y - pos.y) * interval;
        return [screenX, screenY];
    };


    // ----------------------------------------         SELECTION
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const getPinCoords = useCallback((obj) => {
        const elem = schemaRef.current.elements[obj.elementId];
        if (!elem) return null;
        const lib = libElements[elem.typeId];
        if (!lib) return null;

        let pinCoords = lib.pins[elem.rotate][obj.pinIdx];
        pinCoords = addPoint(elem.pos, pinCoords);
        return pinCoords;

    }, [libElements]);

    const findPinAt = useCallback((checkPoint) => {
        const checkRect = new Rect(checkPoint);
        checkRect.expand(SELECT_TOLERANCE);
        for (const elem of Object.values(schemaElements.elements)) {
            const libElement = libElements[elem.typeId];
            if (libElement) {
                for (const [pinName, pinValue] of Object.entries(libElement.pins[elem.rotate])) {
                    const pinCoords = new Point(pinValue);
                    pinCoords.move(elem.pos);
                    if (pinCoords.inRect(checkRect)) {
                        return {
                            elementId: elem.elementId,
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
                let elemRect = [...libElement.bounds[elem.rotate]];
                elemRect = add(elemRect, elem.pos);
                // const elemRect = transformRect(libElement.bounds[elem.rotate], elem.pos);
                if (checkPoint.inRect(elemRect)) {
                    return { elementId: elem.elementId };
                }
            }
        }
        return null;
    }, [libElements, schemaElements]);

    const findWireAt = useCallback((checkPoint) => {
        const [mx, my] = [checkPoint.x, checkPoint.y];
        for (const wire of Object.values(schemaElements.wires)) {
            for (let i = 0; i < wire.path.length - 1; i++) {
                const [x1, y1] = wire.path[i];
                const [x2, y2] = wire.path[i + 1];
                // Позиция мыши в попугаях

                // Если это горизонтальный сегмент (y одинаковый)
                if (y1 === y2) {
                    if (Math.abs(my - y1) < SELECT_TOLERANCE &&
                        mx >= Math.min(x1, x2) - SELECT_TOLERANCE &&
                        mx <= Math.max(x1, x2) + SELECT_TOLERANCE) {
                        return { type: ObjectType.WIRE, wireId: wire.wireId, pos: [Math.round(mx), y1] };
                    }
                }
                // Если это вертикальный сегмент (x одинаковый)
                else if (x1 === x2) {
                    if (Math.abs(mx - x1) < SELECT_TOLERANCE &&
                        my >= Math.min(y1, y2) - SELECT_TOLERANCE &&
                        my <= Math.max(y1, y2) + SELECT_TOLERANCE) {
                        return { type: ObjectType.WIRE, wireId: wire.wireId, pos: [x1, Math.round(my)] };
                    }
                }
            }
        }
        return null;
    }, [schemaElements]);



    const getObjectUnderCursor = useCallback((pt) => {
        const pinCheck = findPinAt(pt);
        if (pinCheck !== null)
            return { type: ObjectType.PIN, ...pinCheck };
        const elemCheck = findElemAt(pt);
        if (elemCheck !== null)
            return { type: ObjectType.ELEMENT, ...elemCheck };
        const wireCheck = findWireAt(pt);
        if (wireCheck !== null)
            return { type: ObjectType.WIRE, ...wireCheck };
        //{ type: 'WIRE', wireId: 505 }
        return { type: ObjectType.NONE };

    }, [findPinAt, findElemAt, findWireAt]);


    // ----------------------------------------         WIRES
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const getNewWireId = () => {
        const existingIDs = Object.keys(schemaRef.current.wires).map(v => +v);
        let newID = 0;
        while (existingIDs.includes(newID)) {
            newID++;
        };
        return newID;

    }

    const deleteWire = useCallback((wireId) => {
        // проверяем сторону провода
        const checkConn = (conn) => {
            // если на конце был пин элемента - то выходим, т.к. на пин может приходить только 1 провод
            if (conn.type === ObjectType.PIN) return;

            // проверяем, были ли провода, с таким же концом
            const sameConn = [];
            Object.values(schemaRef.current.wires).forEach(wireToCheck => {
                if (wireToCheck.source.type === ObjectType.TCONN && isPointEqual(conn.pos, wireToCheck.source.pos)) {
                    sameConn.push({
                        wireId: wireToCheck.wireId,
                        conn: wireToCheck.target
                    });
                }
                if (wireToCheck.target.type === ObjectType.TCONN && isPointEqual(conn.pos, wireToCheck.target.pos)) {
                    sameConn.push({
                        wireId: wireToCheck.wireId,
                        conn: wireToCheck.source
                    });
                }

            });
            console.log(`sameConn ${prettify(sameConn, 1)}`);

            // create new wire if in connection point was exact 2 wires
            if (sameConn.length !== 2) return;


            // calculate merged paths for both wires
            let path = [];
            sameConn.forEach(w => path.push(schemaRef.current.wires[w.wireId].path));
            path = mergePaths(path);
            console.log(`mergePaths ${prettify(path, 1)}`);
            path = collapseRoute(path);
            console.log(`collapseRoute ${prettify(path, 1)}`);

            // clear previous wires
            sameConn.forEach(w => delete schemaRef.current.wires[w.wireId]);

            // create compound wire
            const newWireId = getNewWireId();
            const newWire = {
                wireId: newWireId,
                source: sameConn[0].conn,
                target: sameConn[1].conn,
                path: path
            }
            schemaRef.current.wires[newWireId] = newWire;

            // schemaRef.current.wires
            // console.log(`mergePaths ${prettify(path, 1)}`);

        }

        const wire = { ...schemaRef.current.wires[wireId] };
        if (!wire) return;
        // удаляем провод сразу, чтобы он не участовал
        delete schemaRef.current.wires[wireId];

        // для обоих концов: если у нас т-конн
        // 1. запоминаем в массиве все айди проводов с таким же концом
        // 2. если у нас там 3 провода - ничего не трогаем (т.е. до этого было соединение из 4 проводов)
        // 3. если 2 провода - находим их другие края, запоминаем
        // 4. удаляем эти два провода, делаем один новый с краяим из п.3
        // для обоих концов: у нас ОБА не т-конн
        // 1. просто удаляем провод
        checkConn(wire.source);
        checkConn(wire.target);

        //if (wireId in schemaRef.current.wires)        onElemDeleted(selectedRef.current.elementId);
        selectedChanged({ type: ObjectType.NONE });
        // selectedChanged(null);
        onWiresChanged({ ...schemaRef.current.wires });

    }, [selectedChanged, onWiresChanged]);

    const createWire = useCallback((source, target) => {
        // console.log(source);        console.log(target);
        // const isPoint


        let wireId, newWire;
        if (target.type === ObjectType.WIRE) { // target are WIRE, break it with T-Conn

            pprint(target)
            //const otherSide = source.type === ObjectType.WIRE ?

            const removedWire = { ...schemaRef.current.wires[target.wireId] } //запоминаем текущий сегмент
            pprint(removedWire)
            delete schemaRef.current.wires[target.wireId]; //удаляем его


            // режем старый провод по соединению
            // восстановили все точки, порезали по ключевой и сделали 2 пути
            let removedPath = removedWire.path;
            removedPath = expandPath(removedPath);
            const oldPaths = splitPath(removedPath, target.pos);
            const oldPath1 = collapseRoute(oldPaths[0]); // source -> tconn
            const oldPath2 = collapseRoute(oldPaths[1]); // target -> tconn


            // добавляем ТРИ новых сегмента
            const targetTCONN = {
                type: ObjectType.TCONN,
                pos: target.pos
            }
            // - от старой точки1 до новой на проводе
            wireId = getNewWireId();
            const removedSegment1 = {
                wireId: wireId,
                source: removedWire.source,
                target: targetTCONN,
                path: oldPath1
            }
            schemaRef.current.wires[wireId] = removedSegment1;
            // - от старой точки2 до новой на проводе
            wireId = getNewWireId();
            const removedSegment2 = {
                wireId: wireId,
                source: removedWire.target,
                target: targetTCONN,
                path: oldPath2
            }
            schemaRef.current.wires[wireId] = removedSegment2;

            // - и собсно новый провод
            wireId = getNewWireId();
            newWire = {
                wireId: wireId,
                source: source,
                target: targetTCONN,
                path: activeRoute
            }
            schemaRef.current.wires[wireId] = newWire;



        } else { // PIN/TCONN to PIN/TCONN connection
            wireId = getNewWireId();
            newWire = {
                wireId: wireId,
                source: source,
                target: target,
                path: activeRoute
            }
            schemaRef.current.wires[wireId] = newWire;

        }
        selectedChanged({
            type: ObjectType.WIRE,
            wireId: newWire.wireId
        });
        onWiresChanged({ ...schemaRef.current.wires });

    }, [activeRoute, onWiresChanged, selectedChanged]);



    // ----------------------------------------         DRAW
    // -----------------------------------------------------------
    // -----------------------------------------------------------
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


            const parrotX = Math.ceil(view.pos.x);
            const parrotY = Math.ceil(view.pos.y);
            const startX = (parrotX - view.pos.x) * view.interval;
            const startY = (parrotY - view.pos.y) * view.interval;
            try {
                // thin lines
                ctx.beginPath();
                ctx.strokeStyle = '#00000006'; // Сделала чуть прозрачнее для 2.5мм
                let currentParrot = parrotX;
                for (let x = startX; x < canvas.width; x += view.interval) {
                    if (currentParrot % GRID_BOLD_EACH) {
                        const ax = adjustCtx(x);
                        ctx.moveTo(ax, 0);
                        ctx.lineTo(ax, canvas.height);
                    }
                    currentParrot++;
                }
                currentParrot = parrotY;
                for (let y = startY; y < canvas.height; y += view.interval) {
                    if (currentParrot % GRID_BOLD_EACH) {
                        const ay = adjustCtx(y);
                        ctx.moveTo(0, ay);
                        ctx.lineTo(canvas.width, ay);
                    }
                    currentParrot++;

                }
                ctx.stroke();

                // thick lines
                ctx.beginPath();
                ctx.strokeStyle = '#00000015'; // Сделала чуть прозрачнее для 2.5мм
                currentParrot = parrotX;
                for (let x = startX; x < canvas.width; x += view.interval) {
                    if (!(currentParrot % GRID_BOLD_EACH)) {
                        const ax = adjustCtx(x);
                        ctx.moveTo(ax, 0);
                        ctx.lineTo(ax, canvas.height);
                    }
                    currentParrot++;
                }
                currentParrot = parrotY;
                for (let y = startY; y < canvas.height; y += view.interval) {
                    if (!(currentParrot % GRID_BOLD_EACH)) {
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

            // draw outline under hovered
            if (hovered.type === ObjectType.WIRE && dragMode.current !== DragModeType.ROUTING) {
                const wireToHover = schemaElements.wires[hovered.wireId];
                if (wireToHover) {
                    drawWire(ctx, wireToHover.path, 3, DrawColor.HOVERED, parrotsToScreen);
                }


            }

            // t-conn storage
            const tconn = [];

            // iterate wires
            Object.values(schemaElements.wires).forEach(wire => {
                // for T-connectors store circles positions
                if (wire.source.type === ObjectType.TCONN) {
                    if (tconn.findIndex(n => isPointEqual(n, wire.source.pos)) === -1)
                        tconn.push(wire.source.pos);
                }
                if (wire.target.type === ObjectType.TCONN) {
                    if (tconn.findIndex(n => isPointEqual(n, wire.target.pos)) === -1)
                        tconn.push(wire.target.pos);
                }

                const drawColor = (selected?.type === ObjectType.WIRE && wire.wireId === selected.wireId) ?
                    DrawColor.SELECTED : DrawColor.NORMAL;
                drawWire(ctx, wire.path, 1, drawColor, parrotsToScreen);








                // Вывод ID провода для отладки
                /*
                const start = wire.path[0];
                const end = wire.path[wire.path.length - 1];
                const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
                const [tx, ty] = parrotsToScreen(mid);

                ctx.save();
                ctx.fillStyle = 'red';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`W${wire.wireId}`, tx, ty - 5);
                ctx.restore();
            */











            });











            // t-conn circles
            ctx.lineWidth = 1; ctx.fillStyle = DrawColor.NORMAL;
            ctx.beginPath();
            // tconn.forEach(pt => ctx.arc(...parrotsToScreen(pt), 5, 0, 2 * Math.PI));

            tconn.forEach(parrot => {
                let drawPoint = parrotsToScreen(parrot)
                drawPoint = add(drawPoint, [5, 0])
                // drawPoint.move(drawPoint.x + 5, drawPoint.y);
                ctx.arc(...drawPoint, 5, 0, 2 * Math.PI);
            });


            ctx.fill();

        };
        const drawElements = () => {

            // draw outline under hovered
            if (hovered.type === ObjectType.ELEMENT && dragMode.current !== DragModeType.ROUTING) {
                const elem = schemaElements.elements[hovered.elementId];
                if (!elem) return;
                const lib = libElements[elem.typeId];
                if (!lib) return;
                //const drawPoint = new Rect(elem.pos);                drawPoint = 
                const toDraw = {
                    ...lib,
                    pos: parrotsToScreen(elem.pos),
                    zoom: view.zoom,
                    rotate: elem.rotate,
                    typeIndex: elem.typeIndex,
                    color: DrawColor.HOVERED,
                    width: 3
                }
                drawElement(ctx, toDraw);
            }

            Object.values(schemaElements.elements).forEach(elem => {
                const libElement = libElements[elem.typeId];
                if (libElement) {
                    const drawColor = (selected?.type === ObjectType.ELEMENT && selected.elementId === elem.elementId) ?
                        DrawColor.SELECTED : DrawColor.NORMAL

                    const toDraw = {
                        ...libElement,
                        pos: parrotsToScreen(elem.pos),
                        zoom: view.zoom,
                        rotate: elem.rotate,
                        typeIndex: elem.typeIndex,
                        color: drawColor,
                        width: 1
                    };
                    drawElement(ctx, toDraw);
                    drawPins(toDraw, ctx);
                    drawName(toDraw, ctx);
                }
            });
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // background grid
        drawGrid();
        drawElements();
        drawWires();





        if (dragMode.current === DragModeType.ROUTING && aStarRef.current) {
            // Рисуем сетку А*, если мы в режиме роутинга
            //drawGridDebug(ctx, aStarRef.current, parrotsToScreen);

            // текущий путь
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

            // кружок прилипания
            if (hovered.type === ObjectType.WIRE) {
                const snapCoords = parrotsToScreen(hovered.pos); // hovered.pos уже содержит точку стыка из findWireAt

                ctx.lineWidth = 1;
                ctx.fillStyle = DrawColor.HOVERED;
                ctx.beginPath();
                ctx.arc(...snapCoords, 5, 0, 2 * Math.PI); // Рисуем такой же кружок, как у пина
                ctx.fill();
            }
        }

        // if 
        if (hovered.type === ObjectType.PIN) {
            let pinCoords = pinToCoords(hovered);
            pinCoords = parrotsToScreen(pinCoords);


            ctx.lineWidth = 1; ctx.fillStyle = DrawColor.HOVERED;
            ctx.beginPath();
            ctx.arc(...pinCoords, 5, 0, 2 * Math.PI);
            ctx.fill();
        }








    }, [libElements, schemaElements, hovered, view, activeRoute, selected]);
    const drawRef = useRef(drawAll);
    useEffect(() => {
        // Обновляем реф для ResizeObserver (он всегда будет актуальным)
        drawRef.current = drawAll;

        // Вызываем отрисовку напрямую
        // requestAnimationFrame гарантирует, что DOM готов
        const frameId = requestAnimationFrame(() => {
            drawAll();
        });

        return () => cancelAnimationFrame(frameId);
    }, [drawAll]);
    // ResizeObserver


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


    // ----------------------------------------        KEYBOARD
    // -----------------------------------------------------------
    // -----------------------------------------------------------
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
                    if (dragMode.current === DragModeType.NONE) {
                        switch (selectedRef.current.type) {
                            case ObjectType.ELEMENT:
                                selectedChanged({ type: ObjectType.NONE });
                                onElemDeleted(selectedRef.current.elementId);
                                break;
                            case ObjectType.WIRE:
                                deleteWire(selectedRef.current.wireId);
                                break;
                        }
                    }

                }
                    break;

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
    }, [onElemChanged, onElemDeleted, selectedChanged, deleteWire]);


    // WHEEL -------------------------------------------------------------------
    const handleWheel = (e) => {
        const canvasRect = e.currentTarget.getBoundingClientRect()
        const mousePos = new Point(e.clientX, e.clientY).subtract(canvasRect.left, canvasRect.top);

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

    const getNewElementId = () => {
        const existingIDs = Object.keys(schemaRef.current.elements).map(v => +v);
        let newID = 0;
        while (existingIDs.includes(newID)) {
            newID++;
        };
        return newID;

    }

    // DROP ------------------------------------------------
    const handleDrop = (e) => {
        e.preventDefault();
        // convert drag to object
        const data = JSON.parse(e.dataTransfer.getData('compData'));

        // calculate insertion position
        const insertPos = screenToParrots(e.clientX, e.clientY);
        insertPos.round();
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
            elementId: getNewElementId(),
            typeId: data.typeId,
            pos: insertPos,
            rotate: 0,
            typeIndex: newTypeIndex,
            packageId: null
        };

        onElemChanged(newElement, true);
    };
    // DRAG OVER --------------------------------------------------------
    const handleDragOver = (e) => {
        e.preventDefault();
    };
    // ----------------------------------------         MOUSE DOWN
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const handleMouseDown = useCallback((e) => {
        // return;
        if (e.button !== DRAG_BUTTON) return;
        const parrotPoint = screenToParrots(e.clientX, e.clientY);
        //const obj = { type: ObjectType.NONE }
        const obj = getObjectUnderCursor(parrotPoint);


        switch (dragMode.current) {


            case DragModeType.ROUTING: {
                switch (obj.type) {

                    case ObjectType.PIN:
                    case ObjectType.WIRE: {
                        createWire(selected, obj);
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
                                start: new Point(e.clientX, e.clientY),
                                elemStart: new Point(elem.pos)
                            }; break;
                        }

                    case ObjectType.PIN: {
                        const pinCoords = getPinCoords(obj);
                        const resultInitAStar = initAStar(pinCoords);
                        if (resultInitAStar) dragMode.current = DragModeType.ROUTING;
                        break;
                    };

                    case ObjectType.NONE: {
                        dragMode.current = DragModeType.SCROLL;
                        // Запоминаем стартовую позицию мыши и камеры
                        lastPos.current = {
                            start: new Point(e.clientX, e.clientY),
                            parrotStart: new Point(viewRef.current.pos)
                        };
                        break;
                    };

                };
                break;
            }
        }
    }, [screenToParrots, getObjectUnderCursor, selectedChanged, initAStar, selected, createWire, getPinCoords]);


    // ----------------------------------------         MOUSE MOVE
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const handleMouseMove = (e) => {

        const parrot = screenToParrots(e.clientX, e.clientY);
        const obj = getObjectUnderCursor(parrot);
        hoveredChanged(obj);
        //if(dragMode.current === DragModeType.NONE) { return;        }

        // DEBUG
        const canvasRect = canvasRef.current.getBoundingClientRect();
        setMousePos(() => {
            const pt = new Point(e.clientX, e.clientY);
            pt.move(- canvasRect.left, - canvasRect.top);
            return pt;
            //       { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top }
        });

        setParrotsPos(() => {
            const pt = new Point(parrot);
            pt.round();
            return pt;
        });

        // DEBUG END
        if (lastPos.current) {
            const { start } = lastPos.current;
            const { interval } = viewRef.current;
            switch (dragMode.current) {
                case DragModeType.SCROLL: {
                    const parrotStart = new Point(lastPos.current.parrotStart);
                    const pt = new Point(e.clientX, e.clientY);
                    pt.subtract(start);
                    pt.multiply(1 / interval);
                    parrotStart.subtract(pt);
                    viewRef.current.pos = new Point(parrotStart);
                    //viewRef.current.x = parrotStartX - (e.clientX - startX) / interval;
                    //viewRef.current.y = parrotStartY - (e.clientY - startY) / interval;
                    setView({ ...viewRef.current });
                } break;

                case DragModeType.ELEMENT: {
                    const { elemStartX, elemStartY, startX, startY } = lastPos.current;
                    const { interval } = viewRef.current;
                    const elementId = selectedRef.current.elementId;
                    const newElem = { ...schemaRef.current.elements[elementId] };

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
                    // const roundedTarget = roundPoint(pt);
                    const targetPos = (obj.type === ObjectType.WIRE) ? obj.pos : roundPoint(parrot);
                    routeAStar(targetPos);
                    break;
                }
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
            <div className='dbg-fixed'>
                {`zIdx:${view.zoomIndex} zVal:${view.zoom}`}                <br />
                {`V: ${_toFixed(view.pos)}`} <br />

                {`Mouse: ${_toFixed(mousePos)}`} <br />
                {`Parrots: ${_toFixed(parrotsPos, 0)}`}
            </div>
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
                    width: '100%',
                    height: '100%',
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
