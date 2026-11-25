// Les 36 questions pour se rapprocher.
// Inspirées de l'étude du psychologue Arthur Aron (1997) sur la proximité
// interpersonnelle : trois séries de douze questions, de plus en plus intimes.
// Reformulées librement, adaptées à un couple qui se connaît déjà.

import type { Question36 } from "./types";

const qs = (set: 1 | 2 | 3, n: number, text: string): Question36 => ({ key: `36q-${String(n).padStart(2, "0")}`, set, text });

export const QUESTIONS_36: readonly Question36[] = [
  // Série 1 : faire connaissance (encore)
  qs(1, 1, "Si tu pouvais partager un repas avec n'importe qui au monde, d'hier ou d'aujourd'hui, qui inviterais-tu ? Pourquoi cette personne ?"),
  qs(1, 2, "Est-ce que tu aimerais être célèbre ? Si oui, pour quoi aimerais-tu être connu·e ?"),
  qs(1, 3, "Avant de passer un coup de fil important, il t'arrive de préparer ce que tu vas dire ? Qu'est-ce qui te pousse à le faire ?"),
  qs(1, 4, "Décris ta journée parfaite, du réveil au coucher."),
  qs(1, 5, "À quand remonte la dernière fois que tu as chanté pour toi tout·e seul·e ? Et pour quelqu'un d'autre ?"),
  qs(1, 6, "Tu vivras jusqu'à 90 ans. Pour les soixante dernières années, tu peux garder soit le corps, soit l'esprit de tes 30 ans. Lequel choisis-tu ?"),
  qs(1, 7, "As-tu un pressentiment secret sur la façon dont ta vie se terminera ?"),
  qs(1, 8, "Cite trois choses que nous avons en commun, à ton avis."),
  qs(1, 9, "De quoi te sens-tu le plus reconnaissant·e dans ta vie ?"),
  qs(1, 10, "Si tu pouvais changer une seule chose à la façon dont tu as été élevé·e, ce serait laquelle ?"),
  qs(1, 11, "Raconte-moi l'histoire de ta vie, en prenant ton temps et avec le plus de détails possible."),
  qs(1, 12, "Si tu pouvais te réveiller demain avec une nouvelle qualité ou un nouveau talent, lequel choisirais-tu ?"),
  // Série 2 : aller un peu plus loin
  qs(2, 13, "Une boule de cristal peut te dire la vérité sur toi, ta vie, ton avenir ou n'importe quoi d'autre. Que voudrais-tu savoir ?"),
  qs(2, 14, "Y a-t-il quelque chose que tu rêves de faire depuis longtemps ? Qu'est-ce qui t'a retenu·e jusqu'ici ?"),
  qs(2, 15, "Quelle est la plus belle réussite de ta vie ?"),
  qs(2, 16, "Qu'est-ce qui compte le plus pour toi dans une amitié ?"),
  qs(2, 17, "Quel est ton souvenir le plus précieux ?"),
  qs(2, 18, "Quel est ton souvenir le plus difficile ?"),
  qs(2, 19, "Si tu apprenais que tu n'as plus qu'un an devant toi, changerais-tu quelque chose à ta façon de vivre ? Pourquoi ?"),
  qs(2, 20, "Que représente l'amitié pour toi ?"),
  qs(2, 21, "Quelle place l'amour et la tendresse occupent-ils dans ta vie ?"),
  qs(2, 22, "Cite cinq qualités que tu me trouves (et je ferai pareil de mon côté)."),
  qs(2, 23, "Dans ta famille, on était plutôt proches et chaleureux ? As-tu le sentiment d'avoir eu une enfance plus heureuse que la plupart des gens ?"),
  qs(2, 24, "Comment décrirais-tu ta relation avec ta mère aujourd'hui ?"),
  // Série 3 : se dévoiler
  qs(3, 25, "Écris trois phrases vraies qui commencent par « Nous… ». Par exemple : « Nous sommes tous les deux en train de… »"),
  qs(3, 26, "Complète cette phrase : « J'aimerais avoir quelqu'un avec qui partager… »"),
  qs(3, 27, "Pour que nous soyons encore plus proches, qu'est-ce qui serait important que je sache sur toi ?"),
  qs(3, 28, "Dis-moi ce que tu aimes chez moi, en toute sincérité, y compris ce que tu ne dis jamais à voix haute."),
  qs(3, 29, "Raconte-moi un moment vraiment gênant de ta vie."),
  qs(3, 30, "À quand remonte la dernière fois que tu as pleuré devant quelqu'un ? Et tout·e seul·e ?"),
  qs(3, 31, "Dis-moi une chose que tu aimes chez moi depuis le tout premier jour."),
  qs(3, 32, "Y a-t-il un sujet trop sérieux pour qu'on en plaisante, selon toi ?"),
  qs(3, 33, "Si tu devais partir ce soir sans pouvoir parler à personne, que regretterais-tu le plus de ne pas avoir dit ? Pourquoi ne pas l'avoir encore fait ?"),
  qs(3, 34, "La maison brûle. Une fois tout le monde à l'abri, tu as le temps de sauver un seul objet. Lequel, et pourquoi ?"),
  qs(3, 35, "Quelle personne de ta famille te manquerait le plus si elle n'était plus là ? Pourquoi elle ?"),
  qs(3, 36, "Confie-moi un souci personnel et demande-moi comment je m'y prendrais à ta place. Puis dis-moi ce que tu as ressenti en lisant ma réponse."),
];

export const SERIES_36: Record<1 | 2 | 3, { title: string; text: string }> = {
  1: { title: "Série 1", text: "Pour (re)faire connaissance en douceur" },
  2: { title: "Série 2", text: "On va un peu plus loin" },
  3: { title: "Série 3", text: "On se dévoile vraiment" },
};
