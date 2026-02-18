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
 * Erzeugt Varianten einer CFG-Produktion durch Nullable-Entfernung.
 */
function expandByNullable(production, nullable) {
	if (production === 'eps') {
		return [];
	}

	const symbols = production.split('');
	const positions = [];

	for (let i = 0; i < symbols.length; i++) {
		const s = symbols[i];
		if (isNonTerminal(s) && nullable.has(s)) {
			positions.push(i);
		}
	}

	if (positions.length === 0) {
		return [production];
	}

	const results = new Set();

	// Teilmengen-Enumeration ist der zentrale Kniff fuer Nullable-Erweiterung.
	const total = 1 << positions.length;
	for (let mask = 0; mask < total; mask++) {
		const keep = [];
		for (let i = 0; i < symbols.length; i++) {
			const posIndex = positions.indexOf(i);
			if (posIndex === -1) {
				keep.push(symbols[i]);
			} else {
				// Wenn Bit gesetzt -> entferne dieses nullable Symbol
				const remove = (mask & (1 << posIndex)) !== 0;
				if (!remove) keep.push(symbols[i]);
			}
		}
		const candidate = keep.join('');
		if (candidate.length > 0) {
			results.add(candidate);
		}
	}

	return [...results];
}

/**
 * Berechnet Nullable-Variablen der CFG per Fixpunkt.
 */
function computeNullableVariables(productions) {
	const nullable = new Set();
	const variables = Object.keys(productions);

	for (let i = 0; i < variables.length; i++) {
		const A = variables[i];
		const prods = productions[A] || [];

		if (prods.includes('eps')) {
			nullable.add(A);
		}
	}

	let changed = true;
	while (changed) {
		changed = false;

		for (let i = 0; i < variables.length; i++) {
			const A = variables[i];

			if (nullable.has(A)) {
				continue;
			}

			const prods = productions[A] || [];
			const canBeNull = checkIfNullable(prods, nullable);

			if (canBeNull) {
				nullable.add(A);
				changed = true;
			}
		}
	}

	return nullable;
}

/**
 * Prueft, ob eine Variable durch Produktionen nullable sein kann.
 */
function checkIfNullable(prods, nullable) {
	for (let i = 0; i < prods.length; i++) {
		const p = prods[i];

		if (p === 'eps') {
			return true;
		}

		const symbols = p.split('');
		let allNullable = true;

		for (let j = 0; j < symbols.length; j++) {
			const s = symbols[j];

			if (!isNonTerminal(s) || !nullable.has(s)) {
				allNullable = false;
				break;
			}
		}

		if (allNullable) {
			return true;
		}
	}

	return false;
}

/**
 * Erzeugt Schritte zur ε- und Unit-Eliminierung in der CFG.
 */
export default function generateRemoveEpsilonSteps(grammar, cnfGraph) {
	const steps = [];
	const startSymbol = grammar.startSymbol || 'S';

	const productions = cnfGraph && Object.keys(cnfGraph).length > 0
		? deepCopy(cnfGraph)
		: deepCopy(grammar.productions || {});

	const directEpsVars = Object.keys(productions).filter(A => (productions[A] || []).includes('eps'));
	const directEpsProdStrings = directEpsVars.map(A => `${A} -> eps`);

	steps.push({
		id: 'cnf-eps-init',
		stage: 'cnf-eps',
		description: 'Entferne eps: Bestimme zunächst nullable Variablen (eps-Variablen)',
		delta: { action: 'init' },
		state: { baseCNFProductions: { ...productions }, completed: false },
		clearLogs: false,
		highlightVariables: directEpsVars,
		highlightVariablesStyle: 'warning',
		highlightProductions: directEpsProdStrings,
		cnfGraph: { ...productions }
	});

	const nullable = computeNullableVariables(productions);

	[...nullable].forEach(V => {
		steps.push({
			id: `cnf-eps-nullable-${V}`,
			stage: 'cnf-eps',
			description: `Variable ${V} ist nullable (kann eps erzeugen)`,
			delta: { action: 'nullable-add', variable: V },
			state: { baseCNFProductions: { ...productions }, completed: false },
			clearLogs: false,
			highlightVariables: [V],
			highlightVariablesStyle: 'processing',
			highlightProductions: productions[V]?.includes('eps') ? [`${V} -> eps`] : [],
			cnfGraph: { ...productions }
		});
	});

	steps.push({
		id: 'cnf-eps-nullable-complete',
		stage: 'cnf-eps',
		description: `Nullable Variablen gefunden: {${[...nullable].join(', ')}}`,
		delta: { action: 'nullable-complete' },
		state: { baseCNFProductions: { ...productions }, completed: false },
		clearLogs: false,
		highlightVariables: [...nullable],
		highlightVariablesStyle: 'processing',
		highlightProductions: [],
		cnfGraph: { ...productions }
	});

	const updated = deepCopy(productions);
	Object.keys(updated).forEach(A => {
		const prods = updated[A] || [];
		const expanded = new Set(prods);
		prods.forEach(p => {
			const variants = expandByNullable(p, nullable);
			variants.forEach(v => expanded.add(v));
		});
		expanded.delete('eps');
		updated[A] = [...expanded];

		steps.push({
			id: `cnf-eps-expand-${A}`,
			stage: 'cnf-eps',
			description: `Passe Produktionen von ${A} an (entferne nullable Symbole):\n${updated[A].map(v => `${A} -> ${v}`).join('\n')}`,
			delta: { action: 'expand', variable: A, added: updated[A] },
			state: { baseCNFProductions: { ...updated }, completed: false },
			clearLogs: false,
			highlightVariables: [A],
			highlightVariablesStyle: 'focus',
			highlightProductions: updated[A].map(v => `${A} -> ${v}`),
			cnfGraph: { ...updated }
		});
	});

	const removedEpsProdStrings = [];
	Object.keys(updated).forEach(A => {
		(updated[A] || []).forEach(p => { if (p === 'eps') removedEpsProdStrings.push(`${A} -> eps`); });
	});

	Object.keys(updated).forEach(A => {
		updated[A] = (updated[A] || []).filter(p => p !== 'eps');
	});

	steps.push({
		id: 'cnf-eps-remove',
		stage: 'cnf-eps',
		description: 'Entferne alle eps-Produktionen aus dem Graphen',
		delta: { action: 'remove-eps' },
		state: { baseCNFProductions: { ...updated }, completed: false },
		clearLogs: false,
		highlightVariables: [...nullable],
		highlightVariablesStyle: 'warning',
		highlightProductions: removedEpsProdStrings.length > 0 ? removedEpsProdStrings : Object.keys(updated).flatMap(A => (updated[A] || []).map(p => `${A} -> ${p}`)),
		cnfGraph: { ...updated }
	});

	const varsSorted = Object.keys(updated).sort((a, b) => a.localeCompare(b));
	const grammarLines = buildGrammarLines(updated, varsSorted);
	const finalProductions = buildProductionStrings(updated, varsSorted);

	steps.push({
		id: 'cnf-eps-complete',
		stage: 'cnf-eps',
		description: `eps-Eliminierung abgeschlossen. Neue Grammatik G'':\n${grammarLines}`,
		delta: { action: 'complete' },
		state: { baseCNFProductions: { ...updated }, completed: true },
		clearLogs: false,
		highlightVariables: varsSorted.filter(v => (updated[v] || []).length > 0),
		highlightVariablesStyle: 'productive',
		highlightProductions: finalProductions,
		cnfGraph: { ...updated }
	});

	// Unit-Eliminierung folgt als zweiter Teil des Schritts.

	// Unit-Closure ist der zentrale Schritt fuer die Ableitung nichtterminaler Ketten.
	const computeUnitClosure = (prods) => {
		const closure = {};
		Object.keys(prods).forEach(v => {
			closure[v] = new Set([v]); // Jede Variable ist von sich selbst erreichbar
		});

		let changed = true;
		while (changed) {
			changed = false;
			Object.keys(prods).forEach(A => {
				const currClosures = [...closure[A]];
				(prods[A] || []).forEach(prod => {
					if (isNonTerminal(prod) && !closure[A].has(prod)) {
						closure[A].add(prod);
						changed = true;
					}
				});
			});
		}

		return closure;
	};

	const unitClosure = computeUnitClosure(updated);

	const unitProductions = new Map(); // A -> Set of B (für jeden A, welche B gibt es)
	Object.keys(updated).forEach(A => {
		(updated[A] || []).forEach(prod => {
			if (isNonTerminal(prod)) {
				if (!unitProductions.has(A)) unitProductions.set(A, new Set());
				unitProductions.get(A).add(prod);
			}
		});
	});

	const allUnitProdStrings = [];
	unitProductions.forEach((targets, A) => {
		targets.forEach(B => {
			allUnitProdStrings.push(`${A} -> ${B}`);
		});
	});

	if (allUnitProdStrings.length > 0) {
		steps.push({
			id: 'cnf-unit-init',
			stage: 'cnf-unit',
			description: 'Folgende Unitproduktionen müssen entfernt werden\n' + allUnitProdStrings.join('\n'),
			delta: { action: 'init' },
			state: { baseCNFProductions: { ...updated }, completed: false },
			clearLogs: false,
			highlightVariables: [],
			highlightVariablesStyle: 'warning',
			highlightProductions: allUnitProdStrings,
			cnfGraph: { ...updated }
		});

		const unitProcessed = deepCopy(updated);
		const processedVariables = [];

		const sortedVars = Object.keys(updated).sort();

		sortedVars.forEach(A => {
			const reachable = unitClosure[A];
			const toAdd = new Set();

			[...reachable].forEach(B => {
				if (B === A) return;
				(updated[B] || []).forEach(prod => {
					if (!isNonTerminal(prod) && !toAdd.has(prod)) {
						toAdd.add(prod);
					}
				});
			});

			if (toAdd.size > 0) {
				if (!unitProcessed[A]) unitProcessed[A] = [];

				const addedProds = [...toAdd].filter(p => !(unitProcessed[A] || []).includes(p));
				if (addedProds.length > 0) {
					addedProds.forEach(prod => {
						if (!unitProcessed[A].includes(prod)) {
							unitProcessed[A].push(prod);
						}
					});

					processedVariables.push(A);

					const currentGrammarLines = processedVariables
						.map(v => `${v} -> ${unitProcessed[v].join(' | ')}`)
						.join('\n');

					const allProdsProcessing = buildProductionStrings(unitProcessed);

					steps.push({
						id: `cnf-unit-process-${A}`,
						stage: 'cnf-unit',
						description: `Ausgangsgrammatik G'':\n${grammarLines}\n\nAktuelle Grammatik:\n${currentGrammarLines}`,
						delta: { action: 'process-unit', variable: A },
						state: { baseCNFProductions: { ...unitProcessed }, completed: false },
						clearLogs: false,
						highlightVariables: [A],
						highlightVariablesStyle: 'focus',
						highlightProductions: allProdsProcessing,
						cnfGraph: { ...unitProcessed }
					});
				}
			}
		});

		const finalGrammar = deepCopy(unitProcessed);
		const unitProdsToRemove = [];
		Object.keys(unitProcessed).forEach(A => {
			(unitProcessed[A] || []).forEach(prod => {
				if (isNonTerminal(prod)) {
					unitProdsToRemove.push({ source: A, target: prod });
				}
			});
		});

		unitProdsToRemove.sort((a, b) => {
			if (a.source !== b.source) return a.source.localeCompare(b.source);
			return a.target.localeCompare(b.target);
		});

		// Hilfsfunktion: Berechne erreichbare Variablen von startSymbol
		/**
		 * Entfernt Unit-Produktionen aus der CFG und aktualisiert die Erreichbarkeit.
		 */
		const removeUnitProductions = () => {
			unitProdsToRemove.forEach(({ source: A, target: B }) => {
				const varsSortedBeforeRemove = Object.keys(finalGrammar).sort((a, b) => a.localeCompare(b));
				const grammarLinesBeforeRemove = buildGrammarLines(finalGrammar, varsSortedBeforeRemove);
				const allProdsBeforeRemove = buildProductionStrings(finalGrammar, varsSortedBeforeRemove);

				steps.push({
					id: `cnf-unit-remove-${A}-to-${B}`,
					stage: 'cnf-unit',
					description: `Ausgangsgrammatik G'':\n${grammarLines}\n\nAktuelle Grammatik:\n${grammarLinesBeforeRemove}`,
					delta: { action: 'remove-unit', fromVar: A, toVar: B },
					state: { baseCNFProductions: { ...finalGrammar }, completed: false },
					clearLogs: false,
					highlightVariables: [A, B],
					highlightVariablesStyle: 'warning',
					highlightProductions: allProdsBeforeRemove,
					cnfGraph: { ...finalGrammar }
				});

				finalGrammar[A] = (finalGrammar[A] || []).filter(prod => prod !== B);

				const reachableAfterRemoval = computeReachableVars(finalGrammar, startSymbol);

				Object.keys(finalGrammar).forEach(v => {
					if (!reachableAfterRemoval.has(v)) {
						delete finalGrammar[v];
					}
				});
			});
		};

		removeUnitProductions();

		const reachableVars = computeReachableVars(finalGrammar, startSymbol);

		const cleanedGrammar = {};
		reachableVars.forEach(v => {
			cleanedGrammar[v] = finalGrammar[v] || [];
		});

		const varsSortedCleaned = Array.from(reachableVars).sort((a, b) => a.localeCompare(b));
		const grammarLinesCleaned = buildGrammarLines(cleanedGrammar, varsSortedCleaned);
		const finalProductionsCleaned = buildProductionStrings(cleanedGrammar, varsSortedCleaned);

		steps.push({
			id: 'cnf-unit-complete',
			stage: 'cnf-unit',
			description: `Unit-Produktion-Eliminierung abgeschlossen. Neue Grammatik G''':\n${grammarLinesCleaned}`,
			delta: { action: 'complete' },
			state: { baseCNFProductions: { ...cleanedGrammar }, completed: true },
			clearLogs: false,
			highlightVariables: varsSortedCleaned,
			highlightVariablesStyle: 'productive',
			highlightProductions: finalProductionsCleaned,
			cnfGraph: { ...cleanedGrammar }
		});
	}

	return steps;
}

/**
 * Erstellt eine tiefe Kopie einer CFG-Produktionstabelle.
 */
function deepCopy(obj) {
	return JSON.parse(JSON.stringify(obj || {}));
}

/**
 * Formatiert CFG-Produktionen als Text.
 */
function buildGrammarLines(productions, vars = Object.keys(productions).sort((a, b) => a.localeCompare(b))) {
	return vars
		.filter(v => (productions[v] || []).length > 0)
		.map(v => `${v} -> ${productions[v].join(' | ')}`)
		.join('\n');
}

/**
 * Erstellt eine Liste einzelner CFG-Produktionen.
 */
function buildProductionStrings(productions, vars = Object.keys(productions).sort((a, b) => a.localeCompare(b))) {
	return vars
		.filter(v => (productions[v] || []).length > 0)
		.flatMap(v => (productions[v] || []).map(p => `${v} -> ${p}`));
}

/**
 * Berechnet erreichbare Variablen der CFG ab dem Startsymbol.
 */
function computeReachableVars(prods, startSym) {
	const reachable = new Set([startSym]);
	const queue = [startSym];

	while (queue.length > 0) {
		const v = queue.shift();
		const prods_v = prods[v] || [];

		for (let i = 0; i < prods_v.length; i++) {
			const prod = prods_v[i];
			const symbols = prod.split('');

			for (let j = 0; j < symbols.length; j++) {
				const sym = symbols[j];

				if (isNonTerminal(sym) && !reachable.has(sym)) {
					reachable.add(sym);
					queue.push(sym);
				}
			}
		}
	}

	return reachable;
}

