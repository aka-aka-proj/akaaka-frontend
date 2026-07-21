import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { IconThemeProvider } from './context/IconThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ErrorProvider } from './context/ErrorContext'
import { ErrorPopup } from './components/ErrorPopup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ErrorProvider>
          <IconThemeProvider>
            <AuthProvider>
              <App />
              <ErrorPopup />
            </AuthProvider>
          </IconThemeProvider>
        </ErrorProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
