import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorState, Loading } from "../../components/UI.jsx";
import { useResource } from "../../hooks/useResource.js";
import StoreProductCard from "../StoreProductCard.jsx";

export default function StoreHomePage() {
  const brands = useResource("/marcas"), showcases = useResource("/showcases"), navigate = useNavigate(), [search, setSearch] = useState("");
  return <div className="store-stack"><section className="store-hero"><div><span>CATÁLOGO ONLINE</span><h1>Encontre a peça certa para o seu aparelho</h1><p>Consulte disponibilidade, promoções e monte seu pedido em poucos passos.</p><form className="store-search" onSubmit={(e) => { e.preventDefault(); navigate(`/catalogo?q=${encodeURIComponent(search.trim())}`); }}><input aria-label="Buscar no catálogo" placeholder="Busque por peça, modelo ou marca" value={search} onChange={(e) => setSearch(e.target.value)}/><button className="button">Buscar</button></form></div><div className="store-hero__art" aria-hidden="true"><span>▦</span><strong>Peças</strong><small>para diversos modelos</small></div></section>
    <section className="store-section"><div className="store-section__head"><div><span>COMECE PELA MARCA</span><h2>Escolha uma marca</h2></div><Link to="/catalogo">Ver catálogo completo</Link></div>{brands.error ? <ErrorState error={brands.error} retry={brands.reload}/> : brands.data === null ? <Loading/> : <div className="brand-grid">{brands.data.map((brand) => <Link className="brand-card" key={brand.marcascod} to={`/catalogo?marca=${brand.marcascod}`}><span>{String(brand.marcasdes || "M").slice(0, 1)}</span><strong>{brand.marcasdes}</strong><small>Ver peças →</small></Link>)}</div>}</section>
    {showcases.error ? null : showcases.data === null ? <Loading/> : (showcases.data.showcases || []).map((showcase) => <section className="store-section" key={`${showcase.type}-${showcase.title}`}><div className="store-section__head"><div><span>SELEÇÃO DA LOJA</span><h2>{showcase.title}</h2></div><Link to="/catalogo">Explorar mais</Link></div><div className="showcase-track">{showcase.items.map((product) => <StoreProductCard compact key={product.procod} product={product}/>)}</div></section>)}
  </div>;
}
