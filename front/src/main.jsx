import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { BrowserRouter} from 'react-router-dom';
import { AuthProvider } from './component/AuthContext';
import App from './App.jsx'



if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => console.clear());
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
       <BrowserRouter>
      <App />
       </BrowserRouter>
    </AuthProvider >
  </StrictMode>,
)
