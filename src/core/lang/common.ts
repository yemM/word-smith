// ─────────────────────────────────────────────────────────────────────────────
// Prose analysis — what every language shares
//
// The tokenizer, the sentence splitter, the five highlight buckets, lexical
// illusions and the repetition radar work the same in every language the
// plugin knows; what changes from one to the next is data (which words, which
// endings) and a handful of rules. That part is a LANGUAGE PACK: one module
// per language under ./, each exporting one `WsLanguage`. Adding a language
// is adding a file and a line in ./index.ts — nothing outside this folder
// needs to know.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tokenizer ────────────────────────────────────────────────────────────────

// Numbers are tokens too — "the 747 carried 416 passengers" is a
// five-word sentence, not a three-word one, and the rhythm grade was
// quietly wrong on any prose with figures in it. The separator part
// only continues into another digit, so the full stop after "in 1984."
// stays outside the token and sentence detection still sees it.
//
// LATIN LETTERS, NOT A–Z (A482): an English writer's café, naïve, résumé
// and Zoë were cut at the accent — "caf", "na" + "ve", "r" + "sum" — and
// each piece was tagged and checked as a word of its own. \p{M} keeps a
// decomposed accent (e + U+0301) inside its word. The Latin SCRIPT, not
// every letter: every pack is a Latin-script language, and a run of Chinese
// or Cyrillic read as one unknown word would be coloured as a noun it knows
// nothing about — outside the script is outside the tagger, as before.
export const WORD_RE = /\p{Script=Latin}[\p{Script=Latin}\p{M}'\u2019-]*|\d+(?:[.,:]\d+)*%?/gu;

// One word of a line as the checks see it: the text, lowered, its span, the
// tag the tagger gives it, and whether it opens a sentence.
export interface WsToken { w: string; lw: string; from: number; to: number; tag: string | null; first?: boolean }
export interface WsSpan { from: number; to: number }

export function tokenizeLine(text: string) {
	const out: WsToken[] = [];
	WORD_RE.lastIndex = 0;
	let m;
	while ((m = WORD_RE.exec(text))) {
		// Trailing hyphens/apostrophes belong to the markup, not the word.
		let w = m[0].replace(/[-'\u2019]+$/, '');
		if (!w) continue;
		out.push({ w, lw: w.toLowerCase().replace(/\u2019/g, "'"), from: m.index, to: m.index + w.length, tag: null });
	}
	return out;
}

export const SENT_END = /[.!?\u2026]$/;

// Collapse the internal tag set to the five highlight buckets. Every pack
// tags with the same set (DET PRON PREP CONJ AUX MOD ADV ADJ NOUN VERB NUM
// TO INTJ), so the colours mean the same thing in every language.
export function posBucket(tag: string) {
	switch (tag) {
		case 'NOUN': case 'PRON': return 'noun';
		case 'VERB': case 'AUX': case 'MOD': return 'verb';
		case 'ADJ':  return 'adj';
		case 'ADV':  return 'adv';
		case 'CONJ': case 'PREP': return 'conj';
		default: return null;
	}
}

// ── Lexical illusions ────────────────────────────────────────────────────────

// The same word twice in a row. The eye skips them, which is exactly why they
// survive proofreading. `grammatical` is the pack's list of words a sentence
// may double on purpose ("she had had enough", "nous nous sommes vus").
export function findIllusionsWith(tokens: WsToken[], grammatical: ReadonlySet<string>) {
	const hits: WsSpan[] = [];
	for (let i = 1; i < tokens.length; i++) {
		if (tokens[i].lw !== tokens[i - 1].lw) continue;
		if (tokens[i].lw.length < 2) continue;               // "s s" in odd markup
		if (grammatical.has(tokens[i].lw)) continue;
		hits.push({ from: tokens[i - 1].from, to: tokens[i].to });
	}
	return hits;
}

// ── Sentences ────────────────────────────────────────────────────────────────

// Sentence ranges within one line. Markdown paragraphs are normally a single
// soft-wrapped line, so a sentence very rarely crosses a hard break; treating
// the line as the outer bound keeps this cheap and viewport-local.
export const SENTENCE_SPLIT = /[^.!?\u2026]+[.!?\u2026]*\s*/g;

// `abbreviations` is the pack's list of dotted words that do not end a
// sentence ("Dr.", "M.", "etc.").
export function splitSentencesWith(text: string, abbreviations: ReadonlySet<string>) {
	const out = [];
	SENTENCE_SPLIT.lastIndex = 0;
	let m;
	while ((m = SENTENCE_SPLIT.exec(text))) {
		if (!m[0].trim()) continue;
		// Trim the trailing whitespace back off so the tint stops at the
		// full stop rather than running into the next sentence.
		const raw  = m[0];
		const from = m.index;
		const to   = from + raw.replace(/\s+$/, '').length;
		if (to <= from) continue;
		// Merge with the previous segment when the split was a false one:
		// the previous "sentence" ended in an abbreviation, an initial or a
		// decimal ("Dr.", "J.", "3."), or this one opens in lowercase — a
		// capital letter is what an actual sentence start looks like.
		// Splitting at "Dr. Smith" halves the sentence and halves the
		// rhythm grade with it.
		const prev = out.length ? out[out.length - 1] : null;
		if (prev) {
			const tail = text.slice(prev.from, prev.to);
			const am   = /(\p{L}+)\.$/u.exec(tail);
			const falseEnd = (am && (am[1].length === 1 || abbreviations.has(am[1].toLowerCase()))) ||
				/\d\.$/.test(tail) || /^[\p{Ll}0-9]/u.test(raw.trim());
			if (falseEnd) {
				prev.to   = to;
				prev.text = text.slice(prev.from, to).trim();
				continue;
			}
		}
		out.push({ from, to, text: raw.trim() });
	}
	return out;
}

// ── Repetition radar ─────────────────────────────────────────────────────────

// How a pack reads a word for the radar: `normalize` keeps the letters that
// count (English drops everything outside a–z; French keeps its accents),
// `stem` folds the endings that make two forms one word ("writing" and
// "writes"), and the stopwords are the words too common to notice.
export interface WsRepetitionRules {
	stopwords: ReadonlySet<string>;
	normalize(lw: string): string;
	stem(w: string): string;
}

export function findRepetitionsWith(tokens: WsToken[], windowSize: number, minLength: number, rules: WsRepetitionRules) {
	const hits: WsSpan[] = [];
	const lastSeen = new Map<string, { i: number; from: number; to: number; flagged: boolean }>();
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		const w = rules.normalize(t.lw);
		if (w.length < minLength || rules.stopwords.has(w)) continue;
		const stem = rules.stem(w);
		const key  = stem.length >= 4 ? stem : w;
		const prev = lastSeen.get(key);
		if (prev !== undefined && i - prev.i <= windowSize) {
			// The previous occurrence is only pushed the first time it
			// echoes — a word appearing three times in the window used to
			// emit the middle occurrence twice.
			if (!prev.flagged) hits.push({ from: prev.from, to: prev.to });
			hits.push({ from: t.from, to: t.to });
			lastSeen.set(key, { i, from: t.from, to: t.to, flagged: true });
		} else {
			lastSeen.set(key, { i, from: t.from, to: t.to, flagged: false });
		}
	}
	return hits;
}

// ── The language pack ────────────────────────────────────────────────────────

// Everything the editor and the Report ask of a language. The checks read
// their word lists and rules from here and nowhere else, so a note in French
// is never measured against English, and the other way round.
export interface WsLanguage {
	/** ISO 639-1, what `lang:` in a note's frontmatter names. */
	code: string;
	/** In its own language, for the settings' list. */
	name: string;

	/** Words of the line, with any pack-specific splitting (French elisions). */
	tokenize(text: string): WsToken[];
	/** Tags the tokens in place and returns them. */
	tag(tokens: WsToken[], text: string): WsToken[];

	fillerStrong: ReadonlySet<string>;
	fillerSoft: ReadonlySet<string>;
	/** Runs of words that are filler as a whole ("kind of", "en quelque sorte"). */
	findFillerPhrases(text: string): WsSpan[];
	findPassive(tokens: WsToken[]): WsSpan[];
	findMisused(tokens: WsToken[]): WsSpan[];
	findIllusions(tokens: WsToken[]): WsSpan[];
	isVaguePronoun(t: WsToken, next: WsToken | null | undefined): boolean;
	findRepetitions(tokens: WsToken[], windowSize: number, minLength: number): WsSpan[];

	/** Function words the Report's "Most used words" sets aside. */
	reportStopwords: ReadonlySet<string>;
	/** A word as the Report counts it, split where the pack splits words ("l'homme"). */
	splitWord?(w: string): string[];
	splitSentences(text: string): { from: number; to: number; text: string }[];
	countSyllables(word: string): number;
	/**
	 * Readability on the US-grade scale the rhythm thresholds are set in, so
	 * "hard above grade 10" means the same thing whatever the language.
	 */
	grade(words: number, sentences: number, syllables: number): number;
}
