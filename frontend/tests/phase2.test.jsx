import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import App from "../src/App.jsx";
import { createTestApi } from "./fixtures/api.js";

function setup(path = "/dashboard", options) {
  const api = createTestApi(options),
    user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(api.fetch));
  window.OrderUpTheme = { get: () => "light", set: vi.fn() };
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  return { api, user };
}
async function openAna(user) {
  await user.click(await screen.findByRole("button", { name: "Ana Teste" }));
  return screen.findByRole("dialog", { name: "Ana Teste" });
}

describe("navegação e sessão", () => {
  it("mantém o cabeçalho e os filtros ao trocar Clientes e Dashboard", async () => {
    const { api, user } = setup("/clientes");
    await screen.findByRole("button", { name: "Ana Teste" });
    const header = screen.getByRole("banner");
    await user.type(screen.getByRole("searchbox", { name: "Buscar clientes" }), "Ana");
    await user.click(screen.getByRole("button", { name: "Buscar", exact: true }));
    await screen.findByText("1 cliente");
    await user.click(screen.getByRole("link", { name: "Dashboard", exact: true }));
    await screen.findByRole("heading", { name: /Bem-vindo/ });
    expect(screen.getByRole("banner")).toBe(header);
    await user.click(screen.getByRole("link", { name: "Clientes", exact: true }));
    await screen.findByText("1 cliente");
    expect(screen.getByRole("searchbox").value).toBe("Ana");
    expect(screen.getByRole("banner")).toBe(header);
    expect(api.calls.filter((c) => c.path === "/me/usuario")).toHaveLength(1);
  });
  it("bloqueia endereço direto sem permissão e não consulta seus dados", async () => {
    const { api } = setup("/dashboard", { permissions: { usuadm: "N", telas: ["clientes"] } });
    await screen.findByText("Acesso não permitido");
    expect(screen.queryByRole("link", { name: "Dashboard", exact: true })).toBeNull();
    expect(api.calls.some((c) => c.path === "/dashboard/resumo")).toBe(false);
  });
  it("volta ao login quando uma API informa sessão expirada", async () => {
    const { api, user } = setup("/clientes");
    await screen.findByRole("button", { name: "Ana Teste" });
    api.expire();
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    await screen.findByRole("heading", { name: "Acesse sua conta" });
    expect(screen.queryByRole("button", { name: "Ana Teste" })).toBeNull();
  });
  it("faz login na rota solicitada sem armazenar token no navegador", async () => {
    const { user } = setup("/clientes", { authenticated: false });
    await user.type(await screen.findByLabelText("E-mail"), "teste@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-ficticia");
    await user.click(screen.getByRole("button", { name: "Entrar", exact: true }));
    await screen.findByRole("heading", { name: "Clientes", exact: true });
    expect(localStorage.getItem("token")).toBeNull();
  });
});
describe("Clientes", () => {
  it("retorna à última página disponível quando a lista diminui", async () => {
    const { api, user } = setup("/clientes");
    await screen.findByRole("button", { name: "Ana Teste" });
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByRole("button", { name: "Cliente 23" });
    vi.stubGlobal("fetch", vi.fn(async (url, options) => {
      if (String(url).startsWith("/cli?") && new URL(url, "http://localhost").searchParams.get("page") === "2") {
        return new Response(JSON.stringify({ data: [], total: 20, page: 2 }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return api.fetch(url, options);
    }));
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    await screen.findByRole("button", { name: "Ana Teste" });
    expect(screen.getByRole("button", { name: "Anterior" }).disabled).toBe(true);
  });
  it("pagina e cria cliente enviando os campos do cadastro apenas uma vez", async () => {
    const { api, user } = setup("/clientes");
    await screen.findByRole("button", { name: "Ana Teste" });
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Página 2 de 2");
    await screen.findByRole("button", { name: "Cliente 23" });
    await user.click(screen.getByRole("button", { name: /Novo cliente/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Novo cliente" }));
    expect(dialog.queryByRole("button", { name: "Pedidos", exact: true })).toBeNull();
    await user.type(dialog.getByLabelText("Nome / Razão social *"), "Novo cliente teste");
    await user.type(dialog.getByLabelText("CPF / CNPJ *"), "52998224725");
    await user.type(dialog.getByLabelText("Telefone / WhatsApp *"), "11999990000");
    await user.dblClick(dialog.getByRole("button", { name: "Salvar cliente" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const writes = api.calls.filter((c) => c.path === "/cli" && c.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0].body.pardes).toBe("Novo cliente teste");
  });
  it("edita cadastro e rejeita cidade digitada sem seleção válida", async () => {
    const { api, user } = setup("/clientes");
    const dialog = within(await openAna(user));
    const city = dialog.getByLabelText("Cidade / UF");
    await user.clear(city);
    await user.type(city, "Cidade inexistente");
    await user.click(dialog.getByRole("button", { name: "Salvar cliente" }));
    await screen.findByText("Selecione uma cidade válida da lista.");
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
    await user.clear(city);
    await user.type(city, "São Paulo - SP");
    const name = dialog.getByLabelText("Nome / Razão social *");
    await user.clear(name);
    await user.type(name, "Ana Atualizada");
    await user.click(dialog.getByRole("button", { name: "Salvar cliente" }));
    await screen.findByRole("button", { name: "Ana Atualizada" });
    expect(api.calls.find((c) => c.path === "/cli/1" && c.method === "PUT").body.parmuncod).toBe(1);
  });
  it("carrega os itens do pedido dentro da autorização do cliente e vincula outro pedido", async () => {
    const { api, user } = setup("/clientes");
    const dialog = within(await openAna(user));
    await user.click(dialog.getByRole("button", { name: "Pedidos", exact: true }));
    await user.click(await dialog.findByRole("button", { name: "Ver detalhes #10" }));
    await dialog.findByText("Tela de demonstração");
    expect(api.calls.some((c) => c.path === "/cli/1/pedidos/10/itens")).toBe(true);
    await user.click(dialog.getByRole("button", { name: "Vincular pedido", exact: true }));
    await user.click(await dialog.findByRole("button", { name: "Vincular #11" }));
    await dialog.findByText("Pedido vinculado.");
    expect(api.calls.some((c) => c.path === "/cli/1/pedidos/11" && c.method === "POST")).toBe(true);
  });
  it("registra lançamento e cobrança sem compensar crédito automaticamente", async () => {
    const { api, user } = setup("/clientes");
    const dialog = within(await openAna(user));
    await user.click(dialog.getByRole("button", { name: "Conta", exact: true }));
    await user.click(dialog.getByRole("button", { name: "Novo lançamento" }));
    await user.type(dialog.getByLabelText("Valor do lançamento"), "25.50");
    await user.click(dialog.getByRole("button", { name: "Registrar lançamento" }));
    await dialog.findByText("Movimentação registrada.");
    expect(api.calls.find((c) => c.method === "POST").body).toMatchObject({
      tipo: "CREDITO",
      valor: 25.5,
    });
    await user.click(dialog.getByRole("button", { name: "Cobranças", exact: true }));
    await user.click(dialog.getByRole("button", { name: "Nova cobrança" }));
    await user.type(dialog.getByLabelText("Valor da cobrança"), "90");
    await user.click(dialog.getByRole("button", { name: "Gerar cobrança" }));
    await dialog.findByText("Cobrança criada.");
    expect(
      api.calls.filter((c) => c.path.endsWith("/movimentacoes") && c.method === "POST")
    ).toHaveLength(1);
    expect(
      api.calls.find((c) => c.path.endsWith("/cobrancas") && c.method === "POST").body.cobvalor
    ).toBe(90);
  });
  it("registra pagamento e atualiza o resumo; cancelamento exige confirmação", async () => {
    const { api, user } = setup("/clientes");
    const dialog = within(await openAna(user));
    await user.click(dialog.getByRole("button", { name: "Cobranças", exact: true }));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(await dialog.findByRole("button", { name: "Cancelar", exact: true }));
    expect(api.calls.some((c) => c.method === "PUT")).toBe(false);
    window.confirm.mockReturnValue(true);
    await user.click(dialog.getByRole("button", { name: "Registrar pagamento" }));
    await dialog.findByText("Pago");
    expect(
      api.calls.some((c) => c.path === "/cli/1/cobrancas/1/baixar" && c.method === "PUT")
    ).toBe(true);
    await waitFor(() => expect(dialog.getByText(/R\$\s*0,00/)).toBeTruthy());
  });
});
describe("Dashboard", () => {
  it("aplica filtros, preserva seleção entre rotas e envia todos explicitamente", async () => {
    const { api, user } = setup();
    await screen.findByRole("heading", { name: /Bem-vindo/ });
    await user.selectOptions(screen.getByLabelText("Período"), "todos");
    await user.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    await waitFor(() =>
      expect(
        api.calls.some((c) => c.path === "/v2/top/produtos/mes" && c.query.get("todos") === "1")
      ).toBe(true)
    );
    await user.click(screen.getByRole("link", { name: "Clientes", exact: true }));
    await screen.findByRole("button", { name: "Ana Teste" });
    await user.click(screen.getByRole("link", { name: "Dashboard", exact: true }));
    await waitFor(() => expect(screen.getByLabelText("Período").value).toBe("todos"));
  });
  it("rejeita intervalo invertido sem buscar indicadores com datas inválidas", async () => {
    const { api, user } = setup();
    await screen.findByRole("heading", { name: /Bem-vindo/ });
    await user.selectOptions(screen.getByLabelText("Período"), "personalizado");
    await user.type(screen.getByLabelText("Data inicial"), "2026-09-30");
    await user.type(screen.getByLabelText("Data final"), "2026-09-01");
    await user.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    await screen.findByRole("alert");
    expect(api.calls.some((c) => c.query.get("dataInicio") === "2026-09-30")).toBe(false);
  });
});
