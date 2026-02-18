import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState
} from 'react';
import useViewportControls from '../controls/useViewportControls.js';
import buildTreeLayout from '../algorithm/makeTree.js';
import { renderEdges } from '../algorithm/rendering/renderEdges.js';
import { renderNodes } from '../algorithm/rendering/renderNodes.js';
import { computeEdgeCurves } from '../algorithm/rendering/computeEdgeCurves.js';
import { stepManager } from '../algorithm/steps.js';

const GRID_SIZE = 20;
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

/**
 * Zeichnet die aktuelle CFG als Graph mit Knoten und Produktionen.
 */
const Canvas = forwardRef(function Canvas({ grammar, onConnectedProductionsChange }, ref) {
	const canvasRef = useRef(null);
	const controls = useViewportControls(canvasRef, { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT });
	const { scale, offset, viewport, isPanning, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel, zoomIn, zoomOut, resetView, setOffsetClamped } = controls;

	const treeLayoutCache = useRef(null);
	const cachedGrammar = useRef(null);
	const [highlightTrigger, setHighlightTrigger] = useState(0);

	useEffect(() => {
		const unsubscribe = stepManager.subscribe(() => {
			setHighlightTrigger(prev => prev + 1);
		});
		return unsubscribe;
	}, []);

	useImperativeHandle(ref, () => ({
		zoomIn,
		zoomOut,
		resetView
	}), [viewport]);

	/**
	 * Rendert den CFG-Graphen fuer die aktuelle Grammatik.
	 */
	const draw = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		resizeCanvasToDisplaySize(canvas);

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(offset.x, offset.y);
		ctx.scale(scale, scale);
		drawGrid(ctx, scale);

		if (hasStartSymbol(grammar)) {
			const { nodes, edges, connectedProductions } = getTreeLayout(grammar, cachedGrammar, treeLayoutCache);
			if (onConnectedProductionsChange) {
				onConnectedProductionsChange(connectedProductions, null, { nodes, edges, connectedProductions });
			}

			const edgeCurveInfo = getEdgeCurveInfo(grammar, cachedGrammar, treeLayoutCache, nodes, edges);
			renderEdges(ctx, edges, edgeCurveInfo);
			renderNodes(ctx, nodes, edges);
		}

		ctx.restore();
	};

	useEffect(() => {
		draw();
	}, [scale, offset, viewport, grammar, highlightTrigger]);


	useEffect(() => {
		if (!hasStartSymbol(grammar)) return;

		const viewW = viewport.width || canvasRef.current?.clientWidth || window.innerWidth;
		const viewH = viewport.height || canvasRef.current?.clientHeight || window.innerHeight;
		if (!viewW || !viewH) return;

		const centerX = CANVAS_WIDTH / 2;
		const centerY = CANVAS_HEIGHT / 2;
		const candidate = {
			x: viewW / 2 - centerX * scale,
			y: viewH / 2 - centerY * scale
		};

		setOffsetClamped(candidate, scale);
	}, [grammar, viewport.width, viewport.height]);

	return (
		<div className="canvas">
			<canvas
				ref={canvasRef}
				className="canvas-element"
				onMouseDown={onMouseDown}
				onMouseMove={onMouseMove}
				onMouseUp={onMouseUp}
				onMouseLeave={onMouseLeave}
				onWheel={onWheel}
				style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
			/>
		</div>
	);
});

/**
 * Synchronisiert die Canvas-Groesse fuer CFG-Rendering.
 */
function resizeCanvasToDisplaySize(canvas) {
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
}

/**
 * Zeichnet ein Raster als Orientierung fuer CFG-Knoten.
 */
function drawGrid(ctx, scale) {
	ctx.strokeStyle = '#e0e0e0';
	ctx.lineWidth = 1 / scale;

	for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, CANVAS_HEIGHT);
		ctx.stroke();
	}

	for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(CANVAS_WIDTH, y);
		ctx.stroke();
	}
}

/**
 * Prueft, ob die CFG ein Startsymbol besitzt.
 */
function hasStartSymbol(grammar) {
	return grammar && (
		(grammar.nonTerminals && grammar.nonTerminals.includes('S')) ||
		(grammar.productions && grammar.productions.S)
	);
}

/**
 * Baut oder cached das Layout des CFG-Graphen.
 */
function getTreeLayout(grammar, cachedGrammar, treeLayoutCache) {
	if (cachedGrammar.current !== grammar) {
		cachedGrammar.current = grammar;
		treeLayoutCache.current = buildTreeLayout(grammar, CANVAS_WIDTH, CANVAS_HEIGHT);
	}
	return treeLayoutCache.current;
}

/**
 * Berechnet Kantenkrummung fuer CFG-Produktionen.
 */
function getEdgeCurveInfo(grammar, cachedGrammar, treeLayoutCache, nodes, edges) {
	if (cachedGrammar.current === grammar) {
		if (!treeLayoutCache.current.edgeCurveInfo) {
			treeLayoutCache.current.edgeCurveInfo = computeEdgeCurves(edges, nodes);
		}
		return treeLayoutCache.current.edgeCurveInfo;
	}

	return computeEdgeCurves(edges, nodes);
}

export default Canvas;
