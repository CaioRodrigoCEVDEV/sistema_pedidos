import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("fase 3 · catálogo", () => {
  it("lista produtos e mantém a navegação dentro do React", async () => {
    const { user } = setup("/produtos");
    await screen.findByText(/Tela teste/);
    await user.click(screen.getByRole("link", { name: "Promoções", exact: true }));
    await screen.findByRole("heading", { name: "Promoções" });
    expect(screen.getByText("10%")).toBeTruthy();
  });
  it("cria um grupo e abre a gestão das peças", async () => {
    const { api, user } = setup("/grupos");
    await screen.findByText("Telas compatíveis");
    await user.type(screen.getByLabelText("Nome do novo grupo"), "Baterias compatíveis");
    await user.click(screen.getByRole("button", { name: "Criar grupo" }));
    expect(api.calls.some((c) => c.path === "/part-groups" && c.method === "POST")).toBe(true);
    await user.click(screen.getAllByRole("button", { name: "Gerenciar" })[0]);
    await screen.findByRole("dialog", { name: "Telas compatíveis" });
    expect(screen.getByText("Tela teste")).toBeTruthy();
  });
  it("carrega vitrines e altera o status pela API administrativa", async () => {
    const { api, user } = setup("/vitrines");
    await screen.findByRole("heading", { name: "Vitrines" });
    await user.selectOptions(await screen.findByLabelText("Situação"), "false");
    expect(api.calls.some((c) => c.path === "/showcases/admin/1" && c.method === "PUT")).toBe(true);
  });
});
