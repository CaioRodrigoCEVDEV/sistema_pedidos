import { useState } from "react";
import { Field, Resource } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";

function query(filters) {
  const params = new URLSearchParams({ groupBy: filters.groupBy });
  if (filters.start) params.set("dataInicio", filters.start);
  if (filters.end) params.set("dataFim", filters.end);
  if (filters.brand) params.set("marca", filters.brand);
  return params.toString();
}

export default function ReportsPage() {
  const empty = { start: "", end: "", brand: "", groupBy: "peca" };
  const [form, setForm] = useState(empty), [filters, setFilters] = useState(empty);
  const brands = useResource("/marcas");
  const rows = useResource(`/v2/relatorios/top-pecas?${query(filters)}`);
  const [parts, setParts] = useState({ brand: "", model: "", type: "", name: "" });
  const models = useResource(parts.brand ? `/modelo/${parts.brand}` : null);
  const types = useResource("/tipos");
  const exportUrl = (format) => `/v2/relatorios/top-pecas/${format}?${query(filters)}`;
  const partsParams = new URLSearchParams();
  if (parts.brand) partsParams.set("marca", parts.brand);
  if (parts.model) partsParams.set("modelo", parts.model);
  if (parts.type) partsParams.set("tipo", parts.type);
  if (parts.name.trim()) partsParams.set("peca", parts.name.trim());
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">ANÁLISE</p><h1>Relatórios</h1><p>Consulte as peças mais vendidas e gere arquivos para conferência.</p></div></div>
    <section className="panel"><div className="section-heading"><div><h2>Peças mais vendidas</h2><p className="muted">Filtre o período e escolha como os resultados serão agrupados.</p></div><div className="row"><a className="button secondary" href={exportUrl("pdf")} target="_blank" rel="noreferrer">Baixar PDF</a><a className="button secondary" href={exportUrl("xls")} download>Baixar Excel</a></div></div>
      <form className="filter-bar" onSubmit={(e) => { e.preventDefault(); setFilters(form); }}><Field label="De" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}/><Field label="Até" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}/><Field label="Marca"><select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}><option value="">Todas</option>{(brands.data || []).map((b) => <option key={b.marcascod} value={b.marcascod}>{b.marcasdes}</option>)}</select></Field><Field label="Agrupar por"><select value={form.groupBy} onChange={(e) => setForm({ ...form, groupBy: e.target.value })}><option value="peca">Peça</option><option value="grupo">Grupo</option></select></Field><button className="button">Filtrar</button><button type="button" className="button secondary" onClick={() => { setForm(empty); setFilters(empty); }}>Limpar</button></form>
      <Resource resource={rows}>{(data) => data.length ? <div className="table-scroll"><table className="operations-table"><thead><tr><th>Tipo</th><th>Marca</th><th>{filters.groupBy === "grupo" ? "Grupo" : "Peça"}</th><th>Quantidade vendida</th><th>Modelo</th><th>{filters.groupBy === "grupo" ? "Peça" : "Grupo"}</th><th>Custo</th></tr></thead><tbody>{data.map((row, index) => <tr key={`${row.peca}-${row.grupo}-${index}`}><td>{row.tipo || "—"}</td><td>{row.marca || "—"}</td><td><strong>{filters.groupBy === "grupo" ? row.grupo || "—" : row.peca || "—"}</strong></td><td>{Number(row.qtde_vendida || 0)}</td><td>{row.modelo || "—"}</td><td>{filters.groupBy === "grupo" ? row.peca || "—" : row.grupo || "—"}</td><td>{row.custo == null ? "—" : Number(row.custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhum registro encontrado.</p>}</Resource>
    </section>
    <section className="panel"><div className="section-heading"><div><h2>Peças cadastradas</h2><p className="muted">Gere um PDF do cadastro usando os filtros desejados.</p></div></div><div className="filter-bar"><Field label="Marca"><select value={parts.brand} onChange={(e) => setParts({ ...parts, brand: e.target.value, model: "" })}><option value="">Todas</option>{(brands.data || []).map((b) => <option key={b.marcascod} value={b.marcascod}>{b.marcasdes}</option>)}</select></Field><Field label="Modelo"><select value={parts.model} disabled={!parts.brand} onChange={(e) => setParts({ ...parts, model: e.target.value })}><option value="">Todos</option>{(models.data || []).map((m) => <option key={m.modcod} value={m.modcod}>{m.moddes}</option>)}</select></Field><Field label="Tipo"><select value={parts.type} onChange={(e) => setParts({ ...parts, type: e.target.value })}><option value="">Todos</option>{(types.data || []).map((t) => <option key={t.tipocod} value={t.tipocod}>{t.tipodes}</option>)}</select></Field><Field label="Peça" value={parts.name} onChange={(e) => setParts({ ...parts, name: e.target.value })}/><a className="button" href={`/v2/relatorios/pecas-cadastradas/pdf?${partsParams}`} target="_blank" rel="noreferrer">Gerar PDF</a></div></section>
  </div>;
}
