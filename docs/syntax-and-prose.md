# Syntax coloring and prose checks

[← Back to the README](../README.md)

**Syntax** gives nouns, verbs, adjectives, adverbs and conjunctions each their own color, the way a code editor shows you structure. It can mute everything else so one class carries the sentence. Too many adverbs reads as a rash.

**Prose checks** mark eight things worth a second look: filler words, passive voice, doubled words, easily confused pairs, vague pronouns, dialogue tags, sentence rhythm, and repeated uncommon words. Each check has its own switch and its own color. Marks are an underline by default, or a highlight, or colored text.

Both run on your machine. Both are guesswork. A mark is a nudge, not a verdict. Both read English. A note in another language they recognise gets no marks rather than wrong ones (see [Languages](#languages)).

## Languages

Each note is read in one language, which is chosen in this order:

1. **`lang:` in the note's properties** (or `ws-lang:`, which wins if both are there). `lang: en`, `lang: en-GB` and `lang: English` all work. This decides for that note, whatever the setting says. A language the plugin has no rules for (`lang: de`) leaves the note unmarked.
2. **The Language setting** (Settings → Prose), when it names a language.
3. **Auto**, the default. The plugin counts the short common words at the start of the note (*the, and, of*). It also knows the common words of Spanish, Italian, Portuguese, German, Dutch and Russian. A note with a few of those is recognised and left unmarked, instead of being read with English rules. A note with none of these words, or only one or two, is read as English, as before. Other languages are read as English too, so give their notes a `lang:`.

The language decides which words count as filler, which constructions are passive, which pairs are easily confused, which pronouns are loose, which words are too common for the repetition radar and the Report's word list, and how syllables and readability are counted.

## How the tagger works

A hand-written part-of-speech tagger. No API, no model, no bundled NLP library. Three passes over each visible line.

**Lexicon.** About a thousand words that suffix rules can't be trusted with: determiners, pronouns, prepositions, auxiliaries, irregular verbs, and common words that would otherwise be mis-tagged.

**Suffix rules.** Anything else is guessed from its ending. `-ly` is an adverb (minus the exceptions: family, reply, early). `-ing` and `-ed` are verbs. `-tion`, `-ment`, `-ness` are nouns. `-ous`, `-ful`, `-less` are adjectives. And so on.

**Context.** The pass that fixes what the first two got wrong, using the words either side. After a determiner, a verb becomes a noun (*the work*). An unknown word between a determiner and a noun is an adjective (*her difficult book*). After *to*, it's an infinitive.

Results are drawn as editor decorations, so they never flicker while you type. The line you're writing in keeps its colors while you type, and catches up when you move to another line. On iPhone and iPad, redrawing the text under the caret makes the keyboard switch to capitals, so nothing there is redrawn while you type. Only the lines on screen are tagged, and code, frontmatter and maths are skipped.

## What it gets wrong

Roughly nine words in ten on ordinary prose, in my own testing, not benchmarked against a tagged corpus. Weakest on dialogue-heavy fiction, fragments, and unusual proper nouns. That's why it's a writing aid and not a grammar checker.
