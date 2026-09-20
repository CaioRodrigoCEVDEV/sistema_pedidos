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

const ASSET_VERSION = process.argv[2] || hoje();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

// href/src terminando em .css ou .js (ignora querystring existente)
const RE_REF = /(href|src)="([^"]+?\.(?:css|js))(?:\?[^"]*)?"/g;

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

for (const file of walk(PUBLIC_DIR)) {
  const html = fs.readFileSync(file, "utf8");
  let n = 0;
  const novo = html.replace(RE_REF, (m, attr, url) => {
    if (isExternal(url)) return m;
    n++;
    return `${attr}="${url}?v=${ASSET_VERSION}"`;
  });

  if (novo !== html) {
    fs.writeFileSync(file, novo);
    totalArquivos++;
    totalRefs += n;
    console.log(`  ${path.relative(PUBLIC_DIR, file)}: ${n} referência(s)`);
  }
}

console.log(`\nVersão aplicada: ?v=${ASSET_VERSION}`);
console.log(
  `${totalArquivos} arquivo(s) atualizado(s), ${totalRefs} referência(s) versionada(s).`
);

// Service Worker: atualiza a constante de versão para o navegador perceber que
// o sw.js mudou e instalar o novo (dispara o fluxo de atualização do app
// instalado em public/js/storefront-shared.js).
const swPath = path.join(PUBLIC_DIR, "sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");
  const swNovo = sw.replace(
    /const OU_SW_VERSION = "[^"]*";/,
    `const OU_SW_VERSION = "ou-storefront-${ASSET_VERSION}";`
  );
  if (swNovo !== sw) {
    fs.writeFileSync(swPath, swNovo);
    console.log(`  sw.js: OU_SW_VERSION = ou-storefront-${ASSET_VERSION}`);
  }
}
