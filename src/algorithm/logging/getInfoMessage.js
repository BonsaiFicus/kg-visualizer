/**
 * Erstellt Statusmeldungen fuer CFG-Aenderungen.
 */
export function getGrammarChangeMessage(parsedGrammar) {
	if (hasErrors(parsedGrammar)) {
		return `Fehlerhafte Grammatik: ${parsedGrammar.errors.join(' | ')}`;
	}

	if (hasProductions(parsedGrammar)) {
		return 'Grammatik aktualisiert';
	}

	return 'Keine Grammatik geladen';
}

/**
 * Meldet den Moduswechsel der CFG-Analyse.
 */
export function getAnalyzeModeMessage(analyzeFlag) {
	return analyzeFlag ? 'Analyse-Modus aktiviert' : 'Anzeige-Modus aktiviert';
}

/**
 * Liefert Schrittmeldungen waehrend der CFG-Transformation.
 */
export function getStepPopupMessage(currentStep) {
	if (!currentStep) return '';

	const action = currentStep.delta?.action;

	if (currentStep.stage === 'initialization') {
		if (action === 'init') return 'Terminalsuche...';
		if (action === 'add') return `Variable ${currentStep.delta.variable} wird in V' eingefügt`;
		if (action === 'check') return 'Prüfe weitere Variablen...';
	}

	if (currentStep.stage === 'iteration') {
		if (action === 'iteration-start') return `Fixpunkt-Iteration ${currentStep.delta.iteration}...`;
		if (action === 'add') return `Variable ${currentStep.delta.variable} wird in V' eingefügt`;
		if (action === 'fixpoint') return 'Fixpunkt erreicht!';
	}

	if (currentStep.stage === 'result') {
		return currentStep.state?.isEmptyLanguage ? 'Sprache ist LEER' : 'Sprache ist NICHT LEER';
	}

	if (currentStep.stage === 'cnf-build') {
		if (action === 'init-with-start') return 'Baue CNF-Basis-Graph...';
		if (action === 'add') return `Füge ${currentStep.delta.variable} hinzu`;
		if (action === 'complete') return 'CNF-Basis-Graph vollständig!';
	}

	if (currentStep.stage === 'cnf-eps') {
		if (action === 'init') return 'eps-Eliminierung: finde eps-Variablen...';
		if (action === 'nullable-add') return `eps-Variable erkannt: ${currentStep.delta.variable}`;
		if (action === 'nullable-complete') return 'eps-Variablen bestimmt';
		if (action === 'expand') return `Erweitere Produktionen von ${currentStep.delta.variable}`;
		if (action === 'remove-eps') return 'Entferne eps-Produktionen';
		if (action === 'complete') return 'eps-Eliminierung abgeschlossen!';
	}

	if (currentStep.stage === 'cnf-unit') {
		if (action === 'init') return 'finde Unit-Produktionen...';
		if (action === 'process-unit') return `Bearbeite Unit-Produktionen von ${currentStep.delta.variable}`;
		if (action === 'remove-unit') {
			return `Entferne Unit-Produktion ${currentStep.delta.fromVar} -> ${currentStep.delta.toVar}`;
		}
		if (action === 'complete') return 'Unit-Eliminierung abgeschlossen!';
	}

	if (currentStep.stage === 'cnf-long') {
		if (action === 'init') return 'Terminals isolieren in langen Produktionen...';
		if (action === 'create-terminal-var') {
			return `Führe Variable ${currentStep.delta.variable} für Terminal '${currentStep.delta.terminal}' ein`;
		}
		if (action === 'replace-terminal') return `Ersetze Terminals in Produktionen von ${currentStep.delta.variable}`;
		if (action === 'complete') return 'Isolation der Terminals abgeschlossen!';
	}

	if (currentStep.stage === 'cnf-binary') {
		if (action === 'init') return 'Binäre Aufspaltung: Kaskadiere lange Produktionen...';
		if (action === 'create-helpers') {
			return `Erstelle Hilfsvariablen für ${currentStep.delta.variable}: ${currentStep.delta.helpers.join(', ')}`;
		}
		if (action === 'add-binary-rule') return `Füge binäre Regel hinzu: ${currentStep.delta.rule}`;
		if (action === 'complete') return 'CNF erreicht! Alle Produktionen sind binär.';
		if (action === 'cycle-step') return getCyclePopupMessage(currentStep.delta.type);
		if (action === 'result') {
			return currentStep.delta?.isFinite ? 'Sprache ist ENDLICH' : 'Sprache ist UNENDLICH';
		}
	}

	return '';
}

/**
 * Prueft, ob die CFG-Definition Fehler enthaelt.
 */
function hasErrors(parsedGrammar) {
	return parsedGrammar && Array.isArray(parsedGrammar.errors) && parsedGrammar.errors.length > 0;
}

/**
 * Prueft, ob die CFG mindestens eine Produktion besitzt.
 */
function hasProductions(parsedGrammar) {
	return parsedGrammar && Object.keys(parsedGrammar.productions || {}).length > 0;
}

/**
 * Formatiert Meldungen zur Zyklenerkennung in CFG-Graphen.
 */
function getCyclePopupMessage(type) {
	if (type === 'visit-node') return 'Besuche Knoten';
	if (type === 'explore-edge') return 'Folge Kante';
	if (type === 'cycle-found') return 'Zyklus gefunden!';
	if (type === 'backtrack') return 'Backtrack';
	if (type === 'start-dfs') return 'Starte DFS';
	return '';
}
