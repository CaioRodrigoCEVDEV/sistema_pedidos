import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useSession } from "../state/Session.jsx";
import { canAccess, navigation } from "../lib/navigation.js";
import { apiRequest } from "../api/client.js";
import { useResource } from "../hooks/useResource.js";
import { useAction } from "./UI.jsx";
import { NewsButton, MaintenanceNotice } from "./Notices.jsx";
export default function Shell() {
  const session = useSession(),
    action = useAction(),
    location = useLocation(),
    company = useResource("/emp");
  const [open, setOpen] = useState(false),
    [theme, setTheme] = useState(() => window.OrderUpTheme?.get() || "light");
  const mainRef = useRef(null);
  const title = location.pathname.startsWith("/clientes")
    ? "Clientes"
    : location.pathname === "/dashboard"
      ? "Dashboard"
      : ({
          "/produtos": "Produtos",
          "/promocoes": "Promoções",
          "/grupos": "Grupos",
          "/vitrines": "Vitrines",
          "/pedidos": "Pedidos",
          "/devolucoes": "Devoluções",
          "/estoque": "Estoque",
          "/estoque-grupos": "Estoque Grupos",
          "/relatorios": "Relatórios",
          "/backup": "Backups",
          "/users": "Usuários",
          "/configuracoes": "Configurações",
          "/perfil": "Meu perfil",
        }[location.pathname] || "Painel");
  useEffect(() => {
    document.title = `${title} · OrderUp`;
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [location.pathname, title]);
  useEffect(() => {
    const update = () => setTheme(window.OrderUpTheme?.get() || "light");
    window.addEventListener("ou:themechange", update);
    return () => window.removeEventListener("ou:themechange", update);
  }, []);
  async function logout() {
    await action.run(async () => {
      await apiRequest("/auth/sair");
      session.clear();
    }, "");
  }
  const name = session.user.usunome || "Usuário";
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        id="menu-principal"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <Link className="sidebar-brand" to="/" onClick={() => setOpen(false)}>
          <span className="brand-mark">O</span>
          <span>
            OrderUp<small>{company.data?.emprazao || "Sistema de pedidos"}</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        >
          ×
        </button>
        <nav aria-label="Menu principal">
          {navigation.map((group) => {
            const items = group.items.filter((item) =>
              canAccess(session.permissions, item.key)
            );
            return (
              items.length > 0 && (
                <div className="nav-group" key={group.title}>
                  <p>{group.title}</p>
                  {items.map((item) => {
                    const content = (
                      <>
                        <span className="nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.label}
                      </>
                    );
                    return item.to ? (
                      <NavLink key={item.key} to={item.to} onClick={() => setOpen(false)}>
                        {content}
                      </NavLink>
                    ) : (
                      <a key={item.href} href={item.href}>
                        {content}
                      </a>
                    );
                  })}
                </div>
              )
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>Gestão da sua loja</span>
          <button onClick={logout} disabled={action.busy}>
            Sair da conta ↪
          </button>
        </div>
      </aside>
      {open && (
        <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-toggle icon-button"
              aria-expanded={open}
              aria-controls="menu-principal"
              onClick={() => setOpen(!open)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <span>{title}</span>
          </div>
          <div className="row">
            <NewsButton />
            <label className="theme-label">
              Tema{" "}
              <select
                aria-label="Tema"
                value={theme}
                onChange={(e) => {
                  window.OrderUpTheme?.set(e.target.value);
                  setTheme(e.target.value);
                }}
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
                <option value="auto">Automático</option>
              </select>
            </label>
            <span className="avatar" aria-hidden="true">
              {name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </span>
            <span className="user-name">{name}</span>
          </div>
        </header>
        <main id="conteudo" ref={mainRef} tabIndex={-1}>
          {action.feedback}
          <MaintenanceNotice />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
