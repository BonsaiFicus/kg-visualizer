import { useEffect } from 'react';

/**
 * Ermoeglicht das Oeffnen der CFG-Seitenleisten per Rand-Geste oder Tap.
 */
export default function useEdgeSwipe({ onOpenLeft, onOpenRight, enableRight = true }) {
	useEffect(() => {
		let startX = null;
		let startY = null;
		let startTime = null;
		let tracking = false;
		let width = window.innerWidth;

		const handleResize = () => {
			width = window.innerWidth;
		};

		const onPointerDown = (e) => {
			if (!isSupportedPointer(e)) return;
			
			// Ignoriere Clicks auf Sidebar-Toggle-Buttons
			if (e.target && e.target.closest('.sidebar-toggle')) return;
			
			const { clientX, clientY } = e;
			if (!isEdgeStart(clientX, width)) return;

			tracking = true;
			startX = clientX;
			startY = clientY;
			startTime = Date.now();
		};

		const onPointerUp = (e) => {
			if (!tracking) return;

			const { clientX, clientY } = e;
			const deltaX = clientX - startX;
			const deltaY = Math.abs(clientY - startY);
			const deltaTime = Date.now() - startTime;

			// Tap erkennen: sehr kurz (< 300ms) und wenig Bewegung (< 10px)
			const isTap = deltaTime < 300 && Math.abs(deltaX) < 10 && deltaY < 10;

			if (isTap) {
				// Tap auf linkem Rand
				if (startX <= EDGE_BUFFER && onOpenLeft) {
					onOpenLeft();
				}
				// Tap auf rechtem Rand
				if (enableRight && startX >= width - EDGE_BUFFER && onOpenRight) {
					onOpenRight();
				}
			} else if (deltaY <= MAX_VERTICAL_DRIFT) {
				// Swipe-Gesten
				if (startX <= EDGE_BUFFER && deltaX > MIN_DELTA && onOpenLeft) {
					onOpenLeft();
				}
				if (enableRight && startX >= width - EDGE_BUFFER && deltaX < -MIN_DELTA && onOpenRight) {
					onOpenRight();
				}
			}

			tracking = false;
			startX = null;
			startY = null;
			startTime = null;
		};

		const cancelTracking = () => {
			tracking = false;
			startX = null;
			startY = null;
			startTime = null;
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', cancelTracking);
		window.addEventListener('blur', cancelTracking);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', cancelTracking);
			window.removeEventListener('blur', cancelTracking);
		};
	}, [onOpenLeft, onOpenRight, enableRight]);
}

const EDGE_BUFFER = 36;
const MIN_DELTA = 60;
const MAX_VERTICAL_DRIFT = 120;

/**
 * Filtert Pointer-Events fuer die CFG-UI-Interaktion.
 */
function isSupportedPointer(event) {
	return event.pointerType === 'mouse' || event.pointerType === 'touch';
}

/**
 * Prueft, ob die Geste am Rand der CFG-UI startet.
 */
function isEdgeStart(x, width) {
	return x <= EDGE_BUFFER || x >= width - EDGE_BUFFER;
}
