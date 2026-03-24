import React, { useState, useRef, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import '../css/checkbox.css'
import '../css/flex.css'


import '../css/auth.css'

const StorageControl = ({ projectName }) => {
    const { user } = useContext(AuthContext);



    if (user?.isLoading) {
        return (<span>Checking...</span>)
    }
    if (!user)
        return (
            <span>Not logged in. Login here
                <Link to="/auth" >authorization page</Link>
            </span>)



    return (
        <div className='fs-large'> Storage control


            <div>

              Project name:  {projectName}


            </div>
            <div>

                Logged as123: {user.email}


            </div>

        </div>
    )
}
export default StorageControl;

