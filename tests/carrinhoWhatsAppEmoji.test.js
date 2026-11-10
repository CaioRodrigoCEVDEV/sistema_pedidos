const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("pedido abre prévia do WhatsApp com texto e emojis pré-preenchidos", () => {
  const context = vm.createContext({
    window: { addEventListener() {} },
    document: { addEventListener() {} },
    ouOnLoad() {},
  });
  vm.runInContext(read("public/js/mensagem-pecas.js"), context);
  vm.runInContext(
    read("public/js/carrinho.js").replace(
      "  window.renderCart = renderCart;",
      "  window.testMessage = buildMensagem;\n  window.testUrl = montarUrlWhatsApp;\n  window.testEmoji = EMOJI;\n  window.renderCart = renderCart;"
    ),
    context
  );

  const items = [{ nome: "A01 CHINA S/ ARO", qt: 1, preco: 50 }];
  for (const [channel, emojiKey, label] of [
    ["ENTREGA", "caminhao", "Entrega"],
    ["BALCAO", "loja", "Retirada: No balcão"],
  ]) {
    const message = context.window.testMessage(items, 50, "", channel) +
      context.window.testEmoji[emojiKey] + " " + label + "\nPedido N°: 507\n";
    const url = new URL(context.window.testUrl("+55 (61) 98374-5728", message));
    assert.match(message, /^📦 PEDIDO DE PEÇAS:/);
    assert.match(message, /💰 Total: R\$ 50\.00/);
    assert.ok(message.includes(context.window.testEmoji[emojiKey] + " " + label));
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/5561983745728");
    assert.equal(url.searchParams.get("text"), message);
    assert.match(url.href, /%F0%9F%/);
    assert.doesNotMatch(url.href, /%EF%BF%BD/);
  }
});
