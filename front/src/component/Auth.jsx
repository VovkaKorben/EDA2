import { useEffect, useState, useRef, useCallback, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

import { AuthContext } from './AuthContext';
import api from '../helpers/api';

import TextInput from './TextInput';
import '../css/auth.css'
const MSG_INIT = { code: 0, message: '' }
const statusClasses = { 0: 'code-0', 1: 'code-1', 2: 'code-2' };


const AuthMessage = ({ data }) => {
    if (!data?.message) return <div className="auth-msg" />;

    return (
        <div className={`auth-msg ${statusClasses[data.code] || 'code-0'}`}>
            {data.message}
        </div>
    );
};
const Auth = () => {
    // const [refreshToken,]
    const { user, login, logout } = useContext(AuthContext);
    const [values, setValues] = useState({ hasEmail: 'admin@gmail.com', hasPassword: '' });

    const [messages, setMessages] = useState({
        login: MSG_INIT,
        register: MSG_INIT,
        forgot: MSG_INIT
    })

    // input handler
    const handleInputChanged = (key, value) => {
        setValues(prev => ({
            ...prev,
            [key]: value
        }))
    }

    const handleLogin = async () => {

        try {
            const res = await api.post('/login', {
                email: values.hasEmail,
                password: values.hasPassword
            });

            if (res.data?.success) {
                // wait for login
                await login({
                    accessToken: res.data.accessToken,
                    refreshToken: res.data.refreshToken
                });
                // clear errors
                setMessages(prev => ({ ...prev, login: MSG_INIT }));
                // clear credentials
                setValues(prev => ({
                    ...prev,
                    hasEmail: '',
                    hasPassword: ''
                }))
            } else {

                // success === FALSE
                setMessages(prev => ({
                    ...prev,
                    login: { code: res.data.code, message: res.data.message }
                }));


            }




        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Ошибка сервера';
            setMessages(prev => ({
                ...prev,
                login: { code: 2, message: errorMsg }
            }));
        }
    }


    const handleLogout = () => { logout(); }




    const handleRegister = () => { }
    const handleForgot = () => { }





    return (


        <div className="auth-grid">


            {/* CURRENT USER INFO */}
            <div className="auth-info fcct">
                <div className="auth-info-top">

                    {user?.isLoading ? (
                        <span>Checking...</span>
                    ) : user ? (
                        <div>Logged as <strong>{user.email}</strong>
                            <button className='auth-btn' onClick={handleLogout}>logout</button>
                        </div>
                    ) : (
                        <span>Not logged in.</span>
                    )}

                </div>
                <div className="auth-info-bottom ">
                    <Link to="/" className='ani-link'>Back to editor</Link>
                </div>
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
                <button className='auth-btn' onClick={handleLogin}>login</button>
                <AuthMessage data={messages.login} />

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
                <button className='auth-btn' onClick={handleRegister}>register</button>
                {/* <div className='auth-error'>{errors.register}</div > */}
                <AuthMessage data={messages.register} />
            </div>
            <div className="auth-restore fcct">
                <div >Forgot password?</div>
                <TextInput
                    id='forgotEmail'
                    value={values.forgotEmail ?? ''}
                    caption='e-mail'
                    valueChanged={handleInputChanged}
                />
                <button className='auth-btn' onClick={handleForgot}>send restore info</button>
                {/* <div className='auth-error'>{errors.forgot}</div > */}
                <AuthMessage data={messages.forgot} />
            </div>
        </div>



    )
}


export default Auth