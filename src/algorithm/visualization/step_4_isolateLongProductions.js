import { isEpsilon } from '../parseGrammar.js';

/**
 * Parsed eine Produktion in einzelne Symbole und erkennt mehrzeilige Variablen wie S0, A1, usw.
 * @param {string} production - Die zu parsende Produktion (z.B. "S0AB", "ABc")
 * @returns {string[]} Array der Symbole (z.B. ["S0", "A", "B"])
 */
function parseSymbols(production) {
	// Spezialfall: eps
	if (isEpsilon(production)) {
		return ['ε'];
	}

	const symbols = [];
	let i = 0;

	while (i < production.length) {
		// Prüfe ob aktuelles Zeichen ein Großbuchstabe ist
		if (/[A-Z]/.test(production[i])) {
			let symbol = production[i];
			i++;

			// Sammle nachfolgende Ziffern
			while (i < production.length && /\d/.test(production[i])) {
				symbol += production[i];
				i++;
			}

			symbols.push(symbol);
		} else {
			// Terminal oder sonstiges Zeichen
			symbols.push(production[i]);
			i++;
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
 * Akzeptiert sowohl einzelne Großbuchstaben (A, B, C) als auch
 * Großbuchstaben mit Ziffern (S0, A1, X2, etc.).
 */
function isNonTerminal(symbol) {
	return /^[A-Z]\d*$/.test(symbol);
}

/**
 * Erstellt eine tiefe Kopie einer CFG-Produktionstabelle.
 */
function deepCopy(obj) {
	return JSON.parse(JSON.stringify(obj || {}));
}

/**
 * Sucht vorhandene Terminalvariablen V -> a in der CFG.
 * Ignoriert die Startvariable, da diese nicht auf rechten Seiten erscheinen darf.
 */
function buildExistingTerminalMap(productions, startSymbol) {
	const map = new Map();
	const variables = Object.keys(productions);

	for (let i = 0; i < variables.length; i++) {
		const V = variables[i];
		
		// CNF-REGEL: Startvariable darf nicht auf rechten Seiten erscheinen
		if (V === startSymbol) {
			continue;
		}
		
		const prods = productions[V] || [];

		for (let j = 0; j < prods.length; j++) {
			const p = prods[j];

			if (p.length === 1 && isTerminal(p) && !map.has(p)) {
				map.set(p, V);
			}
		}
	}

	return map;
}

/**
 * Waehlt eine freie Hilfsvariable fuer Terminalisolierung.
 */
function allocateNewVariable(usedVars) {
	// Wahl vom Alphabetende reduziert Namenskonflikte.
	const candidates = 'ZYXWVUTSRQPONMLKJIHGFEDCBA'.split('');
	for (const c of candidates) {
		if (!usedVars.has(c)) return c;
	}
	// Fallback (sollte praktisch nie passieren)
	return 'Z';
}

/**
 * Erzeugt Schritte zum Isolieren von Terminalen in langen CFG-Produktionen.
 */
export default function generateIsolateLongSteps(grammar, cnfGraph) {
	const steps = [];
	const startSymbol = grammar.startSymbol || 'S';

	const productions = (cnfGraph && Object.keys(cnfGraph).length > 0)
		? deepCopy(cnfGraph)
		: deepCopy(grammar.productions);

	const originalVars = new Set(Object.keys(grammar.productions || {}));
	const usedVars = new Set([...originalVars, ...Object.keys(productions)]);
	const terminalVarMap = buildExistingTerminalMap(productions, startSymbol); // z.B. 'c' -> 'C' (aber nicht S0!)

	const varsSortedInit = Object.keys(productions).sort((a, b) => a.localeCompare(b));
	const grammarLinesInit = buildGrammarLines(productions, varsSortedInit);
	const initProdStrings = buildProductionStrings(productions, varsSortedInit);

	steps.push({
		id: 'cnf-long-init',
		stage: 'cnf-long',
		description: `Terminals in langen Produktionen isolieren (Übergang zu G₂)\n\nAktuelle Grammatik:\n${grammarLinesInit}`,
		delta: { action: 'init' },
		state: { baseCNFProductions: deepCopy(productions), completed: false, startSymbol },
		clearLogs: false,
		highlightVariables: varsSortedInit,
		highlightVariablesStyle: 'processing',
		highlightProductions: initProdStrings,
		cnfGraph: deepCopy(productions)
	});

	const getOrCreateTerminalVar = (terminal) => {
		if (terminalVarMap.has(terminal)) return terminalVarMap.get(terminal);
		const newVar = allocateNewVariable(usedVars);
		usedVars.add(newVar);
		// Füge Produktion newVar -> terminal hinzu
		productions[newVar] = productions[newVar] || [];
		if (!productions[newVar].includes(terminal)) {
			productions[newVar].push(terminal);
		}

		const newVarLines = buildGrammarLines(productions);
		const prodStrings = buildProductionStrings(productions);

		steps.push({
			id: `cnf-long-create-${newVar}-for-${terminal}`,
			stage: 'cnf-long',
			description: `Führe neue Variable ${newVar} für Terminal '${terminal}' ein und füge ${newVar} -> ${terminal} hinzu.\n\nAktuelle Grammatik:\n${newVarLines}`,
			delta: { action: 'create-terminal-var', variable: newVar, terminal },
			state: { baseCNFProductions: deepCopy(productions), completed: false, startSymbol },
			clearLogs: false,
			highlightVariables: [newVar],
			highlightVariablesStyle: 'focus',
			highlightProductions: prodStrings,
			cnfGraph: deepCopy(productions)
		});

		terminalVarMap.set(terminal, newVar);
		return newVar;
	};

	const current = productions; // wir arbeiten in-place und loggen die Zwischenschritte

	const sortedVars = Object.keys(current).sort((a, b) => a.localeCompare(b));

	for (let varIndex = 0; varIndex < sortedVars.length; varIndex++) {
		const A = sortedVars[varIndex];
		const prods = current[A] || [];

		for (let i = 0; i < prods.length; i++) {
			let p = prods[i];
			let prevProd = p; // vor jeder Ersetzung die vorherige Produktion merken

			// Überspringe eps und Produktionen mit Länge < 2
			if (isEpsilon(p) || p.length < 2) {
				continue;
			}

			let symbols = parseSymbols(p);

			for (let pos = 0; pos < symbols.length; pos++) {
				const s = symbols[pos];

				if (!isTerminal(s)) {
					continue;
				}

				// Erzeuge/verwende Variable für dieses Terminal
				const Vt = getOrCreateTerminalVar(s);
				// Ersetze nur an dieser Position
				const newSymbols = symbols.slice();
				newSymbols[pos] = Vt;
				const newProd = newSymbols.join('');

				if (newProd === p) {
					continue;
				}

				// Aktualisiere Produktion schrittweise
				current[A][i] = newProd;
				p = newProd;
				symbols = newSymbols;

				const lines = buildGrammarLines(current);
				const prodStrings = buildProductionStrings(current);

				steps.push({
					id: `cnf-long-replace-${A}-${prevProd}-pos-${pos}-to-${newProd}`,
					stage: 'cnf-long',
					description: `Ersetze Produktion von ${A}:\n ${A} -> ${prevProd}\ndurch\n ${A} -> ${newProd}\n\nAktuelle Grammatik:\n${lines}`,
					delta: { action: 'replace-terminal', variable: A, from: prevProd, to: newProd, position: pos },
					state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
					clearLogs: false,
					highlightVariables: [A],
					highlightVariablesStyle: 'focus',
					// Hebe die Veränderung sichtbar hervor
					highlightProductions: [`${A} -> ${prevProd}`, `${A} -> ${newProd}`],
					cnfGraph: deepCopy(current)
				});

				prevProd = newProd;
			}
		}
	}

	const varsSortedFinal = Object.keys(current).sort((a, b) => a.localeCompare(b));
	const grammarLinesFinal = buildGrammarLines(current, varsSortedFinal);
	const finalProdStrings = buildProductionStrings(current, varsSortedFinal);

	steps.push({
		id: 'cnf-long-complete',
		stage: 'cnf-long',
		description: `
TERMINAL-ISOLIERUNG ABGESCHLOSSEN (G'' → G''')


In langen Produktionen (Länge ≥ 2) sind jetzt nur noch:
- Variablenpaare (AB, X₁X₂, etc.) oder
- Einzelne Terminals (a, b, c)

Und alle Terminals sind isoliert in neuen Unit-Produkionen (X → a).

FINALE GRAMMATIK G''':
${grammarLinesFinal}`,
		delta: { action: 'complete' },
		state: { baseCNFProductions: deepCopy(current), completed: true, startSymbol },
		clearLogs: false,
		highlightVariables: varsSortedFinal,
		highlightVariablesStyle: 'productive',
		highlightProductions: finalProdStrings,
		cnfGraph: deepCopy(current)
	});

	return steps;
}

/**
 * Formatiert CFG-Produktionen fuer die Anzeige.
 */
function buildGrammarLines(productions, vars = Object.keys(productions).sort((a, b) => a.localeCompare(b))) {
	return vars
		.filter(v => (productions[v] || []).length > 0)
		.map(v => `${v} -> ${productions[v].join(' | ')}`)
		.join('\n');
}

/**
 * Erzeugt einzelne Produktionszeilen fuer CFG-Logs.
 */
function buildProductionStrings(productions, vars = Object.keys(productions).sort((a, b) => a.localeCompare(b))) {
	return vars
		.filter(v => (productions[v] || []).length > 0)
		.flatMap(v => (productions[v] || []).map(p => `${v} -> ${p}`));
}

