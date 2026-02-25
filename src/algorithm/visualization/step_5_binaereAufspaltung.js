import { isEpsilon } from '../parseGrammar.js';

/**
 * Parsed eine Produktion in einzelne Symbole und erkennt mehrzeilige Variablen wie S0, A1, usw.
 * @param {string} production - Die zu parsende Produktion (z.B. "S0AB", "ABc")
 * @returns {string[]} Array der Symbole (z.B. ["S0", "A", "B"])
 */
function parseSymbols(production) {
	// Spezialfall: ε
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
 * Prueft Zyklen im Ableitungsgraphen der CFG mit DFS-Schritten.
 */
function detectCycleWithSteps(productions) {
	const graph = {};
	const dfsSteps = [];

	Object.keys(productions).forEach(v => {
		graph[v] = new Set();
	});

	Object.keys(productions).forEach(A => {
		(productions[A] || []).forEach(prod => {
			parseSymbols(prod).forEach(symbol => {
				if (isNonTerminal(symbol) && symbol in graph) {
					graph[A].add(symbol);
				}
			});
		});
	});

	const graphDescription = Object.keys(graph)
		.sort((a, b) => a.localeCompare(b))
		.map(v => {
			const neighbors = Array.from(graph[v] || []).sort();
			return neighbors.length > 0 ? `${v} -> ${neighbors.join(', ')}` : null;
		})
		.filter(x => x)
		.join('\n');


	const visited = new Set();
	const recursionStack = new Set();
	let hasCycle = false;
	let cycleNodes = [];

	/**
	 * DFS-Schritt im Ableitungsgraphen der CFG.
	 */
	function dfs(node, path = []) {
		visited.add(node);
		recursionStack.add(node);
		path = [...path, node];

		dfsSteps.push({
			type: 'visit-node',
			node,
			visitedVars: new Set(visited),
			recursionStack: new Set(recursionStack),
			path,
			message: `Besuche Knoten ${node}`
		});

		const neighbors = Array.from(graph[node] || []).sort();
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				dfsSteps.push({
					type: 'explore-edge',
					from: node,
					to: neighbor,
					visitedVars: new Set(visited),
					recursionStack: new Set(recursionStack),
					path,
					message: `Folge Kante ${node} -> ${neighbor}`
				});

				if (dfs(neighbor, path)) {
					return true;
				}
			} else if (recursionStack.has(neighbor)) {
				cycleNodes = [...path, neighbor];
				hasCycle = true;
				dfsSteps.push({
					type: 'cycle-found',
					from: node,
					to: neighbor,
					cycle: cycleNodes,
					visitedVars: new Set(visited),
					recursionStack: new Set(recursionStack),
					message: `Zyklus gefunden: ${cycleNodes.join(' -> ')}`
				});
				return true;
			}
		}

		recursionStack.delete(node);
		dfsSteps.push({
			type: 'backtrack',
			node,
			visitedVars: new Set(visited),
			recursionStack: new Set(recursionStack),
			message: `Backtrack von ${node}`
		});

		return false;
	}

	const allVars = Object.keys(graph).sort();
	for (const v of allVars) {
		if (!visited.has(v)) {
			dfsSteps.push({
				type: 'start-dfs',
				node: v,
				visitedVars: new Set(visited),
				recursionStack: new Set(recursionStack),
				message: `Starte DFS von ${v}`
			});

			if (dfs(v)) {
				break;
			}
		}
	}

	return {
		hasCycle,
		graph,
		graphDescription,
		dfsSteps,
		cycleNodes
	};
}

/**
 * Waehlt eine freie Hilfsvariable fuer die binaere Kaskadierung.
 * Nutzt zuerst Großbuchstaben (Z bis A), dann D0, D1, D2, ... (unbegrenzt).
 */
function allocateNewVariable(usedVars) {
	const candidates = 'ZYXWVUTSRQPONMLKJIHGFEDCBA'.split('');
	for (const c of candidates) {
		if (!usedVars.has(c)) return c;
	}
	
	// Fallback: Ziffern-Suffix verwenden (D0, D1, D2, ...)
	let counter = 0;
	while (usedVars.has(`D${counter}`)) {
		counter++;
	}
	return `D${counter}`;
}

/**
 * Erzeugt Schritte fuer die binaere Kaskadierung einer CFG.
 */
export default function generateBinaryKaskadierungSteps(grammar, cnfGraph) {
	const steps = [];
	const startSymbol = grammar.startSymbol || 'S';

	const productions = (cnfGraph && Object.keys(cnfGraph).length > 0)
		? deepCopy(cnfGraph)
		: deepCopy(grammar.productions);

	const originalVars = new Set(Object.keys(grammar.productions || {}));
	const usedVars = new Set([...originalVars, ...Object.keys(productions)]);

	// Map zur Deduplication: production-string -> [helper-variables]
	// z.B. "SY" -> ["X", "W"] wenn bereits eine Cascade für "SY" existiert
	const productionToCascadeVars = new Map();

	const varsSortedInit = Object.keys(productions).sort((a, b) => a.localeCompare(b));
	const grammarLinesInit = buildGrammarLines(productions, varsSortedInit);
	const initProdStrings = buildProductionStrings(productions, varsSortedInit);

	steps.push({
		id: 'cnf-binary-init',
		stage: 'cnf-binary',
		description: `Binäre Aufspaltung: Kaskadiere lange Produktionen (Übergang zu G₃)\n\nAktuelle Grammatik:\n${grammarLinesInit}`,
		delta: { action: 'init' },
		state: { baseCNFProductions: deepCopy(productions), completed: false, startSymbol },
		clearLogs: false,
		highlightVariables: varsSortedInit,
		highlightVariablesStyle: 'processing',
		highlightProductions: initProdStrings,
		cnfGraph: deepCopy(productions)
	});

	const current = productions;

	const sortedVars = Object.keys(current).sort((a, b) => a.localeCompare(b));

	sortedVars.forEach(A => {
		const prods = current[A] || [];
		const newProductions = [];

		for (let i = 0; i < prods.length; i++) {
			const prod = prods[i];
			
			// Überspringe ε und Produktionen mit Länge < 3
			if (isEpsilon(prod)) {
				continue;
			}
			
			const symbols = parseSymbols(prod);

			if (symbols.length >= 3) {
				const m = symbols.length;
				let helperVars = [];

				// Prüfe, ob diese Produktion bereits gekaskadiert wurde
				const prodKey = prod; // z.B. "SY" für die Produktion ...SY
				const isNewCascade = !productionToCascadeVars.has(prodKey);

				if (isNewCascade) {
					// Neue Hilfsvariablen allokieren
					for (let j = 0; j < m - 2; j++) {
						const newVar = allocateNewVariable(usedVars);
						usedVars.add(newVar);
						helperVars.push(newVar);
					}
					// Speichere die Zuordnung für spätere Wiederverwendung
					productionToCascadeVars.set(prodKey, helperVars);
				} else {
					// Wiederverwendung existierender Hilfsvariablen
					helperVars = productionToCascadeVars.get(prodKey);
				}

				const helperVarList = helperVars.join(', ');
				const linesBeforeSplit = buildGrammarLines(current);
				const cascadeDesc = isNewCascade
					? `Erstelle Hilfsvariablen: ${helperVarList}`
					: `Nutze existierende Hilfsvariablen: ${helperVarList}`;

				steps.push({
					id: `cnf-binary-helpers-${A}-${i}`,
					stage: 'cnf-binary',
					description: `Spalte Produktion ${A} -> ${prod} auf (${m} Symbole)\n${cascadeDesc}\n\nAktuelle Grammatik:\n${linesBeforeSplit}`,
					delta: { action: 'create-helpers', variable: A, production: prod, helpers: helperVars },
				state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
					clearLogs: false,
					highlightVariables: [A],
					highlightVariablesStyle: 'focus',
					highlightProductions: [`${A} -> ${prod}`],
					cnfGraph: deepCopy(current)
				});

				current[A] = current[A].filter((p, idx) => idx !== i);

				const firstRule = `${symbols[0]}${helperVars[0]}`;
				current[A].push(firstRule);
				newProductions.push(firstRule);

				let linesAfterRule = buildGrammarLines(current);
				let prodStrings = buildProductionStrings(current);

				steps.push({
					id: `cnf-binary-rule-${A}-${i}-0`,
					stage: 'cnf-binary',
					description: `Ersetze ${A} -> ${prod} durch ${A} -> ${firstRule}\n\nAktuelle Grammatik:\n${linesAfterRule}`,
					delta: { action: 'add-binary-rule', variable: A, rule: `${A} -> ${firstRule}`, originalProduction: prod },
					state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
					clearLogs: false,
					highlightVariables: [A],
					highlightVariablesStyle: 'focus',
					highlightProductions: prodStrings,
					cnfGraph: deepCopy(current)
				});

				// Cascadierung-Regeln nur hinzufügen, wenn diese Cascade neu ist
				if (isNewCascade) {
					for (let j = 0; j < m - 3; j++) {
						const rule = `${symbols[j + 1]}${helperVars[j + 1]}`;

						if (!current[helperVars[j]]) {
							current[helperVars[j]] = [];
						}
						current[helperVars[j]].push(rule);

						linesAfterRule = buildGrammarLines(current);
						prodStrings = buildProductionStrings(current);

						steps.push({
							id: `cnf-binary-rule-${A}-${i}-${j + 1}`,
							stage: 'cnf-binary',
							description: `Füge binäre Regel hinzu: ${helperVars[j]} -> ${rule}\n\nAktuelle Grammatik:\n${linesAfterRule}`,
							delta: { action: 'add-binary-rule', variable: helperVars[j], rule: `${helperVars[j]} -> ${rule}`, originalProduction: prod },
							state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
							clearLogs: false,
							highlightVariables: [helperVars[j]],
							highlightVariablesStyle: 'focus',
							highlightProductions: prodStrings,
							cnfGraph: deepCopy(current)
						});
					}

					const lastHelperIdx = m - 3;
					const lastRule = `${symbols[m - 2]}${symbols[m - 1]}`;

					if (!current[helperVars[lastHelperIdx]]) {
						current[helperVars[lastHelperIdx]] = [];
					}
					current[helperVars[lastHelperIdx]].push(lastRule);

					linesAfterRule = buildGrammarLines(current);
					prodStrings = buildProductionStrings(current);

					steps.push({
						id: `cnf-binary-rule-${A}-${i}-${m - 2}`,
						stage: 'cnf-binary',
						description: `Füge binäre Regel hinzu: ${helperVars[lastHelperIdx]} -> ${lastRule}\n\nAktuelle Grammatik:\n${linesAfterRule}`,
						delta: { action: 'add-binary-rule', variable: helperVars[lastHelperIdx], rule: `${helperVars[lastHelperIdx]} -> ${lastRule}`, originalProduction: prod },
						state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
						clearLogs: false,
						highlightVariables: [helperVars[lastHelperIdx]],
						highlightVariablesStyle: 'focus',
						highlightProductions: prodStrings,
						cnfGraph: deepCopy(current)
					});
				}

			} else {
				newProductions.push(prod);
			}
		}
	});

	const varsSortedFinal = Object.keys(current).sort((a, b) => a.localeCompare(b));
	const grammarLinesFinal = buildGrammarLines(current, varsSortedFinal);
	const finalProdStrings = buildProductionStrings(current, varsSortedFinal);

	steps.push({
		id: 'cnf-binary-complete',
		stage: 'cnf-binary',
		description: `
BINÄRE AUFSPALTUNG ABGESCHLOSSEN - CNF ERREICHT!


Die Grammatik ist jetzt in CHOMSKY-NORMALFORM (CNF)!

Alle Produktionen haben eine der folgenden Formen:
  • X → YZ  (zwei Variablen)
  • X → a   (ein Terminal)
  • S₀ → ε   (nur für Startvariable, wenn ε ∈ L(G))

FINALE CNF-GRAMMATIK:
${grammarLinesFinal}`,
		delta: { action: 'complete' },
		state: { baseCNFProductions: deepCopy(current), completed: true, startSymbol },
		clearLogs: false,
		highlightVariables: varsSortedFinal,
		highlightVariablesStyle: 'productive',
		highlightProductions: finalProdStrings,
		cnfGraph: deepCopy(current)
	});

	const cycleDetection = detectCycleWithSteps(current);

	cycleDetection.dfsSteps.forEach((dfsStep, idx) => {
		let highlightVars = [];
		let description = dfsStep.message;

		if (dfsStep.type === 'visit-node') {
			highlightVars = [dfsStep.node];
			description = `Besuche Knoten: ${dfsStep.node}\n\nRecursion Stack: {${Array.from(dfsStep.recursionStack).sort().join(', ')}}\nBesucht: {${Array.from(dfsStep.visitedVars).sort().join(', ')}}`;
		} else if (dfsStep.type === 'explore-edge') {
			highlightVars = [dfsStep.from, dfsStep.to];
			description = `Folge Kante ${dfsStep.from} -> ${dfsStep.to}\n\nPfad: ${dfsStep.path.join(' -> ')}\nRecursion Stack: {${Array.from(dfsStep.recursionStack).sort().join(', ')}}`;
		} else if (dfsStep.type === 'cycle-found') {
			highlightVars = dfsStep.cycle;
			description = `Zyklus gefunden!\n\nZyklus: ${dfsStep.cycle.join(' -> ')}\n\nDurch wiederholte Anwendung dieser Produktionen entstehen beliebig lange Wörter.`;
		} else if (dfsStep.type === 'backtrack') {
			highlightVars = [dfsStep.node];
			description = `Backtrack von ${dfsStep.node}\n\nRecursion Stack: {${Array.from(dfsStep.recursionStack).sort().join(', ')}}`;
		} else if (dfsStep.type === 'start-dfs') {
			highlightVars = [dfsStep.node];
			description = `Starte DFS von ${dfsStep.node}\n\nBesucht: {${Array.from(dfsStep.visitedVars).sort().join(', ')}}`;
		}

		steps.push({
			id: `cnf-binary-cycle-step-${idx}`,
			stage: 'cnf-binary',
			description,
			delta: { action: 'cycle-step', type: dfsStep.type },
			state: { baseCNFProductions: deepCopy(current), completed: false, startSymbol },
			clearLogs: false,
			highlightVariables: highlightVars,
			highlightVariablesStyle: dfsStep.type === 'cycle-found' ? 'warning' : 'focus',
			highlightProductions: finalProdStrings,
			cnfGraph: deepCopy(current)
		});
	});

	// Finales Ergebnis
	if (cycleDetection.hasCycle) {
		// Zyklus vorhanden -> Sprache ist unendlich
		steps.push({
			id: 'cnf-binary-result',
			stage: 'cnf-binary',
			description: `Zyklenerkennung abgeschlossen.\n\nERGEBNIS: Die Sprache ist UNENDLICH\n\nDas Abhängigkeitsgraph enthält einen Zyklus: ${cycleDetection.cycleNodes.join(' -> ')}\nDurch wiederholte Anwendung von Produktionen entlang des Zyklus können beliebig lange Wörter erzeugt werden.`,
			delta: { action: 'result', isFinite: false },
			state: { baseCNFProductions: deepCopy(current), isInfinite: true, completed: true, startSymbol },
			clearLogs: false,
			highlightVariables: varsSortedFinal,
			highlightVariablesStyle: 'warning',
			highlightProductions: finalProdStrings,
			cnfGraph: deepCopy(current)
		});
	} else {
		// Kein Zyklus -> Sprache ist endlich
		steps.push({
			id: 'cnf-binary-result',
			stage: 'cnf-binary',
			description: `Zyklenerkennung abgeschlossen.\n\nERGEBNIS: Die Sprache ist ENDLICH\n\nDas Abhängigkeitsgraph ist azyklisch (DAG). Es können nur endlich viele verschiedene Wörter erzeugt werden.`,
			delta: { action: 'result', isFinite: true },
			state: { baseCNFProductions: deepCopy(current), isInfinite: false, completed: true, startSymbol },
			clearLogs: false,
			highlightVariables: varsSortedFinal,
			highlightVariablesStyle: 'productive',
			highlightProductions: finalProdStrings,
			cnfGraph: deepCopy(current)
		});
	}

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
