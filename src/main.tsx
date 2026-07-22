import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { initializeAutosave } from './store/persistence';
import './styles/tokens.css';
import './styles/global.css';

initializeAutosave();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
