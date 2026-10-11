// ─────────────────────────────────────────────────────────────────────────────
// Prose analysis — French
//
// The same three passes as the English tagger (lexicon, endings, context) and
// the same target: right on most of ordinary prose, a nudge rather than a
// verdict. French makes some of it easier — adverbs announce themselves with
// -ment, the imperfect with -ait, the infinitive with -er — and some of it
// harder: "le", "la" and "les" are articles before a noun and pronouns before
// a verb ("je la vois"), the past participle is also the adjective ("une
// porte fermée"), and the third person plural -ent is a verb ending that a
// hundred adjectives and nouns share ("ils parlent", "un accident").
//
// Elisions are split before tagging: "l'homme" is the article and the noun,
// "qu'il" the conjunction and the pronoun, so neither hides the other.
// ─────────────────────────────────────────────────────────────────────────────

import { DIALOGUE_SPACE, findIllusionsWith, findRepetitionsWith, splitSentencesWith, SENT_END, tokenizeLine, trimSpanEnd } from './common';
import type { WsLanguage, WsSpan, WsToken } from './common';

const words = (s: string) => s.split(/\s+/).filter(Boolean);

// ── Lexicon ─────────────────────────────────────────────────────────────────

const LEX: Record<string, string> = Object.create(null) as Record<string, string>;
(function buildLexicon() {
	const add = (tag: string, list: string) => { for (const w of words(list)) LEX[w] = tag; };

	add('DET', `le la les l' un une des du au aux ce cet cette ces mon ma mes ton ta
		tes son sa ses notre nos votre vos leur leurs quel quelle quels quelles
		chaque plusieurs quelques quelque aucun aucune nul nulle tout toute tous
		toutes certains certaines divers diverses maints`);

	add('PRON', `je j' tu il elle on nous vous ils elles me m' te t' se s' moi toi
		lui eux soi y qui quoi dont lequel laquelle lesquels lesquelles auquel
		auxquels duquel desquels celui celle ceux celles ceci cela ça c' rien
		personne quelqu'un chacun chacune autrui celui-ci celle-ci ceux-ci
		celles-ci celui-là celle-là ceux-là celles-là`);

	add('PREP', `à de d' dans par pour sur sous avec sans chez vers entre contre
		depuis pendant avant après devant derrière parmi selon malgré envers hors
		dès outre via jusque jusqu' durant en voici voilà sauf hormis excepté
		auprès afin`);

	add('CONJ', `et ou mais donc or ni car que qu' quand lorsque lorsqu' puisque
		puisqu' quoique quoiqu' si comme tandis parce sinon est-à-dire`);

	add('AUX', `suis es est sommes êtes sont étais était étions étiez étaient serai
		seras sera serons serez seront serais serait serions seriez seraient fus
		fut fûmes fûtes furent sois soit soyons soyez soient fût être été étant
		ai as a avons avez ont avais avait avions aviez avaient aurai auras aura
		aurons aurez auront aurais aurait aurions auriez auraient eus eut eurent
		aie aies ait ayons ayez aient avoir eu ayant`);

	add('MOD', `peux peut pouvons pouvez peuvent pouvais pouvait pouvions pouviez
		pouvaient pourrai pourras pourra pourrons pourrez pourront pourrais
		pourrait pourrions pourriez pourraient pus put purent puisse puisses
		puissent puissions pu pouvoir dois doit devons devez doivent devais
		devait devions deviez devaient devrai devras devra devrons devrez devront
		devrais devrait devrions devriez devraient dut durent doive dû devoir
		veux veut voulons voulez veulent voulais voulait voulions vouliez
		voulaient voudrai voudras voudra voudrons voudrez voudront voudrais
		voudrait voudrions voudriez voudraient voulut voulurent veuille veuillez
		voulu vouloir faut fallait faudra faudrait fallut faille fallu`);

	add('ADV', `ne n' pas plus jamais guère très trop assez bien mal peu beaucoup
		tant tellement aussi autant moins encore déjà toujours souvent parfois
		quelquefois ici là là-bas là-haut ailleurs partout maintenant alors
		ensuite puis enfin bientôt hier aujourd'hui demain tôt tard longtemps
		vite ainsi pourtant cependant néanmoins toutefois surtout peut-être
		presque environ plutôt oui non ensemble dehors dedans dessus dessous loin
		près autour davantage certes volontiers aussitôt soudain désormais jadis
		auparavant debout combien comment pourquoi où abord tantôt sitôt
		dorénavant quasi voire`);

	add('INTJ', `oh ah eh hé hein bah bof ouf zut hélas aïe chut hop bravo allô euh
		hum ha ho oups merci`);

	add('NUM', `deux trois quatre cinq six sept huit neuf dix onze douze treize
		quatorze quinze seize vingt trente quarante cinquante soixante cent cents
		mille million millions milliard milliards`);

	add('ADJ', `grand grande grands grandes petit petite petits petites bon bonne
		bons bonnes mauvais mauvaise mauvaises beau bel belle beaux belles vieux
		vieil vieille vieilles jeune jeunes nouveau nouvel nouvelle nouveaux
		nouvelles long longue longs longues court courte courts courtes haut
		haute hauts hautes bas basse basses gros grosse grosses gras large
		étroit étroite plein pleine pleins pleines vide vides vrai vraie vrais
		vraies faux fausse seul seule seuls seules même mêmes autre autres tel
		telle tels telles premier première premiers premières dernier dernière
		derniers dernières prochain prochaine cher chère chers chères propre
		propres sale sales libre libres simple simples facile faciles difficile
		difficiles possible impossible blanc blanche blancs blanches noir noire
		noirs noires rouge rouges vert verte verts vertes bleu bleue bleus bleues
		jaune jaunes gris grise brun brune rose roses doux douce dur dure durs
		dures froid froide froids froides chaud chaude chauds chaudes sec sèche
		lourd lourde léger légère fort forte forts fortes faible faibles riche
		riches pauvre pauvres triste tristes calme sombre sombres clair claire
		clairs claires lent lente lents lentes rapide rapides fou folle fous
		folles tranquille immense énorme profond profonde lointain lointaine
		proche proches entier entière pareil pareille fier fière sûr sûre prêt
		prête prêts prêtes content contente gentil gentille joli jolie laid
		laide mince épais épaisse pâle humide tiède sauvage étrange étranges
		bizarre drôle rare rares célèbre noble digne utile inutile juste injuste
		parfait parfaite meilleur meilleure meilleurs supérieur inférieur
		intérieur extérieur majeur mineur ancien ancienne anciens anciennes
		pire moindre ivre nu nue tendre amer amère frais fraîche français
		française anglais anglaise prudent prudente évident évidente différent
		différente récent récente violent violente absent absente présent
		présente fréquent permanent apparent innocent intelligent patient urgent
		excellent conscient silencieux satisfait distrait abstrait étranger
		étrangère sérieux sérieuse énormes grave graves`);

	// Nouns the endings would read wrong: -ant and -ent words that are no
	// adjective and no verb, -er/-ir/-oir words that are no infinitive.
	add('NOUN', `homme hommes femme femmes enfant enfants jour jours nuit nuits temps
		main mains tête têtes yeux œil oeil porte portes maison maisons chambre
		fenêtre ville rue monde vie mort père mère fils fille filles frère sœur
		ami amie amis gens chose choses fois heure heures moment moments mot mots
		voix cœur corps visage regard eau feu air terre ciel mer soleil lune vent
		pluie neige arbre bois route chemin voiture table livre lettre papier
		histoire question réponse idée raison sorte façon manière place côté bout
		fond milieu nom coup pied pieds bras dos cou bouche nez dent dents
		cheveux peau sang larme larmes silence bruit lumière ombre matin soir
		journée semaine mois an ans année siècle argent travail affaire problème
		pays guerre paix dieu roi reine instant parent parents client accident
		président serpent talent agent continent incident adolescent sergent
		accent courant restaurant habitant enseignant étudiant gouvernement
		appartement mouvement sentiment changement bâtiment vêtement événement
		comportement document élément instrument monument jugement logement
		traitement commencement enseignement établissement environnement
		équipement développement département paiement médicament compliment
		argument testament tempérament aliment fragment segment ciment serment
		tourment régiment parlement ornement sacrement isolement battement
		craquement grincement hurlement sifflement tremblement froissement
		glissement étonnement fer hiver enfer ver dîner souper déjeuner
		goûter coucher lever rocher boucher berger danger verger foyer loyer
		clocher plancher baiser désir plaisir soupir loisir avenir souvenir
		espoir miroir couloir trottoir tiroir mouchoir comptoir rasoir lait
		trait portrait attrait souhait forfait bienfait méfait retrait extrait
		palais marais relais délai délais biais café thé blé clé pré gré
		liberté beauté santé bonté fierté volonté clarté cruauté loyauté majesté
		nouveauté propreté sûreté fermeté gaieté côtés sort reste
		prix poids repas souris avis choix os`);

	// Verbs the endings miss: the irregular forms writers use most, the
	// infinitives in -re and -oir, and the -ier verbs.
	add('VERB', `fait faire fais font faisait faisaient fit firent ferai fera
		feront ferait feraient dit dire dis disent disait disaient dirent dira
		dirait va vais vas vont allons allez allait allaient alla allèrent ira
		irait iront aller allé allée allés allées vient viens viennent venait
		venaient vint vinrent viendra viendrait venir venu venue venus venues
		voit vois voient voyait voyaient vit virent verra verrait voir vu vus vues
		prend prends prennent prenait prenaient prit prirent prendra prendrait
		prendre pris prise prises met mets mettent mettait mit mirent mettre mis
		mise sait sais savent savait savaient sut surent saura saurait savoir su
		croit crois croient croyait crut croire cru connaît connais connaissait
		connaître connu connue tient tiens tiennent tenait tenaient tint tenir
		tenu tenue part pars partent partait partit partir parti partie sent
		sens sentait sentit sentir senti sentie suit suivait suivit suivre suivi
		vivait vivre vécu lit lisait lire lu écrit écrivait écrire écrivit ouvre
		ouvrait ouvrit ouvrir ouvert ouverte semble semblait sembla sembler
		regarde regardait regarda parle parlait parla pense pensait pensa trouve
		trouvait trouva donne donnait donna demande demandait demanda passe
		passait passa laisse laissait laissa attend attendait attendit attendre
		attendu entend entendait entendit entendre entendu répond répondit
		répondre perd perdit perdre perdu rend rendit rendre rendu devient
		devenait devint devenir devenu devenue revient revenait revint revenir
		revenu comprend comprenait comprit comprendre compris meurt mourait
		mourut mourir naît naquit naître né née boit buvait boire bu rit riait
		rire sourit souriait sourire plaît plaisait plaire vaut valait valoir
		pleut pleuvait pleuvoir assied asseyait assit asseoir assis assise reçoit
		recevait reçut recevoir reçu aperçoit aperçut apercevoir aperçu revoir
		prévoir émouvoir décevoir concevoir oublier crier étudier remercier
		marier copier plier prier vérifier confier relier nier lier publier
		apprécier envier tue tuer cours courait courut courir couru existe insiste
		persiste résiste assiste consiste subsiste`);
})();

// ── Tokenizer ────────────────────────────────────────────────────────────────

// The elided words, apostrophe included. "aujourd'hui" and "quelqu'un" are
// one word each and stay whole; they are not on this list.
const ELISION = /^(l|d|j|qu|n|s|c|m|t|jusqu|lorsqu|puisqu|quoiqu)['\u2019](?=\p{L})/iu;

function tokenize(text: string) {
	const out: WsToken[] = [];
	for (const t of tokenizeLine(text)) {
		let cur = t;
		// "jusqu'à l'aube" — at most a couple per token, but loop anyway.
		for (let m = ELISION.exec(cur.w); m; m = ELISION.exec(cur.w)) {
			const n = m[0].length;
			const head = cur.w.slice(0, n);
			out.push({ w: head, lw: head.toLowerCase().replace(/\u2019/g, "'"), from: cur.from, to: cur.from + n, tag: null });
			const rest = cur.w.slice(n);
			cur = { w: rest, lw: rest.toLowerCase().replace(/\u2019/g, "'"), from: cur.from + n, to: cur.to, tag: null };
		}
		out.push(cur);
	}
	return out;
}

// For the Report's word list, which reads words its own way: "l'homme"
// counts as "l'" and "homme", so the noun is counted and the article set aside.
export function frSplitElision(w: string): string[] {
	const out: string[] = [];
	let cur = w;
	for (let m = ELISION.exec(cur); m; m = ELISION.exec(cur)) {
		out.push(cur.slice(0, m[0].length).replace(/\u2019/g, "'"));
		cur = cur.slice(m[0].length);
	}
	out.push(cur);
	return out;
}

// ── Endings ──────────────────────────────────────────────────────────────────

// A past participle by its shape: aimé, finie, vendus, écrites, ouvert.
const PP_SHAPE = /(é|ée|és|ées)$/;
// After a consonant only: "flou", "genou" and "oui" are no participles.
const PP_SHAPE_WIDE = /(é|ée|és|ées|[^aeiouy](i|ie|is|ies|u|ue|us|ues)|it|ite|its|ites|ert|erte|erts|ertes|int|inte|ints|intes)$/;

// Tokens whose tag is the fall-through default, not a word or an ending the
// tagger recognised: the ones context is allowed to move.
const WEAK = new WeakSet<WsToken>();

function suffixTag(lw: string): string | null {
	if (/^\d/.test(lw)) return 'NUM';
	// "dit-il", "donne-moi", "allez-y", "est-ce": a verb with its pronoun.
	if (/-(t-)?(je|tu|il|elle|on|nous|vous|ils|elles|ce|moi|toi|lui|leur|le|la|les|en|y)$/.test(lw)) return 'VERB';
	// "ce jour-là", "cette fois-ci": the word before the particle decides.
	const base = lw.replace(/-(ci|là)$/, '');
	if (base !== lw) return LEX[base] || suffixTag(base);
	const n = lw.length;
	if (n > 5 && /issements?$/.test(lw)) return 'NOUN';
	if (n > 5 && /ments$/.test(lw)) return 'NOUN';             // adverbs do not take a plural
	if (n > 4 && /ment$/.test(lw)) return 'ADV';
	if (n > 4 && /aient$/.test(lw)) return 'VERB';
	if (n > 4 && /(èrent|irent|urent|âmes|âtes|îmes|ront|rions|riez)$/.test(lw)) return 'VERB';
	if (n > 4 && /ions?$/.test(lw)) return 'NOUN';             // "nous marchions": see context
	if (n > 4 && /(ités?|ismes?|istes?|ances?|ences?|esses?|ettes?|aisons?|udes?|eurs?|ures?|ages?|oires?)$/.test(lw)) return 'NOUN';
	if (n > 4 && /(euse|euses|eux|ive|ives|ifs|ables?|ibles?|iques?|ales?|elles?|els|esques?|âtres?|aires?|antes?|ants|entes?)$/.test(lw)) return 'ADJ';
	if (n > 4 && /ant$/.test(lw)) return 'ADJ';                // a gerund after "en"; see context
	if (n > 4 && /(ait|ais)$/.test(lw)) return 'VERB';
	if (n > 4 && /ent$/.test(lw)) return 'VERB';               // "ils parlent"; adjectives are listed
	if (n > 3 && /ez$/.test(lw)) return 'VERB';
	if (n > 3 && PP_SHAPE.test(lw)) return 'VERB';
	if (n > 4 && /ifier$/.test(lw)) return 'VERB';
	if (n > 3 && /ier$/.test(lw)) return 'NOUN';
	if (n > 3 && /er$/.test(lw)) return 'VERB';
	if (n > 3 && /oir$/.test(lw)) return 'NOUN';
	if (n > 3 && /ir$/.test(lw)) return 'VERB';
	if (n > 4 && /(endre|andre|ondre|erdre|oudre|aindre|eindre|oindre|ttre|aître|oître|uire|crire)$/.test(lw)) return 'VERB';
	if (n > 4 && /([^aeiouyé]|qu|gu|ge)a$/.test(lw)) return 'VERB';   // passé simple: "il regarda", "indiqua", "dirigea"
	if (n > 3 && /[sx]$/.test(lw) && !/(ss|us)$/.test(lw)) {
		const one = lw.slice(0, -1);
		const lex = LEX[one];
		if (lex) return lex === 'VERB' || lex === 'AUX' || lex === 'MOD' ? 'NOUN' : lex;
		return suffixTag(one);
	}
	return null;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ABBREVIATIONS = new Set(words(`m mm mme mmes mlle mlles dr pr me st ste etc
	cf vol chap fig art éd coll ex env av apr env max min tél`));

const SUBJECTS = new Set(words(`je j' tu il elle on nous vous ils elles qui`));
// The pronouns that sit between a subject and its verb: "il ne me le dit pas".
const CLITICS = new Set(words(`ne n' me m' te t' se s' le la les l' lui leur y en nous vous`));
const OBJECT_ARTICLES = new Set(['le', 'la', 'les', "l'"]);
const DEGREE = new Set(words(`très si trop assez plus moins aussi fort bien tout peu tellement vraiment`));
const LINKING = new Set(words(`suis es est sommes êtes sont étais était étions étiez étaient
	serai sera seront serait seraient fut furent soit être été semble semblait semblaient
	sembla parut paraît paraissait devint devient devenait devenu resta reste restait
	demeura demeurait`));
// Infinitives that are nouns as well, after an article: "le savoir", "un sourire".
const INFINITIVE_NOUNS = new Set(words(`savoir pouvoir devoir vouloir être avoir sourire
	rire souvenir plaisir désir loisir avenir manger boire lever coucher dîner
	déjeuner souper goûter baiser repentir`));
// Determiners that stand alone as pronouns before a verb: "tout est là".
const DET_AS_PRON = new Set(words(`tout toute tous toutes certains certaines plusieurs aucun aucune nul`));

// Only a space between two words: nothing that ends a phrase.
const near = (a: WsToken, b: WsToken) => b.from - a.to <= 1;

const isVerbal = (t: WsToken | null | undefined) => !!t && (t.tag === 'VERB' || t.tag === 'AUX' || t.tag === 'MOD');

// The subject behind a verb, past any pronouns in between.
function subjectBefore(tokens: WsToken[], i: number) {
	for (let k = i - 1, hops = 0; k >= 0 && hops < 4; k--, hops++) {
		const lw = tokens[k].lw;
		if (SUBJECTS.has(lw)) return true;
		if (!CLITICS.has(lw)) return false;
	}
	return false;
}

function tag(tokens: WsToken[], text: string) {
	// Pass 1 — lexicon, then endings. Sentence starts as in English: a full
	// stop opens a sentence unless it follows an abbreviation or an initial,
	// and the next word is capitalised.
	let firstInSentence = true;
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		t.first = firstInSentence;
		const lex = LEX[t.lw];
		if (lex) t.tag = lex;
		else {
			const suf = suffixTag(t.lw);
			t.tag = suf || 'NOUN';
			if (!suf) WEAK.add(t);
		}
		const after = text.slice(t.to, t.to + 2);
		const ch = after.trim().charAt(0) || '';
		if (!SENT_END.test(ch)) { firstInSentence = false; continue; }
		if (ch !== '.') { firstInSentence = true; continue; }
		const nx = tokens[i + 1];
		firstInSentence = !(ABBREVIATIONS.has(t.lw) || t.lw.length === 1) &&
			(!nx || /^\p{Lu}/u.test(nx.w));
	}

	// Pass 2 — context.
	for (let i = 0; i < tokens.length; i++) {
		const t    = tokens[i];
		const prev = i > 0 ? tokens[i - 1] : null;
		const next = i + 1 < tokens.length ? tokens[i + 1] : null;
		const weak = WEAK.has(t) && !LEX[t.lw];
		const known = !!LEX[t.lw];

		// "je la vois", "il les attend", "pour le dire": an article right
		// before a verb is its object. After a subject or another pronoun any
		// verb will do; after a preposition only an infinitive, so "de la
		// journée" keeps its article.
		if (OBJECT_ARTICLES.has(t.lw) && next && isVerbal(next) && !WEAK.has(next)) {
			const afterSubject = prev && (SUBJECTS.has(prev.lw) || CLITICS.has(prev.lw));
			const afterPrep = prev && /^(pour|sans|de|d'|à|par)$/.test(prev.lw) && /(er|ir|re|oir)$/.test(next.lw);
			// "Pierre les attend", "Johan l'observait", "le chat la regarda": a
			// noun subject, then a conjugated verb — known, or with a tense's
			// own ending. Not "le fait", which no subject precedes.
			const conjugated = /(ait|aient|ent|èrent|([^aeiouyé]|qu|gu|ge)a)$/.test(next.lw) ||
				(LEX[next.lw] === 'VERB' && !PP_SHAPE_WIDE.test(next.lw) && !/(er|ir|re|oir)$/.test(next.lw));
			const afterNoun = prev && prev.tag === 'NOUN' && conjugated;
			// "venait l'accueillir", "sans le voir": an article never precedes
			// an infinitive, save the few that are nouns too ("le savoir").
			const infinitive = /(er|ir|re|oir)$/.test(next.lw) && !INFINITIVE_NOUNS.has(next.lw) && LEX[next.lw] !== 'NOUN';
			if (afterSubject || afterPrep || afterNoun || infinitive || (t.first && !PP_SHAPE.test(next.lw))) { t.tag = 'PRON'; continue; }
		}
		// "il en a", "j'en veux", "leur dit".
		if ((t.lw === 'en' || t.lw === 'leur') && next && isVerbal(next) && !/ant$/.test(next.lw) &&
			(t.lw === 'leur' || (prev && (SUBJECTS.has(prev.lw) || CLITICS.has(prev.lw))))) {
			t.tag = 'PRON';
			continue;
		}
		// "s'il" is "si il".
		if (t.lw === "s'" && next && (next.lw === 'il' || next.lw === 'ils')) { t.tag = 'CONJ'; continue; }

		// "tout est là", "certains pensent": the determiner is the subject.
		if (prev && DET_AS_PRON.has(prev.lw) && prev.tag === 'DET' && isVerbal(t) && (known || /(ent|ait|aient)$/.test(t.lw))) {
			prev.tag = 'PRON';
		}
		// "le dîner", "un sourire", "la journée", "l'été": after an article a
		// verb form is a noun — or, a participle with a noun after it, an
		// adjective ("les volets fermés" goes through the rule further down).
		else if (prev && prev.tag === 'DET' && isVerbal(t)) {
			t.tag = (PP_SHAPE.test(t.lw) && next && next.tag === 'NOUN') ? 'ADJ' : 'NOUN';
		}
		// "un rien", "une personne", "un ton", "le son".
		if (prev && prev.tag === 'DET' && (t.lw === 'personne' || t.lw === 'rien' || t.tag === 'DET') &&
			(!next || next.tag !== 'NOUN')) t.tag = 'NOUN';
		// "dévoilant son tatouage", "savourant le plaisir": a present
		// participle doing a verb's work, with its object after it.
		if (t.tag === 'ADJ' && !known && /ant$/.test(t.lw) && next && near(t, next) &&
			(next.tag === 'DET' || next.tag === 'PRON' || next.tag === 'ADV')) t.tag = 'VERB';
		// "se dirigea", "s'arrêta", "me retourne": nothing but a verb follows
		// a reflexive pronoun.
		if ((t.tag === 'NOUN' || t.tag === 'ADJ') && !known && prev && /^(se|s'|me|m'|te|t')$/.test(prev.lw)) t.tag = 'VERB';

		// "en marchant": the gerund.
		if (prev && prev.lw === 'en' && /ant$/.test(t.lw) && !known) t.tag = 'VERB';

		// After an auxiliary or a modal, past any adverbs, a participle- or
		// infinitive-shaped word is the verb: "il a souri", "elle avait
		// compris", "je dois descendre".
		if ((t.tag === 'NOUN' || t.tag === 'ADJ') && !known) {
			let k = i - 1;
			while (k >= 0 && tokens[k].tag === 'ADV') k--;
			const head = k >= 0 ? tokens[k] : null;
			// Only a modal takes an infinitive: "était familier" is no verb.
			if (head && (head.tag === 'AUX' || head.tag === 'MOD') &&
				(PP_SHAPE_WIDE.test(t.lw) || (head.tag === 'MOD' && /(er|ir|re|oir)$/.test(t.lw))) &&
				!(LINKING.has(head.lw) && !PP_SHAPE.test(t.lw) && t.tag === 'ADJ')) {
				t.tag = 'VERB';
			}
		}
		// A subject, maybe a pronoun or two, then a word the lexicon does not
		// know: that is the verb ("il regarde", "elle nous attend", "qui
		// sourit"). "nous" and "vous" are subjects too ("nous marchions").
		if ((t.tag === 'NOUN' || t.tag === 'ADJ') && !known && subjectBefore(tokens, i)) {
			t.tag = 'VERB';
		}
		// "ne regarde", "n'oublie".
		if ((t.tag === 'NOUN' || t.tag === 'ADJ') && !known && prev && (prev.lw === 'ne' || prev.lw === "n'")) {
			t.tag = 'VERB';
		}

		// A degree adverb grades a quality: "très calme", "si sombre".
		if (t.tag === 'NOUN' && weak && prev && DEGREE.has(prev.lw) && (!next || next.tag !== 'NOUN')) {
			t.tag = 'ADJ';
		}
		// "un peu trop enjoué", "très fatigué": a graded participle describes.
		if (t.tag === 'VERB' && !known && PP_SHAPE.test(t.lw) && prev && DEGREE.has(prev.lw)) t.tag = 'ADJ';
		// "il était familier", "un geste coutumier".
		if (t.tag === 'NOUN' && !known && /(ier|ière)s?$/.test(t.lw) && prev && (LINKING.has(prev.lw) || DEGREE.has(prev.lw))) t.tag = 'ADJ';
		// "il est calme", "elle semblait lasse": a description after être
		// and the linking verbs, unless a noun follows to claim it.
		if (t.tag === 'NOUN' && weak && prev && LINKING.has(prev.lw) &&
			(!next || (next.tag !== 'NOUN' && next.tag !== 'DET'))) {
			t.tag = 'ADJ';
		}
		// French adjectives mostly follow their noun: "une porte rouge". But
		// a word with an article or "que" after it is the noun's verb: "le
		// chapitre montre que", "la femme regarde la mer". A capital is a
		// name ("la maison Dupont") and stays a noun.
		if (t.tag === 'NOUN' && weak && prev && prev.tag === 'NOUN' && !/^\p{Lu}/u.test(t.w)) {
			t.tag = next && near(t, next) && (next.tag === 'DET' || next.lw === 'que' || next.lw === "qu'") ? 'VERB' : 'ADJ';
		}
		// "les volets fermés", "une voix brisée": a participle straight after
		// its noun describes it.
		if (t.tag === 'VERB' && !known && PP_SHAPE.test(t.lw) && prev && prev.tag === 'NOUN') {
			t.tag = 'ADJ';
		}
		// "calme et sombre": coordination copies the part of speech.
		if (t.tag === 'NOUN' && weak && prev && (prev.lw === 'et' || prev.lw === 'ou') &&
			i >= 2 && tokens[i - 2].tag === 'ADJ' && (!next || next.tag !== 'NOUN')) {
			t.tag = 'ADJ';
		}
		// "le journal", "le principal": an adjective after an article with no
		// noun to follow is carrying the noun slot.
		if (t.tag === 'ADJ' && prev && prev.tag === 'DET' && (!next || (next.tag !== 'NOUN' && next.tag !== 'ADJ'))) {
			t.tag = 'NOUN';
		}
		// "si calme": the adverb, not the conjunction.
		if (t.lw === 'si' && next && next.tag === 'ADJ') t.tag = 'ADV';
		// Imperatives with their own ending: "Regardez la mer", "Partons".
		if (t.first && t.tag === 'NOUN' && !known && /(ez|ons)$/.test(t.lw) && (!next || next.tag === 'DET' || next.tag === 'PRON')) {
			t.tag = 'VERB';
		}
	}
	return tokens;
}

// ── Filler ──────────────────────────────────────────────────────────────────

const FILLER_STRONG = new Set(words(`très vraiment assez plutôt extrêmement incroyablement
	absolument totalement complètement littéralement réellement véritablement
	fondamentalement essentiellement pratiquement virtuellement apparemment
	visiblement manifestement évidemment certainement sûrement probablement
	peut-être carrément franchement honnêtement simplement tellement vachement
	finalement effectivement clairement particulièrement terriblement
	énormément parfaitement entièrement purement`));

const FILLER_SOFT = new Set(words(`presque environ approximativement plusieurs divers
	diverses nombreux nombreuses beaucoup souvent parfois fréquemment généralement
	habituellement relativement considérablement légèrement globalement largement
	principalement partiellement rarement quelques certains certaines juste
	seulement`));

// Phrases match on letters, not \b: \b is ASCII, and "à vrai dire" starts
// with a letter it does not count. No lookbehind either (refused by older
// iOS), so the left edge is checked by hand in findFillerPhrases.
const FILLER_PHRASE_LIST = [
	"en quelque sorte", "une sorte de", "une espèce de", "un peu", "un petit peu",
	"pas mal de", "en fait", "au final", "en fin de compte", "au bout du compte",
	"à vrai dire", "pour ainsi dire", "tout à fait", "plus ou moins",
	"dans une certaine mesure", "d'une certaine manière", "d'une certaine façon",
	"à mon avis", "je pense que", "je crois que", "il semble que", "il semblerait que",
	"il est important de noter que", "il convient de noter que", "il faut dire que",
	"force est de constater que", "le fait que", "du fait que", "en termes de",
	"au niveau de", "par rapport à", "en ce qui concerne", "en effet", "sans doute",
	"bien sûr", "quelque part", "la plupart", "de toute façon", "en tout cas",
];
const FILLER_PHRASES = new RegExp('(' + FILLER_PHRASE_LIST
	.sort((a, b) => b.length - a.length)
	.map((p) => p.replace(/'/g, "['\u2019]").replace(/ /g, '\\s+'))
	.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');

function findFillerPhrases(text: string) {
	const hits: WsSpan[] = [];
	FILLER_PHRASES.lastIndex = 0;
	let m;
	while ((m = FILLER_PHRASES.exec(text))) {
		const before = m.index > 0 ? text.charAt(m.index - 1) : '';
		if (before && /[\p{L}\p{N}]/u.test(before)) continue;
		hits.push({ from: m.index, to: m.index + m[0].length });
	}
	return hits;
}

// ── Passive voice ────────────────────────────────────────────────────────────

const BE_FORMS = new Set(words(`suis es est sommes êtes sont étais était étions étiez
	étaient serai seras sera serons serez seront serais serait serions seriez
	seraient fus fut fûmes fûtes furent sois soit soyons soyez soient fût être
	été étant`));
const AVOIR = new Set(words(`ai as a avons avez ont avais avait avions aviez avaient
	aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient
	eus eut eurent aie aies ait ayons ayez aient avoir ayant`));

// Verbs that take être in the compound tenses: "elle est partie" is active.
const ETRE_VERBS = new Set<string>();
for (const stem of words(`allé venu parti arrivé né mort resté tombé entré sorti
	monté descendu devenu retourné revenu rentré parvenu intervenu survenu décédé
	apparu demeuré passé redevenu reparti ressorti remonté redescendu`)) {
	const base = stem.replace(/(e)?$/, '');
	for (const end of ['', 'e', 's', 'es']) ETRE_VERBS.add(base + end);
}

// States more than actions: "je suis fatigué", "elle était surprise". An
// agent ("surprise par la nouvelle") flags them again.
const STATES = new Set<string>();
for (const stem of words(`fatigué épuisé étonné surpris désolé décidé habillé marié
	fiancé préoccupé occupé pressé intéressé passionné énervé agacé fâché vexé gêné
	embarrassé paniqué terrifié effrayé stressé déçu ravi enchanté soulagé satisfait
	persuadé convaincu assis couché allongé situé placé installé fini perdu
	inquiété étendu penché agenouillé accroupi appuyé adossé assoupi endormi
	réveillé`)) {
	const base = stem.replace(/(e)?$/, '');
	for (const end of ['', 'e', 's', 'es']) STATES.add(base + end);
}

const IRREGULAR_PP = new Set(words(`fait faite faits faites dit dite dits dites pris
	prise prises mis mise mises écrit écrite écrits écrites construit construite
	construits construites détruit détruite détruits produit produite conduit
	conduite traduit traduite ouvert ouverte ouverts ouvertes offert offerte
	couvert couverte couverts couvertes découvert découverte souffert peint peinte
	craint crainte atteint atteinte éteint éteinte joint jointe vu vue vus vues su
	sue lu lue lus lues bu bue cru crue connu connue connus connues reconnu reconnue
	reçu reçue reçus reçues aperçu aperçue vendu vendue rendu rendue perdu perdue
	entendu entendue attendu attendue défendu défendue battu battue mordu mordue
	tenu tenue retenu retenue obtenu obtenue soutenu soutenue vaincu vaincue
	convaincu convaincue résolu résolue acquis acquise conquis conquise exclu
	exclue inclus incluse surpris surprise compris comprise`));

const NOT_PP = new Set(words(`été côté café thé blé clé pré gré ici parmi ami amie
	amis lui tu nu nue fou`));

function isParticiple(t: WsToken) {
	const lw = t.lw;
	if (NOT_PP.has(lw)) return false;
	if (IRREGULAR_PP.has(lw)) return true;
	if (t.tag !== 'VERB' && t.tag !== 'ADJ' && t.tag !== 'NOUN') return false;
	if (lw.length > 3 && PP_SHAPE.test(lw)) return true;
	return lw.length > 3 && t.tag === 'VERB' && PP_SHAPE_WIDE.test(lw) && !/(ait|it)$/.test(lw);
}

const SKIP_IN_PASSIVE = new Set(words(`ne n' pas plus jamais toujours déjà souvent bien
	très tout rien encore aussi vite parfois`));

function findPassive(tokens: WsToken[]) {
	const hits: WsSpan[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (!BE_FORMS.has(tokens[i].lw)) continue;
		// "elle s'est levée", "nous nous sommes vus": reflexive, not passive.
		const p = i > 0 ? tokens[i - 1].lw : '';
		if (/^(me|m'|te|t'|se|s')$/.test(p)) continue;
		if ((p === 'nous' || p === 'vous') && i > 1 && tokens[i - 2].lw === p) continue;
		let j = i + 1, hops = 0, viaEte = tokens[i].lw === 'été';
		while (j < tokens.length && hops < 4 &&
			(SKIP_IN_PASSIVE.has(tokens[j].lw) || tokens[j].tag === 'ADV' || tokens[j].lw === 'été')) {
			if (tokens[j].lw === 'été') viaEte = true;
			j++; hops++;
		}
		if (j >= tokens.length) continue;
		const pp = tokens[j];
		if (!isParticiple(pp) || ETRE_VERBS.has(pp.lw)) { continue; }
		const nxt = j + 1 < tokens.length ? tokens[j + 1] : null;
		// A state reads as a description; only an agent (or "a été") flags it.
		if (STATES.has(pp.lw) && !viaEte && !(nxt && nxt.lw === 'par')) { i = j; continue; }
		// "il a été vu": the span starts at avoir.
		let start = tokens[i].from;
		if (tokens[i].lw === 'été' && i > 0 && AVOIR.has(tokens[i - 1].lw)) start = tokens[i - 1].from;
		hits.push({ from: start, to: pp.to });
		i = j;
	}
	return hits;
}

// ── Commonly confused ───────────────────────────────────────────────────────

const MISUSED_ALWAYS = new Set(words(`parmis malgrés language dilemne aréoport infractus
	rénumérer rénumération pécunier connection addresse apparement notament biensur
	aprés quelques-fois ceuillir comme-même`));

const SUBJ_SING = new Set(['il', 'elle', 'on']);
// Nouns whose singular ends in -s or -x: "leur fils" is singular.
const INVARIABLE = new Set(words(`fils temps corps bras dos pays bois fois voix prix
	poids repas souris avis choix mois os gars fonds propos cours discours secours
	parcours remords procès succès accès excès progrès palais marais relais biais
	univers vers travers puits paradis tapis colis bas pas cas matelas débris
	héros taux faux croix paix noix toux époux nez`));
// "sa va", "sa fait rien" — the verbs that give "ça" away after "sa".
const SA_VERBS = new Set(words(`va fait suffit marche sert dépend arrive recommence ira
	allait irait faisait suffisait`));
// Nouns that are also verbs, so "ça porte malheur" is not "sa porte".
const CA_VERBS = new Set(words(`fait va suffit porte reste part sort marche compte
	dépend change passe tourne monte sonne`));

const PLURAL_SUBJ = new Set(['ils', 'elles']);

function findMisused(tokens: WsToken[]) {
	const hits: WsSpan[] = [];
	const flag = (a: WsToken, b?: WsToken | null) => hits.push({ from: a.from, to: (b || a).to });
	for (let i = 0; i < tokens.length; i++) {
		const t  = tokens[i];
		const lw = t.lw;
		if (MISUSED_ALWAYS.has(lw)) { flag(t); continue; }
		// A pair rule reads two words as one phrase; a comma or a full stop
		// between them ("il était là, homme parmi les hommes") breaks it, so
		// a neighbour counts only when it touches the word.
		const before = i > 0 ? tokens[i - 1] : null;
		const after  = i + 1 < tokens.length ? tokens[i + 1] : null;
		const p  = before && near(before, t) ? before : null;
		const n  = after && near(t, after) ? after : null;
		const nl = n ? n.lw : '', pl = p ? p.lw : '';

		switch (lw) {
			// "il à mangé" — the preposition where the verb belongs.
			case 'à':
				if (p && (SUBJ_SING.has(pl) || pl === 'qui') && n && (n.tag === 'VERB' || n.tag === 'ADJ') && PP_SHAPE_WIDE.test(nl)) flag(t);
				break;
			// "il mange a la cantine", "commence a pleurer" — the verb where
			// the preposition belongs: a verb before, an article or an
			// infinitive after.
			case 'a':
				if (p && p.tag === 'VERB' && n && (n.tag === 'DET' || (n.tag === 'VERB' && /(er|ir|re)$/.test(nl)))) flag(t);
				break;
			// "d'ou", "là ou" — "où" in any case; "le jour ou il" only with a
			// clause after it, so "un jour ou l'autre" and "le jour ou la
			// nuit" stay clear.
			case 'ou':
				if (/^(d'|là|par|jusqu')$/.test(pl) ||
					(n && (SUBJECTS.has(nl) || nl === "c'") && p && p.tag === 'NOUN')) flag(t);
				break;
			// "il et parti" — "est".
			case 'et':
				if (p && (SUBJ_SING.has(pl) || pl === "c'" || pl === 'qui') && n && n.tag !== 'PRON') flag(t);
				break;
			// "il ses trompé", "elle ces levée" — "s'est", "c'est".
			case 'ses': case 'ces':
				if (p && (SUBJ_SING.has(pl) || PLURAL_SUBJ.has(pl))) flag(t);
				break;
			// "ils son partis" — "sont"; "à sont avis" — "son". Nothing
			// follows "ils" but a verb or a pronoun, so "ils son" is wrong
			// whatever comes next.
			case 'son':
				if (p && (PLURAL_SUBJ.has(pl) || (pl === 'qui' && n && n.tag !== 'NOUN'))) flag(t);
				break;
			// "Quels sont tes projets ?" is right.
			case 'sont':
				if (p && (p.tag === 'PREP' || p.tag === 'DET') && !/^quel(le)?s?$/.test(pl)) flag(t);
				break;
			// "ils on dit" — "ont"; "on" after a plural subject.
			case 'on':
				if (p && PLURAL_SUBJ.has(pl)) flag(t);
				break;
			// "ont dit que…" opening a sentence, or "ont" after a preposition;
			// "les enfants en ont assez" is right.
			case 'ont':
				if (t.first || (p && p.tag === 'PREP' && pl !== 'en' && pl !== 'y')) flag(t);
				break;
			// "il ce lève" — "se".
			case 'ce':
				if (p && (SUBJ_SING.has(pl) || PLURAL_SUBJ.has(pl) || pl === 'je')) flag(t);
				break;
			// "à se moment" — "ce": a known noun after it, no subject before.
			case 'se':
				if (n && LEX[nl] === 'NOUN' && !/(er|ir|re|oir)$/.test(nl) && !CA_VERBS.has(nl) &&
					p && p.tag !== 'PRON' && pl !== 'ne' && pl !== "n'") flag(t);
				break;
			// "là maison" — "la".
			case 'là':
				if (n && LEX[nl] === 'NOUN') flag(t);
				break;
			// "quand à moi" — "quant".
			case 'quand':
				if (/^(à|au|aux)$/.test(nl)) flag(t, n);
				break;
			case 'quant':
				if (!/^(à|au|aux)$/.test(nl)) flag(t);
				break;
			// "leur enfants" — "leurs"; "je leurs dis" — "leur".
			case 'leur':
				if (n && n.tag === 'NOUN' && /[sx]$/.test(nl) && !/(ss|us)$/.test(nl) && !INVARIABLE.has(nl)) flag(t, n);
				break;
			// "je leurs dis": after a subject it is the pronoun, never plural.
			case 'leurs':
				if ((n && isVerbal(n)) || (p && p.tag === 'PRON' && SUBJECTS.has(pl))) flag(t);
				break;
			// "un peut" — "peu"; "il peu venir" — "peut".
			case 'peut':
				if (/^(un|très|trop|si|à)$/.test(pl)) flag(t);
				break;
			case 'peu':
				if (p && SUBJ_SING.has(pl)) flag(t);
				break;
			// "sa va" — "ça".
			case 'sa':
				if (n && (n.tag === 'AUX' || n.tag === 'MOD' || SA_VERBS.has(nl))) flag(t);
				break;
			// "ça maison" — "sa".
			case 'ça':
				if (n && LEX[nl] === 'NOUN' && !CA_VERBS.has(nl)) flag(t);
				break;
			// "si j'aurais su" — "si j'avais".
			case 'si': case "s'": {
				// Only opening a clause: "je me demande si elle viendrait"
				// is a correct indirect question.
				if (!(t.first || /^(et|mais|même)$/.test(pl))) break;
				let k = i + 1;
				if (k < tokens.length && SUBJECTS.has(tokens[k].lw)) k++;
				const v = k < tokens.length ? tokens[k] : null;
				if (k > i + 1 && v && /(rais|rait|rions|riez|raient)$/.test(v.lw)) flag(t, v);
				break;
			}
			// "se rappeler de quelque chose".
			case 'de': case "d'": case 'du': case 'des':
				if (p && /^rappel/.test(pl) && n && n.tag !== 'VERB') flag(p, t);
				if (p && /^pallie/.test(pl)) flag(p, t);
				break;
			// "voire même", "comme même", "quelque soit".
			case 'même':
				if (pl === 'voire' || pl === 'comme') flag(p as WsToken, t);
				break;
			case 'soit': case 'soient':
				if (pl === 'quelque' || pl === 'quelques') flag(p as WsToken, t);
				break;
		}
		// "pallier à" — after the switch, so the "à" case above stays clean.
		if ((lw === 'à' || lw === 'au' || lw === 'aux') && p && /^pallie/.test(pl)) flag(p, t);
	}
	return hits;
}

// ── Loose pronouns ───────────────────────────────────────────────────────────

// "Cela", "Ça", "Ce" and "Ils"/"Elles" opening a sentence point back at the
// sentence before, the way "This", "It" and "They" do. "Il" and "Elle" stay
// out: in French they are as often a character as a thing, and gender
// usually settles which.
const VAGUE = new Set(words(`ce c' cela ça ceci ils elles celui-ci celle-ci ceux-ci celles-ci`));

function isVaguePronoun(t: WsToken, next: WsToken | null | undefined) {
	if (!t.first || !VAGUE.has(t.lw)) return false;
	if (t.lw === 'ce' && next && (next.tag === 'NOUN' || next.tag === 'ADJ' || next.tag === 'NUM')) return false;
	return true;
}

// ── Repetition and the Report ────────────────────────────────────────────────

const REPORT_STOPWORDS = new Set(words(`le la les l' un une des du de d' au aux à et ou
	mais donc or ni car que qu' qui quoi dont ce cet cette ces c' ça cela ceci mon
	ma mes ton ta tes son sa ses notre nos votre vos leur leurs je j' tu il elle
	on nous vous ils elles me m' te t' se s' moi toi lui eux soi y en ne n' pas
	plus est sont était étaient être été a ai as avons avez ont avait avaient
	avoir eu dans par pour sur sous avec sans chez vers entre si comme quand
	lorsque lorsqu' puisque puisqu' tout toute tous toutes même aussi très bien
	celui celle ceux celles quel quelle quels quelles jusqu'`));

const REPETITION_STOPWORDS = new Set([...REPORT_STOPWORDS, ...words(`fait faire dit dire
	va aller voir vu peut pouvait encore alors après avant comme rien autre autres
	quelque quelques chose choses moment fois toujours jamais encore ainsi puis
	avait était aurait serait avaient étaient pourquoi comment depuis pendant
	contre devant derrière lorsque parce`)]);

const FR_REPETITION = {
	stopwords: REPETITION_STOPWORDS,
	normalize: (lw: string) => lw.replace(/[^\p{L}']/gu, ''),
	// Crude, like the English one: "regardait" echoes "regarder", "lentes"
	// echoes "lente".
	stem: (w: string) => w.replace(/(issements|issement|ements|ement|ations|ation|euses|euse|eux|aient|ait|ais|ant|ées|ée|és|é|er|es|e|s|x)$/, ''),
};

// "nous nous sommes vus", "vous vous trompez": grammar, not a slip.
const DOUBLES = new Set(['nous', 'vous']);

// ── Dialogue ────────────────────────────────────────────────────────────────

// A reply opened by a dash ("— À demain, Johan.") runs to the end of the
// line, less its incises: the narrator's "dit-il" or "soupira Johan" in the
// middle of a reply is not dialogue, and marking it as such paints the whole
// paragraph. French sets no dash around an incise, as Spanish does, so the
// default reading cannot find them.
// An incise is a verb of saying after a comma, a question or exclamation mark
// or an ellipsis, with its subject after it: inverted ("dit-il",
// "répondit-elle", "lança-t-il"), or a name, a pronoun or a possessive
// ("s'enquit Lucie", "répondit sa mère"). Third person only: in
// "reconnaissez-vous ce tatouage ?" the speaker is asking. The incise runs to
// the next comma or the end of its sentence, and the speech goes on after it
// ("coupa-t-il. Ça va marcher."). What follows the comma may still be the
// narrator's: a word or two ("soupira-t-il, essoufflé."), a participle
// ("dit la sœur, osant à peine…"), "comme…", "puis…".
const DIALOGUE_INCISE = /[,?!\u2026][\s\u00a0\u202f]+((?:[sml]['\u2019])?(\p{Ll}+)(?:(?:-t)?-(?:il|elle|on|ils|elles)(?![\p{L}])|[\s\u00a0]+(?:\p{Lu}|(?:il|elle|on|ils|elles|sa|son|ses|leur|leurs|le|la|les|l['\u2019]|un|une)[\s\u00a0])))/gu;
// What the narrator says after an incise's comma, about the speaker rather
// than for them: "dit-il, comme se parlant à lui-même", "en souriant".
const NARRATION_GOES_ON = /^(comme|tout en|en \p{L}+ant|(?!(?:maint|av|pend|cepend|dev|dur|aut|t|qu)ant)\p{L}+ant|avec|sans|d'un|d'une|l'air|les yeux|la voix|le regard|puis)(?![\p{L}'])/iu;
// A word or two, and the end of the line: what is left after an incise's comma
// when the narrator has not handed back to the speaker.
const DIALOGUE_TAIL = /^\S+(?:[\s\u00a0\u202f]+\S+)?[\s\u00a0\u202f]*$/u;
// Words that open the same shape without being a verb of saying: "— Oui,
// mais la porte…", "— Bon, comme la dernière fois".
const NOT_INCISE = new Set(`mais et ou donc car or ni puis alors comme que quand si
	pour avec sans dans sur sous chez vers voici voilà encore toujours même aussi
	enfin bref oui non bon ben bien tant parce lorsque puisque après avant pendant
	depuis entre contre ensuite surtout peut-être`.split(/\s+/).filter(Boolean));
// The incise's verb ends as French third persons do: dit, répondit, lança,
// murmura, souffle, demandait, s'écrièrent.
const SAYING_END = /(a|it|ut|int|ait|e|èrent|irent|urent)$/;

function dialogue(text: string, start: number) {
	const out: WsSpan[] = [];
	const trimEnd = (to: number) => trimSpanEnd(text, to);
	let from = start;
	DIALOGUE_INCISE.lastIndex = from;
	let m;
	while ((m = DIALOGUE_INCISE.exec(text))) {
		const verb = m[2].toLowerCase();
		const at = m.index + m[0].length - m[1].length;
		const end = /[,.!?\u2026]/.exec(text.slice(at + m[1].indexOf(m[2]) + m[2].length));
		// "— Bon, vient-il ?" asks, and "— Oui, mais la porte…" goes on: neither is an incise.
		// An auxiliary is no verb of saying: "un père de famille, a ses fils".
		const aux = LEX[verb] === 'AUX' || LEX[verb] === 'MOD';
		if (NOT_INCISE.has(verb) || aux || verb.length < 3 || (!/-/.test(m[1]) && !SAYING_END.test(verb)) || (end && end[0] === '?')) {
			DIALOGUE_INCISE.lastIndex = m.index + 1;
			continue;
		}
		const to = trimEnd(at);
		if (to > from) out.push({ from, to });
		if (!end) return out;
		from = at + m[1].indexOf(m[2]) + m[2].length + end.index + 1;
		while (from < text.length && DIALOGUE_SPACE.test(text.charAt(from))) from++;
		// After the incise's comma, a word or two, a participle or "comme…"
		// still describe the speaker. After its full stop the speaker goes
		// on: "coupa-t-il, vibrant. Ça va marcher."
		const rest = text.slice(from);
		if (end[0] === ',' && DIALOGUE_TAIL.test(rest)) return out;
		if (end[0] === ',' && NARRATION_GOES_ON.test(rest)) {
			// the narrator's to the end of that sentence, the speaker's after it
			const stop = /[.!\u2026]/.exec(rest);
			if (!stop) return out;
			from += stop.index + 1;
			while (from < text.length && DIALOGUE_SPACE.test(text.charAt(from))) from++;
		}
		DIALOGUE_INCISE.lastIndex = from;
	}
	const to = trimEnd(text.length);
	if (to > from) out.push({ from, to });
	return out;
}

// ── Readability ──────────────────────────────────────────────────────────────

// Spoken syllables, roughly: vowel groups, with a mute final e, and an
// accented vowel opening a syllable of its own ("ré-a-li-ser", "na-ïf").
function countSyllables(word: string) {
	let w = String(word).toLowerCase().replace(/[^\p{L}]/gu, '');
	if (!w) {
		const d = String(word).replace(/[^0-9]/g, '').length;
		return d ? Math.min(6, d + 1) : 0;
	}
	if (w.length <= 3) return 1;
	// The mute e: "heureuse", "pensées", "idée".
	w = w.replace(/([^aeiouyàâäèêëîïôöûùüœæ]|é)(e|es)$/, '$1');
	let n = 0;
	for (const g of w.match(/[aeiouyàâäéèêëîïôöûùüœæ]+/g) || []) {
		// "aéroport", "naïf", "réunion": an accent inside a vowel group opens
		// a syllable of its own, and so does an é that a vowel follows.
		n += 1 + (g.slice(1).match(/[éïëüöä]/g) || []).length + (g.length > 1 && g[0] === 'é' ? 1 : 0);
	}
	return Math.max(1, n);
}

// Kandel & Moles (1958): Flesch's reading ease refitted to French.
// 100 reads like a children's book, 0 like a legal text.
function kandelMoles(words: number, sentences: number, syllables: number) {
	return 207 - 1.015 * (words / sentences) - 73.6 * (syllables / words);
}

// The rhythm thresholds are US grades, so the ease score goes onto that
// scale through Flesch's own table: 90+ is grade 5, 60–70 grade 8–9, 50–60
// grade 10–12, 30–50 college, under 30 graduate. Piecewise, matched at the
// joins, so a sentence never jumps a grade at a boundary.
function grade(words: number, sentences: number, syllables: number) {
	if (!words || !sentences) return 0;
	const re = kandelMoles(words, sentences, syllables);
	if (re >= 60) return (100 - re) / 10 + 4.5;
	if (re >= 50) return 8.5 + (60 - re) * 0.35;
	if (re >= 30) return 12 + (50 - re) * 0.2;
	return 16 + (30 - re) * 0.1;
}

export const LANG_FR: WsLanguage = {
	code: 'fr',
	name: 'Français',
	tokenize,
	tag,
	fillerStrong: FILLER_STRONG,
	fillerSoft: FILLER_SOFT,
	findFillerPhrases,
	findPassive,
	findMisused,
	// Only with nothing but a space between: "Je… je suis", "Oui, oui" and
	// "sur elle, elle" are a voice, not a slip.
	findIllusions: (tokens) => findIllusionsWith(tokens, DOUBLES).filter((h) => {
		const i = tokens.findIndex((t) => t.from === h.from);
		return i >= 0 && i + 1 < tokens.length && near(tokens[i], tokens[i + 1]);
	}),
	isVaguePronoun,
	findRepetitions: (tokens, windowSize, minLength) => findRepetitionsWith(tokens, windowSize, minLength, FR_REPETITION),
	reportStopwords: REPORT_STOPWORDS,
	splitWord: frSplitElision,
	splitSentences: (text) => splitSentencesWith(text, ABBREVIATIONS),
	countSyllables,
	grade,
	markers: new Set(words(`le les des du et est une dans pas ne qui sur avec au aux
		ce cette mais nous vous était avait sont ont été être leur je il elle ils
		elles l' d' qu'`)),
	names: ['french', 'français', 'francais', 'française', 'francaise'],
	dialogue,
};
