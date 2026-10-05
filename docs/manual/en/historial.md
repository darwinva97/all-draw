# Version history

The **history** keeps complete pictures of a server workspace —**snapshots**— so you can go back to
an earlier state even days later, or when the changes were made by someone else. This chapter
explains how they work, how they differ from undo and from the server's backups, and what to do
with local workspaces.

## Snapshots are not the same as undo {#instantaneas-y-deshacer}

| | Undo (**Ctrl+Z** / **Ctrl+Y**) | Snapshots (**History**) |
|---|---|---|
| What it keeps | Your latest changes, one by one | The **whole** workspace at a given moment |
| Whose | Only **your** changes (not other people's) | Everything, whoever did it |
| How long | While the workspace is open | Stays on the server (within the limits below) |
| Where | Local and server workspaces | **Server** workspaces only |

Use **Ctrl+Z** to fix a mistake you made a moment ago. Use the **history** to get back what the
workspace looked like yesterday, before a big reorganisation or before someone deleted a view.

## Opening the history {#abrir}

In a server workspace, click **History** in the editor toolbar. A dialog opens with the list of
snapshots, newest first. For each one you see:

- its **label** (or *Automatic* if it has none),
- the date and time,
- who created it (or *system* if the server created it on its own),
- its size.

In a local workspace the **History** button does not appear: see
[local workspaces](#espacios-locales).

## Viewing a snapshot without restoring it {#ver}

Click **View** next to a snapshot to open a **read-only preview**: the workspace as it was at that moment, with the
canvas and the view picker (at the top), without touching the current workspace. You can pan, zoom and select, but not
change anything. Every role can open it, read-only included.

From the preview:

- **Compare with current** opens a summary on the right of what has changed **between that version and now**, by
  elements, relationships and views:
  - **Added since then**: what did not exist in the version (it would go away if you restore it).
  - **Deleted since then**: what existed and no longer does (it would come back).
  - **Changed since then**: with its current name (and the old one, if it changed) and what changed: name,
    documentation, fields, properties, style… For views, *content* means their nodes or lines changed.
  - At the end, whether the workspace name changed and how many changes there are in libraries, people, rules or
    comments.
- **Restore this version** does the same as **Restore** in the list (see [restoring](#restaurar)).
- **Close** (or Escape) goes back to the list.

## Automatic snapshots {#automaticas}

The server creates snapshots without you doing anything:

- **Every 30 minutes of activity**: when a change arrives and at least 30 minutes have passed since
  the last snapshot. If nobody touches the workspace, none are created (no need: nothing changed).
- **Before every restore**: the state just before restoring is saved as an automatic snapshot, so
  a restore can be undone.

## Creating a labeled snapshot {#crear}

Before a big change, it is a good idea to leave a named marker:

1. Open **History**.
2. Type a label in **Label (optional)**, for example "Before reorganising layers" (up to 120
   characters).
3. Click **Create snapshot**. You will see the message "Snapshot created".

If you leave the label empty, the snapshot is still created but treated as automatic (see
[limits](#limites)). **Labeled snapshots are never deleted automatically.**

## Restoring a snapshot {#restaurar}

1. In **History**, click **Restore** next to the snapshot you want.
2. Confirm. The message reminds you that the current state will be saved first.

What happens when you restore:

- The server **first** saves an automatic snapshot of the current state. Nothing is lost.
- Then it replaces the workspace content with the snapshot's: model, views, libraries, rules,
  people and comments.
- Everyone who has the workspace open sees the change instantly, like any other edit, plus a notice:
  "*Ana* restored the version from *date*". That way nobody finds the workspace changed without knowing why.
- Only what differs from the snapshot changes: if someone is typing in an element the restore does not touch, they
  do not lose what they type.

If you picked the wrong snapshot, open **History** again and restore the automatic one created just
before (the newest in the list).

> [!NOTE]
> Restoring does not change who has access: members, share links and workspace ownership are not
> part of snapshots.

## Downloading a snapshot {#descargar}

**Download JSON** saves the snapshot to your computer as a `.json` file. It is the same format as
**Import / Export → all-draw JSON**, so you can:

- keep it as your own backup;
- open it as a new workspace with **Import…** on the home screen, without touching the original;
- compare it or process it with other tools.

## Deleting a snapshot {#borrar}

Only the workspace **owner** sees the **Delete** button on each snapshot. It asks for confirmation
and cannot be undone.

## Who can do what {#permisos}

| Action | read-only | can edit | owner |
|---|:---:|:---:|:---:|
| See the list | ✓ | ✓ | ✓ |
| View and compare a snapshot | ✓ | ✓ | ✓ |
| Download JSON | ✓ | ✓ | ✓ |
| Create snapshot | | ✓ | ✓ |
| Restore | | ✓ | ✓ |
| Delete snapshot | | | ✓ |

See [sharing and collaborating](compartir-y-colaborar.md) for roles.

## Limits {#limites}

- Each workspace keeps at most **100 snapshots**. Beyond that, the server deletes the **oldest
  automatic ones** (those without a label).
- **Labeled** snapshots are never deleted automatically; only the owner deletes them. If a
  workspace piles up many labeled ones, they take up part of those 100 and leave less room for
  automatic ones.
- If the **workspace is deleted**, all its snapshots are deleted too.

> [!TIP]
> Label the snapshots you want to keep in the long run (a delivery, an approved review). Automatic
> ones are a safety net for the last few days of work, not an archive.

## Local workspaces {#espacios-locales}

Workspaces saved only in your browser **have no history**. To protect them:

- Export from time to time with **Import / Export → all-draw JSON** (an `.alldraw.json` file) and
  keep the file wherever you keep your documents. Going back to a version means importing that file
  (see [import and export](importar-exportar.md#formatos)).
- Or upload it with **Upload to server** (you need an account): from then on it gets automatic
  snapshots.

> [!WARNING]
> If you clear your browser data, use a private window or switch computers, local workspaces do not
> come with you. Without an exported `.alldraw.json` there is no way to recover them.

## Server backups {#copias-del-servidor}

Besides the history, whoever runs the server makes **daily backups** of all data (accounts and
workspaces) and keeps them for **30 days**. They are not the same as snapshots:

| | Snapshots | Server backups |
|---|---|---|
| What for | Going back to a version of **one** workspace | Recovering the whole service after a disaster (disk failure, serious error) |
| Who uses them | You, from **History** | Only whoever runs the server |
| Frequency | Every 30 min of activity, before restoring and whenever you want | Once a day |
| How long | Up to 100 per workspace; labeled ones, indefinitely | 30 days |

You cannot restore a server backup yourself. If you have lost something that is not in the history,
write to whoever runs the service (see [privacy](privacidad.md)) as soon as possible, giving the
workspace and the approximate date; after 30 days there will be no copy left.

Backups are currently kept on the service's own infrastructure. For anything you cannot afford to
lose, keep your own `.alldraw.json` as well.

## Common mistakes {#errores-comunes}

- **"I can't see the History button."** You are in a local workspace. Only server workspaces have
  history.
- **"I can't create or restore."** You have the **read-only** role. You can view and download,
  but not change the workspace.
- **"I restored and lost today's work."** No: just before restoring, an automatic snapshot with
  today's state was created. Restore it.
- **"An old snapshot disappeared."** If it had no label, it was pruned after going over 100. Label
  the ones you want to keep.
- **"Ctrl+Z doesn't undo the restore."** Undo only reverts your own edits. To go back, restore the
  previous automatic snapshot.
- **"The list is empty."** The workspace is new or has not changed for a while: create a snapshot
  by hand.
- **"There's an automatic snapshot from October 2026 that nobody created."** The server saves it before converting an
  old workspace to the new simultaneous-editing format (see
  [sharing and collaborating](compartir-y-colaborar.md#edicion-simultanea)). It is pruned like the other automatic ones.
- **"I don't know which version to restore."** Click **View** and then **Compare with current** on each candidate
  before restoring.
