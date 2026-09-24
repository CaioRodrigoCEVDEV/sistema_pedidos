import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import StorefrontApp from "../src/store/StorefrontApp.jsx";
import { createTestApi } from "./fixtures/api.js";

function setup(path = "/", initialCart = []) {
  localStorage.clear();
  localStorage.setItem("cart", JSON.stringify(initialCart));
  const api = createTestApi(), user = userEvent.setup(), popup = { location: { href: "" }, close: vi.fn(), closed: false };
  vi.stubGlobal("fetch", vi.fn(api.fetch));
  vi.stubGlobal("open", vi.fn(() => popup));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => {}) } });
  window.OrderUpTheme = { get: () => "light", set: vi.fn() };
  render(<MemoryRouter initialEntries={[path]}><StorefrontApp/></MemoryRouter>);
  return { api, user, popup };
}

describe("fase 7 · loja pública", () => {
  it("navega da home ao catálogo sem recarregar", async () => {
    const { user } = setup();
    await screen.findByRole("heading", { name: "Escolha uma marca" });
    await user.click(screen.getByRole("link", { name: /Marca A.*Ver peças/ }));
    expect(await screen.findByRole("heading", { name: "Catálogo de peças" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Marca" }).value).toBe("1");
  });

  it("seleciona a cor e mantém o carrinho entre as rotas", async () => {
    const { user } = setup("/catalogo");
    await screen.findByText("Tela teste");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    const dialog = await screen.findByRole("dialog", { name: "Escolha a cor · Tela teste" });
    await user.click(within(dialog).getByRole("button", { name: /Preto/ }));
    expect(screen.getByRole("link", { name: "Carrinho com 1 item(ns)" })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Carrinho com 1 item(ns)" }));
    expect(await screen.findByText("Tela teste (Preto)")).toBeTruthy();
    expect(localStorage.getItem("cart")).toContain("Preto");
  });

  it("revalida preços e registra o pedido antes do WhatsApp", async () => {
    const initial = [{ id: "1-Preto", nome: "Tela teste (Preto)", tipo: "Tela", marca: "Marca A", modelo: "Modelo X", preco: 100, qt: 1, idCorSelecionada: 1 }];
    const { api, user, popup } = setup("/carrinho", initial);
    await screen.findByText("Tela teste (Preto)");
    await user.click(screen.getByRole("button", { name: "Finalizar pelo WhatsApp" }));
    await screen.findByRole("heading", { name: "Encontre a peça certa para o seu aparelho" });
    const order = api.calls.find((call) => call.path === "/pedidos/enviar");
    expect(order.body.pvcod).toBe(101);
    expect(popup.location.href).toContain("api.whatsapp.com/send");
    expect(localStorage.getItem("cart")).toBe("[]");
  });
});
