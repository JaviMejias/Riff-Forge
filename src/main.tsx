import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyThemeClass } from './store/uiStore.ts'

try {
  const persistedUi = JSON.parse(localStorage.getItem('ui-storage') || '{}')
  applyThemeClass(persistedUi?.state?.theme || 'amber')
} catch {
  applyThemeClass('amber')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
