import React, { useEffect, useState, useRef, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { generateProjectPreview } from '../helpers/preview.js';
import '../css/flex.css'
import '../css/vcl.css'
import '../css/projectList.css'
import api from '../helpers/api.js';


const PREVIEW_CONFIG = Object.freeze({
    width: 250,  // Ширина карточки из твоего CSS
    height: 200  // Желаемая высота зоны превью
});
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
        />
    );
};

const ProjectCard = ({ projectData, onProjectDelete, onProjectRename, onProjectClick }) => {
    const [projectName, setProjectName] = useState(projectData.name);

    useEffect(() => {
        if (onProjectRename)
            onProjectRename();
    }, [projectName]);

    return (
        <div className='project-card'>
            <ProjectNameEditor
                value={projectName}
                valueChanged={setProjectName}
            />
            <div className='project-info'>
                ewgfgdgdfgf
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
                    onClick={onProjectDelete}
                >delete</button>}

        </div >

    )


}


const StorageControl = ({ libElements, schemaElements, projectName }) => {
    const { user } = useContext(AuthContext);
    const [projects, setProjects] = useState([]);

    const [saveAsFilename, setSaveAsFilename] = useState(() => {
        const data = localStorage.getItem('saveAsFilename') || 'Untitled schema';
        return data;
    });
    useEffect(() => { localStorage.setItem('saveAsFilename', saveAsFilename) }, [saveAsFilename]);
    const handleSaveAs = () => {

    }



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

    if (user?.isLoading) { return (<span>Checking...</span>) }
    if (!user) return (<span>Not logged in. Login here                <Link to="/auth" >authorization page</Link>            </span>)


    // create data for SaveAs card
    const currentPreview = generateProjectPreview(schemaElements, libElements, PREVIEW_CONFIG.width, PREVIEW_CONFIG.height)

    const newProjectData = {
        projectId: null,
        preview: currentPreview,
        name: saveAsFilename
    }



    return (
        <div >
            <span className='fs-large'> Storage control</span>
            <div>              Project name:  {projectName}            </div>
            <div>                Logged as: {user.email}            </div>


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
                    onProjectRename={(v) => setSaveAsFilename(v)}
                    onProjectClick={handleSaveAs}

                />

                {projects.map((proj, idx) => <ProjectCard key={idx} projectData={proj} />)}
            </div>


        </div>
    )
}
export default StorageControl;

