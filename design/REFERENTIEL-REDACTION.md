# Référentiel de rédaction

Directives d'écriture pour un produit numérique&nbsp;: interface, contenu long, et vérification qu'un texte généré ne sonne pas mécanique. Un seul fichier, à joindre tel quel à toute conversation de conception ou de génération de contenu.

## Comment utiliser ce fichier

Ce document remplace `REDACTION.md`, `REDACTION-LONGUE.md` et `MARQUEURS-IA.md` réunis en une seule référence. Joins-le à une IA en même temps que `CHARTE-GRAPHIQUE.md` et `tokens/tokens.css` (voir `PROMPT-IA.md`) pour que les règles de rédaction s'appliquent sans avoir à les répéter à chaque prompt.

Trois parties, un régime chacune&nbsp;:

| Partie | S'applique à | Ne s'applique pas à |
|---|---|---|
| I — Texte d'interface | Boutons, titres, champs, erreurs, notifications | Un cours, un article, une documentation |
| II — Contenu long | Cours, article de blog, documentation, page d'aide | Un libellé de bouton ou un titre d'écran |
| III — Marqueurs IA | Tout texte généré par une IA, quelle que soit sa longueur | — s'applique aux deux parties précédentes |

## Sommaire

1. [Principe fondateur](#1-principe-fondateur)
2. [Partie I — Texte d'interface](#2-partie-i--texte-dinterface)
3. [Partie II — Contenu long](#3-partie-ii--contenu-long)
4. [Partie III — Marqueurs d'écriture IA](#4-partie-iii--marqueurs-décriture-ia)
5. [Partie IV — Typographie française](#5-partie-iv--typographie-française-commune)
6. [Checklist opérationnelle](#6-checklist-opérationnelle)
7. [Sources](#7-sources)

---

## 1. Principe fondateur

Un texte d'interface et un texte de contenu long ne se jugent pas au même critère.

**Dans une interface, le texte n'est pas là pour expliquer, il est là pour permettre d'agir.** Toute phrase qui n'aide pas quelqu'un à faire quelque chose est du bruit, même si elle est vraie et bien écrite. Un commentaire du type « Survolez cette carte pour voir l'ombre changer » a sa place dans une page de démonstration&nbsp;; dans un vrai produit, c'est de la pollution.

**Dans un cours, un article ou une documentation, expliquer est le travail.** Le lecteur vient précisément pour lire et comprendre&nbsp;: le but n'est plus « le moins de mots possible » mais « le chemin le plus clair vers la compréhension ».

Confondre les deux régimes est l'erreur la plus fréquente&nbsp;: écrire un produit comme une documentation (des paragraphes explicatifs dans une interface), ou écrire une documentation comme un produit (une explication tronquée par souci de brièveté, incompréhensible sans contexte).

La troisième partie de ce document — les marqueurs d'écriture IA — s'applique aux deux régimes à la fois, dans n'importe quelle langue.

---

## 2. Partie I — Texte d'interface

### 2.1 Le test d'élimination

Avant de garder une phrase dans une interface, poser trois questions.

Est-ce que quelqu'un peut agir sans elle&nbsp;? Si oui, la supprimer. Est-ce que ça répète ce qui est déjà visible&nbsp;? Un titre « Formulaire de contact » au-dessus d'un formulaire de contact ne dit rien de neuf. Est-ce que ça décrit le fonctionnement plutôt que le résultat&nbsp;? Personne n'a besoin de savoir comment le produit marche à l'intérieur.

Cinq pollutions reviennent systématiquement.

| Pollution | Non | Oui |
|---|---|---|
| Méta-description | Cliquez sur le bouton ci-dessous pour enregistrer vos modifications. | Bouton « Enregistrer » |
| Redondance titre-contenu | Titre « Vos informations personnelles », champ « Nom », aide « Saisissez votre nom » | Titre « Informations personnelles », champ « Nom » |
| Politesse mécanique | Veuillez saisir votre adresse e-mail, s'il vous plaît. | Adresse e-mail |
| Auto-félicitation | Notre puissant moteur de recherche intelligent trouve tout instantanément. | Rechercher |
| Évidence rassurante | Ne vous inquiétez pas, vos données sont en sécurité et modifiables plus tard. | Modifiable à tout moment |

### 2.2 Quatre principes, traduits de la documentation Material

Concis, pas robotique&nbsp;: des blocs courts et scannables, portant peu d'idées à la fois — concis ne veut pas dire télégraphique. Simple et direct&nbsp;: un vocabulaire commun, sans jargon métier ni terme inventé maison. S'adresser directement&nbsp;: « vous » et « votre », sans jamais mélanger avec un « je/mon » dans la même zone. Ne communiquer que l'essentiel&nbsp;: uniquement ce qui sert la tâche en cours, le reste attend la divulgation progressive — les détails apparaissent quand on en a besoin, pas tous au premier écran.

### 2.3 Règles par composant

**Boutons.** Un verbe qui dit ce qui va se passer, à l'infinitif. Un à trois mots&nbsp;; au-delà, l'action n'est pas claire. Le libellé doit répondre au titre du dialogue qui le porte&nbsp;: si le dialogue demande « Supprimer ce document&nbsp;? », le bouton dit « Supprimer », pas « OK ». Jamais deux verbes vagues côte à côte — « Annuler / Valider » oblige à relire le titre, « Annuler / Supprimer » se comprend seul.

| Non | Oui |
|---|---|
| OK | Enregistrer |
| Soumettre | Envoyer |
| Cliquez ici | Voir le détail |
| Valider | Confirmer la suppression |

**Titres.** Ils nomment, ils n'expliquent pas.

| Non | Oui |
|---|---|
| Bienvenue dans votre tableau de bord | Tableau de bord |
| Gérez vos paramètres de notification | Notifications |

**Champs de formulaire.** Le libellé nomme la donnée, il ne donne pas d'instruction. Le texte d'aide ne sert qu'aux contraintes non devinables (« 12 caractères minimum, dont un chiffre » plutôt que « Saisissez une adresse e-mail valide »). Le placeholder montre un format, il ne remplace pas le libellé — il disparaît à la saisie et se restitue mal aux lecteurs d'écran.

| Non | Oui |
|---|---|
| Saisissez votre adresse e-mail | Adresse e-mail |
| Entrez un mot de passe sécurisé | Mot de passe |

**Messages d'erreur.** Trois éléments dans cet ordre&nbsp;: ce qui s'est passé, pourquoi, comment corriger — sans culpabiliser. « Vous avez saisi » désigne un coupable ; « Le format attendu est » désigne une solution. Un code technique ne s'affiche que si la personne peut en faire quelque chose.

| Non | Oui |
|---|---|
| Erreur | Ce fichier dépasse 10 Mo |
| Vous avez oublié de remplir ce champ | Champ obligatoire |
| Échec de l'opération | Connexion perdue. Réessayez. |

**États vides.** Dire pourquoi c'est vide et comment le remplir — le seul endroit où deux phrases sont légitimes. « Aucune facture pour l'instant » plus un bouton « Créer une facture », jamais « Aucune donnée à afficher » sans suite. Un état vide au premier lancement est normal, pas un problème à dramatiser.

**Confirmations et notifications.** Dire ce qui a changé, pas féliciter. « Document enregistré », pas « Félicitations&nbsp;! Votre document a bien été enregistré avec succès&nbsp;! » — « bien » et « avec succès » sont redondants&nbsp;: si le message s'affiche, c'est que ça a marché.

**Info-bulles.** Elles complètent, elles ne répètent pas. Une info-bulle « Supprimer » sur une icône corbeille ambiguë est utile&nbsp;; la même info-bulle sur un bouton qui dit déjà « Supprimer » est à retirer.

**Dialogues.** Titre&nbsp;: une question ou un état, court. Corps&nbsp;: uniquement la conséquence non réversible. Actions&nbsp;: deux maximum. Pas de « Êtes-vous sûr de vouloir vraiment... » — la question est déjà dans le titre.

> Titre « Supprimer ce projet&nbsp;? » — Corps « Les 42 fichiers qu'il contient seront perdus. » — Actions « Annuler » / « Supprimer »

### 2.4 Formulations à bannir dans une interface

**Remplissage** — `veuillez` · `s'il vous plaît` · `n'hésitez pas à` · `il est important de noter que` · `comme vous pouvez le voir` · `bien entendu` · `tout simplement` · `il vous suffit de`. Google déconseille explicitement « simply », « it's easy » et « quickly »&nbsp;: ce qui est simple pour qui écrit ne l'est pas forcément pour qui lit.

**Redondant** — `bien` (dans « a bien été enregistré ») · `avec succès` · `actuellement` · `ci-dessous` · `ci-dessus` · `sur cette page`. Un repère comme « ci-dessous » suppose une disposition qui change en responsive et n'a aucun sens pour un lecteur d'écran.

**Vague** — `Erreur` seul · `Un problème est survenu` sans suite · `Élément` · `Données` · `Information` · `Contenu`.

**Condescendant** — `C'est facile&nbsp;!` · `Comme chacun sait` · `Évidemment` · `Vous avez oublié de`.

**Ponctuation** — point d'exclamation à proscrire hors félicitation réelle (Google&nbsp;: donne l'impression de crier)&nbsp;; points de suspension réservés à une action en cours (« Envoi… ») ou un menu qui ouvre autre chose (« Exporter… »)&nbsp;; pas de point final sur les libellés, titres ou éléments de liste courts.

### 2.5 Longueurs de référence

| Élément | Cible | Maximum |
|---|---|---|
| Libellé de bouton | 1–2 mots | 3 mots |
| Titre de page | 1–3 mots | 5 mots |
| Libellé de champ | 1–3 mots | 4 mots |
| Message d'erreur | 1 phrase | 2 phrases |
| Titre de dialogue | 3–6 mots | 8 mots |
| État vide | 1 phrase + action | 2 phrases |
| Notification | 3–8 mots | 1 phrase |
| Texte alternatif | 5–15 mots | 125 caractères |

Des repères, pas des lois — mais dépasser le maximum signale presque toujours que l'interface elle-même a besoin d'être clarifiée.

### 2.6 Cohérence terminologique

Un concept, un mot, partout. Le pire défaut d'une interface n'est pas d'être verbeuse&nbsp;: c'est d'appeler la même chose de trois façons (« Supprimer » ici, « Effacer » là, « Retirer » ailleurs). Tenir un tableau à deux colonnes — terme retenu / termes bannis — dès le premier écran coûte dix minutes et évite des mois de dérive. Choisir aussi, une fois pour toutes, entre tutoiement et vouvoiement.

### 2.7 Accessibilité

Texte alternatif&nbsp;: décrire la fonction, pas l'apparence, sous 125 caractères, jamais « image de ». Icônes décoratives&nbsp;: `aria-hidden="true"` quand le texte voisin dit déjà la même chose. Liens&nbsp;: l'intitulé doit se comprendre isolé (« Consulter la facture 2024-118 », jamais « Cliquez ici » ou « En savoir plus » répétés). Aucun repère directionnel&nbsp;: « le bouton à droite » est faux en responsive, faux en RTL, inutilisable à la voix.

---

## 3. Partie II — Contenu long

### 3.1 Source et principe

Le [guide de rédaction de la documentation développeur](https://developers.google.com/style) et les cours [Technical Writing One](https://developers.google.com/tech-writing/one) et [Two](https://developers.google.com/tech-writing/two) — suivis en interne par les ingénieurs Google avant d'écrire de la documentation — posent une équation&nbsp;:

> Une bonne documentation = ce que le lecteur doit savoir pour agir − ce qu'il sait déjà.

Deux conséquences. Connaître son audience n'est pas une formalité&nbsp;: identifier son rôle et sa proximité avec le sujet (a-t-elle déjà utilisé un outil proche, depuis combien de temps). Se méfier de la malédiction de la connaissance&nbsp;: un expert oublie ce qu'un débutant ignore et sous-explique par réflexe — la correction consiste à comparer chaque notion nouvelle à quelque chose que l'audience connaît déjà, plutôt que de supposer un socle commun.

### 3.2 Cadrer le document avant d'écrire

Trois déclarations explicites, en ouverture ou dans un plan préparatoire.

**Le périmètre** — ce que le document couvre, et ce qu'il ne couvre pas s'il existe un risque de confusion avec un sujet proche. **L'audience** — qui le lit, ce qu'elle sait déjà, ce qu'elle doit savoir en sortant. **L'objectif** — ce que le lecteur doit être capable de faire après lecture. Un texte sans objectif clair dérive.

### 3.3 Structurer l'ensemble

L'ouverture porte l'essentiel du poids&nbsp;: une bonne partie des lecteurs ne lira jamais la suite. Elle résume le point principal tout de suite, et compare si possible la notion nouvelle à quelque chose de connu plutôt que de la définir dans l'abstrait.

Le corps s'organise dans l'ordre où le lecteur se pose les questions, pas dans l'ordre où l'auteur les a découvertes&nbsp;: vue d'ensemble et comparaison d'abord, détails d'implémentation ensuite, cas particuliers en dernier. Pour un document en plusieurs parties, chaque section porte une seule idée et l'annonce dans son titre, en casse de phrase — la même convention typographique qu'en interface (partie 5 de ce document).

### 3.4 Construire un paragraphe

Une seule idée par paragraphe&nbsp;; une phrase qui parle du paragraphe précédent ou suivant se déplace là où elle appartient. Entre trois et cinq phrases&nbsp;: en dessous, le paragraphe segmente une idée qui aurait dû rester unie&nbsp;; au-delà de sept, il devient un mur de texte que le lecteur saute. La première phrase porte le point central, parce que c'est celle que le lecteur pressé lit vraiment. Un paragraphe solide répond dans l'ordre à trois questions&nbsp;: quoi (le point), pourquoi (l'intérêt pour le lecteur), comment (l'usage ou la vérification).

### 3.5 Construire une phrase claire

**Un verbe fort plutôt qu'un verbe vide.** Les formes de « être », « se produire » et « il y a » n'apportent aucune information, elles retardent le vrai verbe.

| Faible | Fort |
|---|---|
| Il y a une variable qui stocke le total. | La variable `total` stocke le montant cumulé. |
| Cette erreur se produit quand le champ est vide. | Un champ vide déclenche cette erreur. |

**Une donnée plutôt qu'un adjectif.** « Beaucoup plus rapide » ne se vérifie pas&nbsp;; « deux fois plus rapide » ou « en 200&nbsp;ms au lieu de 800&nbsp;ms » se vérifie. **Le sujet fait l'action.** Une phrase où le sujet grammatical agit réellement (voix active) se suit plus facilement qu'une phrase où il la subit, sauf quand l'auteur de l'action est sans intérêt pour le lecteur.

### 3.6 Ton

Les mêmes repères que pour l'interface, avec un curseur différent&nbsp;: on peut développer, illustrer, donner du contexte. Conversationnel sans être relâché&nbsp;: « vous », sans jargon inutile ni familiarité artificielle. Voix active et présent par défaut, sauf récit d'un événement passé. Une explication complète vaut mieux qu'une explication courte mais insuffisante — contrairement à un libellé de bouton, un paragraphe de cours a le droit d'être long s'il est nécessaire. Ce qui ne change pas&nbsp;: la typographie française (partie 5) et le rejet des tournures de remplissage (2.4) restent valables, quelle que soit la longueur du texte.

### 3.7 Se relire

On ne corrige pas efficacement un texte juste après l'avoir écrit&nbsp;: on lit ce qu'on avait l'intention d'écrire plutôt que ce qui est réellement sur la page. Laisser reposer le texte, puis le relire à voix haute — les phrases mal construites se remarquent à l'oreille avant de se remarquer à l'œil. Pour chaque paragraphe, vérifier qu'il fait encore avancer la compréhension vers l'objectif fixé au départ&nbsp;; un paragraphe qui ne sert que l'auteur se coupe ou se déplace en annexe.

---

## 4. Partie III — Marqueurs d'écriture IA

### 4.1 Portée et fiabilité

Cette partie s'applique aux deux régimes précédents, dans n'importe quelle langue. Elle repose sur une source différente des parties I et II&nbsp;: l'essai communautaire [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) de Wikipédia, maintenu par les éditeurs qui trient le contenu généré automatiquement, complété par des analyses qui quantifient certains de ces motifs. Ce n'est pas une norme officielle&nbsp;; les seuils chiffrés cités plus bas sont des repères, pas des lois. La plupart des mots documentés le sont en anglais, langue où ce phénomène a été le plus étudié — la colonne française qui suit est une adaptation des mêmes motifs, pas la traduction d'une source qui les documenterait déjà.

### 4.2 Vocabulaire à surveiller

| Catégorie | Anglais type | Équivalent français à surveiller |
|---|---|---|
| Ouvertures toutes faites | Delve into, in today's fast-paced world | Plonger dans, dans un monde en constante évolution, à l'ère du numérique |
| Mots à effet | Leverage, unlock, elevate, transformative | Levier, débloquer le potentiel, révolutionnaire, incontournable |
| Transitions formelles en série | Furthermore, moreover, additionally | En outre, de plus, par ailleurs — répétés en série |
| Adjectifs vagues | Comprehensive, robust, seamless, dynamic | Complet, riche, fluide, sur mesure |
| Métaphores décoratives | Tapestry, landscape, journey, beacon | Tapisserie, paysage (au sens figuré), voyage, phare |
| Fausse autorité | Studies show, experts agree | Les études montrent, il est reconnu que — sans source citée |

Un mot de cette liste, isolé, n'a rien d'un défaut. Le signal apparaît par accumulation&nbsp;: plusieurs de ces tournures dans le même texte, surtout groupées.

### 4.3 Tics de structure

La règle de trois systématique — des triplets d'adjectifs à chaque paragraphe lassent par leur régularité même quand chacun est correct pris isolément. « Ce n'est pas seulement X, c'est Y » répété plus d'une fois devient un tic plutôt qu'une figure de style. Des paragraphes de longueur strictement égale, tous construits sur le même schéma de trois phrases, sonnent mécaniques même si chaque phrase est correcte. Le tiret cadratin (—) utilisé plusieurs fois par paragraphe devient reconnaissable, d'autant plus visible en français où la ponctuation classique privilégie les deux-points et le point-virgule. Les formules de prudence systématiques (« il est important de noter que », déjà bannie en 2.4) posent le même problème dans un texte long. Une conclusion qui résume sans rien ajouter (« en conclusion », « en somme ») se supprime si elle n'apporte rien de neuf.

### 4.4 Deux vérifications mesurables

**La variance de longueur des phrases.** Compter le nombre de mots de chaque phrase d'un paragraphe. Un texte humain alterne des phrases courtes et longues&nbsp;; un texte qui varie à peine (écart type divisé par la moyenne sous 0,4) se repère à l'oreille autant qu'au calcul. La correction est directe&nbsp;: casser une phrase en deux, ou fusionner deux phrases courtes.

**Le test du fait reformulable.** Pour chaque paragraphe, chercher un nom, un chiffre ou une cause qu'on pourrait citer de mémoire une fois le texte fermé. Un paragraphe dont on ne retient qu'une impression générale, sans rien de concret, est fluide mais vide — le signe le plus fiable d'un texte qui tourne autour du sujet sans le traiter.

### 4.5 Ce que ça n'est pas

Éviter ces tics n'a pas pour but de dissimuler qu'un texte a été écrit avec l'aide d'une IA — ce n'est ni l'objectif ni quelque chose qu'on peut garantir. Ce sont des signes d'écriture générique, avec ou sans IA, et les éliminer améliore le texte pour le lecteur. Les disciplines déjà données en partie II — un fait plutôt qu'un adjectif, un verbe fort plutôt qu'un verbe vide, une seule idée par paragraphe — réduisent déjà la plupart de ces tics sans qu'il soit nécessaire d'y penser séparément.

---

## 5. Partie IV — Typographie française (commune)

Les règles Google des parties précédentes sont pensées pour l'anglais. Le français impose ses propres conventions, valables aussi bien pour l'interface que pour du contenu long.

**Espaces avant ponctuation.** Insécable avant `:` `;` `?` `!`, à l'intérieur des guillemets français `« »`, et avant les symboles `%` `€` et unités. En HTML&nbsp;: `&nbsp;` pour l'insécable normale, `&#8239;` pour la fine.

```html
<p>Total&nbsp;: 1&nbsp;250&nbsp;€</p>
<p>Supprimer ce projet&#8239;?</p>
```

Sans cette règle, un « ? » peut se retrouver seul en début de ligne.

**Majuscules.** Casse de phrase&nbsp;: seul le premier mot d'un titre prend une majuscule (« Nouveau document », pas « Nouveau Document » ni « NOUVEAU DOCUMENT »). Les capitales prennent leurs accents&nbsp;: « Économie », pas « Economie ».

**Guillemets.** Guillemets français `« »` avec espaces insécables, jamais les guillemets droits `" "`.

**Nombres.** Séparateur de milliers par espace insécable, virgule décimale&nbsp;: `1 250,50 €`, jamais `1,250.50 €`.

---

## 6. Checklist opérationnelle

**Interface**

- [ ] Chaque phrase aide à agir&nbsp;; aucune ne décrit l'interface elle-même
- [ ] Les libellés de bouton sont des verbes précis, un à trois mots
- [ ] Le bouton répond au titre du dialogue qui le porte
- [ ] Les erreurs disent quoi faire, sans accuser
- [ ] Aucun « veuillez », « bien », « avec succès », « tout simplement »
- [ ] Pas de point d'exclamation
- [ ] Un concept = un mot, dans tout le produit
- [ ] Chaque état vide propose une action
- [ ] Textes alternatifs fonctionnels, sous 125 caractères, aucun repère directionnel

**Contenu long**

- [ ] Le périmètre, l'audience et l'objectif sont définis avant la première ligne
- [ ] L'ouverture résume le point principal et compare à quelque chose de connu
- [ ] Chaque section porte une seule idée, annoncée dans son titre
- [ ] Chaque paragraphe tient en trois à sept phrases et commence par son point central
- [ ] Les adjectifs vagues sont remplacés par des données quand c'est possible
- [ ] Le texte a reposé quelques heures et a été lu à voix haute avant publication

**Marqueurs IA**

- [ ] Aucune accumulation de mots à effet dans un même paragraphe
- [ ] Pas plus d'un triplet d'adjectifs par 200 mots
- [ ] Les paragraphes varient en longueur&nbsp;; aucun format figé ne se répète
- [ ] Le tiret cadratin apparaît par nécessité, pas par habitude
- [ ] Chaque paragraphe laisse un fait concret à retenir, pas seulement une impression

**Typographie française**

- [ ] Casse de phrase partout, accents sur les capitales
- [ ] Espaces insécables avant `: ; ? !` et devant `% €`
- [ ] Guillemets français, virgule décimale

---

## 7. Sources

- [Material's Communication Principles — Google Codelabs](https://codelabs.developers.google.com/codelabs/material-communication-guidance)
- [Writing — Material Design](https://m1.material.io/style/writing.html)
- [Guide de rédaction de la documentation développeur](https://developers.google.com/style) — sommaire, ton, liste de mots
- [Technical Writing One](https://developers.google.com/tech-writing/one) — phrases, paragraphes, audience, documents
- [Technical Writing Two](https://developers.google.com/tech-writing/two) — organisation des documents longs, relecture
- [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) — essai communautaire de Wikipédia
- [Signs of AI Writing: 12 Patterns With Reproducible Thresholds](https://slopdetector.org/blog/signs-of-ai-writing)
- [Types d'espacement — Vitrine linguistique, OQLF](https://vitrinelinguistique.oqlf.gouv.qc.ca/24565/la-typographie/espacement/types-despacement)
