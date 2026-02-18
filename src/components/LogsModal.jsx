import React from 'react';
import '../styles/modal.css';

/**
 * Modal fuer gesammelte Logs der CFG-Transformation.
 */
export default function LogsModal({ isOpen, onClose, logs }) {
	if (!isOpen) return null;

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-container" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h2>Gesamte Logs</h2>
					<button className="modal-close" onClick={onClose}>×</button>
				</div>
				<div className="modal-body">
					<pre className="modal-logs">{logs}</pre>
				</div>
			</div>
		</div>
	);
}
