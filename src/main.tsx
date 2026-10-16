import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startSync } from './lib/sync';
import './styles.css';

// Ask the browser not to clear saved data when space runs low (Safari may otherwise evict it).
try {
  void navigator.storage?.persist?.();
} catch {
  // Not supported: data still saves normally.
}
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
