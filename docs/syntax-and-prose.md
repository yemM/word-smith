# Syntax coloring and prose checks

[← Back to the README](../README.md)

**Syntax** gives nouns, verbs, adjectives, adverbs and conjunctions each their own color, the way a code editor shows you structure. It can mute everything else so one class carries the sentence. Too many adverbs reads as a rash.

**Prose checks** mark eight things worth a second look: filler words, passive voice, doubled words, easily confused pairs, vague pronouns, dialogue tags, sentence rhythm, and repeated uncommon words. Each check has its own switch and its own color. Marks are an underline by default, or a highlight, or colored text.

Both run on your machine. Both are guesswork. A mark is a nudge, not a verdict. Both read English and French. A note in another language they recognise gets no marks rather than wrong ones (see [Languages](#languages)).

## Languages

Each note is read in one language, which is chosen in this order:

1. **`lang:` in the note's properties** (or `ws-lang:`, which wins if both are there). `lang: fr`, `lang: fr-FR`, `lang: French`, `lang: français` and `lang: en` all work. This decides for that note, whatever the setting says. A language the plugin has no rules for (`lang: de`) leaves the note unmarked.
2. **The Language setting** (Settings → Prose), when it names a language.
3. **Auto**, the default. The plugin counts the short common words at the start of the note (*the, and, of* against *le, les, et, est*) and picks the language they belong to. It also knows the common words of Spanish, Italian, Portuguese, German, Dutch and Russian. A note with a few of those is recognised and left unmarked, instead of being read with English rules. A note with none of these words, a single French one (*Notes on Le Petit Prince*), or one or two of a language with no pack, is read as English, as before. So a French note of a line or two may be read as English until more of it is written; `lang: fr`, in a template for instance, settles it from the first word. Other languages are read as English too, so give their notes a `lang:`.

The language decides which words count as filler, which constructions are passive, which pairs are easily confused, which pronouns are loose, which words are too common for the repetition radar and the Report's word list, and how syllables and readability are counted.

**In French**, elisions are split before tagging: *l'homme* is the article and the noun. Adverbs are mostly found by *-ment*, the imperfect by *-ait*, and the infinitive by *-er*. *Le*, *la* and *les* before a verb are taken as pronouns (*je la vois*). The passive check leaves verbs conjugated with *être* (*elle est partie*) and reflexives (*elle s'est levée*) alone. The confused pairs are *a/à*, *ou/où*, *et/est*, *son/sont*, *on/ont*, *ce/se*, *ses/ces*, *la/là*, *quand/quant*, *leur/leurs*, *peu/peut* and *sa/ça*, plus *si j'aurais*, *se rappeler de* and *pallier à*. Each is matched in context, so correct uses stay clear. Loose pronouns are *cela*, *ça*, *ceci*, *ce* and *ils/elles* opening a sentence. *Il* and *elle* are left out, because in French they name a character as often as a thing. Readability uses Kandel and Moles's French version of Flesch reading ease, converted to the same grade scale, so the rhythm thresholds mean the same thing in both languages.

**Dialogue** marks everything inside quotes, in any language. It also marks a line that opens with a dash (`— À demain, Johan.`), as French, Spanish, Italian, Portuguese and Russian set dialogue. On those lines the narrator's incise is left out. In French that's *dit-il* or *soupira Johan* after a comma, a question or exclamation mark, or an ellipsis, and the mark picks up again where the speaker does. In the other languages it's the words between two dashes (`—respondió don Quijote—`). Not in English, where a line opening with a dash is an attribution (`— Robert Frost`). In every language, the source under an epigraph in a quote block (`> — Victor Hugo, Les Misérables`) is left alone.

**French spacing** (Settings → Text → Typography) puts a narrow no-break space before `;` `!` `?`, and a no-break space before `:` and inside `« »`, as you type. With curly quotes on, `"` becomes `« »`. You can turn it on for notes read as French only, or for every note. Backspace right after a substitution gives back what you typed.

**Adding a language** takes one file and one line: see [Adding a language](adding-a-language.md).

## How the tagger works

A hand-written part-of-speech tagger. No API, no model, no bundled NLP library. Three passes over each visible line.

**Lexicon.** About a thousand words that suffix rules can't be trusted with: determiners, pronouns, prepositions, auxiliaries, irregular verbs, and common words that would otherwise be mis-tagged.

**Suffix rules.** Anything else is guessed from its ending. `-ly` is an adverb (minus the exceptions: family, reply, early). `-ing` and `-ed` are verbs. `-tion`, `-ment`, `-ness` are nouns. `-ous`, `-ful`, `-less` are adjectives. And so on.

**Context.** The pass that fixes what the first two got wrong, using the words either side. After a determiner, a verb becomes a noun (*the work*). An unknown word between a determiner and a noun is an adjective (*her difficult book*). After *to*, it's an infinitive.

Results are drawn as editor decorations, so they never flicker while you type. The line you're writing in keeps its colors while you type, and catches up when you move to another line. On iPhone and iPad, redrawing the text under the caret makes the keyboard switch to capitals, so nothing there is redrawn while you type. Only the lines on screen are tagged, and code, frontmatter and maths are skipped.

## What it gets wrong

Roughly nine words in ten on ordinary English prose, in my own testing, not benchmarked against a tagged corpus. Weakest on dialogue-heavy fiction, fragments, and unusual proper nouns. That's why it's a writing aid and not a grammar checker.

French is newer and has the same kind of weak spots. The present tense of *-er* verbs (*il regarde*) has the same form as many nouns and adjectives. It is read from context: after a subject it is a verb, after a noun an adjective, unless an article or *que* follows. That context is sometimes wrong.
