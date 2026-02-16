import { useRef, useEffect } from 'react';
// import { drawElement } from '../helpers/geo.js';
import { dpr, drawElement } from '../helpers/draw.js';
// import { dpr } from '../helpers/dpr.js';
import { DrawColor } from '../helpers/utils.js';
const elemSize = 50;
const elemMargin = 5; // in percent, i.e. for value 5 component take 100 - (2*5) = 90%
const elemSizeScaled = Math.round(elemSize * dpr);




const LibraryItem = ({ elem: lib }) => {
    const canvasRef = useRef(null);

    // draw principial
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');


        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // ctx.clearRect(0, 0, elemSize, elemSize);
        ctx.clearRect(0, 0, elemSize * dpr, elemSize * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);


        const toDraw = {
            ...lib,
            pos: [elemSize / 2, elemSize / 2],

            zoom: 3,
            rotate: 0,
            color: DrawColor.NORMAL,
            width: 1
        };

        drawElement(ctx, toDraw);

    }, [lib]);

    // store elem in drag object
    const handleDragStart = (e) => {
        e.dataTransfer.setData('compData', JSON.stringify(lib));
        e.dataTransfer.effectAllowed = 'move';
    };
    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            className="library-item"
            style={{ '--element-width': `${elemSize}px`, '--element-height': `${elemSize}px` }}
        >
            <canvas ref={canvasRef}
                width={elemSize * dpr}
                height={elemSize * dpr}
                style={{ width: elemSize, height: elemSize }}
            />
            <div className='label'>{lib.name}</div>
        </div>

    );

}
// //{elems.map((elem) => {
const Library = ({  libs }) => {


    return (
        <div id="library">
            {Object.values(libs).map((lib) => {

                return <LibraryItem
                    key={lib.typeId}
                    elem={lib}

                />
            })


            }
        </div>

    );
};
export default Library;