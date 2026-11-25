// Mots pour le pendu (200) et pour « Dessine, je devine » (150).
// Pas de « œ » ni « æ » (non gérés par la normalisation de la base).

export const MOTS_PENDU: readonly string[] = [
  // maison & quotidien
  "parapluie", "oreiller", "couverture", "aspirateur", "cafetière", "lampadaire", "bibliothèque", "étagère",
  "fauteuil", "tabouret", "baignoire", "serviette", "dentifrice", "réveil", "escalier", "cheminée",
  "grenier", "balcon", "jardinière", "arrosoir", "brouette", "tondeuse", "boîte aux lettres", "trousseau",
  "casserole", "passoire", "saladier", "tire-bouchon", "cuillère", "fourchette", "théière", "grille-pain",
  // nourriture
  "croissant", "baguette", "chocolatine", "confiture", "fromage", "camembert", "raclette", "tartiflette",
  "ratatouille", "crêpe", "galette", "macaron", "cannelé", "clafoutis", "profiterole", "meringue",
  "framboise", "myrtille", "groseille", "pastèque", "clémentine", "ananas", "artichaut", "courgette",
  "aubergine", "potiron", "champignon", "cornichon", "moutarde", "vinaigrette", "spaghetti", "omelette",
  // animaux
  "girafe", "éléphant", "hippopotame", "crocodile", "kangourou", "pingouin", "flamant rose", "hérisson",
  "écureuil", "papillon", "coccinelle", "libellule", "sauterelle", "escargot", "grenouille", "tortue",
  "dauphin", "baleine", "méduse", "hippocampe", "pieuvre", "perroquet", "toucan", "chouette",
  "hibou", "renard", "blaireau", "marmotte", "chamois", "dromadaire", "panthère", "guépard",
  // nature & voyages
  "montagne", "cascade", "volcan", "glacier", "falaise", "presqu'île", "archipel", "lagune",
  "forêt", "clairière", "prairie", "tournesol", "coquelicot", "marguerite", "lavande", "bambou",
  "arc-en-ciel", "tempête", "brouillard", "éclair", "flocon", "aurore", "crépuscule", "boussole",
  "valise", "passeport", "montgolfière", "téléphérique", "sous-marin", "trottinette", "locomotive", "voilier",
  // loisirs & culture
  "accordéon", "violoncelle", "harmonica", "trompette", "xylophone", "tambourin", "guitare", "batterie",
  "marionnette", "manège", "toboggan", "balançoire", "cerf-volant", "château de sable", "pique-nique", "randonnée",
  "bibliothécaire", "astronaute", "pompier", "boulanger", "jardinier", "magicien", "acrobate", "explorateur",
  "dictionnaire", "encyclopédie", "devinette", "charade", "énigme", "labyrinthe", "trésor", "carte postale",
  // mots doux & famille
  "câlin", "bisou", "tendresse", "complicité", "fou rire", "chatouille", "doudou", "berceuse",
  "anniversaire", "surprise", "confettis", "guirlande", "bougie", "cadeau", "souvenir", "album photo",
  "lune de miel", "coup de foudre", "rendez-vous", "sérénade", "promenade", "grasse matinée", "petit déjeuner", "cocooning",
  // un peu plus corsés
  "kaléidoscope", "zigzag", "whisky", "kiwi", "yaourt", "jonquille", "quinoa", "bazar",
  "abracadabra", "hurluberlu", "saperlipopette", "chuchotement", "gribouillis", "tohu-bohu", "brouhaha", "pataquès",
  "mirabelle", "quetsche", "vanille", "cannelle", "gingembre", "basilic", "ciboulette", "estragon",
  "bordeaux", "dune du pilat", "arcachon", "bassin", "huître", "pinède", "phare", "goéland",
];

export const MOTS_DESSIN: readonly string[] = [
  // faciles
  "soleil", "lune", "étoile", "nuage", "arc-en-ciel", "maison", "arbre", "fleur",
  "chat", "chien", "poisson", "oiseau", "papillon", "escargot", "serpent", "araignée",
  "pomme", "banane", "poire", "cerise", "fraise", "carotte", "pizza", "glace",
  "gâteau", "bougie", "cadeau", "ballon", "coeur", "lunettes", "chapeau", "parapluie",
  "voiture", "vélo", "avion", "bateau", "fusée", "train", "tracteur", "hélicoptère",
  // moyens
  "château", "phare", "tente", "pont", "montagne", "volcan", "île", "cascade",
  "girafe", "éléphant", "lapin", "tortue", "pingouin", "requin", "baleine", "pieuvre",
  "dinosaure", "licorne", "dragon", "fantôme", "sirène", "robot", "extraterrestre", "pirate",
  "guitare", "piano", "trompette", "tambour", "micro", "appareil photo", "télévision", "téléphone",
  "réveil", "lampe", "clé", "cadenas", "ciseaux", "crayon", "livre", "enveloppe",
  "tasse", "théière", "fourchette", "casserole", "frigo", "baignoire", "brosse à dents", "chaussette",
  "cerf-volant", "toboggan", "balançoire", "bonhomme de neige", "sapin", "citrouille", "couronne", "épée",
  // plus durs
  "pique-nique", "anniversaire", "plage", "camping", "piscine", "cinéma", "restaurant", "marché",
  "astronaute", "pompier", "cuisinier", "magicien", "danseuse", "jardinier", "chevalier", "princesse",
  "tornade", "orage", "flaque", "feu de camp", "boussole", "carte au trésor", "sablier", "loupe",
  "montgolfière", "sous-marin", "trottinette", "skateboard", "parachute", "ascenseur", "escalier", "moulin",
  "hamac", "transat", "bouée", "château de sable", "coquillage", "crabe", "étoile de mer", "méduse",
  "panda", "koala", "kangourou", "hibou", "flamant rose", "hérisson",
  "chaussure", "parasol", "cactus", "champignon", "nid", "abeille", "vache", "cochon",
  "mouton", "cheval", "zèbre", "lion", "singe", "ours", "souris", "grenouille",
];
