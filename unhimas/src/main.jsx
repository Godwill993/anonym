import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/components.css'
import './styles/ux.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { captureLandingUtm } from './utils/utm'

captureLandingUtm();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
