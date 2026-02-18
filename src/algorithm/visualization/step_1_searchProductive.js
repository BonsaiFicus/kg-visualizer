/**
 * Erzeugt Schrittfolgen fuer die Produktivitaet einer CFG.
 */
export function generateIsProductiveSteps(grammar) {
	const steps = [];
	const { productions, nonTerminals, startSymbol = 'S' } = grammar;
	const reachableSet = getReachableVariables({ productions, startSymbol });
	const filteredNonTerminals = nonTerminals.filter(nt => isReachable(nt, reachableSet) && nt !== 'eps');

	let productiveSet = new Set();
	let iteration = 0;

	pushInitializationStep(steps);

	const initResult = addInitialProductiveSteps({
		steps,
		productions,
		filteredNonTerminals,
	});

	productiveSet = initResult.productiveSet;
	iteration = initResult.iteration;

	const iterationResult = addFixpointSteps({
		steps,
		productions,
		filteredNonTerminals,
		productiveSet,
		iteration,
	});

	productiveSet = iterationResult.productiveSet;
	iteration = iterationResult.iteration;

	addResultStep(steps, productiveSet, startSymbol, iteration);

	return steps;
}

/**
 * Berechnet Produktivitaet der CFG ohne Visualisierungsschritte.
 */
export function computeIsProductive(grammar) {
	const { productions, nonTerminals, startSymbol = 'S' } = grammar;
	let productiveSet = new Set();

	for (let i = 0; i < nonTerminals.length; i++) {
		const variable = nonTerminals[i];

		if (variable === 'eps') {
			continue;
		}

		const prods = productions[variable] || [];
		const hasTerminalProd = checkForTerminalProduction(prods);

		if (hasTerminalProd) {
			productiveSet.add(variable);
		}
	}

	let changed = true;
	while (changed) {
		changed = false;

		for (let i = 0; i < nonTerminals.length; i++) {
			const variable = nonTerminals[i];

			if (variable === 'eps' || productiveSet.has(variable)) {
				continue;
			}

			const prods = productions[variable] || [];
			const hasProductiveProd = checkForProductiveProduction(prods, productiveSet);

			if (hasProductiveProd) {
				productiveSet.add(variable);
				changed = true;
			}
		}
	}

	return {
		productiveVars: [...productiveSet],
		isEmptyLanguage: !productiveSet.has(startSymbol)
	};
}

/**
 * Prueft, ob Variablenproduktionen eine Terminalproduktion enthalten.
 */
function checkForTerminalProduction(prods) {
	for (let i = 0; i < prods.length; i++) {
		if (isTerminalOnly(prods[i])) {
			return true;
		}
	}
	return false;
}

/**
 * Prueft, ob Variablenproduktionen eine produktive Produktion enthalten.
 */
function checkForProductiveProduction(prods, productiveSet) {
	for (let i = 0; i < prods.length; i++) {
		if (isProductive(prods[i], productiveSet)) {
			return true;
		}
	}
	return false;
}

export default generateIsProductiveSteps;

/**
 * Prueft, ob ein Symbol der CFG ein Terminal ist.
 */
function isTerminal(symbol) {
	return /^[a-z]$/.test(symbol);
}

/**
 * Prueft, ob ein Symbol der CFG ein Nichtterminal ist.
 */
function isNonTerminal(symbol) {
	return /^[A-Z]$/.test(symbol);
}

/**
 * Prueft, ob eine Produktion nur Terminale der CFG enthaelt.
 */
function isTerminalOnly(production) {
	if (production === 'eps') return true;
	return production.split('').every(symbol => isTerminal(symbol));
}

/**
 * Prueft, ob eine Produktion in Bezug auf V' produktiv ist.
 */
function isProductive(production, productiveSet) {
	if (production === 'eps') return true;

	return production.split('').every(symbol => {
		return isTerminal(symbol) || productiveSet.has(symbol);
	});
}

/**
 * Berechnet die erreichbaren Nichtterminale der CFG.
 */
function getReachableVariables({ productions, startSymbol }) {
	const reachableSet = new Set();
	const queue = [startSymbol];

	while (queue.length > 0) {
		const v = queue.shift();

		if (reachableSet.has(v)) {
			continue;
		}

		reachableSet.add(v);
		const prods = productions[v] || [];

		for (let i = 0; i < prods.length; i++) {
			const prod = prods[i];
			const symbols = prod.split('');

			for (let j = 0; j < symbols.length; j++) {
				const sym = symbols[j];

				if (isNonTerminal(sym) && !reachableSet.has(sym)) {
					queue.push(sym);
				}
			}
		}
	}

	return reachableSet;
}

/**
 * Prueft, ob ein Symbol von S erreichbar ist.
 */
function isReachable(symbol, reachableSet) {
	return reachableSet.has(symbol);
}

/**
 * Fuegt den Initialschritt fuer die Produktivitaetsanalyse hinzu.
 */
function pushInitializationStep(steps) {
	steps.push({
		id: `productive-init`,
		stage: "initialization",
		description: "Initialisierung: Suche nach Variablen, die direkt zu Terminalen produzieren",
		delta: {
			action: 'init',
			productiveVars: new Set(),
			message: "Starte Suche nach produktiven Variablen"
		},
		state: {
			productiveVars: new Set(),
			iteration: 0,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [],
		highlightProductions: []
	});
}

/**
 * Initialisiert V' aus direkten Terminalproduktionen der CFG.
 */
function addInitialProductiveSteps({ steps, productions, filteredNonTerminals }) {
	const initialProductiveSet = new Set();
	const initiallyCheckedVariables = [];

	for (let i = 0; i < filteredNonTerminals.length; i++) {
		const variable = filteredNonTerminals[i];
		const prods = productions[variable] || [];
		const terminalProductions = findTerminalProductions(prods);

		if (terminalProductions.length > 0) {
			initialProductiveSet.add(variable);
			addProductiveVariableStep(steps, variable, terminalProductions, initialProductiveSet);
		} else {
			initiallyCheckedVariables.push(variable);
		}
	}

	if (initiallyCheckedVariables.length > 0) {
		addNonProductiveCheckStep(steps, initiallyCheckedVariables, initialProductiveSet);
	}

	return { productiveSet: new Set(initialProductiveSet), iteration: 1 };
}

/**
 * Filtert Produktionen, die nur Terminale enthalten.
 */
function findTerminalProductions(prods) {
	const terminalProductions = [];

	for (let i = 0; i < prods.length; i++) {
		const prod = prods[i];
		if (isTerminalOnly(prod)) {
			terminalProductions.push(prod);
		}
	}

	return terminalProductions;
}

/**
 * Fuegt einen Schritt fuer eine produktive Variable hinzu.
 */
function addProductiveVariableStep(steps, variable, terminalProductions, initialProductiveSet) {
	steps.push({
		id: `productive-init-${variable}`,
		stage: "initialization",
		description: `Variable ${variable} ist produktiv (hat Terminal-Produktionen: ${terminalProductions.join(', ')})`,
		delta: {
			action: 'add',
			variable: variable,
			productions: terminalProductions,
			reason: 'terminal-production'
		},
		state: {
			productiveVars: new Set(initialProductiveSet),
			iteration: 0,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [variable],
		highlightProductions: terminalProductions.map(p => `${variable} -> ${p}`)
	});
}

/**
 * Fuegt einen Schritt fuer nicht-produktive Variablen hinzu.
 */
function addNonProductiveCheckStep(steps, initiallyCheckedVariables, initialProductiveSet) {
	steps.push({
		id: `productive-init-non-productive`,
		stage: "initialization",
		description: `Variablen ohne Terminal-Produktionen: ${initiallyCheckedVariables.join(', ')}`,
		delta: {
			action: 'check',
			variables: initiallyCheckedVariables,
			result: 'not-yet-productive'
		},
		state: {
			productiveVars: new Set(initialProductiveSet),
			iteration: 0,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: initiallyCheckedVariables,
		highlightProductions: []
	});
}

/**
 * Fuehrt die Fixpunktiteration fuer V' der CFG aus.
 */
function addFixpointSteps({ steps, productions, filteredNonTerminals, productiveSet, iteration }) {
	let previousSize = productiveSet.size;

	addIterationStartStep(steps, productiveSet, iteration);

	while (true) {
		const foundNew = processIterationVariables({
			steps,
			productions,
			filteredNonTerminals,
			productiveSet,
			iteration
		});

		if (!foundNew || productiveSet.size === previousSize) {
			addFixpointReachedStep(steps, productiveSet, iteration);
			break;
		}

		previousSize = productiveSet.size;
		iteration++;
		addIterationContinueStep(steps, productiveSet, iteration);
	}

	return { productiveSet, iteration };
}

/**
 * Fuegt Schritt zum Start einer Fixpunkt-Iteration hinzu.
 */
function addIterationStartStep(steps, productiveSet, iteration) {
	steps.push({
		id: `productive-iteration-start-${iteration}`,
		stage: "iteration",
		description: `Iteration ${iteration}: Starte Fixpunkt-Berechnung (V' = {${[...productiveSet].join(', ')}})`,
		delta: {
			action: 'iteration-start',
			iteration: iteration,
			currentSize: productiveSet.size
		},
		state: {
			productiveVars: new Set(productiveSet),
			iteration: iteration,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [...productiveSet],
		highlightProductions: []
	});
}

/**
 * Verarbeitet Variablen in einer Iteration.
 */
function processIterationVariables({ steps, productions, filteredNonTerminals, productiveSet, iteration }) {
	let foundNew = false;

	for (let i = 0; i < filteredNonTerminals.length; i++) {
		const variable = filteredNonTerminals[i];

		if (productiveSet.has(variable)) {
			continue;
		}

		const prods = productions[variable] || [];
		const productiveProds = findProductiveProductions(prods, productiveSet);

		if (productiveProds.length > 0) {
			productiveSet.add(variable);
			foundNew = true;
			addProductiveIterationStep(steps, variable, productiveProds, productiveSet, iteration);
		}
	}

	return foundNew;
}

/**
 * Filtert Produktionen, die bezueglich V' produktiv sind.
 */
function findProductiveProductions(prods, productiveSet) {
	const productiveProds = [];

	for (let i = 0; i < prods.length; i++) {
		const prod = prods[i];
		if (isProductive(prod, productiveSet)) {
			productiveProds.push(prod);
		}
	}

	return productiveProds;
}

/**
 * Fuegt Schritt fuer neu gefundene produktive Variable hinzu.
 */
function addProductiveIterationStep(steps, variable, productiveProds, productiveSet, iteration) {
	const otherVars = [...productiveSet].filter(v => v !== variable);

	steps.push({
		id: `productive-iter${iteration}-add-${variable}`,
		stage: "iteration",
		description: `${variable} ist produktiv durch:\n${productiveProds.map(p => `${variable} -> ${p}`).join('\n')}\n(alle Symbole in {${otherVars.join(', ')}} ∪ T)`,
		delta: {
			action: 'add',
			variable: variable,
			productions: productiveProds,
			iteration: iteration,
			reason: 'productive-production'
		},
		state: {
			productiveVars: new Set(productiveSet),
			iteration: iteration,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [variable],
		highlightProductions: productiveProds.map(p => `${variable} -> ${p}`)
	});
}

/**
 * Fuegt Schritt fuer Erreichen des Fixpunkts hinzu.
 */
function addFixpointReachedStep(steps, productiveSet, iteration) {
	steps.push({
		id: `productive-iteration-end-${iteration}`,
		stage: "iteration",
		description: `Iteration ${iteration}: Fixpunkt erreicht - keine neuen produktiven Variablen`,
		delta: {
			action: 'fixpoint',
			iteration: iteration,
			finalSize: productiveSet.size
		},
		state: {
			productiveVars: new Set(productiveSet),
			iteration: iteration,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [...productiveSet],
		highlightProductions: []
	});
}

/**
 * Fuegt Schritt zum Fortsetzen der Iteration hinzu.
 */
function addIterationContinueStep(steps, productiveSet, iteration) {
	steps.push({
		id: `productive-iteration-start-${iteration}`,
		stage: "iteration",
		description: `Iteration ${iteration}: Neue produktive Variablen gefunden, prüfe weiter...`,
		delta: {
			action: 'iteration-start',
			iteration: iteration,
			currentSize: productiveSet.size
		},
		state: {
			productiveVars: new Set(productiveSet),
			iteration: iteration,
			completed: false,
			isEmptyLanguage: null
		},
		clearLogs: false,
		highlightVariables: [...productiveSet],
		highlightProductions: []
	});
}

/**
 * Erzeugt den Ergebnis-Schritt zur Leerheit der CFG-Sprache.
 */
function addResultStep(steps, productiveSet, startSymbol, iteration) {
	const isEmptyLanguage = !productiveSet.has(startSymbol);
	const sortedProductiveVars = [startSymbol, ...([...productiveSet].filter(v => v !== startSymbol).sort())];

	steps.push({
		id: `productive-result`,
		stage: "result",
		description: isEmptyLanguage
			? `Sprache ist LEER: Startsymbol ${startSymbol} ∉ V' = {${sortedProductiveVars.join(', ')}}`
			: `Sprache ist NICHT LEER: Startsymbol ${startSymbol} ∈ V' = {${sortedProductiveVars.join(', ')}}`,
		delta: {
			action: 'complete',
			isEmptyLanguage: isEmptyLanguage,
			productiveVars: sortedProductiveVars,
			startSymbol: startSymbol
		},
		state: {
			productiveVars: new Set(productiveSet),
			iteration: iteration,
			completed: true,
			isEmptyLanguage: isEmptyLanguage
		},
		clearLogs: false,
		highlightVariables: isEmptyLanguage ? [] : [startSymbol],
		highlightProductions: []
	});
}
