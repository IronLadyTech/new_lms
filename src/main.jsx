import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
/* Self-hosted brand fonts (UX audit M-10) — latin weights used by the LMS */
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/400-italic.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/gemunu-libre/400.css';
import '@fontsource/gemunu-libre/600.css';
import '@fontsource/gemunu-libre/700.css';
import '@fontsource/gemunu-libre/800.css';
import AppRoot from './AppRoot';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoot />
    </BrowserRouter>
  </StrictMode>
);
