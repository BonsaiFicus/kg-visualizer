import { isEpsilon } from '../parseGrammar.js';

/**
 * Erzeugt Schrittfolgen fuer die Produktivitaet einer CFG.
 */
export function generateIsProductiveSteps(grammar) {
	const steps = [];
	const { productions, nonTerminals, startSymbol = 'S' } = grammar;
	
	// PHASE 1: Produktivitätsprüfung
	let productiveSet = new Set();
	let iteration = 0;

	pushInitializationStep(steps);

	const initResult = addInitialProductiveSteps({
		steps,
		productions,
		filteredNonTerminals: nonTerminals.filter(nt => !isEpsilon(nt)),
	});

	productiveSet = initResult.productiveSet;
	iteration = initResult.iteration;

	const iterationResult = addFixpointSteps({
		steps,
		productions,
		filteredNonTerminals: nonTerminals.filter(nt => !isEpsilon(nt)),
		productiveSet,
		iteration,
	});

	productiveSet = iterationResult.productiveSet;
	iteration = iterationResult.iteration;

	// PHASE 2: Entfernung von Produktionen mit nicht-produktiven Variablen
	const productiveProductions = {};
	const removedProductions = [];
	
	productiveSet.forEach(v => {
		const validProductions = (productions[v] || []).filter(prod => {
			const symbols = parseSymbols(prod);
			const isValid = symbols.every(sym => isTerminal(sym) || isEpsilon(sym) || productiveSet.has(sym));
			if (!isValid) {
				removedProductions.push({ var: v, prod: prod });
			}
			return isValid;
		});
		if (validProductions.length > 0) {
			productiveProductions[v] = validProductions;
		}
	});
	
	// Zeige entfernte Produktionen als expliziten Schritt
	if (removedProductions.length > 0) {
		addRemovedProductionsStep(steps, productions, productiveSet, removedProductions, productiveProductions);
	}

	// PHASE 3: Erreichbarkeitsanalyse (Trimming)
	// Erreichbarkeit auf der gefilterten Grammatik berechnen
	const reachableSet = getReachableVariables({ productions: productiveProductions, startSymbol });
	const productiveAndUnreachable = Array.from(productiveSet).filter(v => !reachableSet.has(v));
	
	// Zeige Erreichbarkeitsanalyse nach Produktivitätsprüfung
	if (productiveAndUnreachable.length > 0) {
		addReachabilitySteps(steps, productiveProductions, productiveSet, startSymbol, reachableSet, productiveAndUnreachable);
	} else {
		addNoUnreachableStep(steps, productiveProductions, productiveSet, startSymbol);
	}
	
	// Nur Variablen, die sowohl produktiv ALS AUCH erreichbar sind
	const finalProductiveSet = new Set([...productiveSet].filter(v => reachableSet.has(v)));

	// PHASE 3: Leerheitscheck
	addResultStep(steps, finalProductiveSet, startSymbol, iteration);

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

		if (isEpsilon(variable)) {
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

			if (isEpsilon(variable) || productiveSet.has(variable)) {
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
 * Parst eine Produktion in einzelne Grammatik-Symbole.
 * Erkennt Variablen wie S0, X1 (Großbuchstabe + Ziffern) als einzelne Symbole.
 */
function parseSymbols(production) {
	const symbols = [];
	let i = 0;
	while (i < production.length) {
		if (/[A-Z]/.test(production[i])) {
			let symbol = production[i++];
			while (i < production.length && /[0-9]/.test(production[i])) {
				symbol += production[i++];
			}
			symbols.push(symbol);
		} else {
			symbols.push(production[i++]);
		}
	}
	return symbols;
}

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
	return /^[A-Z][0-9]*$/.test(symbol);
}

/**
 * Prueft, ob eine Produktion nur Terminale der CFG enthaelt.
 */
function isTerminalOnly(production) {
	if (isEpsilon(production)) return true;
	return parseSymbols(production).every(symbol => isTerminal(symbol));
}

/**
 * Prueft, ob eine Produktion in Bezug auf V' produktiv ist.
 */
function isProductive(production, productiveSet) {
	if (isEpsilon(production)) return true;

	return parseSymbols(production).every(symbol => {
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
			const symbols = parseSymbols(prod);

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
 * Fuegt Schritt fuer Entfernung von Produktionen mit nicht-produktiven Variablen hinzu.
 */
function addRemovedProductionsStep(steps, productions, productiveSet, removedProductions, productiveProductions) {
	const formatProduction = (v, prod) => `${v} → ${prod}`;
	const removedList = removedProductions.map(({var: v, prod}) => formatProduction(v, prod));
	
	const productiveList = Array.from(productiveSet).sort().join(', ');
	
	steps.push({
		id: 'productive-remove-invalid',
		stage: 'productive-filter',
		description: `Entfernung von Produktionen mit nicht-produktiven Variablen:\n\nProduktive Variablen V' = {${productiveList}}\n\nProduktionen mit nicht-produktiven Variablen (werden entfernt):\n  ${removedList.join('\n  ')}\n\nGrund: Diese Produktionen enthalten mindestens eine Variable, die nicht produktiv ist.`,
		delta: { 
			action: 'remove-invalid-productions',
			removedProductions: removedProductions
		},
		state: { 
			productiveVars: new Set(productiveSet),
			completed: false
		},
		clearLogs: false,
		highlightVariables: [],
		highlightVariablesStyle: 'warning',
		highlightProductions: removedList
	});
}

/**
 * Fuegt Schritte fuer die Erreichbarkeitsanalyse hinzu.
 */
function addReachabilitySteps(steps, productions, productiveSet, startSymbol, reachableSet, unreachableVars) {
	// Formatiere die Grammatik für die Anzeige
	const formatGrammar = (prods, vars, title = '') => {
		const sortedVars = Array.from(vars).sort();
		const lines = sortedVars
			.filter(v => prods[v] && prods[v].length > 0)
			.map(v => `${v} → ${prods[v].join(' | ')}`);
		return title ? `${title}:\n${lines.join('\n')}` : lines.join('\n');
	};

	// Schritt 1: Zeige verbleibende Variablen vor Erreichbarkeitsprüfung
	const productiveVars = Array.from(productiveSet).sort();
	steps.push({
		id: 'reachability-init',
		stage: 'reachability',
		description: `PHASE 3: ERREICHBARKEITSANALYSE (Trimming)\n\nVerbleibende produktive Variablen V':\n  ${productiveVars.join(', ')}\n\nStartsymbol: ${startSymbol}\n\nPrüfe, welche dieser produktiven Variablen vom Startsymbol erreichbar sind...`,
		delta: { action: 'init' },
		state: { 
			reachableVars: new Set([startSymbol]), 
			completed: false 
		},
		clearLogs: false,
		highlightVariables: [startSymbol],
		highlightVariablesStyle: 'productive',
		highlightProductions: []
	});

	// Schritt 2: Zeige erreichbare vs. unerreichbare produktive Variablen
	const reachableAndProductive = productiveVars.filter(v => reachableSet.has(v));
	steps.push({
		id: 'reachability-analysis',
		stage: 'reachability',
		description: `Erreichbarkeitsanalyse abgeschlossen:\n\nProduktive UND erreichbare Variablen (von ${startSymbol} aus):\n  ${reachableAndProductive.join(', ')}\n\nProduktive ABER unerreichbare Variablen (werden entfernt):\n  ${unreachableVars.join(', ')}\n\nDiese Variablen sind zwar produktiv, können aber nie in einer Ableitung vorkommen.`,
		delta: { 
			action: 'identify-unreachable',
			unreachableVars: unreachableVars
		},
		state: { 
			reachableVars: reachableSet,
			unreachableVars: new Set(unreachableVars),
			completed: false 
		},
		clearLogs: false,
		highlightVariables: [...reachableAndProductive],
		highlightVariablesStyle: 'productive',
		highlightProductions: []
	});

	// Schritt 3: Zeige finale bereinigte Grammatik
	const finalProductiveSet = new Set(reachableAndProductive);

	steps.push({
		id: 'reachability-complete',
		stage: 'reachability',
		description: `Bereinigte Grammatik G'' (produktiv UND erreichbar):\n\n${formatGrammar(productions, finalProductiveSet, 'G\'\'')}\n\n${unreachableVars.length} Variable(n) wurden als unerreichbar entfernt: ${unreachableVars.join(', ')}\n\nFahre fort mit Leerheitscheck...`,
		delta: { 
			action: 'complete',
			removedCount: unreachableVars.length
		},
		state: { 
			reachableVars: reachableSet,
			unreachableVars: new Set(unreachableVars),
			completed: true 
		},
		clearLogs: false,
		highlightVariables: reachableAndProductive,
		highlightVariablesStyle: 'productive',
		highlightProductions: []
	});
}

/**
 * Fuegt Schritt hinzu, wenn keine unerreichbaren Variablen gefunden wurden.
 */
function addNoUnreachableStep(steps, productions, productiveSet, startSymbol) {
	const formatGrammar = (prods, vars) => {
		const sortedVars = Array.from(vars).sort();
		const lines = sortedVars
			.filter(v => prods[v] && prods[v].length > 0)
			.map(v => `${v} → ${prods[v].join(' | ')}`);
		return lines.join('\n');
	};

	const productiveVars = Array.from(productiveSet).sort();

	steps.push({
		id: 'reachability-all-reachable',
		stage: 'reachability',
		description: `PHASE 3: ERREICHBARKEITSANALYSE (Trimming)\n\nVerbleibende produktive Variablen V':\n  ${productiveVars.join(', ')}\n\nErgebnis: Alle verbleibenden produktiven Variablen sind vom Startsymbol ${startSymbol} erreichbar.\n✓ Keine unerreichbaren Variablen gefunden.\n\nFahre fort mit Leerheitscheck...`,
		delta: { 
			action: 'all-reachable'
		},
		state: { 
			reachableVars: new Set(productiveVars),
			unreachableVars: new Set(),
			completed: true 
		},
		clearLogs: false,
		highlightVariables: productiveVars,
		highlightVariablesStyle: 'productive',
		highlightProductions: []
	});
}

/**
 * Fuegt den Initialschritt fuer die Produktivitaetsanalyse hinzu.
 */
function pushInitializationStep(steps) {
	steps.push({
		id: `productive-init`,
		stage: "initialization",
		description: "PHASE 1: PRODUKTIVITÄTSPRÜFUNG\n\nStarte Suche nach produktiven Variablen",
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
		description: `Variable ${variable} ist produktiv (hat Terminalproduktionen: ${terminalProductions.join(', ')})`,

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
		description: `Variablen ohne Terminalproduktionen: ${initiallyCheckedVariables.join(', ')}`,
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
	const sortedProductiveVars = [...productiveSet].sort();

	steps.push({
		id: `productive-result`,
		stage: "result",
		description: isEmptyLanguage
			? `PHASE 4: LEERHEITSPROBLEM\n\nFinal: Variablen die produktiv UND erreichbar sind:\nV'' = {${sortedProductiveVars.join(', ')}}\n\nERGEBNIS: Sprache ist LEER\nStartsymbol ${startSymbol} ∉ V''\n\nDie Grammatik erzeugt keine Wörter.`
			: `PHASE 4: LEERHEITSPROBLEM\n\nFinal: Variablen die produktiv UND erreichbar sind:\nV'' = {${sortedProductiveVars.join(', ')}}\n\nERGEBNIS: Sprache ist NICHT LEER\nStartsymbol ${startSymbol} ∈ V''\n\nDie Grammatik erzeugt mindestens ein Wort.`,
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
