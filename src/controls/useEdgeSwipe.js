import { useEffect } from 'react';

/**
 * Ermoeglicht das Oeffnen der CFG-Seitenleisten per Rand-Geste.
 */
export default function useEdgeSwipe({ onOpenLeft, onOpenRight }) {
	useEffect(() => {
		let startX = null;
		let startY = null;
		let tracking = false;
		let width = window.innerWidth;

		const handleResize = () => {
			width = window.innerWidth;
		};

		const onPointerDown = (e) => {
			if (!isSupportedPointer(e)) return;
			const { clientX, clientY } = e;
			if (!isEdgeStart(clientX, width)) return;

			tracking = true;
			startX = clientX;
			startY = clientY;
		};

		const onPointerUp = (e) => {
			if (!tracking) return;

			const { clientX, clientY } = e;
			const deltaX = clientX - startX;
			const deltaY = Math.abs(clientY - startY);

			if (deltaY <= MAX_VERTICAL_DRIFT) {
				if (startX <= EDGE_BUFFER && deltaX > MIN_DELTA && onOpenLeft) {
					onOpenLeft();
				}
				if (startX >= width - EDGE_BUFFER && deltaX < -MIN_DELTA && onOpenRight) {
					onOpenRight();
				}
			}

			tracking = false;
			startX = null;
			startY = null;
		};

		const cancelTracking = () => {
			tracking = false;
			startX = null;
			startY = null;
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
	}, [onOpenLeft, onOpenRight]);
}

const EDGE_BUFFER = 24;
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
