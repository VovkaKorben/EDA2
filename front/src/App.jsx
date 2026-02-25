import { useEffect, useState, useRef, useCallback } from 'react';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';
import RouteShow from './component/RouteShow';


import { ObjectType } from './helpers/utils.js';
import { LoadElems } from './helpers/geo.js';
import './css/App.css'
import './css/flex.css'


import { prettify } from './helpers/debug.js';
// import { Rect, Point } from './helpers/rect.js';

const defaultSchemaElements = {
    elements: {},
    wires: {}
};

function App() {
    const [errorList, setErrorList] = useState([]);
    const [hovered, setHovered] = useState({ type: ObjectType.NONE });
    const [selected, setSelected] = useState({ type: ObjectType.NONE });
    const [showRoute, setShowRoute] = useState(true);
    const refSchemaCanvas = useRef(null);
    const handleErrors = useCallback((newErrors) => { setErrorList(prev => [...prev, ...newErrors]); }, []);
    const [libElements, setLibElements] = useState([]);
    useEffect(() => {
        const loadElems = async () => {
            //const loadedElems =
            const elems = {};
            const errors = [];
            await LoadElems(elems, errors);
            handleErrors(errors)

            // console.log('loadedElems: ' + prettify(loadedElems, 1));
            setLibElements(elems);
        }
        loadElems();

        //console.log('libElements: ' + prettify(libElements, 1));        localStorage.setItem('libElements', JSON.stringify(libElements));
    }, [handleErrors]);
    const [schemaElements, setSchemaElements] = useState(() => {
        const data = JSON.parse(localStorage.getItem('schemaElements')) || defaultSchemaElements;
        return data;
    });
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
            case 400:
                log_wires(schemaElements.wires);
                break;
            case 410:
                console.log(prettify(libElements, 0));
                break;
            case 300: // route 
                setShowRoute(prev => !prev);
                break;

        }

    }

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            // Проверяем тильду
            if (event.code === 'Backquote') {
                setShowRoute(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // update package
    const setPackage = (data) => {
        setSchemaElements(prev => {
            // const newElements = { ...};
            const newElement = {
                ...prev.elements[data.elementId],
                packageId: data.packageId
            };
            const newElements = {
                ...prev.elements,
                [data.elementId]: newElement
            };
            return { ...prev, elements: newElements };
        });
    };

    // add/modify element
    const onElemChanged = useCallback((elem, select) => {
        setSchemaElements(prev => {
            const newElements = { ...prev.elements, [elem.elementId]: elem };
            if (select) {
                setSelected({ type: ObjectType.ELEMENT, elementId: elem.elementId });
            }
            return { ...prev, elements: newElements };
        });
    }, []);

    // update wires 
    const onWiresChanged = useCallback((wires) => {

        setSchemaElements(prev => ({ ...prev, wires: wires }))

    }, []);

    // delete element
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


    const log_wires = (wires) => {

        const add_node = (e) => {
            if (e.type === ObjectType.PIN) {
                const elem = schemaElements.elements[e.elementId];

                const lib = libElements[elem.typeId];
                return `${lib.abbr}${elem.typeIndex} ${e.pinIdx}`;
            } else if (e.type === ObjectType.TCONN) {
                return `NODE (${e.pos[0]},${e.pos[1]})`;
            }


        }
        console.log('--- wires -----------------------------------');
        Object.values(wires).forEach(w => {


            let s = `[${w.wireId}] `;
            s = s + add_node(w.source) + ' -> ' + add_node(w.target);
            console.log(s);

        })

    };


    useEffect(() => {
        console.log(`libElements: ${Object.keys(libElements).length}`)
    }, [libElements]);


    return (
        // <div className='app-container'>
        <div className={`app-container ${showRoute ? 'route-mode' : ''}`}>

            {/* <div className="header"></div> */}
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


                    hoveredChange={(obj) => setHovered(obj)}
                    selectedChange={(obj) => setSelected(obj)}
                    packageChange={data => setPackage(data)}
                />
            </div>
            <div className="schema">

                {showRoute ?
                    <RouteShow
                        onError={handleErrors}
                        schemaElements={schemaElements}
                        libElements={libElements}
                    />


                    :
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
                    />


                }
            </div>

            <div className="error-list">
                {
                    errorList.map((e, i) => {

                        return <div className={`error-code-${e.code}`} key={i}>{e.message}</div>
                    })
                }

            </div>


        </div>
    )
}

export default App
