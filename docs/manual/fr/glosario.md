# Glossaire

Les mots qu'utilise all-draw, expliqués en quelques lignes. Ils sont regroupés par thème ; utilisez la
recherche de la documentation si vous en cherchez un en particulier.

## Espaces de travail et modèle {#grupo-espacios-y-modelo}

### Espace de travail {#espacio}

Le document sur lequel vous travaillez : il contient le modèle, toutes ses vues, les bibliothèques, les
règles, les personnes et les commentaires. Il peut être **local** (il vit dans votre navigateur) ou **du
serveur** (enregistré sur le serveur et partageable). Voir [espaces de travail](conceptos.md#espacios).

### Espace local {#espacio-local}

Un espace enregistré uniquement dans ce navigateur, sans compte. Personne d'autre ne le voit et il n'a pas
d'historique ; pour éviter de le perdre, exportez de temps en temps un `.alldraw.json`. Voir
[premiers pas](primeros-pasos.md).

### Espace du serveur {#espacio-del-servidor}

Un espace enregistré sur le serveur avec votre compte. Il peut être partagé, se synchronise en direct et a
un [historique](historial.md).

### Modèle {#modelo}

L'ensemble des *choses* que vous décrivez (éléments) et de la façon dont elles sont liées (relations),
indépendamment de la manière dont elles sont dessinées. Le même modèle peut être montré dans de nombreuses
vues. Voir [modèle et vues](conceptos.md#modelo-y-vistas).

### Élément {#elemento}

Une chose du modèle : un processus, une application, un état, une table… Il a un type, un nom, une
documentation et des champs. Le renommer dans une vue le renomme dans toutes.

### Relation {#relacion}

Un lien typé entre deux éléments du modèle (« sert », « s'écoule vers », « réalise »…). Elle n'existe qu'une
seule fois dans le modèle, même si elle est dessinée dans plusieurs vues.

### Type {#tipo}

La nature d'un élément ou d'une relation au sein d'une notation (par exemple *Business Process* en
ArchiMate ou *Tâche* en BPMN). Il détermine sa forme, sa couleur, ses champs et ce à quoi il peut se
connecter.

### Catégorie {#categoria}

Un regroupement de types dans la palette (par exemple *Activités* ou *Événements* en BPMN). Elle ne sert
qu'à organiser la palette.

### Champ {#campo}

Une donnée nommée d'un élément (par exemple « responsable » ou « requête »). Les champs sont définis par le
type ou par une bibliothèque ; vous pouvez aussi ajouter des propriétés libres. Certains champs produisent
des broches.

### Relation implicite {#relacion-implicita}

La relation qu'all-draw crée pour vous lorsque vous placez un nœud dans un autre, si la notation en propose
une (par exemple, la composition en ArchiMate). Ainsi, l'imbrication n'est pas qu'un dessin : elle est
enregistrée dans le modèle.

## Vues et canevas {#grupo-vistas}

### Vue {#vista}

Un diagramme précis de l'espace de travail, avec une notation. Elle montre une partie du modèle, disposée
comme vous le souhaitez. Un espace peut avoir autant de vues que vous voulez.

### Nœud (occurrence) {#nodo}

Le dessin d'un élément dans une vue : position, taille, style. Le même élément peut avoir plusieurs
occurrences dans différentes vues. **Retirer de cette vue** supprime l'occurrence, pas l'élément.

### Arête {#arista}

Le dessin d'une relation dans une vue : la ligne avec ses points de pliage et son style. Supprimer une
arête d'une vue ne supprime pas la relation du modèle si elle est dessinée dans d'autres vues.

### Conteneur {#contenedor}

Un nœud qui peut en contenir d'autres (un pool BPMN, un groupe, un système en C4). Quand vous y placez un
nœud, celui-ci devient **imbriqué**.

### Imbrication {#anidamiento}

Placer un nœud à l'intérieur d'un autre. La notation décide de ce qui peut aller dans quoi et crée parfois
une [relation implicite](#relacion-implicita). Voir [éditeur](editor.md).

### Point de pliage {#punto-de-quiebre}

Un angle dans une ligne. Un double-clic sur la ligne en ajoute un, le faire glisser le déplace et un
double-clic dessus le supprime.

### Tracé {#enrutado}

La manière dont le chemin d'une ligne entre deux nœuds est dessiné : **Orthogonal** (angles droits),
**Courbe** ou **Droit**. Vous le choisissez dans l'inspecteur de l'arête, champ **Tracé**.

### Disposition automatique {#layout-automatico}

Un bouton qui réorganise proprement les nœuds de la vue actuelle, selon la notation. Il peut être annulé
avec Ctrl+Z.

### Grille couches × étapes {#rejilla}

Un type de vue en forme de tableau : les lignes sont les **couches** et les colonnes les **étapes**, et
chaque nœud vit dans une cellule. Utile pour les cartes de processus ou d'architecture par phase. Voir
[notation en grille](notaciones/grid.md).

### Couche {#capa}

Une ligne de la grille couches × étapes (par exemple « Métier », « Application », « Technologie »).

### Étape {#etapa}

Une colonne de la grille couches × étapes (par exemple « Demande », « Validation », « Intégration »).
Plusieurs étapes peuvent être regroupées en bandes.

## Notations et dimensions {#grupo-notaciones}

### Notation {#notacion}

Le langage de diagramme d'une vue : ArchiMate, BPMN, C4, machine à états, entité-relation… Il détermine la
palette, les formes et les connexions valides. Voir [notations](notaciones.md).

### Pack {#pack}

Le paquet qui implémente une notation dans all-draw : ses types, ses relations, sa matrice de validité, ses
viewpoints et ses formes. En pratique, « pack » et « notation » s'emploient presque indifféremment.

### Dimension {#dimension}

Une façon de regarder le même élément à travers une autre notation : le processus « Intégration
client » en ArchiMate, en BPMN et sous forme de machine à états, ce sont trois dimensions du même élément.
Voir [dimensions](conceptos.md#dimensiones).

### Viewpoint {#viewpoint}

Un angle de vue au sein d'une notation qui met en avant les types pertinents pour une question précise (par
exemple *Contexte* en C4). Il atténue le reste de la palette sans l'interdire. Voir
[viewpoints](conceptos.md#viewpoints).

### Vue de détail {#vista-de-detalle}

Une vue qui explique l'intérieur d'un élément précis (son **élément racine**). Par exemple, la vue BPMN qui
détaille le processus « Intégration client ».

### Élément racine {#elemento-raiz}

L'élément que décrit une vue de détail. Vous le choisissez dans l'inspecteur de la vue.

### Drill-down {#drill-down}

Passer d'un nœud à sa vue de détail, puis de là à une autre, chaque fois plus en profondeur. Voir
[drill-down](conceptos.md#drill-down).

### Chemin des vues {#ruta}

Le fil d'Ariane de la barre d'outils qui montre par quelles vues vous êtes descendu. Cliquez sur l'une
d'elles pour y revenir, ou sur la flèche ← pour revenir à la précédente.

### Matrice de validité {#matriz-de-validez}

Le tableau de chaque notation qui indique quel type de relation est autorisé entre quels types d'éléments.
C'est pour cela que l'éditeur ne vous laisse pas connecter deux choses que la notation n'autorise pas. Voir
[validité](conceptos.md#validez).

### Figure ArchiMate {#figura-archimate}

La forme alternative d'un élément ArchiMate (par exemple le cylindre d'un objet de données ou le
personnage d'un acteur), au lieu du rectangle avec une icône. Vous la choisissez dans l'inspecteur. Voir
[ArchiMate](notaciones/archimate.md).

### Catalogue de diagrammes {#catalogo}

Une liste de plus de 160 types de diagrammes courants dans les organisations informatiques (carte des
capacités, cartographie de la chaîne de valeur, architecture applicative…) qui indique avec quelle notation
d'all-draw chacun se dessine. Il vous aide à choisir le type de diagramme lors de la création d'une vue.
Voir [notations](notaciones.md).

## Broches, traces et vérifications {#grupo-pines-y-trazas}

### Broche {#pin}

Un point de connexion sur un nœud qui correspond à l'un des champs de l'élément (par exemple, chaque champ
d'une requête d'API). Elle permet de connecter champ à champ. Voir [broches](conceptos.md#pines).

### Mappage {#mapeo}

Dans une relation entre broches, la correspondance entre un champ source et un champ cible (par exemple,
« client.id → demande.document »).

### Trace {#traza}

Une relation qui relie des éléments de niveaux ou de notations différents pour indiquer que l'un correspond
à l'autre (par exemple, un processus métier et l'application qui le prend en charge). Voir
[traces](conceptos.md#trazas).

### Réalise {#realiza}

Une trace qui indique qu'un élément *concrétise* un élément plus abstrait (une application réalise un
service).

### Affine {#refina}

Une trace qui indique qu'un élément est une version *plus détaillée* d'un autre (un sous-processus affine
un processus).

### Couverture des traces {#cobertura-de-trazas}

Le nombre d'éléments d'un niveau qui ont leur trace vers l'autre niveau. Ceux qui n'en ont pas apparaissent
comme des lacunes dans le panneau de traçabilité et dans le panneau des problèmes.

### Validateur {#validador}

Une vérification automatique qui passe en revue l'espace de travail (relations non valides, éléments non
utilisés, règles BPMN, chevauchements dans le dessin, traces manquantes…) et place ses résultats dans le
panneau des problèmes.

### Diagnostic {#diagnostico}

Chaque entrée du panneau des problèmes : une erreur, un avertissement ou une note, avec l'élément concerné
et une explication.

### Correctif {#arreglo}

La correction que propose un diagnostic et que vous pouvez appliquer en un clic (par exemple, supprimer un
élément qui n'est utilisé dans aucune vue).

## Bibliothèques, règles et personnes {#grupo-librerias}

### Bibliothèque {#libreria}

Votre propre ensemble de types (avec leurs champs et leurs broches) et de composants réutilisables, pour
modéliser ce que les notations standard n'incluent pas. Voir
[bibliothèques, règles et personnes](librerias-reglas-personas.md).

### Composant (gabarit) {#componente}

Un élément de bibliothèque prêt à être réutilisé : le faire glisser sur le canevas crée une instance dont
les champs sont déjà remplis.

### Instance {#instancia}

Un élément créé à partir d'un composant. Quand vous modifiez le composant, les modifications se propagent à
ses instances.

### Règle {#regla}

Une condition et un style : « si le champ *statut* vaut *obsolète*, colorer le nœud en gris ». Elle change
l'apparence, pas le modèle.

### Personne {#persona}

Quelqu'un que vous ajoutez à l'espace de travail (nom, e-mail, équipe) pour lui attribuer des
responsabilités ou le mentionner dans des commentaires. Ce n'est pas un compte du serveur.

### Attribution {#asignacion}

Le lien entre une personne et quelque chose de l'espace de travail (un élément, une vue, une couche, une
étape, un type ou une relation) avec un rôle, par exemple « responsable ».

## Collaboration {#grupo-colaboracion}

### Commentaire {#comentario}

Un message ancré à un élément, un nœud, une ligne, un point du canevas ou une vue. Voir
[commentaires](comentarios.md).

### Fil {#hilo}

Un commentaire et ses réponses. Il se résout ou se rouvre dans son ensemble.

### Mention {#mencion}

Écrire `@Nom` dans un commentaire pour désigner une personne de l'espace de travail. Elle est mise en
évidence mais n'envoie aucun avis.

### Instantané {#instantanea}

Une copie complète d'un espace du serveur à un moment donné, à laquelle vous pouvez revenir. Voir
[historique](historial.md).

### Lien de partage {#enlace-compartido}

Une adresse qui donne accès à un espace du serveur, en modification ou en lecture seule, sans compte. Il
peut être révoqué à tout moment. Voir [inviter](compartir-y-colaborar.md#invitar).

### Rôle {#rol}

Ce que vous pouvez faire dans un espace du serveur : **propriétaire** (tout, y compris partager et
supprimer), **peut modifier** ou **lecture seule** (consultation uniquement). Dans l'API, ils s'appellent
`owner`, `editor` et `viewer`. Voir [partager et collaborer](compartir-y-colaborar.md).

### Présence {#presencia}

Les avatars et les curseurs des autres personnes connectées au même espace de travail, en direct.

### Synchronisation (CRDT) {#sincronizacion}

La technique qu'utilise all-draw pour combiner les modifications de plusieurs personnes, ou celles faites
hors ligne, sans verrous ni conflits : toutes les copies finissent par être identiques. CRDT est le nom
technique de ce type de structure de données.

### Mode hors ligne {#sin-conexion}

Continuer à travailler quand le réseau tombe. Les espaces locaux n'ont pas besoin de réseau ; dans un
espace du serveur déjà ouvert, vous continuez à modifier une copie dans le navigateur, qui se synchronise
au retour de la connexion. Voir [hors ligne](compartir-y-colaborar.md#sin-conexion).

### PWA {#pwa}

*Progressive Web App* : all-draw peut s'installer depuis le navigateur comme s'il s'agissait d'une
application, et il démarre même sans réseau.

## Import, export et automatisation {#grupo-importar-exportar}

### JSON d'all-draw {#json-de-all-draw}

Le format propre d'all-draw (`.alldraw.json`) : il conserve l'espace de travail complet sans aucune perte.
C'est la meilleure sauvegarde. Voir [formats](importar-exportar.md#formatos).

### Export double {#exportacion-dual}

Un SVG qui s'affiche en thème clair ou sombre selon la préférence de la personne qui le regarde, dans un
seul fichier.

### HTML autonome {#html-autocontenido}

Un seul fichier `.html` avec toutes les vues, consultable hors ligne sans rien installer. Utile pour
envoyer le diagramme à des personnes qui n'utilisent pas all-draw.

### Clé d'API {#clave-api}

Un long mot de passe pour les programmes et les agents, qui agit avec vos autorisations. Vous la créez et
la révoquez dans **Compte**. Voir [clés](agentes-y-api.md#claves).

### MCP {#mcp}

*Model Context Protocol* : le protocole qu'utilise un assistant d'IA pour lire et modifier vos espaces de
travail au moyen des outils d'all-draw. Voir [MCP](agentes-y-api.md#mcp).
