const pool = require("../config/db");

/**
 * Modelo de releases/atualizações do sistema.
 *
 * A tabela `system_releases` é alimentada exclusivamente pelo script de
 * sincronização (scripts/sync-releases.js). O modal do dashboard lê os dados
 * por aqui, sempre do PostgreSQL — nunca da API do GitHub.
 */

/**
 * Lista todas as releases armazenadas, da mais recente para a mais antiga.
 * @returns {Promise<Array>} Releases ordenadas por published_at/id.
 */
async function listReleases() {
  const result = await pool.query(`
    SELECT
      id,
      version,
      tag_name,
      name,
      body,
      published_at,
      html_url,
      is_prerelease,
      is_draft,
      author_login
    FROM public.system_releases
    WHERE is_draft = FALSE
    ORDER BY published_at DESC NULLS LAST, id DESC
  `);
  return result.rows;
}

/**
 * Insere ou atualiza uma release, usando `version` como chave de conflito.
 * Preserva a data original de publicação vinda do GitHub.
 *
 * @param {Object} release Dados já normalizados da release.
 * @returns {Promise<boolean>} true quando inseriu, false quando atualizou.
 */
async function upsertRelease(release) {
  const result = await pool.query(
    `
    INSERT INTO public.system_releases (
      github_release_id,
      version,
      tag_name,
      name,
      body,
      published_at,
      html_url,
      is_prerelease,
      is_draft,
      author_login,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (version) DO UPDATE SET
      github_release_id = EXCLUDED.github_release_id,
      tag_name = EXCLUDED.tag_name,
      name = EXCLUDED.name,
      body = EXCLUDED.body,
      published_at = EXCLUDED.published_at,
      html_url = EXCLUDED.html_url,
      is_prerelease = EXCLUDED.is_prerelease,
      is_draft = EXCLUDED.is_draft,
      author_login = EXCLUDED.author_login,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `,
    [
      release.githubId ?? null,
      release.version,
      release.tagName ?? null,
      release.name ?? null,
      release.body ?? null,
      release.publishedAt ?? null,
      release.htmlUrl ?? null,
      Boolean(release.isPrerelease),
      Boolean(release.isDraft),
      release.authorLogin ?? null,
    ]
  );

  return result.rows[0] ? result.rows[0].inserted : false;
}

module.exports = { listReleases, upsertRelease };
