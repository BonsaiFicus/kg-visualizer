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
	const regex = /(nicht leer|leer|endlich|unendlich)/gi;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push(text.substring(lastIndex, match.index));
		}

		const keyword = match[1].toLowerCase();
		if (keyword === 'nicht leer') {
			parts.push(
				<span key={match.index} style={{ color: '#00ff00', fontWeight: 'bold' }}>
					nicht leer
				</span>
			);
		} else if (keyword === 'leer') {
			parts.push(
				<span key={match.index} style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
					leer
				</span>
			);
		} else if (keyword === 'endlich') {
			parts.push(
				<span key={match.index} style={{ color: '#00ff00', fontWeight: 'bold' }}>
					endlich
				</span>
			);
		} else if (keyword === 'unendlich') {
			parts.push(
				<span key={match.index} style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
					unendlich
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
