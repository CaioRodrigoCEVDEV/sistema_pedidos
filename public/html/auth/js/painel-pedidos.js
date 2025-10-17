function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Carrega os totais de marcas, modelos, tipos e peças
// função para atualizar os cards de totais (pode ser chamada após confirmar/cancelar)
async function atualizarTotaisPedidos() {
  try {
    const [pedidos, pvBalcao, pvEntrega, pvConfirmados] = await Promise.all([
      fetch(`${BASE_URL}/pedidos/pendentes`).then((r) => r.json()),
      fetch(`${BASE_URL}/pedidos/balcao`).then((r) => r.json()),
      fetch(`${BASE_URL}/pedidos/entrega`).then((r) => r.json()),
      fetch(`${BASE_URL}/pedidos/total/confirmados`).then((r) => r.json()),
    ]);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("totalPedPendentes", pedidos?.[0]?.count ?? 0);
    setText("totalPedBalcao", pvBalcao?.[0]?.count ?? 0);
    setText("totalPedEntrega", pvEntrega?.[0]?.count ?? 0);
    setText("totalPedConfirmados", pvConfirmados?.[0]?.count ?? 0);
  } catch (err) {
    console.error("Erro ao carregar totais", err);
  }
}

// expõe a função para uso externo (ex: chamar após confirmar/cancelar)
window.atualizarTotaisPedidos = atualizarTotaisPedidos;

// chama uma vez ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  atualizarTotaisPedidos();
});

// pedidos pedentes
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/pedidos/listar`)
    .then((res) => res.json())
    .then((dados) => {
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center">${dado.pvcod}</td>
          <td class="text-center">${formatarMoeda(dado.pvvl)}</td>
          <td class="text-center">
            <button type="button" class="btn btn-success mx-1" onclick="confirmarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-check-square"></i>
            </button>
            <button type="button" class="btn btn-danger" onclick="cancelarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-x-square"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
      });
    })
    .catch((erro) => console.error("Erro ao carregar pedidos:", erro));
});

// confirmação de pedidos
async function confirmarPedido(pvcod) {
  try {
    const response = await fetch(`${BASE_URL}/pedidos/confirmar/${pvcod}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      // Recarrega a tabela de pedidos sem recarregar a página
      const res = await fetch(`${BASE_URL}/pedidos/listar`);
      const dados = await res.json();
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center">${dado.pvcod}</td>
          <td class="text-center">${formatarMoeda(dado.pvvl)}</td>
          <td class="text-center">
            <button type="button" class="btn btn-success mx-1" onclick="confirmarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-check-square"></i>
            </button>
            <button type="button" class="btn btn-danger" onclick="cancelarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-x-square"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
        atualizarTotaisPedidos();
      });

      // alert("Pedido confirmado com sucesso!");
      // Atualize a interface do usuário conforme necessário
    } else {
      // alert("Erro ao confirmar o pedido.");
    }
  } catch (error) {
    console.error("Erro ao confirmar o pedido:", error);
    alert("Erro ao confirmar o pedido.");
  }
}

async function cancelarPedido(pvcod) {
  try {
    const response = await fetch(`${BASE_URL}/pedidos/cancelar/${pvcod}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      // Recarrega a tabela de pedidos sem recarregar a página
      const res = await fetch(`${BASE_URL}/pedidos/listar`);
      const dados = await res.json();
      const corpoTabela = document.getElementById("corpoTabela");
      corpoTabela.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="text-center">${dado.pvcod}</td>
          <td class="text-center">${formatarMoeda(dado.pvvl)}</td>
          <td class="text-center">
            <button type="button" class="btn btn-success mx-1" onclick="confirmarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-check-square"></i>
            </button>
            <button type="button" class="btn btn-danger" onclick="cancelarPedido(${
              dado.pvcod
            })">
              <i class="bi bi-x-square"></i>
            </button>
          </td>
        `;
        corpoTabela.appendChild(tr);
        atualizarTotaisPedidos();
      });

      // alert("Pedido cancelado com sucesso!");
      // Atualize a interface do usuário conforme necessário
    } else {
      // alert("Erro ao cancelar o pedido.");
    }
  } catch (error) {
    console.error("Erro ao cancelar o pedido:", error);
    alert("Erro ao cancelar o pedido.");
  }
}

// pedidos confirmados
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${BASE_URL}/pedidos/confirmados`)
    .then((res) => res.json())
    .then((dados) => {
      const confirmados = document.getElementById("pedConfirmados");
      confirmados.innerHTML = ""; // limpa o conteúdo atual da tabela

      dados.forEach((dado) => {
        const item = document.createElement("div");
        item.className =
          "d-flex align-items-center justify-content-between mb-2";
        item.innerHTML = `
          <div class="text-center" style="min-width:80px"> Pedido
            <div class="text-center" style="min-width:80px">${dado.pvcod}</div>
          </div>
          <div class="text-center" style="min-width:80px"> Valor
            <div class="text-center" style="min-width:140px">${formatarMoeda(
              dado.pvvl
            )}</div>
          </div>
        `;
        confirmados.appendChild(item);
      });
    })
    .catch((erro) => console.error("Erro ao carregar pedidos:", erro));
});

(function () {
  // sobrescreve confirmarPedido para adicionar atualização da lista de confirmados
  const originalConfirmar = window.confirmarPedido;
  if (typeof originalConfirmar !== "function") return;

  async function atualizarConfirmados() {
    try {
      const res = await fetch(`${BASE_URL}/pedidos/confirmados`);
      const dados = await res.json();
      const confirmados = document.getElementById("pedConfirmados");
      if (!confirmados) return;
      confirmados.innerHTML = "";
      dados.forEach((dado) => {
        const item = document.createElement("div");
        item.className =
          "d-flex align-items-center justify-content-between mb-2";
        item.innerHTML = `
          <div class="text-center" style="min-width:80px">${dado.pvcod}</div>
          <div class="text-center" style="min-width:140px">${formatarMoeda(
            dado.pvvl
          )}</div>
        `;
        confirmados.appendChild(item);
      });
    } catch (err) {
      console.error("Erro ao atualizar pedidos confirmados:", err);
    }
  }

  window.confirmarPedido = async function (pvcod) {
    // chama a implementação original (mantendo comportamento atual)
    try {
      await originalConfirmar(pvcod);
    } catch (err) {
      // original já faz tratamento/alertas; apenas logamos o erro aqui também
      console.error("Erro na confirmação original:", err);
    }
    // sempre tenta atualizar a lista de confirmados após a tentativa de confirmação
    await atualizarConfirmados();
    atualizarTotaisPedidos();
  };
})();
