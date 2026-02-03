import { useEffect, useState, useRef } from 'react';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';
import './App.css'
import { API_URL } from './helpers/utils.js';
import { getPrimitiveBounds, expandBounds } from './helpers/geo.js';
import { prettify } from './helpers/debug.js';

const defaultSchemaElements = {
    elements: [],
    wires: []
};

function App() {
    const [libElements, setLibElements] = useState(JSON.parse(localStorage.getItem('libElements')) || []);
    const [schemaElements, setSchemaElements] = useState(
        JSON.parse(localStorage.getItem('schemaElements')) || defaultSchemaElements);
   
    const refSchemaCanvas = useRef(null);


    // actions itself
    const LoadElems = async () => {
        const resp = await fetch(`${API_URL}library`);
        const result = await resp.json();
        const elem_data = {};

        if (resp.ok && result.success) {
            result.data.forEach((e) => {

                // explode primitives to objects
                const parsedGroups = [];
                let bounds = [Infinity, Infinity, -Infinity, -Infinity];
                if (e.turtle) {
                    const primitiveGroup = [...e.turtle.matchAll(/([A-Z])\((.*?)\)/gim)]

                    // split each primitive to CODE + PARAMS
                    for (const prim of primitiveGroup) {
                        const parsedPrim = {
                            code: prim[1].toUpperCase(),
                            params: prim[2].split(',').map((i) => parseFloat(i))
                        };
                        // console.log(e.name, parsedPrim);
                        parsedGroups.push(parsedPrim);
                    }

                    // calc bounds
                    for (const prim of parsedGroups) {
                        const primBounds = getPrimitiveBounds(prim);
                        bounds = expandBounds(bounds, primBounds);
                    }
                }

                // explode pins to coords
                const pins = {};
                const pinsGroup = [...(e.pins || '').matchAll(/(\d+):(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
                for (const pin of pinsGroup) {
                    pins[+pin[1]] = [+pin[2], +pin[3]];
                }
                console.log(prettify(pins, 0));

                elem_data[e.typeId] =
                {
                    ...e,
                    turtle: parsedGroups,
                    pins: pins,
                    bounds: bounds
                };


            });
            setLibElements(elem_data);
        }
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

    const handleAddElement = (newElement) => {
        setSchemaElements(prev => ({
            ...prev,
            elements: [
                ...prev.elements,
                newElement
            ]


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
                />
            </div>
            <div className="schema">
                <SchemaCanvas
                    ref={refSchemaCanvas}
                    libElements={libElements}
                    schemaElements={schemaElements}
                    onAddElement={handleAddElement}
                /></div>





        </>
    )
}

export default App
