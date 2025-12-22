import React from 'react';

import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Determine if we're in development mode for showing error details
const isDevelopment = import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary componentName="App" showDetails={isDevelopment}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
