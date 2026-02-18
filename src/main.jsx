import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import './styles/global.css';
import './styles/canvas.css';
import './styles/sidebars.css';
import './styles/layout.css';
import './styles/footer.css';
import './styles/modal.css';

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
