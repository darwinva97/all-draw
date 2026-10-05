# Politique de confidentialité

Dernière mise à jour : 5 octobre 2026.

Cette politique explique quelles données traite le service all-draw proposé sur
**https://alldraw.bezenti.com** (le « service »), pourquoi, où et pendant combien de temps, et comment
vous pouvez exercer vos droits. Elle est rédigée pour être comprise ; si quelque chose n'est pas clair,
écrivez-nous.

> [!NOTE]
> Cette politique couvre le service hébergé. Si vous utilisez all-draw installé sur le serveur de votre
> entreprise ou sur le vôtre, le responsable du traitement de vos données est la personne qui exploite
> cette installation, et non nous.

## Qui est responsable {#responsable}

- Responsable du traitement : l'auteur du projet, une personne physique qui exploite le service
  gratuitement et qui est identifiée publiquement par le compte GitHub
  [darwinva97](https://github.com/darwinva97).
- Contact pour la confidentialité : un [signalement privé sur GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visible uniquement par l'exploitant. Pour tout le reste, les [tickets publics du projet](https://github.com/darwinva97/all-draw/issues).
- Vous pouvez presque tout faire vous-même sans écrire à personne : l'export et la suppression de vos
  données se trouvent dans **Compte → Vos données**.
- Si le service devient commercial, les informations fiscales de l'exploitant seront publiées ici.

## Résumé {#resumen}

- Nous ne demandons que le nécessaire pour que vous ayez un compte : **e-mail, nom et mot de passe** (le
  mot de passe est stocké sous forme hachée irréversible, jamais en clair).
- Vos diagrammes vous appartiennent. Nous les stockons pour vous les restituer et ne les utilisons à
  aucune autre fin.
- **Pas de publicité, pas d'outil d'analyse tiers, pas de pistage.** Notre seul cookie est le cookie de
  session.
- Vous pouvez utiliser all-draw **sans compte** : les espaces locaux ne quittent jamais votre navigateur.
- Vous pouvez tout emporter à tout moment en exportant un `.alldraw.json`.

## Quelles données nous traitons {#que-datos}

### Si vous utilisez des espaces locaux (sans compte) {#datos-locales}

Rien n'atteint notre serveur. Vos espaces sont stockés **dans votre navigateur** (IndexedDB) et n'en
sortent que si vous le décidez : lorsque vous exportez un fichier ou cliquez sur **Envoyer sur le
serveur**. Pour télécharger l'application, votre navigateur effectue des requêtes ordinaires vers le site
(voir [infrastructure](#donde)).

### Si vous créez un compte {#datos-de-cuenta}

| Donnée | Finalité |
|---|---|
| E-mail | Vous identifier lors de la connexion. Vous pouvez le modifier dans **Compte → Profil** |
| Nom | L'afficher aux personnes avec qui vous partagez. Vous pouvez le modifier dans **Compte → Profil** |
| Mot de passe | Seule son empreinte est stockée (hachage PBKDF2-SHA256 salé, 100 000 itérations) ; personne, pas même la personne qui exploite le service, ne peut le lire |
| Date d'inscription et statut d'administrateur | Gestion du compte |
| Sessions | Vous garder connecté : nous stockons une empreinte de l'identifiant de session ainsi que ses dates de création et d'expiration. Nous ne stockons ni votre adresse IP ni votre navigateur |
| Clés d'API | Nom, premiers caractères, empreinte de la clé, date de création et date de dernière utilisation. La clé complète n'est affichée qu'une seule fois, lors de sa création |

### Contenu que vous stockez sur le serveur {#datos-de-contenido}

- **Espaces de travail** : nom, propriétaire, dates et tout leur contenu (éléments, relations, vues,
  bibliothèques, règles, personnes et commentaires).
- **Membres et liens de partage** : qui a accès à chaque espace, avec quel rôle, qui a créé chaque lien et
  quand il expire.
- **Instantanés de l'historique** : copies complètes de l'espace à différents moments, avec la personne qui
  les a créés (voir [historique](historial.md)).
- **Commentaires** : texte, date et nom avec lequel ils ont été signés.

Pendant que vous modifiez un espace partagé, votre nom, votre couleur, votre curseur et votre sélection
sont envoyés **en direct** aux autres personnes connectées (présence). Ces informations ne sont pas
stockées.

### Données techniques {#datos-tecnicos}

- Pour freiner les attaques (par exemple, de nombreuses tentatives de mot de passe), le serveur compte
  les tentatives par **adresse IP** et par e-mail pendant quelques minutes. Ce décompte ne vit qu'en
  mémoire et est perdu au redémarrage ; il n'est pas stocké dans la base de données.
- **Journal des requêtes** : pour chaque requête au serveur, nous enregistrons la date, la méthode, le
  chemin (sans jetons ni mots de passe), le résultat, le temps de réponse, l'identifiant interne de votre
  compte si vous êtes connecté et votre **adresse IP tronquée** (sans le dernier nombre, par exemple
  `203.0.113.0`), ce qui nous permet de repérer les abus sans stocker votre adresse exacte. Le contenu de
  vos diagrammes n'est jamais journalisé. Les erreurs techniques du serveur sont également journalisées.
- **Rapports d'erreur de l'application** : si l'application plante dans votre navigateur, elle envoie un
  rapport technique contenant le message d'erreur, l'endroit du code où l'erreur s'est produite, la page
  (sans jetons) et l'identification de votre navigateur (*user agent*). Il n'inclut jamais le contenu du
  diagramme. Le serveur l'enregistre avec votre adresse IP tronquée.
- Nos fournisseurs d'infrastructure (voir [où](#donde)) traitent votre adresse IP et les données
  techniques de la connexion pour délivrer le site, et peuvent conserver des journaux selon leurs propres
  politiques. Le proxy du serveur (Caddy) ne conserve pas de journaux d'accès propres ; Cloudflare conserve
  les siens selon sa politique de confidentialité. Dans l'installation sur Cloudflare Workers, les
  journaux de l'application sont conservés par Cloudflare pendant quelques jours afin de diagnostiquer les
  pannes.

### Données d'autres personnes que vous saisissez {#datos-de-terceros}

Dans le panneau **Personnes**, vous pouvez enregistrer les noms, e-mails et équipes d'autres personnes, et
vous pouvez les mentionner dans des commentaires. C'est vous qui décidez de ces données : ne saisissez que
le nécessaire et assurez-vous d'y être autorisé. Pour ces données, nous agissons en tant que sous-traitant
pour votre compte.

## À quelles fins et sur quelle base légale {#finalidades}

| Finalité | Base légale (RGPD) |
|---|---|
| Créer et maintenir votre compte, stocker et synchroniser vos espaces, les partager selon vos instructions | Exécution d'un contrat : les [conditions d'utilisation](terminos.md) que vous acceptez lors de l'inscription (art. 6.1.b) |
| Sécurité : limiter les tentatives, protéger les sessions, détecter les abus | Intérêt légitime à protéger le service et ses utilisateurs (art. 6.1.f) |
| Sauvegardes pour rétablir le service après une panne | Intérêt légitime à ne pas perdre vos données (art. 6.1.f) |
| Traiter vos demandes et respecter les obligations légales | Obligation légale (art. 6.1.c) |

Nous n'utilisons pas vos données à des fins publicitaires, nous ne faisons pas de profilage et nous ne
prenons aucune décision automatisée vous concernant. Nous ne vendons ni ne cédons de données.

## Où se trouvent vos données {#donde}

- **Serveur principal** : un serveur privé virtuel (VPS) en Europe, qui héberge la base de données, les
  espaces de travail, les instantanés et les sauvegardes. Le fournisseur est Contabo GmbH et le serveur se
  trouve en Allemagne (Union européenne).
- **Cloudflare** : le site passe par Cloudflare, qui agit comme réseau de diffusion de contenu et comme
  proxy (il gère le DNS et le chiffrement de la connexion et voit donc le trafic). Cloudflare, Inc. est
  une société américaine ; les transferts internationaux reposent sur le cadre de protection des données
  UE-États-Unis (Data Privacy Framework), auquel Cloudflare a adhéré, et sur les clauses contractuelles
  types de son accord de traitement des données.
- **Copie de secours sur Cloudflare Workers** : l'adresse
  [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev) est une **copie de secours
  en lecture seule** du service, sur l'infrastructure de Cloudflare, mise à jour **chaque nuit** avec les
  données du serveur principal (comptes, espaces de travail, membres et liens). Elle vous permet de
  consulter vos diagrammes si le serveur principal est en panne ; vous ne pouvez pas y faire de
  modifications. Ce que vous supprimez sur le serveur principal disparaît de la copie lors de la
  synchronisation suivante.
- **Sauvegardes externes** : chaque nuit, une copie de la base de données et des espaces de travail est
  envoyée vers Backblaze B2, un service de stockage de Backblaze, Inc. (États-Unis), dans sa région de
  l'est des États-Unis (`us-east`). Elles sont chiffrées au repos, conservées dans un stockage privé auquel
  seul l'exploitant a accès, et supprimées automatiquement au bout de **90 jours**. Elles ne servent qu'à
  rétablir le service après une panne grave. Les transferts internationaux reposent sur les clauses
  contractuelles types de son accord de traitement des données.
- **Surveillance de la disponibilité** : un petit service sur Cloudflare vérifie toutes les 5 minutes si le
  service répond et publie une [page d'état](https://alldraw-monitor.darwin-sva-97.workers.dev). Il ne lit
  que l'état technique (version, durée de fonctionnement et réponse de la base de données) : **il ne voit
  ni comptes, ni diagrammes, ni données personnelles**.

## Combien de temps nous les conservons {#conservacion}

| Donnée | Durée |
|---|---|
| Compte | Jusqu'à sa suppression |
| Session | 30 jours après la dernière utilisation ; supprimée lorsque vous vous déconnectez |
| Clés d'API | Jusqu'à ce que vous les révoquiez ou que le compte soit supprimé |
| Espaces de travail et commentaires | Jusqu'à ce que le propriétaire les supprime |
| Instantanés | Jusqu'à 100 par espace ; les instantanés automatiques les plus anciens sont supprimés d'eux-mêmes ; tous sont supprimés avec l'espace |
| Sauvegardes du serveur | 30 jours ; elles sont ensuite supprimées automatiquement |
| Sauvegardes externes (Backblaze) | 90 jours ; elles sont ensuite supprimées automatiquement |
| Copie de secours sur Cloudflare | Remplacée chaque nuit par le contenu du serveur principal |
| Décompte des tentatives par IP | Quelques minutes, en mémoire uniquement |
| Copie finale des espaces supprimés avec un compte | 30 jours, avec les sauvegardes |
| Journaux des requêtes et des erreurs | Dans le journal système du serveur, qui ne les supprime que par rotation lorsqu'il est plein ; ils contiennent l'adresse IP tronquée et jamais le contenu des diagrammes |

Gardez à l'esprit que des données supprimées peuvent subsister jusqu'à 30 jours dans les sauvegardes du
serveur et jusqu'à 90 jours dans les sauvegardes externes, qui ne sont pas modifiées ; passé ce délai,
elles disparaissent. Elles disparaissent de la copie de secours sur Cloudflare lors de la synchronisation
de la nuit suivante.

## Ni publicité ni pistage {#sin-rastreo}

all-draw n'inclut aucun outil d'analyse, pixel de suivi, publicité ou ressource tierce (polices, scripts)
chargée depuis d'autres domaines. La politique de sécurité du contenu du site n'autorise que les
ressources du service lui-même.

La seule exception relève de la sécurité : Cloudflare peut ajouter à la page un petit script de
**détection des bots** et déposer ses propres cookies techniques de sécurité (par exemple `__cf_bm`) pour
distinguer les personnes des attaques automatisées. Ils ne servent ni à la publicité ni à vous suivre sur
d'autres sites. Sur le domaine principal, la vérification de l'intégrité du navigateur, l'obfuscation des
adresses e-mail et la géolocalisation approximative par IP (pays uniquement, à des fins de sécurité) sont
activées.

## Cookies et stockage dans votre navigateur {#cookies}

all-draw utilise **un seul cookie**, technique et nécessaire ; il ne requiert donc pas votre
consentement :

| Nom | Finalité | Durée |
|---|---|---|
| `alldraw_session` | Vous garder connecté (uniquement si vous avez un compte). Il est `HttpOnly` (les scripts ne peuvent pas le lire) et n'est envoyé qu'à ce site | 30 jours après la dernière utilisation |

Cloudflare peut ajouter ses propres cookies techniques de sécurité (voir [pas de pistage](#sin-rastreo)).

L'application stocke aussi dans votre navigateur des données qui **ne sont pas envoyées** au serveur :

| Où | Quoi |
|---|---|
| `localStorage` → `alldraw:lang` | Langue choisie |
| `localStorage` → `alldraw:theme` | Thème (système, clair, sombre) |
| `localStorage` → `alldraw:snap`, `alldraw:panels` | Préférences de l'éditeur (magnétisme de la grille, panneaux ouverts) |
| `localStorage` → `alldraw:index` | Liste de vos espaces locaux |
| `localStorage` → `alldraw:me` | Nom avec lequel signer les commentaires, s'il existe |
| `sessionStorage` → `alldraw:token:…` | Jeton d'un lien de partage, uniquement tant que l'onglet est ouvert |
| IndexedDB | Vos espaces locaux et une copie des espaces du serveur que vous ouvrez, pour travailler hors ligne |
| Cache de l'application (PWA) | Les fichiers de l'application, pour qu'elle démarre sans réseau |

> [!WARNING]
> La déconnexion **ne supprime pas** les copies des espaces du serveur conservées par le navigateur. Si
> vous utilisez un ordinateur partagé, effacez les données du site dans les paramètres de votre navigateur
> lorsque vous avez terminé.

## Avec qui elles sont partagées {#terceros}

- Avec les **personnes à qui vous donnez accès** à un espace de travail (par lien ou en tant que membres).
- Avec nos **fournisseurs d'infrastructure** (hébergement du VPS, Cloudflare et Backblaze pour les
  sauvegardes externes), uniquement pour fournir le service et en tant que sous-traitants.
- Les **administrateurs du serveur** peuvent voir la liste des comptes (nom et e-mail) afin de les gérer,
  par exemple pour réinitialiser un mot de passe. Techniquement, ils peuvent aussi ouvrir n'importe quel
  espace du serveur ; ils ne le font que pour la maintenance, pour résoudre un incident ou lorsque vous le
  leur demandez.
- Avec les autorités, uniquement si une loi nous y oblige.

Personne d'autre.

## Vos droits {#tus-derechos}

Vous pouvez demander à tout moment :

- **Accès** : savoir quelles données vous concernant nous détenons.
- **Rectification** : les corriger.
- **Effacement** : les supprimer.
- **Portabilité** : emporter vos données. Vous pouvez déjà le faire vous-même : **Compte → Vos données →
  Exporter mes données** télécharge un JSON contenant votre compte, vos clés d'API (sans le secret) et vos
  espaces de travail avec leur contenu, leurs membres et leurs liens ; et **Importer / Exporter → JSON
  d'all-draw** télécharge un espace de travail précis dans un format ouvert.
- **Opposition et limitation** du traitement fondé sur l'intérêt légitime.

Faites-en la demande par un [signalement privé sur GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visible uniquement par l'exploitant, en indiquant l'adresse e-mail de votre compte. Nous répondrons dans un délai d'un
mois. Si vous n'êtes pas satisfait, vous pouvez introduire une réclamation auprès de l'autorité de
protection des données de votre pays (dans l'Union européenne, celle de votre État membre).

## Comment supprimer vos données {#borrar-datos}

- **Espaces locaux** : sur l'écran d'accueil, **Supprimer** à côté de l'espace ; ou effacez les données du
  site dans votre navigateur.
- **Espaces du serveur** : le propriétaire les supprime avec **Supprimer** sur l'écran d'accueil. Leurs
  instantanés, membres et liens sont supprimés avec eux.
- **Clés d'API et sessions** : **Compte** → **Révoquer** et **Fermer toutes les sessions**.
- **Compte** : **Compte → Vos données → Supprimer le compte…**, avec votre mot de passe. Votre compte, vos
  sessions, vos clés d'API et vos accès aux espaces d'autres personnes sont supprimés. Chaque espace dont
  vous êtes propriétaire passe à son membre le plus ancien qui **peut modifier** ; ceux qui n'en ont aucun
  sont supprimés, et une copie finale en est conservée, qui est effacée automatiquement au bout de 30 jours,
  comme les autres sauvegardes. Si vous ne pouvez pas vous connecter, faites-en la demande par un [signalement privé sur GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visible uniquement par l'exploitant.

## Sécurité {#seguridad}

- Connexion chiffrée (HTTPS) et en-têtes de sécurité stricts.
- Mots de passe hachés avec PBKDF2 salé ; sessions et clés d'API stockées uniquement sous forme
  d'empreintes.
- Cookie de session `HttpOnly` et `SameSite`, avec protection contre les requêtes provenant d'autres sites.
- Limitation des tentatives de connexion et d'inscription.
- Sauvegardes quotidiennes, également conservées hors du serveur (chiffrées au repos).

Si vous découvrez un problème de sécurité, signalez-le de manière privée sur
https://github.com/darwinva97/all-draw/security.

Aucun système n'est infaillible. Si nous détectons une violation affectant vos données, nous vous en
informerons et la notifierons à l'autorité lorsque la loi l'exige.

## Mineurs {#menores}

Le service ne s'adresse pas aux enfants de moins de 14 ans. Si vous avez moins de cet âge, ne créez pas de
compte.

## Modifications de cette politique {#cambios}

Si nous modifions un point important, nous l'annoncerons dans [nouveautés](novedades.md) et mettrons à jour
la date en haut de la page. Si la modification concerne la façon dont nous utilisons vos données, nous vous
en informerons avant qu'elle ne s'applique.
