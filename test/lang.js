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

console.log(pass + ' passed, ' + fail + ' failed  (language packs)');
if (fail) process.exit(1);
