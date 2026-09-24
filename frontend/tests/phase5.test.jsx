import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import App from "../src/App.jsx";
import { createTestApi } from "./fixtures/api.js";

function setup(path) {
  const api = createTestApi(), user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(api.fetch));
  window.OrderUpTheme = { get: () => "light", set: vi.fn() };
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return { api, user };
}

describe("fase 5 · estoque", () => {
  it("registra entrada de estoque por diferença", async () => {
    const { api, user } = setup("/estoque");
    await screen.findByText("Tela teste");
    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajustar estoque · Tela teste" });
    await user.clear(within(dialog).getByLabelText("Quantidade"));
    await user.type(within(dialog).getByLabelText("Quantidade"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Salvar ajuste" }));
    const call = api.calls.find((item) => item.path === "/api/estoque/itens/1/ajustar");
    expect(call.body).toMatchObject({ delta: 3, cor: 1 });
    await screen.findByText("8");
  });

  it("navega para estoque de grupos sem recarregar e ajusta o saldo", async () => {
    const { api, user } = setup("/estoque");
    await screen.findByText("Tela teste");
    await user.click(screen.getByRole("link", { name: "Estoque Grupos", exact: true }));
    await screen.findByRole("heading", { name: "Estoque por grupos" });
    await screen.findByText("Telas compatíveis");
    await user.type(screen.getByLabelText("Ajuste de Telas compatíveis"), "2");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(api.calls.some((item) => item.path === "/api/estoque-grupos/1/ajustar" && item.body.delta === 2)).toBe(true);
  });

  it("salva quantidade ideal e consulta o histórico do grupo", async () => {
    const { api, user } = setup("/estoque-grupos");
    const ideal = await screen.findByLabelText("Quantidade ideal de Telas compatíveis");
    await user.clear(ideal); await user.type(ideal, "10");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(api.calls.some((item) => item.path === "/api/estoque-grupos/1/ideal" && item.body.qtde_ideal === 10)).toBe(true);
    await user.click(screen.getByRole("button", { name: "Ver histórico" }));
    await screen.findByRole("dialog", { name: "Movimentações · Telas compatíveis" });
    expect(screen.getByText("Estoque inicial")).toBeTruthy();
  });
});
