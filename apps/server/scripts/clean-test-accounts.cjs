// Borra las cuentas *@test.local que crean los e2e (y sus espacios, sesiones, claves y membresías). Parar el servicio antes: `systemctl --user stop alldraw`.
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.env.HOME + "/.alldraw-data/alldraw.sqlite");
const tables = db.prepare("select name from sqlite_master where type='table'").all().map(r => r.name);
console.log("tablas:", tables.join(", "));
const cols = t => db.prepare(`pragma table_info(${t})`).all().map(c => c.name);
const users = db.prepare("select * from users").all();
console.log("usuarios:", users.map(u => u.email).join(", "));
const test = users.filter(u => /@test\.local$/.test(u.email));
const wsCols = cols('workspaces'); const ownerCol = wsCols.find(c => /owner/i.test(c));
for (const u of test) {
  const ws = db.prepare(`select id from workspaces where ${ownerCol} = ?`).all(u.id);
  for (const w of ws) for (const t of tables) if (cols(t).some(c => /workspace_?id/i.test(c))) db.prepare(`delete from ${t} where ${cols(t).find(c => /workspace_?id/i.test(c))} = ?`).run(w.id);
  for (const w of ws) db.prepare("delete from workspaces where id = ?").run(w.id);
  for (const t of tables) if (t !== 'users' && cols(t).some(c => /user_?id/i.test(c))) db.prepare(`delete from ${t} where ${cols(t).find(c => /user_?id/i.test(c))} = ?`).run(u.id);
  db.prepare("delete from users where id = ?").run(u.id);
}
console.log("borrados:", test.length, "| quedan:", db.prepare("select count(*) c from users").get().c, "usuarios,", db.prepare("select count(*) c from workspaces").get().c, "espacios");
