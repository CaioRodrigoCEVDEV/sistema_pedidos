import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccess } from "../src/lib/navigation.js";
import { periodDates, whatsapp } from "../src/lib/format.js";
test("menu falha fechado e respeita tela, admin e módulos", () => {
  assert.equal(canAccess(null, "clientes"), false);
  assert.equal(canAccess({ usuadm: "N", telas: [] }, "clientes"), false);
  assert.equal(canAccess({ usuadm: "N", telas: ["clientes"] }, "clientes"), true);
  assert.equal(canAccess({ usuadm: "S" }, "clientes"), true);
  assert.equal(canAccess({ usuadm: "S", empusapv: "N" }, "pedidos", "pv"), false);
  assert.equal(
    canAccess({ usuadm: "N", telas: ["pedidos"], empusapv: "S", usupv: "N" }, "pedidos", "pv"),
    false
  );
});
test("períodos atravessam mês e ano usando datas locais", () => {
  assert.deepEqual(periodDates("ult7", new Date(2026, 0, 3)), {
    start: "2025-12-28",
    end: "2026-01-03",
  });
  assert.deepEqual(periodDates("mesAtual", new Date(2024, 1, 5)), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
});
test("WhatsApp normaliza telefone e codifica a mensagem", () => {
  assert.equal(whatsapp("inválido"), null);
  assert.match(
    whatsapp("(11) 99999-0000", "Olá & cliente"),
    /phone=5511999990000&text=Ol%C3%A1%20%26%20cliente$/
  );
});
