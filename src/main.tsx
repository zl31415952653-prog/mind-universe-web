import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator && location.hostname !== 'localhost') window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));

createRoot(document.getElementById('root')!).render(<App />);
