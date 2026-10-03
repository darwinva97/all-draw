# What's new

What has changed in all-draw, newest first, told from the point of view of the people who use it.

## 3 October 2026 {#novedades-2026-10-03}

- **Documentation center inside the app**, in Spanish and English: the full manual, with search, a
  table of contents for each chapter, a reference for every notation, a glossary and frequently
  asked questions, without leaving all-draw.
- **Your account, in your hands**: in **Account** you can change your name and email, see your
  quotas, **export all your data** as JSON and **delete your account** yourself.
- If the application fails, instead of a blank page you see a notice with the option to reload, and
  a technical report (without the content of your diagrams) is sent so it can be fixed.
- New chapters: [comments](comentarios.md), [history](historial.md), [glossary](glosario.md),
  [FAQ](faq.md), [privacy](privacidad.md) and [terms of use](terminos.md).

## 30 September 2026 {#novedades-2026-09-30}

- **Comments on diagrams**: comment on an element, a line, a point on the canvas or a whole view;
  reply, @mention the workspace's people and resolve threads. Bubbles on the canvas show you where
  conversations are open, and threads are not lost even if the commented item is deleted. See
  [comments](comentarios.md).
- **Crow's foot and cardinalities** in entity-relationship and UML class diagrams ("one to many",
  "zero or one"…), also when exporting to SVG, draw.io and Mermaid.
- **Switching views is faster**: up to almost twice as fast in large diagrams.
- all-draw also runs **installed on Cloudflare**, for anyone who wants to host it there.
- If the server has registration closed, nobody can create an account without an invite code, not
  even on a brand-new installation.

## 26 September 2026: history, mobile and security {#novedades-2026-09-26-historial}

- **Version history** for server workspaces: automatic snapshots every 30 minutes of activity,
  named snapshots whenever you want, one-click restore and download of any version. See
  [history](historial.md).
- **Daily server backups**, kept for 30 days.
- **Phone and tablet**: bottom bar, sliding panels, long press for the menu and finger-friendly
  buttons.
- **Faster large models**: workspaces with thousands of elements and dozens of views open, validate
  and draw much faster.
- **Safer accounts**: change your password, sign out on every device, sessions that expire after
  30 days unused, password reset by an administrator and sign-up with an invite code.

## 26 September 2026: English {#novedades-2026-09-26-ingles}

- all-draw **in English**: language selector on the home screen and in the editor. By default it
  uses your browser's language. Notation, type and viewpoint names are translated too (ArchiMate
  names stay in English, as in the specification).
- In sequence diagrams, a lifeline can now **send messages to itself**.

## 26 September 2026: ArchiMate figures and traceability {#novedades-2026-09-26-archimate}

- **ArchiMate figures** matching Archi's: dedicated icons for all 61 types and their alternative
  figures, also in exported SVG.
- **Visible traceability**: matrix between two notations, coverage, gaps and trace suggestions you
  can accept in one go. See [traces](conceptos.md#trazas).
- **Sequence diagrams** with their own canvas: lifelines in columns and messages you reorder by
  dragging.
- **User manual** with screenshots, and **accessibility** improvements (keyboard, screen readers,
  contrast).

## 26 September 2026: accounts and collaboration {#novedades-2026-09-26-cuentas}

- **Accounts** and **server workspaces**, with owner, can edit and read-only roles.
- **Share with links** for editing or read-only access, which can be revoked. See
  [sharing and collaborating](compartir-y-colaborar.md).
- **Presence**: see who is connected and their cursors.
- Server workspaces **work offline** and sync when you are back.
- **Import and export** Archi, ArchiMate Open Exchange, BPMN 2.0, Structurizr, XState, Mermaid,
  OpenAPI and draw.io; export to **SVG**, **PNG** and **self-contained HTML**. See
  [import and export](importar-exportar.md).
- **New notations**: sequence, entity-relationship, UML class, mind map, flowchart and data flow,
  plus full BPMN and a catalog of more than 160 diagram types.
- **Dark theme**, **auto layout**, global search (**Ctrl+K**), rename with **F2**, notes, groups,
  labels and images on the canvas.
- **API and MCP** so programs and AI assistants can work with your workspaces. See
  [agents and API](agentes-y-api.md).

## 26 September 2026: libraries and editing {#novedades-2026-09-26-librerias}

- **Workspace** panel with **libraries** (your own types with fields and pins, reusable
  components), style **rules** and **people** with their assignments. See
  [libraries, rules and people](librerias-reglas-personas.md).
- **Copy, paste and duplicate** (Ctrl+C, Ctrl+V, Ctrl+D), **align and distribute** several nodes
  and editable **bend points** on lines.

## 26 September 2026: first release {#novedades-2026-09-26-primera}

- One model, many notations: **ArchiMate**, **BPMN**, **state machine**, **C4**,
  **layers × stages** and **freeform**, with the same element visible in several dimensions. See
  [concepts](conceptos.md).
- The editor only allows the connections the notation accepts.
- **Local workspaces** saved in the browser, working offline and installable as an app (PWA).
- **Import from Drawer** (`.drawer`), with its APIs and fields turned into pins. See
  [Drawer](importar-exportar.md#drawer).
- A **demo** ("Customer onboarding") in five dimensions to see the idea in action.
