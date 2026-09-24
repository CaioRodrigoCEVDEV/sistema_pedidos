import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ErrorState, Loading } from "../../components/UI.jsx";
import { useResource } from "../../hooks/useResource.js";
import StoreProductCard from "../StoreProductCard.jsx";

export default function StoreCatalogPage() {
  const [params, setParams] = useSearchParams();
  const brands = useResource("/marcas"), models = useResource("/modelos"), types = useResource("/tipos");
  const page = Math.max(Number(params.get("page") || 1), 1), q = params.get("q") || "", brand = params.get("marca") || "", model = params.get("modelo") || "", type = params.get("tipo") || "";
  const [search, setSearch] = useState(q);
  const query = new URLSearchParams({ page: String(page), pageSize: "24" }); if (q) query.set("q", q); if (brand) query.set("marca", brand); if (model) query.set("modelo", model); if (type) query.set("tipo", type);
  const products = useResource(`/pros?${query}`);
  const availableModels = useMemo(() => (models.data || []).filter((item) => !brand || String(item.modmarcascod) === brand), [models.data, brand]);
  const set = (key, value, resetPage = true) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (resetPage) next.delete("page"); if (key === "marca") next.delete("modelo"); setParams(next); };
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => { if (search === q) return; const timer = setTimeout(() => set("q", search), 300); return () => clearTimeout(timer); }, [search, q]);
  const payload = products.data || { data: [], total: 0, page: 1, pageSize: 24 }, rows = Array.isArray(payload) ? payload : payload.data || [], pages = Math.max(Math.ceil(Number(payload.total || rows.length) / Number(payload.pageSize || 24)), 1);
  return <div className="store-stack"><div className="store-page-heading"><div><span>LOJA</span><h1>Catálogo de peças</h1><p>Use os filtros para encontrar rapidamente o produto desejado.</p></div></div><section className="store-catalog-layout"><aside className="store-filters"><h2>Filtros</h2><label>Buscar<input placeholder="Nome da peça" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label>Marca<select value={brand} onChange={(e) => set("marca", e.target.value)}><option value="">Todas</option>{(brands.data || []).map((item) => <option key={item.marcascod} value={item.marcascod}>{item.marcasdes}</option>)}</select></label><label>Modelo<select value={model} onChange={(e) => set("modelo", e.target.value)}><option value="">Todos</option>{availableModels.map((item) => <option key={item.modcod} value={item.modcod}>{item.moddes}</option>)}</select></label><label>Tipo<select value={type} onChange={(e) => set("tipo", e.target.value)}><option value="">Todos</option>{(types.data || []).map((item) => <option key={item.tipocod} value={item.tipocod}>{item.tipodes}</option>)}</select></label><button className="button secondary" onClick={() => { setSearch(""); setParams({}); }}>Limpar filtros</button></aside><div className="store-results"><div className="store-results__head"><strong>{Number(payload.total || rows.length)} produto(s)</strong></div>{products.error ? <ErrorState error={products.error} retry={products.reload}/> : products.data === null ? <Loading/> : rows.length ? <div className="product-grid">{rows.map((product) => <StoreProductCard key={product.procod} product={product}/>)}</div> : <div className="store-empty"><span>⌕</span><h2>Nenhuma peça encontrada</h2><p>Ajuste os filtros e tente novamente.</p></div>} {pages > 1 && <div className="pagination"><button className="button secondary" disabled={page <= 1} onClick={() => set("page", String(page - 1), false)}>Anterior</button><span>Página {page} de {pages}</span><button className="button secondary" disabled={page >= pages} onClick={() => set("page", String(page + 1), false)}>Próxima</button></div>}</div></section></div>;
}
