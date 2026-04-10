import { useEffect, useState, useRef, useCallback, useContext } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Controls from './component/Controls';
import SchemaCanvas from './component/SchemaCanvas';
import ElementsList from './component/ElementsList';
import Library from './component/Library';
import RouteShow from './component/RouteShow';

import LayersList from './component/LayersList';
import StorageControl from './component/StorageControl';

import { ObjectType } from './helpers/utils.js';
import { LoadElems } from './helpers/geo.js';

import { AuthContext } from './component/AuthContext'; // Путь к твоему файлу с контекстом
import Auth from './component/Auth';
import api from './helpers/api.js';

import './css/App.css'
import './css/flex.css'


import { prettify } from './helpers/debug.js';

const defaultSchemaElements = {
    elements: {},
    wires: {}
};

function App() {
    const navigate = useNavigate();

    const { user } = useContext(AuthContext);

    // PCB layers visibility load
    const [layers, setLayers] = useState(() => {
        const data = JSON.parse(localStorage.getItem('layers')) || {}
        return data;
    });
    // PCB layers visibility store
    useEffect(() => { localStorage.setItem('layers', JSON.stringify(layers)) }, [layers]);


    const [errorList, setErrorList] = useState([]);
    const handleErrors = useCallback((newErrors) => { setErrorList(prev => [...prev, ...newErrors]); }, []);

    const [hovered, setHovered] = useState({ type: ObjectType.NONE });
    const [selected, setSelected] = useState({ type: ObjectType.NONE });
    const [showRoute, setShowRoute] = useState(true);
    const refSchemaCanvas = useRef(null);
    const [libElements, setLibElements] = useState([]);
    const isDirty = useRef(false);



    const [project, setProject] = useState(() => {
        return JSON.parse(localStorage.getItem('project')) || { projectId: null, name: 'local copy' }
    });

    useEffect(() => {
        localStorage.setItem('project', JSON.stringify(project))
    }, [project]);

    useEffect(() => {
        const loadElems = async () => {
            const elems = {};
            const errors = [];
            await LoadElems(elems, errors);
            handleErrors(errors)
            setLibElements(elems);
        }
        loadElems();
    }, [handleErrors]);



    const [schemaElements, setSchemaElements] = useState(() => {
        const data = JSON.parse(localStorage.getItem('schemaElements')) || defaultSchemaElements;
        return data;
    });
    useEffect(() => { localStorage.setItem('schemaElements', JSON.stringify(schemaElements)); }, [schemaElements]);

    // autosave project
    useEffect(() => {
        if (!project.projectId || !isDirty.current) return


        const saveTimeout = setTimeout(async () => {
            try {
                await api.patch(`/projects/${project.projectId}`, { schema: schemaElements });
                isDirty.current = false
                // console.log('Project saved');
            } catch (err) {
                console.error('Autosave error: ', err);
            }
        }, 1000); // debounce 1 second

        return () => clearTimeout(saveTimeout);
    }, [schemaElements, project.projectId]);


    const ClearSchema = (keep_elements) => {
        isDirty.current = true
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
            case 2: { navigate('/project'); break; }
            /*      case 1:
                      {
                          //load
                          const data = JSON.parse(localStorage.getItem('saved') || defaultSchemaElements);
                          setSchemaElements(data);
                          break;
                      }
                  case 5: {//Save
                      localStorage.setItem('saved', JSON.stringify(schemaElements));
                      break;
      
                  }*/
            case 3: refSchemaCanvas.current?.resetView(); break;

            // LOG WIRES
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
        isDirty.current = true
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
        isDirty.current = true
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
        isDirty.current = true
        setSchemaElements(prev => ({ ...prev, wires: wires }))

    }, []);

    // delete element
    const onElemDeleted = useCallback((elementId) => {
        isDirty.current = true
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


            let s = `[${w.wireId}] `
            s = s + add_node(w.source) + ' -> ' + add_node(w.target) //+ `  (netId: ${w.netId})`;
            console.log(s)

        })

    };
    const handleProjectLoad = (project) => {
        isDirty.current = false
        setHovered({ type: ObjectType.NONE })
        setSelected({ type: ObjectType.NONE })

        const projectState = { projectId: project.projectId, name: project.name }
        setProject(projectState)
        // const projSchema = JSON.parse(project.schema)
        setSchemaElements(project.schema)

    }


    return (


        <Routes>


            <Route path="/" element={
                <div className={`app-container ${showRoute ? 'route-mode' : ''}`}>

                    <div className="main-bar frbc">
                        <div className="frcc" >
                            <img src='./chip.svg' />
                            <span>Simple EDA</span>
                        </div  >
                        <div className="frcc" >
                            <Link to="/project">{project.name}</Link>
                        </div >



                        <div className="frcc" >
                            {
                                user?.isLoading ? <>checking...</> :
                                    <nav>
                                        <Link to="/auth">
                                            {user ? <>{user.email}</> : <>login</>}
                                        </Link>
                                    </nav>
                            }
                        </div >
                    </div>


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
                                layers={layers}
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
                    <div className="layers-list">
                        <LayersList
                            layers={layers}
                            layersChanged={(v) => setLayers(v)}
                        />

                    </div>
                    <div className="error-list">
                        {
                            errorList.map((e, i) => {

                                return <div className={`error-code-${e.code}`} key={i}>{e.message}</div>
                            })
                        }

                    </div>


                </div>
            } />

            {/* authorization page */}
            <Route path="/auth" element={
                <Auth />

            } />

            {/* project save/load */}
            <Route path="/project" element={
                <StorageControl

                    libElements={libElements}
                    schemaElements={schemaElements}
                    currentProject={project}
                    onProjectLoaded={handleProjectLoad}
                />

            } />
        </Routes>


    )
}

export default App














