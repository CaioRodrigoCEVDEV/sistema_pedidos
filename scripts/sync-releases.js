// Sincroniza as releases do GitHub com o PostgreSQL (tabela system_releases).
//
// Uso:
//   node scripts/sync-releases.js
//   npm run releases:sync
//
// Este script é a ÚNICA parte do sistema que fala com a API do GitHub. O modal
// "Ver atualizações" lê apenas o banco, então o usuário final nunca depende do
// GitHub para abrir o modal.
//
// Configuração (opcional, via .env ou variáveis de ambiente):
//   GITHUB_REPOSITORY=owner/repo        (tem prioridade)
//   GITHUB_OWNER=owner
//   GITHUB_REPO=repo
//   GITHUB_TOKEN=...                    (apenas para elevar o rate-limit)
//   RELEASES_MAX_PAGES=20               (limite de páginas de 100 releases)
require("dotenv").config();

const pool = require("../src/config/db");
const { ensureReleasesSchema } = require("../src/config/releasesSchema");
const { upsertRelease } = require("../src/models/releaseModels");

const GITHUB_API = "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = Math.max(1, Number(process.env.RELEASES_MAX_PAGES || 20));

function resolveRepository() {
  const explicit = (process.env.GITHUB_REPOSITORY || "").trim();
  if (explicit.includes("/")) return explicit;

  const owner = (process.env.GITHUB_OWNER || "CaioRodrigoCEVDEV").trim();
  const repo = (process.env.GITHUB_REPO || "sistema_pedidos").trim();
  return `${owner}/${repo}`;
}

// "v5.1.0" -> "5.1.0". Cai para o nome da release quando não há tag.
function normalizeVersion(release) {
  const tag = String(release.tag_name || "").trim();
  const name = String(release.name || "").trim();
  const base = tag || name;
  if (!base) return "";
  const withoutV = base.replace(/^v/i, "").trim();
  return withoutV || base;
}

async function fetchAllReleases(repository) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "orderup-sync-releases",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const releases = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${GITHUB_API}/repos/${repository}/releases?per_page=${PER_PAGE}&page=${page}`;
    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `GitHub respondeu ${resp.status}: ${body.slice(0, 200)}`
      );
    }

    const batch = await resp.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    releases.push(...batch);
    if (batch.length < PER_PAGE) break;
  }

  return releases;
}

async function main() {
  const repository = resolveRepository();
  console.log(`Sincronizando releases de ${repository}...`);

  await ensureReleasesSchema(pool);

  const releases = await fetchAllReleases(repository);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const release of releases) {
    const version = normalizeVersion(release);
    if (!version) {
      skipped++;
      continue;
    }

    try {
      const isInsert = await upsertRelease({
        githubId: release.id ?? null,
        version,
        tagName: release.tag_name ?? null,
        name: release.name ?? null,
        body: release.body ?? null,
        publishedAt: release.published_at || release.created_at || null,
        htmlUrl: release.html_url ?? null,
        isPrerelease: release.prerelease,
        isDraft: release.draft,
        authorLogin: release.author ? release.author.login : null,
      });

      if (isInsert) inserted++;
      else updated++;
    } catch (err) {
      skipped++;
      console.error(`  ! Falha ao sincronizar "${version}": ${err.message}`);
    }
  }

  console.log(
    `Concluído: ${inserted} inserida(s), ${updated} atualizada(s)` +
      (skipped ? `, ${skipped} ignorada(s)` : "") +
      `. Total retornado pelo GitHub: ${releases.length}.`
  );
}

main()
  .catch((err) => {
    console.error("Falha ao sincronizar releases:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
