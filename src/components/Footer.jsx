import React, { useEffect, useState } from 'react';
import '../styles/footer.css';
import { useStepManager, stepManager } from '../algorithm/steps.js';

/**
 * Steuerleiste fuer die schrittweise CFG-Analyse.
 */
export default function Footer({
	visible,
	analyzeFlag,
	footerResetTrigger,
	forceDefaultFooter
}) {
	const showControls = analyzeFlag && visible && !forceDefaultFooter;
	const {
		progress,
		totalSteps,
		isPlaying,
		next,
		prev,
		play,
		pause
	} = useStepManager();

	const [isEmptyLanguage, setIsEmptyLanguage] = useState(null);
	const [isInfinite, setIsInfinite] = useState(null);

	useEffect(() => {
		setIsEmptyLanguage(null);
		setIsInfinite(null);
	}, [footerResetTrigger]);

	useEffect(() => {
		const unsubscribe = stepManager.subscribe((status) => {
			const step = status.currentStep;

			if (step?.stage === 'result' && step.state?.isEmptyLanguage !== null) {
				setIsEmptyLanguage(step.state.isEmptyLanguage);
			}

			if (step?.stage === 'cnf-binary' &&
				step.delta?.action === 'result' &&
				step.state?.isInfinite !== null) {
				setIsInfinite(step.state.isInfinite);
			}
		});

		return () => unsubscribe();
	}, []);

	/**
	 * Steuert die automatische Wiedergabe der CFG-Schritte.
	 */
	const handlePlayPause = () => {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
	};

	return (
		<footer className={`app-footer ${visible ? 'visible' : ''}`}>
			{showControls ? (
				<div className="footer-layout">
					<div className="footer-property-left">
						{renderLanguageProperty(isEmptyLanguage, 'LEER', 'NICHT LEER')}
					</div>

					<div className="footer-controls">
						<button
							className="footer-btn"
							title="Schritt zurück"
							onClick={prev}
						>
							◄
						</button>
						<button
							className="footer-btn footer-btn-main"
							title={isPlaying ? "Pausieren" : "Abspielen"}
							onClick={handlePlayPause}
						>
							{isPlaying ? '⏸' : '⏯'}
						</button>
						<button
							className="footer-btn"
							title="Schritt vorwärts"
							onClick={next}
						>
							►
						</button>
						<p>Schritt {progress}/{totalSteps}</p>
					</div>

					<div className="footer-property-right">
						{isEmptyLanguage === true ? (
							<span style={{ color: '#00ff00', fontWeight: 'bold' }}>ENDLICH</span>
						) : (
							renderLanguageProperty(isInfinite, 'UNENDLICH', 'ENDLICH')
						)}
					</div>
				</div>
			) : (
				<p>KG-Visualizer © 2025</p>
			)}
		</footer>
	);
}

/**
 * Rendert ein ermitteltes CFG-Sprachenmerkmal.
 */
function renderLanguageProperty(value, trueLabel, falseLabel) {
	if (value === null) return null;
	return (
		<span style={{ color: value ? '#FF6B6B' : '#00ff00', fontWeight: 'bold' }}>
			{value ? trueLabel : falseLabel}
		</span>
	);
}
