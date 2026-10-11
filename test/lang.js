'use strict';
// The language packs, run from source, a section for each part of them.
//
//   npm test        (before the smoke test: this one needs no build)
//   node test/lang.js
//
// The source is bundled in memory with esbuild — the same build the plugin
// gets — and loaded with stand-ins for `obsidian` and CodeMirror, as the
// smoke test does: preamble.ts imports both, and nothing here needs either.
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
	stdin: { contents: "export * from './src/core/preamble';", resolveDir: ROOT, loader: 'ts' },
	bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error',
	external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', '@lezer/*', '@replit/codemirror-vim'],
});
const load = Module._load;
Module._load = function (request) {
	if (request === 'obsidian') return new Proxy({}, { get: (_, k) => (k === 'Platform' ? {} : class {}) });
	if (/^@codemirror\//.test(request)) return new Proxy({}, { get: () => class {} });
	return load.apply(this, arguments);
};
const m = new Module(path.join(ROOT, 'lang-test.js'));
m.paths = Module._nodeModulePaths(ROOT);
m._compile(built.outputFiles[0].text, path.join(ROOT, 'lang-test.js'));
const P = m.exports;
const { LANG_EN: EN } = P;

// No lookbehind anywhere in the source: iOS before 16.4 cannot parse it, and
// the whole plugin fails to load. The smoke test asks the release build; this
// asks the source as it stands.
is('no regex lookbehind in the source', /\(\?<[=!]/.test(built.outputFiles[0].text), false);

const tags = (lang, line) => lang.tag(lang.tokenize(line), line).map((t) => t.w + '/' + t.tag).join(' ');
const spans = (line, list) => list.map((s) => line.slice(s.from, s.to));
const run = (lang, line) => lang.tag(lang.tokenize(line), line);

// ── English: the pack is the old functions, unchanged ─────────────────────
// Every English prose function against release 1.8.1's answers on the same
// corpus (see test/en-golden.js).
{
	const { digest, GOLDEN } = require('./en-golden');
	const want = JSON.parse(require('fs').readFileSync(GOLDEN, 'utf8'));
	const got = digest(P);
	for (const k of Object.keys(want.digests)) is('EN as in ' + want.from + ': ' + k, got[k], want.digests[k]);
	// and the pack's own calls, which the editor makes, give what the old
	// exports gave there
	const lines = require('fs').readFileSync(path.join(__dirname, 'fixtures', 'en-corpus.txt'), 'utf8').split('\n').filter((l) => l.trim());
	let phrases = 0, grades = 0;
	for (const line of lines) {
		const old = [...line.matchAll(P.FILLER_PHRASES)].map((x) => [x.index, x.index + x[0].length]);
		if (JSON.stringify(EN.findFillerPhrases(line).map((r) => [r.from, r.to])) !== JSON.stringify(old)) phrases++;
		for (const sent of EN.splitSentences(line)) {
			const st = EN.tokenize(sent.text);
			let syl = 0;
			for (const t of st) syl += EN.countSyllables(t.w);
			if (EN.grade(st.length, 1, syl) !== P.sentenceGrade(st)) grades++;
		}
	}
	is('EN pack: filler phrases as before, on every line', phrases, 0);
	is('EN pack: sentence grades as before, on every sentence', grades, 0);
}
{
	const line = 'The window was broken by the storm, and she had had enough.';
	is('EN tags', tags(EN, line), 'The/DET window/NOUN was/AUX broken/VERB by/PREP the/DET storm/NOUN and/CONJ she/PRON had/AUX had/AUX enough/DET');
	is('EN passive', spans(line, EN.findPassive(run(EN, line))), ['was broken']);
	is('EN "had had" is grammar', EN.findIllusions(run(EN, line)), []);
	const mis = 'I could of done it better then the rest.';
	is('EN misused', spans(mis, EN.findMisused(run(EN, mis))), ['could of', 'better then']);
	is('EN filler phrases', spans('In order to win, kind of.', EN.findFillerPhrases('In order to win, kind of.')), ['In order to', 'kind of']);
	is('EN grade is Flesch-Kincaid', EN.grade(100, 5, 150), P.fkGrade(100, 5, 150));
}

// ── Every pack keeps the contract ──────────────────────────────────────
// What the editor and the Report ask of a language, asked of each pack the
// plugin lists. A new pack is checked here the moment it is listed.
const TAGS = new Set(['DET', 'PRON', 'PREP', 'CONJ', 'AUX', 'MOD', 'ADV', 'ADJ', 'NOUN', 'VERB', 'NUM', 'TO', 'INTJ']);
for (const L of P.WS_LANGUAGES) {
	const k = 'pack ' + L.code + ': ';
	is(k + 'a two-letter code', /^[a-z]{2}$/.test(L.code), true);
	is(k + 'a name, and names for lang:', !!L.name && Array.isArray(L.names) && L.names.every((n) => n === n.toLowerCase()), true);
	is(k + 'found by its code', P.wsLanguageByCode(L.code), L);
	is(k + 'in the setting\'s list', P.wsLanguageOptions()[L.code], L.name);
	is(k + 'markers to be told apart by', L.markers.size >= 15, true);
	for (const fn of ['tokenize', 'tag', 'findFillerPhrases', 'findPassive', 'findMisused', 'findIllusions', 'isVaguePronoun',
		'findRepetitions', 'splitSentences', 'countSyllables', 'grade']) is(k + fn, typeof L[fn], 'function');
	for (const set of ['fillerStrong', 'fillerSoft', 'reportStopwords', 'markers']) is(k + set + ' is a set', L[set] instanceof Set, true);
	const line = [...L.markers].slice(0, 12).join(' ') + '. ' + [...L.fillerStrong].slice(0, 3).join(' ') + '.';
	const toks = L.tag(L.tokenize(line), line);
	is(k + 'tags with the shared tag set', toks.length > 0 && toks.every((t) => TAGS.has(t.tag)), true);
	is(k + 'spans inside the line', [L.findPassive(toks), L.findMisused(toks), L.findIllusions(toks), L.findFillerPhrases(line)]
		.flat().every((r) => r.from >= 0 && r.to <= line.length && r.from < r.to), true);
	is(k + 'a finite grade', Number.isFinite(L.grade(100, 5, 150)), true);
	is(k + 'reads its own markers as itself', P.wsDetectLanguage(line), L.code);
	is(k + 'named by lang:', L.names.every((n) => P.wsLanguageCode(n) === L.code && P.wsResolveLanguage('x', P.wsLanguageCode(n)) === L), true);
}
is('the setting\'s list is Auto and the packs', Object.keys(P.wsLanguageOptions()), ['auto', ...P.WS_LANGUAGES.map((l) => l.code)]);

// ── Which language a note is read in ───────────────────────────────────
// Real prose, out of copyright (Project Gutenberg): Alice, Don Quijote,
// Pinocchio, Dom Casmurro, Die Verwandlung, Max Havelaar.
const PROSE = {
	en: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.',
	es: 'Admirado quedó el canónigo de los concertados disparates que don Quijote había dicho, del modo con que había pintado la aventura del Caballero del Lago, de la impresión que en él habían hecho las pensadas mentiras de los libros que había leído; y, finalmente, le admiraba la necedad de Sancho, que con tanto ahínco deseaba alcanzar el condado que su amo le había prometido.',
	it: "Di lì a poco, si vide uscire dalla scuderia una bella carrozzina color dell'aria, tutta imbottita di penne di canarino e foderata nell'interno di panna montata e di crema coi savoiardi. La carrozzina era tirata da cento pariglie di topini bianchi, e il Can-barbone, seduto a cassetta, schioccava la frusta a destra e a sinistra, come un vetturino quand'ha paura di aver fatto tardi.",
	pt: 'José Dias, composto e grave, não dizia nada a principio; tinhamos falado na vespera, no quarto delle, onde fui ver se era ainda possivel evitar o seminario. Já não era, mas deu-me esperanças e principalmente animou-me muito. Antes de um anno estariamos a bordo. Como eu achasse muito breve, explicou-se.',
	de: 'Die Schwester eilte zur Mutter und hielt ihr die Stirn. Der Vater schien durch die Worte der Schwester auf bestimmtere Gedanken gebracht zu sein, hatte sich aufrecht gesetzt, spielte mit seiner Dienermütze zwischen den Tellern, die noch vom Nachtmahl der Zimmerherren her auf dem Tische standen, und sah bisweilen auf den stillen Gregor hin.',
	nl: "Is 't niet inderdaad bespottelyk, te meenen dat de man die geroepen is recht te spreken, de man aan wien het wel of wee van duizenden is in handen gegeven, zich zou gebonden achten door een paar uitgesproken klanken, wanneer hy niet, ook zonder die klanken, zich daartoe gedrongen voelt door zyn eigen hart?",
};
for (const code of Object.keys(PROSE)) {
	is('detect ' + code, P.wsDetectLanguage(PROSE[code]), code);
	is('read ' + code + (P.wsLanguageByCode(code) ? ' with its pack' : ' with no marks'), (P.wsResolveLanguage(PROSE[code], 'auto') || { code: null }).code, P.wsLanguageByCode(code) ? code : null);
}
is('Russian is told apart too', P.wsDetectLanguage('Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему. Все смешалось в доме Облонских. Жена узнала, что муж был в связи с бывшею в их доме француженкою-гувернанткой, и объявила мужу, что не может жить с ним в одном доме.'), 'ru');
is('nothing to go by is English', P.wsDetectLanguage('Hello.'), 'en');
// A word or two of a language with no pack is no reason to drop English.
for (const line of ['Come back later.', 'Come on, do your best!', 'A table, one row per day:', 'Per the contract, Al ha a plan.',
	'Die Hard rewatch', 'The war is over.', 'Um, so what is it?', 'It is what it is.', 'Do it per the plan, con or no con.',
	"It's late, you're tired, that's all."]) is('short English stays English: ' + line, P.wsDetectLanguage(line), 'en');
is('a short line of Spanish is read as Spanish', P.wsDetectLanguage('Pero el caballero no sabía por qué los molinos estaban allí.'), 'es');
is('the setting wins over Auto', (P.wsResolveLanguage(PROSE.es, 'en') || {}).code, 'en');
is('a setting naming a language with no pack', P.wsResolveLanguage(PROSE.en, 'de'), null);
// What `lang:` says, once Obsidian has read the YAML.
is('lang: en-GB', P.wsLanguageCode('en-GB'), 'en');
is('lang: fr_CA', P.wsLanguageCode('fr_CA'), 'fr');
is('lang: English', P.wsLanguageCode('English'), 'en');
is('lang: [fr, en]', P.wsLanguageCode(['fr', 'en']), 'fr');
is('lang: de', P.wsLanguageCode('de'), 'de');
is('an empty lang: says nothing', [P.wsLanguageCode(''), P.wsLanguageCode(null), P.wsLanguageCode('  '), P.wsLanguageCode([])], [null, null, null, null]);
is('lang: is a name, not a sentence', P.wsLanguageCode('fr # draft'), null);

console.log(pass + ' passed, ' + fail + ' failed  (language packs)');
if (fail) process.exit(1);
