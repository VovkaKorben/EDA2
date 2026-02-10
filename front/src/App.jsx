import { useEffect, useState, useRef, useCallback } from 'react';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';

import { ObjectType } from './helpers/utils.js';
import { LoadElems } from './helpers/db.js';
import './App.css'


import { prettify } from './helpers/debug.js';

const defaultSchemaElements = {
    elements: {},
    wires: []
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
    const ClearSchema = () => { setSchemaElements(defaultSchemaElements) }

    // buttons processing
    const handleAction = (actionId) => {
        switch (actionId) {
            // case 1: LoadElems(); break;
            case 2: ClearSchema(); break;
            case 1://load
                break;
            case 5://Save
                break;
            case 3: refSchemaCanvas.current?.resetView(); break;
            case 4:

                console.log(JSON.stringify(libElements));
                console.log(JSON.stringify(schemaElements));
                break;
        }
    }

    const onElemChanged = useCallback((elem, select) => {
        setSchemaElements(prev => {
            const newElements = { ...prev.elements, [elem.id]: elem };
            // setSelected(null);
            if (select) {
                setSelected({ type: ObjectType.ELEMENT, elementId: elem.id });
            }
            return { ...prev, elements: newElements };
        });
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
                    onElemChanged={onElemChanged}
                    onElemDeleted={onElemDeleted}
                /></div>





        </>
    )
}

export default App
