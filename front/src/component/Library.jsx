import { useRef, useEffect } from 'react';
// import { drawElement } from '../helpers/geo.js';
import { dpr, drawElement, GRID_SIZE } from '../helpers/draw.js';
// import { dpr } from '../helpers/dpr.js';
import { DrawColor } from '../helpers/utils.js';
import { Rect, Point } from '../helpers/rect.js';
import '../css/Library.css'

const libWidth = 50;
const libHeight = 50;
const elemMargin = 15; // in percent, i.e. for value 5 component take 100 - (2*5) = 90%
// const elemSizeScaled = Math.round(elemSize * dpr);




const LibraryItem = ({ libElem }) => {
    const canvasRef = useRef(null);

    // draw principial
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, libWidth * dpr, libHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const viewWidth = libWidth * (1 - elemMargin / 100 * 2);
        const viewHeight = libHeight * (1 - elemMargin / 100 * 2);
        // get bounds for unrotated
        const elemBounds = libElem.bounds[0];
        const kx = viewWidth / elemBounds.w;
        const ky = viewHeight / elemBounds.h;
        const k = kx > ky ? ky : kx;
        const z = k / GRID_SIZE;

        const toDraw = {
            ...libElem,
            pos: new Point(libWidth / 2, libHeight / 2),

            zoom: z,
            rotate: 0,
            color: DrawColor.NORMAL,
            width: 1
        };

        drawElement(ctx, toDraw);

    }, [libElem]);

    // store elem in drag object
    const handleDragStart = (e) => {
        e.dataTransfer.setData('compData', JSON.stringify(libElem));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            className="library-item"
            style={{ '--element-width': `${libWidth}px`, '--element-height': `${libHeight}px` }}
        >
            <canvas ref={canvasRef}
                width={libWidth * dpr}
                height={libHeight * dpr}
                style={{ width: libWidth, height: libHeight }}
            />
            <div className='label'>{libElem.name}</div>
        </div>

    );

}
// //{elems.map((elem) => {
const Library = ({ libs }) => {


    return (
        <div id="library">
            {Object.values(libs).map((lib) => {

                return <LibraryItem
                    key={lib.typeId}
                    libElem={lib}

                />
            })


            }
        </div>

    );
};
export default Library;