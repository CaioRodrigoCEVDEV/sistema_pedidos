// Ficha do cliente — identidade, dados, pedidos, conta e cobranças.

// ---------------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------------
const qs = (id) => document.getElementById(id);

const cliModalEl = qs("cliModal");
const cliModal = new bootstrap.Modal(cliModalEl);

const btnNew = qs("btnNew");
const btnPrev = qs("btnPrev");
const btnNext = qs("btnNext");
const searchInput = qs("searchInput");
const tbody = qs("cliTbody");
const cliMobileList = qs("cliMobileList");
const resultsInfo = qs("resultsInfo");
const pageInfo = qs("pageInfo");
const emptyState = qs("emptyState");

const cliForm = qs("cliForm");
const btnInativar = qs("btnInativar");
const btnExcluir = qs("btnExcluir");
const btnAddMov = qs("btnAddMov");
const btnAddCobranca = qs("btnAddCobranca");
const btnBuscarPedidoDisponivel = qs("btnBuscarPedidoDisponivel");

const tabDadosBtn = qs("tabDadosBtn");
const tabPedidosBtn = qs("tabPedidosBtn");
const tabContaBtn = qs("tabContaBtn");
const tabCobrancasBtn = qs("tabCobrancasBtn");

// Abas exclusivas de cliente existente (Pedidos/Conta/Cobranças).
// A navegação é removida do DOM no cadastro para não ser renderizada, clicada
// nem disparar carregamentos antes do cliente existir. Os painéis permanecem
// no DOM (ocultos) para que seus campos continuem acessíveis pelo formulário.
const cliTabsNav = qs("cliTabs");
const abasExtras = [
  { link: tabPedidosBtn, li: tabPedidosBtn.closest(".nav-item"), pane: qs("tabPedidos") },
  { link: tabContaBtn, li: tabContaBtn.closest(".nav-item"), pane: qs("tabConta") },
  { link: tabCobrancasBtn, li: tabCobrancasBtn.closest(".nav-item"), pane: qs("tabCobrancas") },
];

// Cabeçalho da ficha
const cliTitulo = qs("cliTitulo");
const cliSubtitulo = qs("cliSubtitulo");
const cliAvatar = qs("cliAvatar");
const cliSituacaoBadge = qs("cliSituacaoBadge");
const cliResumo = qs("cliResumo");
const cliResumoSaldo = qs("cliResumoSaldo");
const cliResumoCredito = qs("cliResumoCredito");
const cliResumoPedidos = qs("cliResumoPedidos");
const cliWhatsApp = qs("cliWhatsApp");

// Campos do formulário
const f_parcod = qs("parcod");
const f_pardes = qs("pardes");
const f_parfan = qs("parfan");
const f_parcnpjcpf = qs("parcnpjcpf");
const f_parfone = qs("parfone");
const f_paremail = qs("paremail");
const f_parsit = qs("parsit");
const f_parcep = qs("parcep");
const f_parrua = qs("parrua");
const f_parbai = qs("parbai");
const f_parmuncod = qs("parmuncod");
const cidadeLista = qs("cidadeLista");
const cidadeSelecionada = qs("cidadeSelecionada");
const btnLimparCidade = qs("btnLimparCidade");

// Listas
const pedidosLista = qs("pedidosLista");
const pedidosCount = qs("pedidosCount");
const pedidosTotal = qs("pedidosTotal");
const filtroPedidosCliente = qs("filtroPedidosCliente");
const pedidosDisponiveisLista = qs("pedidosDisponiveisLista");
const buscaPedidoDisponivel = qs("buscaPedidoDisponivel");
const movLista = qs("movLista");
const cobrancasLista = qs("cobrancasLista");
const cobrancasCount = qs("cobrancasCount");
const cobPedido = qs("cobPedido");

// Painel lateral de detalhes do pedido
const pedidoDrawer = qs("pedidoDrawer");
const pedidoDrawerTitulo = qs("pedidoDrawerTitulo");
const pedidoDrawerSubtitulo = qs("pedidoDrawerSubtitulo");
const pedidoDrawerStatus = qs("pedidoDrawerStatus");
const pedidoDrawerConteudo = qs("pedidoDrawerConteudo");
const pedidoDrawerRodape = qs("pedidoDrawerRodape");
const vincularDrawer = qs("vincularDrawer");
const alertaTelefone = qs("alertaTelefone");

// Estado
let page = 1;
const pageSize = 20;
let total = 0;
let q = "";
let municipios = [];
let cidadeSelecionadaCod = null;
let cidadeAtiva = -1;
let clienteAtual = null;
let pedidosCliente = [];
// Incrementado a cada abertura de ficha. Abortar cargas antigas evita que uma
// edição resolvida tarde reintroduza as abas extras num cadastro em andamento.
let fichaToken = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const onlyDigits = (s) => String(s == null ? "" : s).replace(/\D/g, "");
const toNum = (v) => Number(v || 0);
const jsonHeaders = { "Content-Type": "application/json" };

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function fmtMoney(v) {
  return toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDoc(d) {
  const s = onlyDigits(d);
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return s;
}
function fmtPhone(v) {
  let s = onlyDigits(v);
  if ((s.length === 12 || s.length === 13) && s.startsWith("55")) s = s.slice(2);
  if (s.length === 10) return s.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  if (s.length === 11) return s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  return v || "";
}
function fmtDate(v) {
  if (!v) return "-";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR");
}
function fmtCanal(v) {
  const s = String(v || "").trim();
  if (!s) return "—";
  const map = { VENDA: "Venda", BALCAO: "Balcão", ENTREGA: "Entrega" };
  const upper = s.toUpperCase();
  return map[upper] || s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function hojeISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function showToast(texto, ok = true) {
  const msg = document.createElement("div");
  msg.textContent = texto;
  Object.assign(msg.style, {
    position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
    background: ok ? "#198754" : "#dc3545", color: "#fff", padding: "12px 24px",
    borderRadius: "8px", zIndex: 20000, boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
  });
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2400);
}
function setLoading(container, texto = "Carregando...") {
  if (!container) return;
  container.innerHTML = `<div class="ficha-vazio"><span class="spinner-border spinner-border-sm me-2"></span>${texto}</div>`;
}
async function api(path, options = {}) {
  const resp = await fetch(`${BASE_URL}${path}`, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error || `Erro ${resp.status}`);
  return data;
}

// Status visual de pedido e cobrança
function statusPedido(p) {
  if (String(p.pvsta || "").trim() === "X") return { label: "Cancelado", cls: "bg-danger-subtle text-danger border-danger-subtle" };
  if (String(p.pvconfirmado || "").trim() === "S") return { label: "Confirmado", cls: "bg-success-subtle text-success border-success-subtle" };
  return { label: "Pendente", cls: "bg-warning-subtle text-warning border-warning-subtle" };
}
function cobrancaVencida(c) {
  if (c.cobsta !== "A" || !c.cobvenc) return false;
  return String(c.cobvenc).slice(0, 10) < hojeISO();
}
function statusCobranca(c) {
  if (c.cobsta === "P") return { label: "Pago", cls: "bg-success-subtle text-success border-success-subtle" };
  if (c.cobsta === "C") return { label: "Cancelado", cls: "bg-secondary-subtle text-secondary border-secondary-subtle" };
  if (cobrancaVencida(c)) return { label: "Vencido", cls: "bg-danger-subtle text-danger border-danger-subtle" };
  return { label: "Em aberto", cls: "bg-warning-subtle text-warning border-warning-subtle" };
}
function badge(cls, label) {
  return `<span class="badge rounded-pill border ${cls}">${escapeHtml(label)}</span>`;
}
function situacaoBadge(parsit) {
  if (parsit === "I") {
    return '<span class="ou-badge ou-badge--neutral"><span class="ou-badge__dot"></span>Inativo</span>';
  }
  return '<span class="ou-badge ou-badge--success"><span class="ou-badge__dot"></span>Ativo</span>';
}
const MOV_LABEL = {
  DEBITO: "Débito", CREDITO: "Crédito", PAGAMENTO: "Pagamento",
  ESTORNO: "Estorno", AJUSTE: "Ajuste", COBRANCA: "Cobrança",
};

function normalizarWhatsapp(telefone) {
  let digits = onlyDigits(telefone).replace(/^0+/, "");
  if (!digits) return null;
  // Já possui DDI do Brasil
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  // Número nacional (DDD + telefone): adiciona o código do país
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

function abrirWhatsApp(telefone, texto) {
  const numero = normalizarWhatsapp(telefone);
  if (!numero) {
    alertaTelefone.classList.remove("d-none");
    return;
  }
  alertaTelefone.classList.add("d-none");
  const url = `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto || "")}`;
  window.open(url, "_blank", "noopener");
}

// Monta a mensagem amigável de cobrança com os dados realmente disponíveis.
function montarMensagemCobranca(c) {
  const nome = clienteAtual?.pardes || "cliente";
  const linhas = [
    `Olá, ${nome}! 👋`,
    "",
    "Tudo bem?",
    "",
    "Estamos entrando em contato referente à sua cobrança.",
    "",
  ];
  if (c.cobpvcod) linhas.push(`📦 Pedido: #${c.cobpvcod}`);
  linhas.push(`💰 Valor: ${fmtMoney(c.cobvalor)}`);
  if (c.cobvenc) linhas.push(`📅 Vencimento: ${fmtDate(c.cobvenc)}`);
  linhas.push(
    "",
    "Caso já tenha realizado o pagamento, por favor desconsidere esta mensagem.",
    "",
    "Obrigado! 😊"
  );
  return linhas.join("\n");
}

function cobrarWhatsApp(c) {
  abrirWhatsApp(clienteAtual?.parfone, montarMensagemCobranca(c));
}

// ---------------------------------------------------------------------------
// Lista de clientes
// ---------------------------------------------------------------------------
async function carregarClientes() {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q }).toString();
  try {
    const data = await api(`/cli?${params}`);
    const lista = data.data || [];
    total = data.total || 0;
    renderLista(lista);
    resultsInfo.textContent = total === 1 ? "1 cliente" : `${total} clientes`;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    pageInfo.textContent = `${page} / ${totalPages}`;
    btnPrev.disabled = page <= 1;
    btnNext.disabled = page >= totalPages;
    emptyState.style.display = lista.length ? "none" : "block";
  } catch (err) {
    console.error(err);
    showToast("Falha ao carregar clientes.", false);
  }
}

function renderLista(lista) {
  tbody.innerHTML = "";
  cliMobileList.innerHTML = "";
  lista.forEach((r) => {
    const cidadeUF = [r.mundes, r.ufsigla].filter(Boolean).join("/") || "—";
    const emAberto = toNum(r.em_aberto);
    const corSaldo = emAberto > 0 ? "text-danger" : "text-muted";
    const contato = r.parfone ? escapeHtml(fmtPhone(r.parfone)) : "—";
    const email = r.paremail ? `<div class="text-muted small text-truncate">${escapeHtml(r.paremail)}</div>` : "";
    const statusBadge = situacaoBadge(r.parsit);

    // Linha da tabela (desktop)
    const tr = document.createElement("tr");
    tr.className = "cliente-linha";
    tr.innerHTML = `
      <td class="text-muted">#${r.parcod}</td>
      <td>
        <div class="fw-semibold">${escapeHtml(r.pardes || "")}</div>
        ${r.parfan ? `<div class="text-muted small">${escapeHtml(r.parfan)}</div>` : ""}
      </td>
      <td>${fmtDoc(r.parcnpjcpf)}</td>
      <td>${escapeHtml(cidadeUF)}</td>
      <td><div>${contato}</div>${email}</td>
      <td class="text-end ${corSaldo} fw-semibold">${fmtMoney(emAberto)}</td>
      <td>${statusBadge}</td>
    `;
    tr.addEventListener("click", () => abrirFicha(r.parcod));
    tbody.appendChild(tr);

    // Card (mobile) — mesma base de dados, mesma ação
    const card = document.createElement("div");
    card.className = "client-mobile-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Abrir ficha do cliente ${r.pardes || "#" + r.parcod}`);
    card.innerHTML = `
      <div class="client-mobile-card__head">
        <span class="client-mobile-card__avatar" aria-hidden="true">${escapeHtml(iniciais(r.pardes))}</span>
        <span class="client-mobile-card__identity">
          <span class="client-mobile-card__name">${escapeHtml(r.pardes || "")}</span>
          ${r.parfan ? `<span class="client-mobile-card__fantasia">${escapeHtml(r.parfan)}</span>` : ""}
        </span>
      </div>
      <div class="client-mobile-card__info">
        <div class="client-mobile-card__block">
          <span class="client-mobile-card__label">Código</span>
          <span class="client-mobile-card__value">#${r.parcod}</span>
        </div>
        <div class="client-mobile-card__block">
          <span class="client-mobile-card__label">Documento</span>
          <span class="client-mobile-card__value">${fmtDoc(r.parcnpjcpf)}</span>
        </div>
        <div class="client-mobile-card__block">
          <span class="client-mobile-card__label">Cidade/UF</span>
          <span class="client-mobile-card__value client-mobile-card__value--wrap">${escapeHtml(cidadeUF)}</span>
        </div>
        <div class="client-mobile-card__block">
          <span class="client-mobile-card__label">Em aberto</span>
          <span class="client-mobile-card__value ${corSaldo}">${fmtMoney(emAberto)}</span>
        </div>
      </div>
      <div class="client-mobile-card__foot">
        ${statusBadge}
        <i class="fa-solid fa-chevron-right client-mobile-card__chevron" aria-hidden="true"></i>
      </div>
    `;
    const abrir = () => abrirFicha(r.parcod);
    card.addEventListener("click", abrir);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrir();
      }
    });
    cliMobileList.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Municípios (combobox)
// ---------------------------------------------------------------------------
function normalizar(txt) {
  return String(txt == null ? "" : txt)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function carregarMunicipios() {
  try {
    const data = await api("/municipios");
    if (!Array.isArray(data)) return;
    municipios = data.map((m) => ({
      cod: m.muncod, nome: m.mundes, uf: m.munufsigla,
      label: `${m.mundes} - ${m.munufsigla}`,
    })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  } catch (err) {
    console.error("Erro ao carregar municípios:", err);
  }
}

function filtrarMunicipios(termo) {
  const tokens = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!tokens.length) return municipios.slice(0, 50);
  const out = [];
  for (const m of municipios) {
    const alvo = normalizar(`${m.nome} ${m.uf}`);
    if (tokens.every((t) => alvo.includes(t))) {
      out.push(m);
      if (out.length >= 50) break;
    }
  }
  return out;
}

function renderCidadeLista(lista) {
  cidadeAtiva = -1;
  if (!lista.length) {
    cidadeLista.innerHTML = '<div class="list-group-item text-muted small py-2">Nenhuma cidade encontrada.</div>';
    return;
  }
  cidadeLista.innerHTML = lista.map((m) =>
    `<button type="button" class="list-group-item list-group-item-action py-1" data-cod="${m.cod}" data-label="${escapeHtml(m.label)}">${escapeHtml(m.label)}</button>`
  ).join("");
}
function abrirCidadeLista() {
  renderCidadeLista(filtrarMunicipios(f_parmuncod.value));
  cidadeLista.classList.remove("d-none");
  f_parmuncod.setAttribute("aria-expanded", "true");
}
function fecharCidadeLista() {
  cidadeLista.classList.add("d-none");
  f_parmuncod.setAttribute("aria-expanded", "false");
  cidadeAtiva = -1;
}
function selecionarCidade(cod, label) {
  cidadeSelecionadaCod = Number(cod);
  f_parmuncod.value = label;
  f_parmuncod.classList.remove("is-invalid");
  cidadeSelecionada.textContent = "";
  cidadeSelecionada.classList.remove("text-danger");
  btnLimparCidade.style.display = "";
  fecharCidadeLista();
}
function limparCidade() {
  cidadeSelecionadaCod = null;
  f_parmuncod.value = "";
  f_parmuncod.classList.remove("is-invalid");
  cidadeSelecionada.textContent = "";
  cidadeSelecionada.classList.remove("text-danger");
  btnLimparCidade.style.display = "none";
  fecharCidadeLista();
}
function resolverMunicipio() {
  const texto = (f_parmuncod.value || "").trim();
  if (!texto) return { ok: true, muncod: null };
  if (cidadeSelecionadaCod) return { ok: true, muncod: cidadeSelecionadaCod };
  return { ok: false };
}

f_parmuncod.addEventListener("focus", abrirCidadeLista);
f_parmuncod.addEventListener("click", abrirCidadeLista);
f_parmuncod.addEventListener("input", () => {
  cidadeSelecionadaCod = null;
  cidadeSelecionada.textContent = "";
  cidadeSelecionada.classList.remove("text-danger");
  btnLimparCidade.style.display = "none";
  f_parmuncod.classList.remove("is-invalid");
  abrirCidadeLista();
});
f_parmuncod.addEventListener("keydown", (e) => {
  const items = Array.from(cidadeLista.querySelectorAll("button[data-cod]"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (cidadeLista.classList.contains("d-none")) { abrirCidadeLista(); return; }
    if (!items.length) return;
    e.preventDefault();
    cidadeAtiva = e.key === "ArrowDown"
      ? Math.min(cidadeAtiva + 1, items.length - 1)
      : Math.max(cidadeAtiva - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === cidadeAtiva));
    items[cidadeAtiva].scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") {
    if (cidadeAtiva >= 0 && items[cidadeAtiva]) {
      e.preventDefault();
      selecionarCidade(items[cidadeAtiva].dataset.cod, items[cidadeAtiva].dataset.label);
    }
  } else if (e.key === "Escape") {
    fecharCidadeLista();
  }
});
cidadeLista.addEventListener("mousedown", (e) => {
  const btn = e.target.closest("button[data-cod]");
  if (!btn) return;
  e.preventDefault();
  selecionarCidade(btn.dataset.cod, btn.dataset.label);
});
btnLimparCidade.addEventListener("click", limparCidade);
document.addEventListener("click", (e) => {
  if (!qs("cidadeCombobox").contains(e.target)) fecharCidadeLista();
});

// ---------------------------------------------------------------------------
// Cabeçalho / identidade
// ---------------------------------------------------------------------------
function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const a = partes[0][0] || "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}
function renderSituacao(parsit) {
  if (parsit === "I") {
    cliSituacaoBadge.className = "ou-badge ou-badge--neutral";
    cliSituacaoBadge.innerHTML = '<span class="ou-badge__dot"></span>Inativo';
  } else {
    cliSituacaoBadge.className = "ou-badge ou-badge--success";
    cliSituacaoBadge.innerHTML = '<span class="ou-badge__dot"></span>Ativo';
  }
  cliSituacaoBadge.classList.remove("d-none");
}
function renderCabecalhoNovo() {
  clienteAtual = null;
  cliForm.classList.add("ou-cli-novo");
  cliTitulo.textContent = "Novo cliente";
  cliSubtitulo.textContent = "Preencha os dados para cadastrar";
  cliAvatar.textContent = "?";
  cliSituacaoBadge.classList.add("d-none");
  cliResumo.style.display = "none";
  cliWhatsApp.disabled = true;
}
function renderCabecalhoCliente(data) {
  clienteAtual = data;
  cliForm.classList.remove("ou-cli-novo");
  cliTitulo.textContent = data.pardes || "Cliente";
  cliAvatar.textContent = iniciais(data.pardes);
  renderSituacao(data.parsit);

  const doc = data.parcnpjcpf ? `CPF/CNPJ: ${fmtDoc(data.parcnpjcpf)}` : "";
  const fone = data.parfone ? `WhatsApp: ${fmtPhone(data.parfone)}` : "";
  cliSubtitulo.textContent = [doc, fone].filter(Boolean).join(" · ") || "Sem dados de contato";
  cliResumo.style.display = "flex";

  const digits = onlyDigits(data.parfone);
  cliWhatsApp.disabled = !digits;
  cliWhatsApp.onclick = () => {
    const txt = `Olá, ${data.pardes}!`;
    abrirWhatsApp(data.parfone, txt);
  };
}
function atualizarResumoConta(conta) {
  if (!conta) return;
  cliResumoSaldo.textContent = fmtMoney(conta.em_aberto || 0);
  cliResumoCredito.textContent = fmtMoney(conta.credito || 0);
  cliResumoPedidos.textContent = conta.pedidos_vinculados || 0;
}

f_parsit.addEventListener("change", () => renderSituacao(f_parsit.value));

// ---------------------------------------------------------------------------
// Abrir ficha
// ---------------------------------------------------------------------------
function definirAbasExtras(habilitado) {
  abasExtras.forEach(({ link, li, pane }) => {
    if (habilitado) {
      if (li && !li.isConnected) cliTabsNav.appendChild(li);
      link.disabled = false;
      link.classList.remove("disabled");
    } else {
      if (li) li.remove();
    }
    link.classList.remove("active");
    link.setAttribute("aria-selected", "false");
    if (pane) pane.classList.remove("active", "show");
  });
  // Toda ficha (novo cadastro ou edição) começa na aba Dados.
  tabDadosBtn.classList.remove("active");
  const dadosPane = qs("tabDados");
  if (dadosPane) dadosPane.classList.remove("active", "show");
  bootstrap.Tab.getOrCreateInstance(tabDadosBtn).show();
}
function fecharPainelLancamento() {
  qs("lancamentoForm").classList.add("d-none");
  qs("movValor").value = "";
  qs("movDescricao").value = "";
}
function fecharPainelCobranca() {
  qs("cobrancaForm").classList.add("d-none");
  qs("cobValor").value = "";
  qs("cobVenc").value = "";
  qs("cobObs").value = "";
}
function limparListas() {
  pedidosLista.innerHTML = "";
  movLista.innerHTML = "";
  cobrancasLista.innerHTML = "";
  cobPedido.innerHTML = '<option value="">Sem pedido</option>';
  pedidosCount.textContent = "0";
  pedidosTotal.textContent = fmtMoney(0);
  cobrancasCount.textContent = "0";
  pedidosCliente = [];
  qs("contaDevedor").textContent = fmtMoney(0);
  qs("contaCredito").textContent = fmtMoney(0);
  qs("contaCobrancasSub").textContent = "0 cobrança(s) em aberto";
}

function abrirNovaFicha() {
  fichaToken += 1;
  cliForm.reset();
  f_parcod.value = "";
  f_parsit.value = "A";
  limparCidade();
  fecharPainelLancamento();
  fecharPainelCobranca();
  fecharDrawerPedido();
  fecharDrawerVincular();
  alertaTelefone.classList.add("d-none");
  limparListas();
  renderCabecalhoNovo();
  definirAbasExtras(false);
  btnInativar.classList.add("d-none");
  btnExcluir.classList.add("d-none");
  cliModal.show();
  setTimeout(() => f_pardes.focus(), 250);
}

async function abrirFicha(id) {
  const token = ++fichaToken;
  try {
    const data = await api(`/cli/${id}`);
    if (token !== fichaToken) return;
    cliForm.reset();
    fecharPainelLancamento();
    fecharPainelCobranca();
    fecharDrawerPedido();
    fecharDrawerVincular();
    alertaTelefone.classList.add("d-none");

    f_parcod.value = data.parcod || "";
    f_pardes.value = data.pardes || "";
    f_parfan.value = data.parfan || "";
    f_parcnpjcpf.value = onlyDigits(data.parcnpjcpf);
    f_parfone.value = fmtPhone(data.parfone);
    f_paremail.value = data.paremail || "";
    f_parsit.value = data.parsit || "A";
    f_parcep.value = data.parcep ? String(data.parcep).replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";
    f_parrua.value = data.parrua || "";
    f_parbai.value = data.parbai || "";
    if (data.mundes && data.muncod) selecionarCidade(data.muncod, `${data.mundes} - ${data.ufsigla}`);
    else limparCidade();

    renderCabecalhoCliente(data);
    definirAbasExtras(true);
    bootstrap.Tab.getOrCreateInstance(tabDadosBtn).show();
    btnInativar.classList.toggle("d-none", false);
    btnExcluir.classList.toggle("d-none", false);
    if (data.parsit === "I") btnInativar.classList.add("d-none");
    else btnInativar.classList.remove("d-none");

    limparListas();
    setLoading(pedidosLista);
    setLoading(movLista);
    setLoading(cobrancasLista);
    cliModal.show();

    await Promise.all([
      carregarConta(id),
      carregarMovimentacoes(id),
      carregarPedidos(id),
      carregarCobrancas(id),
    ]);
  } catch (err) {
    console.error(err);
    showToast("Falha ao carregar cliente.", false);
  }
}

// ---------------------------------------------------------------------------
// Popup de confirmação no layout padrão do sistema
// ---------------------------------------------------------------------------
function confirmarPopup({
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  icone = "bi-exclamation-triangle",
  variante = "danger",
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const popup = document.createElement("div");
    popup.className = "popup";
    popup.style.width = "380px";
    popup.style.maxWidth = "90vw";
    popup.style.background = "var(--ou-surface)";
    popup.style.color = "var(--ou-text)";
    popup.style.padding = "20px";
    popup.style.borderRadius = "10px";
    popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    popup.style.zIndex = "10000";

    popup.innerHTML = `
      <h5 class="mb-3"><i class="bi ${icone} me-2"></i>${escapeHtml(titulo)}</h5>
      <p class="mb-4">${escapeHtml(mensagem)}</p>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-secondary" data-popup="cancelar">${escapeHtml(textoCancelar)}</button>
        <button type="button" class="btn btn-${variante}" data-popup="confirmar">${escapeHtml(textoConfirmar)}</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const finalizar = (valor) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(valor);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        finalizar(false);
      }
    };

    popup.querySelector('[data-popup="cancelar"]').addEventListener("click", () => finalizar(false));
    popup.querySelector('[data-popup="confirmar"]').addEventListener("click", () => finalizar(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finalizar(false); });
    document.addEventListener("keydown", onKey, true);

    popup.querySelector('[data-popup="confirmar"]').focus();
  });
}

// ---------------------------------------------------------------------------
// Salvar / inativar / excluir
// ---------------------------------------------------------------------------
cliForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  if (!f_pardes.value.trim()) return showToast("Informe o Nome/Razão Social.", false);
  if (!onlyDigits(f_parcnpjcpf.value)) return showToast("Informe o CPF/CNPJ.", false);
  if (!onlyDigits(f_parfone.value)) return showToast("Informe o Telefone/WhatsApp.", false);

  const muni = resolverMunicipio();
  if (!muni.ok) {
    f_parmuncod.classList.add("is-invalid");
    cidadeSelecionada.textContent = "Selecione uma cidade da lista.";
    cidadeSelecionada.classList.add("text-danger");
    return showToast("Selecione uma cidade da lista.", false);
  }

  const payload = {
    pardes: f_pardes.value.trim(),
    parfan: f_parfan.value.trim() || null,
    parcnpjcpf: onlyDigits(f_parcnpjcpf.value),
    parfone: f_parfone.value.trim(),
    paremail: f_paremail.value.trim() || null,
    parcep: f_parcep.value.trim() || null,
    parrua: f_parrua.value.trim() || null,
    parbai: f_parbai.value.trim() || null,
    parmuncod: muni.muncod,
    parsit: f_parsit.value || "A",
  };

  const isNew = !f_parcod.value;
  const url = isNew ? "/cli" : `/cli/${f_parcod.value}`;
  const btnSubmit = cliForm.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.innerText = "Salvando...";

  try {
    await api(url, {
      method: isNew ? "POST" : "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    showToast(isNew ? "Cliente cadastrado!" : "Cliente atualizado!", true);
    cliModal.hide();
    carregarClientes();
  } catch (err) {
    console.error(err);
    showToast(err.message || "Erro ao salvar.", false);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = "Salvar";
  }
});

btnInativar.addEventListener("click", async () => {
  const id = f_parcod.value;
  if (!id) return;
  const confirmado = await confirmarPopup({
    titulo: "Inativar cliente",
    mensagem: "Tem certeza que deseja inativar este cliente?",
    textoConfirmar: "Inativar",
    icone: "bi-slash-circle",
    variante: "warning",
  });
  if (!confirmado) return;
  try {
    await api(`/cli/${id}`, { method: "DELETE" });
    showToast("Cliente inativado.", true);
    cliModal.hide();
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Falha ao inativar.", false);
  }
});

btnExcluir.addEventListener("click", async () => {
  const id = f_parcod.value;
  if (!id) return;
  const confirmado = await confirmarPopup({
    titulo: "Excluir cliente",
    mensagem: "Excluir DEFINITIVAMENTE este cliente? Só é permitido se não houver vínculos.",
    textoConfirmar: "Excluir",
    icone: "bi-trash",
    variante: "danger",
  });
  if (!confirmado) return;
  try {
    await api(`/cli/${id}?hard=1`, { method: "DELETE" });
    showToast("Cliente excluído.", true);
    cliModal.hide();
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Falha ao excluir.", false);
  }
});

// ---------------------------------------------------------------------------
// Conta / movimentações
// ---------------------------------------------------------------------------
async function carregarConta(id) {
  try {
    const c = await api(`/cli/${id}/conta`);
    qs("contaDevedor").textContent = fmtMoney(c.em_aberto || 0);
    qs("contaCredito").textContent = fmtMoney(c.credito || 0);
    qs("contaCobrancasSub").textContent = `${c.cobrancas_abertas || 0} cobrança(s) em aberto`;
    atualizarResumoConta(c);
  } catch (err) {
    console.error(err);
    qs("contaDevedor").textContent = "—";
  }
}

async function carregarMovimentacoes(id) {
  try {
    const lista = await api(`/cli/${id}/movimentacoes`);
    if (!lista.length) {
      movLista.innerHTML = `
        <div class="ficha-vazio">
          <i class="fa-solid fa-receipt fs-3 d-block mb-2 text-muted"></i>
          <div class="fw-semibold text-dark">Nenhuma movimentação</div>
          <div class="small">Créditos, débitos e ajustes aparecerão aqui.</div>
        </div>`;
      return;
    }
    movLista.innerHTML = "";
    lista.forEach((m) => {
      const delta = toNum(m.movvalor);
      const saldo = toNum(m.movsaldo);
      const cor = delta > 0 ? "text-danger" : delta < 0 ? "text-success" : "text-muted";
      const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
      const saldoTxt =
        saldo > 0
          ? `Saldo devedor: ${fmtMoney(saldo)}`
          : saldo < 0
          ? `Crédito: ${fmtMoney(Math.abs(saldo))}`
          : "Saldo: R$ 0,00";
      const div = document.createElement("div");
      div.className = "ou-mov-item";
      div.innerHTML = `
        <div class="min-w-0">
          <div class="ou-mov-tipo">${escapeHtml(MOV_LABEL[m.movtipo] || m.movtipo || "Movimentação")}</div>
          <div class="ou-mov-meta">${fmtDate(m.movdtcad)}${
            m.movdesc ? " · " + escapeHtml(m.movdesc) : ""
          }${m.movref ? " · " + escapeHtml(m.movref) : ""}</div>
        </div>
        <div class="ou-mov-valores">
          <div class="ou-mov-valor ${cor}">${sinal} ${fmtMoney(Math.abs(delta))}</div>
          <div class="ou-mov-saldo">${saldoTxt}</div>
        </div>
      `;
      movLista.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    movLista.innerHTML = '<div class="ficha-vazio text-danger">Erro ao carregar movimentações.</div>';
  }
}

qs("btnNovoLancamento").addEventListener("click", () => {
  qs("lancamentoForm").classList.toggle("d-none");
  if (!qs("lancamentoForm").classList.contains("d-none")) qs("movValor").focus();
});
qs("btnIrCobranca").addEventListener("click", () => {
  bootstrap.Tab.getOrCreateInstance(tabCobrancasBtn).show();
  qs("cobrancaForm").classList.remove("d-none");
  qs("cobValor").focus();
});
qs("btnIrTelefone").addEventListener("click", () => {
  alertaTelefone.classList.add("d-none");
  bootstrap.Tab.getOrCreateInstance(tabDadosBtn).show();
  setTimeout(() => f_parfone.focus(), 300);
});
qs("btnCancelarLancamento").addEventListener("click", fecharPainelLancamento);
qs("lancamentoForm").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); btnAddMov.click(); }
});

btnAddMov.addEventListener("click", async () => {
  const id = f_parcod.value;
  if (!id) return;
  const valor = Number(qs("movValor").value);
  if (!valor || valor <= 0) return showToast("Informe um valor válido.", false);

  btnAddMov.disabled = true;
  try {
    await api(`/cli/${id}/movimentacoes`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        tipo: qs("movTipo").value,
        valor,
        descricao: qs("movDescricao").value.trim() || null,
      }),
    });
    fecharPainelLancamento();
    showToast("Movimentação registrada.", true);
    await carregarConta(id);
    await carregarMovimentacoes(id);
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Erro ao registrar movimentação.", false);
  } finally {
    btnAddMov.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Pedidos do cliente
// ---------------------------------------------------------------------------
async function carregarPedidos(id) {
  try {
    pedidosCliente = await api(`/cli/${id}/pedidos`);
    pedidosCount.textContent = pedidosCliente.length;
    const totalPedidos = pedidosCliente
      .filter((p) => String(p.pvsta || "").trim() !== "X")
      .reduce((s, p) => s + toNum(p.pvvl), 0);
    pedidosTotal.textContent = fmtMoney(totalPedidos);
    renderPedidosCliente();

    cobPedido.innerHTML = '<option value="">Sem pedido</option>';
    pedidosCliente
      .filter((p) => String(p.pvsta || "").trim() !== "X")
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.pvcod;
        opt.textContent = `#${p.pvcod} · ${fmtMoney(p.pvvl)}`;
        cobPedido.appendChild(opt);
      });
  } catch (err) {
    console.error(err);
    pedidosLista.innerHTML = '<div class="ficha-vazio text-danger">Erro ao carregar pedidos.</div>';
  }
}

function renderPedidosCliente() {
  const termo = onlyDigits(filtroPedidosCliente.value);
  const lista = termo
    ? pedidosCliente.filter((p) => String(p.pvcod).includes(termo))
    : pedidosCliente;

  if (!pedidosCliente.length) {
    pedidosLista.innerHTML = `
      <div class="ficha-vazio">
        <i class="fa-solid fa-box-open fs-3 d-block mb-2 text-muted"></i>
        <div class="fw-semibold text-dark">Nenhum pedido vinculado</div>
        <div class="small mb-3">Este cliente ainda não possui pedidos vinculados.</div>
        <button type="button" class="btn btn-sm btn-outline-primary" data-vincular-vazio>
          <i class="fa-solid fa-plus me-1"></i> Vincular pedido
        </button>
      </div>`;
    return;
  }

  if (!lista.length) {
    pedidosLista.innerHTML = `
      <div class="ficha-vazio">
        <i class="fa-solid fa-magnifying-glass fs-3 d-block mb-2 text-muted"></i>
        <div class="fw-semibold text-dark">Nenhum pedido encontrado</div>
        <div class="small">Nenhum pedido corresponde à busca informada.</div>
      </div>`;
    return;
  }

  pedidosLista.innerHTML = "";
  lista.forEach((p) => {
    const st = statusPedido(p);
    const item = document.createElement("div");
    item.className = "ou-pedido-item";
    item.innerHTML = `
      <div class="ou-pedido-top">
        <span class="ou-pedido-num">#${p.pvcod}</span>
        <span class="ou-pedido-valor">${fmtMoney(p.pvvl)}</span>
      </div>
      <div class="ou-pedido-mid">
        <span class="ou-pedido-meta">${escapeHtml(fmtCanal(p.pvcanal))} · ${fmtDate(p.pvdtcad)}</span>
        ${badge(st.cls, st.label)}
      </div>
      <div class="ou-pedido-actions">
        <button type="button" class="btn btn-link btn-sm text-decoration-none" data-ver="${p.pvcod}">
          Ver detalhes <i class="fa-solid fa-arrow-right ms-1"></i>
        </button>
        <div class="dropdown">
          <button class="btn btn-sm btn-link text-secondary p-0" type="button" data-bs-toggle="dropdown"
            aria-expanded="false" title="Mais ações" aria-label="Mais ações para o pedido #${p.pvcod}">
            <i class="fa-solid fa-ellipsis"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <button class="dropdown-item" type="button" data-ver-menu="${p.pvcod}">
                <i class="fa-solid fa-receipt me-2"></i> Ver detalhes
              </button>
            </li>
            <li>
              <button class="dropdown-item text-danger" type="button" data-desvincular="${p.pvcod}">
                <i class="fa-solid fa-link-slash me-2"></i> Desvincular pedido
              </button>
            </li>
          </ul>
        </div>
      </div>
    `;
    pedidosLista.appendChild(item);
  });
}

filtroPedidosCliente.addEventListener("input", renderPedidosCliente);

pedidosLista.addEventListener("click", (e) => {
  const ver = e.target.closest("[data-ver]");
  if (ver) return verDetalhesPedido(Number(ver.dataset.ver));
  const verMenu = e.target.closest("[data-ver-menu]");
  if (verMenu) return verDetalhesPedido(Number(verMenu.dataset.verMenu));
  const des = e.target.closest("[data-desvincular]");
  if (des) return desvincularPedido(f_parcod.value, des.dataset.desvincular);
  if (e.target.closest("[data-vincular-vazio]")) abrirVincularDrawer();
});

// ---------------------------------------------------------------------------
// Detalhes do pedido — painel lateral dentro da ficha do cliente
// ---------------------------------------------------------------------------
function abrirDrawer(el, focusEl) {
  el.classList.add("aberto");
  el.setAttribute("aria-hidden", "false");
  if (focusEl) setTimeout(() => focusEl.focus(), 240);
}
function fecharDrawer(el) {
  el.classList.remove("aberto");
  el.setAttribute("aria-hidden", "true");
}
function drawerAberto() {
  return document.querySelector(".ficha-drawer.aberto");
}
function fecharDrawerPedido() {
  fecharDrawer(pedidoDrawer);
  pedidoDrawerRodape.classList.add("d-none");
}
function fecharDrawerVincular() { fecharDrawer(vincularDrawer); }

async function verDetalhesPedido(pvcod) {
  const pedido = pedidosCliente.find((p) => Number(p.pvcod) === Number(pvcod));
  const st = pedido ? statusPedido(pedido) : { label: "—", cls: "bg-secondary-subtle text-secondary border-secondary-subtle" };

  pedidoDrawerTitulo.textContent = `Pedido #${pvcod}`;
  pedidoDrawerSubtitulo.textContent = pedido
    ? `${fmtCanal(pedido.pvcanal)} · ${fmtDate(pedido.pvdtcad)}`
    : "";
  pedidoDrawerStatus.innerHTML = badge(st.cls, st.label);
  pedidoDrawerRodape.classList.add("d-none");
  pedidoDrawerRodape.innerHTML = "";
  pedidoDrawerConteudo.innerHTML = `
    <div class="p-3 p-md-4">
      <div class="d-flex justify-content-between align-items-baseline mb-1">
        <span class="ou-detalhe-secao-titulo">Produtos</span>
        <span class="text-muted small js-itens-contador"></span>
      </div>
      <div class="ou-detalhe-itens js-pedido-itens">
        <div class="ficha-vazio"><span class="spinner-border spinner-border-sm"></span></div>
      </div>
    </div>`;
  abrirDrawer(pedidoDrawer, qs("btnFecharDrawer"));

  try {
    const itens = await api(`/pedido/detalhe/${pvcod}`);
    const container = pedidoDrawerConteudo.querySelector(".js-pedido-itens");
    const contador = pedidoDrawerConteudo.querySelector(".js-itens-contador");
    if (!container) return;
    if (!Array.isArray(itens) || !itens.length) {
      container.innerHTML = '<div class="ficha-vazio">Sem itens para exibir (pedido cancelado ou não encontrado).</div>';
      if (contador) contador.textContent = "";
      return;
    }
    if (contador) contador.textContent = `${itens.length} ${itens.length === 1 ? "item" : "itens"}`;

    container.innerHTML = itens
      .map((i) => {
        const qtd = toNum(i.pviqtde);
        const unit = toNum(i.pvivl);
        const subtotal = qtd * unit;
        const cor = i.cornome && String(i.cornome).trim() ? i.cornome : "Sem cor";
        return `
          <div class="ou-detalhe-item">
            <div class="ou-detalhe-item-top">
              <span class="ou-detalhe-item-nome">${escapeHtml(i.prodes || "")}</span>
              <span class="ou-detalhe-item-subtotal">${fmtMoney(subtotal)}</span>
            </div>
            <div class="ou-detalhe-item-cor">${escapeHtml(cor)}</div>
            <div class="ou-detalhe-metricas">
              <div class="ou-detalhe-metrica">
                <span class="ou-detalhe-label">Quantidade</span>
                <span class="ou-detalhe-numero">${qtd}</span>
              </div>
              <div class="ou-detalhe-metrica">
                <span class="ou-detalhe-label">Valor unitário</span>
                <span class="ou-detalhe-numero">${fmtMoney(unit)}</span>
              </div>
              <div class="ou-detalhe-metrica">
                <span class="ou-detalhe-label">Subtotal</span>
                <span class="ou-detalhe-numero">${fmtMoney(subtotal)}</span>
              </div>
            </div>
          </div>`;
      })
      .join("");

    const total = pedido
      ? toNum(pedido.pvvl)
      : itens.reduce((s, i) => s + toNum(i.pviqtde) * toNum(i.pvivl), 0);
    pedidoDrawerRodape.innerHTML = `
      <div class="ou-detalhe-total">
        <span class="ou-detalhe-total-label">Total do pedido</span>
        <span class="ou-detalhe-total-valor">${fmtMoney(total)}</span>
      </div>`;
    pedidoDrawerRodape.classList.remove("d-none");
  } catch (err) {
    const container = pedidoDrawerConteudo.querySelector(".js-pedido-itens");
    if (container) container.innerHTML = '<div class="ficha-vazio text-danger">Erro ao carregar o pedido.</div>';
  }
}

qs("btnFecharDrawer").addEventListener("click", fecharDrawerPedido);
qs("btnFecharDrawer2").addEventListener("click", fecharDrawerPedido);

// Esc fecha o painel lateral em vez do modal do cliente.
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape") return;
    const aberto = drawerAberto();
    if (aberto) {
      e.preventDefault();
      e.stopPropagation();
      fecharDrawer(aberto);
    }
  },
  true
);

async function desvincularPedido(id, pvcod) {
  const msg = `Desvincular pedido?\n\nO pedido #${pvcod} deixará de estar vinculado a este cliente. O pedido não será excluído.`;
  if (!confirm(msg)) return;
  try {
    await api(`/cli/${id}/pedidos/${pvcod}`, { method: "DELETE" });
    showToast("Pedido desvinculado.", true);
    fecharDrawerPedido();
    await carregarPedidos(id);
    await carregarConta(id);
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Erro ao desvincular pedido.", false);
  }
}

// ---------------------------------------------------------------------------
// Vincular pedido (painel lateral)
// ---------------------------------------------------------------------------
function abrirVincularDrawer() {
  buscaPedidoDisponivel.value = "";
  abrirDrawer(vincularDrawer, buscaPedidoDisponivel);
  buscarPedidosDisponiveis();
}
qs("btnAbrirVincular").addEventListener("click", abrirVincularDrawer);
qs("btnFecharVincular").addEventListener("click", fecharDrawerVincular);
qs("btnFecharVincular2").addEventListener("click", fecharDrawerVincular);
btnBuscarPedidoDisponivel.addEventListener("click", buscarPedidosDisponiveis);
buscaPedidoDisponivel.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); buscarPedidosDisponiveis(); }
});

async function buscarPedidosDisponiveis() {
  const termo = buscaPedidoDisponivel.value.trim();
  pedidosDisponiveisLista.innerHTML =
    '<div class="ficha-vazio"><span class="spinner-border spinner-border-sm me-2"></span>Carregando pedidos...</div>';
  try {
    const lista = await api(`/cli/pedidos/disponiveis?q=${encodeURIComponent(termo)}&limit=30`);
    if (!lista.length) {
      const vazio = termo
        ? {
            icon: "fa-magnifying-glass",
            title: "Nenhum pedido encontrado",
            desc: "Não encontramos pedidos correspondentes à sua busca.",
          }
        : {
            icon: "fa-circle-check",
            title: "Nenhum pedido disponível",
            desc: "Todos os pedidos já estão vinculados a clientes.",
          };
      pedidosDisponiveisLista.innerHTML = `
        <div class="ficha-vazio">
          <i class="fa-solid ${vazio.icon} fs-3 d-block mb-2 text-muted"></i>
          <div class="fw-semibold text-dark">${vazio.title}</div>
          <div class="small">${vazio.desc}</div>
        </div>`;
      return;
    }

    pedidosDisponiveisLista.innerHTML = "";
    lista.forEach((p) => {
      const st = statusPedido(p);
      const item = document.createElement("div");
      item.className = "ou-vincular-item";
      item.innerHTML = `
        <div class="ou-vincular-main">
          <span class="ou-vincular-num">#${p.pvcod}</span>
          ${badge(st.cls, st.label)}
          <span class="ou-vincular-meta">${fmtDate(p.pvdtcad)} · ${escapeHtml(p.pvcanal || "—")}</span>
        </div>
        <div class="ou-vincular-right">
          <span class="ou-vincular-valor">${fmtMoney(p.pvvl)}</span>
        </div>
      `;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-primary ou-vincular-btn";
      btn.textContent = "Vincular";
      btn.setAttribute("aria-label", `Vincular pedido #${p.pvcod}`);
      btn.addEventListener("click", () => vincularPedido(p.pvcod, btn));
      item.querySelector(".ou-vincular-right").appendChild(btn);
      pedidosDisponiveisLista.appendChild(item);
    });
  } catch (err) {
    pedidosDisponiveisLista.innerHTML = '<div class="ficha-vazio text-danger">Erro ao buscar pedidos.</div>';
  }
}

function definirLoadingVincular(ativo) {
  pedidosDisponiveisLista.querySelectorAll(".ou-vincular-btn").forEach((b) => {
    b.disabled = true;
    if (b === ativo) b.textContent = "Vinculando...";
  });
}
function restaurarVincular() {
  pedidosDisponiveisLista.querySelectorAll(".ou-vincular-btn").forEach((b) => {
    b.disabled = false;
    b.textContent = "Vincular";
  });
}

async function vincularPedido(pvcod, btn) {
  const id = f_parcod.value;
  if (!id) return;
  definirLoadingVincular(btn);
  try {
    await api(`/cli/${id}/pedidos/${pvcod}`, { method: "POST" });
    showToast(`Pedido #${pvcod} vinculado.`, true);
    await carregarPedidos(id);
    await carregarConta(id);
    carregarClientes();
    await buscarPedidosDisponiveis();
  } catch (err) {
    restaurarVincular();
    showToast(err.message || "Erro ao vincular pedido.", false);
  }
}

// ---------------------------------------------------------------------------
// Cobranças
// ---------------------------------------------------------------------------
async function carregarCobrancas(id) {
  try {
    const lista = await api(`/cli/${id}/cobrancas`);
    cobrancasCount.textContent = lista.length;
    if (!lista.length) {
      cobrancasLista.innerHTML = '<div class="ficha-vazio">Nenhuma cobrança para este cliente.</div>';
      return;
    }
    cobrancasLista.innerHTML = "";
    lista.forEach((c) => {
      const st = statusCobranca(c);
      const partes = [
        c.cobpvcod ? `Pedido #${c.cobpvcod}` : "Cobrança avulsa",
        c.cobvenc ? `Vence ${fmtDate(c.cobvenc)}` : "Sem vencimento",
      ];
      if (c.cobobs) partes.push(escapeHtml(c.cobobs));

      const item = document.createElement("div");
      item.className = "ou-cobranca-item";
      item.innerHTML = `
        <div class="ou-cobranca-info">
          <div class="ou-cobranca-head">
            <span class="ou-cobranca-valor">${fmtMoney(c.cobvalor)}</span>
            ${badge(st.cls, st.label)}
          </div>
          <div class="ou-cobranca-meta">${partes.join(" · ")}</div>
        </div>
      `;

      const acoes = document.createElement("div");
      acoes.className = "ou-cobranca-acoes";

      // "Cobrar" existe apenas para cobranças abertas ou vencidas.
      if (c.cobsta === "A") {
        const btnZap = document.createElement("button");
        btnZap.type = "button";
        btnZap.className = "btn btn-sm btn-success";
        btnZap.innerHTML = '<i class="fa-brands fa-whatsapp me-1"></i> Cobrar';
        btnZap.title = "Cobrar pelo WhatsApp";
        btnZap.addEventListener("click", () => cobrarWhatsApp(c));
        acoes.appendChild(btnZap);

        const btnPagar = document.createElement("button");
        btnPagar.type = "button";
        btnPagar.className = "btn btn-sm btn-outline-primary";
        btnPagar.textContent = "Registrar pagamento";
        btnPagar.addEventListener("click", () => baixarCobranca(id, c.cobcod));
        acoes.appendChild(btnPagar);

        const btnCancelar = document.createElement("button");
        btnCancelar.type = "button";
        btnCancelar.className = "btn btn-sm btn-outline-secondary";
        btnCancelar.textContent = "Cancelar";
        btnCancelar.addEventListener("click", () => cancelarCobranca(id, c.cobcod));
        acoes.appendChild(btnCancelar);
      }

      if (acoes.children.length) item.appendChild(acoes);
      cobrancasLista.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    cobrancasLista.innerHTML = '<div class="ficha-vazio text-danger">Erro ao carregar cobranças.</div>';
  }
}

qs("btnNovaCobranca").addEventListener("click", () => {
  qs("cobrancaForm").classList.toggle("d-none");
  if (!qs("cobrancaForm").classList.contains("d-none")) qs("cobValor").focus();
});
qs("btnCancelarCobranca").addEventListener("click", fecharPainelCobranca);
qs("cobrancaForm").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); btnAddCobranca.click(); }
});

btnAddCobranca.addEventListener("click", async () => {
  const id = f_parcod.value;
  if (!id) return;
  const valor = Number(qs("cobValor").value);
  if (!valor || valor <= 0) return showToast("Informe o valor da cobrança.", false);

  btnAddCobranca.disabled = true;
  try {
    await api(`/cli/${id}/cobrancas`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        cobvalor: valor,
        cobvenc: qs("cobVenc").value || null,
        cobobs: qs("cobObs").value.trim() || null,
        cobpvcod: cobPedido.value || null,
      }),
    });
    fecharPainelCobranca();
    showToast("Cobrança gerada.", true);
    await carregarCobrancas(id);
    await carregarConta(id);
    await carregarMovimentacoes(id);
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Erro ao gerar cobrança.", false);
  } finally {
    btnAddCobranca.disabled = false;
  }
});

async function baixarCobranca(id, cobcod) {
  if (!confirm(`Registrar o pagamento da cobrança #${cobcod}?`)) return;
  try {
    await api(`/cli/${id}/cobrancas/${cobcod}/baixar`, { method: "PUT" });
    showToast("Pagamento registrado.", true);
    await carregarCobrancas(id);
    await carregarConta(id);
    await carregarMovimentacoes(id);
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Erro ao registrar pagamento.", false);
  }
}

async function cancelarCobranca(id, cobcod) {
  if (!confirm(`Cancelar a cobrança #${cobcod}?`)) return;
  try {
    await api(`/cli/${id}/cobrancas/${cobcod}/cancelar`, { method: "PUT" });
    showToast("Cobrança cancelada.", true);
    await carregarCobrancas(id);
    await carregarConta(id);
    await carregarMovimentacoes(id);
    carregarClientes();
  } catch (err) {
    showToast(err.message || "Erro ao cancelar cobrança.", false);
  }
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------
function mascaraTelefone(valor) {
  const s = onlyDigits(valor).slice(0, 11);
  if (s.length > 10) return s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (s.length > 6) return s.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  if (s.length > 2) return s.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return s;
}
f_parfone.addEventListener("input", (e) => {
  e.target.value = mascaraTelefone(e.target.value);
  if (onlyDigits(e.target.value)) alertaTelefone.classList.add("d-none");
});
f_parcep.addEventListener("blur", (e) => {
  const s = onlyDigits(e.target.value).slice(0, 8);
  e.target.value = s.length === 8 ? `${s.slice(0, 5)}-${s.slice(5)}` : s;
});
f_parcnpjcpf.addEventListener("blur", (e) => { e.target.value = onlyDigits(e.target.value); });

// ---------------------------------------------------------------------------
// Paginação / busca / inicialização
// ---------------------------------------------------------------------------
btnNew.addEventListener("click", abrirNovaFicha);

btnNext.addEventListener("click", () => {
  const pages = Math.ceil(total / pageSize);
  if (page < pages) { page++; carregarClientes(); }
});
btnPrev.addEventListener("click", () => {
  if (page > 1) { page--; carregarClientes(); }
});

let searchTimer = null;
searchInput.addEventListener("input", (e) => {
  q = (e.target.value || "").trim();
  page = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(carregarClientes, 300);
});

cliModalEl.addEventListener("hidden.bs.modal", () => {
  cliForm.reset();
  f_parcod.value = "";
  limparCidade();
  fecharPainelLancamento();
  fecharPainelCobranca();
  fecharDrawerPedido();
  fecharDrawerVincular();
  alertaTelefone.classList.add("d-none");
});

document.addEventListener("DOMContentLoaded", () => {
  carregarClientes();
  carregarMunicipios();
});
