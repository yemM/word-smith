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
const { LANG_EN: EN, LANG_FR: FR } = P;

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

// ── French: the tagger ──────────────────────────────────────────────────
is('FR elisions split', FR.tokenize("L'homme qu'il aimait jusqu'à l'aube").map((t) => t.w),
	["L'", 'homme', "qu'", 'il', 'aimait', "jusqu'", 'à', "l'", 'aube']);
is('FR aujourd\'hui stays whole', FR.tokenize("aujourd'hui").map((t) => t.w), ["aujourd'hui"]);
is('FR -ment adverbs, imperfect', tags(FR, 'Il regardait lentement la mer.'),
	'Il/PRON regardait/VERB lentement/ADV la/DET mer/NOUN');
is('FR object pronoun after a subject', tags(FR, 'Je la vois chaque matin.'),
	'Je/PRON la/PRON vois/VERB chaque/DET matin/NOUN');
is('FR object pronoun after a name', tags(FR, "Johan l'observait."), "Johan/NOUN l'/PRON observait/VERB");
is('FR adjective after its noun', tags(FR, 'La maison rouge.'), 'La/DET maison/NOUN rouge/ADJ');
is('FR verb after its noun, before que', tags(FR, 'Ce chapitre montre que'),
	'Ce/DET chapitre/NOUN montre/VERB que/CONJ');
is('FR passé simple, reflexive', tags(FR, 'Elle se dirigea vers la porte.'),
	'Elle/PRON se/PRON dirigea/VERB vers/PREP la/DET porte/NOUN');
is('FR gerund and present participle', tags(FR, 'En marchant, savourant le soir.'),
	'En/PREP marchant/VERB savourant/VERB le/DET soir/NOUN');
is('FR auxiliary and participle', tags(FR, 'Le livre a été écrit.'),
	'Le/DET livre/NOUN a/AUX été/AUX écrit/VERB');

// ── French: the checks ──────────────────────────────────────────────────
{
	const p = (line) => spans(line, FR.findPassive(run(FR, line)));
	is('FR passive', p('La porte fut ouverte par le gardien.'), ['fut ouverte']);
	is('FR passive through avoir été', p('Le livre a été écrit par un inconnu.'), ['a été écrit']);
	is('FR être verbs are not passive', p('Il est parti tôt ; elle est arrivée tard.'), []);
	is('FR reflexives are not passive', p("Elle s'est levée, nous nous sommes vus."), []);
	is('FR states without an agent are not passive', p('Il était très fatigué.'), []);
	is('FR an adjective is no participle', p('Tout est flou.'), []);

	const mis = (line) => spans(line, FR.findMisused(run(FR, line)));
	is('FR a / à', mis('Il à mangé a la cantine.'), ['à', 'a']);
	is('FR ou / où', mis("D'ou vient-il ? Le jour ou il pleuvait."), ['ou', 'ou']);
	is('FR "un jour ou l\'autre" is right', mis("Un jour ou l'autre, il comprendra."), []);
	is('FR leur / leurs', mis('Ils parlent de leur enfants.'), ['leur enfants']);
	is('FR "leur fils" is singular', mis('Ils parlent de leur fils.'), []);
	is('FR si + conditional', mis("Si j'aurais su, je serais venu."), ["Si j'aurais"]);
	is('FR "si" in an indirect question is right', mis('Je me demande si elle viendrait.'), []);
	is('FR sa / ça', mis('Sa va bien.'), ['Sa']);
	is('FR se rappeler de', mis('Il ne peut se rappeler du voyage.'), ['rappeler du']);
	is('FR "de se lever" is right', mis('Il tenta de se lever.'), []);
	for (const line of ['Il était là, homme parmi les hommes.', "C'est ça, homme de peu de foi.", 'Quels sont tes projets ?',
		'Quelles sont les raisons ?', 'Les enfants en ont assez.', 'Mes amis y ont cru.']) is('FR right as it is: ' + line, mis(line), []);
	is('FR son / sont, leur / leurs after a subject', mis('Ils son partis. Je leurs dis.'), ['son', 'leurs']);
	is('FR "qui son" before a noun is right', mis("L'homme à qui son frère écrit."), []);
	is('FR "sauf" is a preposition', tags(FR, 'Tous sauf toi.'), 'Tous/DET sauf/PREP toi/PRON');
	is("FR presqu'île is one word", FR.tokenize("La presqu'île.").map((t) => t.w), ['La', "presqu'île"]);

	const ill = (line) => spans(line, FR.findIllusions(run(FR, line)));
	is('FR doubled word', ill('Ce chapitre montre que le le problème persiste.'), ['le le']);
	is('FR "nous nous" is grammar', ill('Nous nous sommes vus.'), []);
	is('FR a stammer is a voice', ill('Je… je suis désolé. Oui, oui.'), []);

	const fill = 'En fait, il faut dire que le fait que tout soit un peu flou gêne vraiment.';
	is('FR filler phrases', spans(fill, FR.findFillerPhrases(fill)), ['En fait', 'il faut dire que', 'le fait que', 'un peu']);
	is('FR filler phrases need a word edge', FR.findFillerPhrases('un peuplier'), []);
	is('FR filler words', run(FR, fill).filter((t) => FR.fillerStrong.has(t.lw)).map((t) => t.w), ['vraiment']);

	const vague = (line) => { const t = run(FR, line); return t.filter((x, i) => FR.isVaguePronoun(x, t[i + 1])).map((x) => x.w); };
	is('FR loose pronouns', vague('Cela ne change rien. Ce chapitre est court. Ils partent.'), ['Cela', 'Ils']);
}

// ── French: readability and the Report ─────────────────────────────────
is('FR syllables', ['chat', 'maison', 'heureuse', 'idée', 'réaliser', 'naïf', 'lentement'].map(FR.countSyllables), [1, 2, 2, 2, 4, 2, 3]);
is('FR grade rises with long words', FR.grade(20, 1, 40) > FR.grade(20, 1, 24), true);
is('FR grade rises with long sentences', FR.grade(40, 1, 60) > FR.grade(10, 1, 15), true);
is('FR words for the Report', FR.splitWord("l'homme"), ["l'", 'homme']);
is('FR common words set aside', ['le', "l'", 'est', 'homme'].map((w) => FR.reportStopwords.has(w)), [true, true, true, false]);

// ── French: which notes are French ─────────────────────────────────────
// Les Misérables, out of copyright (Project Gutenberg).
const HUGO = "Mgr Bienvenu était pauvre; sa sœur, mademoiselle Baptistine, était douce et sa servante, madame Magloire, le craignait un peu. Il avait l'habitude de marcher seul dans la campagne, et l'on disait de lui qu'il n'avait pas d'argent parce qu'il donnait tout.";
is('detect fr', P.wsDetectLanguage(HUGO), 'fr');
is('read fr with its pack', (P.wsResolveLanguage(HUGO, 'auto') || {}).code, 'fr');
is('a short French line', P.wsDetectLanguage('Je ne sais pas.'), 'fr');
is('a French title in an English note', P.wsDetectLanguage('Notes on Le Petit Prince'), 'en');
is('the limit: a French line with one marker reads as English', P.wsDetectLanguage('Il pleut.'), 'en');
is('the setting wins over Auto, in French too', (P.wsResolveLanguage(HUGO, 'en') || {}).code, 'en');
is('lang: fr-FR', P.wsLanguageCode('fr-FR'), 'fr');
is('lang: French', P.wsLanguageCode('French'), 'fr');
is('lang: Française', P.wsLanguageCode('Française'), 'fr');

// ── Dialogue opened by a dash ──────────────────────────────────────────
const dlg = (line, lang) => P.findDialogue(line, lang).map((s) => line.slice(s.from, s.to));
// French incises, the French pack's own reading
is('dash dialogue: the whole reply', dlg('— À demain Johan.', FR), ['— À demain Johan.']);
is('dash dialogue: en dash too, and in a quote block', dlg('> – Tu viens ?', FR), ['– Tu viens ?']);
is('FR incise ending the line', dlg('— Tu ne viens pas ? demanda-t-elle, déconcertée.', FR), ['— Tu ne viens pas ?']);
is('FR incise with a name', dlg("— Tu es sûr ? s'enquit Lucie, il est déjà tard.", FR), ['— Tu es sûr ?', 'il est déjà tard.']);
is('FR speech goes on after the comma', dlg('— La course est stable, constata Lucie, les canons sont prêts.', FR), ['— La course est stable,', 'les canons sont prêts.']);
is('FR speech goes on after the full stop', dlg("— On doit tenter l'expérience, coupa-t-il, vibrant. Ça va marcher.", FR), ["— On doit tenter l'expérience,", 'Ça va marcher.']);
is('FR a word after the comma is the narrator\'s', dlg('— Lui-même, soupira-t-il, essoufflé.', FR), ['— Lui-même,']);
is('FR a participle after the comma is the narrator\'s', dlg('— Et son enfant ? dit la sœur, osant à peine parler.', FR), ['— Et son enfant ?']);
is('FR "comme…" after the comma is the narrator\'s', dlg('— Vingt lits! dit-il, comme se parlant à lui-même.', FR), ['— Vingt lits!']);
is('FR an auxiliary is no incise', dlg('— Si un père de famille, a ses fils au loin, que fait-il ?', FR), ['— Si un père de famille, a ses fils au loin, que fait-il ?']);
is('FR "mais" is no incise', dlg('— Oui, mais la porte est fermée.', FR), ['— Oui, mais la porte est fermée.']);
is('FR an inverted question is no incise', dlg('— Bon, vient-il ?', FR), ['— Bon, vient-il ?']);
is('FR "reconnaissez-vous" is the speaker asking', dlg('— Monsieur, reconnaissez-vous ce tatouage ?', FR), ['— Monsieur, reconnaissez-vous ce tatouage ?']);
// Incises between dashes, the reading of a language with no pack (null)
is('ES incise between dashes', dlg('— Yo sé quién soy —respondió don Quijote—; y sé que puedo ser no sólo los que he dicho.', null),
	['— Yo sé quién soy', 'y sé que puedo ser no sólo los que he dicho.']);
is('ES incise left open', dlg('— Como haya muchas truchuelas —respondió don Quijote.', null), ['— Como haya muchas truchuelas']);
is('IT incise between spaced dashes', dlg('— Me lo merito — disse allora fra sè. — Dovevo pensarci prima!', null), ['— Me lo merito', 'Dovevo pensarci prima!']);
is('a dash line with no incise', dlg('— Que é que você tem?', null), ['— Que é que você tem?']);
is('a rule is not a reply', dlg('---', null), []);
// English sets dialogue in quotes: a dash opens an attribution or a list,
// with the pack and without one, as before languages.
for (const line of ['— Ernest Hemingway', '> — Robert Frost', '—and then she was gone.', '– first item']) {
	is('EN a dash is no reply: ' + line, [dlg(line), dlg(line, EN)], [[], []]);
}
// An epigraph's source is no reply, in any language.
is('an epigraph\'s source is no reply', [dlg('> — Victor Hugo, Les Misérables, 1862', FR), dlg('> — J. R. R. Tolkien', FR), dlg('> — Miguel de Cervantes', null)], [[], [], []]);
for (const line of ['— Merci, Hugo.', '— Oui, Paul.', '— Non, Jean.', '— Bonjour, Monsieur Dupont.', '— Pardon, Madame.', "— D'accord, Marc.",
	'— À Paris.', '— Demain, Paris.', '— Salut Max', '— Tu es là', '— Oui', '> — Merci, Hugo.']) {
	is('a reply, not an attribution: ' + line, dlg(line, FR), [line.replace(/^> /, '')]);
}
// The limit of that rule: in a quote block, a reply without its stop reads as a source.
is('a quoted reply without its stop', dlg('> — Oui, Paul', FR), []);
is('quotes still work', dlg('Il dit « bonjour » puis partit.', FR), ['« bonjour »']);
is('English quotes', dlg('He said \u201cNot now\u201d and left.'), ['\u201cNot now\u201d']);
is('German quotes too', dlg('Er sagte: \u201eKomm her\u201c und ging.', null), ['\u201eKomm her\u201c']);

// ── French spacing ─────────────────────────────────────────────────────
const sp = (before, ch) => { const r = P.wsFrenchSpacing(before, ch); return r ? [r.matched, r.glyph] : null; };
is('FR spacing: after a word', sp('Vraiment', '?'), ['?', '\u202f?']);
is('FR spacing: a typed space folds in', sp('Vraiment ', '!'), [' !', '\u202f!']);
is('FR spacing: colon', sp('Il dit', ':'), [':', '\u00a0:']);
is('FR spacing: closing guillemet', sp('« Oui', '»'), ['»', '\u00a0»']);
is('FR spacing: inside an opening guillemet', sp('Il dit «', ' '), [' ', '\u00a0']);
is('FR spacing: "?!" takes one space', sp('Quoi\u202f?', '!'), null);
is('FR spacing: a time', sp('À 12', ':'), null);
is('FR spacing: a link', sp('voir https', ':'), null);
is('FR spacing: an address', sp('voir https://exemple.fr/page', '?'), null);
is('FR spacing: a footnote', sp('[^1]', ':'), null);
is('FR spacing: line start (an embed)', sp('', '!'), null);
is('FR spacing: inside a wikilink', sp('voir [[Note', ':'), null);
is('FR spacing: a space after « has one already', sp('Il dit \u00ab\u00a0', ' '), ['\u00a0 ', '\u00a0']);
is('FR spacing: a Dataview field', sp('statut\u00a0:', ':'), ['\u00a0::', '::']);

console.log(pass + ' passed, ' + fail + ' failed  (language packs)');
if (fail) process.exit(1);
