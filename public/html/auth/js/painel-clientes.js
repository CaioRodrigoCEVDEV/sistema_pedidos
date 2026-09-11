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
const resultsInfo = qs("resultsInfo");
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
const pedidoDrawerConteudo = qs("pedidoDrawerConteudo");
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
    total = data.total || 0;
    renderTabela(data.data || []);
    resultsInfo.textContent = `${total} cliente(s)`;
    emptyState.style.display = (data.data || []).length ? "none" : "block";
  } catch (err) {
    console.error(err);
    showToast("Falha ao carregar clientes.", false);
  }
}

function renderTabela(lista) {
  tbody.innerHTML = "";
  lista.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "cliente-linha";
    const cidadeUF = [r.mundes, r.ufsigla].filter(Boolean).join("/") || "—";
    const emAberto = toNum(r.em_aberto);
    const corSaldo = emAberto > 0 ? "text-danger" : "text-muted";
    const contato = r.parfone ? escapeHtml(fmtPhone(r.parfone)) : "—";
    const email = r.paremail ? `<div class="text-muted small text-truncate">${escapeHtml(r.paremail)}</div>` : "";

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
      <td>${r.parsit === "I"
        ? '<span class="badge rounded-pill bg-secondary-subtle text-secondary border border-secondary-subtle">Inativo</span>'
        : '<span class="badge rounded-pill bg-success-subtle text-success border border-success-subtle">Ativo</span>'}</td>
    `;
    tr.addEventListener("click", () => abrirFicha(r.parcod));
    tbody.appendChild(tr);
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
    cliSituacaoBadge.className = "badge rounded-pill bg-secondary-subtle text-secondary border border-secondary-subtle";
    cliSituacaoBadge.textContent = "Inativo";
  } else {
    cliSituacaoBadge.className = "badge rounded-pill bg-success-subtle text-success border border-success-subtle";
    cliSituacaoBadge.textContent = "Ativo";
  }
  cliSituacaoBadge.classList.remove("d-none");
}
function renderCabecalhoNovo() {
  clienteAtual = null;
  cliTitulo.textContent = "Novo cliente";
  cliSubtitulo.textContent = "Preencha os dados para cadastrar";
  cliAvatar.textContent = "?";
  cliSituacaoBadge.classList.add("d-none");
  cliResumo.style.display = "none";
  cliWhatsApp.disabled = true;
}
function renderCabecalhoCliente(data) {
  clienteAtual = data;
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
  [tabPedidosBtn, tabContaBtn, tabCobrancasBtn].forEach((btn) => {
    btn.disabled = !habilitado;
    btn.classList.toggle("disabled", !habilitado);
  });
  if (!habilitado) bootstrap.Tab.getOrCreateInstance(tabDadosBtn).show();
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
  try {
    const data = await api(`/cli/${id}`);
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
  if (!id || !confirm("Inativar este cliente?")) return;
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
  if (!confirm("Excluir DEFINITIVAMENTE este cliente? Só é permitido se não houver vínculos.")) return;
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
      movLista.innerHTML = '<div class="ficha-vazio">Nenhuma movimentação registrada.</div>';
      return;
    }
    movLista.innerHTML = "";
    lista.forEach((m) => {
      const delta = toNum(m.movvalor);
      const cor = delta > 0 ? "text-danger" : delta < 0 ? "text-success" : "text-muted";
      const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
      const div = document.createElement("div");
      div.className = "list-group-item py-2";
      div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center gap-2">
          <div class="min-w-0">
            <div class="fw-semibold">${escapeHtml(MOV_LABEL[m.movtipo] || m.movtipo || "Movimentação")}</div>
            <div class="text-muted small text-truncate">
              ${fmtDate(m.movdtcad)}${m.movdesc ? " · " + escapeHtml(m.movdesc) : ""}${m.movref ? " · " + escapeHtml(m.movref) : ""}
            </div>
          </div>
          <div class="text-end">
            <div class="fw-semibold ${cor}">${sinal} ${fmtMoney(Math.abs(delta))}</div>
            <div class="text-muted small">Saldo: ${fmtMoney(m.movsaldo)}</div>
          </div>
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
function fecharDrawerPedido() { fecharDrawer(pedidoDrawer); }
function fecharDrawerVincular() { fecharDrawer(vincularDrawer); }

async function verDetalhesPedido(pvcod) {
  const pedido = pedidosCliente.find((p) => Number(p.pvcod) === Number(pvcod));
  const st = pedido ? statusPedido(pedido) : { label: "—", cls: "bg-secondary-subtle text-secondary border-secondary-subtle" };

  pedidoDrawerTitulo.textContent = `Pedido #${pvcod}`;
  pedidoDrawerSubtitulo.textContent = pedido
    ? `${pedido.pvcanal || "—"} · ${fmtDate(pedido.pvdtcad)}`
    : "";
  pedidoDrawerConteudo.innerHTML = `
    <div class="p-3">
      <div class="mb-3">${badge(st.cls, st.label)}</div>
      <div class="fw-semibold mb-2">Produtos</div>
      <div class="js-pedido-itens">
        <div class="ficha-vazio"><span class="spinner-border spinner-border-sm"></span></div>
      </div>
    </div>`;
  abrirDrawer(pedidoDrawer, qs("btnFecharDrawer"));

  try {
    const itens = await api(`/pedido/detalhe/${pvcod}`);
    const container = pedidoDrawerConteudo.querySelector(".js-pedido-itens");
    if (!container) return;
    if (!Array.isArray(itens) || !itens.length) {
      container.innerHTML = '<div class="ficha-vazio">Sem itens para exibir (pedido cancelado ou não encontrado).</div>';
      return;
    }
    const total = itens.reduce((s, i) => s + toNum(i.pviqtde) * toNum(i.pvivl), 0);
    container.innerHTML =
      itens
        .map((i) => {
          const subtotal = toNum(i.pviqtde) * toNum(i.pvivl);
          return `
            <div class="border rounded p-3 mb-2">
              <div class="fw-semibold">${escapeHtml(i.prodes || "")}</div>
              <div class="text-muted small mb-2">Cor: ${escapeHtml(i.cornome || "Sem Cor")}</div>
              <div class="row g-2 text-center">
                <div class="col-4">
                  <div class="text-muted small">Quantidade</div>
                  <div>${toNum(i.pviqtde)}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Valor unit.</div>
                  <div>${fmtMoney(i.pvivl)}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Subtotal</div>
                  <div class="fw-semibold">${fmtMoney(subtotal)}</div>
                </div>
              </div>
            </div>`;
        })
        .join("") +
      `<div class="d-flex justify-content-between align-items-center border-top pt-3 mt-2">
         <span class="fw-semibold">Total</span>
         <span class="fw-semibold">${fmtMoney(pedido ? pedido.pvvl : total)}</span>
       </div>`;
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
      const div = document.createElement("div");
      div.className = "list-group-item d-flex flex-wrap align-items-center gap-2 py-3";
      div.innerHTML = `
        <div class="me-auto min-w-0">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="fw-semibold">${fmtMoney(c.cobvalor)}</span>
            ${badge(st.cls, st.label)}
          </div>
          <div class="text-muted small">
            ${c.cobpvcod ? `Pedido #${c.cobpvcod} · ` : ""}
            ${c.cobvenc ? `Vence ${fmtDate(c.cobvenc)}` : "Sem vencimento"}
            ${c.cobobs ? " · " + escapeHtml(c.cobobs) : ""}
          </div>
        </div>
      `;
      const acoes = document.createElement("div");
      acoes.className = "d-flex gap-1 flex-wrap";

      // "Cobrar" existe apenas para cobranças abertas ou vencidas.
      if (c.cobsta === "A") {
        const btnZap = document.createElement("button");
        btnZap.type = "button";
        btnZap.className = "btn btn-sm btn-outline-success";
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

      div.appendChild(acoes);
      cobrancasLista.appendChild(div);
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
