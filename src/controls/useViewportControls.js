import { useEffect, useState } from 'react';

/**
 * Viewport-Steuerung fuer die Darstellung von CFG-Grafen.
 */
export default function useViewportControls(canvasRef, { canvasWidth, canvasHeight }) {
	const [scale, setScale] = useState(1);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
	const [viewport, setViewport] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateViewport = () => {
			if (!canvasRef.current) return;
			setViewport({
				width: canvasRef.current.clientWidth,
				height: canvasRef.current.clientHeight,
			});
		};

		updateViewport();
		window.addEventListener('resize', updateViewport);

		const handleWheel = (e) => {
			e.preventDefault();
			if (!canvasRef.current) return;
			const rect = canvasRef.current.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			zoomAt(-e.deltaY * 0.001, mouseX, mouseY);
		};

		const el = canvasRef.current;
		if (el) {
			el.addEventListener('wheel', handleWheel, { passive: false });
		}

		return () => {
			window.removeEventListener('resize', updateViewport);
			if (el) {
				el.removeEventListener('wheel', handleWheel);
			}
		};
	}, [canvasRef]);

	const clampOffset = (nextScale, candidate) => {
		const w = viewport.width || window.innerWidth;
		const h = viewport.height || window.innerHeight;
		const minX = w - canvasWidth * nextScale;
		const minY = h - canvasHeight * nextScale;
		return {
			x: Math.min(0, Math.max(candidate.x, minX)),
			y: Math.min(0, Math.max(candidate.y, minY)),
		};
	};

	const setOffsetClamped = (candidate, nextScale = scale) => {
		setOffset(clampOffset(nextScale, candidate));
	};

	const zoomAt = (delta, screenX, screenY) => {
		if (!canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const focusX = screenX ?? rect.width / 2;
		const focusY = screenY ?? rect.height / 2;
		const minScale = getMinScale(rect, canvasWidth, canvasHeight);

		setScale(prevScale => {
			const nextScale = clampScale(prevScale + delta, minScale);

			setOffset(prevOffset => {
				const candidate = computeZoomOffset({
					focusX,
					focusY,
					prevOffset,
					prevScale,
					nextScale,
				});
				return clampOffset(nextScale, candidate);
			});

			return nextScale;
		});
	};

	const resetView = () => {
		setScale(1);
		setOffset({ x: 0, y: 0 });
	};

	const onMouseDown = e => {
		if (e.button !== 0) return;
		setIsPanning(true);
		setLastPos({ x: e.clientX, y: e.clientY });
	};

	const onMouseMove = e => {
		if (!isPanning) return;
		const dx = e.clientX - lastPos.x;
		const dy = e.clientY - lastPos.y;
		setOffset(prev => {
			const candidate = { x: prev.x + dx, y: prev.y + dy };
			return clampOffset(scale, candidate);
		});
		setLastPos({ x: e.clientX, y: e.clientY });
	};

	const stopPan = () => setIsPanning(false);

	const onWheel = () => { };

	return {
		scale,
		offset,
		viewport,
		isPanning,
		zoomIn: () => zoomAt(0.1),
		zoomOut: () => zoomAt(-0.1),
		resetView,
		setOffsetClamped,
		clampOffset,
		onMouseDown,
		onMouseMove,
		onMouseUp: stopPan,
		onMouseLeave: stopPan,
		onWheel,
	};
}

const MAX_SCALE = 5;

/**
 * Mindest-Zoom fuer vollstaendige CFG-Sichtbarkeit.
 */
function getMinScale(rect, canvasWidth, canvasHeight) {
	return Math.max(rect.width / canvasWidth, rect.height / canvasHeight);
}

/**
 * Begrenzung des Zooms fuer CFG-Ansichten.
 */
function clampScale(value, minScale) {
	return Math.min(MAX_SCALE, Math.max(minScale, value));
}

/**
 * Berechnet die Verschiebung beim Zoom fuer CFG-Knoten.
 */
function computeZoomOffset({ focusX, focusY, prevOffset, prevScale, nextScale }) {
	const worldX = (focusX - prevOffset.x) / prevScale;
	const worldY = (focusY - prevOffset.y) / prevScale;
	return {
		x: focusX - worldX * nextScale,
		y: focusY - worldY * nextScale,
	};
}
