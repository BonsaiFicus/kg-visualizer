import React from 'react';
import '../styles/sidebars.css';

/**
 * Log-Seitenleiste fuer Ausgaben der CFG-Analyse.
 */
export default function SidebarRight({ grammar, open, toggleSidebarRight, onOpenLogsModal, currentLogs, onCurrentLogsChange }) {
	const hasGrammar = grammar && grammar.productions && Object.keys(grammar.productions).length > 0;

	return (
		<div className={`sidebar sidebar-right ${open ? 'open' : 'closed'}`}>
			{hasGrammar && (
				<button
					className={`sidebar-toggle ${open ? 'toggle-open' : 'toggle-closed'}`}
					onClick={toggleSidebarRight}
					aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
				>
					{open ? '>' : '<'}
				</button>
			)}
			<h2>Logs</h2>
			<textarea
				className={'logs-textarea'}
				value={currentLogs}
				readOnly
			/>
			<div style={{ marginTop: '10px' }}>
				<button className="btn btn-secondary full-width" onClick={onOpenLogsModal}>
					Gesamte Logs einsehen
				</button>
			</div>
		</div>
	);
}
