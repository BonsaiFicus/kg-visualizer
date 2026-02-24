/**
 * Parst eine CFG-Textdefinition in eine strukturierte Grammatik.
 */
export default function parseGrammar(text) {
	const lines = text.split('\n').filter(line => line.trim() !== '');
	const grammar = createEmptyGrammar();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const parsed = parseGrammarLine(line, i);

		if (!parsed) {
			grammar.errors.push(line.trim());
			continue;
		}

		const { lhs, productions } = parsed;
		grammar.nonTerminals.add(lhs);
		ensureProductionSlot(grammar.productions, lhs);
		addUniqueProductions(grammar.productions[lhs], productions);
		collectSymbols(grammar, productions);
	}

	ensureStartSymbol(grammar);
	finalizeGrammar(grammar);

	return grammar;
};

/**
 * Prueft, ob ein Production-Symbol das leere Wort darstellt.
 */
export function isEpsilon(symbol) {
	return symbol === 'ε';
}

/**
 * Erzeugt das Grundgeruest fuer eine CFG.
 */
function createEmptyGrammar() {
	return {
		startSymbol: 'S',
		productions: {},
		nonTerminals: new Set(),
		terminals: new Set(),
		errors: [],
	};
}

/**
 * Zerlegt eine Produktionszeile der CFG in LHS und RHS.
 */
function parseGrammarLine(line, index) {
	let [lhs, rhs] = line.split('->').map(part => part.trim());
	if (!rhs || !lhs) return null;

	lhs = lhs.replace(/[^A-Z]/g, '');
	if (lhs === '') {
		console.warn(`${index + 1} "'${lhs}'" beinhaltet ungültiges Nicht-Terminal `);
		return null;
	}

	return {
		lhs,
		productions: normalizeProductions(rhs),
	};
}

/**
 * Normalisiert RHS-Produktionen einer CFG-Zeile.
 * _ wird zu ε konvertiert und als leeres Wort behandelt.
 */
function normalizeProductions(rhs) {
	const productions = rhs.split('|').map(prod => prod.trim());
	const cleanedProductions = productions.map((prod) => {
		// Konvertiere _ zu ε
		const withEpsilon = prod.replace(/_/g, 'ε');
		
		// Entferne alles außer Buchstaben und ε
		const cleaned = withEpsilon.replace(/[^a-zA-Zε]/g, '');
		
		// Wenn nur ε vorhanden: gib ε zurück (Epsilon-Symbol)
		if (cleaned === 'ε') {
			return 'ε';
		}
		
		// Wenn ε mit anderen Symbolen gemischt: entferne ε
		if (cleaned.includes('ε')) {
			return cleaned.replace(/ε/g, '');
		}
		
		// Ansonsten gib die bereinigte Version zurück
		return cleaned;
	});

	return [...new Set(cleanedProductions.filter((part) => part !== ''))];
}

/**
 * Initialisiert eine Produktionsliste fuer ein Nichtterminal.
 */
function ensureProductionSlot(productions, lhs) {
	if (!productions[lhs]) {
		productions[lhs] = [];
	}
}

/**
 * Fuegt eindeutige Produktionen fuer ein Nichtterminal hinzu.
 */
function addUniqueProductions(targetList, productions) {
	for (let i = 0; i < productions.length; i++) {
		const prod = productions[i];
		if (!targetList.includes(prod)) {
			targetList.push(prod);
		}
	}
}

/**
 * Ermittelt Terminale und Nichtterminale einer CFG-Zeile.
 */
function collectSymbols(grammar, productions) {
	for (let i = 0; i < productions.length; i++) {
		const prod = productions[i];

		if (prod === 'ε') {
			grammar.nonTerminals.add('ε');
			continue;
		}

		const symbols = prod.split('');
		for (let j = 0; j < symbols.length; j++) {
			const symbol = symbols[j];

			if (/[A-Z]/.test(symbol)) {
				grammar.nonTerminals.add(symbol);
			} else if (/[a-z]/.test(symbol)) {
				grammar.terminals.add(symbol);
			}
		}
	}
}

/**
 * Sichert die Existenz des CFG-Startsymbols.
 */
function ensureStartSymbol(grammar) {
	if (!grammar.productions['S']) {
		grammar.productions['S'] = [];
		grammar.nonTerminals.add('S');
	}
}

/**
 * Normalisiert die CFG-Mengen fuer die Ausgabe.
 */
function finalizeGrammar(grammar) {
	grammar.nonTerminals = Array.from(grammar.nonTerminals);
	grammar.terminals = Array.from(grammar.terminals);
}