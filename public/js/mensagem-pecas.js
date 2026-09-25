// Formato de mensagem compartilhado pelo pedido e catalogo.
(function () {
  var EMOJI = { caixa: "📦", celular: "📱", obs: "📌" };

  // Bloco de itens (título + grupos por contexto + observações). Fonte única
  // usada pelo orçamento e pelo pedido; só o título muda em cada fluxo.
  // agrupar=true (orçamento) gera um cabeçalho tipo+modelo por contexto.
  // agrupar=false (pedido do usuário final) lista os itens sem esse cabeçalho.
  // O carrinho pode misturar marcas/modelos/tipos: cada combinação única gera
  // seu próprio cabeçalho, na ordem da primeira ocorrência, sem perder itens.
  function buildMensagemOrcamento(cart, observacoes, titulo, agrupar) {
    var SEP = "\u0000";
    var blocos = [EMOJI.caixa + " " + (titulo || "ORÇAMENTO DE PEÇAS:")];

    function pushItem(item) {
      var nome = String(item.nome || "---").trim();
      var qtde = Number(item.qt) || 0;
      var valor = parseFloat(item.preco) || 0;
      blocos.push("(" + qtde + ") " + nome + " R$" + valor.toFixed(2));
    }

    // Pedido do usuário final: sem tratamento de tipo/modelo, apenas os itens
    // na ordem do carrinho.
    if (agrupar === false) {
      cart.forEach(function (item) {
        if (item) pushItem(item);
      });
      if (observacoes) blocos.push(EMOJI.obs + " Observações: " + observacoes);
      return blocos.join("\n\n") + "\n";
    }

    // Agrupa preservando a ordem de primeira ocorrência. A marca entra na
    // chave para não fundir modelos homônimos de marcas diferentes.
    var grupos = {};
    var ordem = [];
    cart.forEach(function (item) {
      if (!item) return;
      var tipo = String(item.tipo || "").trim();
      var modelo = String(item.modelo || "").trim();
      var marca = String(item.marca || "").trim();
      var chave = tipo + SEP + modelo + SEP + marca;
      if (!grupos[chave]) {
        grupos[chave] = { tipo: tipo, modelo: modelo, marca: marca, itens: [] };
        ordem.push(chave);
      }
      grupos[chave].itens.push(item);
    });

    // Cabeçalhos ambíguos (mesmo tipo+modelo em marcas diferentes) recebem a
    // marca para diferenciar os grupos.
    var repeticoes = {};
    ordem.forEach(function (chave) {
      var g = grupos[chave];
      if (!g.tipo || !g.modelo) return;
      var titulo = g.tipo.toUpperCase() + " PARA " + g.modelo.toUpperCase();
      repeticoes[titulo] = (repeticoes[titulo] || 0) + 1;
    });

    ordem.forEach(function (chave) {
      var grupo = grupos[chave];
      if (grupo.tipo && grupo.modelo) {
        var titulo = grupo.tipo.toUpperCase() + " PARA " + grupo.modelo.toUpperCase();
        if (repeticoes[titulo] > 1 && grupo.marca) {
          titulo += " - " + grupo.marca.toUpperCase();
        }
        blocos.push(EMOJI.celular + " " + titulo);
      }
      grupo.itens.forEach(pushItem);
    });

    if (observacoes) blocos.push(EMOJI.obs + " Observações: " + observacoes);
    return blocos.join("\n\n") + "\n";
  }


  window.OrderUpMensagemPecas = buildMensagemOrcamento;
})();
