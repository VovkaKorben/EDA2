import { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { generateProjectPreview } from '../helpers/preview.js';
import '../css/flex.css'
import '../css/vcl.css'
import '../css/projectList.css'
import api from '../helpers/api.js';
import { prettify_v3 } from '../helpers/debug.js';


const PREVIEW_CONFIG = Object.freeze({ width: 250, height: 200 });
const ProjectNameEditor = ({ value, valueChanged }) => {
    const [temp, setTemp] = useState(value);
    const isEsc = useRef(false); // Стоп-сигнал



    return (
        <input
            className='project-name-input'
            value={temp || ''}
            onChange={e => setTemp(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                    isEsc.current = true; // Сначала ставим флаг
                    setTemp(value);       // Сбрасываем визуально
                    e.currentTarget.blur();
                }
            }}
            onBlur={() => {
                // Если был Escape — просто сбрасываем флаг и ничего не сохраняем
                if (isEsc.current) {
                    isEsc.current = false;
                    return;
                }
                if (temp !== value) valueChanged(temp);
            }}
            onClick={(e) => e.stopPropagation()}
        />
    );
};

const ProjectCard = ({ projectData, onProjectDelete, onProjectRename, onProjectClick }) => {

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onProjectDelete) {
            onProjectDelete(projectData.projectId)
        }
    }

    const handleRename = (newName) => {
        if (onProjectRename)
            onProjectRename(projectData.projectId, newName);
    }

    const date = new Date(projectData.modified);
    return (
        <div
            className='project-card'
            onClick={() => onProjectClick(projectData.projectId)}
        >
            <ProjectNameEditor
                value={projectData.name}
                valueChanged={(v) => handleRename(v)}
            />
            <div className='project-info'>
                {projectData.projectId === null ? <>Click card to save new project</> : <>Modified: {date.toLocaleString()}</>}
                {/* {<span className='prettify'>{prettify_v3(projectData, 2)}</span>} */}
            </div >

            <div className='project-preview-cont'>
                <img
                    src={projectData.preview}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
            </div >

            {/* show delete only for real projects */}
            {projectData.projectId &&
                <button
                    className='btn projects-btn'
                    onClick={handleDelete}
                >delete</button>}

        </div >

    )


}


const StorageControl = ({ libElements, schemaElements, currentProject, onProjectLoaded }) => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext)
    const [projects, setProjects] = useState([])
    const [error, setError] = useState('')
    const inSave = useRef(false)

    const [saveAsFilename, setSaveAsFilename] = useState(() => {
        const data = localStorage.getItem('saveAsFilename') || 'New project';
        return data;
    });


    // create view data for SaveAs card
    const currentPreview = generateProjectPreview(schemaElements, libElements, PREVIEW_CONFIG.width, PREVIEW_CONFIG.height)
    const newProjectData = {
        projectId: null,
        preview: currentPreview,
        name: saveAsFilename
    }

    useEffect(() => { localStorage.setItem('saveAsFilename', saveAsFilename) }, [saveAsFilename]);

    useEffect(() => {
        // Обновляем превью только для активного проекта при входе в менеджер
        if (currentProject?.id) {
            api.patch(`/projects/${currentProject.id}`, { preview: currentPreview })
                .catch(e => console.error('Preview sync failed', e));
        }
    }, [currentPreview, currentProject.id]);

    // initial projects load
    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            try {
                const dbProjects = await api.get('/projects');
                setProjects(dbProjects.data.data); // 1st data axios, 2nd my
            } catch (e) { console.error(e); }
        }
        fetchProjects();
    }, [user]);

    // if not authorized - return
    if (user?.isLoading) { return (<span>Checking...</span>) }
    if (!user) return (<span>Not logged in. Login here                <Link to="/auth" >authorization page</Link>            </span>)




    // save new project
    const handleSaveAs = async () => {
        if (inSave.current) return;
        inSave.current = true
        try {
            try {
                const now = Date.now()
                const newProjectData = {
                    userId: user.id,
                    name: saveAsFilename,
                    schema: schemaElements,
                    preview: currentPreview,
                    created: now,
                    modified: now
                }
                // console.log(prettify_v3(newProjectData, 2));
                const savedProject = await api.post('/projects', newProjectData);
                if (savedProject.data.success) {
                    setProjects(prev => [...prev, savedProject.data.data])
                } else
                    setError(savedProject.data.message);

            } catch (e) { console.error(e); }

        }
        finally {
            inSave.current = false
        }




    }
    const handleLoad = async (projectId) => {


        if (!onProjectLoaded) return
        try {
            const loadResult = await api.get(`/projects/${projectId}`);

            onProjectLoaded(loadResult.data.data)
            navigate('/');
        } catch (err) { setError(err.message); }
    }
    const handleDelete = async (projectId) => {
        try {
            const project = projects.find(p => p.projectId === projectId);
            if (window.confirm(`Delete project "${project.name}"?\nThis action is irreversible!`)) {
                const deleteResult = await api.delete(`/projects/${projectId}`);
                if (deleteResult.data.success) {
                    setProjects(prev => prev.filter(p => p.projectId !== projectId));
                }
                else { setError(deleteResult.data.message) }
            }

        } catch (err) { setError(err.message); }

    }

    const handleRename = async (projectId, newName) => {

        // store projects state
        const oldProjects = [...projects];
        setProjects(prev => prev.map(p =>
            p.projectId === projectId ? { ...p, name: newName } : p
        ));


        try {
            // rename
            const renameResult = await api.patch(`/projects/${projectId}`, { newName: newName });
            if (!renameResult.data.success) {
                throw new Error(renameResult.data.message || 'Server error');
            }
        } catch (err) {
            // revert if failed
            setError(err.message);
            setProjects(oldProjects);
        }
    }


    return (
        <div style={{ 'margin': '20px' }}>
            <span className='fs-large'> Storage control {error && <span className='error'>({error})</span>}</span>

            <div><Link to="/auth" >Logged as: {user.email}</Link></div>
            <div><Link to="/" >return to editor</Link></div>

            <div
                className='projects-list fwr'
                style={{
                    '--preview-w': `${PREVIEW_CONFIG.width}px`,
                    '--preview-h': `${PREVIEW_CONFIG.height}px`
                }}
            >
                {/* empty card for "save as new project" */}
                <ProjectCard
                    projectData={newProjectData}
                    key={-1}
                    onProjectRename={(_, projectName) => setSaveAsFilename(projectName)}
                    onProjectClick={handleSaveAs}

                />

                {projects.map((proj, idx) =>
                    <ProjectCard
                        key={idx}
                        projectData={proj}
                        onProjectRename={handleRename}
                        onProjectClick={handleLoad}
                        onProjectDelete={handleDelete}

                    />
                )}
            </div>


        </div>
    )
}
export default StorageControl;

