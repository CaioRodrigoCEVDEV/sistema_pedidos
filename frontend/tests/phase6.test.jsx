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

describe("fase 6 · administração", () => {
  it("filtra relatórios e preserva downloads", async () => {
    const { api, user } = setup("/relatorios");
    await screen.findByText("Tela teste");
    await user.selectOptions(screen.getByLabelText("Agrupar por"), "grupo");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(api.calls.some((call) => call.path === "/v2/relatorios/top-pecas" && call.query.get("groupBy") === "grupo")).toBe(true);
    expect(screen.getByRole("link", { name: "Baixar Excel" }).getAttribute("href")).toContain("/v2/relatorios/top-pecas/xls");
  });

  it("abre uma pasta de backup e oferece o arquivo", async () => {
    const { user } = setup("/backup");
    await user.click(await screen.findByRole("button", { name: "Abrir" }));
    const link = await screen.findByRole("link", { name: "Baixar" });
    expect(link.getAttribute("href")).toBe("/backups/download/2_segunda/backup.sql");
  });

  it("cria usuário com permissões", async () => {
    const { api, user } = setup("/users");
    await screen.findByText("Maria Teste");
    await user.click(screen.getByRole("button", { name: "Novo usuário" }));
    const dialog = screen.getByRole("dialog", { name: "Novo usuário" });
    await user.type(within(dialog).getByLabelText("Nome"), "João Teste");
    await user.type(within(dialog).getByLabelText("E-mail"), "joao@teste.com");
    await user.type(within(dialog).getByLabelText("Senha"), "123");
    await user.click(within(dialog).getByText("Relatórios"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(api.calls.some((call) => call.path === "/usuario/novo/" && call.body.telas.includes("relatorios"))).toBe(true);
  });

  it("salva configurações da empresa", async () => {
    const { api, user } = setup("/configuracoes");
    const name = await screen.findByLabelText("Razão social / nome fantasia");
    await user.clear(name); await user.type(name, "Nova Loja");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    expect(api.calls.some((call) => call.path === "/emp" && call.method === "PUT" && call.body.emprazao === "Nova Loja")).toBe(true);
  });

  it("altera o próprio perfil", async () => {
    const { api, user } = setup("/perfil");
    await screen.findByDisplayValue("operador@teste.com");
    await user.type(screen.getByLabelText("Nova senha"), "nova");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "nova");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(api.calls.some((call) => call.path === "/auth/atualizarCadastro/1" && call.body.ususenha === "nova")).toBe(true);
  });
});
