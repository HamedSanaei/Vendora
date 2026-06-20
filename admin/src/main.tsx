import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './features/admin/styles/admin.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './app/layout/App'
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
