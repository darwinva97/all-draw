# Premiers pas

all-draw est un outil de diagrammes dans lequel vous dessinez **un seul modèle** et le regardez à travers **de nombreuses notations** :
ArchiMate, BPMN, machine à états, C4, séquence, entité-relation, UML, carte mentale et bien d'autres. Un élément
(« Intégration client ») n'existe qu'une seule fois et peut apparaître dans autant de vues que vous le souhaitez ; renommez-le
dans l'une et il change partout. Il fonctionne dans le navigateur, sans rien installer, sur
[alldraw.bezenti.com](https://alldraw.bezenti.com).

> [!TIP]
> Vous êtes pressé ? Passez directement à [Votre premier diagramme en 5 minutes](primeros-pasos.md#primer-diagrama). Vous voulez
> comprendre l'idée avant de dessiner ? Lisez [Concepts](conceptos.md).

## Ce qu'est all-draw {#que-es}

La plupart des outils traitent chaque diagramme comme un dessin isolé : si la même application figure dans le diagramme
d'architecture et dans le diagramme de processus, ce sont deux boîtes différentes qu'il faut tenir à jour à la main. all-draw
comporte deux couches :

- Le **modèle** : les choses qui existent (processus, applications, personnes, données…) et la façon dont elles sont liées.
- Les **vues** : les diagrammes. Chaque vue dessine une partie du modèle dans une notation donnée.

C'est ce qui vous permet de passer d'un processus métier à son détail BPMN, de là à la machine à états du
dossier, et de vérifier quelles pièces ne sont pas reliées d'un niveau à l'autre. Tout cela est expliqué avec des dessins dans
[Concepts](conceptos.md).

## L'écran d'accueil {#pantalla-de-inicio}

![Écran d'accueil d'all-draw](../img/01-inicio-en.png)

En ouvrant l'application, vous voyez une courte présentation, trois boutons et, en dessous, vos espaces de travail :

| Bouton | Ce qu'il fait |
|---|---|
| **Nouvel espace** | Crée un espace de travail vide et l'ouvre dans l'éditeur. Lorsque vous êtes connecté, il s'appelle **Nouvel espace sur le serveur**. |
| **Ouvrir la démo** | Crée une copie de l'espace d'exemple « Intégration client » (voir [la démo](primeros-pasos.md#demo)). Modifiez-le sans crainte : il est à vous. |
| **Importer…** | Crée un espace de travail à partir d'un fichier : `.drawer`, `.alldraw.json`, `.archimate` (Archi), Open Exchange, BPMN 2.0 XML, Structurizr, XState, Mermaid ou OpenAPI. Voir [Importer et exporter](importar-exportar.md). |

Sur la même ligne, à droite, **Se connecter / s'inscrire** apparaît si le serveur de comptes est disponible. La première
fois, tant que vous n'avez aucun espace et que vous n'êtes pas connecté, vous voyez la page d'accueil d'all-draw au lieu de l'écran
d'accueil ; le bouton pour se connecter s'y appelle **Connexion**. Le **sélecteur de langue** se trouve en haut de l'écran.

Un **espace de travail** est l'unité de travail : il contient le modèle, toutes ses vues, les bibliothèques, les règles de style et
les personnes. Chaque espace s'ouvre à sa propre adresse web : vous pouvez donc l'ajouter à vos favoris.

La liste des espaces comporte deux sections :

- **Sur le serveur** : affichée seulement lorsque vous êtes connecté. Elle liste chaque espace avec votre rôle (**propriétaire**,
  **peut modifier** ou **lecture seule**) et la date de la dernière modification. Le propriétaire voit un bouton **Supprimer**.
- **Dans ce navigateur** : les espaces locaux. Chacun a un bouton **Supprimer** et, lorsque vous êtes connecté,
  **Envoyer sur le serveur**.

Cliquez sur le nom (ou n'importe où sur la ligne) pour ouvrir un espace.

## Espaces locaux et espaces sur le serveur {#espacios-locales-y-servidor}

all-draw fonctionne sans compte. Ce que vous créez sans vous connecter est **local** : cela vit dans le stockage de votre
navigateur. Avec un compte, vous pouvez conserver des espaces **sur le serveur** et les partager.

| | Espace local | Espace sur le serveur |
|---|---|---|
| Où il vit | Dans **ce navigateur** (sur cet ordinateur) | Sur le serveur, avec une copie dans votre navigateur |
| Adresse | `…/#/w/<id>` | `…/#/s/<id>` |
| Nécessite un compte | Non | Oui (ou un lien de partage) |
| Fonctionne hors ligne | Toujours | Oui : enregistre en local et synchronise au retour de la connexion |
| Peut être partagé | Non (il faut d'abord l'envoyer sur le serveur) | Oui : liens de modification et de lecture, modification simultanée |
| Historique des versions | Non | Oui (voir [Historique](historial.md)) |
| Il est perdu si… | Vous effacez les données du navigateur ou changez d'ordinateur | Son propriétaire le supprime |

> [!WARNING]
> Un espace local n'est copié **nulle part** automatiquement. Si vous effacez vos données de navigation, utilisez une fenêtre
> de navigation privée ou changez d'ordinateur, vous ne le verrez plus. Pour le mettre en sécurité, envoyez-le sur le serveur ou exportez-le dans un
> fichier `.alldraw.json` (voir [Importer et exporter](importar-exportar.md)).

Pour transférer un espace local sur le serveur : connectez-vous et appuyez sur **Envoyer sur le serveur**, dans la liste de l'accueil ou
dans la barre d'outils de l'éditeur. Une **copie** est créée sur le serveur et ouverte ; l'espace local reste en place jusqu'à ce que vous le
supprimiez.

Plus de détails dans [Concepts → Espaces de travail](conceptos.md#espacios).

## Créer un compte {#crear-cuenta}

Un compte est nécessaire pour conserver des espaces sur le serveur, les partager, consulter leur historique et créer des clés pour
les agents.

1. Sur l'écran d'accueil, appuyez sur **Se connecter / s'inscrire** (en haut à droite ; sur la page d'accueil, il s'appelle **Connexion**).
2. Dans la boîte de dialogue, appuyez sur **Je n'ai pas de compte**. Le titre devient **Créer un compte**.
3. Remplissez **E-mail**, **Nom** et **Mot de passe** (8 caractères minimum).
4. Si le serveur demande un **Code d'invitation**, saisissez-le (c'est l'administrateur du serveur qui vous le donne).
5. Appuyez sur **M'inscrire**. La boîte de dialogue se ferme et vous êtes connecté.

![Boîte de dialogue de connexion / création de compte](../img/02-entrar-en.png)

Pour **vous connecter** avec un compte existant : **Se connecter / s'inscrire**, saisissez votre adresse e-mail et votre mot de passe, puis appuyez sur
**Connexion**. Le lien **J'ai déjà un compte** vous ramène de l'inscription à la connexion.

Une fois connecté :

- Le premier bouton devient **Nouvel espace sur le serveur** et **Ouvrir la démo** crée la démo sur le
  serveur.
- La section **Sur le serveur** apparaît.
- En haut à droite, vous voyez votre nom. Un clic dessus ouvre le menu du compte, avec **Compte et clés d'API** et
  **Se déconnecter**.

**Compte et clés d'API** ouvre l'écran **Compte**, où vous pouvez créer des clés pour les agents (voir
[Agents et API](agentes-y-api.md)), **Changer le mot de passe**, consulter vos **Sessions actives** et fermer celles
que vous ne reconnaissez pas, et **Fermer toutes les sessions**. Si vous êtes administrateur, la liste **Utilisateurs du serveur**
s'y trouve aussi.

À côté de votre nom se trouve la **cloche** des notifications : elle vous prévient quand quelqu'un vous mentionne dans un
commentaire, partage un espace avec vous, change votre rôle ou restaure une version de l'un de vos espaces
(voir [notifications](compartir-y-colaborar.md#notificaciones)). Si le serveur envoie des e-mails, l'inscription
vous envoie un lien pour **confirmer votre adresse e-mail** (voir [confirmer votre adresse e-mail](compartir-y-colaborar.md#verificar-correo)).

La session dure 30 jours et se renouvelle d'elle-même tant que vous utilisez l'application. Le premier utilisateur à s'inscrire sur un serveur
en devient l'administrateur.

> [!NOTE]
> Chaque serveur décide si l'inscription est **ouverte**, **sur invitation** ou **fermée**. Si elle est fermée, la
> boîte de dialogue l'indique (« Les inscriptions sont fermées sur ce serveur. ») et le bouton **M'inscrire** est désactivé : demandez un compte à
> l'administrateur du serveur.

## Votre premier diagramme en 5 minutes {#primer-diagrama}

Dessinons un tout petit processus BPMN : *Commande reçue → Préparer la commande → Commande expédiée*.

1. Sur l'écran d'accueil, appuyez sur **Nouvel espace**. L'éditeur s'ouvre avec un espace vide.
2. En haut, cliquez sur le nom « Nouvel espace » et saisissez le vôtre, par exemple *Boutique*.
3. Dans le panneau **Vues** (colonne de gauche), appuyez sur le bouton **+** et choisissez **BPMN 2.0**. La vue
   « Nouvelle vue BPMN 2.0 » est créée et ouverte.
4. Cliquez sur une zone vide du canevas : l'**inspecteur** (colonne de droite) affiche la vue. Renommez-la
   *Processus de commande*.
5. Dans la **palette** (sous Vues), onglet **Notation**, trouvez **Événement de début** et **faites-le glisser** sur le canevas.
6. Le nouveau nœud étant sélectionné, appuyez sur **F2**, saisissez *Commande reçue* et appuyez sur **Enter**.
7. Recommencez avec une **Tâche** (*Préparer la commande*) et un **Événement de fin** (*Commande expédiée*), placés de gauche à droite.
   Vous pouvez utiliser le champ **Rechercher…** de la palette pour les trouver plus vite.
8. Reliez-les : approchez la souris du **bord inférieur** de *Commande reçue* jusqu'à voir le point de connexion,
   faites glisser jusqu'à *Préparer la commande* et relâchez. Dans le menu **Type de relation**, choisissez **Flux de séquence** (il apparaît
   en premier). Faites de même de *Préparer la commande* à *Commande expédiée*.
9. Regardez la barre en bas du canevas : c'est le **panneau des problèmes**. Si quelque chose enfreint les règles de BPMN,
   il vous le signalera là.
10. C'est fini. Il n'y a rien à enregistrer : l'indicateur d'état de la barre d'outils affiche `enregistré dans ce navigateur`.

> [!TIP]
> Une erreur ? **Ctrl+Z** annule et **Ctrl+Y** rétablit (sur Mac, **Cmd+Z** et **Cmd+Y**). Tous les
> raccourcis sont dans [Raccourcis](atajos.md).

Ensuite : sélectionnez *Préparer la commande* et regardez l'inspecteur (onglets **Données**, **Broches**, **Où**, **Style**). Puis
essayez de créer une autre vue et d'y faire glisser *Préparer la commande* depuis l'onglet **Modèle** de la palette : vous verrez le même
élément dans deux vues. C'est ce qu'explique [Modèle et vues](modelo-y-vistas.md).

## La démo « Intégration client » {#demo}

La démo est le meilleur moyen de comprendre all-draw. Elle modélise la façon dont une banque intègre un nouveau client et dessine le
même modèle dans **six dimensions**. Son contenu suit la langue de l'interface :

| Vue | Notation | Ce qu'elle montre |
|---|---|---|
| Architecture · Intégration client | ArchiMate 3.2 (viewpoint *Layered*) | Acteur, rôle, processus, service, composants, données et nœud |
| Intégration client · BPMN | BPMN 2.0 | Le processus pas à pas, avec un pool « Banque » et deux couloirs |
| Intégration client · États | Machine à états | Le cycle de vie du dossier : en attente, en vérification, actif, refusé |
| CRM · Conteneurs | C4 (viewpoint *Conteneur*) | Les conteneurs du CRM (portail, API, base de données) et le fournisseur KYC externe |
| Intégration client · Séquence | Diagramme de séquence | Client, portail, API et base de données échangeant des messages |
| Carte couches × étapes | Couches × étapes | Les mêmes éléments dans une grille Métier/Application/Technologie × Acquisition/Intégration/Exploitation, avec deux microservices issus d'une bibliothèque reliés par des **broches** |

Elle comprend aussi deux règles de style (« Externes en gris » et « Services sans dépôt »), une bibliothèque « Systèmes » avec le type *Microservice*, et plusieurs **traces**
entre notations (par exemple, la tâche BPMN « Vérifier l'identité » est tracée vers le service ArchiMate
« Vérification KYC »).

![Éditeur affichant la vue ArchiMate de la démo](../img/03-editor-archimate-en.png)

Ouvrez-la avec **Ouvrir la démo** et essayez ces quatre choses :

1. **Double-cliquez** sur le processus « Intégration client » dans la vue ArchiMate : vous entrez dans sa vue de détail BPMN. Le
   **chemin des vues** apparaît en haut, avec le bouton **retour** pour revenir.
2. **Clic droit** sur n'importe quel nœud → **Ouvrir dans une autre dimension** : la liste des dimensions. Celles qui ont déjà
   une vue l'ouvrent ; celles marquées **(créer)** créent une nouvelle vue.
3. Dans « Carte couches × étapes », sélectionnez `clients-api` et ouvrez l'onglet **Broches** de l'inspecteur : vous verrez la
   broche `cliente.email` reliée à `notifications`.
4. Sélectionnez n'importe quel élément et ouvrez l'onglet **Où** : il liste toutes les vues où l'élément apparaît.

## Enregistrement automatique et indicateur d'état {#guardado}

Il n'y a pas de bouton Enregistrer. Chaque modification est enregistrée immédiatement dans votre navigateur et, si l'espace est sur le
serveur, envoyée dès qu'il y a une connexion. L'indicateur de la barre d'outils de l'éditeur vous indique l'état :

| Indicateur | Signification |
|---|---|
| `enregistré dans ce navigateur` | Espace local. Tout est enregistré dans ce navigateur. |
| `● en ligne` | Espace sur le serveur, connecté. Les modifications sont envoyées instantanément. |
| `◌ connexion…` | Tentative de connexion au serveur. Vous pouvez continuer à travailler. |
| `○ hors ligne (se synchronise au retour)` | Pas de connexion. Vos modifications sont conservées en local et envoyées au retour du réseau. |

Dans les espaces sur le serveur, votre rôle (**propriétaire**, **peut modifier** ou **lecture seule**) s'affiche à côté de l'indicateur. En
**lecture seule**, vous pouvez regarder mais pas modifier.

Les espaces sur le serveur conservent aussi des **instantanés** automatiques que vous pouvez restaurer depuis le bouton **Historique** (voir
[Historique](historial.md)).

## Installer comme application (PWA) {#instalar-pwa}

all-draw est une **application web installable** (PWA) : vous pouvez l'avoir sur votre bureau ou sur l'écran d'accueil de votre téléphone ;
elle s'ouvre dans sa propre fenêtre et se charge même hors ligne.

1. Ouvrez [alldraw.bezenti.com](https://alldraw.bezenti.com) dans Chrome, Edge ou un autre navigateur compatible.
2. Sur un ordinateur : cliquez sur l'icône d'**installation** dans la barre d'adresse (ou menu du navigateur → *Installer all-draw*).
3. Sur un téléphone : menu du navigateur → *Ajouter à l'écran d'accueil* (dans Safari sur iPhone, bouton *Partager* → *Sur l'écran
   d'accueil*).

L'application installée se met à jour d'elle-même lorsqu'une nouvelle version est disponible. Vos espaces sont les mêmes que dans le
navigateur où vous l'avez installée.

## Langue {#idioma}

L'interface est disponible en **espagnol**, en **anglais**, en **portugais** et en **français**. La première fois, elle suit la langue de votre navigateur
(anglais, portugais ou français si votre navigateur est réglé dans l'une de ces langues ; espagnol sinon).

Pour la changer, utilisez le sélecteur **Español / English / Português / Français** : il se trouve en haut de l'écran d'accueil et aussi dans la barre d'outils de
l'éditeur (sur un téléphone, dans le panneau **Plus**). Le changement est immédiat et mémorisé dans ce navigateur.

> [!NOTE]
> La langue change les textes de l'interface et les noms des types et des catégories de la palette. Elle ne traduit
> **pas** ce que vous écrivez (noms des éléments, documentation). Les noms des types ArchiMate restent en anglais dans
> toutes les langues, comme dans la spécification. Le manuel est traduit en partie : les chapitres qui ne le sont
> pas encore s'affichent en anglais avec un avertissement.

## Problèmes fréquents {#problemas-frecuentes}

**Je ne vois pas le bouton « Se connecter / s'inscrire » (ou « Connexion » sur la page d'accueil).**
Il n'apparaît que lorsque le serveur de comptes répond. Vérifiez votre connexion et rechargez la page. En attendant, vous
pouvez travailler avec des espaces locaux.

**Mes espaces ont disparu.**
S'ils étaient locaux, ils vivent dans le navigateur où vous les avez créés : vérifiez que vous utilisez le même navigateur
et le même profil, et pas une fenêtre de navigation privée. Si vous avez effacé les données du site, les espaces locaux sont perdus. C'est
pourquoi il vaut la peine de les envoyer sur le serveur ou de les exporter.

**J'ai oublié mon mot de passe.**
Appuyez sur **Connexion → Mot de passe oublié ?**. Si le serveur envoie des e-mails, il vous envoie un lien (valable une heure,
à usage unique) pour en choisir un nouveau (voir [J'ai oublié mon mot de passe](compartir-y-colaborar.md#recuperar-contrasena)).
Sinon, demandez à l'administrateur du serveur de le réinitialiser depuis **Compte → Utilisateurs du serveur → Réinitialiser** : vous recevrez un
mot de passe temporaire que vous pourrez ensuite changer dans **Changer le mot de passe**.

**« Envoyer sur le serveur » dit qu'il me faut un compte.**
Connectez-vous d'abord sur l'écran d'accueil, puis appuyez de nouveau sur **Envoyer sur le serveur**.

**L'indicateur reste sur `○ hors ligne`.**
Vos modifications ne sont pas perdues : elles sont toujours dans le navigateur. Elles sont envoyées automatiquement au retour de la
connexion. Si cela tarde trop, rechargez la page.

**Je ne peux rien modifier dans un espace partagé.**
Vérifiez votre rôle à côté de l'indicateur : en **lecture seule** (ou avec un lien de lecture), vous pouvez seulement regarder. Demandez au
propriétaire un lien de modification (voir [Partager et collaborer](compartir-y-colaborar.md)).

## Étapes suivantes {#siguientes-pasos}

- [Concepts](conceptos.md) : modèle et vues, dimensions, broches, traces et viewpoints, avec des dessins.
- [L'éditeur](editor.md) : chaque zone de l'écran et comment l'utiliser.
- [Modèle et vues](modelo-y-vistas.md) : créer des vues, naviguer entre les dimensions, retirer et supprimer.
- [Raccourcis](atajos.md) : clavier, souris et gestes tactiles.
- [FAQ](faq.md) : questions fréquentes.
