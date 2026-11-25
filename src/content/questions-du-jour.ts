// Questions du jour de l'espace « Nous deux ».
// Une question par jour, choisie de façon déterministe à partir de la date
// (les deux parents voient donc la même question le même jour).

export type QuestionTheme = "legere" | "profonde" | "drole" | "souvenir" | "projet";

export interface DailyQuestion {
  theme: QuestionTheme;
  text: string;
}

export const THEME_LABELS: Record<QuestionTheme, { label: string; emoji: string }> = {
  legere: { label: "Légère", emoji: "🌸" },
  profonde: { label: "Profonde", emoji: "🌊" },
  drole: { label: "Pour rire", emoji: "😜" },
  souvenir: { label: "Souvenir", emoji: "📼" },
  projet: { label: "Projet", emoji: "🧭" },
};

const LEGERES = [
  "Quel petit plaisir t'a fait du bien aujourd'hui ?",
  "Si on avait une soirée rien qu'à nous ce soir, tu voudrais faire quoi ?",
  "Quelle chanson tu aimerais qu'on écoute ensemble en ce moment ?",
  "Quel plat tu aimerais que je te cuisine (ou que je commande 😇) cette semaine ?",
  "Quel est le moment de la journée où tu te sens le mieux ?",
  "Café au lit, petit-déj en terrasse ou grasse matinée sans rien : tu choisis quoi dimanche ?",
  "Quelle série ou quel film tu aimerais qu'on commence ensemble ?",
  "Quelle odeur te met instantanément de bonne humeur ?",
  "Si tu pouvais te téléporter quelque part pour une heure, là maintenant, ce serait où ?",
  "Quel est ton goûter idéal ?",
  "Quelle saison nous ressemble le plus, à toi et moi ?",
  "Quel objet de la maison tu sauverais en premier en cas d'inondation (à part nous) ?",
  "Quel compliment tu aimerais entendre plus souvent ?",
  "Quel est ton endroit préféré à Bordeaux ?",
  "Plutôt soirée jeux de société ou soirée ciné sous le plaid ?",
  "Quelle est la dernière chose qui t'a fait sourire bêtement ?",
  "Quel petit geste de ma part te fait toujours du bien ?",
  "Si notre semaine avait une couleur, ce serait laquelle ?",
  "Quel dessert tu pourrais manger tous les jours ?",
  "Quel métier tu aurais adoré faire juste pour un jour ?",
  "Tu préfères qu'on se fasse une balade au lever ou au coucher du soleil ?",
  "Qu'est-ce qui te détend le plus après une grosse journée ?",
  "Quel est ton mot préféré en ce moment ?",
  "Quel cadeau à moins de 10 € te ferait vraiment plaisir ?",
  "Quelle est la meilleure pizza du monde selon toi ? Défends ton choix.",
  "Quelle activité tu aimerais qu'on fasse à deux ce week-end, même 30 minutes ?",
  "Quel est le bruit qui t'apaise le plus ?",
  "Quel animal tu serais dans notre couple ? Et moi ?",
  "Si on ouvrait un petit commerce tous les deux, ce serait quoi ?",
  "Quel est ton rituel du matin préféré ?",
  "Quelle est la plus belle chose que tu as vue cette semaine ?",
  "Si tu pouvais maîtriser un instrument du jour au lendemain, lequel ?",
  "Quelle est ta boisson chaude idéale pour une soirée d'hiver ?",
  "Quelle tenue de moi tu préfères ?",
  "Qu'est-ce qui t'a rendu fier ou fière de toi récemment ?",
];

const PROFONDES = [
  "Qu'est-ce qui te fait te sentir le plus aimé·e par moi ?",
  "De quoi as-tu besoin en ce moment, que tu n'oses pas forcément demander ?",
  "Qu'est-ce que notre famille t'apprend sur toi-même ?",
  "Quelle qualité chez moi aimerais-tu que nos enfants héritent ?",
  "À quel moment t'es-tu senti·e le plus proche de moi ces derniers temps ?",
  "Qu'est-ce qui t'inquiète en ce moment, même un tout petit peu ?",
  "Qu'est-ce que tu aimerais qu'on fasse mieux, ensemble, cette année ?",
  "Quelle valeur est la plus importante pour toi dans notre façon d'élever Jules et Pia ?",
  "Qu'est-ce que tu as appris de nos disputes ?",
  "Quel rêve as-tu mis de côté et aimerais-tu réveiller ?",
  "Dans quelle situation te sens-tu vraiment toi-même ?",
  "Qu'est-ce qui, chez toi, a changé depuis qu'on est ensemble ?",
  "Quelle est la chose la plus courageuse que tu aies faite ?",
  "Comment je peux te soutenir un peu mieux au quotidien ?",
  "Qu'est-ce qui te donne de l'énergie, et qu'est-ce qui t'en prend ?",
  "Quel héritage de tes parents veux-tu garder, et lequel laisser ?",
  "Qu'est-ce que le mot « maison » évoque pour toi ?",
  "Quand est-ce que tu te sens le plus seul·e, même entouré·e ?",
  "Quelle peur aimerais-tu dépasser d'ici un an ?",
  "Qu'est-ce que tu admires le plus dans notre couple ?",
  "Si tu pouvais dire une chose à la personne que tu étais il y a dix ans, ce serait quoi ?",
  "Quelle petite chose je fais sans m'en rendre compte et qui compte pour toi ?",
  "Qu'est-ce qui te rend le plus fier ou fière dans notre vie de famille ?",
  "Comment aimerais-tu qu'on se souvienne de toi ?",
  "Qu'est-ce qui te manque de ta vie d'avant les enfants, et qu'est-ce qui ne te manque pas du tout ?",
  "Comment sais-tu que tu as besoin d'une pause ?",
  "Qu'est-ce que la confiance veut dire pour toi ?",
  "Quel moment difficile nous a rendus plus forts, selon toi ?",
  "Qu'est-ce que tu aimerais qu'on se promette pour les cinq prochaines années ?",
  "Qu'est-ce qui te fait te sentir en sécurité ?",
  "Quelle part de toi aimerais-tu que je connaisse mieux ?",
  "Quelle est ta définition d'une journée réussie ?",
  "Qu'est-ce qui te fait douter de toi, et qu'est-ce qui te rassure ?",
  "Qu'aimerais-tu que nos enfants disent de nous quand ils seront grands ?",
];

const DROLES = [
  "Si on était un duo de super-héros, quels seraient nos pouvoirs (et nos noms ridicules) ?",
  "Quelle est ma manie la plus agaçante… mais un peu mignonne quand même ?",
  "Si notre couple était un plat, ce serait lequel ?",
  "Quel acteur ou actrice jouerait mon rôle dans le film de notre vie ?",
  "Quelle chanson serait le générique de notre famille ?",
  "Si tu devais me décrire en trois emojis, lesquels ?",
  "Quel est le truc le plus bizarre que tu fais quand tu es seul·e à la maison ?",
  "Si on gagnait un voyage surprise demain, quelle destination te ferait paniquer ?",
  "Quelle émission de télé-réalité on gagnerait haut la main tous les deux ?",
  "Quel serait le titre de l'autobiographie de Pia à 3 ans ?",
  "Et celle de Jules ?",
  "Si nos enfants étaient des légumes, lesquels seraient-ils ?",
  "Quelle est la phrase que je dis le plus souvent, selon toi ?",
  "Si tu pouvais échanger ta vie avec moi pendant une journée, tu commencerais par quoi ?",
  "Quel objet du quotidien serait le plus drôle s'il pouvait parler ? Qu'est-ce qu'il dirait de nous ?",
  "Quelle est la pire coupe de cheveux que tu aies jamais eue ?",
  "Si on montait un groupe de musique, quel serait son nom ?",
  "Quel animal de compagnie absurde accepterais-tu d'adopter ?",
  "Qui de nous deux survivrait le plus longtemps sur une île déserte ? Argumente.",
  "Quel super-pouvoir inutile aimerais-tu avoir ?",
  "Si nos disputes avaient un arbitre, ce serait qui ?",
  "Quel est le mensonge le plus innocent que tu m'aies déjà raconté ?",
  "Quelle est la chose la plus étrange que tu aies mangée ?",
  "Quel slogan mettrait-on sur le t-shirt officiel de notre famille ?",
  "Si tu devais choisir une seule tenue pour le reste de ta vie, ce serait laquelle ?",
  "Quel est le pire cadeau que tu aies reçu ?",
  "Si nous étions des personnages de dessin animé, lesquels serions-nous ?",
  "Quelle est la chose la plus ridicule pour laquelle on s'est déjà disputés ?",
  "Quel talent caché tu aimerais révéler en public sans prévenir ?",
  "Si tu pouvais interdire un mot du vocabulaire de nos enfants, lequel ?",
  "Quelle est la danse que tu fais quand personne ne regarde ?",
  "Si on organisait les Jeux olympiques de la maison, quelles seraient les épreuves ?",
];

const SOUVENIRS = [
  "Quel est ton premier souvenir de moi ?",
  "Quel moment de notre premier rendez-vous te revient en premier ?",
  "Quel est ton plus beau souvenir de vacances avec moi ?",
  "Quel jour t'es-tu dit·e « c'est cette personne » ?",
  "Quel est ton souvenir préféré de la naissance de Jules ?",
  "Et de l'arrivée de Pia ?",
  "Quelle est la fois où on a le plus ri ensemble ?",
  "Quel repas partagé ensemble restera gravé ?",
  "Quel est ton souvenir d'enfance le plus doux ?",
  "Quel est le premier cadeau que je t'ai offert ? Tu t'en souviens ?",
  "Quelle galère vécue ensemble te fait rire aujourd'hui ?",
  "Quel est le premier message que tu te souviens m'avoir envoyé ?",
  "Quelle soirée avec nos amis te rend nostalgique ?",
  "Quel moment avec les enfants t'a fait fondre récemment ?",
  "Quel lieu de notre histoire aimerais-tu revisiter ?",
  "Quelle est la première fois où tu m'as vu·e pleurer ?",
  "Quel est le premier mot de Jules ou de Pia dont tu te souviens ?",
  "Quel est ton souvenir préféré de nos débuts dans notre premier logement ?",
  "Quelle photo de nous deux préfères-tu, et pourquoi ?",
  "Quel est le jour où tu as été le plus fier ou la plus fière de moi ?",
  "Quel Noël ou quelle fête de famille t'a le plus marqué·e ?",
  "Quelle surprise que je t'ai faite t'a le plus touché·e ?",
  "Quelle chanson te ramène directement à un moment avec moi ?",
  "Quelle est la plus grosse bêtise que tu aies faite enfant ?",
  "Quel est le moment où tu t'es senti·e vraiment parent pour la première fois ?",
  "Quel souvenir de nos voyages aimerais-tu raconter à nos petits-enfants ?",
  "Quel est le meilleur fou rire qu'on ait eu avec les enfants ?",
  "Quelle est la première chose que tu as remarquée chez moi ?",
  "Quelle journée banale avec moi est devenue un souvenir précieux ?",
  "Quel était ton jouet ou ton doudou préféré quand tu étais petit·e ?",
  "Quel est le moment de cette année que tu voudrais revivre ?",
  "Quelle dispute nous a finalement rapprochés ?",
];

const PROJETS = [
  "Quel voyage aimerais-tu qu'on fasse tous les quatre avant que Pia ait 10 ans ?",
  "Et un voyage rien qu'à deux : où et quand ?",
  "Quelle nouvelle tradition familiale aimerais-tu qu'on crée ?",
  "Comment imagines-tu notre vie dans dix ans ?",
  "Quelle compétence aimerais-tu qu'on apprenne ensemble ?",
  "Quelle pièce de la maison aimerais-tu transformer, et comment ?",
  "Quel petit projet on pourrait réaliser ensemble ce mois-ci ?",
  "À quoi ressemblerait notre week-end parfait en amoureux ?",
  "Quel défi sportif ou un peu fou on pourrait relever à deux ?",
  "Qu'aimerais-tu qu'on fasse différemment l'année prochaine ?",
  "Quelle activité aimerais-tu partager avec Jules quand il sera plus grand ?",
  "Et avec Pia ?",
  "Si on devait déménager n'importe où dans le monde, ce serait où ?",
  "Quel rituel du soir aimerais-tu qu'on mette en place, rien que nous deux ?",
  "Quel est le prochain resto ou la prochaine sortie qu'on doit absolument tester ?",
  "Comment aimerais-tu fêter nos prochaines années ensemble ?",
  "Qu'aimerais-tu qu'on économise pour s'offrir ?",
  "Quelle aventure aimerais-tu qu'on vive avant nos 60 ans ?",
  "Quelle habitude aimerais-tu qu'on adopte pour se sentir mieux ?",
  "Quel serait notre programme idéal pour une journée sans enfants ?",
  "Quelle fête aimerais-tu organiser à la maison ?",
  "Quel projet personnel aimerais-tu que je t'aide à concrétiser ?",
  "Comment aimerais-tu qu'on passe nos vieux jours ?",
  "Quelle activité en famille aimerais-tu qu'on fasse chaque saison ?",
  "Quelle chose un peu folle aimerais-tu qu'on fasse cette année ?",
  "Quelle région de France aimerais-tu faire découvrir aux enfants ?",
  "Qu'est-ce qu'on pourrait faire pour avoir plus de temps rien qu'à nous ?",
  "Quel souvenir aimerais-tu qu'on fabrique cet été ?",
  "Quel livre ou quel film aimerais-tu partager avec les enfants plus tard ?",
  "Si on avait une année sabbatique, on en ferait quoi ?",
  "Quel petit luxe aimerais-tu qu'on s'accorde plus souvent ?",
  "Quelle soirée surprise aimerais-tu que je t'organise ?",
];

function tag(theme: QuestionTheme, list: string[]): DailyQuestion[] {
  return list.map((text) => ({ theme, text }));
}

/** Toutes les questions, thèmes entremêlés pour varier d'un jour à l'autre. */
export const QUESTIONS_DU_JOUR: DailyQuestion[] = (() => {
  const groups = [
    tag("legere", LEGERES),
    tag("profonde", PROFONDES),
    tag("drole", DROLES),
    tag("souvenir", SOUVENIRS),
    tag("projet", PROJETS),
  ];
  const out: DailyQuestion[] = [];
  const max = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) for (const g of groups) if (g[i]) out.push(g[i]);
  return out;
})();

/** Nombre de jours depuis le 1er janvier 1970 pour une date YYYY-MM-DD. */
function dayNumber(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Question du jour pour une date (YYYY-MM-DD, heure de Paris).
 * Parcourt toute la liste avant de se répéter.
 */
export function questionForDate(dateISO: string): DailyQuestion {
  const n = QUESTIONS_DU_JOUR.length;
  const idx = ((dayNumber(dateISO) % n) + n) % n;
  return QUESTIONS_DU_JOUR[idx];
}
