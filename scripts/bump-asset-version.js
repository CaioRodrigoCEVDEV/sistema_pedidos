// Bump da versão de cache-busting em todas as referências locais de CSS/JS.
//
// Uso:
//   node scripts/bump-asset-version.js            -> usa data + hora atual (YYYY.MM.DD.HHmmss)
//   node scripts/bump-asset-version.js 2026.09.01 -> força uma versão específica
//
// Para cada <link href="..."> e <script src="..."> local (.css/.js), garante
// que exista um ?v=<versao> no final da URL. Referências externas/CDN são
// ignoradas. Rode a cada release antes de commitar.
//
// A versão inclui a hora para que duas alterações no mesmo dia gerem URLs
// diferentes (evita servir assets em cache antigos quando há mais de um
// release no mesmo dia).
const fs = require("fs");
const path = require("path");
const { logoVersion } = require("../src/utils/logoVersion");

const ASSET_VERSION = process.argv[2] || hoje();
const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
// Entrada do painel React (Vite). Também recebe o cache-busting de css/js,
// favicon, apple-touch-icon e manifest.
const FRONTEND_INDEX = path.join(ROOT_DIR, "frontend", "index.html");

// Versão da logo/apple-touch-icon/manifest derivada do arquivo da logo. Muda
// quando a logo é substituída, para o ícone da PWA e o favicon atualizarem.
const LOGO_VERSION = logoVersion();

// href/src terminando em .css ou .js (ignora querystring existente)
const RE_REF = /(href|src)="([^"]+?\.(?:css|js))(?:\?[^"]*)?"/g;

// Logo, favicon e manifest: versionados pela versão da logo (não pela versão
// do release), garantindo cache-busting quando a imagem muda.
const RE_LOGO =
  /(href|src)="(\/uploads\/(?:logo\.jpg|apple-touch-icon\.png)|\/manifest\.json)(?:\?[^"]*)?"/g;

function hoje() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(
    d.getDate()
  )}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isExternal(url) {
  return /^(\/\/|https?:)/.test(url);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

let totalArquivos = 0;
let totalRefs = 0;

const targets = walk(PUBLIC_DIR);
if (fs.existsSync(FRONTEND_INDEX)) targets.push(FRONTEND_INDEX);

for (const file of targets) {
  const html = fs.readFileSync(file, "utf8");
  let n = 0;
  let novo = html.replace(RE_REF, (m, attr, url) => {
    if (isExternal(url)) return m;
    n++;
    return `${attr}="${url}?v=${ASSET_VERSION}"`;
  });

  novo = novo.replace(RE_LOGO, (m, attr, url) => {
    n++;
    return `${attr}="${url}?v=${LOGO_VERSION}"`;
  });

  if (novo !== html) {
    fs.writeFileSync(file, novo);
    totalArquivos++;
    totalRefs += n;
    console.log(`  ${path.relative(ROOT_DIR, file)}: ${n} referência(s)`);
  }
}

console.log(`\nVersão dos assets (css/js): ?v=${ASSET_VERSION}`);
console.log(`Versão da logo/favicon/manifest: ?v=${LOGO_VERSION}`);
console.log(
  `${totalArquivos} arquivo(s) atualizado(s), ${totalRefs} referência(s) versionada(s).`
);
