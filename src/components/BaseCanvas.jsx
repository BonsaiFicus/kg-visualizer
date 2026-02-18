import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import useViewportControls from '../controls/useViewportControls.js';

const GRID_SIZE = 20;
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

/**
 * Grund-Canvas fuer die Darstellung von CFG-Knoten und -Kanten.
 */
const BaseCanvas = forwardRef(function BaseCanvas(
	{
		renderContent,
		grammar,
		treeLayout,
		fixpointComplete,
		viewportCenterOn = null,
		className = '',
		highlightTrigger = 0
	},
	ref
) {
	const canvasRef = useRef(null);
	const controls = useViewportControls(canvasRef, {
		canvasWidth: CANVAS_WIDTH,
		canvasHeight: CANVAS_HEIGHT
	});
	const {
		scale,
		offset,
		viewport,
		isPanning,
		onMouseDown,
		onMouseMove,
		onMouseUp,
		onMouseLeave,
		onWheel,
		zoomIn,
		zoomOut,
		resetView,
		setOffsetClamped
	} = controls;

	useImperativeHandle(ref, () => ({
		zoomIn,
		zoomOut,
		resetView
	}), [viewport]);

	useEffect(() => {
		if (!viewportCenterOn) return;

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
	}, [viewportCenterOn, viewport.width, viewport.height, scale]);

	/**
	 * Rendert die CFG-Visualisierung in den aktuellen Viewport.
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
		if (renderContent) {
			renderContent(ctx, {
				grammar,
				treeLayout,
				fixpointComplete,
				CANVAS_WIDTH,
				CANVAS_HEIGHT
			});
		}

		ctx.restore();
	};

	useEffect(() => {
		draw();
	}, [scale, offset, viewport, grammar, treeLayout, fixpointComplete, renderContent, highlightTrigger]);

	return (
		<div className={`canvas ${className}`}>
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
 * Synchronisiert die Canvas-Groesse fuer CFG-Rendering im Viewport.
 */
function resizeCanvasToDisplaySize(canvas) {
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width;
	canvas.height = rect.height;
}

/**
 * Zeichnet ein Orientierungsgitter fuer CFG-Grafen.
 */
function drawGrid(ctx, scale) {
	ctx.strokeStyle = '#e0e0e0';
	ctx.lineWidth = 1 / scale;

	for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, CANVAS_WIDTH);
		ctx.stroke();
	}

	for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(CANVAS_WIDTH, y);
		ctx.stroke();
	}
}

export { BaseCanvas, GRID_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT };
export default BaseCanvas;
