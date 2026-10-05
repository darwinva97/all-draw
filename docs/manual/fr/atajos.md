# Raccourcis clavier, souris et tactiles

Tout ce que vous pouvez faire au clavier, à la souris ou du doigt dans l'éditeur d'all-draw, au même endroit. Dans
l'éditeur, appuyez sur **?** pour afficher un résumé à l'écran (ou utilisez le bouton **Raccourcis clavier** de la barre d'outils).

> [!TIP]
> **Sur Mac**, utilisez **Cmd** (⌘) partout où cette page indique **Ctrl** : **Cmd+Z**, **Cmd+C**, **Cmd+K**… Les deux fonctionnent.
> **Alt** est la touche **Option** (⌥), et **Suppr** est la touche **delete** (⌫). Si **F2** ne fait rien, essayez
> **fn+F2**.

## Avant de commencer : où se trouve le focus {#foco}

Il existe deux sortes de raccourcis :

- **Globaux** : ils fonctionnent partout dans l'éditeur tant que vous n'êtes pas en train de saisir dans un champ. Ce sont **Ctrl+K**,
  **Ctrl+F**, **?** et **F2** (ainsi que **Ctrl+Shift+E**, qui fonctionne même pendant la saisie).
- **Du canevas** : tous les autres (copier, coller, déplacer avec les flèches, zoom, supprimer…). Ils ne fonctionnent que lorsque le canevas a
  le focus. Si un raccourci « ne fait rien », **cliquez sur une zone vide du canevas** et réessayez.

Pendant que vous saisissez dans un champ de texte (l'inspecteur, le champ de recherche de la palette…), les touches écrivent du texte et les raccourcis du canevas
ne se déclenchent pas. Ainsi, **Suppr** efface des lettres, pas des nœuds.

## Général {#general}

| Raccourci | Ce qu'il fait |
|---|---|
| **Ctrl+K** ou **Ctrl+F** | Ouvre (ou ferme) la recherche : éléments, vues et actions |
| **?** | Ouvre (ou ferme) le panneau des raccourcis |
| **Ctrl+Shift+E** | Ouvre (ou ferme) le [panneau de texte](dsl.md#editar-como-texto) |
| **Esc** | Ferme les menus, panneaux et boîtes de dialogue ; annule le renommage |
| **Shift+F10** ou la touche **Menu** | Ouvre le menu contextuel de la sélection sur le canevas (ou le menu du canevas, sans sélection) |
| **Ctrl+Z** | Annuler |
| **Ctrl+Y** ou **Ctrl+Shift+Z** | Rétablir |

> [!NOTE]
> Dans l'éditeur, **Ctrl+F** ouvre la recherche d'all-draw au lieu de la barre de recherche du navigateur.

## Sélection {#seleccion}

| Raccourci | Ce qu'il fait |
|---|---|
| **Clic** | Sélectionne un nœud ou une arête |
| **Shift+clic** | Ajoute à la sélection ou en retire |
| **Shift+glisser** sur le fond | Sélection par rectangle (tout ce qui se trouve à l'intérieur) |
| **Ctrl+A** | Sélectionne tous les nœuds et toutes les arêtes de la vue |
| **Clic sur le fond** | Vide la sélection et affiche la vue dans l'inspecteur |
| **F2** | Renomme l'élément sélectionné (lorsqu'un seul nœud est sélectionné) |

## Modification {#edicion}

| Raccourci | Ce qu'il fait |
|---|---|
| **Ctrl+C** | Copie les nœuds sélectionnés (et les arêtes qui les relient) |
| **Ctrl+V** | Colle de **nouvelles occurrences des mêmes éléments**. Sert à amener des éléments dans une autre vue |
| **Ctrl+Shift+V** | Colle comme **copie** : crée de nouveaux éléments indépendants |
| **Ctrl+D** | Duplique la sélection (nouveaux éléments), légèrement décalée |
| **Flèches** | Déplacent la sélection de 1 px |
| **Shift+flèches** | Déplacent la sélection de 10 px |
| **Suppr** ou **Backspace** | **Retire de la vue les nœuds et arêtes sélectionnés** (les éléments et les relations restent dans le modèle) |
| **Shift+Suppr** | Sur des arêtes : **supprime la relation** du modèle, avec toutes ses arêtes dans toutes les vues (demande confirmation) |
| **Alt** (maintenir) | Désactive le magnétisme de la grille pendant que vous faites glisser |

> [!WARNING]
> **Shift+Suppr** sur une arête ne se contente pas de la retirer de la vue : il supprime la relation dans toutes les vues. En cas d'erreur,
> **Ctrl+Z**. Attention à **Ctrl+A** suivi de **Shift+Suppr** : comme **Ctrl+A** sélectionne aussi les arêtes, cela
> supprimerait toutes les relations dessinées dans la vue. Plus d'informations dans
> [Modèle et vues](modelo-y-vistas.md#quitar-o-borrar).

Dans une grille couches × étapes, ce que vous collez va dans la cellule située sous le curseur.

## Vue et zoom {#vista}

| Raccourci | Ce qu'il fait |
|---|---|
| **+** (ou **=**) | Zoom avant |
| **-** | Zoom arrière |
| **Ctrl+0** | Zoom à 100 % |
| **Ctrl+Shift+F** | Ajuster à la vue (cadre tous les nœuds) |

## Renommer sur place {#renombrar}

Lorsque vous renommez un nœud directement sur le canevas (avec **F2** ou en double-cliquant sur son nom) :

| Touche | Ce qu'elle fait |
|---|---|
| **Enter** | Valide le nom |
| **Esc** | Annule et conserve l'ancien nom |
| **Shift+Enter** | Saut de ligne (notes uniquement) |

## Recherche (Ctrl+K) {#busqueda}

| Touche | Ce qu'elle fait |
|---|---|
| Saisir | Filtre les éléments, vues et actions (sans tenir compte des accents, avec une faute de frappe tolérée par mot) |
| **↑** / **↓** | Parcourt la liste |
| **Enter** | Ouvre le résultat choisi |
| **Esc** | Si vous choisissiez une vue pour un élément, ou dans *Aller à la vue…* / *Nouvelle vue…*, revient aux résultats ; sinon, ferme |

## Panneau de texte (Ctrl+Shift+E) {#texto}

Avec le focus dans le texte du panneau ([Modifier sous forme de texte](dsl.md#editar-como-texto)) :

| Touche | Ce qu'elle fait |
|---|---|
| **Ctrl+Espace** | Suggestions de types et d'ids (elles apparaissent aussi d'elles-mêmes pendant la saisie) |
| **↑** / **↓**, **Enter** ou **Tab** | Parcourt et choisit la suggestion ; **Esc** ferme la liste |
| **Ctrl+F** | Recherche dans le texte (n'ouvre pas la recherche générale) |
| **Enter** / **F3** | Occurrence suivante ; avec **Shift**, la précédente |
| **Ctrl+S** | Applique le texte tout de suite, sans attendre |
| **Tab** / **Shift+Tab** | Augmente / diminue le retrait |
| **Esc**, puis **Tab** | Quitte le texte au clavier |
| **Ctrl+Z** | Annule ce que vous avez saisi dans le texte (sur le canevas, annule toute la modification appliquée) |

## Commentaires {#comentarios}

| Touche | Ce qu'elle fait |
|---|---|
| **Ctrl+Enter** | Envoie le commentaire ou la réponse |
| **@** | Commence une mention ; la liste des personnes apparaît |
| **↑** / **↓** | Parcourt la liste des mentions |
| **Enter** ou **Tab** | Choisit la mention en surbrillance |
| **Esc** | Ferme la liste des mentions ; s'il n'y en a pas, abandonne le brouillon |

Plus d'informations dans [Commentaires](comentarios.md).

## Boîtes de dialogue {#dialogos}

Dans les boîtes de dialogue (connexion, partage, recherche, raccourcis, Espace…) :

| Touche | Ce qu'elle fait |
|---|---|
| **Tab** / **Shift+Tab** | Passe au contrôle suivant / précédent (le focus reste dans la boîte de dialogue) |
| **Esc** | Ferme la boîte de dialogue et rend le focus au bouton qui l'a ouverte |

## Menus, palette et panneaux {#menus-y-paneles}

| Touche | Où | Ce qu'elle fait |
|---|---|---|
| **↑** / **↓**, **Home** / **End** | Menu contextuel | Parcourt les options ; **Enter** en choisit une ; **Esc** ou **Tab** le ferment et le focus revient au canevas |
| **Tab**, puis **↑** / **↓** | Palette et liste des vues | Entre dans la liste (un seul arrêt de **Tab**) et s'y déplace |
| **Enter** ou **Espace** | Un type de la palette | L'ajoute à un emplacement libre près du centre du canevas visible (comme un clic) |
| **F** ou **\*** | Un type de la palette | Le marque ou le démarque comme favori |
| **Enter** / **Suppr** | Une vue de la liste | L'ouvre / la supprime (demande confirmation) |
| **←** / **→** | Onglets (palette, inspecteur, Espace) | Change d'onglet |

## Souris {#raton}

| Geste | Où | Ce qu'il fait |
|---|---|---|
| Glisser | Fond du canevas | Fait défiler la vue |
| Molette | Canevas | Zoome en avant ou en arrière |
| Double-clic | Fond du canevas | Zoome en avant |
| Glisser | De la palette vers le canevas | Crée un nœud (ou une occurrence, depuis l'onglet **Modèle**) |
| Clic | Un type de la palette | L'ajoute à un emplacement libre près du centre du canevas |
| Glisser | Un nœud | Le déplace ; le déposer dans un conteneur l'y imbrique |
| Glisser | Coins d'un nœud sélectionné | Le redimensionne |
| Glisser | Du bord inférieur d'un nœud vers un autre nœud | Crée une relation (le menu **Type de relation** apparaît). Pendant le glissement, la cible devient verte si elle est valide et rouge sinon, avec la raison |
| Glisser | Du bord inférieur d'un nœud vers un emplacement vide | Menu **Créer et connecter** : crée à cet endroit un élément déjà relié (un seul Ctrl+Z l'annule) |
| Glisser | D'une broche vers une autre broche | Crée une relation entre broches, avec son mappage |
| Double-clic | Un nœud | Entre dans sa vue de détail |
| Double-clic | Le nom d'un nœud | Le renomme sur place |
| Double-clic | Une arête | Ajoute un point de pliage |
| Glisser | Un point de pliage | Le déplace |
| Double-clic | Un point de pliage | Le retire |
| Clic droit | Un nœud | Menu du nœud : ouvrir dans une autre dimension, détail, traces, commenter, broches, retirer, supprimer |
| Clic droit | Fond du canevas | Menu du canevas : **Coller ici**, **Ajouter une note**, **Commenter ici**, **Tout sélectionner**, **Ajuster à la vue**, **Disposition automatique** |
| Glisser ou molette | Mini-carte (coin inférieur droit) | Fait défiler la vue ou zoome |

Les boutons de zoom avant, de zoom arrière et d'ajustement à la vue se trouvent aussi en bas à gauche du canevas.

## Écrans tactiles {#tactil}

all-draw s'adapte à la taille de l'écran :

- **Ordinateur** (1100 px ou plus) : les trois colonnes sont visibles.
- **Tablette** (de 700 à 1099 px) : la barre d'outils a deux boutons pour **afficher ou masquer** la colonne des vues et de la palette et
  la colonne de l'inspecteur. Votre choix est mémorisé.
- **Téléphone** (moins de 700 px) : le canevas occupe tout l'écran et une barre apparaît en bas avec **Vues**,
  **Ajouter**, **Inspecteur** et **Plus**. Chaque bouton ouvre un panneau qui glisse depuis le bas.

| Geste | Ce qu'il fait |
|---|---|
| Toucher | Sélectionne un nœud ou une arête |
| Faire glisser un doigt sur le fond | Fait défiler la vue |
| Pincer | Zoome en avant ou en arrière |
| Faire glisser un nœud | Le déplace |
| **Appui long** sur un nœud (une demi-seconde, sans bouger le doigt) | Ouvre le menu du nœud, comme un clic droit |
| Toucher un type dans le panneau **Ajouter** | L'ajoute à un emplacement libre près du centre du canevas |
| Toucher en dehors du panneau, faire glisser sa poignée vers le bas ou appuyer sur son **×** | Ferme le panneau |

Le panneau **Plus** contient le chemin des vues, **Espace**, la recherche, le magnétisme de la grille, le thème, les raccourcis, **Ajuster à la vue**,
**Disposition automatique** et les actions de l'espace (importer/exporter, partager…). Les boutons Annuler et Rétablir restent toujours dans la
barre du haut.

> [!TIP]
> Sans clavier, le menu du nœud (appui long) remplace plusieurs raccourcis : **Entrer dans le détail** au lieu du
> double-clic, **Retirer de cette vue** au lieu de **Suppr**. Pour renommer, ouvrez le panneau **Inspecteur** et modifiez
> le nom en haut.

## Problèmes fréquents {#problemas-frecuentes}

**Un raccourci ne fait rien.**
Cliquez sur une zone vide du canevas pour lui donner le focus. Si vous êtes en train de saisir dans un champ, les raccourcis du canevas sont désactivés
volontairement.

**Ctrl+V ne colle rien.**
Il faut d'abord copier des nœuds all-draw avec **Ctrl+C**. Vous ne pouvez pas coller dans un espace en lecture seule.

**J'ai appuyé sur Shift+Suppr et une relation a disparu de toutes les vues.**
Une arête était sélectionnée : **Shift+Suppr** supprime la relation du modèle. Appuyez sur **Ctrl+Z**. **Suppr** l'aurait seulement
retirée de cette vue.

**Les touches fléchées font défiler la page au lieu de déplacer le nœud.**
Le canevas n'a pas le focus, ou rien n'est sélectionné. Cliquez sur le nœud pour le sélectionner et réessayez.

**Sur mon téléphone, l'appui long n'ouvre pas le menu.**
Gardez le doigt immobile sur le nœud : s'il bouge de plus de quelques pixels, cela compte comme un glissement. L'appui long
ne fonctionne que sur les nœuds, pas sur le fond.

**Dans un espace en lecture seule, beaucoup de raccourcis ne répondent pas.**
C'est normal : seule la navigation fonctionne (recherche, tout sélectionner, zoom, ajuster à la vue, **Esc**).
