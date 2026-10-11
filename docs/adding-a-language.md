# Adding a language

[← Back to Syntax and prose](syntax-and-prose.md)

The word classes, the prose checks and the Report's reading measures all read a note through a *language pack*. English and French ship with the plugin. Adding a language takes one file and one line, and no code outside `src/core/lang/` needs to change.

## The two steps

1. **Write the pack.** Copy `src/core/lang/fr.ts` to `src/core/lang/xx.ts`, where `xx` is the language's ISO 639-1 code. Export one `WsLanguage` object (the interface is in `src/core/lang/common.ts`).
2. **List it.** In `src/core/lang/index.ts`, import it and add it to `WS_LANGUAGES`.

That is all the plugin needs. From that list it builds the Language setting's menu, the names `lang:` accepts in a note's properties, Auto detection, and the Report's common words. If the language was listed in `OTHER_MARKERS` (the languages Auto recognises but has no pack for), Auto now reads it from your pack and ignores that line.

## What a pack holds

Most of a pack is word lists. The rest is a few rules.

| Field | What it is |
|---|---|
| `code`, `name`, `names` | `es`, `Español`, and what `lang:` may say besides the code (`spanish`, `español`), in lowercase. |
| `markers` | About 20 to 40 short, frequent words that belong to your language more than to its neighbours. Auto counts these. Leave out words you share: `de` and `la` are Spanish as much as French, and `come`, `per` or `die` are English too. An elided article counts with its apostrophe (`l'`, `dell'`). |
| `tokenize` | Usually `tokenizeLine` from `common.ts`. Split words further where your language joins them: French splits `l'homme` into `l'` and `homme`. A non-Latin script needs its own word pattern here, because `tokenizeLine` only reads the Latin script. |
| `tag` | Gives each token one tag from the shared set: `DET PRON PREP CONJ AUX MOD ADV ADJ NOUN VERB NUM TO INTJ`. The colours depend on this set, so don't invent tags. The usual shape is three passes: a lexicon of function words and common irregular words, then endings (`-mente` is an adverb, `-ción` a noun), then context (after an article, a verb form is a noun). |
| `fillerStrong`, `fillerSoft`, `findFillerPhrases` | Intensifiers and hedges (*muy*, *realmente*), vaguer quantifiers behind the stricter switch, and multi-word fillers (*en realidad*). Match phrases on letters, not `\b`, which is ASCII-only in JavaScript. |
| `findPassive` | The passive construction and the false passives to leave alone. In French, verbs conjugated with *être* and reflexives look passive and aren't. |
| `findMisused` | Commonly confused pairs, each with a context rule, so the correct uses stay clear. A bare word list flags every correct use too. |
| `findIllusions` | `findIllusionsWith(tokens, words)`, with the words your grammar doubles on purpose (*nous nous*). |
| `isVaguePronoun` | Pronouns that open a sentence and point back at the previous one. |
| `findRepetitions` | `findRepetitionsWith` with your stopwords, a `normalize` that keeps your letters, and a light stemmer. |
| `reportStopwords`, `splitWord` | The function words the Report's "Most used words" sets aside, and how it splits a word (optional). |
| `splitSentences` | `splitSentencesWith(text, abbreviations)`, with the dotted words that don't end a sentence (*Sr.*, *Dra.*). |
| `countSyllables`, `grade` | A syllable count and a readability formula. Return the result on the US grade scale, so the rhythm thresholds mean the same thing in every language. `fr.ts` converts a Flesch-style reading-ease score to grades; the same conversion works for Fernández Huerta (Spanish), Amstad (German) and Douma (Dutch). |
## Testing it

`npm test` runs `test/lang.js`. That test checks every pack in `WS_LANGUAGES` against the contract: the fields exist, tags come from the shared set, spans stay inside the line, the grade is a number, Auto recognises the pack's own markers, and `lang:` accepts its names. Your pack is checked as soon as it is listed.

Add your own cases next to the French ones:

- a few sentences with the tags you expect;
- each check on a sentence that should be marked, and on one that should not;
- a paragraph of real prose for Auto. Out-of-copyright books on Project Gutenberg work well.

The tagger doesn't need to be perfect. A mark is a nudge to look at a sentence again, not a verdict. Still, a check that marks correct sentences gets switched off, so spend most of your effort on avoiding false marks.
