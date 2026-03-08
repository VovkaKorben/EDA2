import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
const Auth = () => {

    return (
        <div className="login-screen">
            <h1>Вход в систему</h1>
            <Link to="/">Назад к схеме</Link>
        </div>
    )
}


export default Auth