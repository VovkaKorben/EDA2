import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './component/AuthContext';
import App from './App.jsx'



if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => console.clear());
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider >
  </StrictMode>,
)
