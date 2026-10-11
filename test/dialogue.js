'use strict';
// Dialogue opened by a dash, read with the packs that write it: what each line
// marks as speech. Run from source — the engine and the packs as they stand,
// no build needed:
//
//   npm test
//   node test/dialogue.js
//
// The source is bundled in memory with esbuild and loaded with stand-ins for
// `obsidian` and CodeMirror, which preamble.ts imports and nothing here needs.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const is = (what, got, want) => {
	const g = JSON.stringify(got), w = JSON.stringify(want);
	if (g === w) { pass++; return; }
	fail++;
	console.log('  FAIL ' + what + ':\n    got  ' + g + '\n    want ' + w);
};

const built = esbuild.buildSync({
	stdin: { contents: "export * from './src/core/preamble'; export * from './src/core/lang-engine'; export * from './src/core/language';", resolveDir: ROOT, loader: 'ts' },
	bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error',
	external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', '@lezer/*', '@replit/codemirror-vim'],
});
const load = Module._load;
Module._load = function (request) {
	if (request === 'obsidian') return new Proxy({}, { get: (_, k) => (k === 'Platform' ? {} : class {}) });
	if (/^@codemirror\//.test(request)) return new Proxy({}, { get: () => class {} });
	return load.apply(this, arguments);
};
const m = new Module(path.join(ROOT, 'dialogue-test.js'));
m.paths = Module._nodeModulePaths(ROOT);
m._compile(built.outputFiles[0].text, path.join(ROOT, 'dialogue-test.js'));
const P = m.exports;

const marks = (code) => P.wsPackEngine(P.wsParsePack(fs.readFileSync(path.join(ROOT, 'packs', 'ws-lang-' + code + '.md'), 'utf8'))).dialogue;
const speech = (code) => { const k = marks(code); return (line) => P.findDialogue(line, k).map((s) => line.slice(s.from, s.to)); };

// ── French: the incise, and the speech after it ────────────────────────────
{
	const fr = speech('fr');
	const cases = [
		// a reply with no incise is speech to the end
		['— À demain, Johan.', ['— À demain, Johan.']],
		['— Oui, mais la porte est fermée.', ['— Oui, mais la porte est fermée.']],
		['— Bonjour, Monsieur Dupont.', ['— Bonjour, Monsieur Dupont.']],
		// the incise is the narrator's, and the speech picks up after its comma…
		['— Tout est prêt, souffla-t-il, on peut déposer la pomme.', ['— Tout est prêt,', 'on peut déposer la pomme.']],
		["— Tu es sûr ? s'enquit Lucie, il est déjà tard.", ['— Tu es sûr ?', 'il est déjà tard.']],
		['— La course est stable, constata Lucie, les canons sont prêts.', ['— La course est stable,', 'les canons sont prêts.']],
		['— Non, dit-il, pas maintenant.', ['— Non,', 'pas maintenant.']],
		// …or after its sentence
		["— On doit tenter l'expérience, coupa-t-il, vibrant. Ça va marcher.", ["— On doit tenter l'expérience,", 'Ça va marcher.']],
		['— Non, répondit Paul. Je reste ici.', ['— Non,', 'Je reste ici.']],
		// what the narrator goes on with after the comma stays the narrator's
		['— Lui-même, soupira-t-il, essoufflé.', ['— Lui-même,']],
		['— Vingt lits! dit-il, comme se parlant à lui-même.', ['— Vingt lits!']],
		['— Et son enfant ? dit la sœur, osant à peine parler.', ['— Et son enfant ?']],
		["— Ça a marché ! lui sourit-il, plein d'excitation.", ['— Ça a marché !']],
		['— Merci, lui murmura-t-il.', ['— Merci,']],
		["— Elle a dit oui, dit-il, en le regardant.", ['— Elle a dit oui,']],
		['— Je viens, fit-elle, souriante. Attends-moi.', ['— Je viens,', 'Attends-moi.']],
		// one word to its sentence's end is the narrator's, unless it is shouted or asked
		['— Je reste, dit-il, agacé. Va-t\u2019en.', ['— Je reste,', 'Va-t\u2019en.']],
		['— Partir ? répéta-t-il, jamais !', ['— Partir ?', 'jamais !']],
		// a word the pack knows is no participle: "maintenant", "l'enfant"
		['— Partez, dit-il, maintenant que la nuit tombe.', ['— Partez,', 'maintenant que la nuit tombe.']],
		["— Cosette, dit-elle, l'enfant de Fantine.", ['— Cosette,', "l'enfant de Fantine."]],
		// the incise's verbs come from the pack's list, the inverted ones too
		["— Tu ne peux pas comprendre ! s'étrangla-t-il.", ['— Tu ne peux pas comprendre !']],
		['— Bien mieux, sourit-elle, je me sens prête.', ['— Bien mieux,', 'je me sens prête.']],
		// an inversion whose verb is not a verb of saying is the speaker's
		['— Il a tout perdu, paraît-il.', ['— Il a tout perdu, paraît-il.']],
		['— Il est parti, semble-t-il, sans rien dire.', ['— Il est parti, semble-t-il, sans rien dire.']],
		['— Oui, peut-être viendra-t-il demain.', ['— Oui, peut-être viendra-t-il demain.']],
		['— Bon, vient-il ?', ['— Bon, vient-il ?']],
		['— Monsieur, reconnaissez-vous ce tatouage ?', ['— Monsieur, reconnaissez-vous ce tatouage ?']],
		// a subject pronoun opens a clause, not an incise; an object one does not
		['— Ok, on lance la séquence.', ['— Ok, on lance la séquence.']],
		['— Venez, nous dit-il, la soupe est prête.', ['— Venez,', 'la soupe est prête.']],
		['— Asseyez-vous, vous dit-on, et attendez.', ['— Asseyez-vous,', 'et attendez.']],
		// an abbreviation or an initial ends no sentence in the incise
		["— C'est bien, dit M. Madeleine.", ["— C'est bien,"]],
		['— Oui, répondit M. Dupont, il viendra.', ['— Oui,', 'il viendra.']],
		['— Entrez, dit J.-P. Martin, on vous attend.', ['— Entrez,', 'on vous attend.']],
		['— Oui, dit St. Clair, je viens.', ['— Oui,', 'je viens.']],
		['— Bonjour, dit-elle, M. le maire vous attend.', ['— Bonjour,', 'M. le maire vous attend.']],
		// a name is no participle; nor is a number
		['— Oui, dit-il, Constant viendra demain.', ['— Oui,', 'Constant viendra demain.']],
		['— Combien ? demanda-t-il, quarante ou cinquante.', ['— Combien ?', 'quarante ou cinquante.']],
		// a dash after the incise turns the speech, as dashes do
		['— Mais, reprit-il, — il faut partir.', ['— Mais,', 'il faut partir.']],
		['— Viens, dit-il. — Non !', ['— Viens,', 'Non !']],
		['— Bon, dit-il — tu viens. Moi aussi.', ['— Bon,', 'tu viens. Moi aussi.']],
		['— Non, dit-il, comme toujours — tu viens.', ['— Non,', 'tu viens.']],
		// an epigraph's source, in its quote block, is no reply; a reply still is
		['> — Victor Hugo, Les Misérables, 1862', []],
		['> — Victor Hugo, *Les Misérables*', []],
		['> — Merci, Hugo.', ['— Merci, Hugo.']],
		['— Victor Hugo, Les Misérables', ['— Victor Hugo, Les Misérables']],
		// THE LIMITS, kept on purpose: after the tag's sentence, the speech picks up
		// again even when the narrator goes on; and a narration of several words
		// after the comma, with no word the pack lists, reads as speech
		['— Non, dit-elle. Elle haussa les épaules.', ['— Non,', 'Elle haussa les épaules.']],
		["— Allons, dit-il, et il lui prit la main.", ['— Allons,', 'et il lui prit la main.']],
		// …narration with a comma in it runs to its sentence's end, speech and all
		["— Tu sais, souffla-t-il, d'une voix éteinte, que je t'aime ?", ['— Tu sais,']],
		// …and a reply that turns to narration with no tag stays speech to the end
		['— Je ne peux pas. Après une pause, elle reprit.', ['— Je ne peux pas. Après une pause, elle reprit.']],
	];
	for (const [line, want] of cases) is('fr: ' + line, fr(line), want);
}

// ── The other dash languages: as they were ─────────────────────────────────
// The French reading needs the pack's "After speech tag" list; a pack without
// one ends the speech at its tag for good, as before.
{
	is('es: incise between dashes', speech('es')('—Yo sé quién soy —respondió don Quijote—; y sé que puedo ser.'), ['—Yo sé quién soy', 'y sé que puedo ser.']);
	is('it: incise between dashes', speech('it')('— Me lo merito — disse allora fra sè. — Dovevo pensarci prima!'), ['— Me lo merito', 'Dovevo pensarci prima!']);
	is('ro: a tag with no second dash', speech('ro')('– Nu știu, a zis Maria, poate mâine.'), ['– Nu știu,']);
	is('pl: "on powiedział" is a tag', speech('pl')('— Tak, on powiedział, że przyjdzie.'), ['— Tak,']);
	is('sv: a tag with no second dash', speech('sv')('– Nej, svarade hon, jag vill inte.'), ['– Nej,']);
	is('ru: incise between dashes', speech('ru')('— Я не знаю, — сказал он. — Может быть, завтра.'), ['— Я не знаю,', 'Может быть, завтра.']);
	is('es: an epigraph\'s source', speech('es')('> — Miguel de Cervantes'), []);
	is('es: a tag then speech, no resuming', speech('es')('— Bueno, dijo Sancho, vamos allá.'), ['— Bueno,']);
}

console.log(pass + ' passed, ' + fail + ' failed  (dialogue)');
if (fail) process.exit(1);
