// Gera public/releases.json a partir das Releases do GitHub.
//
// Uso:
//   node scripts/generate-releases.js
//   npm run releases:sync
//
// O dashboard lê esse arquivo estático, então não há chamada à API do GitHub
// em tempo de execução (sem rate-limit, sem token no servidor e sem depender
// da rede do servidor durante o acesso do usuário).
//
// Rode a cada release antes de commitar/taguear. Requer GITHUB_TOKEN no .env
// (ou variável de ambiente) apenas para o rate-limit maior e repositórios
// privados. Se GitHub estiver inacessível, o arquivo existente é preservado.
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const OWNER = process.env.GITHUB_OWNER || "CaioRodrigoCEVDEV";
const REPO = process.env.GITHUB_REPO || "sistema_pedidos";
const MAX = Number(process.env.RELEASES_MAX || 100);
const OUT = path.join(__dirname, "..", "public", "releases.json");

async function main() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=${MAX}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "orderup",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub respondeu ${resp.status}: ${body.slice(0, 200)}`);
  }

  const full = await resp.json();
  const releases = full.map((r) => ({
    id: r.id,
    tag_name: r.tag_name,
    name: r.name,
    body: r.body,
    published_at: r.published_at,
  }));

  const payload = { generatedAt: new Date().toISOString(), releases };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(
    `releases.json gerado: ${releases.length} release(s) -> ${path.relative(
      process.cwd(),
      OUT
    )}`
  );
}

main().catch((err) => {
  console.error("Falha ao gerar releases.json:", err.message);
  if (fs.existsSync(OUT)) {
    console.error("Mantendo o releases.json existente (não foi alterado).");
  }
  process.exit(1);
});
