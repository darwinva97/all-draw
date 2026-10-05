# Questions fréquentes

Des réponses courtes aux questions les plus courantes. Chacune renvoie au chapitre où elle est expliquée
en détail.

## Premiers pas {#empezar}

### Qu'est-ce qu'all-draw et en quoi diffère-t-il des autres outils de diagrammes ? {#que-es}

C'est un outil de diagrammes où **un seul modèle** se dessine dans **plusieurs notations** : le processus
« Intégration client » peut apparaître dans une carte ArchiMate, dans un diagramme BPMN et dans une
machine à états, et il reste une seule et même chose. Renommez-le à un endroit et il change partout. Voir
[concepts](conceptos.md).

### Ai-je besoin d'un compte ? {#necesito-cuenta}

Non. Sans compte, vous travaillez avec des **espaces locaux**, enregistrés dans votre navigateur. Il vous
faut un compte pour enregistrer sur le serveur, partager et disposer d'un historique. Voir
[premiers pas](primeros-pasos.md).

### Je n'arrive pas à créer un compte. Pourquoi ? {#no-puedo-registrarme}

Chaque serveur décide si l'inscription est ouverte, si elle exige un **code d'invitation** ou si elle est
fermée (« Les inscriptions sont fermées sur ce serveur. »). Dans les deux derniers cas, demandez un accès à la
personne qui gère le serveur. En attendant, vous pouvez utiliser des espaces locaux.

### Puis-je l'utiliser sur un téléphone ou une tablette ? {#movil}

Oui. Sur tablette, les panneaux se replient ; sur téléphone, une barre apparaît en bas et les panneaux
glissent sous forme de feuilles. Un **appui long** remplace le clic droit. Pour les grands diagrammes, un
écran plus grand est plus confortable. Voir [éditeur](editor.md).

### Comment changer la langue ou le thème ? {#idioma-y-tema}

La **langue** (espagnol, anglais, portugais ou français) se choisit dans le sélecteur
**Español / English / Português / Français** de l'écran d'accueil ou de la barre d'outils de l'éditeur ; elle est
mémorisée dans ce navigateur. La première fois, elle suit la langue du navigateur (anglais, portugais ou
français si le navigateur est dans l'une de ces langues ; sinon, espagnol). Le manuel est traduit en partie :
les chapitres qui ne le sont pas encore s'affichent en anglais avec un avertissement. Les noms des types
ArchiMate restent en anglais dans toutes les langues. Le **thème** se change avec le bouton de la
barre d'outils de l'éditeur, qui passe successivement par *système* → *clair* → *sombre*. Voir
[éditeur](editor.md).

### Y a-t-il des raccourcis clavier ? {#atajos}

Oui : appuyez sur **?** dans l'éditeur pour tous les voir, ou consultez [raccourcis](atajos.md). Les plus
utiles : **Ctrl+Z** annuler, **Ctrl+Y** rétablir, **Ctrl+K** rechercher, **F2** renommer, **Suppr** retirer
de la vue.

## Enregistrement et données {#guardar-y-datos}

### L'enregistrement est-il automatique ? {#se-guarda-solo}

Oui, toujours. Il n'y a pas de bouton d'enregistrement. Dans un espace local, chaque modification est
enregistrée instantanément dans le navigateur (« enregistré dans ce navigateur »). Dans un espace du
serveur, les modifications sont envoyées en moins d'une seconde ; l'indicateur « ● en ligne » confirme la
connexion. Voir [premiers pas](primeros-pasos.md).

### Est-ce que ça fonctionne hors ligne ? {#sin-conexion}

Oui. Les espaces locaux n'ont jamais besoin de réseau, et l'application démarre hors ligne. Les espaces du
serveur que vous avez déjà ouverts dans ce navigateur s'ouvrent aussi hors ligne, à partir de leur copie et
avec la dernière autorisation dont vous disposiez (« ○ hors ligne — les modifications seront
synchronisées ») ; si la connexion tombe pendant que vous travaillez, l'indicateur passe à « ○ hors ligne
(se synchronise au retour) » et vous continuez à modifier. Au retour du réseau, vos autorisations sont
vérifiées et tout est fusionné. Seul un espace du serveur que vous n'avez jamais ouvert dans ce navigateur
a besoin du réseau pour s'ouvrir. Voir [hors ligne](compartir-y-colaborar.md#sin-conexion).

### Où sont mes espaces locaux et comment éviter de les perdre ? {#espacios-locales}

Ils sont **dans ce navigateur, sur cet ordinateur**, dans la liste « Dans ce navigateur » de l'écran
d'accueil. Ils ne passent pas à un autre navigateur ni à un autre ordinateur, et ils sont perdus si vous
effacez les données du site ou utilisez une fenêtre de navigation privée. Pour les protéger : exportez de
temps en temps un **JSON d'all-draw** (`.alldraw.json`) ou envoyez-les sur le serveur. Voir
[espaces de travail](conceptos.md#espacios).

### Comment transférer un espace local sur le serveur ? {#subir-al-servidor}

Une fois connecté, cliquez sur **Envoyer sur le serveur**, dans la barre d'outils de l'éditeur ou à côté
de l'espace sur l'écran d'accueil. Une **copie** est créée sur le serveur et ouverte ; l'original local
reste dans votre navigateur jusqu'à ce que vous le supprimiez. Voir [premiers pas](primeros-pasos.md).

### Comment revenir à une version antérieure ? {#version-anterior}

- Une erreur d'il y a un instant : **Ctrl+Z**.
- Un espace du serveur d'il y a quelques heures ou quelques jours : **Historique** → **Restaurer** sur
  l'instantané voulu (l'état actuel est d'abord enregistré).
- Un espace local : importez le dernier `.alldraw.json` que vous avez exporté.

Voir [historique](historial.md).

### Combien ça coûte ? Y a-t-il des limites ? {#coste-y-limites}

Le service sur alldraw.bezenti.com est **gratuit** et géré par une petite équipe : il n'y a aucune
garantie de disponibilité (SLA) ni d'assistance avec des délais de réponse. Des limites existent pour que
le service reste utilisable par tous : chaque compte peut posséder jusqu'à 100 espaces, chaque espace peut
occuper jusqu'à 20 Mo, un fichier que vous importez sur le serveur peut faire jusqu'à 5 Mo, chaque espace
conserve jusqu'à 100 instantanés et les tentatives de connexion sont limitées. Vos quotas s'affichent dans
**Compte**. Voir [conditions](terminos.md).

### Mes données sont-elles privées ? {#privacidad}

Vos espaces du serveur ne sont visibles que par vous, par les personnes à qui vous donnez accès et, lorsque
c'est nécessaire pour la maintenance ou pour résoudre un incident, par la personne qui administre le
serveur. Il n'y a ni publicité ni outil d'analyse tiers. Les espaces locaux ne quittent jamais votre
navigateur. Voir [confidentialité](privacidad.md).

### Le service ne répond pas. Où vérifier s'il est en panne ? {#estado-del-servicio}

Sur la [page d'état](https://alldraw-monitor.darwin-sva-97.workers.dev) (aussi dans le pied de page de
l'application, **État du service**) : elle est vérifiée toutes les 5 minutes et affiche la disponibilité
des dernières 24 heures et des 7 derniers jours ainsi que les derniers incidents. Tant que le serveur
principal est en panne, les espaces que vous avez déjà ouverts dans votre navigateur restent disponibles
hors ligne, et [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev) héberge une
**copie de secours en lecture seule**, mise à jour chaque nuit, où vous pouvez vous connecter avec votre
compte et consulter vos diagrammes (sans les modifier : les modifications se font sur
https://alldraw.bezenti.com).

## Modification {#editar}

### Quelle différence entre supprimer de la vue et supprimer du modèle ? {#borrar-vista-o-modelo}

**Suppr** (ou clic droit → **Retirer de cette vue**) retire le dessin de cette vue ; l'élément reste dans le
modèle et dans les autres vues. Clic droit → **Supprimer du modèle** le supprime réellement, de toutes les
vues, avec ses relations. Voir [modèle et vues](modelo-y-vistas.md).

### Pourquoi ne puis-je pas connecter ces deux éléments ? {#no-puedo-conectar}

Parce que la notation de la vue n'autorise **aucune** relation entre ces deux types : chaque notation a une
[matrice de validité](conceptos.md#validez) et l'éditeur la respecte. Si vous connectez des broches, leurs
champs doivent aussi être compatibles. Essayez un autre type d'élément, connectez dans l'autre sens ou
utilisez une [trace](conceptos.md#trazas) s'ils appartiennent à des niveaux différents. Voir
[éditeur](editor.md).

### Puis-je mettre le même élément dans plusieurs diagrammes ? {#mismo-elemento}

Oui, c'est l'idée centrale. Faites-le glisser depuis l'onglet **Modèle** de la palette vers une autre vue,
ou utilisez clic droit → **Ouvrir dans une autre dimension**. Voir [modèle et vues](modelo-y-vistas.md).

### Pourquoi ne puis-je rien modifier ? {#solo-lectura}

Vous êtes en mode **lecture seule** : vous avez le rôle **lecture seule** ou vous êtes arrivé par un lien
de lecture. Demandez un lien de modification au propriétaire. Voir
[partager et collaborer](compartir-y-colaborar.md).

### Comment laisser des commentaires à mes collègues ? {#comentar}

Clic droit sur un nœud → **Commenter**, ou sur le canevas → **Commenter ici**. Vous pouvez répondre,
mentionner avec @ et résoudre. Voir [commentaires](comentarios.md).

## Notations {#notaciones}

### Quelles notations puis-je utiliser ? {#que-notaciones}

ArchiMate, BPMN, machine à états, C4, couches × étapes, libre, séquence, entité-relation, classes UML,
carte mentale, logigramme et flux de données (DFD). Voir [notations](notaciones.md).

### Qu'est-ce qu'une dimension ? {#que-es-dimension}

Une autre façon de voir le même élément à travers une autre notation : le processus en ArchiMate, son
détail en BPMN et son cycle de vie sous forme de machine à états. Voir
[dimensions](conceptos.md#dimensiones).

## Collaboration {#colaborar}

### Comment inviter quelqu'un ? {#invitar}

Dans un espace du serveur dont vous êtes propriétaire, cliquez sur **Partager** → **Nouveau lien de
modification** (ou **Nouveau lien de lecture**) → **Copier le lien**, puis envoyez le lien. La personne qui
l'ouvre n'a pas besoin de compte. Vous pouvez le **révoquer** quand vous voulez. Voir
[inviter](compartir-y-colaborar.md#invitar).

### Que se passe-t-il si deux personnes modifient la même chose en même temps ? {#edicion-simultanea}

Rien de grave : les modifications sont combinées sans verrous et tout le monde finit par voir la même
chose. Si deux personnes changent **exactement la même donnée** au même moment (par exemple, le nom du même
élément), l'une des deux valeurs est conservée, la même pour tout le monde. **Ctrl+Z** n'annule que vos
propres modifications, jamais celles des autres. Voir [partager et collaborer](compartir-y-colaborar.md).

### Suis-je averti quand quelqu'un me mentionne ou partage un espace avec moi ? {#notificaciones}

Oui, dans les espaces du serveur : la **cloche** à côté de votre nom compte les notifications non lues
(mentions, espaces partagés avec vous, changements de rôle et versions restaurées dans vos espaces). Pour
qu'une mention vous parvienne, votre e-mail doit figurer sur votre fiche dans **Espace → Personnes** (ou
vous devez signer vos commentaires avec le même nom). Si le serveur envoie des e-mails, les mentions
arrivent aussi par e-mail ; désactivez-le dans **Compte → E-mail et notifications**. Voir
[notifications](compartir-y-colaborar.md#notificaciones) et
[qui est notifié](comentarios.md#aviso-de-mencion).

### Comment retirer l'accès à quelqu'un ? {#quitar-acceso}

**Partager** → **Révoquer** à côté du lien que vous lui avez donné. Dès lors, le lien n'ouvre plus
l'espace, et toute personne qui l'a ouvert est déconnectée immédiatement avec le message « Vous n'avez plus
accès à cet espace ». Si plusieurs personnes utilisaient le même lien, créez-en un nouveau pour celles qui
doivent garder l'accès. Voir [révoquer un lien](compartir-y-colaborar.md#revocar).

## Import et export {#importar-y-exportar}

### Comment importer un modèle depuis Archi ? {#importar-archi}

Sur l'écran d'accueil, cliquez sur **Importer…** et choisissez le fichier `.archimate` (ou un `.xml` Open
Exchange). Un nouvel espace est créé avec les éléments, les relations et les vues. Voir
[Archi](importar-exportar.md#archi).

### Puis-je exporter en image ? {#exportar-imagen}

Oui, depuis **Importer / Exporter**, pour la vue ouverte : **SVG** (un seul fichier qui s'affiche
correctement en thème clair comme en thème sombre) ou **PNG** en double résolution. Pour toutes les vues à
la fois, **HTML autonome**. Voir [formats](importar-exportar.md#formatos).

### Puis-je emporter un diagramme BPMN vers d'autres outils ? {#exportar-bpmn}

Oui : **Importer / Exporter → BPMN 2.0 XML** produit un fichier standard que les autres outils BPMN
savent ouvrir. Vous pouvez aussi en importer. Voir [BPMN](importar-exportar.md#bpmn).

### L'import remplace-t-il ce que j'ai ? {#importar-sustituye}

Depuis l'**écran d'accueil**, l'import crée un **nouvel** espace. Depuis le menu **Importer / Exporter** de
l'éditeur, l'import **remplace** le contenu de l'espace ouvert (une confirmation vous est demandée). Avant
de le faire, exportez un `.alldraw.json` ou, dans un espace du serveur, créez un instantané nommé dans
**Historique**, au cas où vous voudriez revenir en arrière.

## Compte et sécurité {#cuenta-y-seguridad}

### J'ai oublié mon mot de passe. Que faire ? {#olvide-contrasena}

Appuyez sur **Connexion → Mot de passe oublié ?**. Si le serveur envoie des e-mails, saisissez votre e-mail
et vous recevrez un lien pour choisir un nouveau mot de passe : il ne fonctionne **qu'une fois**, expire
au bout d'**une heure**, et son utilisation ferme toutes les sessions. Si le serveur **n'envoie pas
d'e-mails**, la boîte de dialogue l'indique : demandez à un administrateur de le réinitialiser ; il vous
donnera un mot de passe temporaire que vous changerez dans **Compte → Changer le mot de passe**. Voir
[j'ai oublié mon mot de passe](compartir-y-colaborar.md#recuperar-contrasena).

### Pourquoi dois-je confirmer mon e-mail ? {#confirmar-correo}

Pour que le serveur sache que l'adresse est bien la vôtre : les liens de récupération du mot de passe et
les avis de mention y sont envoyés. L'inscription (ou le changement d'e-mail) vous envoie un lien qui
expire au bout de 24 heures ; si vous l'avez manqué, utilisez **Compte → Renvoyer le lien**. Certains
serveurs ne vous laissent pas créer d'espaces sur le serveur tant que vous ne l'avez pas confirmé ; les
espaces de votre navigateur fonctionnent toujours. Voir
[confirmer votre e-mail](compartir-y-colaborar.md#verificar-correo).

### Comment voir où je suis connecté ? {#sesiones-activas}

Dans **Compte → Sessions actives** : chaque navigateur avec son système, l'adresse IP sans son dernier
nombre, la date d'ouverture et celle de la dernière utilisation. **Fermer cette session** déconnecte
immédiatement ce navigateur. Voir [votre compte](compartir-y-colaborar.md#ajustes-cuenta).

### Comment changer mon mot de passe ou me déconnecter de tous mes appareils ? {#cambiar-contrasena}

Dans **Compte** (menu sous votre nom, en haut à droite → **Compte et clés d'API**) : **Changer le mot de
passe** ferme aussi vos autres sessions ; **Fermer toutes les sessions** les ferme toutes, y compris la
session actuelle. Dans les deux cas, les espaces ouverts dans ces navigateurs sont déconnectés
immédiatement et, si vous laissez cochée la case **Révoquer aussi les clés d'API**, vos clés cessent de
fonctionner. Pour ne quitter que ce navigateur, utilisez **Se déconnecter** dans le menu sous votre nom.
Une session inutilisée pendant 30 jours expire d'elle-même. Voir
[ce qui se passe quand les sessions sont fermées](compartir-y-colaborar.md#cerrar-sesiones).

### Comment changer mon nom ou mon e-mail ? {#cambiar-nombre}

Dans **Compte → Profil**. Pour changer votre e-mail, votre mot de passe actuel vous est demandé.

### Comment télécharger toutes mes données ? {#exportar-mis-datos}

**Compte → Vos données → Exporter mes données** télécharge un JSON contenant votre compte, vos clés d'API
(sans le secret), vos espaces avec leur contenu, leurs membres et leurs liens, ainsi que la liste des
espaces partagés avec vous. Voir [confidentialité](privacidad.md#tus-derechos).

### Comment supprimer mon compte ? {#borrar-cuenta}

Dans **Compte → Vos données → Supprimer le compte…**, saisissez votre mot de passe et confirmez. Votre
compte, vos sessions, vos clés d'API et vos accès aux espaces d'autres personnes sont supprimés. Chaque
espace dont vous êtes propriétaire passe à son **éditeur le plus ancien** (un compte auquel vous avez donné
le rôle d'éditeur) ; ceux qui n'ont pas d'éditeur sont **supprimés**. C'est irréversible : exportez d'abord
vos données. Si vous êtes le seul administrateur du serveur, vous devez d'abord en désigner un autre. Voir
[confidentialité](privacidad.md#borrar-datos).

### Puis-je utiliser all-draw avec un assistant d'IA ou depuis mes propres programmes ? {#ia-y-api}

Oui. Créez une **clé d'API** dans **Compte** et utilisez-la avec l'API REST ou le serveur MCP pour qu'un
agent puisse lire et modifier vos espaces. Voir [agents et API](agentes-y-api.md).

### Puis-je installer all-draw sur mon propre serveur ? {#autoalojar}

Oui : le code est open source (licence MIT) et peut être hébergé sur votre propre serveur ou sur
Cloudflare. Voir [auto-hébergement](agentes-y-api.md#autoalojar).
