// ─────────────────────────────────────────────────────────────────────────────
// Prose analysis — lexicon, tagger, detectors
//
// Everything here is deliberately dependency-free. A real POS tagger
// (compromise, wink, natural) is 200KB–2MB and would dwarf the plugin; this
// is a lexicon + suffix + context tagger in the Brill tradition, which gets
// roughly 90% of ordinary English prose right. That is the correct accuracy
// target for a *writing aid*: the highlighting is a nudge to look at a
// sentence, not a grammatical assertion, and a wrong colour costs the writer
// a glance. Anything that needs to be exact (word counts, goals) is computed
// elsewhere and never goes through here.
//
// Tags used internally:
//   DET PRON PREP CONJ AUX MOD ADV ADJ NOUN VERB NUM TO
// which collapse to five highlight classes (noun / verb / adj / adv / conj)
// mirroring syntax colouring.
// ─────────────────────────────────────────────────────────────────────────────

import { findIllusionsWith, findRepetitionsWith, splitSentencesWith, SENT_END, tokenizeLine } from './common';
import type { WsLanguage, WsSpan, WsToken } from './common';

export const POS_LEX: Record<string, string> = Object.create(null) as Record<string, string>;
(function buildLexicon() {
	const add = (tag: string, words: string) => {
		for (const w of words.split(/\s+/)) if (w) POS_LEX[w] = tag;
	};

	add('DET', `a an the this that these those my your his her its our their
		some any each every no another both either neither all much many few
		little several enough such which whose what`);

	add('PRON', `i me you he him she it we us they them mine yours hers ours
		theirs myself yourself himself herself itself ourselves yourselves
		themselves who whom someone somebody something anyone anybody anything
		everyone everybody everything nobody nothing none one`);

	add('PREP', `of in for with on at by from about into over under above
		across against along among amid around before behind below beneath
		beside besides between beyond despite during except inside near off
		onto outside past since through throughout till toward towards
		underneath until unto upon within without via per unlike like`);

	add('CONJ', `as and but or nor yet so because although though while whereas
		unless if when whenever wherever whether than plus versus`);

	add('AUX', `am is are was were be been being have has had having do does
		did doing`);

	add('MOD', `will would shall should can could may might must ought`);

	add('TO', 'to');

	// 'one' stays a pronoun; the rest count things. NUM has no highlight
	// bucket, so numbers stay uncoloured — which is itself the point:
	// they stop being mistaken for nouns and verbs around them.
	add('NUM', `two three four five six seven eight nine ten eleven twelve
		thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty
		thirty forty fifty sixty seventy eighty ninety hundred thousand
		million billion dozen`);

	// Adverbs that do not end in -ly, plus the discourse connectives.
	add('ADV', `not never always often sometimes usually rarely seldom very
		quite rather too also just only even still already soon now then here
		there again once twice far away back together apart forward ahead
		almost nearly hardly barely scarcely somewhat somehow perhaps maybe
		indeed instead however therefore thus moreover nevertheless nonetheless
		anyway otherwise meanwhile furthermore hence why how well today
		tomorrow yesterday tonight later earlier ever else rather forth aside
		abroad anymore altogether upward downward inward outward up down out`);

	// Interjections take no highlight at all — "Oh dear!" is neither a
	// noun nor anything else worth a colour.
	add('INTJ', `oh ah aha alas hey hello ha hmm hush wow oops ouch yay
		hurrah phew ugh er um`);

	add('ADJ', `worth dear good bad big small large little old new young long short high
		low great same different other own able early late main major minor
		real true false whole full empty free hard easy simple complex clear
		dark light heavy soft loud quiet strong weak rich poor deep shallow
		wide narrow thick thin clean dirty warm cool hot cold dry wet sharp
		dull fast slow safe next last first second third final total certain
		sure possible likely necessary important common general specific
		particular single double sorry ready open close public private local
		national international social political economic human natural best
		better worse worst less least more most difficult strange quick slight
		direct exact vast brief sudden silent distant ancient modern current
		recent obvious similar familiar popular regular various serious
		previous senior junior chief prime sole mere utter sheer stark plain
		vague subtle blunt harsh calm tense tight loose smooth rough steep
		flat round square straight curved hollow solid dense sparse lengthy
		tidy messy odd fine keen bold quiet sweet bitter sour tough gentle
		fierce eager weary alive alone aware alike`);

	// Common nouns that suffix rules would otherwise mis-tag.
	add('NOUN', `time way people man woman men women child children day year
		work place case point group number world life hand eye head word thing
		name home room door house water fire air book story line page thought
		idea money family friend school city country state night morning
		evening week month hour minute moment reason question answer problem
		sense mind heart voice face body kind sort part end side form order
		matter fact view level rate area field course result effect chance
		change nothing everything something anything president student
		resident agent parent patient client moment accident incident
		continent talent tenant servant assistant consultant restaurant
		elephant infant merchant giant opponent component ingredient
		event government department apartment argument statement movement
		environment equipment treatment agreement`);

	// Base-form verbs. Many are also nouns (work, call, run, hold); context
	// rules below demote them to NOUN after a determiner or preposition.
	add('VERB', `go goes went gone going come comes came make makes made take
		takes took taken see sees saw seen know knows knew known think thinks
		say says said tell tells told give gives gave given find finds want
		wants need needs use uses try tries ask asks call calls feel feels felt
		seem seems leave leaves left keep keeps kept let lets begin begins
		began begun help helps show shows shown turn turns start starts run
		runs ran move moves live lives believe believes hold holds held bring
		brings brought happen happens write writes wrote written read stand
		stands stood hear hears heard mean means meant set sets meet meets met
		pay pays paid sit sits sat speak speaks spoke spoken lie lies lay lead
		leads led grow grows grew grown open opens win wins won offer offers
		remember remembers love loves consider considers appear appears buy
		buys bought wait waits serve serves die dies send sends build builds
		built stay stays fall falls fell cut cuts reach reaches remain remains
		put puts get gets got gotten become becomes became look looks 
		likes work works play plays walk walks talk talks check checks add adds
		note notes list lists click clicks press presses save saves load loads
		close closes choose chooses pick picks draw draws point points push
		pushes pull pulls carry carries follow follows lead include includes
		provide provides create creates allow allows report reports describe
		describes explain explains suggest suggests decide decides expect
		expects prefer prefers manage manages develop develops support
		supports require requires produce produces receive receives return
		returns continue continues change changes learn learns teach teaches
		spend spends watch watches listen listens forget forgets enjoy enjoys
		agree agrees accept accepts refuse refuses avoid avoids reduce reduces
		improve improves replace replaces remove removes apply applies`);

	// Contracted auxiliaries and modals. The tokenizer keeps apostrophes,
	// so these arrive as single tokens and the plain forms above never
	// match them — without these, "don't" and "i'm" fell through to the
	// suffix rules and tagged as nouns, which broke every context rule
	// keyed on a neighbouring AUX.
	add('AUX', `don't doesn't didn't isn't aren't wasn't weren't hasn't
		haven't hadn't i'm you're we're they're he's she's it's that's
		there's what's here's who's let's i've you've we've they've it'll
		that'll i'll you'll he'll she'll we'll they'll i'd you'd he'd she'd
		we'd they'd`);

	add('MOD', `can't won't wouldn't shouldn't couldn't mustn't needn't
		oughtn't`);
})();

// -ly words that are adjectives (or otherwise not the manner adverbs a
// writer is being asked to reconsider). Without this list "family",
// "reply" and "supply" all light up as adverbs.
export const LY_NOT_ADVERB = new Set(`only family reply apply supply imply comply
	multiply rely rally ally july italy holy ugly silly early likely lonely
	lovely friendly deadly costly orderly elderly monthly weekly daily yearly
	nightly hourly timely lively unlikely ghastly ghostly homely jolly folly
	bully belly sally tally melancholy anomaly assembly bristly burly chilly
	crumbly curly dolly gully hilly jelly kindly lolly manly measly oily
	prickly rally scaly smelly steely surly wobbly wooly worldly italy sicily
	assembly panoply monopoly`.split(/\s+/).filter(Boolean));

// ── Suffix tagging ───────────────────────────────────────────────────────────

export function suffixTag(lw: string) {
	if (/^\d/.test(lw)) return 'NUM';
	if (lw.length > 3 && /ly$/.test(lw) && !LY_NOT_ADVERB.has(lw)) return 'ADV';
	if (lw.length > 4 && /(ing)$/.test(lw)) return 'VERB';
	if (lw.length > 3 && /(ed)$/.test(lw)) return 'VERB';
	if (lw.length > 4 && /(est)$/.test(lw)) return 'ADJ';
	if (lw.length > 4 && /(tion|sion|ment|ness|ity|ance|ence|ship|hood|dom|ism|ist|acy|age|ure|ery|ology|graphy|itis)$/.test(lw)) return 'NOUN';
	if (lw.length > 4 && /(ous|ful|less|ive|able|ible|ical|ic|ish|ary|ent|ant|ile|ory|some|like|ward|proof)$/.test(lw)) return 'ADJ';
	if (lw.length > 4 && /(ize|ise|ate|ify|fy)$/.test(lw)) return 'VERB';
	if (lw.length > 3 && /(er|or)$/.test(lw)) return 'NOUN';
	if (lw.length > 3 && /s$/.test(lw) && !/ss$/.test(lw)) {
		const base = lw.replace(/(ies|es|s)$/, (m): string => (m === 'ies' ? 'y' : ''));
		if (POS_LEX[base] === 'VERB') return 'VERB';
		return 'NOUN';
	}
	// Anything else is a noun, a capitalised name mid-sentence included: the
	// proper-noun test that stood here returned the same NOUN as this line and
	// could change nothing (found by A482's sweep: a case on it passed anyway).
	return 'NOUN';
}

// ── Context rules ────────────────────────────────────────────────────────────


// Adverbs that grade a quality rather than modify an action.
export const DEGREE_ADVERBS = new Set(['very', 'so', 'too', 'quite', 'rather',
	'really', 'extremely', 'incredibly', 'terribly', 'awfully', 'fairly',
	'pretty', 'somewhat', 'deeply', 'highly', 'utterly', 'truly',
	'remarkably', 'surprisingly', 'perfectly', 'entirely', 'completely']);

// Words that go flat after a verb — same form as the adjective, adverb
// duty: "ran close", "went straight on", "held tight", "fell hard".
export const FLAT_ADVERBS = new Set(['close', 'fast', 'hard', 'tight', 'straight',
	'high', 'low', 'deep', 'long', 'far', 'near', 'early', 'late', 'slow',
	'quick', 'loud', 'wide', 'right', 'wrong', 'first', 'last']);

// Verbs that link a subject to a description rather than an object.
export const LINKING_VERBS = new Set(`seem seems seemed appear appears appeared
	look looks looked feel feels felt sound sounds sounded smell smells
	smelled taste tastes tasted grow grows grew turn turns turned remain
	remains remained stay stays stayed become becomes became get gets got
	getting`.split(/\s+/).filter(Boolean));

// Full stops that do not end sentences. "e.g." and initials tokenize as
// single letters, so those are handled by length; this set covers the
// multi-letter cases. Without it, "Dr. Smith said it" opens a false
// sentence at "Smith" — and the loose-pronoun check downstream then fires
// on perfectly anchored mid-sentence pronouns, while the rhythm grade is
// computed on half-sentences.
export const ABBREVIATIONS = new Set(`mr mrs ms dr prof rev gen sen rep hon st mt
	ft vs etc al cf ca approx dept est fig vol ch pp no op ed inc ltd co
	corp univ assn bros jan feb mar apr jun jul aug sep sept oct nov dec
	mon tue tues wed thu thurs fri sat sun`.split(/\s+/).filter(Boolean));

export const SUBJECT_PRONOUNS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'who']);

export function tagTokens(tokens: WsToken[], text: string) {
	// Pass 1 — lexicon, then suffix. Sentence starts use one token of
	// lookahead: a full stop only opens a new sentence when the word before
	// it is not an abbreviation or an initial, and the word after it is
	// capitalised.
	let firstInSentence = true;
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		const lex = POS_LEX[t.lw];
		t.first = firstInSentence;
		// Contracted auxiliaries attach to anything — "Dinah'll miss me",
		// "the key'd vanished" — so the known-word list can never cover
		// them all. The ending is the tag. 's stays out (possessives), and
		// ma'am is a word that merely ends like "I'm".
		let dyn = null;
		if (!lex && t.lw !== "ma'am") {
			const cm = /'(ll|d|re|ve|m)$/.exec(t.lw);
			if (cm) dyn = (cm[1] === 'll' || cm[1] === 'd') ? 'MOD' : 'AUX';
		}
		t.tag = lex || dyn || suffixTag(t.lw);
		// A sentence ends when the character right after this token is a
		// terminator (the tokenizer never swallows punctuation).
		const after = text.slice(t.to, t.to + 2);
		const ch = after.trim().charAt(0) || '';
		if (!SENT_END.test(ch)) { firstInSentence = false; continue; }
		if (ch !== '.') { firstInSentence = true; continue; }
		const nx = tokens[i + 1];
		firstInSentence = !(ABBREVIATIONS.has(t.lw) || t.lw.length === 1) &&
			(!nx || /^\p{Lu}/u.test(nx.w));
	}

	// Pass 2 — context. Cheap, local, and in the order that matters:
	// determiner/preposition demotion before infinitive promotion, so
	// "the run" stays a noun but "to run" becomes a verb.
	for (let i = 0; i < tokens.length; i++) {
		const t    = tokens[i];
		const prev = i > 0 ? tokens[i - 1] : null;
		const next = i + 1 < tokens.length ? tokens[i + 1] : null;

		// "the work", "a call", "in place" → noun, not verb. An -ing word
		// in the same slot is a gerund ("the meeting") unless a noun
		// follows, which makes it a participial modifier ("the running
		// water"). -ed words after a determiner are always modifiers.
		if (t.tag === 'VERB' && prev && (prev.tag === 'DET' || prev.tag === 'PREP')) {
			// "made her feel", "let her go" — a causative verb two back
			// means "her" is the object and this is a bare infinitive, not
			// a possession.
			const causative = prev.lw === 'her' && POS_LEX[t.lw] === 'VERB' &&
				i >= 2 && tokens[i - 2].tag === 'VERB';
			if (causative) { /* stays a verb */ }
			else if (/ed$/.test(t.lw))  t.tag = 'ADJ';
			else if (/ing$/.test(t.lw)) {
				// "the meeting" is a thing and "the running water" a
				// modifier — but only after a determiner. A gerund after a
				// preposition is an action being talked about ("of getting
				// up", "by running fast", "without looking"), and demoting
				// those stripped the verbs out of half of any literary
				// sentence.
				if (prev.tag === 'DET') t.tag = (next && next.tag === 'NOUN') ? 'ADJ' : 'NOUN';
			}
			else                        t.tag = 'NOUN';
		}
		// A handful of lexicon adverbs moonlight as nouns, and a determiner
		// settles it: "the well", "her back". Unless a noun follows, in
		// which case they are modifying it and the compound rule below has
		// the better claim ("the back door").
		if (t.tag === 'ADV' && (t.lw === 'well' || t.lw === 'back') && prev &&
			prev.tag === 'DET' && (!next || (next.tag !== 'NOUN' && next.tag !== 'ADJ'))) {
			t.tag = 'NOUN';
		}
		// Determiner + adjective with no noun after it → the adjective is
		// carrying the noun slot ("the poor", "the best").
		if (t.tag === 'ADJ' && prev && prev.tag === 'DET' && (!next || next.tag !== 'NOUN')) {
			// leave adjectives that clearly modify something later
			if (!next || (next.tag !== 'ADJ' && next.tag !== 'NOUN')) t.tag = 'NOUN';
		}
		// "to write" → infinitive.
		if (prev && prev.tag === 'TO' && (t.tag === 'NOUN' || t.tag === 'ADJ') && POS_LEX[t.lw] !== 'NOUN') {
			t.tag = 'VERB';
		}
		// Auxiliary or modal followed by a participle-shaped word → verb —
		// but only for words the lexicon doesn't already know. "nothing",
		// "something", "morning" and "evening" end in -ing too, and "it was
		// nothing" is not a verb phrase.
		if (prev && (prev.tag === 'AUX' || prev.tag === 'MOD') && t.tag === 'NOUN' &&
			!POS_LEX[t.lw] && /ing$|ed$|en$/.test(t.lw)) {
			t.tag = 'VERB';
		}
		// "to do", "to be", "to have" — an auxiliary right after "to" is a
		// plain infinitive: the marker gets its TO tag and the verb its own.
		if (t.lw === 'to' && next && next.tag === 'AUX' &&
			/^(do|be|have)$/.test(next.lw)) {
			t.tag = 'TO';
			next.tag = 'VERB';
		}
		// Negated do-support is followed by a bare verb, full stop —
		// "don't panic", "didn't time it" — whatever the lexicon thinks
		// the word is elsewhere.
		if (prev && /^(don't|doesn't|didn't)$/.test(prev.lw) &&
			(t.tag === 'NOUN' || t.tag === 'ADJ')) {
			t.tag = 'VERB';
		}
		// A modal followed by a word the lexicon does not know is a bare
		// verb too ("will attempt", "can't panic") — unless the next token
		// is an auxiliary, which is subject–aux inversion with a noun in
		// the middle ("can food be stored").
		if (prev && prev.tag === 'MOD' && (t.tag === 'NOUN' || t.tag === 'ADJ') &&
			!POS_LEX[t.lw] && !(next && next.tag === 'AUX')) {
			t.tag = 'VERB';
		}
		// A degree adverb grades a quality: "very sleepy", "quite odd",
		// "so tired". Unknown words in that slot are adjectives, unless a
		// noun follows to claim them ("very hungry wolves" keeps hungry
		// for the rule two below).
		if (t.tag === 'NOUN' && !POS_LEX[t.lw] && prev && DEGREE_ADVERBS.has(prev.lw) &&
			(!next || next.tag !== 'NOUN')) {
			t.tag = 'ADJ';
		}
		// Coordination copies the part of speech across: in "sleepy and
		// stupid" the second word rides on the first.
		if (t.tag === 'NOUN' && !POS_LEX[t.lw] && prev && next !== undefined &&
			(prev.lw === 'and' || prev.lw === 'or' || prev.lw === 'but') &&
			i >= 2 && tokens[i - 2].tag === 'ADJ' && (!next || next.tag !== 'NOUN')) {
			t.tag = 'ADJ';
		}
		// Noun immediately before a noun, where the first is also an
		// adjective by suffix, reads as a modifier.
		if (t.tag === 'NOUN' && next && next.tag === 'NOUN' && /(ic|al|ive|ous|ful)$/.test(t.lw)) {
			t.tag = 'ADJ';
		}
		// An unknown word between a determiner (or another adjective) and a
		// noun is filling the modifier slot: "her difficult book". Limited to
		// words the lexicon does not claim, so noun-noun compounds like "the
		// book cover" keep both nouns.
		if (t.tag === 'NOUN' && !POS_LEX[t.lw] && prev && next &&
			(prev.tag === 'DET' || prev.tag === 'ADJ' || prev.tag === 'PREP') && next.tag === 'NOUN') {
			t.tag = 'ADJ';
		}
		// Sentence-initial word followed by a determiner or pronoun, with no
		// lexicon entry claiming it as a noun, is almost always an
		// imperative verb ("Check the file", "Open your notes").
		if (t.first && t.tag === 'NOUN' && !POS_LEX[t.lw] && next &&
			(next.tag === 'DET' || next.tag === 'PRON')) {
			t.tag = 'VERB';
		}
		// A subject pronoun followed by a word the lexicon does not know is
		// carrying the verb slot: "I sprint", "they scribble". Restricted
		// to unknown words so lexicon nouns survive ("I, Claudius" aside,
		// "it time we left" is not prose worth guessing about).
		if (t.tag === 'NOUN' && !POS_LEX[t.lw] && prev && prev.tag === 'PRON' &&
			SUBJECT_PRONOUNS.has(prev.lw)) {
			t.tag = 'VERB';
		}

		// A linking verb hands its slot to a description, not a thing:
		// "seems fine", "looked ancient", "felt wrong". Only unknown
		// words move, and only when no noun follows to claim them
		// ("became president" keeps its noun).
		if (t.tag === 'NOUN' && !POS_LEX[t.lw] && prev && prev.tag === 'VERB' && LINKING_VERBS.has(prev.lw) &&
			(!next || (next.tag !== 'NOUN' && next.tag !== 'DET'))) {
			t.tag = 'ADJ';
		}
		// Flat adverbs: adjective-shaped words straight after a verb are
		// doing adverb work — "ran close by her", "went straight on" —
		// unless a noun follows to be modified ("ran close races").
		if (prev && prev.tag === 'VERB' && FLAT_ADVERBS.has(t.lw) &&
			(t.tag === 'ADJ' || t.tag === 'NOUN' || t.tag === 'VERB') &&
			!(next && next.tag === 'NOUN')) {
			t.tag = 'ADV';
		}
		// "thought that she had", "the fact that the key" — "that" before
		// a subject is joining clauses, not pointing at anything. Before a
		// noun ("that man") or an auxiliary ("that would be four thousand
		// miles") it keeps its determiner/pronoun reading.
		if (t.lw === 'that' && t.tag === 'DET' && next &&
			((next.tag === 'PRON' && SUBJECT_PRONOUNS.has(next.lw)) || next.tag === 'DET')) {
			t.tag = 'CONJ';
		}
		// "like" earns its verb reading only with a subject or a modal in
		// front — "I like tea", "would like", "didn't like it". After a
		// be-form it is the preposition again: "she was like a ghost".
		if (t.lw === 'like' && prev &&
			((prev.tag === 'PRON' && SUBJECT_PRONOUNS.has(prev.lw)) || prev.tag === 'MOD' ||
			 /^(do|does|did|don't|doesn't|didn't|won't|can't|couldn't|wouldn't|shouldn't)$/.test(prev.lw))) {
			t.tag = 'VERB';
		}
		// A gerund opening a sentence with an auxiliary right after it is
		// the subject, not an action: "Running is hard", "Waiting was
		// the worst part".
		if (t.first && t.tag === 'VERB' && /ing$/.test(t.lw) && next &&
			(next.tag === 'AUX' || next.tag === 'MOD')) {
			t.tag = 'NOUN';
		}
	}

	// "to" is an infinitive marker before a verb and a preposition everywhere
	// else. Decided last, so the infinitive promotion above has already run
	// and "to write" is distinguishable from "to the shop".
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].tag !== 'TO') continue;
		const next = tokens[i + 1];
		if (!next || next.tag !== 'VERB') tokens[i].tag = 'PREP';
	}
	return tokens;
}

// ── Writing checks ───────────────────────────────────────────────────────────
// Categories follow Editsaurus, which in turn follows Matt Might's shell
// scripts: filler words, passive voice, lexical illusions, commonly misused
// words, and pronouns with loose referents. All of it is list-and-rule based
// and runs on the visible lines only.

// Hedges and intensifiers — filler in any register, always flagged.
export const FILLER_STRONG = new Set(`very really quite rather somewhat fairly pretty
	extremely incredibly absolutely totally completely utterly literally
	actually basically essentially virtually practically arguably apparently
	seemingly presumably supposedly perhaps maybe probably possibly surely
	certainly clearly obviously definitely simply merely just truly honestly
	frankly somehow interestingly notably importantly ultimately effectively`
	.split(/\s+/).filter(Boolean));

// Quantifiers and frequency words: vague, but often doing honest work —
// "most users" in a manual and "several attempts" in a report are fine
// sentences. Behind a sub-toggle, off by default, so the filler check can
// stay on without painting every quantifier on the page.
export const FILLER_SOFT = new Set(`almost nearly roughly approximately several
	various numerous many most some few much lots often sometimes frequently
	occasionally usually generally typically relatively significantly
	substantially considerably slightly marginally overall largely mostly
	partly rarely`.split(/\s+/).filter(Boolean));

export const FILLER_PHRASES = new RegExp('\\b(' + [
	'kind of', 'sort of', 'a bit', 'a little', 'a lot of', 'lots of',
	'in order to', 'due to the fact that', 'the fact that',
	'it is important to note', 'it should be noted', 'needless to say',
	'at the end of the day', 'for all intents and purposes',
	'in terms of', 'with regard to', 'with respect to', 'in the event that',
	'more or less', 'to some extent', 'in my opinion', 'i think that',
	'as a matter of fact', 'when all is said and done', 'each and every',
	'first and foremost', 'few and far between'
].join('|') + ')\\b', 'gi');

// Passive voice: a be-form, optional adverbs, then a past participle.
export const BE_FORMS = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
	"isn't", "aren't", "wasn't", "weren't", 'get', 'gets', 'got', 'getting',
	// Contractions that can only be "be". The 's forms stay out: "he's
	// taken" is usually "he has taken" — perfect tense, active — and
	// flagging it would be wrong more often than right.
	"i'm", "you're", "we're", "they're"]);

export const IRREGULAR_PP = new Set(`been done gone seen taken given made said known
	written spoken broken chosen driven eaten fallen forgotten frozen hidden
	held kept left lost meant met paid put read run sent set shown shut sold
	sung sunk sat slept spent stood stolen struck sworn taught told thought
	thrown understood worn won built bought brought caught cut felt found got
	gotten heard led let lit lain laid drawn dealt fed fought fled flown
	forbidden forgiven grown hung hurt knelt learnt lent mistaken overcome
	proven quit ridden rung risen sought shaken shone shot shrunk slid sown
	sped spun spread sprung stuck stung stunk striven swept swum swung torn
	thrust trodden woken woven wound withdrawn beaten begun bent bound bred
	burst cast clung crept dug dreamt drunk dwelt hit knit leapt misled
	outdone overrun rebuilt rid sewn shed slain slit smelt spilt split spoilt
	strung sublet swollen undergone undertaken upheld withheld withstood wrung`
	.split(/\s+/).filter(Boolean));

// Words ending in -ed that are not past participles. An exact-match set, not
// a suffix regex: an alternative like `red` also swallows "considered".
export const ED_NOT_PARTICIPLE = new Set(`need indeed hundred thousand sacred wicked
	naked embed exceed proceed succeed feed speed breed bleed agreed freed
	deed creed greed seed weed shed sled bed fled led red wed hatred ahead
	instead spread thread bread dread biped moped aged blessed rugged ragged
	wretched crooked jagged`.split(/\s+/).filter(Boolean));

export const VERB_PREFIXES = ['re', 'over', 'under', 'out', 'mis', 'un', 'pre', 'dis',
	'fore', 'up', 'inter', 'trans', 'co', 'de'];

export function isPastParticiple(tok: WsToken) {
	const lw = tok.lw;
	if (IRREGULAR_PP.has(lw)) return true;
	if (lw.length > 5) {
		for (const pre of VERB_PREFIXES) {
			if (lw.startsWith(pre) && IRREGULAR_PP.has(lw.slice(pre.length))) return true;
		}
	}
	return lw.length > 3 && /ed$/.test(lw) && !ED_NOT_PARTICIPLE.has(lw);
}

export function isLyAdverb(tok: WsToken) {
	return tok.lw.length > 3 && /ly$/.test(tok.lw) && !LY_NOT_ADVERB.has(tok.lw);
}

// Participles that are almost always predicate adjectives after a be-form:
// "she was tired", "we're excited", "he got dressed" are states, not
// passives. A following "by" reinstates the flag — an explicit agent
// ("was surprised by the news") is passive enough to look at. "used" and
// "broken" are deliberately absent: "the tool was used" and "the window
// was broken" are the genuine article.
// States that never take an agent, so even a following "by" is temporal
// or spatial ("was gone by midnight", "was born by the river") and must
// not re-flag them the way it re-flags "was worried by the news".
export const AGENTLESS_STATES = new Set(['gone', 'born']);

export const PARTICIPLE_ADJECTIVES = new Set(`tired excited interested worried
	pleased surprised amazed amused annoyed ashamed bored concerned confused
	convinced delighted depressed determined devoted disappointed dressed
	embarrassed engaged exhausted fascinated frightened frustrated gifted
	married motivated organized organised prepared qualified related relaxed
	relieved satisfied scared shocked skilled stressed stuck talented
	terrified thrilled troubled upset committed dedicated educated
	experienced complicated sophisticated crowded born gone done finished
	lost armed retired settled seated situated located accustomed inclined
	torn broken worn`
	.split(/\s+/).filter(Boolean));

export function findPassive(tokens: WsToken[]) {
	const hits = [];
	const skippable = (t: WsToken) => t.tag === 'ADV' || isLyAdverb(t) || t.lw === 'been' || t.lw === 'being';
	for (let i = 0; i < tokens.length; i++) {
		if (!BE_FORMS.has(tokens[i].lw)) continue;
		let j = i + 1, hops = 0;
		while (j < tokens.length && hops < 4 && skippable(tokens[j])) { j++; hops++; }
		if (j < tokens.length && isPastParticiple(tokens[j])) {
			const pp  = tokens[j];
			const nxt = j + 1 < tokens.length ? tokens[j + 1] : null;
			// Predicate adjectives read as states; only an agent flags them.
			if (PARTICIPLE_ADJECTIVES.has(pp.lw) &&
				(AGENTLESS_STATES.has(pp.lw) || !(nxt && nxt.lw === 'by'))) { i = j; continue; }
			// Idioms that scan as passive but aren't worth a look:
			// "was supposed to", "was meant to", "was bound to".
			if (nxt && nxt.lw === 'to' &&
				(pp.lw === 'supposed' || pp.lw === 'meant' || pp.lw === 'bound')) { i = j; continue; }
			let start = tokens[i].from;
			if ((tokens[i].lw === 'been' || tokens[i].lw === 'being') && i > 0 &&
				/^(have|has|had|having)$/.test(tokens[i - 1].lw)) {
				start = tokens[i - 1].from;
			}
			hits.push({ from: start, to: tokens[j].to });
			i = j;
		}
	}
	return hits;
}
// Pairs people reach for the wrong half of. The old version was a bare
// word list, which flagged every "to", "there" and "then" on the page — a
// check nobody could leave on. Each confusion now has a context rule and
// fires only where the wrong half is the likely reading; the short list
// below is the remainder that is wrong in any context.
export const MISUSED_ALWAYS = new Set(['alot', 'irregardless', 'supposably',
	'definately', 'seperate', 'occured', 'untill', 'recieve', 'alright']);

// s-final nouns that are not plurals, so "less" before them stays legal.
export const MASS_S_NOUNS = new Set(['news', 'means', 'series', 'species',
	'physics', 'economics', 'politics', 'mathematics', 'ethics',
	'linguistics', 'measles', 'diabetes', 'chaos', 'gas', 'lens',
	'progress', 'los', 'las']);

export const COMPARATIVES = new Set(['more', 'less', 'fewer', 'better', 'worse',
	'rather', 'other', 'greater', 'higher', 'lower', 'larger', 'smaller',
	'bigger', 'older', 'younger', 'faster', 'slower', 'stronger', 'weaker',
	'earlier', 'later', 'longer', 'shorter', 'easier', 'harder', 'sooner',
	'farther', 'further', 'closer', 'cheaper', 'deeper', 'wider']);

export function findMisused(tokens: WsToken[]) {
	const hits: { from: number; to: number }[] = [];
	const flag = (a: WsToken, b?: WsToken | null) => hits.push({ from: a.from, to: (b || a).to });
	for (let i = 0; i < tokens.length; i++) {
		const t  = tokens[i];
		const p  = i > 0 ? tokens[i - 1] : null;
		const n  = i + 1 < tokens.length ? tokens[i + 1] : null;
		const lw = t.lw, nl = n ? n.lw : '', pl = p ? p.lw : '';

		if (MISUSED_ALWAYS.has(lw)) { flag(t); continue; }

		switch (lw) {
			// "could of", "must of" — the contraction 've misheard.
			case 'of':
				if (p && /^(could|would|should|must|might|may)$/.test(pl)) flag(p, t);
				break;
			// "its been", "its a" — the possessive where "it's" belongs.
			// Gerund possessives ("its being late") are real grammar, so
			// being/having stay exempt.
			case 'its':
				if (n && (n.tag === 'DET' ||
					(n.tag === 'AUX' && nl !== 'being' && nl !== 'having') ||
					nl === 'not')) flag(t);
				break;
			// "it's own" — the contraction where the possessive belongs.
			case "it's":
				if (nl === 'own') flag(t);
				break;
			// "their is", "their not coming" — "there"/"they're" territory.
			case 'their':
				if (n && ((n.tag === 'AUX' && nl !== 'being' && nl !== 'having') ||
					nl === 'not')) flag(t);
				break;
			// "there house was cold" — a bare lexicon noun straight after
			// "there" usually wanted "their". The AUX guard keeps
			// existential questions out: "is there money left?".
			case 'there':
				if (n && n.tag === 'NOUN' && POS_LEX[nl] === 'NOUN' &&
					!(p && p.tag === 'AUX')) flag(t);
				break;
			// "better then the rest", "rather then". Time-adverb readings
			// ("things were better then") end the clause, so a content
			// word has to follow before this fires.
			case 'then':
				if (p && n &&
					(COMPARATIVES.has(pl) || (p.tag === 'ADJ' && /er$/.test(pl))) &&
					(n.tag === 'DET' || n.tag === 'PRON' || n.tag === 'NOUN' ||
					 n.tag === 'ADJ' || n.tag === 'NUM' || n.tag === 'VERB')) flag(p, t);
				break;
			// "way to much", "there are to many" — "too" missing an o.
			// Bare "to much/many" is left alone: "it never amounted to
			// much" and "I said this to many people" are fine sentences.
			case 'to':
				if ((nl === 'much' || nl === 'many') &&
					(!p || p.tag === 'AUX' || p.tag === 'MOD' || pl === 'way' || pl === 'far')) flag(t, n);
				break;
			// "don't loose", "will loose", "to loose the game".
			case 'loose':
				if (p && (p.tag === 'MOD' || p.tag === 'TO' ||
					/^(don't|doesn't|didn't|won't|not)$/.test(pl))) flag(t);
				break;
			// "the affect" — the noun slot nearly always wants "effect".
			case 'affect': case 'affects':
				if (p && p.tag === 'DET') flag(t);
				break;
			// "less items" — a countable plural after "less" wants "fewer".
			case 'less':
				if (n && n.tag === 'NOUN' && /s$/.test(nl) &&
					!/(ss|us|is)$/.test(nl) && !MASS_S_NOUNS.has(nl)) flag(t, n);
				break;
			// "who's book is this" — contraction in the possessive slot.
			// "who's next", "who's there", "who's coming" all carry other
			// tags and stay clear.
			case "who's":
				if (n && POS_LEX[nl] === 'NOUN') flag(t);
				break;
			// "your a star", "your not" already fires above; "your are/is"
			// and "your the best" are the same slip with an article.
			case 'your':
				if (nl === 'welcome' || nl === 'not' || nl === 'going' || nl === 'gonna' ||
					(n && n.tag === 'DET') ||
					(n && n.tag === 'AUX' && nl !== 'being' && nl !== 'having')) flag(t);
				break;
			// "accept for the ending" — "except" misheard.
			case 'accept':
				if (nl === 'for') flag(t, n);
				break;
			// "quiet a few", "quiet the achievement" — "quite" mistyped.
			case 'quiet':
				if (nl === 'a' || nl === 'an') flag(t, n);
				break;
			// "will chose", "to chose", "didn't chose" — the past form in a
			// slot that only takes the base verb.
			case 'chose':
				if (p && (p.tag === 'MOD' || p.tag === 'TO' ||
					/^(don't|doesn't|didn't|won't)$/.test(pl))) flag(t);
				break;
			// "had lead the team", "was lead by" — "led" spelled like the
			// metal. Perfect and passive slots only take the participle.
			case 'lead':
				if ((p && /^(have|has|had)$/.test(pl)) ||
					(p && BE_FORMS.has(pl) && nl === 'by')) flag(t);
				break;
			// "walked passed the house" — a verb straight before it means
			// the preposition "past" was wanted.
			case 'passed':
				if (p && p.tag === 'VERB' && n && n.tag === 'DET') flag(t);
				break;
			// "peaked my interest" — "piqued". The possessive plus the noun
			// pins it; a mountain that "peaked" flags nothing.
			case 'peaked': case 'peeked':
				if (n && /^(my|his|her|their|our|your|its)$/.test(nl)) {
					const n2 = i + 2 < tokens.length ? tokens[i + 2] : null;
					if (n2 && /^(interest|curiosity|attention)$/.test(n2.lw)) flag(t, n2);
				}
				break;
		}
	}
	return hits;
}

// A pronoun opening a sentence usually points at the previous one, and the
// reader has to guess which part. Mid-sentence pronouns are left alone.
export const VAGUE_PRONOUNS = new Set(['it', 'this', 'that', 'these', 'those', 'they', 'them', 'there']);

// ...but "This chapter shows" and "Those results held" are determiners
// with the referent standing right next to them — nothing loose there.
export function isVaguePronoun(t: WsToken, next: WsToken | null | undefined) {
	if (!t.first || !VAGUE_PRONOUNS.has(t.lw)) return false;
	if ((t.lw === 'this' || t.lw === 'that' || t.lw === 'these' || t.lw === 'those') &&
		next && (next.tag === 'NOUN' || next.tag === 'ADJ' || next.tag === 'NUM')) return false;
	return true;
}

// ── Readability ──────────────────────────────────────────────────────────────

// Syllable counting by the standard heuristic: strip silent endings, then
// count vowel groups. Wrong on a minority of words ("fire", "poem"), which is
// fine — Flesch–Kincaid averages over a whole document and the error washes
// out long before it moves the grade.
export function countSyllables(word: string) {
	// THE ACCENTS ARE VOWELS (A482): stripped as "not a–z", café was "caf" —
	// one syllable — and résumé "rsum". A final é or ë is spoken (ca-fé,
	// Zo-ë), so it becomes a vowel pair the silent-e rule below cannot eat;
	// a diaeresis opens a new syllable (na-ïve), so a consonant is put in
	// front of it; then the marks go and the English rules run as before.
	let w = String(word).toLowerCase()
		.replace(/[éë]$/, 'ey')
		.replace(/([aeiouy])([äëïöü])/g, '$1h$2')
		.normalize('NFD').replace(/\p{M}/gu, '')
		.replace(/[^a-z]/g, '');
	if (!w) {
		// Spoken length of a figure grows with its digits — "1984" is five
		// syllables out loud. Digits+1, capped, tracks that well enough
		// for a grade that averages over sentences anyway.
		const d = String(word).replace(/[^0-9]/g, '').length;
		return d ? Math.min(6, d + 1) : 0;
	}
	if (w.length <= 3) return 1;
	w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
	w = w.replace(/^y/, '');
	const groups = w.match(/[aeiouy]{1,2}/g);
	return groups ? groups.length : 1;
}
// Flesch–Kincaid grade level. Below ~9 reads easily; the Hemingway app calls
// 10–13 hard and 14+ very hard, which is where the two tints come from.
export function fkGrade(words: number, sentences: number, syllables: number) {
	if (!words || !sentences) return 0;
	return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

// Grade for one sentence, from its own tokens.
export function sentenceGrade(tokens: WsToken[]) {
	if (!tokens.length) return 0;
	let syl = 0;
	for (const t of tokens) syl += countSyllables(t.w);
	return fkGrade(tokens.length, 1, syl);
}

// ── Repetition radar ─────────────────────────────────────────────────────────

// Words common enough that repeating them is invisible and unavoidable. Only
// words outside this list, and long enough to be noticed, are worth flagging.
export const REPETITION_STOPWORDS = new Set(`the a an and or but if then than that this
	these those there here it its it's is are was were be been being am do does
	did have has had having will would shall should can could may might must
	i me my we us our you your he him his she her they them their who whom whose
	what which when where why how all any both each few more most other some such
	no nor not only own same so too very just also as at by for from in into of
	on to with about after before between during over under again once out up
	down off above below now new one two three way get got go went come came
	said say says like make made take took see saw know knew think thought`
	.split(/\s+/).filter(Boolean));

// ── THE COMMON WORDS THE REPORT SETS ASIDE ────────────────────────
//
// The ten most used words of any English book are the, and, to, of, a, I,
// in, was, he, that — the same ten for every book, telling the writer
// nothing. So the Report's "Most used words" leaves the FUNCTION words out
// (articles, conjunctions, prepositions, pronouns, auxiliaries,
// determiners) and shows the rest, with a tick to bring them back. This is
// NOT the repetition list above, and must not be merged with it: that one
// also hides "said", "looked", "way", "one" — words whose echo is
// invisible in prose but whose COUNT is exactly what a novelist wants read
// back to them.
export const REPORT_STOPWORDS = new Set(`the a an and or but nor if then than that this
	these those there here it its it's is are was were be been being am do does
	did done have has had having will would shall should can could may might must
	ought i me my mine myself we us our ours you your yours he him his she her
	hers they them their theirs who whom whose what which when where why how all
	any both each few more most other some such no not only own same so too very
	just also as at by for from in into of on to with about after before between
	during over under again once out up down off above below through against
	without within upon onto until while because although though whether either
	neither yet don't didn't doesn't isn't wasn't weren't won't wouldn't couldn't
	shouldn't can't cannot hasn't haven't hadn't i'm i've i'd i'll you're you've
	he's she's we're we've they're they've that's there's what's`
	.split(/\s+/).filter(Boolean));

// The radar reads English as a–z and an apostrophe; crude stemming, so
// "writing" echoes "writes".
const EN_REPETITION = {
	stopwords: REPETITION_STOPWORDS,
	normalize: (lw: string) => lw.replace(/[^a-z']/g, ''),
	stem: (w: string) => w.replace(/(ing|ed|es|s)$/, ''),
};

// "she had had enough" is grammar, not a slip.
const EN_DOUBLES = new Set(['had']);

export function findFillerPhrases(text: string) {
	const hits: WsSpan[] = [];
	FILLER_PHRASES.lastIndex = 0;
	let m;
	while ((m = FILLER_PHRASES.exec(text))) hits.push({ from: m.index, to: m.index + m[0].length });
	return hits;
}

export function findIllusions(tokens: WsToken[]) {
	return findIllusionsWith(tokens, EN_DOUBLES);
}

export function splitSentences(text: string) {
	return splitSentencesWith(text, ABBREVIATIONS);
}

export function findRepetitions(tokens: WsToken[], windowSize: number, minLength: number) {
	return findRepetitionsWith(tokens, windowSize, minLength, EN_REPETITION);
}

export const LANG_EN: WsLanguage = {
	code: 'en',
	name: 'English',
	tokenize: tokenizeLine,
	tag: tagTokens,
	fillerStrong: FILLER_STRONG,
	fillerSoft: FILLER_SOFT,
	findFillerPhrases,
	findPassive,
	findMisused,
	findIllusions,
	isVaguePronoun,
	findRepetitions,
	reportStopwords: REPORT_STOPWORDS,
	splitSentences,
	countSyllables,
	grade: fkGrade,
};
