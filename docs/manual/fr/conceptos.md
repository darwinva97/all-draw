# Concepts

Ce chapitre explique les idées sur lesquelles repose all-draw, sans entrer dans les boutons. Une fois qu'elles sont claires, le
reste de l'application se comprend tout seul. Pour le « comment faire » pas à pas, allez à
[Modèle et vues](modelo-y-vistas.md) et à [L'éditeur](editor.md).

L'idée centrale tient en une phrase : **vous dessinez un modèle une fois et vous le regardez à travers de nombreuses notations**.

## Modèle et vues {#modelo-y-vistas}

**Ce que c'est.** all-draw a deux niveaux :

- Le **modèle** contient *ce qui existe* : les **éléments** (un processus, une application, une personne, une table…) et
  les **relations** entre eux (l'application *sert* le processus, le processus *accède* aux données…).
  Chaque élément a un type, un nom, une documentation, des champs et des étiquettes.
- Les **vues** contiennent *la façon de le dessiner*. Une vue est un diagramme : elle choisit des éléments du modèle et les place
  sur le canevas. Chaque dessin d'un élément dans une vue est une **occurrence** (un *nœud*) ; chaque dessin d'une
  relation est une **arête**.

![Un élément du modèle et ses occurrences dans deux vues](../img/conceptos-modelo-vistas.en.svg)

**Pourquoi cela existe.** Parce que, dans la réalité, la même chose apparaît dans de nombreux diagrammes. Si le CRM figure sur la
carte d'architecture, dans le diagramme de conteneurs et dans la grille des capacités, vous voulez que ce soit **le même CRM** : pour
que le renommer le change partout, et pour pouvoir demander « où le CRM apparaît-il ? ».

**Ce que cela signifie en pratique.**

| Vous faites ceci… | …et voici ce qui se passe |
|---|---|
| Renommer un élément dans une vue | Il change dans toutes les vues où il apparaît |
| Modifier ses données dans l'inspecteur | Vous voyez les mêmes données depuis n'importe quelle vue |
| Déplacer ou redimensionner un nœud | Seule cette vue change (la position appartient à l'occurrence) |
| Retirer un nœud d'une vue (**Suppr**) | L'élément reste dans le modèle et dans les autres vues |
| **Supprimer du modèle** un élément | Il disparaît de toutes les vues, avec ses relations |
| Faire glisser un élément depuis l'onglet **Modèle** de la palette | Il apparaît une fois de plus, dans cette vue |

Une relation fonctionne de la même façon : elle existe une fois dans le modèle et peut être dessinée comme arête dans plusieurs vues, chacune
avec son propre tracé et ses propres points de pliage.

> [!NOTE]
> Il existe aussi des nœuds qui n'appartiennent **pas** au modèle : les notes, groupes, libellés et images de
> l'onglet **Visuel** de la palette. Ils ne vivent que dans leur vue et ne peuvent pas être reliés par des relations.

## Notations {#notaciones}

**Ce que c'est.** Une **notation** est un langage de diagrammes : ArchiMate, BPMN, machine à états, C4, séquence,
entité-relation, classes UML, carte mentale, logigramme, flux de données (DFD), couches × étapes et libre. Dans
all-draw, chaque notation se présente sous la forme d'un **pack** qui définit :

- les **types d'élément** (en BPMN : tâche, événement de début, passerelle…), avec leur forme, leur couleur et leur icône ;
- les **types de relation** (flux de séquence, flux de message…) ;
- quelles relations sont valides entre quels types (la [matrice de validité](conceptos.md#validez)) ;
- les [viewpoints](conceptos.md#viewpoints) de la notation ;
- ce qui peut aller à l'intérieur de quoi (un couloir dans un pool, un conteneur dans un système…).

**Pourquoi cela existe.** Chaque notation répond bien à une question : ArchiMate pour l'architecture d'entreprise, BPMN pour
le pas-à-pas d'un processus, les états pour le cycle de vie de quelque chose. Au lieu d'en choisir une, all-draw vous permet
de les utiliser toutes sur le même modèle.

Chaque vue a **une** notation, qui détermine sa palette et la façon dont les nœuds sont dessinés. Vous pouvez tout de même mélanger : la
palette propose les autres notations, repliées, comme « autre notation ». La liste complète et la référence de chaque pack
se trouvent dans [Notations](notaciones.md).

## Dimensions {#dimensiones}

**Ce que c'est.** Une **dimension** est un axe selon lequel vous pouvez regarder *n'importe quel* élément : « le voir comme un processus BPMN »,
« le voir dans l'architecture », « le voir comme une machine à états ». Techniquement, ce n'est qu'un nom, une
notation et, éventuellement, un viewpoint. La démo en contient six : Architecture, Processus (BPMN),
États, C4, Couches × étapes et Séquence.

![Un élément vu dans quatre dimensions](../img/conceptos-dimensiones.en.svg)

**Pourquoi cela existe.** Pour naviguer. Lorsque des dimensions sont définies, le menu contextuel (clic droit) de n'importe quel nœud propose
**Ouvrir dans une autre dimension** avec une entrée par dimension :

- Si l'élément a déjà une vue de détail dans cette notation, elle s'ouvre.
- Sinon, l'entrée indique **(créer)** et crée une nouvelle vue dans cette notation, dédiée à cet élément.

Ainsi, depuis le processus « Intégration client », vous atteignez son BPMN, ses états ou sa séquence en un clic, sans
chercher dans la liste des vues.

> [!TIP]
> Sans dimensions, le menu **Ouvrir dans une autre dimension** est vide. Ajoutez-les dans le panneau **Vues → Dimensions**
> (voir [Modèle et vues](modelo-y-vistas.md#dimensiones)).

## Vues de détail et drill-down {#drill-down}

**Ce que c'est.** Une vue peut être **dédiée à un élément** : cet élément est son **élément racine**. La vue BPMN
« Intégration client · BPMN » a pour racine le processus « Intégration client » : c'est *son détail*. Dans le panneau
Vues, les vues qui ont une racine sont précédées d'un petit losange (◇).

En outre, chaque occurrence (nœud) peut pointer vers une vue précise comme **vue au double-clic**.
**Double-cliquer** sur ce nœud vous y fait entrer : c'est le *drill-down* (descente dans le détail).

**Pourquoi cela existe.** Pour aller du général au particulier sans vous perdre. Lorsque vous entrez dans un détail, la
barre d'outils affiche le **chemin des vues** (par exemple *Architecture › Intégration client · BPMN*) et le bouton **retour**
(←) pour revenir. Vous pouvez enchaîner les niveaux : architecture → processus → états.

Lorsque vous créez une vue avec **Ouvrir dans une autre dimension → … (créer)** ou **Nouvelle vue de détail…**, all-draw fait
les deux choses à la fois : la nouvelle vue reçoit cet élément comme racine, et le nœud à partir duquel vous l'avez créée pointe vers elle
pour le double-clic (sauf s'il pointait déjà vers une autre).

## Broches {#pines}

**Ce que c'est.** Une **broche** est une valeur précise d'un élément exposée comme **point de connexion** sur le bord de
sa boîte (un petit carré orange). Les broches permettent de dire non seulement « ce service parle à celui-là », mais « **cette
donnée** de ce service va dans **ce champ** de celui-là ».

Les broches proviennent automatiquement des **champs** de l'élément :

- Un champ **JSON** génère une broche par valeur terminale. Si la réponse d'un service est
  `{"cliente": {"id": "c-1", "email": "ana@acme.com"}}`, vous obtenez les broches `cliente.id` et `cliente.email`.
- Un champ **liste** génère une broche par entrée, et un champ **clé→valeur** une broche par clé.
- N'importe quel autre champ peut générer une broche si sa définition le demande. Les broches peuvent aussi être déclarées à la main.

![Deux composants reliés par des broches, avec un mappage de champs](../img/conceptos-pines.en.svg)

Lorsque vous reliez une broche à une autre, la relation enregistre aussi un **mappage** : quel champ source va vers quel
champ cible (`response.cliente.email → request.destinatario`). L'arête l'affiche avec un libellé comme
`email ⇄`, et l'inspecteur de la relation liste les mappages.

**Pourquoi cela existe.** Pour documenter les intégrations avec précision : quelles données circulent entre les systèmes et de quel
champ à quel champ. Dans la démo, le microservice `clients-api` envoie `cliente.email` au champ `destinatario`
(destinataire) de `notifications`.

Sur chaque nœud, vous choisissez quelles broches sont affichées (inspecteur, onglet **Broches**) : un service avec une grande réponse peut
en avoir des dizaines, et en général seules quelques-unes vous intéressent. Les broches déjà utilisées par une relation sont marquées d'un ● et
ne peuvent pas être masquées. Lorsque vous reliez deux broches, seules les relations compatibles avec elles sont proposées.

## Traces et relations passerelles {#trazas}

**Ce que c'est.** Parfois, le même concept est modélisé **deux fois, dans deux notations** : la tâche BPMN « Vérifier
l'identité » et le service ArchiMate « Vérification KYC » parlent de la
même chose à des niveaux différents. Les **relations passerelles** consignent cette correspondance. Ce sont des relations du noyau,
valides entre toutes les notations :

| Relation | Ligne | Signification |
|---|---|---|
| **Trace** | tiretée, pointe ouverte | « Est la même chose que » / « correspond à » (la plus générale) |
| **Réalise** | tiretée, pointe triangulaire | « L'implémente » : une tâche BPMN réalise un processus ArchiMate ; un conteneur C4 réalise un composant applicatif |
| **Affine** | pointillée, pointe ouverte | « Le détaille » : un état affine un objet métier |

![Traces entre des tâches BPMN et des éléments ArchiMate, avec une lacune non tracée](../img/conceptos-trazas.en.svg)

**Pourquoi cela existe.** Pour la **traçabilité** : pouvoir répondre à « quelles tâches du processus utilisent ce service ? » ou à
« quels éléments BPMN ne sont pas reliés à l'architecture ? ». La seconde question relève de la **couverture** : la part des éléments d'une
notation qui ont au moins une trace vers une autre notation. Ceux qui n'en ont aucune sont des **lacunes**.

all-draw vous aide à créer des traces en **suggérant** des paires : des éléments d'une autre notation portant le même nom,
qui apparaissent dans la vue de détail de l'autre, qui partagent des mots, ou dont les types se correspondent habituellement. Les suggestions
apparaissent dans :

- le menu contextuel du nœud, section **Traces** (« Lier à … ») ;
- l'onglet **Où** de l'inspecteur, sections **Traces** et **Suggestions** ;
- le panneau **Espace → Traçabilité** : une matrice entre deux notations, la couverture, les lacunes et un bouton pour lier
  plusieurs suggestions d'un coup (voir [Bibliothèques, règles et personnes](librerias-reglas-personas.md)).

Le panneau des problèmes ajoute aussi une note pour chaque élément sans trace, avec un bouton pour créer la meilleure
suggestion.

> [!NOTE]
> La couverture n'a de sens que si l'espace mélange au moins deux notations. Avec une seule, il n'y a pas de lacunes
> à montrer.

## Viewpoints {#viewpoints}

**Ce que c'est.** Un **viewpoint** est un sous-ensemble d'une notation destiné à un public ou à une question. C4 en a un par
niveau (*Contexte*, *Conteneur*, *Composant*, *Code*, *Déploiement*) ; ArchiMate en fournit 25 (*Layered*,
*Business Process Cooperation*…) ; BPMN a *Processus* et *Chorégraphie*.

Chaque vue peut avoir un viewpoint (choisi dans l'inspecteur de la vue). Dans ce cas, la palette **estompe** les types
qui n'en font pas partie et les place à la fin.

![La palette avec un viewpoint : types normaux et types estompés](../img/conceptos-viewpoint.en.svg)

**Pourquoi cela existe.** Pour vous guider sans vous enfermer. Dans une vue C4 *Contexte*, on dessine normalement des personnes et des
systèmes, pas des conteneurs ; le viewpoint vous le rappelle, mais **ne l'interdit pas**. Si vous utilisez un type estompé,
le panneau des problèmes affiche un **avertissement** (l'élément n'appartient pas au viewpoint de la vue) avec la possibilité
de le retirer de la vue. À vous de décider.

Certains viewpoints (comme *Layered* d'ArchiMate) acceptent tous les types : ils n'estompent donc rien.

## Matrice de validité {#validez}

**Ce que c'est.** Chaque notation dotée de règles formelles fournit une **matrice de validité** : pour chaque paire de types (source,
cible), quelles relations sont autorisées. En ArchiMate, par exemple, un composant applicatif peut *servir* un
processus métier, mais ne peut pas le *composer*. La matrice ArchiMate provient directement de la spécification (la même
que celle qu'utilise Archi).

**Pourquoi cela existe.** Pour que le modèle soit correct sans que vous ayez à connaître la spécification par cœur.

**Comment vous la remarquez en dessinant.** Lorsque vous déposez une connexion entre deux nœuds, le menu **Type de relation**
apparaît avec les options possibles :

- Entre deux éléments de la **même notation** : les relations que la matrice autorise pour ces deux types (celle qu'utilise
  habituellement la notation apparaît en premier), plus les relations générales du noyau (**Lien**, **Trace**, **Réalise**,
  **Affine**, **Flux de données**), toujours disponibles.
- Entre des éléments de **notations différentes** : uniquement les relations du noyau.
- Entre deux **broches** : uniquement les relations compatibles avec ces broches.
- Avec une note, un groupe, un libellé ou une image : la connexion est **refusée**, car ce ne sont pas des éléments du modèle.

La notation **Libre** n'a pas de matrice : elle accepte n'importe quelle relation entre n'importe quelle paire.

**Relations qui deviennent invalides.** Si vous importez un modèle depuis un autre outil ou changez des types, il peut rester une relation que la
matrice n'autorise pas. Le panneau des problèmes la signale comme **erreur** (la relation n'est pas
valide entre ces deux types) et propose des correctifs : la changer en une relation valide ou la supprimer.

## Espaces de travail {#espacios}

**Ce que c'est.** Un **espace de travail** est un projet complet : le modèle, toutes ses vues, les dimensions, les bibliothèques
de types, les règles de style, les personnes et les commentaires. Tout ce qui existe dans all-draw vit à l'intérieur d'un espace, et
les éléments d'un espace ne sont pas visibles depuis un autre.

Il en existe deux sortes :

- **Local** : vit uniquement dans votre navigateur. Il ne nécessite pas de compte et fonctionne toujours hors ligne, mais il ne peut pas être
  partagé ni copié sur un autre ordinateur.
- **Sur le serveur** : vit sur le serveur, avec une copie dans votre navigateur. Il peut être partagé avec des liens de modification ou de
  lecture, plusieurs personnes peuvent le modifier en même temps, il conserve un historique et il fonctionne hors ligne (il
  se synchronise au retour de la connexion).

Un espace local peut être **envoyé sur le serveur** à tout moment (une copie est créée). Les détails pratiques se trouvent
dans [Premiers pas](primeros-pasos.md#espacios-locales-y-servidor) et dans
[Partager et collaborer](compartir-y-colaborar.md).

## Résumé {#resumen}

| Concept | En une phrase | Où le voir |
|---|---|---|
| Élément | Une chose qui existe dans le modèle, une seule fois | Inspecteur (onglet **Données**), palette → **Modèle** |
| Relation | Un lien typé entre deux éléments | Inspecteur d'une arête |
| Vue | Un diagramme dans une notation | Panneau **Vues** |
| Occurrence (nœud) | Un élément dessiné dans une vue | Le canevas ; inspecteur → **Où** |
| Notation | Un langage de diagrammes (pack de types et de règles) | Palette → **Notation** ; [Notations](notaciones.md) |
| Dimension | Un axe pour voir n'importe quel élément dans une notation | Panneau **Vues → Dimensions** ; clic droit → **Ouvrir dans une autre dimension** |
| Élément racine / vue de détail | La vue dédiée à un élément | Inspecteur de la vue ; ◇ dans le panneau Vues ; double-clic sur le nœud |
| Broche | Une valeur d'un élément utilisable comme point de connexion | Inspecteur → **Broches** ; petits carrés sur le bord du nœud |
| Mappage | Quel champ va vers quel champ dans une relation entre broches | Inspecteur de la relation ; libellé `⇄` sur l'arête |
| Trace | Relie le même concept dans deux notations | Inspecteur → **Où** ; **Espace → Traçabilité** |
| Viewpoint | Un sous-ensemble d'une notation ; estompe, n'interdit pas | Inspecteur de la vue ; palette estompée |
| Matrice de validité | Quelles relations la notation autorise entre deux types | Menu **Type de relation** ; panneau des problèmes |
| Espace de travail | Le projet complet, local ou sur le serveur | Écran d'accueil |

## Confusions fréquentes {#confusiones-habituales}

**« J'ai supprimé une boîte et l'élément apparaît toujours dans la palette. »**
**Suppr** retire l'occurrence de *cette* vue, pas l'élément. Pour le supprimer partout : clic droit →
**Supprimer du modèle**. Voir [Modèle et vues](modelo-y-vistas.md#quitar-o-borrar).

**« J'ai copié-collé une boîte, je l'ai renommée, et les deux ont changé. »**
**Ctrl+V** colle une *nouvelle occurrence du même élément*. Si vous vouliez un élément différent, utilisez
**Ctrl+Shift+V** (coller comme copie) ou **Ctrl+D** (dupliquer).

**« Ouvrir dans une autre dimension n'affiche rien. »**
L'espace n'a pas de dimensions. Ajoutez-les dans **Vues → Dimensions**.

**« La relation que je veux n'est pas dans le menu. »**
La matrice de la notation ne l'autorise pas entre ces deux types. Vérifiez que les types sont bien ceux que vous pensez, ou utilisez une
relation du noyau (**Lien**, **Trace**…) si vous voulez simplement consigner le lien.

**« J'ai utilisé un type estompé et j'ai reçu un avertissement. »**
C'est le viewpoint de la vue. Vous pouvez ignorer l'avertissement, retirer le nœud ou régler le viewpoint de la vue sur
*(aucun : tout)*.
