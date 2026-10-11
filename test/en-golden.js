'use strict';
// English, unchanged by the language packs: what every English prose function
// says about test/fixtures/en-corpus.txt (Alice's first chapter, lines picked
// to trip the checks, and lines opening with a dash), as one digest per
// function. test/lang.js compares the source's digests with
// test/fixtures/en-golden.json, which holds release 1.8.1's.
//
//   node test/en-golden.js 4570801     rewrite the fixture from that commit
//
// Rewriting needs git and the commit; checking needs neither.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const CORPUS = path.join(__dirname, 'fixtures', 'en-corpus.txt');
const GOLDEN = path.join(__dirname, 'fixtures', 'en-golden.json');

// The preamble under `dir`, bundled in memory and loaded with stand-ins for
// `obsidian` and CodeMirror, which it imports and nothing here needs.
function loadPreamble(dir) {
	const built = esbuild.buildSync({
		stdin: { contents: "export * from './src/core/preamble';", resolveDir: dir, loader: 'ts' },
		bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'error', nodePaths: [path.join(ROOT, 'node_modules')],
		external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', '@lezer/*', '@replit/codemirror-vim'],
	});
	const load = Module._load;
	Module._load = function (request) {
		if (request === 'obsidian') return new Proxy({}, { get: (_, k) => (k === 'Platform' ? {} : class {}) });
		if (/^@codemirror\//.test(request)) return new Proxy({}, { get: () => class {} });
		return load.apply(this, arguments);
	};
	try {
		const m = new Module(path.join(dir, 'golden.js'));
		m.paths = Module._nodeModulePaths(ROOT);
		m._compile(built.outputFiles[0].text, path.join(dir, 'golden.js'));
		return m.exports;
	} finally {
		Module._load = load;
	}
}

// Through the exports 1.8.1 had, so the same code reads both versions.
function digest(P) {
	const lines = fs.readFileSync(CORPUS, 'utf8').split('\n').filter((l) => l.trim());
	const out = { tags: [], passive: [], illusions: [], misused: [], vague: [], filler: [], phrases: [], sentences: [],
		syllables: [], dialogue: [], repetition: [], stopwords: [...P.REPORT_STOPWORDS].sort() };
	const seen = [];
	let off = 0;
	for (const line of lines) {
		const toks = P.tagTokens(P.tokenizeLine(line), line);
		out.tags.push(toks.map((t) => t.w + '/' + t.tag + (t.first ? '^' : '')).join(' '));
		out.passive.push(P.findPassive(toks));
		out.illusions.push(P.findIllusions(toks));
		out.misused.push(P.findMisused(toks));
		out.vague.push(toks.map((t, i) => (P.isVaguePronoun(t, toks[i + 1] || null) ? i : -1)).filter((i) => i >= 0));
		out.filler.push(toks.filter((t) => P.FILLER_STRONG.has(t.lw) || P.FILLER_SOFT.has(t.lw)).map((t) => t.from));
		out.phrases.push([...line.matchAll(P.FILLER_PHRASES)].map((m) => m.index));
		out.sentences.push(P.splitSentences(line).map((s) => [s.from, s.to, +P.sentenceGrade(P.tokenizeLine(s.text)).toFixed(6)]));
		out.syllables.push(toks.map((t) => P.countSyllables(t.w)).join(','));
		out.dialogue.push(P.findDialogue(line));
		for (const t of toks) seen.push({ lw: t.lw, w: t.w, from: off + t.from, to: off + t.to, tag: null });
		off += line.length + 1;
	}
	out.repetition = P.findRepetitions(seen, 50, 5);
	out.grade = [P.fkGrade(1000, 50, 1400), P.fkGrade(12, 1, 15)];
	const hashes = {};
	for (const k of Object.keys(out)) hashes[k] = crypto.createHash('sha256').update(JSON.stringify(out[k])).digest('hex').slice(0, 16);
	return hashes;
}

module.exports = { digest, GOLDEN };

if (require.main === module) {
	const ref = process.argv[2];
	if (!ref) { console.log('usage: node test/en-golden.js <commit>'); process.exit(1); }
	const { execFileSync } = require('child_process');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-golden-'));
	const tar = execFileSync('git', ['archive', '--format=tar', ref, 'src'], { cwd: ROOT, maxBuffer: 1 << 28 });
	execFileSync('tar', ['-x', '-C', dir], { input: tar });
	const hashes = digest(loadPreamble(dir));
	fs.writeFileSync(GOLDEN, JSON.stringify({ from: ref, digests: hashes }, null, '\t') + '\n');
	fs.rmSync(dir, { recursive: true, force: true });
	console.log('wrote ' + path.relative(ROOT, GOLDEN) + ' from ' + ref);
}
