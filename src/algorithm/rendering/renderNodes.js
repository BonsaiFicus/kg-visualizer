import { drawNode, drawSelfLoop } from './drawingFunctions.js';
import { highlightManager } from './highlightElements.js';

/**
 * Rendert CFG-Knoten inklusive Selbstschleifen und Highlights.
 */
export function renderNodes(ctx, drawnNodes, edges) {
	for (let i = 0; i < drawnNodes.length; i++) {
		const node = drawnNodes[i];
		drawNode(ctx, node.symbol, node.x, node.y, node.isTerminal);
		drawNodeHighlight(ctx, node);
		drawSelfLoopIfNeeded(ctx, node, edges);
	}
}

/**
 * Zeichnet die Hervorhebung eines CFG-Knotens.
 */
function drawNodeHighlight(ctx, node) {
	const highlightStyle = highlightManager.getNodeHighlightStyle(node.symbol);
	if (!highlightStyle) return;

	ctx.save();
	ctx.strokeStyle = highlightStyle.nodeStroke;
	ctx.lineWidth = highlightStyle.nodeStrokeWidth;
	ctx.globalAlpha = highlightStyle.opacity;

	ctx.beginPath();
	ctx.arc(node.x, node.y, 24, 0, 2 * Math.PI);
	ctx.stroke();

	ctx.restore();
}

/**
 * Zeichnet Selbstschleifen fuer rekursive CFG-Produktionen.
 */
function drawSelfLoopIfNeeded(ctx, node, edges) {
	const selfLoop = edges.find(e => e.isSelfLoop && e.from.symbol === node.symbol);
	if (!selfLoop) return;

	const selfLoopHighlight = highlightManager.getEdgeHighlightStyle(node.symbol, node.symbol);
	const color = selfLoopHighlight ? selfLoopHighlight.edgeStroke : '#555';
	const width = selfLoopHighlight ? selfLoopHighlight.edgeStrokeWidth : 2;
	drawSelfLoop(ctx, node.x, node.y, color, width);
}
