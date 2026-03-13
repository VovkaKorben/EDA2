import React, { useRef, useState, useEffect, useCallback, } from 'react';

import { dpr, drawTurtle } from '../helpers/draw.js';
import { prettify } from '../helpers/debug.js';
import { doRoute, PCB_UNIT } from '../helpers/route.js';
import { ErrorCodes, pcbColor, LayerTypes } from '../helpers/utils.js';
import {
    clamp, adjustCtx, multiply, rotate, normalize, adjustPoint,
    getRectWidth, getRectHeight, add, sub, expand, pointToString,
    divide
} from '../helpers/geo.js';
import '../css/route.css'
// import { Rect, Point } from '../helpers/rect.js';
const zoomLevels = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 16, 32, 50, 75, 100, 200];
const defaultZoom = 10
const pixInMm = 96 / 25.4
const pcbMargin = 1
const RouteShow = ({ libElements, schemaElements, layers, onError }) => {

    const [view, setView] = useState({
        pos: [-2, -2],
        zoomIndex: defaultZoom,
        zoomValue: zoomLevels[defaultZoom]
    })
    const canvasRef = useRef(null);
    const [routeData, setRouteData] = useState(null);

    const [mouseDown, setMouseDown] = useState(false);
    const [mousePos, setMousePos] = useState(null);
    const [fontsLoaded, setFontsLoaded] = useState(false);

    // WHEEL -------------------------------------------------------------------
    const handleWheel = (e) => {
        const canvasRect = e.currentTarget.getBoundingClientRect()
        let mousePos = [e.clientX, e.clientY]
        mousePos = add(mousePos, [-canvasRect.left, -canvasRect.top]);

        const wheel_dir = Math.sign(e.deltaY);
        setView(prev => {
            const newZoomIndex = clamp(prev.zoomIndex + wheel_dir, 0, zoomLevels.length - 1);
            if (newZoomIndex === prev.zoomIndex) return prev;

            const newZoomValue = zoomLevels[newZoomIndex];
            // Текущий и новый масштаб в пикселях на единицу координат
            const oldScale = PCB_UNIT * prev.zoomValue;
            const newScale = PCB_UNIT * newZoomValue;

            // Находим смещение: (координата мыши / масштаб_до) - (координата мыши / масштаб_после)
            const deltaX = (mousePos[0] / oldScale) - (mousePos[0] / newScale);
            const deltaY = (mousePos[1] / oldScale) - (mousePos[1] / newScale);

            return {
                ...prev,
                zoomIndex: newZoomIndex,
                zoomValue: newZoomValue,
                pos: [
                    prev.pos[0] + deltaX,
                    prev.pos[1] + deltaY
                ]
            };
        });
    };
    const handleMouseDown = (e) => {
        setMouseDown(true)
        setMousePos([e.clientX, e.clientY]);
    }
    const handleMouseMove = (e) => {
        if (!mouseDown) return

        const newMousePos = [e.clientX, e.clientY]
        let pixelDelta = sub(mousePos, newMousePos)

        setView(prev => {
            const zoom = PCB_UNIT * view.zoomValue
            const worldDelta = divide(pixelDelta, zoom);


            return {
                ...prev,
                pos: add(prev.pos, worldDelta)
            }
        })
        setMousePos(newMousePos)
    }
    const handleMouseUp = () => {
        setMouseDown(false)
    }
    // font handler
    useEffect(() => {
        const checkAndLoadFont = async () => {
            try {
                // Принудительно просим браузер загрузить шрифт нужного размера
                await document.fonts.load('12px pcb');

                // Дополнительно ждем полной готовности всех ресурсов
                await document.fonts.ready;

                if (document.fonts.check('12px pcb')) {
                    setFontsLoaded(true);
                }
            } catch (err) {
                console.error('Font loading failed:', err);
            }
        };

        checkAndLoadFont();

        // Резервный механизм на случай динамической подгрузки
        const handleLayout = () => {
            if (document.fonts.check('12px pcb')) {
                setFontsLoaded(true);
                document.fonts.removeEventListener('loadingdone', handleLayout);
            }
        };
        document.fonts.addEventListener('loadingdone', handleLayout);

        return () => document.fonts.removeEventListener('loadingdone', handleLayout);
    }, []);

    // DRAW -------------------------------------------------------------------
    const drawRoute = useCallback(() => {
        // if (!fontsLoaded) return;
        try {


            const drawCross = ({ pos, size, color, width }) => {
                ctx.save()
                try {
                    ctx.beginPath()
                    ctx.lineWidth = width
                    ctx.strokeStyle = color
                    const sz2 = Math.round(size / 2)

                    pos = adjustPoint(pos)
                    ctx.translate(...pos)
                    ctx.moveTo(-sz2, 0)
                    ctx.lineTo(sz2, 0)
                    ctx.moveTo(0, -sz2)
                    ctx.lineTo(0, sz2)
                    ctx.stroke()
                }
                finally {
                    ctx.restore()
                }


            }

            const adjustRect = (rct) => {

                const adj = [
                    adjustCtx(rct[0]),
                    adjustCtx(rct[1]),
                    Math.round(rct[2] - rct[0]),
                    Math.round(rct[3] - rct[1]),
                ]
                return adj;
            }



            const drawDebugGrid = () => {//
                ctx.strokeStyle = pcbColor.DEBUG
                const sz = 5


                ctx.save()
                try {
                    ctx.beginPath()
                    for (let y = 0; y <= routeData.pcbSize[1]; y++)
                        for (let x = 0; x <= routeData.pcbSize[0]; x++) {

                            let pt = multiply([x, y], zoom)
                            pt = add(pt, startPt)
                            pt = adjustPoint(pt)
                            let s = add(pt, [-sz / 2, 0])
                            let e = add(pt, [sz / 2, 0])
                            ctx.moveTo(...s)
                            ctx.lineTo(...e)

                            s = add(pt, [0, -sz / 2])
                            e = add(pt, [0, sz / 2])
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
                ctx.strokeStyle = pcbColor.SILK



                routeData.elements.forEach(elem => {
                    let anchor = rotate(elem.anchor, elem.rotateIndex)


                    anchor = multiply(anchor, zoom)
                    anchor = add(anchor, startPt)
                    anchor = adjustPoint(anchor)
                    ctx.save()
                    try {
                        ctx.translate(...anchor)
                        elem.turtle.forEach(prim => {
                            // console.log(prim)
                            drawTurtle(ctx, prim, zoom)
                        })
                        // drawCross({ pos: [0, 0], size: 20, color: '#f00', width: 1 })

                        // 
                    } finally { ctx.restore() }


                })





            }
            const drawText = () => {//
                const textHeight1 = 3 * view.zoomValue;
                const textHeight2 = 1.2 * view.zoomValue;
                const lineHeight = 1.6 * view.zoomValue;

                // console.log('text height: ', textHeight)
                ctx.save()
                try {

                    // ctx.scale(3.78, 3.78);

                    ctx.fillStyle = 'black';
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    const fontName = fontsLoaded ? '"pcb"' : 'sans-serif';
                    routeData.elements.forEach(elem => {

                        let textPos = rotate(elem.textPos, elem.rotateIndex)
                        textPos = add(textPos, elem.anchor)

                        textPos = multiply(textPos, zoom)
                        textPos = add(textPos, startPt)
                        textPos = adjustPoint(textPos)
                        ctx.font = `${textHeight1}px ${fontName}`;
                        ctx.fillText(elem.text, ...textPos);

                        textPos = add(textPos, [0, lineHeight])
                        textPos = adjustPoint(textPos)
                        ctx.font = `${textHeight2}px ${fontName}`;
                        ctx.fillText(elem.packageName, ...textPos);






                    });
                }
                finally {
                    ctx.restore();
                }


            }


            const drawDrills = () => {
                ctx.fillStyle = pcbColor.DRILL
                routeData.pins.forEach(pin => {
                    let { pinPos, anchor, rotateIndex } = pin

                    // calculate pin position in parrots
                    pinPos = rotate(pinPos, rotateIndex)
                    pinPos = add(pinPos, anchor)

                    // calculate parrots to screen
                    pinPos = multiply(pinPos, zoom)
                    pinPos = add(pinPos, startPt)
                    pinPos = adjustPoint(pinPos)

                    // draw two circles
                    ctx.beginPath()

                    ctx.arc(...pinPos, zoom / 9, 0, 2 * Math.PI)
                    ctx.fill()
                })

            }

            const drawPins = () => {

                routeData.pins.forEach(pin => {
                    let { pinPos, anchor, rotateIndex } = pin

                    // calculate pin position in parrots
                    pinPos = rotate(pinPos, rotateIndex)
                    pinPos = add(pinPos, anchor)

                    // calculate parrots to screen
                    pinPos = multiply(pinPos, zoom)
                    pinPos = add(pinPos, startPt)
                    pinPos = adjustPoint(pinPos)

                    // draw two circles
                    ctx.beginPath()
                    ctx.fillStyle = pcbColor.COPPER
                    ctx.arc(...pinPos, zoom / 3, 0, 2 * Math.PI)
                    ctx.fill()

                })

            }
            const drawCopper = () => {
                ctx.strokeStyle = pcbColor.COPPER

                ctx.save()
                try {
                    ctx.beginPath()
                    ctx.lineWidth = zoom / 3;
                    // each network
                    Object.values(routeData.copper).forEach(net => {

                        // each segment
                        net.forEach(segment => {

                            // each point in segment
                            segment.forEach((pt, ptIndex) => {
                                let drawPt = multiply(pt, zoom)
                                drawPt = add(drawPt, startPt)
                                drawPt = adjustPoint(drawPt)
                                if (ptIndex === 0) {
                                    ctx.moveTo(...drawPt)
                                }
                                else {
                                    ctx.lineTo(...drawPt)
                                }
                            })
                        })
                    })
                    ctx.stroke()
                    /*  for (let y = 0; y <= rd.pcbSize[1]; y++)
                          for (let x = 0; x <= rd.pcbSize[0]; x++) {
                 
                              let startPt = multiply([x, y], PCB_UNIT)
                              startPt = multiply(startPt, zoomValue)
                              startPt = adjustPoint(startPt)
                              let s = add(startPt, [-sz / 2, 0])
                              let e = add(startPt, [sz / 2, 0])
                              ctx.moveTo(...s)
                              ctx.lineTo(...e)
                 
                              s = add(startPt, [0, -sz / 2])
                              e = add(startPt, [0, sz / 2])
                              ctx.moveTo(...s)
                              ctx.lineTo(...e)
                 
                 
                          }
                     
                */
                } finally {
                    ctx.restore()

                }

            }
            const drawPcbBound = () => {
                let marginedSize = add(routeData.pcbSize, pcbMargin * 2)
                const pcbRect = [0, 0, ...marginedSize]
                let pcbBoundRect = sub(pcbRect, view.pos)
                pcbBoundRect = multiply(pcbBoundRect, zoom)
                pcbBoundRect = adjustRect(pcbBoundRect);

                ctx.fillStyle = pcbColor.PCB_FILL
                ctx.fillRect(...pcbBoundRect);

                ctx.lineWidth = 1;
                ctx.strokeStyle = pcbColor.PCB_BORDER
                ctx.strokeRect(...pcbBoundRect);
            }

            const drawElementsBound = () => {
                ctx.save()
                try {
                    ctx.strokeStyle = 'rgb(255, 0, 0)'
                    ctx.setLineDash([10, 3]);
                    routeData.elements.forEach(elem => {
                        // console.log(elem.text, prettify(elem.packageBounds, 0))
                        ctx.save()
                        try {


                            let translatePoint = [...elem.anchor]
                            translatePoint = multiply(translatePoint, zoom)
                            translatePoint = add(translatePoint, startPt)
                            translatePoint = adjustPoint(translatePoint)
                            ctx.translate(...translatePoint)



                            let bounds = [...elem.packageBounds]
                            bounds = multiply(bounds, zoom)

                            bounds[2] = Math.round(bounds[2] - bounds[0])
                            bounds[3] = Math.round(bounds[3] - bounds[1])
                            bounds[0] = Math.round(bounds[0])
                            bounds[1] = Math.round(bounds[1])
                            // bounds = rectToDrawable(bounds)

                            ctx.strokeRect(...bounds)
                        } finally {
                            ctx.restore()
                        }
                        //

                    })
                } finally {
                    ctx.restore()
                }

            }

            // prepare and clear canvas
            const canvas = canvasRef.current;
            if (!canvas || !routeData) return;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            // ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = pcbColor.BG
            ctx.rect(0, 0, canvas.width, canvas.height)
            ctx.fill()
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);




            const zoom = PCB_UNIT * view.zoomValue
            let startPt = multiply(view.pos, -1)
            startPt = add(startPt, pcbMargin)
            startPt = multiply(startPt, zoom)

            // prepare layers visibility
            const layerVisible = {}
            Object.keys(LayerTypes).forEach(l => layerVisible[l] = Object.hasOwn(layers, l) ? layers[l] : true)

            // draw PCB bound
            if (layerVisible.BOUND) drawPcbBound()
            if (layerVisible.GRID) drawDebugGrid()
            if (layerVisible.COPPER) {
                drawCopper()
                drawPins()
            }
            if (layerVisible.DRILLING) drawDrills()
            if (layerVisible.ELEMENTS) {
                drawElementsBound()
            }


            if (layerVisible.SILKSCREEN) {
                drawText()
                drawElements()
            }




        } catch (e) {
            console.error(e.message);
            console.error(e.stack);
        }


    }, [routeData, view, layers, fontsLoaded]);

    // initial 
    useEffect(() => {
        const runRouting = async () => {
            onError?.([{ code: ErrorCodes.INFO, message: 'Init trace' }]);

            try {
                const result = await doRoute({ libElements, schemaElements });
                console.log(prettify(result, 2))


                const errors = [...result.errors]
                if (result.success) {
                    const pcbMm = multiply(result.data.pcbSize, PCB_UNIT)
                    errors.push({
                        code: ErrorCodes.INFO,
                        message: `PCB size (mm): ${pointToString(pcbMm, 2)}`
                    })
                    errors.push({
                        code: ErrorCodes.INFO,
                        message: `PCB size (units): ${pointToString(result.data.pcbSize)}`
                    })

                    setRouteData(result.data);
                }
                onError(errors);
            } catch (e) {
                onError?.([
                    { code: ErrorCodes.ERROR, message: `Route critical error: ${e.message}` },
                    { code: ErrorCodes.ERROR, message: `Stack: ${e.stack}` },
                ]);
            }
        };

        if (Object.keys(libElements).length > 0) runRouting();
    }, [libElements, schemaElements, onError]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Функция синхронного обновления размера и отрисовки
        const update = () => {
            const { clientWidth, clientHeight } = canvas;
            // Устанавливаем физический размер буфера
            canvas.width = clientWidth * dpr;
            canvas.height = clientHeight * dpr;
            // Рисуем немедленно
            drawRoute();
        };

        // Следим за изменением размера окна/контейнера
        const ro = new ResizeObserver(update);
        ro.observe(canvas);

        // Рисуем сразу при монтировании или изменении view/routeData
        update();

        return () => ro.disconnect();
    }, [drawRoute]);

    return (
        <React.Fragment>

            <canvas
                ref={canvasRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
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
