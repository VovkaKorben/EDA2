import { useEffect, useState, useRef } from 'react';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';
import './App.css'
import { API_URL } from './helpers/utils.js';
import { getPrimitiveBounds, expandBounds, rotatePrimitive, rotatePoint } from './helpers/geo.js';
import { prettify } from './helpers/debug.js';

const defaultSchemaElements = {
    elements: {},
    wires: []
};

function App() {

    const [hovered, setHovered] = useState(null);
    const [selected, setSelected] = useState(null);



    const [libElements, setLibElements] = useState(JSON.parse(localStorage.getItem('libElements')) || []);
    const [schemaElements, setSchemaElements] = useState(
        JSON.parse(localStorage.getItem('schemaElements')) || defaultSchemaElements);

    const refSchemaCanvas = useRef(null);


    // actions itself
    const LoadElems = async () => {
        const resp = await fetch(`${API_URL}library`);
        const result = await resp.json();
        const elem_data = {};

        if (!(resp.ok && result.success))
            return;

        result.data.forEach((rawElem) => {
            // explode primitives to objects
            const rawPrimitives = [];
            if (rawElem.turtle) {
                const primitiveGroup = [...rawElem.turtle.matchAll(/([A-Z])\((.*?)\)/gim)]
                // split each primitive to CODE + PARAMS
                for (const prim of primitiveGroup) {
                    const parsedPrim = {
                        code: prim[1].toUpperCase(),
                        params: prim[2].split(',').map((i) => parseFloat(i))
                    };
                    rawPrimitives.push(parsedPrim);
                }
            }

            // explode pins to coords
            const rawPins = {};

            let pinsGroup = rawElem.pins || '';
            pinsGroup = pinsGroup.replace(/\s/g, '');
            pinsGroup = [...pinsGroup.matchAll(/([^:;]+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?);?/g)]
            for (const pin of pinsGroup) {
                rawPins[pin[1]] = [+pin[2], +pin[3]];
            }

            // prepare for element rotating
            const turtle = Array.from({ length: 4 }, () => []);
            const pins = Array.from({ length: 4 }, () => ({}));
            const bounds = Array.from({ length: 4 }, () => [Infinity, Infinity, -Infinity, -Infinity]);

            for (let rotateIndex = 0; rotateIndex < 4; rotateIndex++) {

                // rotate all primitives
                // bounds[rotateIndex] =;
                for (const prim of rawPrimitives) {
                    const rotatedPrimitive = rotatePrimitive(prim, rotateIndex);
                    turtle[rotateIndex].push(rotatedPrimitive);

                    // get bounds for current and accumulate
                    const primitiveBounds = getPrimitiveBounds(rotatedPrimitive);
                    bounds[rotateIndex] = expandBounds(bounds[rotateIndex], primitiveBounds);
                }

                // rotate pins
                for (let [pinName, pinCoords] of Object.entries(rawPins)) {
                    pins[rotateIndex][pinName] = rotatePoint(pinCoords, rotateIndex);

                }

            }


            elem_data[rawElem.typeId] =
            {
                typeId: rawElem.typeId,
                abbr: rawElem.abbr,
                descr: rawElem.descr,
                name: rawElem.name,
                turtle: turtle,
                pins: pins,
                bounds: bounds
            };

        });
        setLibElements(elem_data);

    }
    const ClearSchema = () => { setSchemaElements(defaultSchemaElements) }
    useEffect(() => {
        localStorage.setItem('libElements', JSON.stringify(libElements));
    }, [libElements]);

    useEffect(() => {
        localStorage.setItem('schemaElements', JSON.stringify(schemaElements));
    }, [schemaElements]);

    // buttons processing
    const handleAction = (actionId) => {
        switch (actionId) {
            case 1: LoadElems(); break;
            case 2: ClearSchema(); break;
            case 3: refSchemaCanvas.current?.resetView(); break;
            case 4:

                console.log(JSON.stringify(libElements));
                console.log(JSON.stringify(schemaElements));
                break;
        }
    }
    /*
        const handleAddElement = (newElement) => {
            setSchemaElements(prev => ({
                ...prev,
                elements: {
                    ...prev.elements,
                    [newElement.id]: newElement
                }
    
    
            }));
        };
    */

    const handleElemChanged = (elem) => {
        setSchemaElements(prev => ({
            ...prev,
            elements: {
                ...prev.elements,
                [elem.id]: elem
            }


        }));
    };


    return (
        <>


            <div className="header"></div>
            <div className="control-bar">  <Controls onAction={handleAction} /></div>
            <div className="library">
                <Library
                    elems={libElements}
                />
            </div>
            <div className="elem-schema">
                <ElementsList
                    schemaElements={schemaElements.elements}
                    libElements={libElements}
                    hovered={hovered}
                    selected={selected}


                />
            </div>
            <div className="schema">
                <SchemaCanvas
                    ref={refSchemaCanvas}
                    libElements={libElements}
                    schemaElements={schemaElements}
                    // onAddElement={handleAddElement}

                    hovered={hovered}
                    selected={selected}

                    hoveredChanged={(obj) => setHovered(obj)}
                    selectedChanged={(obj) => setSelected(obj)}
                    onElemChanged={handleElemChanged}
                /></div>





        </>
    )
}

export default App
