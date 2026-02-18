import { drawArrow, drawCurvedArrow } from './drawingFunctions.js';
import { highlightManager } from './highlightElements.js';

/**
 * Rendert CFG-Kanten mit Highlight- und Kurvenlogik.
 */
export function renderEdges(ctx, edges, edgeCurveInfo) {
	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i];

		if (edge.isSelfLoop) {
			continue;
		}

		const { color, width } = getEdgeStyle(edge);
		drawEdge(ctx, edge, edgeCurveInfo, color, width);
	}
}

/**
 * Erzeugt einen Schluessel fuer CFG-Kanten.
 */
function edgeKey(edge) {
	return `${edge.from.symbol}|${edge.from.x},${edge.from.y}->${edge.to.symbol}|${edge.to.x},${edge.to.y}`;
}

/**
 * Bestimmt den Stil einer CFG-Kante aus Highlight-Informationen.
 */
function getEdgeStyle(edge) {
	const highlightStyle = highlightManager.getEdgeHighlightStyle(edge.from.symbol, edge.to.symbol);
	return {
		color: highlightStyle ? highlightStyle.edgeStroke : '#555',
		width: highlightStyle ? highlightStyle.edgeStrokeWidth : 2,
	};
}

/**
 * Zeichnet eine CFG-Kante als gerade oder gekruemmte Linie.
 */
function drawEdge(ctx, edge, edgeCurveInfo, color, width) {
	const info = edgeCurveInfo.get(edgeKey(edge));
	if (info && info.shouldCurve) {
		drawCurvedArrow(ctx, edge.from.x, edge.from.y, edge.to.x, edge.to.y, info.sign, color, width, info.dist);
		return;
	}

	drawArrow(ctx, edge.from.x, edge.from.y, edge.to.x, edge.to.y, color, width);
}
