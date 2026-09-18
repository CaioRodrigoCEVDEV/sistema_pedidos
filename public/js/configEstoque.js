// Configuração de Controle de Estoque da empresa.
// Ativa/desativa as flags automáticas (empusaest) e define a quantidade
// mínima usada para marcar um produto como "Últimas unidades".
document.addEventListener("DOMContentLoaded", function () {
  var usaEl = document.getElementById("empusaest");
  var minEl = document.getElementById("empestoqmin");
  var salvarEl = document.getElementById("saveEstoque");

  if (!usaEl || !minEl || !salvarEl) return;

  function aplicarEstado() {
    minEl.disabled = !usaEl.checked;
  }

  usaEl.addEventListener("change", aplicarEstado);
  aplicarEstado();

  if (typeof BASE_URL === "undefined") {
    console.error("BASE_URL não está definida.");
    return;
  }

  fetch(`${BASE_URL}/emp`)
    .then((response) => response.json())
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
      });
  });
});
