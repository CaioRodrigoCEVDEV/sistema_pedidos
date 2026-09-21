/**
 * Promoções por produto.
 *
 * Permite criar/editar/remover a promoção de um produto, alternar o status e
 * definir desconto percentual ou de valor fixo. O preço exibido/gravado é sempre
 * calculado pelo servidor; aqui só montamos a configuração.
 */

(function () {
  "use strict";

  var TIPO_LABEL = { P: "Percentual", V: "Valor fixo" };

  var promocoes = [];
  var produtoSelecionado = null;
  var buscaResultados = [];
  var editandoProcod = null;

  var tableBody = document.getElementById("promocoesTableBody");
  var loadingState = document.getElementById("loadingState");
  var emptyState = document.getElementById("emptyState");
  var buscaInput = document.getElementById("buscaProduto");
  var btnBuscar = document.getElementById("btnBuscarProduto");
  var resultadoBusca = document.getElementById("resultadoBusca");
  var blocoBusca = document.getElementById("blocoBusca");
  var blocoSelecionado = document.getElementById("blocoSelecionado");
  var produtoSelecionadoNome = document.getElementById("produtoSelecionadoNome");
  var btnTrocarProduto = document.getElementById("btnTrocarProduto");
  var tipoDesconto = document.getElementById("tipoDesconto");
  var valorDesconto = document.getElementById("valorDesconto");
  var valorUnidade = document.getElementById("valorUnidade");
  var dataInicio = document.getElementById("dataInicio");
  var dataFim = document.getElementById("dataFim");
  var promocaoAtiva = document.getElementById("promocaoAtiva");
  var btnSalvar = document.getElementById("btnSalvarPromocao");
  var btnNova = document.getElementById("btnNovaPromocao");
  var modalEl = document.getElementById("modalPromocao");
  var modalTitulo = document.getElementById("modalPromocaoLabel");
  var modal = null;

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

  function formatarValorDesconto(promocao) {
    var valor = Number(promocao.promocaovalor) || 0;
    if (promocao.promocaotipo === "P") {
      return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
    }
    return formatarMoeda(valor);
  }

  function formatarData(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 10).split("-").reverse().join("/");
  }

  function formatarValidade(promocao) {
    var inicio = promocao.promocaodtinicio;
    var fim = promocao.promocaodtfim;
    if (!inicio && !fim) return "Sempre";
    if (inicio && fim) return formatarData(inicio) + " – " + formatarData(fim);
    if (inicio) return "A partir de " + formatarData(inicio);
    return "Até " + formatarData(fim);
  }

  function notificar(mensagem, tipo) {
    if (typeof window.ouToast === "function") {
      window.ouToast(mensagem, tipo || "success");
    } else {
      alert(mensagem);
    }
  }

  async function lerErro(response, fallback) {
    try {
      var data = await response.json();
      return data.error || data.message || fallback;
    } catch (error) {
      return fallback;
    }
  }

  // ---------------------------------------------------------------- listagem

  async function carregarPromocoes() {
    loadingState.style.display = "block";
    emptyState.style.display = "none";

    try {
      var response = await fetch(BASE_URL + "/promocoes/admin", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await lerErro(response, "Erro ao carregar promoções"));
      }

      var data = await response.json();
      promocoes = Array.isArray(data.promocoes) ? data.promocoes : [];
      renderizarPromocoes();
      emptyState.style.display = promocoes.length === 0 ? "block" : "none";
    } catch (error) {
      console.error("Erro ao carregar promoções:", error);
      notificar(error.message || "Erro ao carregar promoções", "error");
    } finally {
      loadingState.style.display = "none";
    }
  }

  function renderizarPromocoes() {
    tableBody.innerHTML = "";

    promocoes.forEach(function (promocao) {
      var inativo =
        String(promocao.prosit || "A").trim().toUpperCase() !== "A"
          ? '<span class="badge text-bg-secondary">Inativo</span>'
          : "";
      var ativo = promocao.promocaoativo === true;

      var original = Number(promocao.provl) || 0;
      var promo = Number(promocao.promopreco) || 0;

      var statusHtml =
        '<div class="form-check form-switch d-inline-block m-0">' +
        '<input class="form-check-input" type="checkbox" role="switch" data-status-procod="' +
        promocao.procod +
        '" ' +
        (ativo ? "checked" : "") +
        ' aria-label="Ativar ou desativar promoção" />' +
        "</div>" +
        '<div class="small text-muted">' +
        (ativo ? "Ativa" : "Inativa") +
        "</div>";

      var tr = document.createElement("tr");
      tr.dataset.promocod = promocao.procod;
      tr.innerHTML =
        '<td data-label="Produto">' +
        '<div class="promo-produto">' +
        escapeHtml(promocao.prodes || "Produto") +
        "</div>" +
        '<div class="promo-produto__meta">' +
        (promocao.tipodes ? "<span>" + escapeHtml(promocao.tipodes) + "</span>" : "") +
        (promocao.marcasdes ? "<span>" + escapeHtml(promocao.marcasdes) + "</span>" : "") +
        inativo +
        "</div>" +
        "</td>" +
        '<td class="text-center" data-label="Desconto">' +
        '<span class="promo-desconto"><i class="bi bi-tag-fill" aria-hidden="true"></i> ' +
        formatarValorDesconto(promocao) +
        "</span>" +
        '<div class="small text-muted">' +
        escapeHtml(TIPO_LABEL[promocao.promocaotipo] || promocao.promocaotipo) +
        "</div>" +
        "</td>" +
        '<td class="text-end" data-label="Preço original">' +
        '<span class="promo-preco-original">' +
        formatarMoeda(original) +
        "</span>" +
        "</td>" +
        '<td class="text-end" data-label="Preço promocional">' +
        '<span class="promo-preco">' +
        formatarMoeda(promo) +
        "</span>" +
        "</td>" +
        '<td class="text-center" data-label="Validade">' +
        escapeHtml(formatarValidade(promocao)) +
        "</td>" +
        '<td class="text-center" data-label="Status">' +
        statusHtml +
        "</td>" +
        '<td class="text-end" data-label="Ações">' +
        '<div class="btn-group btn-group-sm">' +
        '<button type="button" class="btn btn-outline-primary" data-editar="' +
        promocao.procod +
        '" title="Editar"><i class="bi bi-pencil"></i></button>' +
        '<button type="button" class="btn btn-outline-danger" data-remover="' +
        promocao.procod +
        '" title="Remover"><i class="bi bi-trash"></i></button>' +
        "</div>" +
        "</td>";

      tableBody.appendChild(tr);
    });
  }

  // ----------------------------------------------------------- modal/edição

  function atualizarUnidadeValor() {
    valorUnidade.textContent = tipoDesconto.value === "P" ? "(%)" : "(R$)";
    if (tipoDesconto.value === "P") {
      valorDesconto.setAttribute("max", "100");
    } else {
      valorDesconto.removeAttribute("max");
    }
  }

  function mostrarBusca() {
    blocoBusca.style.display = "";
    blocoSelecionado.style.display = "none";
    btnTrocarProduto.style.display = "";
  }

  function selecionarProduto(produto) {
    produtoSelecionado = produto;
    produtoSelecionadoNome.textContent =
      produto.prodes + " · " + formatarMoeda(produto.provl);
    blocoBusca.style.display = "none";
    blocoSelecionado.style.display = "";
    resultadoBusca.innerHTML = "";
    buscaInput.value = "";
    if (editandoProcod !== null) {
      btnTrocarProduto.style.display = "none";
    }
  }

  function limparFormulario() {
    produtoSelecionado = null;
    buscaResultados = [];
    editandoProcod = null;
    buscaInput.value = "";
    resultadoBusca.innerHTML = "";
    tipoDesconto.value = "P";
    valorDesconto.value = "";
    dataInicio.value = "";
    dataFim.value = "";
    promocaoAtiva.checked = true;
    mostrarBusca();
    atualizarUnidadeValor();
  }

  function abrirNova() {
    limparFormulario();
    modalTitulo.innerHTML = '<i class="bi bi-tag me-1"></i> Nova promoção';
    modal = modal || new bootstrap.Modal(modalEl);
    modal.show();
    setTimeout(function () {
      buscaInput.focus();
    }, 300);
  }

  function abrirEditar(promocao) {
    limparFormulario();
    editandoProcod = promocao.procod;
    selecionarProduto({
      procod: promocao.procod,
      prodes: promocao.prodes,
      provl: promocao.provl,
    });
    tipoDesconto.value = promocao.promocaotipo;
    valorDesconto.value = Number(promocao.promocaovalor);
    dataInicio.value = promocao.promocaodtinicio || "";
    dataFim.value = promocao.promocaodtfim || "";
    promocaoAtiva.checked = promocao.promocaoativo === true;
    atualizarUnidadeValor();
    btnTrocarProduto.style.display = "none";
    modalTitulo.innerHTML = '<i class="bi bi-pencil me-1"></i> Editar promoção';
    modal = modal || new bootstrap.Modal(modalEl);
    modal.show();
  }

  // -------------------------------------------------------------- busca

  async function buscarProdutos() {
    var termo = buscaInput.value.trim();
    if (!termo) {
      resultadoBusca.innerHTML = "";
      return;
    }

    btnBuscar.disabled = true;
    try {
      var response = await fetch(
        BASE_URL +
          "/pros?q=" +
          encodeURIComponent(termo) +
          "&page=1&pageSize=10&semest=N&semPromocao=1",
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error("Erro ao buscar produtos");
      }

      var data = await response.json();
      buscaResultados = Array.isArray(data.data) ? data.data : [];
      renderizarBusca();
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      notificar("Erro ao buscar produtos", "error");
    } finally {
      btnBuscar.disabled = false;
    }
  }

  function renderizarBusca() {
    if (buscaResultados.length === 0) {
      resultadoBusca.innerHTML =
        '<p class="text-muted small mb-2">Nenhum produto encontrado.</p>';
      return;
    }

    resultadoBusca.innerHTML = buscaResultados
      .map(function (produto) {
        return (
          '<div class="busca-resultado">' +
          '<span class="busca-resultado__main">' +
          '<span class="busca-resultado__name">' +
          escapeHtml(produto.prodes) +
          "</span>" +
          '<span class="busca-resultado__meta">' +
          escapeHtml(produto.tipodes || "") +
          " · " +
          escapeHtml(produto.marcasdes || "") +
          " · " +
          formatarMoeda(produto.provl) +
          "</span>" +
          "</span>" +
          '<button type="button" class="btn btn-sm btn-success" data-selecionar="' +
          produto.procod +
          '"><i class="bi bi-plus-lg"></i> Selecionar</button>' +
          "</div>"
        );
      })
      .join("");
  }

  // -------------------------------------------------------------- salvar

  async function salvar() {
    if (!produtoSelecionado) {
      notificar("Selecione um produto.", "error");
      return;
    }

    var tipo = tipoDesconto.value;
    var valor = parseFloat(valorDesconto.value);
    if (!Number.isFinite(valor) || valor <= 0) {
      notificar("Informe um valor de desconto maior que zero.", "error");
      return;
    }
    if (tipo === "P" && valor > 100) {
      notificar("O percentual deve ser no máximo 100%.", "error");
      return;
    }
    if (
      tipo === "V" &&
      Number(produtoSelecionado.provl) > 0 &&
      valor >= Number(produtoSelecionado.provl)
    ) {
      notificar("O valor fixo deve ser menor que o preço do produto.", "error");
      return;
    }
    if (dataInicio.value && dataFim.value && dataFim.value < dataInicio.value) {
      notificar("A data final não pode ser anterior à inicial.", "error");
      return;
    }

    var payload = {
      tipo: tipo,
      valor: valor,
      ativo: promocaoAtiva.checked,
      dtinicio: dataInicio.value || null,
      dtfim: dataFim.value || null,
    };

    btnSalvar.disabled = true;
    try {
      var url;
      var method;
      if (editandoProcod === null) {
        url = BASE_URL + "/promocoes";
        method = "POST";
        payload.procod = produtoSelecionado.procod;
      } else {
        url = BASE_URL + "/promocoes/" + editandoProcod;
        method = "PUT";
      }

      var response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await lerErro(response, "Erro ao salvar promoção"));
      }

      notificar(
        editandoProcod === null
          ? "Promoção criada com sucesso."
          : "Promoção atualizada com sucesso."
      );
      if (modal) modal.hide();
      await carregarPromocoes();
    } catch (error) {
      console.error("Erro ao salvar promoção:", error);
      notificar(error.message || "Erro ao salvar promoção", "error");
    } finally {
      btnSalvar.disabled = false;
    }
  }

  async function alternarStatus(procod, ativo, input) {
    input.disabled = true;
    try {
      var response = await fetch(BASE_URL + "/promocoes/" + procod, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ativo: ativo }),
      });
      if (!response.ok) {
        throw new Error(await lerErro(response, "Erro ao atualizar promoção"));
      }
      notificar(ativo ? "Promoção ativada." : "Promoção desativada.");
      await carregarPromocoes();
    } catch (error) {
      console.error("Erro ao alternar status:", error);
      notificar(error.message || "Erro ao atualizar promoção", "error");
      input.checked = !ativo;
      input.disabled = false;
    }
  }

  async function remover(procod) {
    var promocao = promocoes.find(function (p) {
      return Number(p.procod) === Number(procod);
    });
    var nome = promocao ? promocao.prodes : "este produto";
    if (!window.confirm('Remover a promoção de "' + nome + '"?')) return;

    try {
      var response = await fetch(BASE_URL + "/promocoes/" + procod, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await lerErro(response, "Erro ao remover promoção"));
      }
      notificar("Promoção removida.");
      await carregarPromocoes();
    } catch (error) {
      console.error("Erro ao remover promoção:", error);
      notificar(error.message || "Erro ao remover promoção", "error");
    }
  }

  // -------------------------------------------------------------- eventos

  tableBody.addEventListener("change", function (event) {
    var input = event.target.closest("[data-status-procod]");
    if (!input) return;
    var procod = parseInt(input.getAttribute("data-status-procod"), 10);
    alternarStatus(procod, input.checked, input);
  });

  tableBody.addEventListener("click", function (event) {
    var btnEditar = event.target.closest("[data-editar]");
    if (btnEditar) {
      var procod = parseInt(btnEditar.getAttribute("data-editar"), 10);
      var promocao = promocoes.find(function (p) {
        return Number(p.procod) === procod;
      });
      if (promocao) abrirEditar(promocao);
      return;
    }

    var btnRemover = event.target.closest("[data-remover]");
    if (btnRemover) {
      remover(parseInt(btnRemover.getAttribute("data-remover"), 10));
    }
  });

  btnNova.addEventListener("click", abrirNova);
  btnBuscar.addEventListener("click", buscarProdutos);
  btnSalvar.addEventListener("click", salvar);
  tipoDesconto.addEventListener("change", atualizarUnidadeValor);

  buscaInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      buscarProdutos();
    }
  });

  btnTrocarProduto.addEventListener("click", mostrarBusca);

  resultadoBusca.addEventListener("click", function (event) {
    var btn = event.target.closest("[data-selecionar]");
    if (!btn) return;
    var procod = parseInt(btn.getAttribute("data-selecionar"), 10);
    var produto = buscaResultados.find(function (p) {
      return Number(p.procod) === procod;
    });
    if (produto) selecionarProduto(produto);
  });

  if (modalEl) {
    modalEl.addEventListener("hidden.bs.modal", limparFormulario);
  }

  ouOnLoad(atualizarUnidadeValor);
  ouOnLoad(carregarPromocoes);
})();
