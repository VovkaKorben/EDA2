import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

import TextInput from './TextInput';
import '../css/auth.css'
const Auth = () => {
    const [values, setValues] = useState({});

    const handleInputChanged = (key, value) => {
        setValues(prev => ({
            ...prev,
            [key]: value
        }))
    }

    return (


        <div className="auth-grid">
            <div className="auth-info fcct">
                <div>Current user</div>
                <Link to="/">Назад к схеме</Link>
            </div>

            <div className="auth-login fcct">
                <div>Already registered? Log in here.</div>

                <TextInput
                    id='hasEmail'
                    value={values.hasEmail ?? ''}
                    caption='e-mail'
                    valueChanged={handleInputChanged}
                />
                <TextInput
                    id='hasPassword'
                    value={values.hasPassword ?? ''}
                    caption='password'
                    valueChanged={handleInputChanged}
                />
                <button className='auth-btn'>login</button>
            </div>
            <div className="auth-register fcct">
                <div className="auth-block-hdr">New user? Register here!</div>
                <TextInput
                    id='newEmail'
                    value={values.newEmail ?? ''}
                    caption='e-mail'
                    valueChanged={handleInputChanged}
                />
                <TextInput
                    id='newPassword1'
                    value={values.newPassword1 ?? ''}
                    caption='password'
                    valueChanged={handleInputChanged}
                />
                <TextInput
                    id='newPassword2'
                    value={values.newPassword2 ?? ''}
                    caption='retype password'
                    valueChanged={handleInputChanged}
                />
                <button className='auth-btn'>register</button>
            </div>
            <div className="auth-restore fcct">
                <div >Forgot password?</div>
                <TextInput
                    id='forgotEmail'
                    value={values.forgotEmail ?? ''}
                    caption='e-mail'
                    valueChanged={handleInputChanged}
                />
                <button className='auth-btn'>send restore info</button>
            </div>
        </div>



    )
}


export default Auth