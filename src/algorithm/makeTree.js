/**
 * Erzeugt ein Layout fuer den CFG-Graphen.
 */
export default function buildTreeLayout(grammar, canvasWidth = 2000, canvasHeight = 2000) {
	if (!grammar || !grammar.productions) return { nodes: [], edges: [], connectedProductions: {} };
	const nodes = [];
	const edges = [];
	const connectedProductions = {};
	const nodePositions = new Map();
	const visited = new Set();
	const hasEpsilonProduction = new Set();
	const layoutConfig = {
		rankWidth: 150,
		rankHeight: 100,
		minDistance: 80,
	};

	const startX = canvasWidth / 2;
	const startY = canvasHeight / 2;

	buildNodes({
		grammar,
		nodes,
		visited,
		nodePositions,
		connectedProductions,
		hasEpsilonProduction,
		layoutConfig,
		startX,
		startY,
	});

	maybeAddEpsilonNode({
		nodes,
		nodePositions,
		hasEpsilonProduction,
		layoutConfig,
		startX,
		startY,
	});

	relaxNodeOverlaps(nodes, nodePositions, layoutConfig.minDistance);
	buildEdges({ grammar, edges, nodePositions });

	return { nodes, edges, connectedProductions };
}

/**
 * Tokenisiert eine CFG-Produktion fuer Knoten/Kanten-Aufbau.
 */
function tokenizeProduction(prod) {
	return prod.match(/D_\d+|[A-Z](?:_[a-z])?|[a-z]/g) || [];
}

/**
 * Loest lokale Ueberlappungen zwischen CFG-Knoten.
 */
function resolveCollision(nodes, x, y, minDistance) {
	let adjustedX = x;
	let adjustedY = y;
	const maxAttempts = 20;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		let hasCollision = false;

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			const dx = adjustedX - node.x;
			const dy = adjustedY - node.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance >= minDistance) {
				continue;
			}

			hasCollision = true;

			if (distance > 0) {
				const angle = Math.atan2(dy, dx);
				const pushDist = minDistance - distance;
				adjustedX += Math.cos(angle) * pushDist;
				adjustedY += Math.sin(angle) * pushDist;
			} else {
				adjustedX += (Math.random() - 0.5) * minDistance;
				adjustedY += (Math.random() - 0.5) * minDistance;
			}
		}

		if (!hasCollision) {
			break;
		}
	}

	return { x: adjustedX, y: adjustedY };
}

/**
 * Baut die CFG-Knoten und ihre Positionsdaten.
 */
function buildNodes({
	grammar,
	nodes,
	visited,
	nodePositions,
	connectedProductions,
	hasEpsilonProduction,
	layoutConfig,
	startX,
	startY,
}) {
	const startSymbol = grammar.startSymbol || 'S';
	const queue = [{ symbol: startSymbol, x: startX, y: startY, rank: 0, parent: null }];
	visited.add(startSymbol);
	nodes.push({ symbol: startSymbol, x: startX, y: startY });
	nodePositions.set(startSymbol, { x: startX, y: startY });

	while (queue.length > 0) {
		const current = queue.shift();
		const productions = grammar.productions[current.symbol] || [];

		if (productions.length > 0) {
			connectedProductions[current.symbol] = productions;
		}

		const childSymbols = collectChildSymbols(productions, visited, hasEpsilonProduction, current.symbol);
		const childCount = childSymbols.length;

		for (let index = 0; index < childCount; index++) {
			const child = childSymbols[index];
			const offsetX = (index - (childCount - 1) / 2) * layoutConfig.rankWidth;
			let childX = current.x + offsetX;
			const depthFactor = 1 + (child.extraDepth || 0);
			let childY = current.y + layoutConfig.rankHeight * depthFactor;

			const adjusted = resolveCollision(nodes, childX, childY, layoutConfig.minDistance);
			childX = adjusted.x;
			childY = adjusted.y;

			nodes.push({ symbol: child.symbol, x: childX, y: childY, isTerminal: child.isTerminal });
			nodePositions.set(child.symbol, { x: childX, y: childY });
			queue.push({
				symbol: child.symbol,
				x: childX,
				y: childY,
				rank: current.rank + 1,
				parent: current.symbol
			});
		}
	}
}

/**
 * Sammelt Kindknoten aus CFG-Produktionen.
 */
function collectChildSymbols(productions, visited, hasEpsilonProduction, currentSymbol) {
	const childSymbols = [];

	for (let i = 0; i < productions.length; i++) {
		const prod = productions[i];

		if (prod === 'eps') {
			hasEpsilonProduction.add(currentSymbol);
			continue;
		}

		const tokens = tokenizeProduction(prod);
		for (let j = 0; j < tokens.length; j++) {
			const tok = tokens[j];

			if (/^[A-Z]/.test(tok) && !visited.has(tok)) {
				const extraDepth = /^C_|^T_/.test(tok) ? 1 : 0;
				childSymbols.push({ symbol: tok, isTerminal: false, key: tok, extraDepth });
				visited.add(tok);
			}
		}
	}

	return childSymbols;
}

/**
 * Fuegt einen gemeinsamen ε-Knoten fuer die CFG hinzu.
 */
function maybeAddEpsilonNode({ nodes, nodePositions, hasEpsilonProduction, layoutConfig, startX, startY }) {
	if (hasEpsilonProduction.size === 0) return;

	let epsX = startX + layoutConfig.rankWidth * 2;
	let epsY = startY + layoutConfig.rankHeight * 2;
	const adjusted = resolveCollision(nodes, epsX, epsY, layoutConfig.minDistance);
	epsX = adjusted.x;
	epsY = adjusted.y;

	nodes.push({ symbol: 'eps', x: epsX, y: epsY, isTerminal: true });
	nodePositions.set('eps', { x: epsX, y: epsY });
}

/**
 * Iterative Entflechtung, damit CFG-Knoten nicht ueberlappen.
 */
function relaxNodeOverlaps(nodes, nodePositions, minDistance) {
	const maxIterations = 30;

	for (let iter = 0; iter < maxIterations; iter++) {
		let hasOverlap = false;

		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const nodeA = nodes[i];
				const nodeB = nodes[j];

				const dx = nodeB.x - nodeA.x;
				const dy = nodeB.y - nodeA.y;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < minDistance && distance > 0) {
					hasOverlap = true;

					const pushDistance = (minDistance - distance) / 2;
					const angle = Math.atan2(dy, dx);
					const pushX = Math.cos(angle) * pushDistance;
					const pushY = Math.sin(angle) * pushDistance;

					nodeA.x -= pushX;
					nodeA.y -= pushY;
					nodeB.x += pushX;
					nodeB.y += pushY;

					const keyA = nodeA.symbol === 'eps' ? 'eps' : nodeA.symbol;
					const keyB = nodeB.symbol === 'eps' ? 'eps' : nodeB.symbol;
					nodePositions.set(keyA, { x: nodeA.x, y: nodeA.y });
					nodePositions.set(keyB, { x: nodeB.x, y: nodeB.y });
				}
			}
		}

		if (!hasOverlap) break;
	}
}

/**
 * Baut die CFG-Kanten aus den Produktionen.
 */
function buildEdges({ grammar, edges, nodePositions }) {
	const startSymbol = grammar.startSymbol || 'S';
	const visited = new Set();
	const edgeQueue = [{ symbol: startSymbol, ...nodePositions.get(startSymbol) }];
	visited.add(startSymbol);

	while (edgeQueue.length > 0) {
		const current = edgeQueue.shift();
		const productions = grammar.productions[current.symbol] || [];

		const hasSelfLoop = checkForSelfLoop(productions, current.symbol);
		if (hasSelfLoop) {
			edges.push({ from: current, to: current, isSelfLoop: true });
		}

		for (let i = 0; i < productions.length; i++) {
			const prod = productions[i];

			if (prod === 'eps') {
				addEpsilonEdge(edges, current, nodePositions);
				continue;
			}

			const tokens = tokenizeProduction(prod);
			processProductionTokens(tokens, current, edges, nodePositions, visited, edgeQueue);
		}
	}
}

/**
 * Prueft auf Selbstschleifen in CFG-Produktionen.
 */
function checkForSelfLoop(productions, symbol) {
	for (let i = 0; i < productions.length; i++) {
		const tokens = tokenizeProduction(productions[i]);
		if (tokens.includes(symbol)) {
			return true;
		}
	}
	return false;
}

/**
 * Fuegt eine Epsilon-Kante zum CFG-Graphen hinzu.
 */
function addEpsilonEdge(edges, current, nodePositions) {
	const epsPos = nodePositions.get('eps');
	if (epsPos) {
		edges.push({ from: current, to: { symbol: 'eps', ...epsPos } });
	}
}

/**
 * Verarbeitet Tokens einer CFG-Produktion fuer Kantenerstellung.
 */
function processProductionTokens(tokens, current, edges, nodePositions, visited, edgeQueue) {
	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];

		if (!/^[A-Z]/.test(tok)) {
			continue;
		}

		if (tok === current.symbol) {
			continue;
		}

		const targetPos = nodePositions.get(tok);
		if (targetPos) {
			edges.push({ from: current, to: { symbol: tok, ...targetPos } });
		}

		if (!visited.has(tok)) {
			visited.add(tok);
			edgeQueue.push({ symbol: tok, ...targetPos });
		}
	}
}
