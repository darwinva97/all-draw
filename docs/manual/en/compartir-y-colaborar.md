# Sharing and collaborating

In all-draw several people can work on the same workspace at the same time and see each other's changes instantly.
This chapter explains how to move a workspace to the server, how to invite other people, what each of them can do and
what happens when the connection drops. At the end is the **Account** screen, where you change your password and, if
you run the server, manage accounts.

## Local or on the server {#local-o-servidor}

Only **server** workspaces can be shared. A **local** workspace lives only in your browser.

| | Local workspace | Server workspace |
|---|---|---|
| Where it appears on the home screen | **In this browser** | **On the server** |
| Address | `#/w/<id>` | `#/s/<id>` |
| Needs an account | No | Yes, or a share link |
| Can be shared | No (it must be uploaded first) | Yes |
| Status in the bar | `saved in this browser` | `● online` · your role |

If you are signed in, **New workspace on the server** and **Import…** create server workspaces directly.

## Creating an account and signing in {#cuenta}

![Dialog to sign in or create an account](../img/02-entrar-en.png)

1. On the home screen, press **Sign in / register** (top right). If you do not have any workspace yet, you will see
   the all-draw landing page instead of the home screen: there the button is called **Sign in**.
2. If you already have an account, type your email and password and press **Sign in**.
3. If not, press **I don't have an account**, fill in email, name and a password of **at least 8 characters**, and press
   **Register**.

Depending on how the server is set up, registration may be open, require an **Invite code** (ask whoever runs the
server), or be closed ("Registration is closed on this server."). Your session lasts 30 days from the last time you use
the app; to leave, open the menu under your name (top right) and press **Sign out**.

### Confirming your email {#verificar-correo}

If the server sends emails, signing up sends you a message **Confirm your all-draw email** with a link. Open it (it works
**once** and expires in **24 hours**) and you will see **Email confirmed**. Until you confirm it, the **Account** screen
reminds you, with a **Send the link again** button (each new link cancels the previous one).

Some servers require a confirmed email to **create workspaces on the server**: until then, **New workspace on the
server** and **Upload to server** answer "Confirm your email to create workspaces on the server". The workspaces in your
browser work as usual, and you can open the ones shared with you.

### I forgot my password {#recuperar-contrasena}

1. Press **Sign in** and, in the dialog, **Forgot your password?**
2. If the server sends emails, type your email and press **Send the link**. You will see "If there is an account with
   that email, we have sent it a link": the message is the same whether or not the account exists, so it does not
   reveal who is registered.
3. Open the link in the **Reset your all-draw password** email (it works **once** and expires in **one hour**; asking
   for another one cancels the previous one).
4. Type the **New password** twice and press **Save the password**. **Every session is signed out** and open
   workspaces are disconnected (see [What happens when sessions are closed](#cerrar-sesiones)); with **Also revoke API
   keys** (ticked by default) your keys stop working as well.
5. Press **Sign in** and use the new password.

If the server **does not send emails**, **Forgot your password?** says so: ask an administrator to reset it (see
[Server administration](#administracion)).

## Uploading a local workspace to the server {#subir}

1. Sign in with your account.
2. Open the local workspace and press **Upload to server** in the editor bar. You can also do it from the home screen,
   with that workspace's **Upload to server** button in the **In this browser** list.
3. A **copy** is created on the server and opened (its address becomes `#/s/<id>`). You are its owner.

> [!IMPORTANT]
> The original local workspace **still exists** in your browser and is no longer connected to the server copy. From now
> on, work in the server copy (the **On the server** section of the home screen) and, once you are sure, delete the
> local one so you don't mix them up.

## Roles {#roles}

Each person has a role in each server workspace:

| Role | What they can do |
|---|---|
| **read-only** | See every view, search, export, read comments and follow changes live. Cannot modify anything. |
| **can edit** | Everything above, plus editing: drawing, changing data, using the Workspace panel, commenting, importing and restoring history snapshots. |
| **owner** | Everything above, plus **Share** (create and revoke links), deleting the workspace and deleting snapshots. |

In the [API](agentes-y-api.md) the same roles are called `viewer`, `editor` and `owner`.

- The **owner** is whoever creates (or uploads) the workspace.
- Server **administrators** see every workspace with owner permissions. The first user to register on a server is an
  administrator.
- Your role appears in the bar, next to the connection status (for example, `● online · can edit`), and in the
  **On the server** list on the home screen.

From the interface you share with **links**. Giving a role to a specific account (members) or transferring ownership is
done through the API for now (`PUT /api/workspaces/:id/members/:userId` with `{ "role": "editor" }`); see
[Agents and API](agentes-y-api.md).

## Inviting someone {#invitar}

Only the owner sees the **Share** button.

![Share dialog with an edit link and a read-only link](../img/10-compartir-en.png)

1. Open the workspace (it must be on the server) and press **Share**.
2. Choose what you want the other person to be able to do:
   - **New edit link**: they will be able to edit at the same time as you.
   - **New read-only link**: they will only be able to look.
3. The link appears in the list (✎ edit or 👁 read-only, with the date). Press **Copy link**: you will see "Link copied
   to the clipboard".
4. Send it through whatever channel you use (email, chat…). Whoever opens it goes straight into the workspace, **no
   account needed**.

The link looks like this: `https://alldraw.bezenti.com/#/s/<id>?token=lnk_…`. It only works for that workspace and with
that role: with a read-only link any attempt to write is rejected, including through the API.

> [!TIP]
> Create a separate link for each person or group. That way you can revoke one without cutting off the others.

When the link is opened, all-draw keeps the token in that tab and **removes it from the address bar**, so it does not
end up in history, bookmarks or screenshots. If the person closes the tab, they will need to open the original link
again.

Links can have an expiry date, but today that can only be set through the API (`expiresAt` field). At that time the
link stops opening the workspace and whoever has it **open** is disconnected right then, with the notice “You no longer
have access to this workspace”.

## Revoking a link {#revocar}

1. Press **Share**.
2. Next to the link, press **Revoke**. You will see "Link revoked".

From then on the link no longer works to open the workspace or to reconnect. Anyone who has it **open at that moment**
is disconnected immediately and sees the notice "You no longer have access to this workspace" with a **Back to home**
button; anything they had not sent no longer reaches the server, and the copy their browser kept no longer opens
offline. Revoking does not delete anything that person may have exported or copied.

The same happens when you **remove a member**, when that person's **account is deleted** and when the **workspace is
deleted** (then the notice is "This workspace has been deleted"). If a member's **role changes** (for example from
**can edit** to **read-only**), their connection is re-established on its own with the new role: they see "Your
permissions in this workspace have changed" and, if they become read-only, they stop being able to edit right away.

## Embedding diagrams in other sites {#insertar}

You can show a view in **Confluence, Notion, Jira, GitHub** or any website. It is **read-only**, with zoom and
panning, and **updates by itself** (it checks every 30 s whether the diagram has changed). Only the owner sets it up.

1. Click **Share** and open the **Embed** tab.
2. Choose the **View**, the **Theme** (automatic —follows the system theme of whoever is looking—, light or dark) and
   the **Size** (or type the width and height).
3. Click **Create embed link**. You get:
   - the **embed code**: an `<iframe>` ready to paste (**Copy code**);
   - the page **link** (**Copy link**), for sites that turn it into a box by themselves;
   - the **SVG image** (**Copy image URL** or **Copy Markdown**), for places that don't allow iframes.

The embed link (`…/embed/<workspace>/<view>?token=emb_…`) only lets people **see that view**: it doesn't open the
workspace, doesn't show the other views and doesn't work for the API. Anyone who has it can see the view, so treat it
like a read-only link. To stop showing it, click **Revoke** in the **Embed links** list: pages that embed it show
"This diagram is no longer available" within a minute. A regular read-only link (`lnk_…`) also works on the `/embed/…`
address, but it gives access to the whole workspace: an embed link is better.

On the embedded page: **drag** to move around, **Ctrl + wheel** (or the **+** and **−** buttons) to zoom, double-click
or **⤢** to fit, and **Open in all-draw ↗** to go to the workspace (it will ask you to sign in if you don't have access).

**Confluence.** Edit the page, type `/iframe` (the **Iframe** macro, or **HTML** if your administrator allows it) and
paste the address of the embed page (without the `<iframe>`), with the width and height you want. In Confluence Cloud
without an iframe macro, paste the link on its own line and choose the **Embed** view if offered.

**Notion.** Type `/embed`, choose **Embed** and paste the **link** (**Copy link**). Notion recognizes the page through
oEmbed and shows the diagram in a box you can resize.

**Jira.** In the description or a comment, paste the link and choose the **Embed** view if it appears (Jira Cloud);
otherwise insert the **SVG image** as an external image.

**GitHub** (README, issues, wikis). GitHub doesn't allow iframes: use **Copy Markdown**, which pastes the image:
`![Payment process](https://alldraw.bezenti.com/embed/<workspace>/<view>.svg?token=emb_…)`. With the automatic theme the
image follows the light or dark mode of whoever views it. GitHub caches the image for a while: changes may take a few
minutes to show.

**WordPress and other sites.** Paste the `<iframe>` code into a custom HTML block. Sites that read oEmbed (WordPress with
the link on its own line, for example) convert it by themselves.

> [!NOTE]
> To get notified of changes in Slack, Teams or Discord (instead of embedding the diagram), use the **Webhooks** tab:
> see [Webhooks](agentes-y-api.md#webhooks).

## Presence {#presencia}

In a server workspace the bar shows a colored circle with initials for each connected person (yours first). Hover over
it to see who it is and which view they are in. If there are more than six of you, "+*N*" is shown.

When you are in the same view, you also see their **cursor**, with their name, moving on the canvas.

How each person appears:

- **Signed in**, with their **account name** and a fixed color (the same on every reload and on every device). It is
  also the signature of their comments.
- **With a link and no account**, as "Anonymous" followed by a number. That name is generated the first time and saved
  in the browser, so it does not change when reloading; it is the same one used to sign their comments. If you want to
  appear with your name, sign in with your account before opening the link.

## Editing at the same time {#edicion-simultanea}

There is nothing to "lock" or "check out": several people can edit the same element at the same time and the changes
merge on their own in every browser, with no conflict warnings (synchronisation uses CRDTs). In the end everyone sees
exactly the same thing. What gets merged depends on what each person touches:

| If at the same time… | Result |
|---|---|
| One person changes an element's **name** and another its **documentation**, **fields**, **properties** or **type** | **All** the changes are kept: every field of an element, relationship, view or node syncs on its own. |
| One person moves a node and another resizes or recolours it | Both are kept. |
| Two people type in the **same long text**: the documentation of an element, relationship or view, the text of a note, a comment, or a long-text or JSON field | They are **merged character by character**, like in a shared document editor: if one types at the start and the other at the end, both sentences stay. |
| Two people change the **same short field** (the name, an option in a list, a number, a date, a node's position) | The **last** change to reach the server **wins**, and it is the same one for everyone. |
| One person edits something another person **deletes** | It stays deleted. If needed, get it back from [History](historial.md). |

Some details:

- Lists (tags, pins, points of a line, a library's types…) count as a single field: if two people change one at the
  same time, one wins. The same goes for the two ends of a line or relationship (where it starts and where it ends):
  if one person changes the source and another the target at the same time, you get one person's line, never a mix.
- If the text you are typing changes because someone else types in it, your cursor may jump to the end; what you both
  typed is kept.
- If two people start filling in something that was empty and does not belong to an element (a node's style, a
  relationship's documentation or fields, an instance note) at the same time, one wins; from then on it merges as above.
- **Undo** (Ctrl+Z) only undoes **your** changes, never other people's, even on the same element: if you rename an
  element while someone else writes its documentation, undo restores the name and leaves their text.
- To talk about the model without touching it, use [comments](comentarios.md).
- If someone breaks something, any editor can go back to an earlier version from [History](historial.md).

> [!NOTE]
> Workspaces created before October 2026 stored each element as a single block and, if two people edited it at the
> same time, only one of the changes survived. The server converts them to the new format the first time it opens
> them (saving an automatic snapshot first), with nothing for you to do. If you have a tab open from before the update,
> the server will not let it sync until you **reload** the page, so it cannot damage the workspace. Whatever you changed
> in it is still saved in the browser and is sent when you reload.

## Offline {#sin-conexion}

Every server workspace you open has a **copy in your browser**. If the network drops while you work:

1. The status in the bar changes to `○ offline (syncs when back)`. While it tries to reconnect you will see
   `◌ connecting…`.
2. Keep working as normal: everything is saved in your browser.
3. When the connection comes back, your changes and everyone else's merge automatically and the status returns to
   `● online`.

all-draw can be installed as an app (PWA) and starts even without a network. Offline you can open and edit all your
**local workspaces** and also the **server workspaces you have already opened in that browser**:

1. The saved copy opens with the last permission you had (if you were read-only, it stays read-only).
2. The bar shows `○ offline — changes will sync`. **Share** and **History** are not available until the network
   returns.
3. As soon as the connection returns your permissions are checked, it connects and everything syncs; the status
   changes to `● online`. If your access was removed in the meantime, you will see "You no longer have access to this
   workspace" and what you did offline is not sent.

A server workspace you have never opened in that browser has no copy: offline you will see "No connection to the
server" and you can **Retry** when it returns. If you are going to travel, open the workspaces you will need first.

> [!WARNING]
> Don't clear your browser data while you have unsynced changes (status `○ offline`): you would lose whatever you did
> since the network went down.

## Read-only {#solo-lectura}

With a read-only link or the **read-only** role, the editor opens in **read-only mode**:

- the palette, the **Workspace** button, undo/redo, snap to grid and the import option do not appear;
- the inspector shows the data but does not let you change it;
- you can move between views, search with Ctrl+K, read comments, export (images, HTML, JSON…) and watch others working
  live.

The same permissions apply to the API and to agents: an API key has, in each workspace, the permissions of its user,
and a read-only link only allows reading. See [Agents and API](agentes-y-api.md).

## Your account {#ajustes-cuenta}

When you are signed in, your name appears in the top-right corner. Clicking it opens the account menu, with your email
and two options:

- **Account and API keys**: opens the **Account** screen (`#/keys`).
- **Sign out**: ends the session in this browser. If you had a server workspace open in another tab of this browser,
  it is disconnected right away.

![Account screen with API keys](../img/12-claves-api-en.png)

It has these sections:

- **API keys**: to connect agents and scripts. Type a name, press **Create** and **copy the key right away**: it will
  not be shown again. **Revoke** cancels it. More in [Agents and API](agentes-y-api.md).
- **Change password**:
  1. Type the **Current password**.
  2. Type the **New password** (at least 8 characters) and repeat it in **Repeat the new password**.
  3. Press **Change**. You will see "Password changed; your other sessions have been signed out.": the other browsers
     where you were signed in will have to sign in again.
- **Active sessions**: the browsers and devices where you are signed in, with browser and system (for example "Firefox
  on Linux" or "Safari on iOS (mobile)"), the IP **without its last number**, when it was opened and when it was last
  used. This browser's one is marked **this session**. **Close this session** closes only that one: that browser has to
  sign in again and its open workspaces are disconnected right away.
- **Sign out everywhere**: ends your session in every browser, **including this one**, and takes you back to the home
  screen. Use it if you signed in on someone else's computer or think someone is using your account.
- **Email and notifications** (only if the server sends emails): **Email me when someone mentions me** (on by default)
  and the **Email language**.

To **change your email**, type the new one under **Profile**, your current password, and press **Save**. If the server
sends emails, the change **is not immediate**: we send a link to the new address (24 hours) and a notice to the old one;
until you open the link you keep signing in with the old email. Without email, the change is immediate.

## Notifications {#notificaciones}

When you are signed in, next to your name (and in the editor bar of server workspaces) there is a **bell**. The red
number is your **unread** notifications. Press it to see the latest ones, each linking to what it is about:

- **You were mentioned** in a comment (see [mentions](comentarios.md#menciones)), with an excerpt.
- **A workspace was shared with you**: someone added you as a member, with your role.
- **Your role changed** in a workspace, or **you now own it**.
- **A version was restored** in one of your workspaces (not when you do it yourself).

Opening a notification marks it as read; **Mark all as read** marks them all. The bell refreshes by itself every minute.
If the server sends emails and **Email me when someone mentions me** is on, mentions also reach you by email right away.

### What happens when sessions are closed {#cerrar-sesiones}

**Change password**, **Sign out everywhere** and a **reset** by an administrator (see
[Server administration](#administracion)) close the sessions **and disconnect right away** the server workspaces open
in those browsers: whoever has them open stops receiving and sending changes and has to sign in again. Anything not yet
sent does not reach the server.

All three offer the **Also revoke API keys** checkbox, ticked by default, so the agents and scripts that use your keys
lose access too. Untick it only if you are sure your keys have not leaked (for example, if you just want to end the
session on a borrowed computer).

**Sign out** (in the menu under your name) only affects this browser: it ends its session and disconnects the server
workspace it had open. Your API keys keep working.

> [!NOTE]
> An API key cannot close sessions or change the password: those actions are only available with a signed-in browser
> session. That way, whoever gets hold of a key cannot lock you out of your account.

## Server administration {#administracion}

If you are an administrator, the **Account** screen also shows **Server users**: every account with its name, email,
creation date and whether it is an administrator.

**If someone forgets their password** and the server sends emails, they can recover it themselves with **Forgot your
password?** (see [I forgot my password](#recuperar-contrasena)). If the server does not send emails:

1. Go to **Account** and find that person under **Server users**.
2. Press **Reset** next to their email and confirm.
3. A **temporary password** appears. Copy it now (it will not be shown again) and get it to them through a secure
   channel. Their open sessions are closed and their open workspaces are disconnected right away (see
   [What happens when sessions are closed](#cerrar-sesiones)).
4. The person signs in with the temporary password and changes it under **Account → Change password**.

You cannot reset your own password from this list; use **Change password**.

## Common mistakes {#errores-comunes}

**"Two of us typed at the same time and a change was lost."**
If you both changed the same short field (for example, the name), the last one wins: that is expected (see
[editing at the same time](#edicion-simultanea)). Long texts and different fields are merged. If something you need was
lost, look for it in [History](historial.md).

**"It says “A new version of all-draw is available” and doesn't sync."**
That tab is from an earlier version of the app. Click **Reload** (or reload the page): what you had is saved in the
browser and is sent when it comes back.

**"I can't see the Share button."**
Only the owner sees it, and only in server workspaces. If the workspace is local, upload it first with **Upload to
server**. If you are not the owner, ask them to send you a link.

**"Pressing Upload to server says «You need an account on the server»."**
You have to sign in first. Go back to the home screen (☰), press **Sign in / register** and try again.

**"I uploaded the workspace and my latest changes are missing."**
You probably made them in the local copy, which is not connected to the server one. Open the server copy from **On the
server**.

**"The other person opens the link and sees «Could not open»."**
The link has been revoked or has expired, or it was copied incompletely (it must include `?token=lnk_…`). Create a new
one and send it again.

**"I closed the tab and can't get back in with the link."**
The token is only kept in the tab where it was opened and is removed from the address. Open the original link again
(not a bookmark of the address without the token).

**"The other person can't edit."**
You gave them a read-only link. Create a **New edit link**, send it and, if you like, revoke the read-only one.

**"I revoked a link and the person still sees the changes."**
Revoking disconnects them immediately. If they still show up in presence, they are getting in another way: with another
link (revoke it too) or with their account as a member (remove them from the members).

**"It says «You no longer have access to this workspace»."**
The link you used was revoked or your permission was removed. Press **Back to home** and ask whoever manages the
workspace for a new link. What you did after losing access was not saved on the server; if you need it, export it
before leaving (**Import / Export**).

**"It says «offline» and doesn't go back to «online»."**
Check your internet connection and reload the page: your changes are saved in the browser and will be sent when you
reconnect. If the network works and it still does not connect, the server may be down; tell whoever runs it.

**"Signing in says «Demasiados intentos; espera unos minutos»."**
("Too many attempts; wait a few minutes.") There have been too many sign-in attempts from your connection or for your email (the
limit is 10 every 15 minutes). Wait and try again calmly; if you don't remember your password, ask an administrator to reset it.

**"I can't register."**
The server requires an **Invite code** or has registration closed. Ask whoever runs it for access.

**"I show up as «Anonymous» and a number."**
You opened the link without being signed in. Sign in with your account and open the link again to appear with your
name; see [Presence](#presencia).
