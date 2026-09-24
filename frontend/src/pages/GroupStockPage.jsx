import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";
import { date } from "../lib/format.js";

function stockStatus(stock, ideal) {
  if (ideal === null || ideal === undefined) return { label: "Sem ideal", tone: "neutral" };
  return Number(stock) >= Number(ideal) ? { label: "Adequado", tone: "success" } : { label: "Abaixo do ideal", tone: "danger" };
}

function History({ group, onClose }) {
  const resource = useResource(`/api/estoque-grupos/${group.id}/historico`);
  return <Modal wide title={`Movimentações · ${group.grupo}`} onClose={onClose}><Resource resource={resource}>{(rows) => rows.length ? <div className="record-list">{rows.map((row) => <article className="record" key={row.id}><div><strong>{Number(row.change) > 0 ? "+" : ""}{row.change}</strong><p>{row.reason || "Movimentação"}{row.reference_id ? ` · ${row.reference_id}` : ""}</p></div><span>{date(row.created_at)}</span></article>)}</div> : <p className="empty-state">Nenhuma movimentação registrada.</p>}</Resource></Modal>;
}

function GroupRow({ group, onChanged, openHistory }) {
  const [ideal, setIdeal] = useState(group.qtde_ideal ?? ""), [amount, setAmount] = useState(""), [operation, setOperation] = useState("add");
  const action = useAction(), status = stockStatus(group.estoque_atual, group.qtde_ideal);
  async function saveIdeal() {
    await action.run(async () => { await apiRequest(`/api/estoque-grupos/${group.id}/ideal`, { method: "PUT", json: { qtde_ideal: ideal === "" ? null : Number(ideal) } }); onChanged(); }, "Quantidade ideal atualizada.");
  }
  async function adjust() {
    const quantity = Number(amount); if (!Number.isInteger(quantity) || quantity <= 0) return;
    const ok = await action.run(async () => { await apiRequest(`/api/estoque-grupos/${group.id}/ajustar`, { method: "POST", json: { delta: operation === "add" ? quantity : -quantity, reason: operation === "add" ? "Reposição de estoque" : "Redução de estoque" } }); onChanged(); }, "Estoque do grupo atualizado.");
    if (ok) setAmount("");
  }
  return <tr><td><strong>{group.grupo}</strong><small><button className="text-button" onClick={() => openHistory(group)}>Ver histórico</button></small>{action.feedback}</td><td>{Number(group.qtde_vendida || 0)}</td><td><strong>{Number(group.estoque_atual || 0)}</strong></td><td><div className="inline-control"><input aria-label={`Quantidade ideal de ${group.grupo}`} type="number" min="0" value={ideal} onChange={(e) => setIdeal(e.target.value)}/><button className="button secondary" disabled={action.busy} onClick={saveIdeal}>Salvar</button></div></td><td><Status tone={status.tone}>{status.label}</Status></td><td><div className="inline-control stock-adjust"><select aria-label={`Operação de ${group.grupo}`} value={operation} onChange={(e) => setOperation(e.target.value)}><option value="add">Entrada</option><option value="remove">Saída</option></select><input aria-label={`Ajuste de ${group.grupo}`} type="number" min="1" placeholder="Qtd." value={amount} onChange={(e) => setAmount(e.target.value)}/><button className="button" disabled={action.busy || !amount} onClick={adjust}>Aplicar</button></div></td></tr>;
}

export default function GroupStockPage() {
  const [form, setForm] = useState({ start: "", end: "", brand: "" }), [filters, setFilters] = useState(form), [revision, setRevision] = useState(0), [history, setHistory] = useState(null);
  const params = new URLSearchParams(); if (filters.start) params.set("dataInicio", filters.start); if (filters.end) params.set("dataFim", filters.end); if (filters.brand) params.set("marca", filters.brand);
  const resource = useResource(`/api/estoque-grupos?${params}`, revision), brands = useResource("/marcas");
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">OPERAÇÕES</p><h1>Estoque por grupos</h1><p>Acompanhe demanda e ajuste o saldo compartilhado entre peças compatíveis.</p></div></div>
    <section className="panel"><form className="filter-bar" onSubmit={(e) => { e.preventDefault(); setFilters(form); }}><Field label="De" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}/><Field label="Até" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}/><Field label="Marca"><select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}><option value="">Todas</option>{(brands.data || []).map((brand) => <option key={brand.marcascod} value={brand.marcascod}>{brand.marcasdes}</option>)}</select></Field><button className="button">Filtrar</button><button type="button" className="button secondary" onClick={() => { const empty = { start: "", end: "", brand: "" }; setForm(empty); setFilters(empty); }}>Limpar</button></form></section>
    <section className="panel"><div className="section-heading"><div><h2>Grupos de compatibilidade</h2><p className="muted">Alterações são distribuídas para todas as peças do grupo.</p></div></div><Resource resource={resource}>{(groups) => groups.length ? <div className="table-scroll"><table className="operations-table group-stock-table"><thead><tr><th>Grupo</th><th>Vendida</th><th>Saldo</th><th>Quantidade ideal</th><th>Situação</th><th>Ajuste rápido</th></tr></thead><tbody>{groups.map((group) => <GroupRow key={group.id} group={group} onChanged={() => setRevision((n) => n + 1)} openHistory={setHistory}/>)}</tbody></table></div> : <p className="empty-state">Nenhum grupo com vendas encontrado neste período.</p>}</Resource></section>
    {history && <History group={history} onClose={() => setHistory(null)}/>} 
  </div>;
}
