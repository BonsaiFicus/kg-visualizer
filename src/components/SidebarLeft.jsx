import { useState } from 'react';
import '../styles/sidebars.css';
import parseGrammar from '../algorithm/parseGrammar.js';
import { stepManager } from '../algorithm/steps.js';
import generateIsProductiveSteps from '../algorithm/visualization/step_1_searchProductive.js';
import generateCNFBuildSteps from "../algorithm/visualization/step_2_buildBaseCNF.js";
import generateRemoveEpsilonSteps from "../algorithm/visualization/step_3_removeEpsAndUnit.js";
import generateIsolateLongSteps from "../algorithm/visualization/step_4_isolateLongProductions.js";
import generateBinaryKaskadierungSteps from "../algorithm/visualization/step_5_binaereAufspaltung.js";

/**
 * Eingabe-Seitenleiste fuer CFG-Definitionen und Analyse-Start.
 */
export default function SidebarLeft({ open, toggleSidebarLeft, onGrammarChange, onAnalyzeFlag }) {
	const [input, setInput] = useState('');
	const [rows, setRows] = useState(8);
	const maxRows = 18;

	/**
	 * Parsen der CFG-Eingabe und Live-Update der Struktur.
	 */
	const handleChange = (e) => {
		const newInput = e.target.value;
		setInput(newInput);
		const lineCount = newInput.split('\n').length;
		setRows(() => Math.min(maxRows, Math.max(8, lineCount)));

		const parsed = parseGrammar(newInput);
		if (onGrammarChange) {
			onGrammarChange(parsed, { source: 'input' });
		}
	};

	/**
	 * Startet die Analyse-Pipeline fuer die CFG.
	 */
	const runAnalyze = (flagValue, _skipAnim = false) => {
		if (onAnalyzeFlag) onAnalyzeFlag(flagValue);
		const parsed = parseGrammar(input);
		console.log('SidebarLeft: parsed grammar', parsed);
		if (onGrammarChange) {
			onGrammarChange(parsed, { source: 'analyze' });
		}
	};

	/**
	 * Fuehrt die CFG-Schritte interaktiv durch.
	 */
	const handleAnalyze = () => {
		runAnalyze(true, false);
		const parsed = parseGrammar(input);
		const allSteps = buildAllSteps(parsed);
		stepManager.initializeSteps(allSteps);
		stepManager.reset();
	};

	/**
	 * Springt zum Endergebnis der CFG-Transformation.
	 */
	const handleResult = () => {
		runAnalyze(true, false);
		const parsed = parseGrammar(input);
		const allSteps = buildAllSteps(parsed);
		stepManager.initializeSteps(allSteps);
		stepManager.skipToEnd();
	};

	/**
	 * Laedt ein Beispiel fuer eine CFG.
	 */
	const loadExample = () => {
		const example = `S -> A | B | CD
A -> B | A | bCb
B -> S | c
C -> cC | §
D -> dD | §`;
		setInput(example);
		const lineCount = example.split('\n').length;
		setRows(Math.min(maxRows, Math.max(8, lineCount)));
		const parsed = parseGrammar(example);
		if (onGrammarChange) {
			onGrammarChange(parsed, { source: 'example' });
		}
	};

	return (
		<div className={`sidebar sidebar-left ${open ? 'open' : 'closed'}`}>
			<button className={`sidebar-toggle ${open ? 'toggle-open' : 'toggle-closed'}`} onClick={toggleSidebarLeft}>
				{open ? '<' : '>'}
			</button>

			<div className="sidebar-inner">
				<h2>Grammar Input</h2>
				<textarea
					placeholder="Enter your CFG here"
					value={input}
					onChange={handleChange}
					rows={rows}
					style={{ overflowY: 'auto', maxHeight: '320px' }}
				></textarea>
				<div className="sidebar-buttons">
					<div className="sidebar-actions" style={{ marginTop: '8px' }}>
						<button id='analyze-btn-2' className='btn btn-primary full-width' onClick={handleAnalyze}>Analysieren</button>
						<div className="actions-row two-col">
							<button id='result-btn' className='btn btn-primary' onClick={handleResult}>Ergebnis</button>
							<button id='load-example-btn' className='btn btn-secondary' onClick={loadExample}>Beispiel laden</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Kombiniert alle CFG-Transformationsschritte in Reihenfolge.
 */
function buildAllSteps(parsed) {
	const productiveSteps = generateIsProductiveSteps(parsed);
	const productiveVars = getLastProductiveVars(productiveSteps);

	const cnfSteps = generateCNFBuildSteps(parsed, productiveVars);
	const baseCNF = getLastCnfGraph(cnfSteps, {});

	const epsSteps = generateRemoveEpsilonSteps(parsed, baseCNF);
	const cnfAfterUnit = getLastCnfGraph(epsSteps, baseCNF);
	
	// parsed.startSymbol wird in generateRemoveEpsilonSteps aktualisiert, wenn eps in der Sprache ist
	// Übergebe die aktualisierte parsed Grammatik zu den folgenden Schritten
	const longSteps = generateIsolateLongSteps(parsed, cnfAfterUnit);
	const cnfAfterLong = getLastCnfGraph(longSteps, cnfAfterUnit);

	const binaryKaskadierungSteps = generateBinaryKaskadierungSteps(parsed, cnfAfterLong);

	return [...productiveSteps, ...cnfSteps, ...epsSteps, ...longSteps, ...binaryKaskadierungSteps];
}

/**
 * Extrahiert die Produktivitaetsmenge V' aus dem letzten CFG-Step.
 */
function getLastProductiveVars(steps) {
	const lastStep = steps[steps.length - 1];
	return lastStep?.state?.productiveVars || new Set();
}

/**
 * Nimmt den letzten CNF-Graphen als Basis fuer Folgeschritte.
 */
function getLastCnfGraph(steps, fallback) {
	const lastStep = steps[steps.length - 1];
	return lastStep?.cnfGraph || fallback;
}