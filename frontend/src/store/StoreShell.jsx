import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useResource } from "../hooks/useResource.js";
import { useCart } from "./CartContext.jsx";

export default function StoreShell() {
  const company = useResource("/emp"), cart = useCart(), location = useLocation();
  const [theme, setTheme] = useState(() => window.OrderUpTheme?.get() || "light"), [menu, setMenu] = useState(false), [logoAvailable, setLogoAvailable] = useState(true);
  useEffect(() => { const title = location.pathname.includes("carrinho") ? "Carrinho" : location.pathname.includes("catalogo") ? "Catálogo" : "Loja"; document.title = `${title} · ${company.data?.emprazao || "OrderUp"}`; window.scrollTo(0, 0); setMenu(false); }, [location.pathname, company.data]);
  const companyName = company.data?.emprazao || "OrderUp";
  return <div className="store-shell"><header className="store-header"><div className="store-header__inner"><Link className="store-brand" to="/">{logoAvailable ? <img src="/uploads/logo.jpg" alt="" onError={() => setLogoAvailable(false)}/> : <span className="store-brand__fallback" aria-hidden="true">{companyName.slice(0, 1).toUpperCase()}</span>}<span><strong>{companyName}</strong><small>Peças e acessórios</small></span></Link><button className="store-menu-button" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>☰</button><nav className={menu ? "is-open" : ""} aria-label="Loja"><NavLink to="/">Início</NavLink><NavLink to="/catalogo">Catálogo</NavLink><a href="/app/">Painel</a></nav><div className="store-tools"><select aria-label="Tema" value={theme} onChange={(e) => { window.OrderUpTheme?.set(e.target.value); setTheme(e.target.value); }}><option value="light">Claro</option><option value="dark">Escuro</option><option value="auto">Automático</option></select><Link className="store-cart-link" to="/carrinho" aria-label={`Carrinho com ${cart.count} item(ns)`}>Carrinho <span>{cart.count}</span></Link></div></div></header><main className="store-main"><Outlet/></main><footer className="store-footer"><strong>{companyName}</strong><span>Catálogo atualizado em tempo real.</span></footer></div>;
}
