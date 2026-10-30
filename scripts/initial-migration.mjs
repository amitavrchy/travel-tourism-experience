import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8", cwd: new URL("../Server/", import.meta.url) },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status || 1);
}
const directory = new URL(
  "../Server/prisma/migrations/20261030000000_initial/",
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL("migration.sql", directory), result.stdout);
writeFileSync(
  new URL("../migration_lock.toml", directory),
  'provider = "postgresql"\n',
);
console.log("Initial PostgreSQL migration generated.");
