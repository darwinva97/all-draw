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

![Dialog to sign in or create an account](../img/02-entrar.png)

1. On the home screen, press **Sign in / register**.
2. If you already have an account, type your email and password and press **Sign in**.
3. If not, press **I don't have an account**, fill in email, name and a password of **at least 8 characters**, and press
   **Register**.

Depending on how the server is set up, registration may be open, require an **Invite code** (ask whoever runs the
server), or be closed ("Registration is closed on this server."). Your session lasts 30 days from the last time you use
the app; to leave, press **sign out** next to your name on the home screen.

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
| `viewer` | See every view, search, export, read comments and follow changes live. Cannot modify anything. |
| `editor` | Everything above, plus editing: drawing, changing data, using the Workspace panel, commenting, importing and restoring history snapshots. |
| `owner` | Everything above, plus **Share** (create and revoke links), deleting the workspace and deleting snapshots. |

- The **owner** is whoever creates (or uploads) the workspace.
- Server **administrators** see every workspace with owner permissions. The first user to register on a server is an
  administrator.
- Your role appears in the bar, next to the connection status (for example, `● online · editor`).

From the interface you share with **links**. Giving a role to a specific account (members) or transferring ownership is
done through the API for now (`PUT /api/workspaces/:id/members/:userId` with `{ "role": "editor" }`); see
[Agents and API](agentes-y-api.md).

## Inviting someone {#invitar}

Only the owner sees the **Share** button.

![Share dialog with an edit link and a read-only link](../img/10-compartir.png)

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

Links can have an expiry date, but today that can only be set through the API (`expiresAt` field).

## Revoking a link {#revocar}

1. Press **Share**.
2. Next to the link, press **Revoke**. You will see "Link revoked".

From then on the link no longer works to open the workspace or to reconnect. Anyone who has it **open at that moment**
may stay connected until they reload the page or lose the connection; after that they will not be able to get back in.
Revoking does not delete anything that person may have exported or copied.

## Presence {#presencia}

In a server workspace the bar shows a coloured circle with initials for each connected person (yours first). Hover over
it to see who it is and which view they are in. If there are more than six of you, "+*N*" is shown.

When you are in the same view, you also see their **cursor**, with their name, moving on the canvas.

> [!NOTE]
> For now each person appears as "Anonymous" followed by a number, with a random colour; the number and colour change
> when the page is reloaded. Your account name is not used for presence yet.

## Editing at the same time {#edicion-simultanea}

There is nothing to "lock" or "check out": two people can move the same node or type in the same field at the same
time, and the changes merge on their own in every browser without conflicts (synchronisation uses CRDTs).

- **Undo** (Ctrl+Z) only undoes **your** changes, never other people's.
- To talk about the model without touching it, use [comments](comentarios.md).
- If someone breaks something, any editor can go back to an earlier version from [History](historial.md).

## Offline {#sin-conexion}

Every server workspace you open has a **copy in your browser**. If the network drops while you work:

1. The status in the bar changes to `○ offline (syncs when back)`. While it tries to reconnect you will see
   `◌ connecting…`.
2. Keep working as normal: everything is saved in your browser.
3. When the connection comes back, your changes and everyone else's merge automatically and the status returns to
   `● online`.

all-draw can be installed as an app (PWA) and starts even without a network. Offline you can open and edit all your
**local workspaces**; **server** workspaces need a connection to open, because your permissions are checked when you
open them. If you are going to travel, leave the workspace open before losing the network, or work on a local copy.

> [!WARNING]
> Don't clear your browser data while you have unsynced changes (status `○ offline`): you would lose whatever you did
> since the network went down.

## Read-only {#solo-lectura}

With a read-only link or the `viewer` role, the editor opens in **read-only mode**:

- the palette, the **Workspace** button, undo/redo, snap to grid and the import option do not appear;
- the inspector shows the data but does not let you change it;
- you can move between views, search with Ctrl+K, read comments, export (images, HTML, JSON…) and watch others working
  live.

The same permissions apply to the API and to agents: an API key has, in each workspace, the permissions of its user,
and a read-only link only allows reading. See [Agents and API](agentes-y-api.md).

## Your account {#ajustes-cuenta}

When you are signed in, the home screen shows your name followed by **API keys** and **sign out**. **API keys** opens
the **Account** screen (`#/keys`).

![Account screen with API keys](../img/12-claves-api.png)

It has these sections:

- **API keys**: to connect agents and scripts. Type a name, press **Create** and **copy the key right away**: it will
  not be shown again. **Revoke** cancels it. More in [Agents and API](agentes-y-api.md).
- **Change password**:
  1. Type the **Current password**.
  2. Type the **New password** (at least 8 characters) and repeat it in **Repeat the new password**.
  3. Press **Change**. You will see "Password changed; your other sessions have been signed out.": the other browsers
     where you were signed in will have to sign in again.
- **Sign out everywhere**: ends your session in every browser, **including this one**, and takes you back to the home
  screen. Use it if you signed in on someone else's computer or think someone is using your account.

## Server administration {#administracion}

If you are an administrator, the **Account** screen also shows **Server users**: every account with its name, email,
creation date and whether it is an administrator.

**If someone forgets their password** (the server does not send emails, so there is no "forgot my password"):

1. Go to **Account** and find that person under **Server users**.
2. Press **Reset** next to their email and confirm.
3. A **temporary password** appears. Copy it now (it will not be shown again) and get it to them through a secure
   channel. Their open sessions are closed.
4. The person signs in with the temporary password and changes it under **Account → Change password**.

You cannot reset your own password from this list; use **Change password**.

## Common mistakes {#errores-comunes}

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
Their open connection stays active until they reload or the network drops. After that they will not be able to get in.

**"It says «offline» and doesn't go back to «online»."**
Check your internet connection and reload the page: your changes are saved in the browser and will be sent when you
reconnect. If the network works and it still does not connect, the server may be down; tell whoever runs it.

**"Signing in says «Demasiados intentos; espera unos minutos»."**
("Too many attempts; wait a few minutes.") There have been too many sign-in attempts from your connection or for your email (the
limit is 10 every 15 minutes). Wait and try again calmly; if you don't remember your password, ask an administrator to reset it.

**"I can't register."**
The server requires an **Invite code** or has registration closed. Ask whoever runs it for access.

**"We all show up as «Anonymous»."**
That is a current limitation of presence; see [Presence](#presencia).
