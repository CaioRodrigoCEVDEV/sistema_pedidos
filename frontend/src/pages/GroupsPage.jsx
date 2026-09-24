import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { useResource } from "../hooks/useResource.js";
import { Field, Modal, Resource, useAction } from "../components/UI.jsx";
import { date, money } from "../lib/format.js";

function GroupSheet({ group, onClose, onChange }) {
  const action = useAction();
  const [revision, setRevision] = useState(0), [tab, setTab] = useState("parts"), [search, setSearch] = useState("");
  const detail = useResource(`/part-groups/${group.id}`, revision);
  const colors = useResource("/cores");
  const audit = useResource(tab === "audit" ? `/part-groups/${group.id}/audit` : null, revision);
  const available = useResource(tab === "add" ? `/part-groups/available-part?page=1&limit=30&search=${encodeURIComponent(search)}` : null, revision);
  const mutate = (path, options, message) => action.run(async () => { await apiRequest(path, options); setRevision((n) => n + 1); onChange(); }, message);
  return <Modal wide title={group.name} onClose={onClose} busy={action.busy}>{action.feedback}<Resource resource={detail}>{(data) => <>
    <div className="summary-grid"><div><span>Estoque compartilhado</span><strong>{data.stock_quantity}</strong></div><div><span>Custo</span><strong>{money(data.grpcusto)}</strong></div><div><span>Variações</span><strong>{data.parts.length}</strong></div></div>
    <div className="tabs"><button className={tab === "parts" ? "active" : ""} onClick={() => setTab("parts")}>Peças</button><button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Dados</button><button className={tab === "add" ? "active" : ""} onClick={() => setTab("add")}>Adicionar</button><button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>Estoque</button><button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Histórico</button></div>
    {tab === "parts" && (data.parts.length ? <div className="record-list">{data.parts.map((p) => <article className="record" key={p.procorid}><div><strong>{p.prodes}</strong><p>{p.marcasdes} · {p.tipodes} · {p.cornome || "Sem cor"}</p></div><button className="text-button error-text" disabled={action.busy} onClick={() => window.confirm(`Remover ${p.prodes} do grupo?`) && mutate(`/part-groups/parts/${p.procorid}`, { method: "DELETE" }, "Peça removida.")}>Remover</button></article>)}</div> : <p className="empty-state">Nenhuma peça vinculada.</p>)}
    {tab === "data" && <GroupDataForm data={data} colors={colors.data || []} busy={action.busy} mutate={mutate}/>} 
    {tab === "add" && <div className="page-stack"><Field label="Buscar peça" value={search} onChange={(e) => setSearch(e.target.value)}/><Resource resource={available}>{(result) => <div className="record-list">{result.data.map((p) => <article className="record" key={p.procod}><div><strong>#{p.procod} · {p.prodes}</strong><p>{p.marcasdes} · {p.tipodes}</p></div>{p.has_colors ? <div className="row">{p.colors.map((c) => <button className="button secondary" key={c.procorid} disabled={action.busy} onClick={() => mutate(`/part-groups/${group.id}/parts`, { method: "POST", json: { procorid: c.procorid } }, `${c.cornome} adicionada.`)}>{c.cornome}</button>)}</div> : <button className="button secondary" disabled={action.busy} onClick={() => mutate(`/part-groups/${group.id}/parts`, { method: "POST", json: { procod: p.procod } }, "Peça adicionada.")}>Adicionar</button>}</article>)}</div>}</Resource></div>}
    {tab === "stock" && <StockForm data={data} busy={action.busy} mutate={mutate}/>} 
    {tab === "audit" && <Resource resource={audit}>{(rows) => rows.length ? <div className="record-list">{rows.map((a) => <article className="record" key={a.id}><div><strong>{Number(a.change) > 0 ? "+" : ""}{a.change}</strong><p>{a.reason}{a.part_name ? ` · ${a.part_name}` : ""}</p></div><span>{date(a.created_at)}</span></article>)}</div> : <p className="empty-state">Sem movimentações.</p>}</Resource>}
  </>}</Resource></Modal>;
}
function GroupDataForm({ data, colors, busy, mutate }) {
  const [form, setForm] = useState({ name: data.name, colorId: data.color_id || "" });
  return <form className="inset-panel" onSubmit={(e) => { e.preventDefault(); mutate(`/part-groups/${data.id}`, { method: "PUT", json: { name: form.name, stock_quantity: Number(data.stock_quantity), colorId: form.colorId || null } }, "Grupo atualizado."); }}><fieldset disabled={busy}><div className="form-grid"><Field label="Nome do grupo" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><Field label="Cor do grupo"><select value={form.colorId} onChange={(e) => setForm({ ...form, colorId: e.target.value })}><option value="">Sem cor específica</option>{colors.map((c) => <option value={c.corcod} key={c.corcod}>{c.cornome}</option>)}</select></Field></div><div className="form-actions"><button className="button">Salvar dados</button></div></fieldset></form>;
}
function StockForm({ data, busy, mutate }) {
  const [form, setForm] = useState({ stock: data.stock_quantity, cost: data.grpcusto || "", ideal: data.qtde_ideal || "", reason: "Ajuste manual" });
  return <form className="inset-panel" onSubmit={(e) => { e.preventDefault(); mutate(`/part-groups/${data.id}/stock`, { method: "PUT", json: { stock_quantity: Number(form.stock), cost: form.cost === "" ? null : Number(form.cost), reason: form.reason } }, "Estoque atualizado."); }}><fieldset disabled={busy}><div className="form-grid"><Field label="Quantidade" type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}/><Field label="Custo" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}/><Field label="Motivo" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}/></div><div className="form-actions"><button className="button">Atualizar estoque</button></div></fieldset></form>;
}

export default function GroupsPage() {
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState(null), [name, setName] = useState("");
  const resource = useResource("/part-groups", revision), action = useAction();
  async function create(event) { event.preventDefault(); await action.run(async () => { await apiRequest("/part-groups", { method: "POST", json: { name } }); setName(""); setRevision((n) => n + 1); }, "Grupo criado."); }
  async function remove(g) { if (!window.confirm(`Excluir o grupo ${g.name}? As peças serão desvinculadas.`)) return; await action.run(async () => { await apiRequest(`/part-groups/${g.id}`, { method: "DELETE" }); setRevision((n) => n + 1); }, "Grupo excluído."); }
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">CATÁLOGO</p><h1>Grupos de compatibilidade</h1><p>Compartilhe estoque entre peças e variações equivalentes.</p></div></div>{action.feedback}<section className="panel"><form className="search-bar" onSubmit={create}><input aria-label="Nome do novo grupo" required placeholder="Nome do novo grupo" value={name} onChange={(e) => setName(e.target.value)}/><button className="button" disabled={action.busy}>Criar grupo</button></form><Resource resource={resource}>{(groups) => groups.length ? <div className="record-list">{groups.map((g) => <article className="record" key={g.id}><div><strong>{g.name}</strong><p>{g.parts_count} variação(ões) · Estoque {g.stock_quantity}{g.color_name ? ` · ${g.color_name}` : ""}</p></div><div className="record-actions"><button className="button secondary" onClick={() => setSelected(g)}>Gerenciar</button><button className="text-button error-text" onClick={() => remove(g)}>Excluir</button></div></article>)}</div> : <p className="empty-state">Nenhum grupo cadastrado.</p>}</Resource></section>{selected && <GroupSheet group={selected} onClose={() => setSelected(null)} onChange={() => setRevision((n) => n + 1)}/>}</div>;
}
