# Privacy policy

Last updated: 3 October 2026.

This policy explains what data the all-draw service offered at **https://alldraw.bezenti.com**
(the "service") processes, why, where and for how long, and how you can exercise your rights. It is
written to be understood; if anything is unclear, write to us.

> [!NOTE]
> This policy covers the hosted service. If you use all-draw installed on your company's server or
> your own, the controller of your data is whoever runs that installation, not us.

## Who is responsible {#responsable}

- Controller: the project's author, an individual who runs the service free of charge and is publicly
  identified by the GitHub account [darwinva97](https://github.com/darwinva97).
- Privacy contact: a private report on GitHub (https://github.com/darwinva97/all-draw/security/advisories/new), visible only to the operator. For anything else, the project's public issues (https://github.com/darwinva97/all-draw/issues).
- You can do almost everything yourself without writing to anyone: exporting and deleting your data are
  in **Account → Your data**.
- If the service becomes commercial, the operator's tax details will be published here.

## Summary {#resumen}

- We only ask for what is needed for you to have an account: **email, name and password** (the
  password is stored irreversibly hashed, never in plain text).
- Your diagrams are yours. We store them to give them back to you, and use them for nothing else.
- **No advertising, no third-party analytics, no tracking.** Our only cookie is the session
  cookie.
- You can use all-draw **without an account**: local workspaces never leave your browser.
- You can take everything with you at any time by exporting an `.alldraw.json`.

## What data we process {#que-datos}

### If you use local workspaces (no account) {#datos-locales}

Nothing reaches our server. Your workspaces are stored **in your browser** (IndexedDB) and only
leave it if you decide so: when you export a file or click **Upload to server**. To download the
application your browser makes ordinary requests to the website (see
[infrastructure](#donde)).

### If you create an account {#datos-de-cuenta}

| Data | What for |
|---|---|
| Email | To identify you when you sign in. You can change it in **Account → Profile** |
| Name | To show it to the people you share with. You can change it in **Account → Profile** |
| Password | Only its fingerprint is stored (salted PBKDF2-SHA256 hash, 100,000 iterations); nobody, not even whoever runs the service, can read it |
| Sign-up date and whether you are an administrator | Account management |
| Sessions | To keep you signed in: we store a fingerprint of the session identifier and its creation and expiry dates. We do not store your IP address or your browser |
| API keys | Name, first characters, fingerprint of the key, creation date and last-used date. The full key is shown only once, when created |

### Content you store on the server {#datos-de-contenido}

- **Workspaces**: name, owner, dates and all their content (elements, relationships, views,
  libraries, rules, people and comments).
- **Members and share links**: who has access to each workspace, with which role, who created each
  link and when it expires.
- **History snapshots**: complete copies of the workspace at different moments, with who created
  them (see [history](historial.md)).
- **Comments**: text, date and the name they were signed with.

While you edit a shared workspace, your name, color, cursor and selection are sent **live** to the
other people connected (presence). This is not stored.

### Technical data {#datos-tecnicos}

- To slow down attacks (for example, many password attempts), the server counts attempts per **IP
  address** and per email for a few minutes. That count lives only in memory and is lost on
  restart; it is not stored in the database.
- **Request log**: for each request to the server we record the date, method, path (without tokens
  or passwords), result, response time, your account's internal identifier if you are signed in and
  your **truncated IP address** (without the last number, for example `203.0.113.0`), which lets us
  spot abuse without storing your exact address. The content of your diagrams is never logged.
  Technical server errors are logged too.
- **Application error reports**: if the application fails in your browser, it sends a technical
  report with the error message, where in the code it happened, the page (without tokens) and your
  browser's identification (*user agent*). It never includes diagram content. The server logs it
  with your truncated IP address.
- Our infrastructure providers (see [where](#donde)) process your IP address and the connection's
  technical data to deliver the website, and may keep logs under their own policies.
  The server's proxy (Caddy) keeps no access logs of its own; Cloudflare keeps its logs under its privacy
  policy. In the Cloudflare Workers installation, application logs are kept by Cloudflare for a few days
  to diagnose failures.

### Other people's data you enter {#datos-de-terceros}

In the **People** panel you can record other people's names, emails and teams, and you can mention
them in comments. You decide on that data: enter only what is necessary and make sure you are
allowed to. For that data, we act as a processor on your behalf.

## What we use it for and on what legal basis {#finalidades}

| Purpose | Legal basis (GDPR) |
|---|---|
| Creating and maintaining your account, storing and syncing your workspaces, sharing them as you instruct | Performance of a contract: the [terms of use](terminos.md) you accept when signing up (Art. 6(1)(b)) |
| Security: limiting attempts, protecting sessions, detecting abuse | Legitimate interest in protecting the service and its users (Art. 6(1)(f)) |
| Backups to recover the service after a failure | Legitimate interest in not losing your data (Art. 6(1)(f)) |
| Handling your requests and meeting legal obligations | Legal obligation (Art. 6(1)(c)) |

We do not use your data for advertising, we do not profile you and we make no automated decisions
about you. We do not sell or hand over data.

## Where your data is {#donde}

- **Main server**: a virtual private server (VPS) in Europe, holding the database, workspaces,
  snapshots and backups. The provider is Contabo GmbH and the server is in Germany (European Union).
- **Cloudflare**: the website goes through Cloudflare, which acts as a content delivery network and
  proxy (it manages DNS and the connection's encryption and therefore sees the traffic).
  Cloudflare, Inc. is a US company; international transfers rely on
  the EU-US Data Privacy Framework, which Cloudflare has joined, and the standard contractual clauses in
  its data processing agreement.
- **Cloudflare Workers installation**: there is also an installation of the service on Cloudflare
  Workers (a `*.workers.dev` address). If you use that address, your account data and workspaces
  are stored on Cloudflare's infrastructure, not on the VPS.

## How long we keep it {#conservacion}

| Data | Period |
|---|---|
| Account | Until it is deleted |
| Session | 30 days from last use; deleted when you sign out |
| API keys | Until you revoke them or the account is deleted |
| Workspaces and comments | Until the owner deletes them |
| Snapshots | Up to 100 per workspace; the oldest automatic ones are deleted on their own; all are deleted with the workspace |
| Server backups | 30 days; then they are deleted automatically |
| Attempt count per IP | Minutes, in memory only |
| Final copy of workspaces deleted along with an account | 30 days, with the backups |
| Request and error logs | In the server's system log, which deletes them only by rotation when it fills up; they contain the truncated IP and never diagram content |

Bear in mind that deleted data may remain for up to 30 days in backups, which are not modified;
after that it is gone.

## No advertising or tracking {#sin-rastreo}

all-draw includes no analytics tools, tracking pixels, advertising or third-party resources (fonts,
scripts) loaded from other domains. The website's content security policy only allows resources
from the service itself.

The only exception is for security: Cloudflare may add a small **bot detection** script to the page
and set its own technical security cookies (for example `__cf_bm`) to tell people apart from
automated attacks. They are not used for advertising or to follow you across other websites.
On the main domain, browser integrity check, email obfuscation and approximate IP geolocation (country only,
for security) are enabled.

## Cookies and storage in your browser {#cookies}

all-draw uses **a single cookie**, technical and necessary, so it does not require your consent:

| Name | What for | Duration |
|---|---|---|
| `alldraw_session` | Keeping you signed in (only if you have an account). It is `HttpOnly` (scripts cannot read it) and only travels to this site | 30 days from last use |

Cloudflare may add its own technical security cookies (see [no tracking](#sin-rastreo)).

The application also stores data in your browser that is **not sent** to the server:

| Where | What |
|---|---|
| `localStorage` → `alldraw:lang` | Chosen language |
| `localStorage` → `alldraw:theme` | Theme (system, light, dark) |
| `localStorage` → `alldraw:snap`, `alldraw:panels` | Editor preferences (snap to grid, open panels) |
| `localStorage` → `alldraw:index` | List of your local workspaces |
| `localStorage` → `alldraw:me` | Name to sign comments with, if present |
| `sessionStorage` → `alldraw:token:…` | A share link's token, only while the tab is open |
| IndexedDB | Your local workspaces and a copy of the server workspaces you open, so you can work offline |
| Application cache (PWA) | The application's files, so it starts without a network |

> [!WARNING]
> Signing out **does not delete** the copies of server workspaces kept by the browser. If you use a
> shared computer, clear the site's data in your browser settings when you finish.

## Who it is shared with {#terceros}

- With the **people you give access** to a workspace (by link or as members).
- With our **infrastructure providers** (VPS hosting and Cloudflare), only to provide the service
  and as processors.
- **Server administrators** can see the list of accounts (name and email) to manage them, for
  example to reset a password. Technically they can also open any workspace on the server; they only
  do so for maintenance, to fix an incident or when you ask them to.
- With authorities, only if a law requires us to.

Nobody else.

## Your rights {#tus-derechos}

You can ask at any time for:

- **Access**: to know what data of yours we hold.
- **Rectification**: to correct it.
- **Erasure**: to delete it.
- **Portability**: to take your data with you. You can already do it yourself: **Account → Your
  data → Export my data** downloads a JSON with your account, your API keys (without the secret) and
  your workspaces with their content, members and links; and **Import / Export → all-draw JSON**
  downloads a single workspace in an open format.
- **Objection and restriction** of processing based on legitimate interest.

Request it with a private report on GitHub (https://github.com/darwinva97/all-draw/security/advisories/new), visible only to the operator, giving your account's email address. We will reply within one
month. If you are not satisfied, you can lodge a complaint with the data protection
authority of your country (in the European Union, that of your member state).

## How to delete your data {#borrar-datos}

- **Local workspaces**: on the home screen, **Delete** next to the workspace; or clear the site's
  data in your browser.
- **Server workspaces**: the owner deletes them with **Delete** on the home screen. Their snapshots,
  members and links are deleted with them.
- **API keys and sessions**: **Account** → **Revoke** and **Sign out everywhere**.
- **Account**: **Account → Your data → Delete account…**, with your password. Your account,
  sessions, API keys and access to other people's workspaces are deleted. Each workspace you own
  passes to its longest-standing member who **can edit**; those without one are deleted, and a final copy of them
  is kept that is removed automatically after 30 days, like the other backups. If you cannot sign
  in, request it with a private report on GitHub (https://github.com/darwinva97/all-draw/security/advisories/new), visible only to the operator.

## Security {#seguridad}

- Encrypted connection (HTTPS) and strict security headers.
- Passwords hashed with salted PBKDF2; sessions and API keys stored only as fingerprints.
- `HttpOnly`, `SameSite` session cookie, with protection against requests from other sites.
- Limits on sign-in and sign-up attempts.
- Daily backups.

If you find a security problem, report it privately at
https://github.com/darwinva97/all-draw/security.

No system is infallible. If we detect a breach affecting your data, we will let you know and report
it to the authority when the law requires it.

## Minors {#menores}

The service is not aimed at children under 14. If you are under that age, do not create an account.

## Changes to this policy {#cambios}

If we change anything important, we will announce it in [what's new](novedades.md) and update the
date at the top. If the change affects how we use your data, we will let you know before it applies.
