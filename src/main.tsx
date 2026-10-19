import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import App from './App.tsx';
import { ToastProvider } from './components/Toast.tsx';
import UpdatePrompt from './pwa/UpdatePrompt.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <App />
        <UpdatePrompt />
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);
