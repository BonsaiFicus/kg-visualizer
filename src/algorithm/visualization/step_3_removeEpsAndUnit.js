/**
 * Parsed eine Produktion in einzelne Symbole und erkennt mehrzeilige Variablen wie S0, A1, usw.
 * @param {string} production - Die zu parsende Produktion (z.B. "S0AB", "ABc")
 * @returns {string[]} Array der Symbole (z.B. ["S0", "A", "B"])
 */
function parseSymbols(production) {
	// Spezialfall: eps
	if (production === 'eps') {
		return ['eps'];
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
 * Erzeugt Varianten einer Produktion, in denen ein bestimmtes Symbol entfernt wurde.
 * Berücksichtigt alle Positionen des Symbols.
 */
function generateVariantsWithoutVariable(production, variable) {
	const symbols = parseSymbols(production);
	const positions = [];

	// Finde alle Positionen des zu entfernenden Symbols
	for (let i = 0; i < symbols.length; i++) {
		if (symbols[i] === variable) {
			positions.push(i);
		}
	}

	if (positions.length === 0) {
		return [];
	}

	const variants = new Set();

	// Generiere alle Teilmengen von Positionen und entferne diese
	const totalCombinations = 1 << positions.length;
	for (let mask = 1; mask < totalCombinations; mask++) { // Start bei 1, nicht 0 (nicht alle Vorkommen behalten)
		const result = [];
		for (let i = 0; i < symbols.length; i++) {
			const posIndex = positions.indexOf(i);
			const shouldRemove = (mask & (1 << posIndex)) !== 0;
			
			if (posIndex === -1 || !shouldRemove) {
				result.push(symbols[i]);
			}
		}
		
		const variant = result.join('');
		if (variant.length > 0) {
			variants.add(variant);
		}
	}

	return Array.from(variants);
}

/**
 * Formatiert eine Grammatik-Produktionstabelle als Text-String.
 */
function formatGrammar(productions, label = '') {
	const vars = Object.keys(productions).sort((a, b) => a.localeCompare(b));
	const lines = vars
		.filter(v => (productions[v] || []).length > 0)
		.map(v => `${v} → ${productions[v].join(' | ')}`);
	
	if (label) {
		return `${label}:\n${lines.join('\n')}`;
	}
	return lines.join('\n');
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
 * Erzeugt Schritte zur ε- und Unit-Eliminierung in der CFG.
 * 
 * Algorithmus:
 * 1. Führe neue Startvariable S0 ein mit Regel S0 → S | ε
 *    Dies garantiert, dass die Startvariable nicht auf der rechten Seite vorkommt
 * 2. Für jede ε-Regel A → ε (wo A ≠ S0):
 *    - Entferne die Regel
 *    - Für jedes Vorkommen von A in Regeln R → uAv: Füge R → uv hinzu
 *    - Wiederholen, bis alle ε-Regeln eliminiert sind
 */
export default function generateRemoveEpsilonSteps(grammar, cnfGraph) {
	const steps = [];
	const oldStartSymbol = grammar.startSymbol || 'S';
	const newStartSymbol = 'S0';

	const productions = cnfGraph && Object.keys(cnfGraph).length > 0
		? deepCopy(cnfGraph)
		: deepCopy(grammar.productions || {});

	// Schritt 1: Neue Startvariable S0 einführen
	const initialProductions = deepCopy(productions);

	// Überprüfe, ob eps in der ursprünglichen Sprache ist
	const oldStartEps = (initialProductions[oldStartSymbol] || []).includes('eps');

	// Neue Startvariable mit altem Startsymbol und optional ε
	const newProductions = deepCopy(initialProductions);
	newProductions[newStartSymbol] = oldStartEps 
		? [oldStartSymbol, 'eps'] 
		: [oldStartSymbol];

	// Aktualisiere die Grammatik
	grammar.startSymbol = newStartSymbol;
	grammar.productions[newStartSymbol] = newProductions[newStartSymbol];

	steps.push({
		id: 'cnf-eps-intro-start',
		stage: 'cnf-eps',
		description: `
PHASE 1: NEUE STARTVARIABLE EINFÜHREN


GRAMMATIK G:
${formatGrammar(initialProductions, 'G')}

ÄNDERUNG:
Führe neue Startvariable S0 ein:\n  ${newStartSymbol} → ${newProductions[newStartSymbol].join(' | ')}\n
Grund: Die Startvariable darf nicht auf der rechten Seite von Produktionen vorkommen.

GRAMMATIK G' (nach S0-Einführung):
${formatGrammar(newProductions, 'G\'')}\n`,
		delta: { action: 'intro-new-start', newStart: newStartSymbol, oldStart: oldStartSymbol },
		state: { 
			baseCNFProductions: { ...newProductions }, 
			completed: false, 
			startSymbol: newStartSymbol 
		},
		clearLogs: false,
		highlightVariables: [newStartSymbol, oldStartSymbol],
		highlightVariablesStyle: 'productive',
		highlightProductions: newProductions[newStartSymbol].map(p => `${newStartSymbol} -> ${p}`),
		cnfGraph: { ...newProductions }
	});

	// Schritt 2: Finde alle ε-Regeln (außer S0 → ε)
	const nullableVars = new Set();
	Object.keys(newProductions).forEach(A => {
		if (A !== newStartSymbol && (newProductions[A] || []).includes('eps')) {
			nullableVars.add(A);
		}
	});

	let updated = deepCopy(newProductions);

	// NICHT hier eps entfernen - wir machen das schrittweise für jede Variable!

	if (nullableVars.size > 0) {
		steps.push({
			id: 'cnf-eps-find',
			stage: 'cnf-eps',
			description: `
PHASE 2: ε-REGELN IDENTIFIZIEREN


Folgende Variablen können ε ableiten:
${Array.from(nullableVars).map(v => `  ${v} → ε`).join('\n')}

Diese Regeln müssen eliminiert werden.

GRAMMATIK G' (nach Einführung von S0):
${formatGrammar(newProductions, 'G\'')}\n`,
			delta: { action: 'find-epsilon-rules' },
			state: { 
				baseCNFProductions: { ...updated }, 
				completed: false,
				startSymbol: newStartSymbol
			},
			clearLogs: false,
			highlightVariables: Array.from(nullableVars),
			highlightVariablesStyle: 'warning',
			highlightProductions: Array.from(nullableVars).map(v => `${v} -> eps`),
			cnfGraph: { ...newProductions }  // Zeige noch MIT eps-Produktionen
		});
	// Für jede nullable Variable A
	for (const epsVar of nullableVars) {
		// Speichere Zustand VORHER für diesen Schritt
		const beforeElimination = deepCopy(updated);
					// Sammle alle Regeln, die A auf der rechten Seite enthalten
			const affectedRules = new Map();
			Object.keys(updated).forEach(A => {
				(updated[A] || []).forEach((prod, idx) => {
					if (prod !== 'eps' && prod.includes(epsVar)) {
						if (!affectedRules.has(A)) {
							affectedRules.set(A, []);
						}
						affectedRules.get(A).push({ prod, idx });
					}
				});
			});

			// Für jede betroffene Regel, generiere Variante ohne epsVar
			const rulesToAdd = new Map();
			const changesPerVariable = new Map();
			
			affectedRules.forEach((prodInfos, A) => {
				if (!rulesToAdd.has(A)) {
					rulesToAdd.set(A, []);
				}
				if (!changesPerVariable.has(A)) {
					changesPerVariable.set(A, []);
				}

				prodInfos.forEach(({ prod }) => {
					const variants = generateVariantsWithoutVariable(prod, epsVar);
					variants.forEach(v => {
						if (v && !rulesToAdd.get(A).includes(v) && v !== 'eps' && !updated[A].includes(v)) {
							rulesToAdd.get(A).push(v);
							changesPerVariable.get(A).push({
								original: prod,
								added: v
							});
						}
					});
				});
			});

			// Füge neue Regeln hinzu
			rulesToAdd.forEach((newRules, A) => {
				newRules.forEach(rule => {
					if (rule && rule !== 'eps' && !updated[A].includes(rule)) {
						updated[A].push(rule);
					}
				});
			});

			// Jetzt entferne die eps-Produktion von epsVar
			if (updated[epsVar]) {
				updated[epsVar] = updated[epsVar].filter(p => p !== 'eps');
			}

			// Visualisierungs-Schritt für diese Elimination mit VORHER/NACHHER
			const affectedVarsSorted = Array.from(affectedRules.keys()).sort();
			
			let description = `ELIMINIERE: ${epsVar} → ε \n\n`;
			
			description += `SCHRITT:\n`;
			description += `1. Finde alle Produktionen mit ${epsVar} auf der rechten Seite\n`;
			description += `2. Füge Varianten ohne ${epsVar} hinzu\n`;
			description += `3. Entferne ${epsVar} → ε\n\n`;
			
			affectedVarsSorted.forEach(A => {
				const changeList = changesPerVariable.get(A) || [];
				const before = beforeElimination[A] || [];
				const after = updated[A] || [];
				
				description += `VARIABLE ${A}:\n`;
				description += `  VOR:  ${A} → ${before.join(' | ')}\n`;
				
				if (changeList.length > 0) {
					description += `  ÄNDERUNGEN:\n`;
					changeList.forEach(({ original, added }) => {
						description += `    Wegen ${A} → ${original}: füge hinzu ${A} → ${added}\n`;
					});
				}
				
				description += `  NACH: ${A} → ${after.join(' | ')}\n\n`;
			});
			
			// Zeige auch das Entfernen der eps-Produktion selbst
			if (beforeElimination[epsVar] && beforeElimination[epsVar].includes('eps')) {
				description += `ENTFERNE:\n`;
				description += `  ${epsVar} → ε (gelöscht)\n\n`;
			}
			
			description += `G' NACH ELIMINIERUNG:\n${formatGrammar(updated, '')}`;

			steps.push({
				id: `cnf-eps-eliminate-${epsVar}`,
				stage: 'cnf-eps',
				description,
				delta: { action: 'eliminate-epsilon', variable: epsVar },
				state: { 
					baseCNFProductions: { ...updated }, 
					completed: false,
					startSymbol: newStartSymbol
				},
				clearLogs: false,
				highlightVariables: [epsVar, ...affectedVarsSorted],
				highlightVariablesStyle: 'focus',
				highlightProductions: affectedVarsSorted.flatMap(A => (updated[A] || []).map(p => `${A} -> ${p}`)),
				cnfGraph: { ...updated }  // Zeigt NACH Eliminierung (ohne eps für epsVar)
			});
		}

		// Nach allen eps-Eliminierungen: Stelle sicher, dass ALLE eps-Produktionen weg sind (außer S0)
		Object.keys(updated).forEach(A => {
			if (A !== newStartSymbol) {
				updated[A] = (updated[A] || []).filter(p => p !== 'eps');
			}
		});

		// Expliziter Schritt nach Eliminierung: S0 -> eps bleibt, andere eps sind weg
		steps.push({
			id: 'cnf-eps-after-elimination',
			stage: 'cnf-eps',
			description: `Nach Eliminierung: Nur ${newStartSymbol} -> ε bleibt erhalten (alle anderen ε-Regeln wurden eliminiert)`,
			delta: { action: 'epsilon-cleanup' },
			state: { 
				baseCNFProductions: { ...updated }, 
				completed: false,
				startSymbol: newStartSymbol
			},
			clearLogs: false,
			highlightVariables: [newStartSymbol],
			highlightVariablesStyle: 'productive',
			highlightProductions: [`${newStartSymbol} -> eps`],
			cnfGraph: { ...updated }
		});
	}

	// Finale Zusammenfassung
	const varsSorted = Object.keys(updated).sort((a, b) => a.localeCompare(b));
	const grammarLines = buildGrammarLines(updated, varsSorted);
	const finalProductions = buildProductionStrings(updated, varsSorted);

	steps.push({
		id: 'cnf-eps-complete',
		stage: 'cnf-eps',
		description: `ε-Eliminierung abgeschlossen. Neue Grammatik G'':\n${grammarLines}`,
		delta: { action: 'complete' },
		state: { 
			baseCNFProductions: { ...updated }, 
			completed: true,
			startSymbol: newStartSymbol
		},
		clearLogs: false,
		highlightVariables: varsSorted.filter(v => (updated[v] || []).length > 0),
		highlightVariablesStyle: 'productive',
		highlightProductions: finalProductions,
		cnfGraph: { ...updated }
	});

	// Aktualisiere die Grammatik mit den finalen Produktionen
	grammar.productions = updated;

	// 
	// Unit-Eliminierung: Entfernung von Produktionen der Form A → B
	//

	// Unit-Closure berechnen: Welche Variablen sind von welchen Variablen erreichbar?
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

	// Finde alle Unit-Produktionen (A → B, wo B ist eine Variable)
	const unitProductions = new Map(); // A -> Set of B
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
			description: `
PHASE 3: UNIT-PRODUKTIONEN ENTFERNEN (A → B)


Alle Unit-Produktionen, die entfernt werden müssen:
${allUnitProdStrings.join('\n')}

ALGORITHMUS:
1. Für jede Unit-Produktion X → Y: Übernehme alle Nicht-Unit-Produktionen von Y für X
2. Lösche dann alle Unit-Produktionen

GRAMMATIK G'' (zum Verarbeiten):
${formatGrammar(updated, 'G\'\'')}`,
			delta: { action: 'init' },
			state: { baseCNFProductions: { ...updated }, completed: false, startSymbol: newStartSymbol },
			clearLogs: false,
			highlightVariables: [],
			highlightVariablesStyle: 'warning',
			highlightProductions: allUnitProdStrings,
			cnfGraph: { ...updated }
		});

		const unitProcessed = deepCopy(updated);
		const processedVariables = [];
		const sortedVars = Object.keys(updated).sort();

		// Für jede Variable: Ersetze Unit-Produktionen durch Nicht-Unit-Produktionen
		sortedVars.forEach(A => {
			const reachable = unitClosure[A];
			const toAdd = new Set();
			const unitProdsForA = [];
			const productionSources = {};

			[...reachable].forEach(B => {
				if (B === A) return;
				// WICHTIG: Schaue auf unitProcessed[B], nicht updated[B]!
				// Damit sehen wir die bereits verarbeiteten Nicht-Unit-Produktionen
				(unitProcessed[B] || []).forEach(prod => {
					if (!isNonTerminal(prod) && !toAdd.has(prod)) {
						// CNF-REGEL: S0 darf nicht auf rechten Seiten anderer Variablen vorkommen
						// Überspringe Produktionen, die S0 enthalten, wenn A != S0
						const symbols = parseSymbols(prod);
						if (A !== newStartSymbol && symbols.includes(newStartSymbol)) {
							// Diese Produktion enthält S0, darf nicht nach A kopiert werden
							return;
						}
						
						toAdd.add(prod);
						if (!productionSources[B]) productionSources[B] = [];
						productionSources[B].push(prod);
					}
				});
				// Sammle Unit-Produktionen
				(updated[A] || []).forEach(prod => {
					if (isNonTerminal(prod) && prod === B) {
						unitProdsForA.push(`${A} -> ${B}`);
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

					// Grammatik VORHER für diese Variable
					const grammarBefore = processedVariables.slice(0, -1)
						.map(v => `${v} → ${(updated[v] || []).join(' | ')}`)
						.concat([`${A} → ${(updated[A] || []).join(' | ')}`])
						.join('\n');

					// Grammatik NACHHER
					const grammarAfter = processedVariables
						.map(v => `${v} → ${unitProcessed[v].join(' | ')}`)
						.join('\n');

					// Erstelle aussagekräftige Beschreibung mit Vorher/Nachher Format
					let description = ` BEARBEITE: ${A} \n\n`;
					
					description += `G'' VOR BEARBEITUNG:\n`;
					description += grammarBefore + '\n\n';
					
					// Zeige Unit-Produktionen
					const unitProds = (updated[A] || []).filter(p => isNonTerminal(p));
					if (unitProds.length > 0) {
						description += `UNIT-PRODUKTIONEN:\n`;
						unitProds.forEach(unitVar => {
							description += `  ${A} → ${unitVar}\n`;
						});
						description += `\n`;
					}

					// Zeige was von erreichbaren Variablen übernommen wird
					description += `ÜBERNEHME VON:\n`;
					Object.keys(productionSources).forEach(B => {
						const prods = productionSources[B];
						description += `  ${B} → ${prods.join(' | ')}\n`;
					});

					description += `\nRESULTAT:\n`;
					description += `  ${A} → ${addedProds.join(' | ')}\n\n`;

					description += `G'' NACH BEARBEITUNG:\n`;
					description += grammarAfter;

					const allProdsProcessing = buildProductionStrings(unitProcessed);

					steps.push({
						id: `cnf-unit-process-${A}`,
						stage: 'cnf-unit',
						description,
						delta: { action: 'process-unit', variable: A },
						state: { baseCNFProductions: { ...unitProcessed }, completed: false, startSymbol: newStartSymbol },
						clearLogs: false,
						highlightVariables: [A],
						highlightVariablesStyle: 'focus',
						highlightProductions: allProdsProcessing,
						cnfGraph: { ...unitProcessed }
					});
				}
			}
		});

		// Entferne Unit-Produktionen
		const finalGrammar = deepCopy(unitProcessed);
		Object.keys(finalGrammar).forEach(A => {
			finalGrammar[A] = (finalGrammar[A] || []).filter(prod => !isNonTerminal(prod));
		});

		// WICHTIG: Stelle sicher, dass S0 NIEMALS auf rechten Seiten auftaucht (außer in S0 selbst)
		// Dies ist eine CNF-Anforderung: Die Startvariable darf nicht auf rechten Seiten vorkommen
		const protectStartSymbol = (grammar, startSym) => {
			// Verwende nur nicht-rekursive S0-Produktionen (die nicht S0 selbst enthalten)
			// um Endlosschleifen zu vermeiden
			const s0Productions = [...(grammar[startSym] || [])]
				.filter(p => p !== 'eps')
				.filter(p => !parseSymbols(p).includes(startSym)); // Keine rekursiven Produktionen!
			
			if (s0Productions.length === 0) {
				// Keine nicht-rekursiven Produktionen verfügbar - nichts zu tun
				return false;
			}
			
			let changed = false;
			
			Object.keys(grammar).forEach(A => {
				if (A === startSym) return; // S0 selbst nicht modifizieren
				
				const newProductions = [];
				(grammar[A] || []).forEach(prod => {
					const symbols = parseSymbols(prod);
					
					// Prüfe ob S0 in dieser Produktion vorkommt
					if (symbols.includes(startSym)) {
						changed = true;
						// Expandiere S0: Ersetze jedes Vorkommen von S0 durch seine Produktionen
						// Wenn S0 → X | Y hat, und wir A → S0B haben, wird das zu A → XB | YB
						const expandedProds = expandStartSymbolInProduction(symbols, startSym, s0Productions);
						expandedProds.forEach(exp => {
							if (exp && exp !== 'eps' && !newProductions.includes(exp)) {
								newProductions.push(exp);
							}
						});
					} else {
						newProductions.push(prod);
					}
				});
				
				grammar[A] = newProductions;
			});
			
			return changed;
		};

		// Hilfsfunktion: Expandiere S0 in einer Produktion
		// Wenn S0 mehrfach vorkommt, erzeugen wir alle Kombinationen
		const expandStartSymbolInProduction = (symbols, startSym, s0Productions) => {
			if (!symbols.includes(startSym)) {
				return [symbols.join('')];
			}
			
			// Sicherheitscheck: Wenn s0Productions leer ist, kann nicht expandiert werden
			if (s0Productions.length === 0) {
				return [];
			}
			
			// Einfache einmalige Expansion: Ersetze jedes S0 durch die S0-Produktionen
			const result = [];
			
			s0Productions.forEach(s0Prod => {
				const s0Symbols = parseSymbols(s0Prod);
				const newSymbols = [];
				
				for (let i = 0; i < symbols.length; i++) {
					if (symbols[i] === startSym) {
						// Ersetze S0 durch die Expansion
						newSymbols.push(...s0Symbols);
					} else {
						newSymbols.push(symbols[i]);
					}
				}
				
				const expanded = newSymbols.join('');
				if (expanded && expanded !== 'eps') {
					result.push(expanded);
				}
			});
			
			return result;
		};

		const s0WasRemoved = protectStartSymbol(finalGrammar, newStartSymbol);
		
		if (s0WasRemoved) {
			steps.push({
				id: 'cnf-unit-protect-start',
				stage: 'cnf-unit',
				description: `CNF-KORREKTUR: Entferne ${newStartSymbol} von rechten Seiten\n\nDie Startvariable ${newStartSymbol} darf nicht auf rechten Seiten vorkommen.\nAlle Vorkommen wurden durch die Produktionen von ${newStartSymbol} ersetzt.\n\nGrammatik nach Korrektur:\n${formatGrammar(finalGrammar, '')}`,
				delta: { action: 'protect-start-symbol' },
				state: { 
					baseCNFProductions: { ...finalGrammar }, 
					completed: false,
					startSymbol: newStartSymbol
				},
				clearLogs: false,
				highlightVariables: [newStartSymbol],
				highlightVariablesStyle: 'warning',
				highlightProductions: buildProductionStrings(finalGrammar),
				cnfGraph: { ...finalGrammar }
			});
		}

		// DEBUG-AUS: Debug-Steps auskommentiert für saubere Ausgabe
		/*
		// Debug-Step: Zeige Grammatik nach Unit-Filter, VOR Erreichbarkeitsprüfung
		const debugVarsBeforeReachability = Object.keys(finalGrammar).sort();
		const debugGrammarBeforeReachability = formatGrammar(finalGrammar, '');
		
		steps.push({
			id: 'cnf-unit-debug-before-reachability',
			stage: 'cnf-unit',
			description: `DEBUG: Grammatik nach Unit-Filter, VOR Erreichbarkeitsprüfung:\n\nVariablen: ${debugVarsBeforeReachability.join(', ')}\n\n${debugGrammarBeforeReachability}`,
			delta: { action: 'debug-before-reachability' },
			state: { 
				baseCNFProductions: { ...finalGrammar }, 
				completed: false,
				startSymbol: newStartSymbol
			},
			clearLogs: false,
			highlightVariables: debugVarsBeforeReachability,
			highlightVariablesStyle: 'focus',
			highlightProductions: buildProductionStrings(finalGrammar, debugVarsBeforeReachability),
			cnfGraph: { ...finalGrammar }
		});
		*/

		// Berechne erreichbare Variablen von der Startvariable
		const reachableVars = computeReachableVars(finalGrammar, newStartSymbol);

		/*
		// Debug-Step: Zeige welche Variablen erreichbar sind
		const unreachableVars = Object.keys(finalGrammar).filter(v => !reachableVars.has(v));
		steps.push({
			id: 'cnf-unit-debug-reachability',
			stage: 'cnf-unit',
			description: `DEBUG: Erreichbarkeitsanalyse von ${newStartSymbol}:\n\nErreichbare Variablen: ${Array.from(reachableVars).sort().join(', ')}\nUnerreichbare Variablen (werden entfernt): ${unreachableVars.length > 0 ? unreachableVars.join(', ') : 'keine'}`,
			delta: { action: 'debug-reachability' },
			state: { 
				baseCNFProductions: { ...finalGrammar }, 
				completed: false,
				startSymbol: newStartSymbol
			},
			clearLogs: false,
			highlightVariables: Array.from(reachableVars),
			highlightVariablesStyle: 'productive',
			highlightProductions: buildProductionStrings(finalGrammar, Object.keys(finalGrammar)),
			cnfGraph: { ...finalGrammar }
		});
		*/

		// Behalte nur erreichbare Variablen
		const cleanedGrammar = {};
		reachableVars.forEach(v => {
			cleanedGrammar[v] = finalGrammar[v] || [];
		});

		const varsSortedCleaned = Array.from(reachableVars).sort((a, b) => a.localeCompare(b));
		const grammarLinesCleaned = buildGrammarLines(cleanedGrammar, varsSortedCleaned);
		const finalProductionsCleaned = buildProductionStrings(cleanedGrammar, varsSortedCleaned);

		// Zeige gelöschte Unit-Produktionen
		const allUnitProds = [];
		Object.keys(unitProcessed).forEach(A => {
			(unitProcessed[A] || []).forEach(prod => {
				if (isNonTerminal(prod)) {
					allUnitProds.push(`${A} → ${prod}`);
				}
			});
		});

		let completeDescription = `
UNIT-PRODUKTION-ELIMINIERUNG ABGESCHLOSSEN
\n\n`;
		
		if (allUnitProds.length > 0) {
			completeDescription += `GELÖSCHTE UNIT-PRODUKTIONEN:\n`;
			completeDescription += allUnitProds.join('\n') + '\n\n';
		}
		
		completeDescription += `FINALE GRAMMATIK G''' (nur noch Nicht-Unit-Produktionen):\n`;
		completeDescription += formatGrammar(cleanedGrammar, 'G\'\'\'');

		steps.push({
			id: 'cnf-unit-complete',
			stage: 'cnf-unit',
			description: completeDescription,
			delta: { action: 'complete' },
			state: { 
				baseCNFProductions: { ...cleanedGrammar }, 
				completed: true,
				startSymbol: newStartSymbol
			},
			clearLogs: false,
			highlightVariables: varsSortedCleaned,
			highlightVariablesStyle: 'productive',
			highlightProductions: finalProductionsCleaned,
			cnfGraph: { ...cleanedGrammar }
		});

		grammar.productions = cleanedGrammar;
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
			const symbols = parseSymbols(prod);

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

