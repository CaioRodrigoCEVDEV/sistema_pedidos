// Configuração de Controle de Estoque da empresa.
// Ativa/desativa as flags automáticas (empusaest) e define a quantidade
// mínima usada para marcar um produto como "Últimas unidades".
ouOnNavigate("configEstoque", function () {
  var usaEl = document.getElementById("empusaest");
  var minEl = document.getElementById("empestoqmin");
  var salvarEl = document.getElementById("saveEstoque");
  var badgeEl = document.getElementById("configEstoqueBadge");
  var badgeTextEl = document.getElementById("configEstoqueBadgeText");

  if (!usaEl || !minEl || !salvarEl) return;

  function atualizarBadge() {
    if (!badgeEl) return;
    var ativo = usaEl.checked;
    badgeEl.classList.toggle("ou-badge--success", ativo);
    badgeEl.classList.toggle("ou-badge--neutral", !ativo);
    if (badgeTextEl) {
      badgeTextEl.textContent = ativo
        ? "Estoque controlado"
        : "Estoque desativado";
    }
  }

  function aplicarEstado() {
    minEl.disabled = !usaEl.checked;
    atualizarBadge();
  }

  usaEl.addEventListener("change", aplicarEstado);
  aplicarEstado();

  if (typeof BASE_URL === "undefined") {
    console.error("BASE_URL não está definida.");
    return;
  }

  var empresaPromise =
    typeof window.obterDadosEmpresa === "function"
      ? window.obterDadosEmpresa()
      : fetch(`${BASE_URL}/emp`).then((response) => response.json());

  empresaPromise
    .then((data) => {
      usaEl.checked =
        String(data.empusaest || "N").trim().toUpperCase() === "S";
      var min = Number.parseInt(data.empestoqmin, 10);
      minEl.value = Number.isFinite(min) ? min : 5;
      aplicarEstado();
    })
    .catch((error) => {
      console.error("Erro ao buscar a configuração de estoque:", error);
    });

  salvarEl.addEventListener("click", function () {
    var empusaest = usaEl.checked ? "S" : "N";
    var empestoqmin = Number.parseInt(minEl.value, 10);

    if (!Number.isInteger(empestoqmin) || empestoqmin < 0) {
      showToast("Informe uma quantidade mínima válida.", "warning");
      return;
    }

    var conteudoOriginal = salvarEl.innerHTML;
    salvarEl.disabled = true;
    salvarEl.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Salvando...';

    fetch(`${BASE_URL}/emp/estoque`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empusaest: empusaest, empestoqmin: empestoqmin }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Erro ao salvar configuração");
        return response.json();
      })
      .then(() => {
        showToast("Configuração de estoque atualizada!", "success");
      })
      .catch((error) => {
        console.error(error);
        showToast("Erro ao salvar a configuração de estoque.", "error");
      })
      .finally(() => {
        salvarEl.disabled = false;
        salvarEl.innerHTML = conteudoOriginal;
      });
  });
});
