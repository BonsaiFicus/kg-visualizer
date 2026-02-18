import { useState, useEffect } from 'react';

/**
 * Verwalter der CFG-Schritte fuer Wiedergabe und Navigation.
 */
class StepManager {
	/**
	 * Initialisiert den Zustand fuer CFG-Step-Sequenzen.
	 */
	constructor() {
		this.steps = [];
		this.currentIndex = 0;
		this.isPlaying = false;
		this.playbackSpeed = 1000;
		this.playbackInterval = null;
		this.listeners = new Set();
	}

	/**
	 * Setzt die CFG-Analyseschritte und startet am Anfang.
	 */
	initializeSteps(newSteps) {
		this.steps = newSteps;
		this.currentIndex = 0;
		this.isPlaying = false;
		this.clearPlayback();
		this.notifyListeners();
	}

	/**
	 * Springt einen CFG-Schritt vor.
	 */
	next() {
		if (!this.canAdvance()) return;
		this.currentIndex++;
		this.notifyListeners();
	}

	/**
	 * Springt einen CFG-Schritt zurueck.
	 */
	prev() {
		if (this.currentIndex > 0) {
			this.currentIndex--;
			this.notifyListeners();
		}
	}

	/**
	 * Startet die automatische Wiedergabe der CFG-Schritte.
	 */
	play() {
		if (this.isPlaying || !this.canAdvance()) return;

		this.isPlaying = true;
		this.playbackInterval = setInterval(() => {
			this.advancePlayback();
		}, this.playbackSpeed);

		this.notifyListeners();
	}

	/**
	 * Pausiert die Wiedergabe der CFG-Schritte.
	 */
	pause() {
		this.isPlaying = false;
		this.clearPlayback();
		this.notifyListeners();
	}

	/**
	 * Laesst alle CFG-Schritte ausfuehren und springt zum Ende.
	 */
	skipToEnd() {
		this.pause();
		this.replayAllRemainingSteps();
	}

	/**
	 * Setzt die CFG-Schrittnavigation auf den Anfang.
	 */
	reset() {
		this.pause();
		this.currentIndex = 0;
		this.notifyListeners();
	}

	/**
	 * Springt zu einem bestimmten CFG-Schritt.
	 */
	jumpToStep(index) {
		if (index >= 0 && index < this.steps.length) {
			this.pause();
			this.currentIndex = index;
			this.notifyListeners();
		}
	}

	/**
	 * Setzt die Abspielgeschwindigkeit fuer CFG-Schritte.
	 */
	setPlaybackSpeed(speed) {
		this.playbackSpeed = speed;
		if (this.isPlaying) {
			this.pause();
			this.play();
		}
	}

	/**
	 * Liefert den aktuellen CFG-Schritt.
	 */
	getCurrentStep() {
		return this.steps[this.currentIndex] || null;
	}

	/**
	 * Liefert alle CFG-Schritte.
	 */
	getSteps() {
		return this.steps;
	}

	/**
	 * Liefert den UI-Status der CFG-Schritte.
	 */
	getStatus() {
		return {
			currentIndex: this.currentIndex,
			totalSteps: this.steps.length,
			isPlaying: this.isPlaying,
			currentStep: this.getCurrentStep(),
			progress: this.steps.length > 0 ? this.currentIndex + 1 : 0
		};
	}

	/**
	 * Registriert einen Listener fuer CFG-Statusaenderungen.
	 */
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Benachrichtigt alle Listener ueber CFG-Schrittstatus.
	 */
	notifyListeners() {
		this.listeners.forEach(listener => listener(this.getStatus()));
	}

	/**
	 * Beendet die Wiedergabe-Timer fuer CFG-Schritte.
	 */
	clearPlayback() {
		if (this.playbackInterval) {
			clearInterval(this.playbackInterval);
			this.playbackInterval = null;
		}
	}

	/**
	 * Gibt Ressourcen der CFG-Steuerung frei.
	 */
	destroy() {
		this.clearPlayback();
		this.listeners.clear();
	}

	/**
	 * Prueft, ob es einen naechsten CFG-Schritt gibt.
	 */
	canAdvance() {
		return this.currentIndex < this.steps.length - 1;
	}

	/**
	 * Fuehrt einen Abspielschritt fuer CFG-Animationen aus.
	 */
	advancePlayback() {
		if (this.canAdvance()) {
			this.currentIndex++;
			this.notifyListeners();
			return;
		}
		this.pause();
	}

	/**
	 * Spielt alle verbleibenden CFG-Schritte ab.
	 */
	replayAllRemainingSteps() {
		for (let i = this.currentIndex; i < this.steps.length; i++) {
			this.currentIndex = i;
			this.notifyListeners();
		}
	}
}

export const stepManager = new StepManager();

/**
 * React-Hook fuer CFG-Schrittstatus und Steuerung.
 */
export function useStepManager() {
	const [status, setStatus] = useState(stepManager.getStatus());

	useEffect(() => {
		const unsubscribe = stepManager.subscribe(setStatus);
		return unsubscribe;
	}, []);

	return {
		...status,
		next: () => stepManager.next(),
		prev: () => stepManager.prev(),
		play: () => stepManager.play(),
		pause: () => stepManager.pause(),
		skipToEnd: () => stepManager.skipToEnd(),
		reset: () => stepManager.reset(),
		jumpToStep: (index) => stepManager.jumpToStep(index),
		setPlaybackSpeed: (speed) => stepManager.setPlaybackSpeed(speed),
	};
}

/**
 * Erstellt einfache CFG-Demo-Schritte fuer die UI.
 */
export function generateExampleSteps() {
	const steps = [];

	steps.push({
		id: "step-0",
		stage: "Initialisierung",
		description: "Visualisierung startet",
		delta: { clearLogs: true },
		state: { progress: 0, completed: false },
		clearLogs: false
	});

	for (let i = 1; i < 10; i++) {
		steps.push({
			id: `step-${i}`,
			stage: i < 3 ? "Initialisierung" : i < 7 ? "parsing" : "rendering",
			description: `Schritt ${i}: Etappe ${i < 3 ? "Init" : i < 7 ? "Parsing" : "Rendering"}`,
			delta: { iteration: i },
			state: { progress: i, completed: false },
			clearLogs: false
		});
	}

	steps.push({
		id: "step-final",
		stage: "complete",
		description: "Visualisierung abgeschlossen!",
		delta: { finished: true },
		state: { progress: 10, completed: true },
		clearLogs: false
	});

	return steps;
}

export default stepManager;