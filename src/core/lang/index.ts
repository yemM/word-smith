// ─────────────────────────────────────────────────────────────────────────────
// Prose analysis — which language a note is in
//
// Three places say, in this order:
//   1. `lang:` (or `ws-lang:`) in the note's frontmatter — "fr", "fr-FR",
//      "French" — read with the other per-note overrides (getOverrides);
//   2. the Language setting, when it names a language;
//   3. Auto: the note's own words.
//
// Auto counts function words — the, and, of against le, les, et, est —
// over the start of the note. It also counts the function words of
// languages the plugin has no pack for, so a note in Spanish or German is
// recognised as such and gets no marks, instead of being read with English
// rules and marked wrong. No dependency, a few thousand characters at most.
//
// ADDING A LANGUAGE is a file beside this one that exports a WsLanguage, and
// its line in WS_LANGUAGES below. Everything else — the setting's list, the
// names `lang:` accepts, Auto — reads from that list. See
// docs/adding-a-language.md.
// ─────────────────────────────────────────────────────────────────────────────

import type { WsLanguage } from './common';
import { LANG_EN } from './en';
import { LANG_FR, frSplitElision } from './fr';

export * from './common';
export * from './en';
export { LANG_FR, frSplitElision };

export const WS_LANGUAGES: readonly WsLanguage[] = [LANG_EN, LANG_FR];

export function wsLanguageByCode(code: string | null | undefined) {
	const c = String(code || '').toLowerCase();
	return WS_LANGUAGES.find((l) => l.code === c) || null;
}

// The Prose setting's list: Auto, then every pack by its own name.
export function wsLanguageOptions(): Record<string, string> {
	const out: Record<string, string> = { auto: 'Auto, per note' };
	for (const l of WS_LANGUAGES) out[l.code] = l.name;
	return out;
}

const list = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// Languages with no pack, by their commonest words, so Auto can tell a note
// is in one of them and leave it unmarked. Only what tells them apart: "de"
// and "la" are Spanish as much as French, so neither is here, and no word
// that is also an English one ("come", "per", "do", "die", "is"), or a short
// English note would lose its marks. A language that gets a pack is read
// from its pack instead, and its line here is skipped.
const OTHER_MARKERS: Record<string, ReadonlySet<string>> = {
	es: list(`el los las y es por para una del como pero sus más fue muy
		también está esto esta ese hay`),
	it: list(`di che è il della gli non sono del alla nel anche più questo
		questa dell' all' nell' un' sull' poi dopo cosa così tutto tutti erano
		aveva suo sua dei degli delle dal dalla nella ci po'`),
	pt: list(`os não uma com para por mais foi são das ao também está isso como
		você ela ele lhe ou já até pela pelo`),
	de: list(`der und das ist nicht ich ein eine zu den mit sie es auf sich dem
		auch wie aber`),
	nl: list(`het een en van dat niet ik op te zijn voor maar ook hij wat als
		bij`),
	ru: list(`и в не на что он я с как а то это она по но его к из у за же
		так было`),
};
// What it takes to give up on English: two words of another pack, a few of a
// language with no pack. "Notes on Le Petit Prince" and a line with a single
// Spanish word in it stay English and keep their marks, as every note did
// before languages; a paragraph of French or Italian has a dozen.
const PACK_MIN = 2;
const OTHER_MIN = 3;

const SAMPLE = 4000;

// Words of any script, so a note in Russian is counted as Russian rather
// than as nothing; the packs' own tokenizers decide what they read.
const DETECT_WORD = /\p{L}[\p{L}\p{M}'\u2019-]*/gu;
// An elided article: "l'homme" counts as "l'", "dell'acqua" as "dell'".
const ELIDED = /^(\p{L}{1,6}')\p{L}/u;

// The note's prose for counting: frontmatter, code and comments out.
function proseSample(text: string) {
	return String(text || '')
		.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '')
		.replace(/```[\s\S]*?(```|$)/g, ' ')
		.replace(/%%[\s\S]*?(%%|$)/g, ' ')
		.replace(/`[^`\n]*`/g, ' ')
		.replace(/\[\[[^\]]*\]\]|\]\([^)]*\)|https?:\/\/\S+/g, ' ')
		.slice(0, SAMPLE);
}

/**
 * The code of the language the text reads as: a pack's code, another
 * language's code when it is one the plugin cannot read, or 'en' when the
 * text has none of the words Auto counts.
 */
export function wsDetectLanguage(text: string) {
	const tables: [string, ReadonlySet<string>][] = WS_LANGUAGES.map((l): [string, ReadonlySet<string>] => [l.code, l.markers]);
	const packs = tables.length;
	for (const code of Object.keys(OTHER_MARKERS)) {
		if (!wsLanguageByCode(code)) tables.push([code, OTHER_MARKERS[code]]);
	}
	const counts: number[] = tables.map(() => 0);
	for (const run of proseSample(text).match(DETECT_WORD) || []) {
		const lw = run.toLowerCase().replace(/\u2019/g, "'");
		// An elided article counts as itself ("l'homme" as "l'"), but only
		// where a table has it: English "it's" stays "it's".
		const elided = ELIDED.exec(lw);
		for (let k = 0; k < tables.length; k++) {
			const set = tables[k][1];
			if (set.has(lw) || (elided && set.has(elided[1]))) counts[k]++;
		}
	}
	// A note with none of these words says nothing either way, and the
	// plugin does what it always did: English. A tie goes to the first
	// counted, the packs before the rest and English first of all.
	let best = 'en', top = 0;
	for (let k = 0; k < tables.length; k++) {
		if (tables[k][0] !== 'en' && counts[k] < (k < packs ? PACK_MIN : OTHER_MIN)) continue;
		if (counts[k] > top) { best = tables[k][0]; top = counts[k]; }
	}
	return best;
}

/**
 * The code a `lang:` property names, as written: "fr", "fr-FR", "French",
 * "français", or a list whose first item does. Null when it names nothing.
 * A language with no pack keeps its code, so its notes go unmarked.
 */
export function wsLanguageCode(value: unknown) {
	const first: unknown = Array.isArray(value) ? value[0] : value;
	if (typeof first !== 'string') return null;
	const v = first.trim().toLowerCase();
	if (!/^[\p{L}_-]+$/u.test(v)) return null;
	const named = WS_LANGUAGES.find((l) => l.names.includes(v));
	return named ? named.code : v.split(/[-_]/)[0];
}

/**
 * The pack a note is read with, or null for a language the plugin has no
 * pack for — then nothing is tagged or checked, rather than checked wrong.
 * `setting` is the note's: its `lang:` when it has one, else the Language
 * setting — 'auto' or a code.
 */
export function wsResolveLanguage(text: string, setting: string | null | undefined): WsLanguage | null {
	if (setting && setting !== 'auto') return wsLanguageByCode(setting);
	return wsLanguageByCode(wsDetectLanguage(text));
}
