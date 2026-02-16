import { useEffect, useState, useRef, useCallback } from 'react';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';

import { ObjectType } from './helpers/utils.js';
import { LoadElems } from './helpers/geo.js';
import './css/App.css'
import './css/flex.css'


import { prettify } from './helpers/debug.js';

const defaultSchemaElements = {
    elements: {},
    wires: {}
};

function App() {

    const [hovered, setHovered] = useState({ type: ObjectType.NONE });
    const [selected, setSelected] = useState({ type: ObjectType.NONE });

    const refSchemaCanvas = useRef(null);

    //const [libElements, setLibElements] = useState(        JSON.parse(localStorage.getItem('libElements')) || []);
    const [libElements, setLibElements] = useState([]);
    useEffect(() => {
        const loadElems = async () => {
            const loadedElems = await LoadElems();
            // console.log('loadedElems: ' + prettify(loadedElems, 1));
            setLibElements(loadedElems);
        }
        loadElems();

        //console.log('libElements: ' + prettify(libElements, 1));        localStorage.setItem('libElements', JSON.stringify(libElements));
    }, []);



    const [schemaElements, setSchemaElements] = useState(JSON.parse(localStorage.getItem('schemaElements')) || defaultSchemaElements);
    useEffect(() => { localStorage.setItem('schemaElements', JSON.stringify(schemaElements)); }, [schemaElements]);
    const ClearSchema = (keep_elements) => {
        const newElements = keep_elements ? { ...schemaElements.elements } : {};
        setSchemaElements({
            elements: newElements,
            wires: {}
        });

    }

    // buttons processing
    const handleAction = (actionId) => {
        switch (actionId) {
            // case 1: LoadElems(); break;
            case 20: ClearSchema(false); break;//Clear all
            case 21: ClearSchema(true); break;//Clear wires
            case 1:
                {
                    //load
                    const data = JSON.parse(localStorage.getItem('saved') || defaultSchemaElements);
                    setSchemaElements(data);
                    break;
                }
            case 5: {//Save
                localStorage.setItem('saved', JSON.stringify(schemaElements));
                break;

            }
            case 3: refSchemaCanvas.current?.resetView(); break;
            case 4:

                console.log(prettify(libElements, 0));
                console.log(prettify(schemaElements, 3));
                break;
        }
    }

    const onElemChanged = useCallback((elem, select) => {
        setSchemaElements(prev => {
            const newElements = { ...prev.elements, [elem.id]: elem };
            if (select) {
                setSelected({ type: ObjectType.ELEMENT, elementId: elem.id });
            }
            return { ...prev, elements: newElements };
        });
    }, []);

    const onWiresChanged = useCallback((wires) => {

        setSchemaElements(prev => ({ ...prev, wires: wires }))

    }, []);

    const onElemDeleted = useCallback((elementId) => {

        setSchemaElements(prev => {
            const newElements = { ...prev.elements };
            delete newElements[elementId];
            return {
                ...prev,
                elements: newElements
            };
        });
    }, []);

    return (
        <>


            <div className="header"></div>
            <div className="control-bar">  <Controls onAction={handleAction} /></div>
            <div className="library">
                <Library
                    libs={libElements}
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
                    onElemChanged={onElemChanged}
                    onElemDeleted={onElemDeleted}
                    onWiresChanged={onWiresChanged}
                /></div>





        </>
    )
}

export default App
