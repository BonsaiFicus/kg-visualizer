/**
 * Erzeugt Schritte fuer den Aufbau des CNF-Basisgraphen der CFG.
 */
export function generateCNFBuildSteps(grammar, productiveSet) {
	const steps = [];
	const { productions, startSymbol = 'S' } = grammar;

	const baseCNFProductions = {};
	const sortedVarsList = getSortedProductiveVars(productiveSet, startSymbol);

	const startValidProductions = getValidProductions(productions[startSymbol] || [], productiveSet);
	if (startValidProductions.length > 0) {
		baseCNFProductions[startSymbol] = startValidProductions;
	}

	steps.push(buildInitStep(startSymbol, startValidProductions, baseCNFProductions, productiveSet));

	for (let i = 0; i < sortedVarsList.length; i++) {
		const variable = sortedVarsList[i];

		if (variable === startSymbol) {
			continue;
		}

		const validProductions = getValidProductions(productions[variable] || [], productiveSet);

		if (validProductions.length === 0) {
			continue;
		}

		baseCNFProductions[variable] = validProductions;
		steps.push(buildAddVariableStep(variable, validProductions, baseCNFProductions, productiveSet));
	}

	steps.push(buildCompleteStep(sortedVarsList, baseCNFProductions, productiveSet));

	return steps;
}

/**
 * Direkter Export für schnelle Verwendung
 */
export default generateCNFBuildSteps;

/**
 * Prueft, ob ein Symbol der CFG ein Terminal ist.
 */
function isTerminal(symbol) {
	return /^[a-z]$/.test(symbol);
}

/**
 * Sortiert V' mit Startsymbol vorne fuer die CNF-Anzeige.
 */
function getSortedProductiveVars(productiveSet, startSymbol) {
	const productiveVarsList = productiveSet instanceof Set
		? [...productiveSet]
		: productiveSet;
	return [startSymbol, ...productiveVarsList.filter(v => v !== startSymbol).sort()];
}

/**
 * Filtert CFG-Produktionen, die nur produktive Symbole enthalten.
 */
function getValidProductions(productions, productiveSet) {
	const validProductions = [];

	for (let i = 0; i < productions.length; i++) {
		const prod = productions[i];

		if (prod === 'eps') {
			validProductions.push(prod);
			continue;
		}

		const symbols = prod.split('');
		let isValid = true;

		for (let j = 0; j < symbols.length; j++) {
			const symbol = symbols[j];

			if (!isTerminal(symbol) && !productiveSet.has(symbol)) {
				isValid = false;
				break;
			}
		}

		if (isValid) {
			validProductions.push(prod);
		}
	}

	return validProductions;
}

/**
 * Erstellt den Initialschritt fuer den CNF-Basisgraphen.
 */
function buildInitStep(startSymbol, productions, baseCNFProductions, productiveSet) {
	const grammarStr = `${startSymbol} → ${productions.join(' | ')}`;
	return {
		id: 'cnf-init',
		stage: 'cnf-build',
		description: `═══════════════════════════════════════════════════
PHASE 2: CNF-BASIS AUFBAUEN
═══════════════════════════════════════════════════

Starte mit produktiven Variablen aus G:

G':
${grammarStr}

Produktive Variablen: ${Array.from(productiveSet).sort().join(', ')}`,
		delta: {
			action: 'init-with-start',
			variable: startSymbol,
			productions: productions,
			message: 'Starte mit Startsymbol'
		},
		state: {
			baseCNFProductions: { ...baseCNFProductions },
			productiveVars: productiveSet,
			completed: false
		},
		clearLogs: false,
		highlightVariables: [startSymbol],
		highlightProductions: productions.map(p => `${startSymbol} -> ${p}`),
		cnfGraph: { ...baseCNFProductions }
	};
}

/**
 * Erstellt einen Schritt zum Hinzufuegen eines Nichtterminals im CNF-Graph.
 */
function buildAddVariableStep(variable, productions, baseCNFProductions, productiveSet) {
	return {
		id: `cnf-add-${variable}`,
		stage: 'cnf-build',
		description: `Füge Variable ${variable} mit produktiven Produktionen hinzu:\n${productions.map(p => `${variable} -> ${p}`).join('\n')}`,
		delta: {
			action: 'add-variable',
			variable: variable,
			productions: productions
		},
		state: {
			baseCNFProductions: { ...baseCNFProductions },
			productiveVars: productiveSet,
			completed: false
		},
		clearLogs: false,
		highlightVariables: [variable],
		highlightProductions: productions.map(p => `${variable} -> ${p}`),
		cnfGraph: { ...baseCNFProductions }
	};
}

/**
 * Erstellt den Abschluss-Schritt fuer den CNF-Basisgraphen.
 */
function buildCompleteStep(sortedVarsList, baseCNFProductions, productiveSet) {
	const grammarLines = sortedVarsList
		.filter(v => baseCNFProductions[v])
		.map(v => `${v} -> ${baseCNFProductions[v].join(' | ')}`)
		.join('\n');

	const totalVariables = sortedVarsList.filter(v => baseCNFProductions[v]).length;
	const totalProductions = Object.values(baseCNFProductions).flat().length;

	return {
		id: 'cnf-complete',
		stage: 'cnf-build',
		description: `Basis-CNF-Graph vollständig: ${totalVariables} produktive Variablen mit ${totalProductions} Produktionen\n\nNeue Grammatik G':\n${grammarLines}`,
		delta: {
			action: 'complete',
			totalVariables,
			totalProductions
		},
		state: {
			baseCNFProductions: baseCNFProductions,
			productiveVars: productiveSet,
			completed: true
		},
		clearLogs: false,
		highlightVariables: sortedVarsList.filter(v => baseCNFProductions[v]),
		highlightProductions: [],
		cnfGraph: baseCNFProductions
	};
}
