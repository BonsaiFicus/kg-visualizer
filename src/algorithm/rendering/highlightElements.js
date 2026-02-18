/**
 * Stile fuer Hervorhebungen von CFG-Knoten und -Kanten.
 */
export const HIGHLIGHT_STYLES = {
	productive: {
		nodeStroke: '#00ff00',
		nodeStrokeWidth: 4,
		edgeStroke: '#00ff00',
		edgeStrokeWidth: 3,
		opacity: 1
	},
	focus: {
		nodeStroke: '#FFD700',
		nodeStrokeWidth: 3,
		edgeStroke: '#FFD700',
		edgeStrokeWidth: 2,
		opacity: 0.9
	},
	warning: {
		nodeStroke: '#FF6B6B',
		nodeStrokeWidth: 3,
		edgeStroke: '#FF6B6B',
		edgeStrokeWidth: 2,
		opacity: 0.8
	},
	processing: {
		nodeStroke: '#4A90E2',
		nodeStrokeWidth: 4,
		edgeStroke: '#4A90E2',
		edgeStrokeWidth: 3,
		opacity: 1
	},
	temporary: {
		nodeStroke: '#FFA500',
		nodeStrokeWidth: 2,
		edgeStroke: '#FFA500',
		edgeStrokeWidth: 2,
		opacity: 0.7
	}
};

/**
 * Verwaltet Hervorhebungen fuer CFG-Knoten und -Kanten.
 */
export class HighlightManager {
	/**
	 * Initialisiert Highlight-Container fuer die CFG-Ansicht.
	 */
	constructor() {
		this.highlightedNodes = new Map();
		this.highlightedEdges = new Map();
		this.temporaryHighlights = new Map();
	}

	/**
	 * Hebt einen CFG-Knoten dauerhaft hervor.
	 */
	highlightNode(nodeSymbol, styleKey = 'focus') {
		this.highlightedNodes.set(nodeSymbol, getHighlightStyle(styleKey));
	}

	/**
	 * Hebt eine CFG-Kante dauerhaft hervor.
	 */
	highlightEdge(fromSymbol, toSymbol, styleKey = 'focus') {
		const key = edgeKey(fromSymbol, toSymbol);
		this.highlightedEdges.set(key, getHighlightStyle(styleKey));
	}

	/**
	 * Hebt mehrere CFG-Knoten hervor.
	 */
	highlightNodes(nodeSymbols, styleKey = 'focus') {
		for (let i = 0; i < nodeSymbols.length; i++) {
			const symbol = nodeSymbols[i];
			this.highlightNode(symbol, styleKey);
		}
	}

	/**
	 * Hebt mehrere CFG-Kanten hervor.
	 */
	highlightEdges(edges, styleKey = 'focus') {
		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			const from = edge.from?.symbol || edge.fromSymbol;
			const to = edge.to?.symbol || edge.toSymbol;
			this.highlightEdge(from, to, styleKey);
		}
	}

	/**
	 * Hebt einen CFG-Knoten temporaer hervor.
	 */
	highlightNodeTemporary(nodeSymbol, styleKey = 'temporary', duration = 2000) {
		clearTemporaryHighlight(this.temporaryHighlights, nodeSymbol);
		this.highlightNode(nodeSymbol, styleKey);
		scheduleTemporaryClear(this, nodeSymbol, duration);
	}

	/**
	 * Hebt eine CFG-Kante temporaer hervor.
	 */
	highlightEdgeTemporary(fromSymbol, toSymbol, styleKey = 'temporary', duration = 2000) {
		const key = edgeKey(fromSymbol, toSymbol);
		clearTemporaryHighlight(this.temporaryHighlights, key);
		this.highlightEdge(fromSymbol, toSymbol, styleKey);
		scheduleTemporaryClear(this, key, duration, () => this.clearEdge(fromSymbol, toSymbol));
	}

	/**
	 * Entfernt eine CFG-Knotenmarkierung.
	 */
	clearNode(nodeSymbol) {
		this.highlightedNodes.delete(nodeSymbol);
	}

	/**
	 * Entfernt eine CFG-Kantenmarkierung.
	 */
	clearEdge(fromSymbol, toSymbol) {
		const key = edgeKey(fromSymbol, toSymbol);
		this.highlightedEdges.delete(key);
	}

	/**
	 * Entfernt alle CFG-Hervorhebungen.
	 */
	clearAll() {
		this.highlightedNodes.clear();
		this.highlightedEdges.clear();

		const timeouts = Array.from(this.temporaryHighlights.values());
		for (let i = 0; i < timeouts.length; i++) {
			clearTimeout(timeouts[i]);
		}

		this.temporaryHighlights.clear();
	}

	/**
	 * Prueft, ob ein CFG-Knoten markiert ist.
	 */
	isNodeHighlighted(nodeSymbol) {
		return this.highlightedNodes.has(nodeSymbol);
	}

	/**
	 * Prueft, ob eine CFG-Kante markiert ist.
	 */
	isEdgeHighlighted(fromSymbol, toSymbol) {
		const key = edgeKey(fromSymbol, toSymbol);
		return this.highlightedEdges.has(key);
	}

	/**
	 * Liefert den Stil fuer einen markierten CFG-Knoten.
	 */
	getNodeHighlightStyle(nodeSymbol) {
		return this.highlightedNodes.get(nodeSymbol) || null;
	}

	/**
	 * Liefert den Stil fuer eine markierte CFG-Kante.
	 */
	getEdgeHighlightStyle(fromSymbol, toSymbol) {
		const key = edgeKey(fromSymbol, toSymbol);
		return this.highlightedEdges.get(key) || null;
	}

	/**
	 * Gibt alle markierten CFG-Knoten zurueck.
	 */
	getHighlightedNodes() {
		return Array.from(this.highlightedNodes.keys());
	}

	/**
	 * Gibt alle markierten CFG-Kanten zurueck.
	 */
	getHighlightedEdges() {
		return Array.from(this.highlightedEdges.keys());
	}
}

export const highlightManager = new HighlightManager();

/**
 * Zeichnet die Hervorhebung fuer einen CFG-Knoten.
 */
export function drawHighlightedNode(ctx, node, radius, shouldHighlight = true) {
	if (!shouldHighlight) return;

	const style = highlightManager.getNodeHighlightStyle(node.symbol);
	if (!style) return;

	ctx.save();
	ctx.strokeStyle = style.nodeStroke;
	ctx.lineWidth = style.nodeStrokeWidth;
	ctx.globalAlpha = style.opacity;

	ctx.beginPath();
	ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI);
	ctx.stroke();

	ctx.restore();
}

/**
 * Zeichnet die Hervorhebung fuer eine CFG-Kante.
 */
export function drawHighlightedEdge(ctx, edge, shouldHighlight = true) {
	if (!shouldHighlight) return;

	const style = highlightManager.getEdgeHighlightStyle(edge.from.symbol, edge.to.symbol);
	if (!style) return;

	ctx.save();
	ctx.strokeStyle = style.edgeStroke;
	ctx.lineWidth = style.edgeStrokeWidth;
	ctx.globalAlpha = style.opacity;

	ctx.beginPath();
	ctx.moveTo(edge.from.x, edge.from.y);
	ctx.lineTo(edge.to.x, edge.to.y);
	ctx.stroke();

	ctx.restore();
}

export default highlightManager;

/**
 * Erzeugt einen stabilen Schluessel fuer CFG-Kanten.
 */
function edgeKey(fromSymbol, toSymbol) {
	return `${fromSymbol}->${toSymbol}`;
}

/**
 * Liefert einen Highlight-Stil fuer CFG-Elemente.
 */
function getHighlightStyle(styleKey) {
	return HIGHLIGHT_STYLES[styleKey];
}

/**
 * Entfernt ein geplantes Highlight fuer CFG-Elemente.
 */
function clearTemporaryHighlight(tempMap, key) {
	if (!tempMap.has(key)) return;
	clearTimeout(tempMap.get(key));
}

/**
 * Plant das automatische Entfernen eines CFG-Highlights.
 */
function scheduleTemporaryClear(manager, key, duration, customClear) {
	const timeout = setTimeout(() => {
		if (customClear) {
			customClear();
		} else {
			manager.clearNode(key);
		}
		manager.temporaryHighlights.delete(key);
	}, duration);

	manager.temporaryHighlights.set(key, timeout);
}
