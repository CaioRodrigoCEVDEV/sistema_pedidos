const params = new URLSearchParams(window.location.search);
const erroMsg = params.get("erroMSG");
if (erroMsg === "acesso-negado") {
  alertPersonalizado("Acesso negado. Contate o administrador.", 3000);
}
if (erroMsg === "modulo-nao-habilitado") {
  alertPersonalizado("Módulo não habilitado para empresa.", 3000);
}
const novaURL = window.location.origin;
+window.location.pathname;
window.history.replaceState({}, document.title, novaURL + "/painel");

const id = params.get("id");
let marcascod = null;
let marcacodModelo = null;
let tipo = null;
let modelo = null;

function parseIntegerParam(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (
    normalizedValue === "" ||
    normalizedValue === "null" ||
    normalizedValue === "undefined"
  ) {
    return null;
  }

  const parsed = Number(normalizedValue);

  return Number.isInteger(parsed) ? parsed : null;
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const holder = document.getElementById("painelMarca");
  if (!holder) return;

  // Função para carregar marcas
  function carregarMarcasPainel() {
    fetch(`${BASE_URL}/marcas/`)
      .then((res) => res.json())
      .then((dados) => {
        holder.innerHTML = ""; // zera antes
        let html = '<option value="">Selecione uma marca</option>';
        dados.forEach((marca) => {
          html += `<option value="${marca.marcascod}"${
            id == marca.marcascod ? " selected" : ""
          }>${marca.marcasdes}</option>`;
        });
        holder.innerHTML = html;
      })
      .catch(console.error);
  }

  // Carrega inicialmente
  carregarMarcasPainel();

  // Carrega novamente ao focar (atualiza dados)
  holder.addEventListener("focus", (e) => {
    carregarMarcasPainel();
  });

  holder.addEventListener("change", (e) => {
    marcacodModelo = parseIntegerParam(e.target.value);
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const holder = document.getElementById("selectPainelMarca");
  if (!holder) return;

  // Carrega marcas apenas uma vez ao carregar a página
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      holder.innerHTML = '<option value="">Selecione a Marca</option>';
      dados.forEach((marca) => {
        holder.innerHTML += `<option value="${marca.marcascod}">${marca.marcasdes}</option>`;
      });
    })
    .catch(console.error);
  holder.addEventListener("focus", () => {
    fetch(`${BASE_URL}/marcas/`)
      .then((res) => res.json())
      .then((dados) => {
        holder.innerHTML = '<option value="">Selecione a Marca</option>';
        dados.forEach((marca) => {
          holder.innerHTML += `<option value="${marca.marcascod}">${marca.marcasdes}</option>`;
        });
      })
      .catch(console.error);
  });
  holder.addEventListener("change", (e) => {
    marcascod = parseIntegerParam(e.target.value);
    const modeloHolder = document.getElementById("selectPainelModelo");

    if (modeloHolder) {
      modeloHolder.innerHTML = '<option value="">Selecione o Modelo</option>';
    }

    modelo = null;

    if (marcascod === null) {
      return;
    }

    // Só faz o fetch dos modelos ao selecionar uma marca válida
    fetch(`${BASE_URL}/modelo/${marcascod}`)
      .then((res) => res.json())
      .then((modelos) => {
        if (!modeloHolder) return;
        modeloHolder.innerHTML = '<option value="">Selecione o Modelo</option>';
        modelos.forEach((modeloItem) => {
          modeloHolder.innerHTML += `<option value="${modeloItem.modcod}">${modeloItem.moddes}</option>`;
        });

        modeloHolder.addEventListener("change", (e) => {
          modelo = parseIntegerParam(e.target.value);
        });
      })
      .catch(console.error);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  function carregarTiposPainel() {
    fetch(`${BASE_URL}/tipos/`)
      .then((res) => res.json())
      .then((dados) => {
        const holder = document.getElementById("selectPainelTipo");
        if (!holder) return;
        let html = '<option value="">Selecione o tipo</option>';
        dados.forEach((tipo) => {
          html += `<option value="${tipo.tipocod}"${
            id == tipo.tipocod ? " selected" : ""
          }>${tipo.tipodes}</option>`;
        });
        holder.innerHTML = html;
      })
      .catch(console.error);
  }

  carregarTiposPainel();

  const holder = document.getElementById("selectPainelTipo");
  if (holder) {
    holder.addEventListener("focus", () => {
      carregarTiposPainel();
    });
    holder.addEventListener("change", (e) => {
      tipo = parseIntegerParam(e.target.value);
    });
  }
});

const inputPesquisa = document.getElementById("pesquisa");
const tabelaArea = document.getElementById("tabelaArea");
const corpoTabela = document.getElementById("corpoTabela");
const tabelaAreaOrigem = tabelaArea ? tabelaArea.parentElement : null;

// Estado da listagem de peças (tabela do painel)
let pecasPage = 1;
let pecasPageSize = 20;
let pecasTotal = 0;
let pecasQ = "";
let pecasMarca = null;
let pecasModelo = null;
let pecasTipo = null;
let pecasDebounce = null;
let pecasLoading = false;
let pecasTemMais = false;
let pecasPopupAberto = false;

// Estado dos popups de gestão (marcas/modelos/tipos/cores)
let gestaoPopupAberto = false;
let gestaoAreaAberta = null;
const gestaoOrigem = {};
["areaMarcas", "areaModelos", "areaTipos", "areaCores"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) gestaoOrigem[id] = el.parentElement;
});

// Filtros dos popups de gestão (marcas/modelos/tipos/cores)
let marcasLista = [];
let marcasQ = "";
let marcasDebounce = null;
let modelosLista = [];
let modelosQ = "";
let modelosMarca = null;
let modelosDebounce = null;
let tiposLista = [];
let tiposQ = "";
let tiposDebounce = null;
let coresLista = [];
let coresQ = "";
let coresDebounce = null;

inputPesquisa.addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();
  pecasQ = pesquisa;

  clearTimeout(pecasDebounce);
  pecasDebounce = setTimeout(() => {
    if (!pesquisa) {
      if (pecasPopupAberto) carregarPecas(1);
      return;
    }
    abrirPopupPecas();
    carregarPecas(1);
  }, 300);
});

function editarProduto(codigo) {
  // First fetch the product to get the brand ID
  fetch(`${BASE_URL}/pro/painel/${codigo}`)
    .then((r) => r.json())
    .then((produto) => {
      // Now fetch remaining data
      return Promise.all([
        Promise.resolve(produto),
        fetch(`${BASE_URL}/procores`).then((r) => r.json()),
        fetch(`${BASE_URL}/proCoresDisponiveis/${codigo}`).then((r) =>
          r.json(),
        ),
      ]);
    })
    .then(([produto, coresDisponiveis, coresProduto]) => {
      // ------------------------------
      // POPUP
      // ------------------------------
      let popup = document.createElement("div");
      popup.id = "popupEditarProduto";
      popup.style = `
        position:fixed;top:0;left:0;width:100vw;height:100vh;
        background:rgba(0,0,0,0.5);display:flex;
        align-items:center;justify-content:center;z-index:9999;
      `;

      popup.innerHTML = `
        <div style="
          background:#fff;padding:24px;border-radius:8px;
          min-width:300px;width:40vw;max-height:80vh;overflow:auto;
        ">
          <h5>📦 Editar Produto</h5>
          <hr>

          <form id="formEditarProduto">

            <div class="mb-3">
              <label class="form-label">📝 Descrição</label>
              <input type="text" class="form-control" id="editarDescricao" required
                value="${produto[0]?.prodes || ""}">
            </div>

            <div class="mb-3">
              <label class="form-label">💰 Valor</label>
              <input type="number" step="0.01" class="form-control" id="editarValor" required
                value="${Number(produto[0]?.provl).toFixed(2) || ""}">
            </div>

            <div class="mb-3">
              <label class="form-label">📥 Produto sem estoque</label><br>
              <input type="checkbox" id="editar_prosemest"
                ${produto.some((p) => p.prosemest === "S") ? "checked" : ""}>
              <label for="editar_prosemest">Sem estoque geral</label>
            </div>

            <div class="mb-3">
              <label class="form-label">📥 Produto acabando</label><br>
              <input type="checkbox" id="editar_proacabando"
                ${produto.some((p) => p.proacabando === "S") ? "checked" : ""}>
              <label for="editar_proacabando">Produto acabando</label>
            </div>

            <details>
              <summary class="mb-2">🎨 Vincule as cores do produto</summary>
              <div id="editarProdutoCores" style="max-height:220px;overflow:auto;padding-right:8px;">
                ${coresDisponiveis
                  .map((c) => {
                    const ligada = coresProduto.some(
                      (cp) => cp.corcod == c.corcod,
                    );
                    const semEst = coresProduto.some(
                      (cp) => cp.corcod == c.corcod && cp.procorsemest === "S",
                    );

                    return `
                    <div class="form-check row align-items-center py-1" data-cor="${
                      c.corcod
                    }">
                      <div class="col-6">
                        <input type="checkbox" class="form-check-input checkbox-cor"
                          value="${c.corcod}" id="editar_cor_${c.corcod}"
                          ${ligada ? "checked" : ""}>
                        <label class="form-check-label" for="editar_cor_${
                          c.corcod
                        }">
                          ${c.cornome}
                        </label>
                      </div>

                      <div class="col-6">
                        <input type="checkbox" class="form-check-input checkbox-cor-semest"
                          data-cor-semest="${c.corcod}"
                          id="editar_cor_semest_${c.corcod}"
                          ${semEst ? "checked" : ""}
                          ${!ligada ? "disabled" : ""}>
                        <label class="form-check-label" for="editar_cor_semest_${
                          c.corcod
                        }">
                          Sem estoque
                        </label>
                      </div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            </details>

            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
              <button type="button" class="btn btn-secondary" id="cancelarEditarProduto">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary">
                Salvar
              </button>
            </div>

          </form>
        </div>
      `;

      document.body.appendChild(popup);

      document.getElementById("cancelarEditarProduto").onclick = () => {
        popup.remove();
      };

      // ------------------------------
      // HABILITA / DESABILITA "sem estoque" por cor
      // ------------------------------
      popup.querySelectorAll(".checkbox-cor").forEach((ch) => {
        ch.addEventListener("change", () => {
          const cor = ch.value;
          const semEst = popup.querySelector(`#editar_cor_semest_${cor}`);
          if (!semEst) return;

          if (ch.checked) semEst.disabled = false;
          else {
            semEst.checked = false;
            semEst.disabled = true;
          }
        });
      });

      // -----------------------------------------
      // SUBMIT (SEM MODELO)
      // -----------------------------------------
      popup
        .querySelector("#formEditarProduto")
        .addEventListener("submit", async (e) => {
          e.preventDefault();

          const prodes = document
            .getElementById("editarDescricao")
            .value.trim();
          const provl = document.getElementById("editarValor").value;
          const prosemest = document.getElementById("editar_prosemest").checked
            ? "S"
            : "N";
          const proacabando = document.getElementById("editar_proacabando")
            .checked
            ? "S"
            : "N";

          // Mapa com estado anterior
          const anterioresMap = {};
          coresProduto.forEach((cp) => {
            if (cp.corcod !== null && cp.corcod !== undefined) {
              anterioresMap[String(cp.corcod)] =
                cp.procorsemest === "S" ? "S" : "N";
            }
          });

          // Estado atual
          const linhas = popup.querySelectorAll(
            "#editarProdutoCores .form-check",
          );
          const atuais = [];
          linhas.forEach((l) => {
            const corCheck = l.querySelector(".checkbox-cor");
            const semEstCheck = l.querySelector(".checkbox-cor-semest");
            if (corCheck && corCheck.checked) {
              atuais.push({
                corcod: corCheck.value,
                procorsemest: semEstCheck?.checked ? "S" : "N",
              });
            }
          });

          try {
            // Atualiza dados básicos do produto
            await fetch(`${BASE_URL}/pro/${codigo}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prodes,
                provl,
                prosemest,
                proacabando,
              }),
            });

            // Cores novas ou atualizadas
            for (const c of atuais) {
              if (!anterioresMap[c.corcod]) {
                const addResponse = await fetch(
                  `${BASE_URL}/proCoresDisponiveis/${codigo}?corescod=${c.corcod}&procorsemest=${c.procorsemest}`,
                  { method: "POST" },
                );
                if (!addResponse.ok) {
                  const errorData = await addResponse.json();
                  throw new Error(errorData.erro || "Erro ao adicionar cor");
                }
              } else if (anterioresMap[c.corcod] !== c.procorsemest) {
                await fetch(
                  `${BASE_URL}/proCoresDisponiveis/${codigo}?` +
                    `corescod=${c.corcod}` +
                    `&procorsemest=${anterioresMap[c.corcod]}` +
                    `&corescodnovo=${c.corcod}` +
                    `&procorsemestnovo=${c.procorsemest}`,
                  { method: "PUT" },
                );
              }
            }

            // Remover cores que foram desmarcadas
            for (const corAnterior of Object.keys(anterioresMap)) {
              if (!atuais.some((a) => a.corcod === corAnterior)) {
                const deleteResponse = await fetch(
                  `${BASE_URL}/proCoresDisponiveis/${codigo}?corescod=${corAnterior}`,
                  { method: "DELETE" },
                );
                if (!deleteResponse.ok) {
                  const errorData = await deleteResponse.json();
                  throw new Error(errorData.erro || "Erro ao remover cor");
                }
              }
            }

            // Aviso de sucesso
            const msg = document.createElement("div");
            msg.textContent = "Produto atualizado com sucesso!";
            msg.style = `
            position:fixed;top:20px;left:50%;transform:translateX(-50%);
            background:#28a745;color:#fff;padding:12px 24px;border-radius:6px;
            z-index:10000;box-shadow:0 2px 8px rgba(0,0,0,0.2);
          `;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);

            popup.remove();
            carregarProPesquisa();
          } catch (erro) {
            popup.remove();
            alertPersonalizado(
              erro.message || "Erro ao atualizar o produto.",
              3000,
            );
          }
        });
    })
    .catch(() => {
      alert("Erro ao buscar dados do produto.");
    });
}

function carregarProPesquisa() {
  carregarPecas(pecasPage);
}

async function excluirProduto(id) {
  // Cria o popup de confirmação customizado
  let popup = document.createElement("div");
  popup.id = "popupExcluirProduto";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Excluir Tipo</h5>
      <p>Tem certeza que deseja excluir este Produto?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirPro">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirPro">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirPro").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirPro").onclick = async function () {
    try {
      await fetch(`${BASE_URL}/pro/${id}`, { method: "DELETE" });

      // Remove a linha da tabela diretamente pelo ID
      const linha = document.getElementById(`produto-${id}`);
      if (linha) linha.remove();

      // Mostra mensagem de sucesso como popup temporário
      const msg = document.createElement("div");
      msg.textContent = "Produto excluído com sucesso!";
      msg.style.position = "fixed";
      msg.style.top = "20px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.background = "#dc3545";
      msg.style.color = "#fff";
      msg.style.padding = "12px 24px";
      msg.style.borderRadius = "6px";
      msg.style.zIndex = "10000";
      msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      document.body.appendChild(msg);
      setTimeout(() => {
        msg.remove();
      }, 2000);

      document.body.removeChild(popup);
    } catch (e) {
      alert("Erro ao excluir produto");
      document.body.removeChild(popup);
    }
  };
}

// Impede que o dropdown feche ao clicar em qualquer elemento dentro dele
document.querySelectorAll(".dropdown-menu").forEach(function (menu) {
  menu.addEventListener("click", function (e) {
    e.stopPropagation();
  });
});

// Carrega os totais de marcas, modelos, tipos e peças
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [marcas, modelos, tipos, pecas] = await Promise.all([
      fetch(`${BASE_URL}/marcas`).then((r) => r.json()),
      fetch(`${BASE_URL}/modelos`).then((r) => r.json()),
      fetch(`${BASE_URL}/tipos`).then((r) => r.json()),
      fetch(`${BASE_URL}/pros?page=1&pageSize=1`).then((r) => r.json()),
    ]);

    document.getElementById("totalMarcas").textContent = marcas.length;
    document.getElementById("totalModelos").textContent = modelos.length;
    document.getElementById("totalTipos").textContent = tipos.length;
    document.getElementById("totalPecas").textContent = pecas.total || 0;
  } catch (err) {
    console.error("Erro ao carregar totais", err);
  }
});

const AREAS_GESTAO = [
  "areaMarcas",
  "areaModelos",
  "areaTipos",
  "areaCores",
  "tabelaArea",
];

function mostrarArea(id, loadFn) {
  AREAS_GESTAO.forEach((areaId) => {
    const el = document.getElementById(areaId);
    if (el && areaId !== id) {
      el.style.display = "none";
    }
  });

  const alvo = document.getElementById(id);
  if (!alvo) return;

  if (alvo.style.display === "none" || !alvo.style.display) {
    if (typeof loadFn === "function") loadFn();
    alvo.style.display = "block";
  } else {
    alvo.style.display = "none";
  }
}

// ------- POPUP DE GESTÃO FULLSCREEN (Gerenciar Marcas/Modelos/Tipos/Cores) ---------
function abrirPopupGestao(areaId, titulo, totalId) {
  if (gestaoPopupAberto) return;
  const area = document.getElementById(areaId);
  if (!area) return;

  const overlay = criarOverlay();
  const popup = document.createElement("div");
  popup.className = "popup pecas-modal pecas-modal-fullscreen";

  const header = document.createElement("div");
  header.className = "pecas-modal-header";
  header.innerHTML = `
    <div class="pecas-modal-titulos">
      <h4 class="pecas-modal-titulo">${titulo}</h4>
    </div>
    <div class="pecas-modal-header-end">
      <span class="pecas-total-info pecas-modal-total" id="${totalId}"></span>
      <button
        type="button"
        class="pecas-modal-close"
        onclick="fecharPopupGestao(this, '${areaId}')"
        aria-label="Fechar"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  popup.appendChild(header);

  area.style.display = "flex";
  popup.appendChild(area);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  gestaoPopupAberto = true;
  gestaoAreaAberta = areaId;
}

function fecharPopupGestao(btn, areaId) {
  const popup = btn.closest(".popup");
  if (!popup) return;

  const area = document.getElementById(areaId);
  if (area) {
    if (area.parentElement === popup) {
      const origem = gestaoOrigem[areaId];
      if (origem) origem.appendChild(area);
    }
    area.style.display = "none";
  }

  gestaoPopupAberto = false;
  gestaoAreaAberta = null;
  popup.remove();
  const overlay = document.querySelector(".overlay");
  if (overlay) overlay.remove();
}

// ------- GESTÃO MARCAS ---------
function toggleMarcas() {
  abrirPopupGestao("areaMarcas", "🏷️ Gerenciar Marcas", "infoTotalMarcas");
  carregarMarcas();
}

function carregarMarcas() {
  fetch(`${BASE_URL}/marcas`)
    .then((r) => r.json())
    .then((dados) => {
      marcasLista = dados;
      renderMarcas();
    })
    .catch(console.error);
}

function renderMarcas() {
  const tbody = document.getElementById("listaMarcas");
  tbody.innerHTML = "";
  const q = marcasQ.toLowerCase();
  const filtradas = q
    ? marcasLista.filter((m) =>
        (m.marcasdes || "").toLowerCase().includes(q),
      )
    : marcasLista;

  filtradas.forEach((m) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-marca-id", m.marcascod);
    tr.innerHTML = `
          <td class="peca-col marca-des">${m.marcasdes}</td>
          <td class="acoes-col">
            <div class="pecas-acoes">
              <button class="pecas-btn-acao pecas-btn-editar" title="Editar marca"
                onclick="editarMarca(${m.marcascod}, '${m.marcasdes.replace(
                  /'/g,
                  "\\'",
                )}')">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="pecas-btn-acao pecas-btn-excluir" title="Excluir marca"
                onclick="excluirMarca(${m.marcascod})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById("infoTotalMarcas");
  if (info) info.textContent = `${filtradas.length} marca(s)`;
}

function editarMarca(id, nome) {
  let popup = document.createElement("div");
  popup.id = "popupEditarMarca";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;width:40vw;">
      <h5>🏷️ Editar Marca</h5>
      <hr style="width:100%; border:1px solid #ddd;">

      <form id="formEditarMarca">
        
        <div class="mb-3">
          <label class="form-label">📝 Descrição</label>
          <input type="text" class="form-control" id="editarMarcaDescricao"
                 name="marcasdes" value="${nome || ""}" required>
        </div>

        <div class="mb-3">
          <label class="form-label">📁 Logo da Marca (JPG/PNG)</label>
          <div class="input-group" id="fileWrapper"></div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarMarca">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(popup);

  // cria input file via JS
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.name = "logo-marca";
  fileInput.className = "form-control";
  fileInput.accept = "image/jpeg,image/png";
  popup.querySelector("#fileWrapper").appendChild(fileInput);

  document.getElementById("cancelarEditarMarca").onclick = () => popup.remove();

  document.getElementById("formEditarMarca").onsubmit = async function (e) {
    e.preventDefault();

    const descricao = document
      .getElementById("editarMarcaDescricao")
      .value.trim();
    const arquivo = fileInput.files[0];

    try {
      // 1️⃣ Atualiza descrição
      const updateRes = await fetch(`${BASE_URL}/marcas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marcasdes: descricao }),
      });

      if (!updateRes.ok) throw new Error("Erro no update da descrição");

      // 2️⃣ Se o usuário enviou a logo → manda pro /save-marca
      if (arquivo) {
        const formData = new FormData();
        formData.append("descricaoMarca", descricao); // nome esperado pelo backend
        formData.append("logo-marca", arquivo);

        const uploadRes = await fetch(`/save-marca`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Erro no envio da logo");
      }
      const msg = document.createElement("div");
      msg.textContent = "Marca atualizada com sucesso!";
      msg.style.position = "fixed";
      msg.style.top = "20px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.background = "#28a745";
      msg.style.color = "#fff";
      msg.style.padding = "12px 24px";
      msg.style.borderRadius = "6px";
      msg.style.zIndex = "10000";
      document.body.appendChild(msg);

      // fechar modal DEPOIS de mostrar mensagem
      setTimeout(() => {
        msg.remove();
        popup.remove();
        carregarMarcas();
      }, 1500);

      popup.remove();
      carregarMarcas();
    } catch (err) {
      alert("Erro ao atualizar a marca!");
      console.error(err);
      popup.remove();
    }
  };
}

async function excluirMarca(id) {
  // Verifica se existem modelos vinculados à marca
  let modelosVinculados = [];
  try {
    const res = await fetch(`${BASE_URL}/modelo/${id}`);
    if (res.ok) {
      modelosVinculados = await res.json();
    }
  } catch (e) {
    alert("Erro ao verificar modelos vinculados.");
    return;
  }

  // Cria o popup de confirmação customizado
  let popup = document.createElement("div");
  popup.id = "popupExcluirMarca";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  let mensagem = `<h5>Excluir Marca</h5>`;
  if (modelosVinculados.length > 0) {
    mensagem += `
      <p>Existem <b>${modelosVinculados.length}</b> modelo(s) vinculados a esta marca.<br>
      Excluir a marca irá excluir todos os modelos vinculados.<br>
      Tem certeza que deseja continuar?</p>
    `;
  } else {
    mensagem += `<p>Tem certeza que deseja excluir esta marca?</p>`;
  }

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      ${mensagem}
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirMarca">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirMarca">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirMarca").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirMarca").onclick = async function () {
    try {
      const res = await fetch(`${BASE_URL}/marcas/status/${id}`, {
        method: "PUT",
      });
      if (res.status === 403) {
        throw new Error("403");
      }
      // Mostra mensagem de sucesso como popup temporário
      const msg = document.createElement("div");
      msg.textContent = "Marca excluída com sucesso!";
      msg.style.position = "fixed";
      msg.style.top = "20px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.background = "#dc3545";
      msg.style.color = "#fff";
      msg.style.padding = "12px 24px";
      msg.style.borderRadius = "6px";
      msg.style.zIndex = "10000";
      msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      document.body.appendChild(msg);
      setTimeout(() => {
        msg.remove();
      }, 2000);
      document.body.removeChild(popup);
      carregarMarcas();
    } catch (error) {
      if (error.message === "403") {
        alertPersonalizado(
          "Sem permissão para excluir marcas. Contate o administrador.",
          2000,
        );
      } else {
        alert("Erro ao excluir a marca.");
      }
      console.error("Erro ao excluir marca:", error);
    }
  };
}

// ------- GESTÃO MODELOS ---------
function toggleModelos() {
  abrirPopupGestao("areaModelos", "📱 Gerenciar Modelos", "infoTotalModelos");
  carregarModelos();
}

function carregarModelos() {
  fetch(`${BASE_URL}/modelos`)
    .then((r) => r.json())
    .then((dados) => {
      modelosLista = dados;
      renderModelos();
    })
    .catch(console.error);
}

function renderModelos() {
  const tbody = document.getElementById("listaModelos");
  tbody.innerHTML = "";
  const q = modelosQ.toLowerCase();

  const filtradas = modelosLista.filter((m) => {
    if (
      modelosMarca !== null &&
      String(m.modmarcascod) !== String(modelosMarca)
    ) {
      return false;
    }
    if (q && !(m.moddes || "").toLowerCase().includes(q)) return false;
    return true;
  });

  filtradas.forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td class="peca-col">${m.moddes}</td>
          <td class="acoes-col">
            <div class="pecas-acoes">
              <button class="pecas-btn-acao pecas-btn-editar" title="Editar modelo"
                onclick="editarModelo(${m.modcod}, '${m.moddes.replace(
                  /'/g,
                  "'",
                )}', ${m.modmarcascod})">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="pecas-btn-acao pecas-btn-excluir" title="Excluir modelo"
                onclick="excluirModelo(${m.modcod})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById("infoTotalModelos");
  if (info) info.textContent = `${filtradas.length} modelo(s)`;
}

function editarModelo(id, nome, marca) {
  // Cria o popup
  let popup = document.createElement("div");
  popup.id = "popupEditarModelo";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>📱 Editar Modelo</h5>
      <hr style="width: 100%; margin-left: 0; margin-right: 0; border: 1px solid #ddd;">
      <form id="formEditarModelo">
        <div class="mb-3">
          <label for="editarModeloDescricao" class="form-label">📝 Descrição</label>
          <input type="text" class="form-control" id="editarModeloDescricao" name="moddes" value="${
            nome || ""
          }" required>
        </div>
        <div class="mb-3">
          <label for="editarModeloMarca" class="form-label">🏷️ Marca</label>
          <select class="form-control" id="editarModeloMarca" name="modmarcascod" required>
            <option value="">Carregando marcas...</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarModelo">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(popup);

  // Carrega as marcas no select
  fetch(`${BASE_URL}/marcas`)
    .then((r) => r.json())
    .then((marcas) => {
      const select = document.getElementById("editarModeloMarca");
      select.innerHTML = '<option value="">Selecione</option>';
      marcas.forEach((m) => {
        select.innerHTML += `<option value="${m.marcascod}"${
          m.marcascod == marca ? " selected" : ""
        }>${m.marcasdes}</option>`;
      });
    });

  document.getElementById("cancelarEditarModelo").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("formEditarModelo").onsubmit = function (e) {
    e.preventDefault();
    const moddes = document
      .getElementById("editarModeloDescricao")
      .value.trim();
    const modmarcascod = document.getElementById("editarModeloMarca").value;
    fetch(`${BASE_URL}/modelo/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moddes, modmarcascod }),
    })
      .then(async (res) => {
        if (res.status === 403) {
          throw new Error("403");
        }
        return res.json();
      })
      .then(() => {
        // Mostra mensagem de sucesso como popup temporário
        const msg = document.createElement("div");
        msg.textContent = "Modelo atualizado com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#28a745";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarModelos();
      })
      .catch((error) => {
        if (error.message === "403") {
          alertPersonalizado(
            "Sem permissão para editar modelos. Contate o administrador.",
            2000,
          );
        } else {
          alert("Erro ao atualizar modelo");
        }
        document.body.removeChild(popup);
      });
  };
}

async function excluirModelo(id) {
  // Cria o popup de confirmação customizado
  let popup = document.createElement("div");
  popup.id = "popupExcluirModelo";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Excluir Modelo</h5>
      <p>Tem certeza que deseja excluir este modelo?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirModelo">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirModelo">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirModelo").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirModelo").onclick =
    async function () {
      try {
        const res = await fetch(`${BASE_URL}/modelo/${id}`, {
          method: "DELETE",
        });
        if (res.status === 403) {
          throw new Error("403");
        }
        if (res.status === 409) {
          throw new Error("409");
        }
        // Mostra mensagem de sucesso como popup temporário
        const msg = document.createElement("div");
        msg.textContent = "Modelo excluído com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#dc3545";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarModelos();
      } catch (e) {
        if (e.message === "403") {
          alertPersonalizado(
            "Sem permissão para excluir modelos. Contate o administrador.",
            2000,
          );
        } else if (e.message === "409") {
          alertPersonalizado(
            "Não é possível excluir este modelo pois existem produtos vinculados a ele.",
            3000,
          );
        } else {
          alert("Erro ao excluir modelo");
        }
        document.body.removeChild(popup);
      }
    };
}

// ------- GESTÃO TIPOS ---------
function toggleTipos() {
  abrirPopupGestao("areaTipos", "📋 Gerenciar Tipos de Peça", "infoTotalTipos");
  carregarTipos();
}

function carregarTipos() {
  fetch(`${BASE_URL}/tipos`)
    .then((r) => r.json())
    .then((dados) => {
      tiposLista = dados;
      renderTipos();
    })
    .catch(console.error);
}

function renderTipos() {
  const tbody = document.getElementById("listaTipos");
  tbody.innerHTML = "";
  const q = tiposQ.toLowerCase();
  const filtradas = q
    ? tiposLista.filter((t) =>
        (t.tipodes || "").toLowerCase().includes(q),
      )
    : tiposLista;

  filtradas.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td class="peca-col">${t.tipodes}</td>
          <td class="acoes-col">
            <div class="pecas-acoes">
              <button class="pecas-btn-acao pecas-btn-editar" title="Editar tipo"
                onclick="editarTipo(${t.tipocod}, '${t.tipodes.replace(
                  /'/g,
                  "'",
                )}')">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="pecas-btn-acao pecas-btn-excluir" title="Excluir tipo"
                onclick="excluirTipo(${t.tipocod})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById("infoTotalTipos");
  if (info) info.textContent = `${filtradas.length} tipo(s)`;
}

function editarTipo(id, nome) {
  // Cria o popup
  let popup = document.createElement("div");
  popup.id = "popupEditarTipo";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;width:40vw;">
      <h5>📋 Editar Tipo</h5>
      <hr style="width: 100%; margin-left: 0; margin-right: 0; border: 1px solid #ddd;">
      <form id="formEditarTipo">
        <div class="mb-3">
          <label for="editarTipoDescricao" class="form-label">📝 Descrição</label>
          <input type="text" class="form-control" id="editarTipoDescricao" name="tipodes" value="${
            nome || ""
          }" required>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarTipo">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarEditarTipo").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("formEditarTipo").onsubmit = function (e) {
    e.preventDefault();
    const tipodes = document.getElementById("editarTipoDescricao").value.trim();
    fetch(`${BASE_URL}/tipo/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipodes }),
    })
      .then((r) => {
        if (r.status === 403) {
          throw new Error("403");
        }
        return r;
      })
      .then((r) => r.json())
      .then(() => {
        // Mostra mensagem de sucesso como popup temporário
        const msg = document.createElement("div");
        msg.textContent = "Tipo atualizado com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#28a745";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarTipos();
      })
      .catch((error) => {
        if (error.message === "403") {
          alertPersonalizado("Sem permissão para editar tipos.", 2000);
        } else {
          alert("Erro ao atualizar tipo");
        }
      });
  };
}

async function excluirTipo(id) {
  // Cria o popup de confirmação customizado
  let popup = document.createElement("div");
  popup.id = "popupExcluirTipo";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Excluir Tipo</h5>
      <p>Tem certeza que deseja excluir este tipo?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirTipo">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirTipo">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirTipo").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirTipo").onclick = async function () {
    try {
      const res = await fetch(`${BASE_URL}/tipo/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        throw new Error("403");
      }
      if (res.status === 409) {
        throw new Error("409");
      }
      // Mostra mensagem de sucesso como popup temporário
      const msg = document.createElement("div");
      msg.textContent = "Tipo excluído com sucesso!";
      msg.style.position = "fixed";
      msg.style.top = "20px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.background = "#dc3545";
      msg.style.color = "#fff";
      msg.style.padding = "12px 24px";
      msg.style.borderRadius = "6px";
      msg.style.zIndex = "10000";
      msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      document.body.appendChild(msg);
      setTimeout(() => {
        msg.remove();
      }, 2000);
      document.body.removeChild(popup);
      carregarTipos();
    } catch (error) {
      if (error.message === "403") {
        alertPersonalizado(
          "Sem permissão para excluir este tipo. Contate o administrador.",
          2000,
        );
      } else if (error.message === "409") {
        alertPersonalizado(
          "Não é possível excluir este tipo pois existem produtos vinculados a ele.",
          3000,
        );
      } else {
        alert("Erro ao excluir tipo");
      }
      document.body.removeChild(popup);
    }
  };
}

// ------- GESTÃO CORES ---------
function toggleCores() {
  abrirPopupGestao("areaCores", "🎨 Gerenciar Cores", "infoTotalCores");
  carregarCores();
}

function carregarCores() {
  fetch(`${BASE_URL}/cores`)
    .then((r) => r.json())
    .then((dados) => {
      coresLista = dados;
      renderCores();
    })
    .catch(console.error);
}

function renderCores() {
  const tbody = document.getElementById("listaCores");
  tbody.innerHTML = "";
  const q = coresQ.toLowerCase();
  const filtradas = q
    ? coresLista.filter((c) =>
        (c.cornome || "").toLowerCase().includes(q),
      )
    : coresLista;

  filtradas.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td class="peca-col">${c.cornome}</td>
          <td class="acoes-col">
            <div class="pecas-acoes">
              <button
                class="pecas-btn-acao pecas-btn-editar"
                title="Editar cor"
                data-cod="${c.corcod}"
                data-nome="${c.cornome.replace(/"/g, "&quot;")}"
                onclick="editarCor(this.dataset.cod, this.dataset.nome)"
              >
                <i class="fa-solid fa-pen"></i>
              </button>
              <button
                class="pecas-btn-acao pecas-btn-excluir"
                title="Excluir cor"
                onclick="excluirCor(${c.corcod})"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById("infoTotalCores");
  if (info) info.textContent = `${filtradas.length} cor(es)`;
}

function editarCor(id, nome) {
  let popup = document.createElement("div");
  popup.id = "popupEditarCor";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>🎨 Editar Cor</h5>
      <hr style="width: 100%; margin-left: 0; margin-right: 0; border: 1px solid #ddd;">
      <form id="formEditarCor">
        <div class="mb-3">
          <label for="editarCorDescricao" class="form-label">📝 Descrição</label>
          <input type="text" class="form-control" id="editarCorDescricao" name="cornome" value="${(
            nome || ""
          ).replace(/"/g, "&quot;")}"
          }" required>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarCor">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(popup);

  document.getElementById("cancelarEditarCor").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("formEditarCor").onsubmit = function (e) {
    e.preventDefault();
    const cornome = document.getElementById("editarCorDescricao").value.trim();
    fetch(`${BASE_URL}/cores/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cornome }),
    })
      .then(async (res) => {
        if (res.status === 403) {
          throw new Error("403");
        }
        return res.json();
      })
      .then(() => {
        const msg = document.createElement("div");
        msg.textContent = "Cor atualizada com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#28a745";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarCores();
      })
      .catch((error) => {
        if (error.message === "403") {
          alertPersonalizado(
            "Sem permissão para editar esta cor. Contate o administrador.",
            2000,
          );
        } else if (error.message === "200") {
          alert("OK");
        } else {
          alert("Erro ao atualizar cor");
        }
        document.body.removeChild(popup);
      });
  };
}

async function excluirCor(id) {
  let popup = document.createElement("div");
  popup.id = "popupExcluirCor";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Excluir Cor</h5>
      <p>Tem certeza que deseja excluir esta cor?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirCor">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirCor">Excluir</button>
      </div>
    </div>`;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirCor").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirCor").onclick = async function () {
    try {
      const res = await fetch(`${BASE_URL}/cores/${id}`, { method: "DELETE" });
      if (res.status === 403) {
        throw new Error("403");
      }
      const msg = document.createElement("div");
      msg.textContent = "Cor excluída com sucesso!";
      msg.style.position = "fixed";
      msg.style.top = "20px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.background = "#dc3545";
      msg.style.color = "#fff";
      msg.style.padding = "12px 24px";
      msg.style.borderRadius = "6px";
      msg.style.zIndex = "10000";
      msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      document.body.appendChild(msg);
      setTimeout(() => {
        msg.remove();
      }, 2000);
      document.body.removeChild(popup);
      carregarCores();
    } catch (error) {
      if (error.message === "403") {
        alertPersonalizado(
          "Sem permissão para excluir esta cor. Contate o administrador.",
          2000,
        );
      } else {
        alert("Erro ao excluir cor");
      }
      document.body.removeChild(popup);
    }
  };
}

// ------- GESTÃO PEÇAS ---------
function togglePecas() {
  pecasQ = "";
  const busca = document.getElementById("pesquisa");
  if (busca) busca.value = "";
  abrirPopupPecas();
}

function abrirPopupPecas() {
  if (pecasPopupAberto) return;

  const overlay = criarOverlay();
  const popup = document.createElement("div");
  popup.className = "popup pecas-modal pecas-modal-fullscreen";
  popup.id = "popupPecas";

  const header = document.createElement("div");
  header.className = "pecas-modal-header";
  header.innerHTML = `
    <div class="pecas-modal-titulos">
      <h4 class="pecas-modal-titulo">🧩 Gerenciar Peças</h4>
    </div>
    <div class="pecas-modal-header-end">
      <span class="pecas-total-info pecas-modal-total" id="infoTotalPecas"></span>
      <button
        type="button"
        class="pecas-modal-close"
        onclick="fecharPopupPecas(this)"
        aria-label="Fechar"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  popup.appendChild(header);

  if (tabelaArea) {
    tabelaArea.style.display = "flex";
    popup.appendChild(tabelaArea);
  }

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  pecasPopupAberto = true;

  const buscaCampo = document.getElementById("pecasBusca");
  if (buscaCampo) buscaCampo.value = pecasQ;

  popularFiltrosPecas();
  carregarPecas(1);
}

function fecharPopupPecas(btn) {
  const popup = btn.closest(".popup");
  if (!popup) return;

  if (tabelaArea) {
    if (tabelaAreaOrigem) tabelaAreaOrigem.appendChild(tabelaArea);
    tabelaArea.style.display = "none";
  }

  pecasPopupAberto = false;
  pecasQ = "";
  const busca = document.getElementById("pesquisa");
  if (busca) busca.value = "";
  const buscaCampo = document.getElementById("pecasBusca");
  if (buscaCampo) buscaCampo.value = "";

  popup.remove();
  const overlay = document.querySelector(".overlay");
  if (overlay) overlay.remove();
}

function popularFiltrosPecas() {
  const selMarca = document.getElementById("filtroMarcaPeca");
  const selModelo = document.getElementById("filtroModeloPeca");
  const selTipo = document.getElementById("filtroTipoPeca");
  if (!selMarca || !selModelo || !selTipo) return;

  selModelo.innerHTML = '<option value="">Todos os modelos</option>';

  if (marcasCache.length) {
    selMarca.innerHTML = '<option value="">Todas as marcas</option>';
    marcasCache.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.marcascod;
      opt.textContent = m.marcasdes;
      selMarca.appendChild(opt);
    });
  }
  if (tiposCache.length) {
    selTipo.innerHTML = '<option value="">Todos os tipos</option>';
    tiposCache.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.tipocod;
      opt.textContent = t.tipodes;
      selTipo.appendChild(opt);
    });
  }
}

async function carregarModelosFiltro(marcascod) {
  const selModelo = document.getElementById("filtroModeloPeca");
  if (!selModelo) return;
  selModelo.innerHTML = '<option value="">Todos os modelos</option>';

  if (marcascod === null) return;

  try {
    const res = await fetch(`${BASE_URL}/modelo/${marcascod}`);
    const dados = await res.json();
    if (!res.ok) throw new Error("Erro ao buscar modelos");
    dados.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.modcod;
      opt.textContent = m.moddes;
      selModelo.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }
}

async function carregarPecas(page = 1, append = false) {
  if (pecasLoading) return;
  pecasLoading = true;
  pecasPage = page;

  const params = new URLSearchParams({
    page: String(pecasPage),
    pageSize: String(pecasPageSize),
  });
  if (pecasQ) params.set("q", pecasQ);
  if (pecasMarca !== null) params.set("marca", String(pecasMarca));
  if (pecasModelo !== null) params.set("modelo", String(pecasModelo));
  if (pecasTipo !== null) params.set("tipo", String(pecasTipo));

  const tbody = document.getElementById("corpoTabela");
  const scrollBox = document.querySelector("#tabelaArea .pecas-modal-body");

  if (append) {
    tbody.insertAdjacentHTML(
      "beforeend",
      '<tr id="linhaCarregando"><td colspan="4" class="text-center text-muted py-2"><small>Carregando mais...</small></td></tr>'
    );
  } else {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';
    if (scrollBox) scrollBox.scrollTop = 0;
  }

  try {
    const res = await fetch(`${BASE_URL}/pros?${params.toString()}`);
    const dados = await res.json();
    if (!res.ok) throw new Error(dados?.error || `Erro ${res.status}`);

    pecasTotal = dados.total || 0;
    const lista = dados.data || [];
    pecasTemMais = pecasPage * pecasPageSize < pecasTotal;

    const linhaCarregando = document.getElementById("linhaCarregando");
    if (linhaCarregando) linhaCarregando.remove();

    renderPecas(lista, append);
    atualizarInfoTotal();
  } catch (err) {
    console.error(err);
    const linhaCarregando = document.getElementById("linhaCarregando");
    if (linhaCarregando) linhaCarregando.remove();
    if (!append) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center">Erro ao carregar peças</td></tr>';
    }
  } finally {
    pecasLoading = false;
  }
}

function renderPecas(dados, append = false) {
  const tbody = document.getElementById("corpoTabela");
  if (!append) tbody.innerHTML = "";

  if (!dados.length) {
    if (!append) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center">Nenhuma peça encontrada</td></tr>';
    }
    return;
  }

  dados.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td class="peca-col"><span class="peca-nome">${t.prodes}</span></td>
          <td class="valor-col">${formatarMoeda(t.provl)}</td>
          <td class="custo-col">${formatarMoeda(t.procusto)}</td>
          <td class="acoes-col">
            <div class="pecas-acoes">
              <button
                class="pecas-btn-acao pecas-btn-editar btn-editar-peca"
                data-id="${t.procod}"
                data-nome="${t.prodes.replace(/"/g, "&quot;")}"
                data-valor="${t.provl}"
                data-custo="${t.procusto}"
                title="Editar peça"
              >
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                class="pecas-btn-acao pecas-btn-excluir btn-excluir-peca"
                data-id="${t.procod}"
                title="Excluir peça"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>`;
    tbody.appendChild(tr);
  });
}

function atualizarInfoTotal() {
  const infoTotal = document.getElementById("infoTotalPecas");
  if (!infoTotal) return;
  infoTotal.textContent = `${pecasTotal} peça(s)`;
}

document.addEventListener("DOMContentLoaded", () => {
  const selMarca = document.getElementById("filtroMarcaPeca");
  const selModelo = document.getElementById("filtroModeloPeca");
  const selTipo = document.getElementById("filtroTipoPeca");
  const inputBusca = document.getElementById("pecasBusca");
  const btnAplicar = document.getElementById("btnAplicarFiltroPeca");
  const btnLimpar = document.getElementById("btnLimparFiltroPeca");

  // CTRL+F dentro de qualquer Gerenciar foca o campo de busca da área
  // (em vez de abrir a busca do navegador)
  const GESTAO_BUSCA = {
    areaMarcas: "marcasBusca",
    areaModelos: "modelosBusca",
    areaTipos: "tiposBusca",
    areaCores: "coresBusca",
  };

  document.addEventListener("keydown", (e) => {
    if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f")) return;

    let areaId = null;
    let buscaId = null;
    if (pecasPopupAberto) {
      areaId = "tabelaArea";
      buscaId = "pecasBusca";
    } else if (gestaoPopupAberto) {
      areaId = gestaoAreaAberta;
      buscaId = GESTAO_BUSCA[gestaoAreaAberta];
    }
    if (!buscaId) return;

    e.preventDefault();

    const filtrosBox = document.querySelector(
      `#${areaId} .pecas-modal-filters`
    );
    if (filtrosBox && !filtrosBox.classList.contains("pecas-filters-open")) {
      filtrosBox.classList.add("pecas-filters-open");
      const btn = filtrosBox.querySelector(".pecas-filters-toggle");
      if (btn) {
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("aria-label", "Ocultar filtros");
      }
    }

    const buscaCampo = document.getElementById(buscaId);
    if (buscaCampo) {
      buscaCampo.focus();
      buscaCampo.select();
    }
  });

  // Scroll infinito: carrega mais peças ao chegar perto do fim da lista
  const corpoPecas = document.querySelector("#tabelaArea .pecas-modal-body");
  if (corpoPecas) {
    corpoPecas.addEventListener("scroll", () => {
      if (pecasLoading || !pecasTemMais) return;
      const limite = 80;
      if (
        corpoPecas.scrollTop + corpoPecas.clientHeight >=
        corpoPecas.scrollHeight - limite
      ) {
        carregarPecas(pecasPage + 1, true);
      }
    });
  }

  // Recolhe/expande os filtros das áreas de gestão (mobile)
  document.querySelectorAll(".pecas-filters-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filtrosBox = btn.closest(".pecas-modal-filters");
      if (!filtrosBox) return;
      const aberto = filtrosBox.classList.toggle("pecas-filters-open");
      btn.setAttribute("aria-expanded", String(aberto));
      btn.setAttribute(
        "aria-label",
        aberto ? "Ocultar filtros" : "Mostrar filtros"
      );
    });
  });

  if (selMarca && selModelo) {
    selMarca.addEventListener("change", (e) => {
      pecasModelo = null;
      selModelo.value = "";
      carregarModelosFiltro(parseIntegerParam(e.target.value));
    });
  }
  if (inputBusca) {
    inputBusca.addEventListener("input", () => {
      clearTimeout(pecasDebounce);
      pecasDebounce = setTimeout(() => {
        pecasQ = inputBusca.value.trim().toLowerCase();
        carregarPecas(1);
      }, 300);
    });
  }
  if (btnAplicar) {
    btnAplicar.addEventListener("click", () => {
      pecasMarca = parseIntegerParam(selMarca?.value);
      pecasModelo = parseIntegerParam(selModelo?.value);
      pecasTipo = parseIntegerParam(selTipo?.value);
      carregarPecas(1);
    });
  }
  if (btnLimpar) {
    btnLimpar.addEventListener("click", () => {
      pecasMarca = null;
      pecasModelo = null;
      pecasTipo = null;
      pecasQ = "";
      if (selMarca) selMarca.value = "";
      if (selModelo) {
        selModelo.value = "";
        selModelo.innerHTML = '<option value="">Todos os modelos</option>';
      }
      if (selTipo) selTipo.value = "";
      if (inputBusca) inputBusca.value = "";
      const busca = document.getElementById("pesquisa");
      if (busca) busca.value = "";
      carregarPecas(1);
    });
  }
});

// Filtros dos popups de gestão (Marcas/Modelos/Tipos/Cores)
document.addEventListener("DOMContentLoaded", () => {
  // ---- Marcas ----
  const marcasBusca = document.getElementById("marcasBusca");
  const btnAplicarMarcas = document.getElementById("btnAplicarFiltroMarcas");
  const btnLimparMarcas = document.getElementById("btnLimparFiltroMarcas");
  if (marcasBusca) {
    marcasBusca.addEventListener("input", () => {
      clearTimeout(marcasDebounce);
      marcasDebounce = setTimeout(() => {
        marcasQ = marcasBusca.value.trim().toLowerCase();
        renderMarcas();
      }, 300);
    });
  }
  if (btnAplicarMarcas) {
    btnAplicarMarcas.addEventListener("click", () => {
      marcasQ = marcasBusca?.value.trim().toLowerCase() || "";
      renderMarcas();
    });
  }
  if (btnLimparMarcas) {
    btnLimparMarcas.addEventListener("click", () => {
      marcasQ = "";
      if (marcasBusca) marcasBusca.value = "";
      renderMarcas();
    });
  }

  // ---- Modelos ----
  const selMarcaModelo = document.getElementById("filtroModeloGestao");
  const modelosBusca = document.getElementById("modelosBusca");
  const btnAplicarModelos = document.getElementById("btnAplicarFiltroModelos");
  const btnLimparModelos = document.getElementById("btnLimparFiltroModelos");
  if (selMarcaModelo) {
    selMarcaModelo.addEventListener("change", () => {
      const v = selMarcaModelo.value;
      modelosMarca = v === "" || v === null ? null : parseIntegerParam(v);
    });
  }
  if (modelosBusca) {
    modelosBusca.addEventListener("input", () => {
      clearTimeout(modelosDebounce);
      modelosDebounce = setTimeout(() => {
        modelosQ = modelosBusca.value.trim().toLowerCase();
        renderModelos();
      }, 300);
    });
  }
  if (btnAplicarModelos) {
    btnAplicarModelos.addEventListener("click", () => {
      const v = selMarcaModelo?.value;
      modelosMarca = v === "" || v === null ? null : parseIntegerParam(v);
      modelosQ = modelosBusca?.value.trim().toLowerCase() || "";
      renderModelos();
    });
  }
  if (btnLimparModelos) {
    btnLimparModelos.addEventListener("click", () => {
      modelosMarca = null;
      modelosQ = "";
      if (selMarcaModelo) selMarcaModelo.value = "";
      if (modelosBusca) modelosBusca.value = "";
      renderModelos();
    });
  }

  // ---- Tipos ----
  const tiposBusca = document.getElementById("tiposBusca");
  const btnAplicarTipos = document.getElementById("btnAplicarFiltroTipos");
  const btnLimparTipos = document.getElementById("btnLimparFiltroTipos");
  if (tiposBusca) {
    tiposBusca.addEventListener("input", () => {
      clearTimeout(tiposDebounce);
      tiposDebounce = setTimeout(() => {
        tiposQ = tiposBusca.value.trim().toLowerCase();
        renderTipos();
      }, 300);
    });
  }
  if (btnAplicarTipos) {
    btnAplicarTipos.addEventListener("click", () => {
      tiposQ = tiposBusca?.value.trim().toLowerCase() || "";
      renderTipos();
    });
  }
  if (btnLimparTipos) {
    btnLimparTipos.addEventListener("click", () => {
      tiposQ = "";
      if (tiposBusca) tiposBusca.value = "";
      renderTipos();
    });
  }

  // ---- Cores ----
  const coresBusca = document.getElementById("coresBusca");
  const btnAplicarCores = document.getElementById("btnAplicarFiltroCores");
  const btnLimparCores = document.getElementById("btnLimparFiltroCores");
  if (coresBusca) {
    coresBusca.addEventListener("input", () => {
      clearTimeout(coresDebounce);
      coresDebounce = setTimeout(() => {
        coresQ = coresBusca.value.trim().toLowerCase();
        renderCores();
      }, 300);
    });
  }
  if (btnAplicarCores) {
    btnAplicarCores.addEventListener("click", () => {
      coresQ = coresBusca?.value.trim().toLowerCase() || "";
      renderCores();
    });
  }
  if (btnLimparCores) {
    btnLimparCores.addEventListener("click", () => {
      coresQ = "";
      if (coresBusca) coresBusca.value = "";
      renderCores();
    });
  }
});

// Delegação de eventos para os botões de editar/excluir peças
document.getElementById("corpoTabela").addEventListener("click", function (e) {
  if (e.target.closest(".btn-editar-peca")) {
    const btn = e.target.closest(".btn-editar-peca");
    // Usa a mesma lógica de edição de produto com suporte a cores
    editarProduto(btn.getAttribute("data-id"));
  }
  if (e.target.closest(".btn-excluir-peca")) {
    const btn = e.target.closest(".btn-excluir-peca");
    excluirPro(btn.getAttribute("data-id"));
  }
});

async function excluirPro(id) {
  // Cria o popup de confirmação customizado
  let popup = document.createElement("div");
  popup.id = "popupExcluirPeca";
  popup.style.position = "fixed";
  popup.style.top = "0";
  popup.style.left = "0";
  popup.style.width = "100vw";
  popup.style.height = "100vh";
  popup.style.background = "rgba(0,0,0,0.5)";
  popup.style.display = "flex";
  popup.style.alignItems = "center";
  popup.style.justifyContent = "center";
  popup.style.zIndex = "9999";

  popup.innerHTML = `
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Excluir Peça</h5>
      <p>Tem certeza que deseja excluir esta peça?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="cancelarExcluirPeca">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmarExcluirPeca">Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarExcluirPeca").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("confirmarExcluirPeca").onclick = async function () {
    try {
      const res = await fetch(`${BASE_URL}/pro/${id}`, { method: "DELETE" });

      if (res.status === 200) {
        // Mostra mensagem de sucesso como popup temporário
        const msg = document.createElement("div");
        msg.textContent = "Peça excluída com sucesso!";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#dc3545";
        msg.style.color = "#fff";
        msg.style.padding = "12px 24px";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = "10000";
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarPecas();
      } else if (res.status === 403) {
        document.body.removeChild(popup);
        throw new Error("403");
      }
    } catch (erro) {
      if (erro.message === "403") {
        alertPersonalizado("Sem permissão para excluir produtos.", 2000);
      } else {
        alert("Erro ao criar produto.");
      }
      console.error(erro);
    }
  };
}

// (Removido o let duplicado, mantendo apenas a atribuição e uso de marcasCache)
document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      marcasCache = dados; // guarda em cache

      // Preenche o select do cadastro
      const selectCadastro = document.getElementById("painelMarca");
      if (selectCadastro) {
        selectCadastro.innerHTML =
          '<option value="">Selecione a Marca</option>';
        dados.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.marcascod;
          opt.textContent = m.marcasdes;
          selectCadastro.appendChild(opt);
        });
      }

      // Preenche o filtro "Marca" do popup de Modelos
      const selMarcaModelo = document.getElementById("filtroModeloGestao");
      if (selMarcaModelo) {
        selMarcaModelo.innerHTML =
          '<option value="">Todas as marcas</option>';
        dados.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.marcascod;
          opt.textContent = m.marcasdes;
          selMarcaModelo.appendChild(opt);
        });
      }
    })
    .catch(console.error);
});

// ==========================
// 1️⃣ Helpers: Overlay e Popup
// ==========================
function criarOverlay() {
  const overlay = document.createElement("div");
  overlay.classList.add("overlay");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;
  return overlay;
}

function criarPopup(titulo) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.style.background = "#fff";
  popup.style.padding = "20px";
  popup.style.borderRadius = "8px";
  popup.style.maxHeight = "80vh";
  popup.style.overflowY = "auto";
  popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  popup.style.margin = "1rem";

  popup.innerHTML = `
    <h4>${titulo}</h4>
  `;

  popup.fecharHTML = `
    <div style="text-align:right; margin-top:10px;">
      <button class="btn btn-secondary" onclick="fecharPopup(this)">Fechar</button>
    </div>
  `;
  return popup;
}

function fecharPopup(btn) {
  // remove o popup
  const popup = btn.closest(".popup");
  if (popup) popup.remove();

  // remove o overlay
  const overlay = document.querySelector(".overlay");
  if (overlay) overlay.remove();
}

let marcasCache = [];
let modelosCache = [];
let tiposCache = [];
document.addEventListener("DOMContentLoaded", () => {
  const holder = document.getElementById("selectPainelMarca");

  if (!holder) return;

  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      marcasCache = dados;

      // Preenche select do cadastro
      if (holder) {
        holder.innerHTML = '<option value="">Selecione a Marca</option>';
        dados.forEach((marca) => {
          holder.innerHTML += `<option value="${marca.marcascod}">${marca.marcasdes}</option>`;
        });
      }
    })
    .catch(console.error);

  holder.addEventListener("focus", () => {
    fetch(`${BASE_URL}/marcas/`)
      .then((res) => res.json())
      .then((dados) => {
        holder.innerHTML = '<option value="">Selecione a Marca</option>';
        dados.forEach((marca) => {
          holder.innerHTML += `<option value="${marca.marcascod}">${marca.marcasdes}</option>`;
        });
      })
      .catch(console.error);
  });

  holder.addEventListener("change", (e) => {
    marcascod = parseIntegerParam(e.target.value);
    const selectCadastro = document.getElementById("selectPainelModelo");

    if (selectCadastro) {
      selectCadastro.innerHTML = '<option value="">Selecione o Modelo</option>';
    }

    modelo = null;

    if (marcascod === null) {
      return;
    }

    // Só faz o fetch dos modelos ao selecionar uma marca válida
    fetch(`${BASE_URL}/modelo/${marcascod}`)
      .then((res) => res.json())
      .then((dados) => {
        modelosCache = dados;

        if (selectCadastro) {
          selectCadastro.innerHTML =
            '<option value="">Selecione o Modelo</option>';
          dados.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m.modcod;
            opt.textContent = m.moddes;
            selectCadastro.appendChild(opt);
          });
        }
        selectCadastro.addEventListener("change", (e) => {
          modelo = parseIntegerParam(e.target.value);
        });
      })
      .catch(console.error);
  });
});

//tipo peça
document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/tipos/`)
    .then((res) => res.json())
    .then((dados) => {
      tiposCache = dados;

      // Preenche select do cadastro
      const selectCadastro = document.getElementById("painelTipo");
      if (selectCadastro) {
        selectCadastro.innerHTML = '<option value="">Selecione o Tipo</option>';
        dados.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.tipocod;
          opt.textContent = m.tipodes;
          selectCadastro.appendChild(opt);
        });
      }
    })
    .catch(console.error);
});

function toggleOrdemMarca() {
  const overlay = criarOverlay();
  const popup = criarPopup("Gerenciar Ordem das Marcas");

  // Select de marcas + botão buscar
  let selectHtml = `<button id="btnBuscarMarcaOrdem" class="btn btn-primary btn-block mt-2">Buscar</button>
                 <div id="listaOrdemHolder" class="mt-3"></div>`;

  popup.innerHTML = popup.innerHTML + selectHtml + popup.fecharHTML;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Evento buscar modelos
  popup.querySelector("#btnBuscarMarcaOrdem").addEventListener("click", () => {
    fetch(`${BASE_URL}/marcas`)
      .then((r) => r.json())
      .then((marcas) => {
        const holder = popup.querySelector("#listaOrdemHolder");
        holder.innerHTML = `
            <ul id="sortable" class="list-group">
              ${marcas
                .map(
                  (m) =>
                    `<li class="list-group-item" data-id="${m.marcascod}"><span class="handle">☰ </span>${m.marcasdes}
                    </li>`,
                )
                .join("")}
            </ul>
            <button id="salvarOrdem" class="btn btn-success btn-block mt-3">Salvar Ordem</button>
          `;

        // Ativa drag & drop com SortableJS (funciona no celular)
        Sortable.create(holder.querySelector("#sortable"), {
          handle: ".handle",
          animation: 150,
          fallbackOnBody: true, // usa fallback que permite scroll no mobile
          swapThreshold: 0.65, // melhora a troca entre itens
          scroll: true, // ativa auto-scroll
          scrollSensitivity: 60, // velocidade do scroll quando chega perto da borda
          scrollSpeed: 10, // intensidade do scroll
        });

        // Salvar ordem
        popup.querySelector("#salvarOrdem").addEventListener("click", () => {
          const ordem = [...holder.querySelectorAll("li")].map((li) => ({
            id: li.dataset.id,
            descricao: li.textContent,
          }));

          fetch(`${BASE_URL}/marcas/ordem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordem }),
          })
            .then((r) => r.json())
            .then(() => {
              const msg = document.createElement("div");
              msg.textContent = "Ordem Atualizada com sucesso!";
              msg.style.position = "fixed";
              msg.style.top = "20px";
              msg.style.left = "50%";
              msg.style.transform = "translateX(-50%)";
              msg.style.background = "#28a745";
              msg.style.color = "#fff";
              msg.style.padding = "12px 24px";
              msg.style.borderRadius = "6px";
              msg.style.zIndex = "10000";
              msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
              document.body.appendChild(msg);
              setTimeout(() => {
                msg.remove();
              }, 2000);
            })
            .catch(console.error);
        });
      });
  });
}
// ==========================
// 4️⃣ Toggle Ordem: Popup completo
// ==========================
function toggleOrdemModelo() {
  if (!marcasCache.length) return alert("Nenhuma marca carregada ainda!");

  const overlay = criarOverlay();
  const popup = criarPopup("Gerenciar Ordem dos Modelos");

  // Select de marcas + botão buscar
  let selectHtml = `<select id="marcaSelectOrdem" class="form-control">
                      <option value="">Selecione a marca</option>`;
  marcasCache.forEach((m) => {
    selectHtml += `<option value="${m.marcascod}">${m.marcasdes}</option>`;
  });
  selectHtml += `</select>
                 <button id="btnBuscarModelosOrdem" class="btn btn-primary btn-block mt-2">Buscar</button>
                 <div id="listaOrdemHolder" class="mt-3"></div>`;

  popup.innerHTML = popup.innerHTML + selectHtml + popup.fecharHTML;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Evento buscar modelos
  popup
    .querySelector("#btnBuscarModelosOrdem")
    .addEventListener("click", () => {
      const marcaId = popup.querySelector("#marcaSelectOrdem").value;
      if (!marcaId) return alert("Selecione uma marca!");

      fetch(`${BASE_URL}/modelo/${marcaId}`)
        .then((r) => r.json())
        .then((modelos) => {
          const modelosFiltrados = modelos.filter(
            (m) => m.modmarcascod == marcaId,
          );

          const holder = popup.querySelector("#listaOrdemHolder");
          holder.innerHTML = `
            <ul id="sortable" class="list-group">
              ${modelosFiltrados
                .map(
                  (m) =>
                    `<li class="list-group-item" data-id="${m.modcod}"><span class="handle">☰ </span>${m.moddes}
                    </li>`,
                )
                .join("")}
            </ul>
            <button id="salvarOrdem" class="btn btn-success btn-block mt-3">Salvar Ordem</button>
          `;

          // Ativa drag & drop com SortableJS (funciona no celular)
          Sortable.create(holder.querySelector("#sortable"), {
            handle: ".handle",
            animation: 150,
            fallbackOnBody: true, // usa fallback que permite scroll no mobile
            swapThreshold: 0.65, // melhora a troca entre itens
            scroll: true, // ativa auto-scroll
            scrollSensitivity: 60, // velocidade do scroll quando chega perto da borda
            scrollSpeed: 10, // intensidade do scroll
          });

          // Salvar ordem
          popup.querySelector("#salvarOrdem").addEventListener("click", () => {
            const ordem = [...holder.querySelectorAll("li")].map((li) => ({
              id: li.dataset.id,
              descricao: li.textContent,
            }));

            fetch(`${BASE_URL}/modelo/ordem`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordem }),
            })
              .then((r) => r.json())
              .then(() => {
                const msg = document.createElement("div");
                msg.textContent = "Ordem Atualizada com sucesso!";
                msg.style.position = "fixed";
                msg.style.top = "20px";
                msg.style.left = "50%";
                msg.style.transform = "translateX(-50%)";
                msg.style.background = "#28a745";
                msg.style.color = "#fff";
                msg.style.padding = "12px 24px";
                msg.style.borderRadius = "6px";
                msg.style.zIndex = "10000";
                msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                document.body.appendChild(msg);
                setTimeout(() => {
                  msg.remove();
                }, 2000);
              })
              .catch(console.error);
          });
        });
    });
}

//********************************************* */
function criarPopupPeca(titulo) {
  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.style.background = "#fff";
  popup.style.padding = "20px";
  popup.style.borderRadius = "8px";
  popup.style.maxHeight = "80vh";
  popup.style.overflowY = "auto";
  popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  popup.style.margin = "1rem";

  popup.innerHTML = `
    <h4>${titulo}</h4>
  `;

  popup.fecharHTML = `
    <div style="text-align:right; margin-top:10px;">
      <button class="btn btn-secondary" onclick="fecharPopup(this)">Fechar</button>
    </div>
  `;
  return popup;
}

// ==========================
// 4️⃣ Toggle Ordem: Popup completo
// ==========================
function toggleOrdemPeca() {
  if (!marcasCache.length) return alert("Nenhuma marca carregada ainda!");
  //if (!modelosCache.length) return alert("Nenhum modelo carregado ainda!");
  if (!tiposCache.length) return alert("Nenhum tipo carregado ainda!");

  const overlay = criarOverlay();
  const popup = criarPopup("Gerenciar Ordem Tipos");

  // Select de marcas + botão buscar
  let selectHtml = `<select id="marcaSelectOrdem" class="form-control mb-2">
                      <option value="">Selecione a marca</option>`;
  marcasCache.forEach((m) => {
    selectHtml += `<option value="${m.marcascod}">${m.marcasdes}</option>`;
  });
  selectHtml += `</select>`;

  selectHtml += `<select id="modelosSelectOrdem" class="form-control mb-2">
                      <option value="">Selecione o modelo</option>`;
  selectHtml += `</select>`;

  selectHtml += `<select id="tiposSelectOrdem" class="form-control mb-2">
                      <option value="">Selecione o Tipo</option>`;
  tiposCache.forEach((m) => {
    selectHtml += `<option value="${m.tipocod}">${m.tipodes}</option>`;
  });

  selectHtml += `</select>
                 <button id="btnBuscarPecasOrdem" class="btn btn-primary btn-block mt-2">Buscar</button>
                 <div id="listaOrdemHolder" class="mt-3"></div>`;

  popup.innerHTML = popup.innerHTML + selectHtml + popup.fecharHTML;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const marcaSelect = popup.querySelector("#marcaSelectOrdem");
  const modelosSelect = popup.querySelector("#modelosSelectOrdem");
  const tiposSelect = popup.querySelector("#tiposSelectOrdem");

  if (!marcaSelect || !modelosSelect || !tiposSelect) return;

  marcaSelect.addEventListener("change", (e) => {
    const marcaId = parseIntegerParam(e.target.value);
    if (marcaId === null) {
      modelosSelect.innerHTML = '<option value="">Selecione o modelo</option>';
      tiposSelect.innerHTML = '<option value="">Selecione o Tipo</option>';
      return;
    }

    fetch(`${BASE_URL}/modelo/${marcaId}`)
      .then((res) => res.json())
      .then((dados) => {
        modelosCache = dados;
        modelosSelect.innerHTML =
          '<option value="">Selecione o modelo</option>';
        dados.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.modcod;
          opt.textContent = m.moddes;
          modelosSelect.appendChild(opt);
        });
      })
      .catch(console.error);
  });

  // Ao mudar o modelo, carrega os tipos correspondentes
  modelosSelect.addEventListener("change", async (e) => {
    const modeloId = parseIntegerParam(e.target.value);
    if (modeloId === null) {
      tiposSelect.innerHTML = '<option value="">Selecione o Tipo</option>';
      return;
    }

    try {
      const resTipos = await fetch(`${BASE_URL}/tipo/${modeloId}`);
      tiposCache = await resTipos.json();
      tiposSelect.innerHTML = '<option value="">Selecione o Tipo</option>';
      tiposCache.forEach((t) => {
        tiposSelect.innerHTML += `<option value="${t.tipocod}">${t.tipodes}</option>`;
      });
    } catch (err) {
      console.error("Erro ao buscar tipos:", err);
    }
  });

  // Evento buscar modelos
  popup.querySelector("#btnBuscarPecasOrdem").addEventListener("click", () => {
    const marcaId = parseIntegerParam(
      popup.querySelector("#marcaSelectOrdem").value,
    );
    const modeloId = parseIntegerParam(
      popup.querySelector("#modelosSelectOrdem").value,
    );
    const tipoId = parseIntegerParam(
      popup.querySelector("#tiposSelectOrdem").value,
    );
    if (marcaId === null) return alert("Selecione uma marca!");
    if (modeloId === null) return alert("Selecione um modelo!");
    if (tipoId === null) return alert("Selecione um tipo!");

    const query = new URLSearchParams({
      marca: String(marcaId),
      modelo: String(modeloId),
    });

    fetch(`${BASE_URL}/pro/${tipoId}?${query.toString()}`)
      .then((r) => r.json())
      .then((produtos) => {
        const holder = popup.querySelector("#listaOrdemHolder");
        holder.innerHTML = `
            <ul id="sortable" class="list-group">
            ${produtos
              .map(
                (p) =>
                  `<li class="list-group-item" data-id="${p.procod}">
                     <span class="handle">☰ </span>${p.prodes}
                   </li>`,
              )
              .join("")}
            </ul>
            <button id="salvarOrdem" class="btn btn-success btn-block mt-3">Salvar Ordem</button>
          `;

        // Ativa drag & drop com SortableJS (funciona no celular)
        Sortable.create(holder.querySelector("#sortable"), {
          handle: ".handle",
          animation: 150,
          fallbackOnBody: true, // usa fallback que permite scroll no mobile
          swapThreshold: 0.65, // melhora a troca entre itens
          scroll: true, // ativa auto-scroll
          scrollSensitivity: 60, // velocidade do scroll quando chega perto da borda
          scrollSpeed: 10, // intensidade do scroll
        });

        // Salvar ordem
        popup.querySelector("#salvarOrdem").addEventListener("click", () => {
          const ordem = [...holder.querySelectorAll("li")].map((li) => ({
            id: li.dataset.id,
            descricao: li.textContent,
          }));

          fetch(`${BASE_URL}/pro/ordem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordem }),
          })
            .then((r) => r.json())
            .then(() => {
              const msg = document.createElement("div");
              msg.textContent = "Ordem Atualizada com sucesso!";
              msg.style.position = "fixed";
              msg.style.top = "20px";
              msg.style.left = "50%";
              msg.style.transform = "translateX(-50%)";
              msg.style.background = "#28a745";
              msg.style.color = "#fff";
              msg.style.padding = "12px 24px";
              msg.style.borderRadius = "6px";
              msg.style.zIndex = "10000";
              msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
              document.body.appendChild(msg);
              setTimeout(() => {
                msg.remove();
              }, 2000);
            })
            .catch(console.error);
        });
      });
  });
}

function toggleOrdemTipoPeca() {
  const overlay = criarOverlay();
  const popup = criarPopup("Gerenciar Ordem dos Tipos");

  // Select de marcas + botão buscar
  let selectHtml = `<select id="marcaSelectOrdem" class="form-control mb-2">
                      <option value="">Selecione a marca</option>`;
  marcasCache.forEach((m) => {
    selectHtml += `<option value="${m.marcascod}">${m.marcasdes}</option>`;
  });
  selectHtml += `</select>`;

  selectHtml += `<select id="modelosSelectOrdem" class="form-control mb-2">
                      <option value="">Selecione o modelo</option>`;
  selectHtml += `</select>`;

  selectHtml += `</select>
                 <button id="btnBuscarTipoPecasOrdem" class="btn btn-primary btn-block mt-2">Buscar</button>
                 <div id="listaOrdemHolder" class="mt-3"></div>`;

  popup.innerHTML = popup.innerHTML + selectHtml + popup.fecharHTML;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const marcaSelect = popup.querySelector("#marcaSelectOrdem");
  const modelosSelect = popup.querySelector("#modelosSelectOrdem");

  if (!marcaSelect || !modelosSelect) return;

  marcaSelect.addEventListener("change", (e) => {
    const marcaId = parseIntegerParam(e.target.value);
    if (marcaId === null) {
      modelosSelect.innerHTML = '<option value="">Selecione o modelo</option>';
      return;
    }

    fetch(`${BASE_URL}/modelo/${marcaId}`)
      .then((res) => res.json())
      .then((dados) => {
        modelosCache = dados;
        modelosSelect.innerHTML =
          '<option value="">Selecione o modelo</option>';
        dados.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.modcod;
          opt.textContent = m.moddes;
          modelosSelect.appendChild(opt);
        });
      })
      .catch(console.error);
  });

  // Evento buscar modelos
  popup
    .querySelector("#btnBuscarTipoPecasOrdem")
    .addEventListener("click", () => {
      const marcaId = parseIntegerParam(
        popup.querySelector("#marcaSelectOrdem").value,
      );
      const modeloId = parseIntegerParam(
        popup.querySelector("#modelosSelectOrdem").value,
      );
      if (marcaId === null) return alert("Selecione uma marca!");
      if (modeloId === null) return alert("Selecione um modelo!");

      fetch(`${BASE_URL}/tipo/${modeloId}`)
        .then((r) => r.json())
        .then((tipos) => {
          const holder = popup.querySelector("#listaOrdemHolder");
          holder.innerHTML = `
            <ul id="sortable" class="list-group">
            ${tipos
              .map(
                (p) =>
                  `<li class="list-group-item" data-id="${p.tipocod}">
                     <span class="handle">☰ </span>${p.tipodes}
                   </li>`,
              )
              .join("")}
            </ul>
            <button id="salvarOrdem" class="btn btn-success btn-block mt-3">Salvar Ordem</button>
          `;

          // Ativa drag & drop com SortableJS (funciona no celular)
          Sortable.create(holder.querySelector("#sortable"), {
            handle: ".handle",
            animation: 150,
            fallbackOnBody: true, // usa fallback que permite scroll no mobile
            swapThreshold: 0.65, // melhora a troca entre itens
            scroll: true, // ativa auto-scroll
            scrollSensitivity: 60, // velocidade do scroll quando chega perto da borda
            scrollSpeed: 10, // intensidade do scroll
          });

          // Salvar ordem
          popup.querySelector("#salvarOrdem").addEventListener("click", () => {
            const ordem = [...holder.querySelectorAll("li")].map((li) => ({
              id: li.dataset.id,
              descricao: li.textContent,
            }));

            fetch(`${BASE_URL}/tipo/ordem`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordem }),
            })
              .then((r) => r.json())
              .then(() => {
                const msg = document.createElement("div");
                msg.textContent = "Ordem Atualizada com sucesso!";
                msg.style.position = "fixed";
                msg.style.top = "20px";
                msg.style.left = "50%";
                msg.style.transform = "translateX(-50%)";
                msg.style.background = "#28a745";
                msg.style.color = "#fff";
                msg.style.padding = "12px 24px";
                msg.style.borderRadius = "6px";
                msg.style.zIndex = "10000";
                msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                document.body.appendChild(msg);
                setTimeout(() => {
                  msg.remove();
                }, 2000);
              })
              .catch(console.error);
          });
        });
    });
}

//********************************************* */

//função para gerar mensagem de cobrança
async function dadosPagamento() {
  try {
    const response = await fetch(`${BASE_URL}/emp/pagamento`); // sua rota no backend
    if (!response.ok) throw new Error("Erro ao buscar dados de pagamento");
    const data = await response.json();
    return data; // true ou false
  } catch (err) {
    console.error(err);
    return false; // assume não pago se der erro
  }
}

async function processCharges() {
  try {
    const hoje = new Date();
    const dados = await dadosPagamento();

    if (dados.empdtpag || !dados.empdtvenc) return;

    const vencimento = new Date(dados.empdtvenc);

    const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

    // mostra aviso se estiver até 5 dias antes do vencimento
    if (diffDias >= 0 && diffDias <= 5) {
      const div = document.createElement("div");
      div.textContent =
        diffDias === 0
          ? "Sua mensalidade vence HOJE! Realize o pagamento."
          : `Sua mensalidade vence em ${diffDias} dias, não esqueça de pagar.`;

      div.style.position = "fixed";
      div.style.top = "20px";
      div.style.left = "50%";
      div.style.transform = "translateX(-50%)";
      div.style.background = diffDias === 0 ? "#f32206ff" : "#ffbb27ff";
      div.style.color = "#fff";
      div.style.padding = "12px 24px";
      div.style.borderRadius = "6px";
      div.style.zIndex = "10000";
      div.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      document.body.appendChild(div);

      setTimeout(() => div.remove(), 6000);
    }
  } catch (err) {
    console.error(err);
  }
}
processCharges();
// checa 1x por dia
setInterval(
  () => {
    processCharges();
  },
  24 * 60 * 60 * 1000,
);

// alertPersonalizado personalizado Tom FORMAL

function alertPersonalizado(message, time) {
  let alertPersonalizado = document.getElementById("alertPersonalizado");

  if (!alertPersonalizado) {
    alertPersonalizado = document.createElement("div");
    alertPersonalizado.id = "alertPersonalizado";
    alertPersonalizado.style = `
        position: fixed;
        width: 350px;
        top: 8%;
        left: 50%;
        transform: translateX(-50%);
        background-color: #333;
        color: #fff;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
    document.body.appendChild(alertPersonalizado);
  }

  alertPersonalizado.textContent = message;
  alertPersonalizado.style.opacity = "1";

  setTimeout(() => {
    alertPersonalizado.style.opacity = "0";
    alertPersonalizado.remove();
  }, time);
}
