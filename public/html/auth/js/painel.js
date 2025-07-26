const params = new URLSearchParams(window.location.search);
const id = params.get("id");
let marcascod = null;
let marcacodModelo = null;
let tipo = null;
let modelo = null;

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("painelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("painelMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      holder.addEventListener("change", (e) => {
        marcacodModelo = e.target.value;
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/marcas/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelMarca");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione uma marca</option>';
      dados.forEach((marca) => {
        html += `<option value="${marca.marcascod}"${
          id == marca.marcascod ? " selected" : ""
        }>${marca.marcasdes}</option>`;
      });
      const select = document.getElementById("paineselectPainelMarcalMarca");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;

      const tipoHolder = document.getElementById("selectPainelTipo");
      if (tipoHolder) {
        tipoHolder.addEventListener("change", (e) => {
          tipo = e.target.value; // Atualiza o código do tipo selecionado
          // console.log("Tipo selecionado:", tipo);
        });
      }

      holder.addEventListener("change", (e) => {
        marcascod = e.target.value; // Atualiza o código da marca selecionada
        // Atualiza os modelos com base na marca selecionada
        fetch(`${BASE_URL}/modelo/${marcascod}`)
          .then((res) => res.json())
          .then((dados) => {
            const modeloHolder = document.getElementById("selectPainelModelo");
            if (!modeloHolder) return;
            modeloHolder.innerHTML =
              '<option value="">Selecione o Modelo</option>';
            dados.forEach((modelo) => {
              modeloHolder.innerHTML += `<option value="${modelo.modcod}">${modelo.moddes}</option>`;
            });
            // console.log("Marca selecionada:", marcascod);

            modeloHolder.addEventListener("change", (e) => {
              modelo = e.target.value; // Atualiza o código do modelo selecionado
              // console.log("Modelo selecionado:", modelo);
            });
          })
          .catch(console.error);
      });
    })
    .catch(console.error);
});

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/tipos/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelTipo");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = '<option value="">Selecione o tipo</option>';
      dados.forEach((tipo) => {
        html += `<option value="${tipo.tipocod}"${
          id == tipo.tipocod ? " selected" : ""
        }>${tipo.tipodes}</option>`;
      });
      const select = document.getElementById("selectPainelTipo");
      if (select) {
        select.innerHTML = html;
      }

      holder.innerHTML = html;
    })
    .catch(console.error);
});

// listar cor no painel/criar produto
document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BASE_URL}/procores/`)
    .then((res) => res.json())
    .then((dados) => {
      const holder = document.getElementById("selectPainelCor");
      if (!holder) return;
      holder.innerHTML = ""; // zera antes

      let html = "<label>Selecione a(s) cor(es):</label><br>";
      dados.forEach((cor) => {
        html += `
          <div class="form-check">
            <input class="form-check-input" type="checkbox" name="procor" value="${cor.corcod}" id="cor_${cor.corcod}">
            <label class="form-check-label" for="cor_${cor.corcod}">${cor.cornome}</label>
          </div>
        `;
      });
      holder.innerHTML = html;
    })
    .catch(console.error);
});

//Função para criar marca
document
  .getElementById("cadastrarPainelMarca")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/marcas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar modelo
document
  .getElementById("cadastrarPainelModelo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.modmarcascod = marcacodModelo;

    fetch(`${BASE_URL}/modelo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar modelo
document
  .getElementById("cadastrarPainelTipo")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/tipo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload(); // Atualiza a página após gravar
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
      console.error(erro);
    });
  });

//função para criar cor
document
  .getElementById("cadastrarPainelCor")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fetch(`${BASE_URL}/cores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((resposta) => {
        alert("Dados salvos com sucesso!");
        console.log(resposta);
        location.reload();
      })
      .catch((erro) => {
        alert("Erro ao salvar os dados.");
        console.error(erro);
      });
  });

//função para criar PRODUTO
document
  .getElementById("cadastrarPainelPeca")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    data.promarcascod = marcascod;
    data.promodcod = modelo;
    data.protipocod = tipo;

    // Pega todos os checkboxes marcados de cor
    const corCheckboxes = document.querySelectorAll(
      '#selectPainelCor input[type="checkbox"]:checked'
    );
    const corIds = Array.from(corCheckboxes).map((cb) => cb.value);
    try {
      // Cria o produto
      const res = await fetch(`${BASE_URL}/pro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resposta = await res.json();
      let procod =
        resposta.procod || (Array.isArray(resposta) && resposta[0]?.procod);
      if (!procod) {
        console.log("Resposta inesperada ao criar produto:", resposta);
      } else {
        console.log("Produto criado:", procod);
      }
      console.log("Cores selecionadas:", corIds);

      // Grava as cores disponíveis se houver cores marcadas e procod válido
      if (procod && corIds.length > 0) {
        // Para cada cor marcada, faz um POST individual
        for (const corcod of corIds) {
          await fetch(
            `${BASE_URL}/proCoresDisponiveis/${procod}?corescod=${corcod}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
      //console.log(resposta);
      location.reload();
    } catch (erro) {
      alert("Erro ao salvar os dados.");
      console.error(erro);
    }
  });

const inputPesquisa = document.getElementById("pesquisa");
const tabelaArea = document.getElementById("tabelaArea");
const cardsArea = document.getElementById("cardsArea");
const corpoTabela = document.getElementById("corpoTabela");

inputPesquisa.addEventListener("input", function () {
  const pesquisa = this.value.trim().toLowerCase();

  if (!pesquisa) {
    tabelaArea.style.display = "none"; // esconde tabela
    cardsArea.style.display = "block"; // mostra cards
    corpoTabela.innerHTML = ""; // limpa tabela
    return;
  }

  fetch(`${BASE_URL}/pros/`)
    .then((res) => res.json())
    .then((produtos) => {
      const filtrados = produtos.filter(
        (produto) =>
          produto.prodes && produto.prodes.toLowerCase().includes(pesquisa)
      );

      if (filtrados.length === 0) {
        tabelaArea.style.display = "none"; // esconde tabela se nada encontrado
        cardsArea.style.display = "block"; // mostra cards
        corpoTabela.innerHTML = "";
        return;
      }

      corpoTabela.innerHTML = "";
      filtrados.forEach((produto) => {
        const tr = document.createElement("tr");
        tr.dataset.preco = produto.provl;
        tr.id = `produto-${produto.procod}`; // <- aqui
        tr.innerHTML = `
          <td>${produto.prodes}</td>
          <td>${formatarMoeda(produto.provl)}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="editarProduto('${
              produto.procod
            }')">
              <i class="fa fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="excluirProduto('${
              produto.procod
            }')">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
      });

      tabelaArea.style.display = "block"; // mostra tabela
      cardsArea.style.display = "none"; // esconde cards
    })
    .catch((error) => {
      console.error("Erro no fetch:", error);
      tabelaArea.style.display = "none";
      cardsArea.style.display = "block";
      corpoTabela.innerHTML = "";
    });
});

function editarProduto(codigo) {
  Promise.all([
    fetch(`${BASE_URL}/pro/painel/${codigo}`).then((r) => r.json()),
    fetch(`${BASE_URL}/procores`).then((r) => r.json()),
    fetch(`${BASE_URL}/proCoresDisponiveis/${codigo}`).then((r) => r.json()),
  ])
    .then(([produto, coresDisponiveis, coresProduto]) => {
      // Cria o popup
      let popup = document.createElement("div");
      popup.id = "popupEditarProduto";
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

      // Preenche os campos com os dados carregados do produto
      popup.innerHTML = `
        <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
          <h5>Editar Produto</h5>
          <form id="formEditarProduto">
            <div class="mb-3">
              <label for="editarDescricao" class="form-label">Descrição</label>
              <input type="text" class="form-control" id="editarDescricao" name="prodes" value="${
                produto[0].prodes || ""
              }" required>
            </div>
            <div class="mb-3">
              <label for="editarValor" class="form-label">Valor</label>
              <input type="number" step="0.01" class="form-control" id="editarValor" name="provl" value="${
                Number(produto[0].provl).toFixed(2) || ""
              }" required>
            </div>
            <div class="mb-3" id="editarProdutoCores">
              <label>Selecione a(s) cor(es):</label><br>
              ${coresDisponiveis
                .map(
                  (c) => `
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="procor" value="${c.corcod}" id="editar_cor_${c.corcod}" ${
                  coresProduto.some((cp) => cp.corcod == c.corcod) ? "checked" : ""
                }>
                <label class="form-check-label" for="editar_cor_${c.corcod}">${c.cornome}</label>
              </div>`
                )
                .join("")}
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" id="cancelarEditarProduto">Cancelar</button>
              <button type="submit" class="btn btn-primary">Salvar</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(popup);

      document.getElementById("cancelarEditarProduto").onclick = function () {
        document.body.removeChild(popup);
      };

      document.getElementById("formEditarProduto").onsubmit = async function (e) {
        e.preventDefault();
        const prodes = document.getElementById("editarDescricao").value.trim();
        const provl = document.getElementById("editarValor").value;
        const corCheckboxes = popup.querySelectorAll('#editarProdutoCores input[type="checkbox"]');
        const selecionadas = Array.from(corCheckboxes)
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        const anteriores = coresProduto.map((c) => String(c.corcod)).filter(Boolean);

        try {
          await fetch(`${BASE_URL}/pro/${codigo}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prodes, provl }),
          });

          // adiciona novas cores
          for (const cor of selecionadas) {
            if (!anteriores.includes(cor)) {
              await fetch(`${BASE_URL}/proCoresDisponiveis/${codigo}?corescod=${cor}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            }
          }
          // remove cores desmarcadas
          for (const cor of anteriores) {
            if (!selecionadas.includes(cor)) {
              await fetch(`${BASE_URL}/proCoresDisponiveis/${codigo}?corescod=${cor}`, { method: 'DELETE' });
            }
          }

          const msg = document.createElement("div");
          msg.textContent = "Produto atualizado com sucesso!";
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
          carregarProPesquisa();
        } catch (erro) {
          alert("Erro ao atualizar o produto.");
          console.error(erro);
        }
      };

      const inputValor = document.getElementById("editarValor");

      inputValor.addEventListener("input", function (e) {
        let value = e.target.value.replace(/\D/g, "");
        value = (parseInt(value, 10) / 100).toFixed(2);
        e.target.value = value.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      });
    })
    .catch((erro) => {
      alert("Erro ao buscar os dados do produto.");
      console.error(erro);
    });
}

function carregarProPesquisa() {
  fetch(`${BASE_URL}/pros/`)
    .then((res) => res.json())
    .then((produtos) => {
      const filtrados = produtos.filter(
        (produto) =>
          produto.prodes && produto.prodes.toLowerCase().includes(pesquisa)
      );
      corpoTabela.innerHTML = "";
      filtrados.forEach((produto) => {
        const tr = document.createElement("tr");
        tr.dataset.preco = produto.provl;
        tr.id = `produto-${produto.procod}`; // <- aqui
        tr.innerHTML = `
          <td>${produto.prodes}</td>
          <td>${formatarMoeda(produto.provl)}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="editarProduto('${
              produto.procod
            }')">
              <i class="fa fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="excluirProduto('${
              produto.procod
            }')">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
      });
    });
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
      fetch(`${BASE_URL}/pros`).then((r) => r.json()),
    ]);

    document.getElementById("totalMarcas").textContent = marcas.length;
    document.getElementById("totalModelos").textContent = modelos.length;
    document.getElementById("totalTipos").textContent = tipos.length;
    document.getElementById("totalPecas").textContent = pecas.length;
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

// ------- GESTÃO MARCAS ---------
function toggleMarcas() {
  mostrarArea("areaMarcas", () => {
    carregarMarcas();

    // Aguarda o DOM atualizar para aplicar o scroll
    setTimeout(() => {
      const area = document.getElementById("areaMarcas");
      if (area) {
        area.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50); // tempo suficiente para garantir que o display foi aplicado
  });
}

function carregarMarcas() {
  fetch(`${BASE_URL}/marcas`)
    .then((r) => r.json())
    .then((dados) => {
      const tbody = document.getElementById("listaMarcas");
      tbody.innerHTML = "";
      dados.forEach((m) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-marca-id", m.marcascod);
        tr.innerHTML = `
          <td class="marca-des">${m.marcasdes}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editarMarca(${
              m.marcascod
            }, '${m.marcasdes.replace(
          /'/g,
          "\\'"
        )}')"><i class='fa fa-edit'></i></button>
            <button class="btn btn-sm btn-danger" onclick="excluirMarca(${
              m.marcascod
            })"><i class='fa fa-trash'></i></button>
          </td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
}

function editarMarca(id, nome) {
  // Cria o popup
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
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Editar Marca</h5>
      <form id="formEditarMarca">
        <div class="mb-3">
          <label for="editarMarcaDescricao" class="form-label">Descrição</label>
          <input type="text" class="form-control" id="editarMarcaDescricao" name="marcasdes" value="${
            nome || ""
          }" required>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarMarca">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarEditarMarca").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("formEditarMarca").onsubmit = function (e) {
    e.preventDefault();
    const marcasdes = document
      .getElementById("editarMarcaDescricao")
      .value.trim();
    fetch(`${BASE_URL}/marcas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marcasdes }),
    })
      .then((r) => r.json())
      .then(() => {
        // Mostra mensagem de sucesso como popup temporário
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
        msg.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        document.body.appendChild(msg);
        setTimeout(() => {
          msg.remove();
        }, 2000);
        document.body.removeChild(popup);
        carregarMarcas();
      })
      .catch(() => alert("Erro ao atualizar marca"));
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
      await fetch(`${BASE_URL}/marcas/status/${id}`, { method: "PUT" });
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
    } catch (e) {
      alert("Erro ao excluir marca ou modelos vinculados.");
      document.body.removeChild(popup);
    }
  };
}

// ------- GESTÃO MODELOS ---------
function toggleModelos() {
  mostrarArea("areaModelos", () => {
    carregarModelos();

    // Aguarda o DOM atualizar para aplicar o scroll
    setTimeout(() => {
      const area = document.getElementById("areaModelos");
      if (area) {
        area.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50); // tempo suficiente para garantir que o display foi aplicado
  });
}

function carregarModelos() {
  fetch(`${BASE_URL}/modelos`)
    .then((r) => r.json())
    .then((dados) => {
      const tbody = document.getElementById("listaModelos");
      tbody.innerHTML = "";
      dados.forEach((m) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${m.moddes}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editarModelo(${
              m.modcod
            }, '${m.moddes.replace(/'/g, "'")}', ${
          m.modmarcascod
        })"><i class='fa fa-edit'></i></button>
            <button class="btn btn-sm btn-danger" onclick="excluirModelo(${
              m.modcod
            })"><i class='fa fa-trash'></i></button>
          </td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
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
      <h5>Editar Modelo</h5>
      <form id="formEditarModelo">
        <div class="mb-3">
          <label for="editarModeloDescricao" class="form-label">Descrição</label>
          <input type="text" class="form-control" id="editarModeloDescricao" name="moddes" value="${
            nome || ""
          }" required>
        </div>
        <div class="mb-3">
          <label for="editarModeloMarca" class="form-label">Marca</label>
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
      select.innerHTML = '<option value="">Selecione uma marca</option>';
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
      .then((r) => r.json())
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
      .catch(() => alert("Erro ao atualizar modelo"));
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
        await fetch(`${BASE_URL}/modelo/${id}`, { method: "DELETE" });
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
        alert("Erro ao excluir modelo");
        document.body.removeChild(popup);
      }
    };
}

// ------- GESTÃO TIPOS ---------
function toggleTipos() {
  mostrarArea("areaTipos", () => {
    carregarTipos();

    // Aguarda o DOM atualizar para aplicar o scroll
    setTimeout(() => {
      const area = document.getElementById("areaTipos");
      if (area) {
        area.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50); // tempo suficiente para garantir que o display foi aplicado
  });
}

function carregarTipos() {
  fetch(`${BASE_URL}/tipos`)
    .then((r) => r.json())
    .then((dados) => {
      const tbody = document.getElementById("listaTipos");
      tbody.innerHTML = "";
      dados.forEach((t) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.tipodes}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editarTipo(${
              t.tipocod
            }, '${t.tipodes.replace(
          /'/g,
          "'"
        )}')"><i class='fa fa-edit'></i></button>
            <button class="btn btn-sm btn-danger" onclick="excluirTipo(${
              t.tipocod
            })"><i class='fa fa-trash'></i></button>
          </td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
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
    <div style="background:#fff;padding:24px;border-radius:8px;min-width:300px;max-width:90vw;">
      <h5>Editar Tipo</h5>
      <form id="formEditarTipo">
        <div class="mb-3">
          <label for="editarTipoDescricao" class="form-label">Descrição</label>
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
      .catch(() => alert("Erro ao atualizar tipo"));
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
      await fetch(`${BASE_URL}/tipo/${id}`, { method: "DELETE" });
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
    } catch (e) {
      alert("Erro ao excluir tipo");
      document.body.removeChild(popup);
    }
  };
}

// ------- GESTÃO CORES ---------
function toggleCores() {
  mostrarArea("areaCores", () => {
    carregarCores();

    setTimeout(() => {
      const area = document.getElementById("areaCores");
      if (area) {
        area.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  });
}

function carregarCores() {
  fetch(`${BASE_URL}/cores`)
    .then((r) => r.json())
    .then((dados) => {
      const tbody = document.getElementById("listaCores");
      tbody.innerHTML = "";
      dados.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${c.cornome}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="editarCor(${c.corcod}, '${c.cornome.replace(/'/g, "\\'")}')"><i class='fa fa-edit'></i></button>
            <button class="btn btn-sm btn-danger" onclick="excluirCor(${c.corcod})"><i class='fa fa-trash'></i></button>
          </td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
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
      <h5>Editar Cor</h5>
      <form id="formEditarCor">
        <div class="mb-3">
          <label for="editarCorDescricao" class="form-label">Descrição</label>
          <input type="text" class="form-control" id="editarCorDescricao" name="cornome" value="${nome || ""}" required>
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
      .then((r) => r.json())
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
      .catch(() => alert("Erro ao atualizar cor"));
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
      await fetch(`${BASE_URL}/cores/${id}`, { method: "DELETE" });
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
    } catch (e) {
      alert("Erro ao excluir cor");
      document.body.removeChild(popup);
    }
  };
}

// ------- GESTÃO PEÇAS ---------
function togglePecas() {
  mostrarArea("tabelaArea", () => {
    carregarPecas();

    // Aguarda o DOM atualizar para aplicar o scroll
    setTimeout(() => {
      const area = document.getElementById("tabelaArea");
      if (area) {
        area.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50); // tempo suficiente para garantir que o display foi aplicado
  });
}

function carregarPecas() {
  fetch(`${BASE_URL}/pros`)
    .then((r) => r.json())
    .then((dados) => {
      const tbody = document.getElementById("corpoTabela");
      tbody.innerHTML = "";
      dados.forEach((t) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.prodes}</td>
          <td>${formatarMoeda(t.provl)}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-sm btn-primary btn-editar-peca" data-id="${
                t.procod
              }" data-nome="${t.prodes.replace(/"/g, "&quot;")}" data-valor="${
          t.provl
        }">
                <i class='fa fa-edit'></i>
              </button>
              <button class="btn btn-sm btn-danger btn-excluir-peca" data-id="${
                t.procod
              }">
                <i class='fa fa-trash'></i>
              </button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(console.error);
}

// Delegação de eventos para os botões de editar/excluir peças
document.getElementById("corpoTabela").addEventListener("click", function (e) {
  if (e.target.closest(".btn-editar-peca")) {
    const btn = e.target.closest(".btn-editar-peca");
    editarPecas(
      btn.getAttribute("data-id"),
      btn.getAttribute("data-nome"),
      btn.getAttribute("data-valor")
    );
  }
  if (e.target.closest(".btn-excluir-peca")) {
    const btn = e.target.closest(".btn-excluir-peca");
    excluirPro(btn.getAttribute("data-id"));
  }
});

function editarPecas(id, nome, valor) {
  // Cria o popup
  let popup = document.createElement("div");
  popup.id = "popupEditarPeca";
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
      <h5>Editar Peça</h5>
      <form id="formEditarPeca">
        <div class="mb-3">
          <label for="editarPecaDescricao" class="form-label">Descrição</label>
          <input type="text" class="form-control" id="editarPecaDescricao" name="prodes" value="${
            nome || ""
          }" required>
        </div>
        <div class="mb-3">
          <label for="editarPecaValor" class="form-label">Valor</label>
          <input type="text" step="0.01" class="form-control" id="editarPecaValor" name="provl" value="${
            Number(valor).toFixed(2) || ""
          }" required>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="btn btn-secondary" id="cancelarEditarPeca">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(popup);

  document.getElementById("cancelarEditarPeca").onclick = function () {
    document.body.removeChild(popup);
  };

  document.getElementById("formEditarPeca").onsubmit = function (e) {
    e.preventDefault();
    const prodes = document.getElementById("editarPecaDescricao").value.trim();
    const provl = document.getElementById("editarPecaValor").value;
    fetch(`${BASE_URL}/pro/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prodes, provl }),
    })
      .then((r) => r.json())
      .then(() => {
        // Mostra mensagem de sucesso como popup temporário
        const msg = document.createElement("div");
        msg.textContent = "Peça atualizada com sucesso!";
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
        carregarPecas();
      })
      .catch(() => alert("Erro ao atualizar peça"));
  };

  const inputValor = document.getElementById("editarPecaValor");

  inputValor.addEventListener("input", function (e) {
    let value = e.target.value.replace(/\D/g, "");
    value = (parseInt(value, 10) / 100).toFixed(2);
    e.target.value = value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });
}

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
      await fetch(`${BASE_URL}/pro/${id}`, { method: "DELETE" });
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
    } catch (e) {
      alert("Erro ao excluir peça");
      document.body.removeChild(popup);
    }
  };
}
