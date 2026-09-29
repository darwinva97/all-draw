/** Proyecto `d1`: aplica `migrations/` a la D1 local. En el proyecto `do` no hay `DB` (el RegistryDO migra solo). */
import { applyD1Migrations, env } from 'cloudflare:test';
if (env.DB) await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
