import { highlightManager } from '../rendering/highlightElements.js';

/**
 * Prueft, ob eine CFG-Produktion vorhanden ist.
 */
export function hasProductions(parsedGrammar) {
	return parsedGrammar && Object.keys(parsedGrammar.productions || {}).length > 0;
}

/**
 * Bestimmt, ob das UI fuer eine neue CFG-Eingabe zurueckgesetzt wird.
 */
export function shouldResetFooter(source) {
	return source === 'input' || source === 'example';
}

/**
 * Ermittelt, ob ein CFG-Schritt zur CNF-Phase gehoert.
 */
export function isCNFStage(currentStep) {
	return !!(currentStep.stage && currentStep.stage.toLowerCase().includes('cnf'));
}

/**
 * Erzeugt einen Log-Eintrag fuer einen CFG-Schritt.
 */
export function buildStepLog(status, currentStep, grammar) {
	let stepLog = '';
	stepLog += `Schritt ${status.currentIndex + 1}/${status.totalSteps}\n`;
	stepLog += `Etappe: ${currentStep.stage}\n\n`;
	stepLog += `${currentStep.description}\n\n`;

	if (currentStep.state?.productiveVars?.size > 0) {
		const sortedProdVars = getSortedProductiveVars(currentStep.state.productiveVars, grammar.startSymbol || 'S');
		stepLog += `Produktive Variablen: V' = {${sortedProdVars.join(', ')}}\n`;
	}

	if (currentStep.highlightVariables?.length > 0) {
		stepLog += `Fokus auf: ${currentStep.highlightVariables.join(', ')}\n`;
	}

	if (currentStep.highlightProductions?.length > 0) {
		stepLog += `Produktionen:\n${currentStep.highlightProductions.map(p => '  ' + p).join('\n')}\n`;
	}

	return stepLog;
}

/**
 * Wendet Hervorhebungen fuer CFG-Knoten und -Kanten an.
 */
export function applyHighlights(currentStep, grammar) {
	highlightManager.clearAll();

	if (currentStep.state?.productiveVars) {
		const prodVars = [...currentStep.state.productiveVars];
		highlightProductiveNodes(prodVars);
		highlightProductiveEdges(prodVars, currentStep, grammar);
	}

	if (currentStep.highlightVariables?.length > 0) {
		highlightFocusVariables(currentStep);
	}

	if (currentStep.highlightProductions?.length > 0) {
		highlightFocusProductions(currentStep);
	}
}

/**
 * Markiert produktive CFG-Knoten.
 */
function highlightProductiveNodes(prodVars) {
	for (let i = 0; i < prodVars.length; i++) {
		const variable = prodVars[i];
		highlightManager.highlightNode(variable, 'productive');
	}
}

/**
 * Markiert produktive CFG-Kanten.
 */
function highlightProductiveEdges(prodVars, currentStep, grammar) {
	const prodsSource = isCNFStage(currentStep)
		? (currentStep.cnfGraph || {})
		: (grammar.productions || {});

	for (let i = 0; i < prodVars.length; i++) {
		const fromVar = prodVars[i];
		const prods = prodsSource[fromVar] || [];

		for (let j = 0; j < prods.length; j++) {
			const prod = prods[j];
			const symbols = prod.split('');

			for (let k = 0; k < symbols.length; k++) {
				const symbol = symbols[k];
				if (prodVars.includes(symbol)) {
					highlightManager.highlightEdge(fromVar, symbol, 'productive');
				}
			}
		}
	}
}

/**
 * Markiert fokussierte CFG-Variablen.
 */
function highlightFocusVariables(currentStep) {
	const highlightColor = currentStep.highlightVariablesStyle || 'focus';
	const variables = currentStep.highlightVariables;

	for (let i = 0; i < variables.length; i++) {
		const variable = variables[i];
		highlightManager.highlightNode(variable, highlightColor);
	}
}

/**
 * Markiert fokussierte CFG-Produktionen.
 */
function highlightFocusProductions(currentStep) {
	const productions = currentStep.highlightProductions;

	for (let i = 0; i < productions.length; i++) {
		const prodStr = productions[i];
		const match = prodStr.match(/(\w+)\s*->\s*(.+)/);

		if (!match) {
			continue;
		}

		const fromVar = match[1];
		const toStr = match[2].trim();
		const edgeColor = toStr === 'eps' ? 'warning' : 'focus';

		if (edgeColor === 'warning') {
			highlightManager.highlightNode(fromVar, 'warning');
		}

		const symbols = toStr.split('');
		for (let j = 0; j < symbols.length; j++) {
			const symbol = symbols[j];
			if (/[A-Z]/.test(symbol)) {
				highlightManager.highlightEdge(fromVar, symbol, edgeColor);
			}
		}
	}
}

/**
 * Sortiert die Produktivitaetsmenge V' fuer die CFG-Ausgabe.
 */
function getSortedProductiveVars(productiveVars, startSymbol) {
	const prodVarsArray = [...productiveVars];
	return prodVarsArray.includes(startSymbol)
		? [startSymbol, ...prodVarsArray.filter(v => v !== startSymbol).sort()]
		: prodVarsArray.sort();
}
