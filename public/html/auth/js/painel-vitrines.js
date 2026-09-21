/**
 * Vitrines da Página Inicial (Destaques / Mais vendidos / Novidades).
 *
 * Permite ativar/desativar cada vitrine, definir a ordem de exibição na loja,
 * limitar a quantidade das vitrines automáticas e gerenciar manualmente os
 * produtos dos Destaques.
 */

var TIPOS_VITRINE = {
  featured: {
    label: "Manual",
    classe: "badge-tipo-manual",
    descricao: "Você escolhe e ordena os produtos exibidos",
  },
  best_sellers: {
    label: "Automática",
    classe: "badge-tipo-automatica",
    descricao: "Produtos com maior quantidade vendida",
  },
  new_arrivals: {
    label: "Automática",
    classe: "badge-tipo-automatica",
    descricao: "Produtos cadastrados mais recentemente",
  },
};

var LIMITE_MAX_ITENS = 50;

var vitrines = [];
var destaqueSelecionados = [];
var buscaResultados = [];
var modalGerenciar = null;
var modalPreview = null;
var modalTitulo = null;
var tituloVitrineId = null;

var vitrinesTableBody = document.getElementById("vitrinesTableBody");
var loadingState = document.getElementById("loadingState");
var emptyState = document.getElementById("emptyState");
var buscaProdutoInput = document.getElementById("buscaProduto");
var btnBuscarProduto = document.getElementById("btnBuscarProduto");
var resultadoBusca = document.getElementById("resultadoBusca");
var listaSelecionados = document.getElementById("listaSelecionados");
var qtdSelecionados = document.getElementById("qtdSelecionados");
var listaPreview = document.getElementById("listaPreview");
var previewDescricao = document.getElementById("previewDescricao");
var modalPreviewLabel = document.getElementById("modalPreviewLabel");
var tituloVitrineInput = document.getElementById("tituloVitrine");
var btnSalvarTitulo = document.getElementById("btnSalvarTitulo");

function escapeHtml(valor) {
  return String(valor == null ? "" : valor).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function notificar(mensagem, tipo) {
  if (typeof window.ouToast === "function") {
    window.ouToast(mensagem, tipo || "success");
  } else {
    alert(mensagem);
  }
}

function obterDestaque() {
  return vitrines.find((vitrine) => vitrine.type === "featured") || null;
}

async function lerErro(response, fallback) {
  try {
    const data = await response.json();
    return data.error || data.message || fallback;
  } catch (error) {
    return fallback;
  }
}

// ---------------------------------------------------------------- listagem

async function carregarVitrines() {
  loadingState.style.display = "block";
  emptyState.style.display = "none";

  try {
    const response = await fetch(`${BASE_URL}/showcases/admin`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao carregar vitrines"));
    }

    const data = await response.json();
    vitrines = Array.isArray(data.showcases) ? data.showcases : [];

    renderizarVitrines();
    atualizarModalGerenciar();

    emptyState.style.display = vitrines.length === 0 ? "block" : "none";
  } catch (error) {
    console.error("Erro ao carregar vitrines:", error);
    notificar(error.message || "Erro ao carregar vitrines", "error");
  } finally {
    loadingState.style.display = "none";
  }
}

function renderizarVitrines() {
  vitrinesTableBody.innerHTML = "";

  vitrines.forEach((vitrine, index) => {
    const tipo = TIPOS_VITRINE[vitrine.type] || {
      label: vitrine.type,
      classe: "badge-tipo-automatica",
      descricao: "",
    };
    const manual = vitrine.type === "featured";
    const primeira = index === 0;
    const ultima = index === vitrines.length - 1;

    const exibicao = manual
      ? `<span class="text-muted small">${vitrine.items.length} produto${
          vitrine.items.length === 1 ? "" : "s"
        }</span>`
      : `<div class="input-group input-group-sm d-inline-flex vitrine-max">
           <input
             type="number"
             class="form-control"
             min="1"
             max="${LIMITE_MAX_ITENS}"
             value="${vitrine.max_items}"
             data-max-id="${vitrine.id}"
             aria-label="Quantidade máxima de itens"
           />
           <button
             class="btn btn-outline-secondary"
             type="button"
             data-salvar-max="${vitrine.id}"
             title="Salvar quantidade máxima"
           >
             <i class="bi bi-check-lg"></i>
           </button>
         </div>`;

    const acao = manual
      ? `<button type="button" class="btn btn-primary btn-sm" data-gerenciar="${vitrine.id}">
           <i class="bi bi-sliders"></i> Gerenciar
         </button>`
      : `<button type="button" class="btn btn-outline-secondary btn-sm" data-preview="${vitrine.id}">
           <i class="bi bi-eye"></i> Visualizar
         </button>`;

    const tr = document.createElement("tr");
    tr.dataset.vitrineId = vitrine.id;
    tr.dataset.vitrineType = vitrine.type;
    tr.innerHTML = `
      <td data-label="Vitrine">
        <strong>${escapeHtml(vitrine.title)}</strong>
        ${
          manual
            ? `<button
                 type="button"
                 class="btn btn-link btn-sm p-0 ms-1 align-baseline"
                 data-editar-titulo="${vitrine.id}"
                 title="Alterar o título desta vitrine"
                 aria-label="Alterar o título da vitrine ${escapeHtml(vitrine.title)}"
               >
                 <i class="bi bi-pencil"></i>
               </button>`
            : ""
        }
        <div class="vitrine-desc">${escapeHtml(tipo.descricao)}</div>
      </td>
      <td class="text-center" data-label="Tipo">
        <span class="badge ${tipo.classe}">${escapeHtml(tipo.label)}</span>
      </td>
      <td class="text-center" data-label="Status">
        <div class="form-check form-switch d-inline-block m-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            data-status-id="${vitrine.id}"
            ${vitrine.active ? "checked" : ""}
            aria-label="Ativar ou desativar ${escapeHtml(vitrine.title)}"
          />
        </div>
        <div class="vitrine-desc">${vitrine.active ? "Ativa" : "Inativa"}</div>
      </td>
      <td class="text-center" data-tour="ordem" data-label="Ordem">
        <div class="vitrine-ordem justify-content-center">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-mover="${vitrine.id}"
            data-dir="-1"
            ${primeira ? "disabled" : ""}
            title="Mover para cima"
          >
            <i class="bi bi-arrow-up"></i>
          </button>
          <span>${vitrine.position}</span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            data-mover="${vitrine.id}"
            data-dir="1"
            ${ultima ? "disabled" : ""}
            title="Mover para baixo"
          >
            <i class="bi bi-arrow-down"></i>
          </button>
        </div>
      </td>
      <td class="text-center" data-label="Exibição">${exibicao}</td>
      <td class="text-end" data-label="Ações">${acao}</td>
    `;

    vitrinesTableBody.appendChild(tr);
  });
}

// ------------------------------------------------------------- mutações

async function alternarStatus(id, active, input) {
  input.disabled = true;
  try {
    const response = await fetch(`${BASE_URL}/showcases/admin/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active }),
    });
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao atualizar vitrine"));
    }

    notificar(active ? "Vitrine ativada." : "Vitrine desativada.");
    await carregarVitrines();
  } catch (error) {
    console.error("Erro ao alternar status da vitrine:", error);
    notificar(error.message || "Erro ao atualizar vitrine", "error");
    input.checked = !active;
    input.disabled = false;
  }
}

async function moverVitrine(id, direcao) {
  const ids = vitrines.map((vitrine) => vitrine.id);
  const indice = ids.indexOf(id);
  const destino = indice + Number(direcao);

  if (indice < 0 || destino < 0 || destino >= ids.length) return;

  const troca = ids[indice];
  ids[indice] = ids[destino];
  ids[destino] = troca;

  try {
    const response = await fetch(`${BASE_URL}/showcases/admin/ordem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ordem: ids }),
    });
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao reordenar vitrines"));
    }

    await carregarVitrines();
  } catch (error) {
    console.error("Erro ao reordenar vitrines:", error);
    notificar(error.message || "Erro ao reordenar vitrines", "error");
  }
}

async function salvarMaxItens(id, input) {
  const valor = parseInt(input.value, 10);
  if (!Number.isInteger(valor) || valor < 1 || valor > LIMITE_MAX_ITENS) {
    notificar(`Informe uma quantidade entre 1 e ${LIMITE_MAX_ITENS}.`, "error");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/showcases/admin/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ max_items: valor }),
    });
    if (!response.ok) {
      throw new Error(
        await lerErro(response, "Erro ao salvar quantidade máxima")
      );
    }

    notificar("Quantidade máxima atualizada.");
    await carregarVitrines();
  } catch (error) {
    console.error("Erro ao salvar quantidade máxima:", error);
    notificar(error.message || "Erro ao salvar quantidade máxima", "error");
  }
}

// ---------------------------------------------------- modal gerenciar

function abrirGerenciar(id) {
  const vitrine = vitrines.find((item) => item.id === id);
  if (!vitrine) return;

  destaqueSelecionados = vitrine.items.slice();
  buscaResultados = [];
  buscaProdutoInput.value = "";
  resultadoBusca.innerHTML = "";

  renderizarSelecionados();

  const modalElement = document.getElementById("modalGerenciar");
  modalGerenciar = modalGerenciar || new bootstrap.Modal(modalElement);
  modalGerenciar.show();
}

function atualizarModalGerenciar() {
  const modalElement = document.getElementById("modalGerenciar");
  if (!modalElement || !modalElement.classList.contains("show")) return;

  const destaque = obterDestaque();
  destaqueSelecionados = destaque ? destaque.items.slice() : [];
  renderizarSelecionados();
}

function renderizarSelecionados() {
  qtdSelecionados.textContent = String(destaqueSelecionados.length);

  if (destaqueSelecionados.length === 0) {
    listaSelecionados.innerHTML = `
      <div class="ou-empty">
        <span class="ou-empty__icon"><i class="bi bi-star"></i></span>
        <span class="ou-empty__title">Nenhum produto selecionado</span>
        <span class="ou-empty__text">Busque produtos acima para adicionar aos Destaques.</span>
      </div>`;
    return;
  }

  listaSelecionados.innerHTML = destaqueSelecionados
    .map((item, index) => {
      const inativo =
        String(item.prosit || "A").trim().toUpperCase() !== "A"
          ? '<span class="badge badge-vitrine-inativo">Inativo</span>'
          : "";
      return `
        <div class="vitrine-item" data-item-procod="${item.procod}">
          <span class="vitrine-item__pos">${index + 1}</span>
          <span class="vitrine-item__main">
            <span class="vitrine-item__name">${escapeHtml(item.prodes)}</span>
            <span class="vitrine-item__meta">
              <span>${escapeHtml(item.tipodes || "")}</span>
              <span>${escapeHtml(item.marcasdes || "")}</span>
              ${inativo}
            </span>
          </span>
          <span class="btn-group btn-group-sm" role="group" aria-label="Ações do produto">
            <button
              type="button"
              class="btn btn-outline-secondary"
              data-item-mover="${item.procod}"
              data-dir="-1"
              ${index === 0 ? "disabled" : ""}
              title="Mover para cima"
            >
              <i class="bi bi-arrow-up"></i>
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              data-item-mover="${item.procod}"
              data-dir="1"
              ${index === destaqueSelecionados.length - 1 ? "disabled" : ""}
              title="Mover para baixo"
            >
              <i class="bi bi-arrow-down"></i>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger"
              data-item-remover="${item.procod}"
              title="Remover da vitrine"
            >
              <i class="bi bi-trash"></i>
            </button>
          </span>
        </div>`;
    })
    .join("");
}

async function buscarProdutos() {
  const termo = buscaProdutoInput.value.trim();
  if (!termo) {
    resultadoBusca.innerHTML = "";
    return;
  }

  btnBuscarProduto.disabled = true;
  try {
    const response = await fetch(
      `${BASE_URL}/pros?q=${encodeURIComponent(termo)}&page=1&pageSize=10&semest=N`,
      { credentials: "include" }
    );
    if (!response.ok) {
      throw new Error("Erro ao buscar produtos");
    }

    const data = await response.json();
    buscaResultados = Array.isArray(data.data) ? data.data : [];
    renderizarBusca();
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    notificar("Erro ao buscar produtos", "error");
  } finally {
    btnBuscarProduto.disabled = false;
  }
}

function renderizarBusca() {
  if (buscaResultados.length === 0) {
    resultadoBusca.innerHTML =
      '<p class="text-muted small mb-2">Nenhum produto encontrado.</p>';
    return;
  }

  const selecionados = new Set(
    destaqueSelecionados.map((item) => Number(item.procod))
  );

  resultadoBusca.innerHTML = buscaResultados
    .map((produto) => {
      const jaSelecionado = selecionados.has(Number(produto.procod));
      return `
        <div class="busca-resultado">
          <span class="busca-resultado__main">
            <span class="busca-resultado__name">${escapeHtml(produto.prodes)}</span>
            <span class="busca-resultado__meta">
              ${escapeHtml(produto.tipodes || "")} · ${escapeHtml(
        produto.marcasdes || ""
      )} · ${formatarMoeda(produto.provl)}
            </span>
          </span>
          <button
            type="button"
            class="btn btn-sm ${
              jaSelecionado ? "btn-secondary" : "btn-success"
            }"
            data-adicionar="${produto.procod}"
            ${jaSelecionado ? "disabled" : ""}
          >
            <i class="bi bi-plus-lg"></i> ${jaSelecionado ? "Adicionado" : "Adicionar"}
          </button>
        </div>`;
    })
    .join("");
}

async function adicionarProduto(procod) {
  const destaque = obterDestaque();
  if (!destaque) return;

  try {
    const response = await fetch(
      `${BASE_URL}/showcases/admin/${destaque.id}/items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ procod }),
      }
    );
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao adicionar produto"));
    }

    const data = await response.json();
    notificar(
      data.jaExistia ? "Produto já estava na vitrine." : "Produto adicionado.",
      data.jaExistia ? "info" : "success"
    );

    await carregarVitrines();
    renderizarBusca();
  } catch (error) {
    console.error("Erro ao adicionar produto:", error);
    notificar(error.message || "Erro ao adicionar produto", "error");
  }
}

async function removerProduto(procod) {
  const destaque = obterDestaque();
  if (!destaque) return;

  try {
    const response = await fetch(
      `${BASE_URL}/showcases/admin/${destaque.id}/items/${procod}`,
      { method: "DELETE", credentials: "include" }
    );
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao remover produto"));
    }

    notificar("Produto removido dos Destaques.");
    await carregarVitrines();
    renderizarBusca();
  } catch (error) {
    console.error("Erro ao remover produto:", error);
    notificar(error.message || "Erro ao remover produto", "error");
  }
}

async function moverProduto(procod, direcao) {
  const destaque = obterDestaque();
  if (!destaque) return;

  const indice = destaqueSelecionados.findIndex(
    (item) => Number(item.procod) === Number(procod)
  );
  const destino = indice + Number(direcao);
  if (indice < 0 || destino < 0 || destino >= destaqueSelecionados.length) {
    return;
  }

  const troca = destaqueSelecionados[indice];
  destaqueSelecionados[indice] = destaqueSelecionados[destino];
  destaqueSelecionados[destino] = troca;
  renderizarSelecionados();

  const ordem = destaqueSelecionados.map((item) => item.procod);

  try {
    const response = await fetch(
      `${BASE_URL}/showcases/admin/${destaque.id}/items/ordem`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ordem }),
      }
    );
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao reordenar produtos"));
    }

    await carregarVitrines();
  } catch (error) {
    console.error("Erro ao reordenar produtos:", error);
    notificar(error.message || "Erro ao reordenar produtos", "error");
    await carregarVitrines();
  }
}

// ---------------------------------------------------- modal preview

function abrirPreview(id) {
  const vitrine = vitrines.find((item) => item.id === id);
  if (!vitrine) return;

  const tipo = TIPOS_VITRINE[vitrine.type] || {};
  modalPreviewLabel.textContent = vitrine.title;
  previewDescricao.textContent = vitrine.previewItems.length
    ? `${vitrine.previewItems.length} produto${
        vitrine.previewItems.length === 1 ? "" : "s"
      } em exibição agora · ${tipo.descricao || ""}`
    : `Nenhum produto para exibir agora · ${tipo.descricao || ""}`;

  if (vitrine.previewItems.length === 0) {
    listaPreview.innerHTML = `
      <div class="ou-empty">
        <span class="ou-empty__icon"><i class="bi bi-inbox"></i></span>
        <span class="ou-empty__title">Vitrine sem produtos</span>
        <span class="ou-empty__text">Ela não aparece na loja enquanto não houver itens.</span>
      </div>`;
  } else {
    listaPreview.innerHTML = vitrine.previewItems
      .map(
        (item, index) => `
        <div class="vitrine-item">
          <span class="vitrine-item__pos">${index + 1}</span>
          <span class="vitrine-item__main">
            <span class="vitrine-item__name">${escapeHtml(item.prodes)}</span>
            <span class="vitrine-item__meta">
              <span>${escapeHtml(item.tipodes || "")}</span>
              <span>${escapeHtml(item.marcasdes || "")}</span>
              <span>${formatarMoeda(item.provl)}</span>
            </span>
          </span>
        </div>`
      )
      .join("");
  }

  const modalElement = document.getElementById("modalPreview");
  modalPreview = modalPreview || new bootstrap.Modal(modalElement);
  modalPreview.show();
}

// -------------------------------------------------- modal título

function abrirEditarTitulo(id) {
  const vitrine = vitrines.find((item) => item.id === id);
  if (!vitrine) return;

  tituloVitrineId = id;
  tituloVitrineInput.value = vitrine.title || "";
  if (btnSalvarTitulo) btnSalvarTitulo.disabled = false;

  const modalElement = document.getElementById("modalTitulo");
  modalTitulo = modalTitulo || new bootstrap.Modal(modalElement);
  modalTitulo.show();

  modalElement.addEventListener("shown.bs.modal", function aoAbrir() {
    tituloVitrineInput.focus();
    tituloVitrineInput.select();
    modalElement.removeEventListener("shown.bs.modal", aoAbrir);
  });
}

async function salvarTitulo() {
  if (tituloVitrineId === null) return;

  const title = tituloVitrineInput.value.trim();
  if (!title) {
    notificar("Informe um título para a vitrine.", "error");
    return;
  }

  btnSalvarTitulo.disabled = true;
  try {
    const response = await fetch(
      `${BASE_URL}/showcases/admin/${tituloVitrineId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      }
    );
    if (!response.ok) {
      throw new Error(await lerErro(response, "Erro ao alterar o título"));
    }

    if (modalTitulo) modalTitulo.hide();
    notificar("Título da vitrine atualizado.");
    await carregarVitrines();
  } catch (error) {
    console.error("Erro ao alterar o título da vitrine:", error);
    notificar(error.message || "Erro ao alterar o título", "error");
    btnSalvarTitulo.disabled = false;
  }
}

// ------------------------------------------------------- tour guiado
// Orienta o administrador no primeiro acesso. O motor genérico fica em
// tour.js (window.OrderUpTour); aqui ficam os passos e a persistência da
// preferência "já visualizou" (por usuário logado, em usu.usuvitour).

var TOUR_STORAGE_KEY = "vitrinesTourVisto";

var TOUR_STEPS = [
  {
    target: "#vitrinesTourCard",
    title: "Conheça as Vitrines",
    text: "Aqui você controla quais vitrines aparecem na página inicial da loja e define a ordem em que elas serão exibidas.",
  },
  {
    target: '[data-vitrine-type="featured"]',
    title: "Destaques",
    text: "Vitrine manual: escolha os produtos que deseja destacar e organize a ordem em que eles serão apresentados aos clientes.",
  },
  {
    target: '[data-vitrine-type="featured"] [data-status-id]',
    title: "Ative ou desative uma vitrine",
    text: "Quando estiver ativa, a vitrine aparecerá na página inicial. Quando estiver inativa, ela ficará oculta para os clientes.",
  },
  {
    target: '[data-vitrine-type="best_sellers"]',
    title: "Mais vendidos",
    text: "Esta vitrine é automática e utiliza as vendas registradas no sistema para apresentar os produtos com maior quantidade vendida.",
  },
  {
    target: '[data-vitrine-type="new_arrivals"]',
    title: "Novidades",
    text: "Esta vitrine mostra automaticamente os produtos cadastrados mais recentemente.",
  },
  {
    target: '#vitrinesTableBody [data-tour="ordem"]',
    title: "Organize a ordem",
    text: "Use os controles para definir em que sequência as vitrines aparecerão na página inicial. A ordem configurada aqui é a mesma exibida na loja pública.",
  },
  {
    target: "#vitrinesTourCard",
    title: "Tudo pronto!",
    text: "Agora você pode configurar suas vitrines. As alterações feitas aqui serão refletidas na página inicial da loja.",
  },
];

function iniciarTour() {
  if (!window.OrderUpTour) return;
  window.OrderUpTour.start({ steps: TOUR_STEPS, onClose: aoFecharTour });
}

async function tourJaVisualizado() {
  try {
    if (localStorage.getItem(TOUR_STORAGE_KEY) === "true") return true;
  } catch (error) {
    /* localStorage indisponível */
  }

  try {
    const response = await fetch(`${BASE_URL}/usuario/viutour/`, {
      credentials: "include",
    });
    if (!response.ok) return false;
    const data = await response.json();
    return String(data.usuvitour || "N").toUpperCase() === "S";
  } catch (error) {
    console.error("Erro ao consultar preferência do tour:", error);
    return false;
  }
}

function aoFecharTour(resultado) {
  if (!resultado || resultado.noTargets) return;

  // "Concluir" respeita o checkbox; "Pular"/fechar sempre marca como visto
  // para não interromper o usuário novamente. O usuário pode reabrir pelo
  // botão "Ver tour".
  const persistir = resultado.dontShowAgain || resultado.forcePersist;
  if (!persistir) return;

  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  } catch (error) {
    /* localStorage indisponível */
  }

  fetch(`${BASE_URL}/usuario/viutour/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ viuTour: "S" }),
  }).catch(function (error) {
    console.error("Erro ao salvar preferência do tour:", error);
  });
}

async function iniciarTourSeNecessario() {
  if (!vitrines.length) return;
  if (document.querySelector(".modal.show")) return;
  if (await tourJaVisualizado()) return;
  iniciarTour();
}

// -------------------------------------------------------------- eventos

vitrinesTableBody.addEventListener("change", function (event) {
  const input = event.target.closest("[data-status-id]");
  if (!input) return;

  const id = parseInt(input.getAttribute("data-status-id"), 10);
  alternarStatus(id, input.checked, input);
});

vitrinesTableBody.addEventListener("click", function (event) {
  const btnMover = event.target.closest("[data-mover]");
  if (btnMover) {
    moverVitrine(
      parseInt(btnMover.getAttribute("data-mover"), 10),
      btnMover.getAttribute("data-dir")
    );
    return;
  }

  const btnSalvar = event.target.closest("[data-salvar-max]");
  if (btnSalvar) {
    const id = parseInt(btnSalvar.getAttribute("data-salvar-max"), 10);
    const input = vitrinesTableBody.querySelector(`[data-max-id="${id}"]`);
    if (input) salvarMaxItens(id, input);
    return;
  }

  const btnGerenciar = event.target.closest("[data-gerenciar]");
  if (btnGerenciar) {
    abrirGerenciar(parseInt(btnGerenciar.getAttribute("data-gerenciar"), 10));
    return;
  }

  const btnEditarTitulo = event.target.closest("[data-editar-titulo]");
  if (btnEditarTitulo) {
    abrirEditarTitulo(
      parseInt(btnEditarTitulo.getAttribute("data-editar-titulo"), 10)
    );
    return;
  }

  const btnPreview = event.target.closest("[data-preview]");
  if (btnPreview) {
    abrirPreview(parseInt(btnPreview.getAttribute("data-preview"), 10));
  }
});

btnBuscarProduto.addEventListener("click", buscarProdutos);
buscaProdutoInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarProdutos();
  }
});

resultadoBusca.addEventListener("click", function (event) {
  const btn = event.target.closest("[data-adicionar]");
  if (!btn) return;
  adicionarProduto(parseInt(btn.getAttribute("data-adicionar"), 10));
});

listaSelecionados.addEventListener("click", function (event) {
  const btnMover = event.target.closest("[data-item-mover]");
  if (btnMover) {
    moverProduto(
      parseInt(btnMover.getAttribute("data-item-mover"), 10),
      btnMover.getAttribute("data-dir")
    );
    return;
  }

  const btnRemover = event.target.closest("[data-item-remover]");
  if (btnRemover) {
    removerProduto(parseInt(btnRemover.getAttribute("data-item-remover"), 10));
  }
});

if (btnSalvarTitulo) {
  btnSalvarTitulo.addEventListener("click", salvarTitulo);
}

if (tituloVitrineInput) {
  tituloVitrineInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      salvarTitulo();
    }
  });
}

var btnVerTour = document.getElementById("btnVerTour");
if (btnVerTour) {
  btnVerTour.addEventListener("click", iniciarTour);
}

ouOnLoad(async () => {
  await carregarVitrines();
  iniciarTourSeNecessario();
});
