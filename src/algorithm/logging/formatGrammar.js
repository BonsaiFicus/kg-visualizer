/**
 * Formatiert eine CFG als lesbare Protokollausgabe.
 */
export default function formatGrammar(grammar) {
	if (!hasProductions(grammar)) return '';

	const sections = [];

	if (grammar.startSymbol) {
		sections.push(`Start Symbol: ${grammar.startSymbol}`);
	}

	if (hasList(grammar.nonTerminals)) {
		sections.push(`Nicht-Terminale: ${grammar.nonTerminals.join(', ')}`);
	}

	if (hasList(grammar.terminals)) {
		sections.push(`Terminale: ${grammar.terminals.join(', ')}`);
	}

	sections.push(buildProductionLines(grammar.productions));

	return sections.filter(Boolean).join('\n\n') + '\n';
}

/**
 * Prueft, ob die CFG Produktionen enthaelt.
 */
function hasProductions(grammar) {
	return grammar && grammar.productions && Object.keys(grammar.productions).length > 0;
}

/**
 * Prueft, ob eine CFG-Liste Inhalte besitzt.
 */
function hasList(list) {
	return Array.isArray(list) && list.length > 0;
}

/**
 * Baut formatierte Produktionszeilen fuer die CFG.
 */
function buildProductionLines(productions) {
	const lines = ['Productions:'];
	const entries = Object.entries(productions);

	for (let i = 0; i < entries.length; i++) {
		const [lhs, rhsList] = entries[i];

		for (let j = 0; j < rhsList.length; j++) {
			const rhs = rhsList[j];
			const rhsStr = Array.isArray(rhs) ? rhs.join(' ') : rhs;
			lines.push(`  ${lhs} -> ${rhsStr}`);
		}
	}

	return lines.join('\n');
}
