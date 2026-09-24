import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import App from "../src/App.jsx";
import { createTestApi } from "./fixtures/api.js";

function setup(path) {
  const api = createTestApi(), user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(api.fetch));
  vi.stubGlobal("confirm", vi.fn(() => true));
  window.OrderUpTheme = { get: () => "light", set: vi.fn() };
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return { api, user };
}

describe("fase 4 · pedidos e devoluções", () => {
  it("confirma um pedido pelo detalhe e mantém a navegação React", async () => {
    const { api, user } = setup("/pedidos");
    await screen.findByRole("heading", { name: "Pedidos" });
    await user.click(await screen.findByRole("button", { name: "Ver detalhes" }));
    const dialog = await screen.findByRole("dialog", { name: "Pedido #21" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar pedido" }));
    expect(api.calls.some((call) => call.path === "/pedidos/confirmar/21" && call.method === "PUT")).toBe(true);
    await user.click(screen.getByRole("link", { name: "Devoluções", exact: true }));
    await screen.findByRole("heading", { name: "Devoluções" });
  });

  it("cancela pedidos pendentes em lote", async () => {
    const { api, user } = setup("/pedidos");
    await screen.findByText("#21");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar pedido 21" }));
    await user.click(screen.getByRole("button", { name: "Cancelar selecionados (1)" }));
    expect(api.calls.some((call) => call.path === "/pedidos/cancelar" && call.body.pvcods[0] === 21)).toBe(true);
  });

  it("registra devolução com reposição de estoque", async () => {
    const { api, user } = setup("/devolucoes");
    await screen.findByText("Tela teste");
    await user.click(screen.getByRole("button", { name: "Devolver" }));
    const dialog = await screen.findByRole("dialog", { name: "Devolver item do pedido #20" });
    await user.type(within(dialog).getByLabelText("Motivo"), "Troca solicitada");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar devolução" }));
    const call = api.calls.find((item) => item.path === "/devolucoes" && item.method === "POST");
    expect(call.body).toMatchObject({ pvcod: 20, procod: 1, quantidade: 1, reporEstoque: true });
    await screen.findByText("Troca solicitada");
  });
});
