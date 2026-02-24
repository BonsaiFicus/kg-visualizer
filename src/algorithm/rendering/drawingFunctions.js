import { isEpsilon } from '../parseGrammar.js';

const NODE_RADIUS = 22;

/**
 * Zeichnet einen CFG-Knoten.
 */
export function drawNode(ctx, symbol, x, y, isTerminal = false) {
	ctx.beginPath();
	ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
	ctx.fillStyle = getNodeFillColor(symbol);
	ctx.fill();

	ctx.lineWidth = 4;
	ctx.strokeStyle = '#222';
	ctx.stroke();

	drawNodeLabel(ctx, symbol, x, y);
}

/**
 * Zeichnet eine CFG-Kante als Pfeil.
 */
export function drawArrow(ctx, fromX, fromY, toX, toY, color = '#555', width = 2) {
	const headLength = 15;
	const { startX, startY, endX, endY, angle } = getArrowEndpoints(fromX, fromY, toX, toY);

	drawLine(ctx, startX, startY, endX, endY, color, width);
	drawArrowHead(ctx, endX, endY, angle, headLength, color);
}

/**
 * Zeichnet eine gekruemmte CFG-Kante fuer Kantenentflechtung.
 */
export function drawCurvedArrow(ctx, fromX, fromY, toX, toY, sign = 1, color = '#555', width = 2, curveDist = 50) {
	const headLength = 15;
	const { startX, startY, endX, endY } = getArrowEndpoints(fromX, fromY, toX, toY);
	const { ctrlX, ctrlY } = getCurveControlPoint(startX, startY, endX, endY, sign, curveDist);

	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();

	const tanX = endX - ctrlX;
	const tanY = endY - ctrlY;
	const tanAng = Math.atan2(tanY, tanX);
	drawArrowHead(ctx, endX, endY, tanAng, headLength, color);
}

/**
 * Zeichnet eine Selbstschleife fuer rekursive CFG-Produktionen.
 */
export function drawSelfLoop(ctx, x, y, color = '#555', width = 2) {
	const loopRadius = 25;
	const headLength = 12;
	const { arcX, arcY } = getSelfLoopArcOrigin(x, y, loopRadius);
	const { arrowX, arrowY, arrowAngle } = getSelfLoopArrow(arcX, arcY, loopRadius);

	ctx.beginPath();
	ctx.arc(arcX, arcY, loopRadius, 0.2 * Math.PI, 1.8 * Math.PI);
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();

	drawArrowHead(ctx, arrowX, arrowY, arrowAngle, headLength, color);
}

/**
 * Misst den Abstand eines Punktes zu einer CFG-Kante.
 */
export function distancePointToSegment(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	if (dx === 0 && dy === 0) {
		const ddx = px - x1;
		const ddy = py - y1;
		return Math.sqrt(ddx * ddx + ddy * ddy);
	}
	const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
	const tt = Math.max(0, Math.min(1, t));
	const projX = x1 + tt * dx;
	const projY = y1 + tt * dy;
	const ddx = px - projX;
	const ddy = py - projY;
	return Math.sqrt(ddx * ddx + ddy * ddy);
}

/**
 * Waehlt die Fuellfarbe eines CFG-Knotens.
 */
function getNodeFillColor(symbol) {
	if (isEpsilon(symbol)) return '#9C27B0';
	if (symbol === 'S' || symbol === 'S0') return '#ff9900';
	return '#abababff';
}

/**
 * Zeichnet das Symbol eines CFG-Knotens.
 */
function drawNodeLabel(ctx, symbol, x, y) {
	ctx.fillStyle = '#000';
	ctx.font = isEpsilon(symbol) ? 'italic bold 14px Arial' : 'bold 16px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(symbol, x, y);
}

/**
 * Berechnet Pfeilstart/-ende fuer CFG-Kanten.
 */
function getArrowEndpoints(fromX, fromY, toX, toY) {
	const angle = Math.atan2(toY - fromY, toX - fromX);
	const startX = fromX + NODE_RADIUS * Math.cos(angle);
	const startY = fromY + NODE_RADIUS * Math.sin(angle);
	const endX = toX - NODE_RADIUS * Math.cos(angle);
	const endY = toY - NODE_RADIUS * Math.sin(angle);
	return { startX, startY, endX, endY, angle };
}

/**
 * Zeichnet eine Basislinie fuer CFG-Kanten.
 */
function drawLine(ctx, startX, startY, endX, endY, color, width) {
	ctx.beginPath();
	ctx.moveTo(startX, startY);
	ctx.lineTo(endX, endY);
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.stroke();
}

/**
 * Zeichnet die Pfeilspitze einer CFG-Kante.
 */
function drawArrowHead(ctx, x, y, angle, headLength, color) {
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(
		x - headLength * Math.cos(angle - Math.PI / 6),
		y - headLength * Math.sin(angle - Math.PI / 6)
	);
	ctx.lineTo(
		x - headLength * Math.cos(angle + Math.PI / 6),
		y - headLength * Math.sin(angle + Math.PI / 6)
	);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
}

/**
 * Berechnet den Kontrollpunkt fuer gekruemmte CFG-Kanten.
 */
function getCurveControlPoint(startX, startY, endX, endY, sign, curveDist) {
	const midX = (startX + endX) / 2;
	const midY = (startY + endY) / 2;
	const vx = endX - startX;
	const vy = endY - startY;
	const len = Math.sqrt(vx * vx + vy * vy) || 1;
	const perpX = (-vy / len) * sign;
	const perpY = (vx / len) * sign;
	return {
		ctrlX: midX + perpX * curveDist,
		ctrlY: midY + perpY * curveDist,
	};
}

/**
 * Bestimmt die Position einer Selbstschleife im CFG-Graph.
 */
function getSelfLoopArcOrigin(x, y, loopRadius) {
	return {
		arcX: x - NODE_RADIUS - loopRadius + 5,
		arcY: y,
	};
}

/**
 * Berechnet die Pfeilposition fuer eine CFG-Selbstschleife.
 */
function getSelfLoopArrow(arcX, arcY, loopRadius) {
	const arrowX = arcX + loopRadius * Math.cos(1.8 * Math.PI);
	const arrowY = arcY + loopRadius * Math.sin(1.8 * Math.PI);
	const arrowAngle = 1.8 * Math.PI + Math.PI / 2;
	return { arrowX, arrowY, arrowAngle };
}
