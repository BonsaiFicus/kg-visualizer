import React from 'react';

/**
 * Kurze Statushinweise fuer CFG-Schritte.
 */
function PopUp({ message }) {
	if (!message) return null;

	return (
		<div className="popup">
			<div className="popup-content">{parseMessage(message)}</div>
		</div>
	);
}

export default PopUp;

/**
 * Markiert zentrale CFG-Ergebnisbegriffe im Popup.
 */
function parseMessage(text) {
	if (typeof text !== 'string') return text;

	const parts = [];
	let lastIndex = 0;
	const regex = /(NICHT LEER|LEER|ENDLICH|UNENDLICH)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push(text.substring(lastIndex, match.index));
		}

		if (match[1] === 'NICHT LEER') {
			parts.push(
				<span key={match.index} style={{ color: '#00ff00', fontWeight: 'bold' }}>
					NICHT LEER
				</span>
			);
		} else if (match[1] === 'LEER') {
			parts.push(
				<span key={match.index} style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
					LEER
				</span>
			);
		} else if (match[1] === 'ENDLICH') {
			parts.push(
				<span key={match.index} style={{ color: '#00ff00', fontWeight: 'bold' }}>
					ENDLICH
				</span>
			);
		} else if (match[1] === 'UNENDLICH') {
			parts.push(
				<span key={match.index} style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
					UNENDLICH
				</span>
			);
		}

		lastIndex = match.index + match[1].length;
	}

	if (lastIndex < text.length) {
		parts.push(text.substring(lastIndex));
	}

	return parts.length > 0 ? parts : text;
}
