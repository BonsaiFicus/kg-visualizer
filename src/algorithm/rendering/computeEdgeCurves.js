import { distancePointToSegment } from './drawingFunctions.js';

const NODE_RADIUS = 22;

/**
 * Berechnet Kantenkruemmung fuer CFG-Produktionen.
 */
export function computeEdgeCurves(edges, nodes) {
	const edgeCurveInfo = new Map();
	const pairMap = buildPairMap(edges);
	const pairs = Array.from(pairMap.values());

	for (let i = 0; i < pairs.length; i++) {
		const pair = pairs[i];

		if (isBidirectionalPair(pair)) {
			applyBidirectionalCurves(edgeCurveInfo, pair);
			continue;
		}

		for (let j = 0; j < pair.length; j++) {
			const edge = pair[j];
			const curveInfo = computeCurveFromNearbyNodes(edge, nodes);
			edgeCurveInfo.set(edgeKey(edge), curveInfo);
		}
	}

	return edgeCurveInfo;
}

/**
 * Erzeugt einen stabilen Schluessel fuer CFG-Kanten.
 */
function edgeKey(edge) {
	return `${edge.from.symbol}|${edge.from.x},${edge.from.y}->${edge.to.symbol}|${edge.to.x},${edge.to.y}`;
}

/**
 * Gruppiert CFG-Kanten nach Symbolpaaren.
 */
function buildPairMap(edges) {
	const pairMap = new Map();

	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i];

		if (edge.isSelfLoop) {
			continue;
		}

		const key = [edge.from.symbol, edge.to.symbol].sort().join('|');
		const arr = pairMap.get(key) || [];
		arr.push(edge);
		pairMap.set(key, arr);
	}

	return pairMap;
}

/**
 * Prueft, ob ein Symbolpaar in beiden Richtungen vorkommt.
 */
function isBidirectionalPair(pair) {
	return pair.length === 2 && pair[0].from.symbol !== pair[1].from.symbol;
}

/**
 * Markiert eine Kante als gekruemmt, um Gegenkanten zu trennen.
 */
function applyBidirectionalCurves(edgeCurveInfo, pair) {
	const [e1, e2] = pair;
	const curved = (e1.from.symbol < e1.to.symbol) ? e1 : e2;
	const straight = (curved === e1) ? e2 : e1;

	edgeCurveInfo.set(edgeKey(curved), { shouldCurve: true, sign: 1, dist: 60 });
	edgeCurveInfo.set(edgeKey(straight), { shouldCurve: false, sign: 0, dist: 0 });
}

/**
 * Weicht CFG-Kanten aus, die nahe an Knoten verlaufen.
 */
function computeCurveFromNearbyNodes(edge, nodes) {
	const startX = edge.from.x;
	const startY = edge.from.y;
	const endX = edge.to.x;
	const endY = edge.to.y;
	const midX = (startX + endX) / 2;
	const midY = (startY + endY) / 2;
	const vx = endX - startX;
	const vy = endY - startY;
	const len = Math.sqrt(vx * vx + vy * vy) || 1;
	const perpX = -vy / len;
	const perpY = vx / len;

	const nearHit = findNearestNodeNearEdge(nodes, edge, startX, startY, endX, endY);

	if (!nearHit) {
		return { shouldCurve: false, sign: 1, dist: 50 };
	}

	const midToNodeX = nearHit.node.x - midX;
	const midToNodeY = nearHit.node.y - midY;
	const dot = midToNodeX * perpX + midToNodeY * perpY;
	const sign = (dot >= 0) ? -1 : 1;

	return { shouldCurve: true, sign, dist: 50 };
}

/**
 * Findet den naechsten Knoten nahe einer CFG-Kante.
 */
function findNearestNodeNearEdge(nodes, edge, startX, startY, endX, endY) {
	let nearHit = null;

	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];

		if (n.symbol === edge.from.symbol && n.x === startX && n.y === startY) {
			continue;
		}

		if (n.symbol === edge.to.symbol && n.x === endX && n.y === endY) {
			continue;
		}

		const d = distancePointToSegment(n.x, n.y, startX, startY, endX, endY);

		if (d < NODE_RADIUS + 8 && (!nearHit || d < nearHit.d)) {
			nearHit = { node: n, d };
		}
	}

	return nearHit;
}
