import React, { useEffect, useState } from 'react';
import BaseCanvas from './BaseCanvas.jsx';
import buildTreeLayout from '../algorithm/makeTree.js';
import { computeEdgeCurves } from '../algorithm/rendering/computeEdgeCurves.js';
import { renderNodes } from '../algorithm/rendering/renderNodes.js';
import { renderEdges } from '../algorithm/rendering/renderEdges.js';
import { stepManager } from '../algorithm/steps.js';

/**
 * Zeichnet den CNF-Zwischengraphen der CFG waehrend der Transformation.
 */
const CanvasCNF = React.forwardRef(function CanvasCNF(
	{ grammar, cnfGraph, className = '', viewportCenterOn },
	ref
) {
	const [cnfTreeLayout, setCnfTreeLayout] = useState(null);
	const [highlightTrigger, setHighlightTrigger] = useState(0);
	const [currentStep, setCurrentStep] = useState(null);

	useEffect(() => {
		const handleStepChange = () => {
			setCurrentStep(stepManager.getCurrentStep());
			setHighlightTrigger(prev => prev + 1);
		};

		const unsubscribe = stepManager.subscribe(handleStepChange);
		handleStepChange(); // Initialisiere mit aktuellem Step
		return unsubscribe;
	}, []);

	useEffect(() => {
		if (cnfGraph && Object.keys(cnfGraph).length > 0) {
			// Verwende startSymbol aus dem aktuellen Step, falls vorhanden
			const startSymbol = currentStep?.state?.startSymbol || grammar.startSymbol || 'S';
			const cnfGrammar = { 
				...grammar, 
				productions: cnfGraph,
				startSymbol: startSymbol
			};
			const layout = buildTreeLayout(cnfGrammar);
			setCnfTreeLayout(layout);
		} else {
			setCnfTreeLayout(null);
		}
	}, [cnfGraph, grammar, currentStep]);

	/**
	 * Rendert den CNF-Graphen fuer die aktuelle Zwischengrammatik.
	 */
	const renderContent = (ctx) => {
		if (!cnfTreeLayout) return;

		const edgeCurveInfo = computeEdgeCurves(cnfTreeLayout.edges, cnfTreeLayout.nodes);
		renderEdges(ctx, cnfTreeLayout.edges, edgeCurveInfo);
		renderNodes(ctx, cnfTreeLayout.nodes, cnfTreeLayout.edges);
	};

	return (
		<BaseCanvas
			ref={ref}
			renderContent={renderContent}
			grammar={grammar}
			className={`canvas-cnf ${className}`}
			viewportCenterOn={viewportCenterOn}
			highlightTrigger={highlightTrigger}
		/>
	);
});

export default CanvasCNF;
