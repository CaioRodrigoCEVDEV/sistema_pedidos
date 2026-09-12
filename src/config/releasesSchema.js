const pool = require("./db");

// Estrutura da tabela de releases do sistema.
//
// Mantida em um único lugar para ser reaproveitada:
// - pela migration automática de startup (src/config/atualizardb.js);
// - pelo script de sincronização (scripts/sync-releases.js), que pode rodar
//   de forma independente da aplicação.
//
// Regras:
// - `version` é única: não permitimos a mesma release duas vezes.
// - `body` guarda o conteúdo original do GitHub (Markdown).
// - `published_at` preserva a data original de publicação.
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS public.system_releases (
    id BIGSERIAL PRIMARY KEY,
    github_release_id BIGINT NULL,
    version TEXT NOT NULL,
    tag_name TEXT NULL,
    name TEXT NULL,
    body TEXT NULL,
    published_at TIMESTAMPTZ NULL,
    html_url TEXT NULL,
    is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    author_login TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT system_releases_version_key UNIQUE (version)
  );
`;

const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_system_releases_published_at
    ON public.system_releases (published_at DESC NULLS LAST);

  CREATE INDEX IF NOT EXISTS idx_system_releases_github_id
    ON public.system_releases (github_release_id);
`;

async function ensureReleasesSchema(db = pool) {
  await db.query(CREATE_TABLE_SQL);
  await db.query(CREATE_INDEXES_SQL);
}

module.exports = {
  ensureReleasesSchema,
  CREATE_TABLE_SQL,
  CREATE_INDEXES_SQL,
};
