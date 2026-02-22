// Test für die problematische Grammatik
// S -> eps | A | B
// A -> B
// B -> Cdb
// C -> A | bb

const grammar = {
	startSymbol: 'S',
	productions: {
		S: ['eps', 'A', 'B'],
		A: ['B'],
		B: ['Cdb'],
		C: ['A', 'bb']
	}
};

// Simuliere, was nach ε-Elimination passiert
console.log('NACH ε-ELIMINATION:');
const afterEps = {
	S0: ['S', 'eps'],
	S: ['A', 'B'],  // eps wurde entfernt
	A: ['B'],
	B: ['Cdb'],
	C: ['A', 'bb']
};

console.log(JSON.stringify(afterEps, null, 2));

// Unit-Closure für C
console.log('\nUNIT-CLOSURE für C:');
console.log('C -> A (unit)');
console.log('A -> B (unit)');
console.log('Closure(C) = {C, A, B}');

// Was sollte C nach Unit-Elimination haben?
console.log('\nNICHT-UNIT-PRODUKTIONEN von erreichbaren Variablen:');
console.log('Von A: keine (nur B, das ist unit)');
console.log('Von B: Cdb');
console.log('Von C selbst: bb');
console.log('=> C sollte haben: [bb, Cdb]');

// Nach Unit-Elimination
console.log('\nNACH UNIT-ELIMINATION:');
const afterUnit = {
	S0: ['S', 'eps'],
	S: ['Cdb'],     // von A->B->Cdb und B->Cdb
	A: ['Cdb'],     // von B->Cdb
	B: ['Cdb'],
	C: ['bb', 'Cdb']  // bb bleibt, Cdb von B
};
console.log(JSON.stringify(afterUnit, null, 2));

// Erreichbarkeit von S0
console.log('\nEREICHBARKEIT von S0:');
console.log('S0 -> S (S ist erreichbar)');
console.log('S0 -> eps (kein NonTerminal)');
console.log('S -> Cdb, symbols = [C, d, b]');
console.log('  C ist NonTerminal => C ist erreichbar!');
console.log('C -> bb, symbols = [b, b]');
console.log('  keine NonTerminals');
console.log('C -> Cdb, symbols = [C, d, b]');
console.log('  C ist schon bekannt');
console.log('\nErreichbare Variablen: {S0, S, C}');
console.log('Aber A und B sollten auch erreichbar sein!');
