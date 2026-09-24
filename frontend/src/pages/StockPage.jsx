import { useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";
import { normalize } from "../lib/format.js";

const statusOptions = [
  ["todos", "Todos os saldos"], ["estoque", "Em estoque"], ["zerado", "Fora de estoque"],
  ["acabando", "Estoque acabando"], ["falta", "Em falta"],
];

function stockTone(quantity) {
  const value = Number(quantity || 0);
  return value <= 0 ? "danger" : value < 10 ? "warning" : "success";
}

function StockAdjustment({ item, onClose, onSaved }) {
  const action = useAction();
  const [operation, setOperation] = useState("add"), [quantity, setQuantity] = useState("1"), [reason, setReason] = useState("Ajuste manual");
  async function submit(event) {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) return;
    const ok = await action.run(() => apiRequest(`/api/estoque/itens/${item.procod}/ajustar`, {
      method: "POST", json: { delta: operation === "add" ? amount : -amount, cor: item.procorcorescod || null, motivo: reason.trim() },
    }), "Estoque atualizado.");
    if (ok) onSaved();
  }
  return <Modal title={`Ajustar estoque · ${item.prodes}`} onClose={onClose} busy={action.busy}>
    {action.feedback}
    <div className="summary-grid stock-summary"><div><span>Variação</span><strong>{item.cordes || "Sem cor"}</strong></div><div><span>Saldo atual</span><strong>{Number(item.qtde || 0)}</strong></div></div>
    <form onSubmit={submit}><fieldset disabled={action.busy}><div className="form-grid">
      <Field label="Operação"><select value={operation} onChange={(e) => setOperation(e.target.value)}><option value="add">Entrada</option><option value="remove">Saída</option></select></Field>
      <Field label="Quantidade" type="number" min="1" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)}/>
      <Field label="Motivo" required maxLength="120" value={reason} onChange={(e) => setReason(e.target.value)}/>
    </div><p className="muted">O ajuste será aplicado ao grupo inteiro quando esta variação usar estoque compartilhado.</p><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Voltar</button><button className="button">Salvar ajuste</button></div></fieldset></form>
  </Modal>;
}

export default function StockPage() {
  const [revision, setRevision] = useState(0), [filters, setFilters] = useState({ q: "", brand: "", model: "", status: "todos" }), [selected, setSelected] = useState(null);
  const resource = useResource(`/api/estoque/itens?status=${filters.status}`, revision);
  const brands = useResource("/marcas"), models = useResource("/modelos");
  const rows = useMemo(() => (resource.data || []).filter((item) => {
    const haystack = normalize([item.procod, item.prodes, item.marcasdes, item.moddes, item.tipodes, item.cordes].join(" "));
    return (!filters.q || haystack.includes(normalize(filters.q))) && (!filters.brand || item.marcasdes === filters.brand) && (!filters.model || String(item.moddes || "").split(", ").includes(filters.model));
  }), [resource.data, filters]);
  function saved() { setSelected(null); setRevision((n) => n + 1); }
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">OPERAÇÕES</p><h1>Estoque</h1><p>Consulte saldos e registre entradas ou saídas por variação.</p></div></div>
    <section className="panel"><div className="filter-bar">
      <Field label="Buscar" value={filters.q} placeholder="Código, peça, marca, modelo ou cor" onChange={(e) => setFilters({ ...filters, q: e.target.value })}/>
      <Field label="Marca"><select value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value, model: "" })}><option value="">Todas</option>{(brands.data || []).map((brand) => <option key={brand.marcascod} value={brand.marcasdes}>{brand.marcasdes}</option>)}</select></Field>
      <Field label="Modelo"><select value={filters.model} onChange={(e) => setFilters({ ...filters, model: e.target.value })}><option value="">Todos</option>{(models.data || []).map((model) => <option key={model.modcod} value={model.moddes}>{model.moddes}</option>)}</select></Field>
      <Field label="Situação"><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    </div></section>
    <section className="panel"><div className="section-heading"><div><h2>Peças e variações</h2><p className="muted">{rows.length} resultado(s)</p></div></div>
      <Resource resource={resource}>{() => rows.length ? <div className="table-scroll"><table className="operations-table stock-table"><thead><tr><th>Peça</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>Cor</th><th>Saldo</th><th>Ação</th></tr></thead><tbody>{rows.map((item, index) => <tr key={`${item.procod}-${item.procorcorescod ?? `none-${index}`}`}><td><strong>{item.prodes}</strong><small>Cód. {item.procod}</small></td><td>{item.marcasdes || "—"}</td><td>{item.moddes || "—"}</td><td>{item.tipodes || "—"}</td><td>{item.cordes || "Sem cor"}</td><td><Status tone={stockTone(item.qtde)}>{Number(item.qtde || 0)}</Status></td><td><button className="button secondary" onClick={() => setSelected(item)}>Ajustar</button></td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhuma peça encontrada com esses filtros.</p>}</Resource>
    </section>
    {selected && <StockAdjustment item={selected} onClose={() => setSelected(null)} onSaved={saved}/>} 
  </div>;
}
