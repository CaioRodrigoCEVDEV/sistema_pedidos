import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { useResource } from "../hooks/useResource.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { date, money } from "../lib/format.js";

function Editor({ promotion, onClose, onSaved }) {
  const action = useAction();
  const [search, setSearch] = useState(""), [selected, setSelected] = useState(null);
  const products = useResource(!promotion && search.trim().length >= 2 ? `/pros?page=1&pageSize=20&semPromocao=1&q=${encodeURIComponent(search.trim())}` : null);
  const [form, setForm] = useState(() => ({ tipo: promotion?.promocaotipo || "P", valor: promotion?.promocaovalor || "", dtinicio: promotion?.promocaodtinicio || "", dtfim: promotion?.promocaodtfim || "", ativo: promotion ? Boolean(promotion.promocaoativo) : true }));
  const product = promotion || selected;
  async function submit(event) {
    event.preventDefault();
    if (!product) return;
    await action.run(async () => {
      await apiRequest(promotion ? `/promocoes/${promotion.procod}` : "/promocoes", { method: promotion ? "PUT" : "POST", json: { procod: product.procod, ...form, valor: Number(form.valor), dtinicio: form.dtinicio || null, dtfim: form.dtfim || null } });
      onSaved(); onClose();
    }, "Promoção salva.");
  }
  return <Modal wide title={promotion ? `Editar promoção · ${promotion.prodes}` : "Nova promoção"} onClose={onClose} busy={action.busy}>
    {action.feedback}
    {!promotion && !selected && <div className="page-stack"><Field label="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite ao menos 2 caracteres"/><Resource resource={products}>{(data) => <div className="record-list">{data.data.map((p) => <article className="record" key={p.procod}><div><strong>{p.prodes}</strong><p>{p.marcasdes} · {p.tipodes} · {money(p.provl)}</p></div><button className="button secondary" onClick={() => setSelected(p)}>Selecionar</button></article>)}</div>}</Resource></div>}
    {product && <form onSubmit={submit}><p><strong>{product.prodes}</strong> · Preço atual: {money(product.provl)}</p><fieldset disabled={action.busy}><div className="form-grid"><Field label="Tipo de desconto"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="P">Percentual (%)</option><option value="V">Valor fixo (R$)</option></select></Field><Field label={form.tipo === "P" ? "Percentual" : "Valor"} type="number" min="0.01" max={form.tipo === "P" ? "100" : undefined} step="0.01" required value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })}/><Field label="Início" type="date" value={form.dtinicio} onChange={(e) => setForm({ ...form, dtinicio: e.target.value })}/><Field label="Fim" type="date" value={form.dtfim} onChange={(e) => setForm({ ...form, dtfim: e.target.value })}/><Field label="Situação"><select value={String(form.ativo)} onChange={(e) => setForm({ ...form, ativo: e.target.value === "true" })}><option value="true">Ativa</option><option value="false">Inativa</option></select></Field></div><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button">Salvar promoção</button></div></fieldset></form>}
  </Modal>;
}

export default function PromotionsPage() {
  const [revision, setRevision] = useState(0), [editing, setEditing] = useState(null);
  const resource = useResource("/promocoes/admin", revision), action = useAction();
  async function remove(p) { if (!window.confirm(`Remover a promoção de ${p.prodes}?`)) return; await action.run(async () => { await apiRequest(`/promocoes/${p.procod}`, { method: "DELETE" }); setRevision((n) => n + 1); }, "Promoção removida."); }
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">CATÁLOGO</p><h1>Promoções</h1><p>Configure descontos por produto e período de validade.</p></div><button className="button" onClick={() => setEditing("new")}>+ Nova promoção</button></div>{action.feedback}<section className="panel"><Resource resource={resource}>{(data) => data.promocoes.length ? <div className="table-scroll"><table><thead><tr><th>Produto</th><th>Desconto</th><th>Preço</th><th>Validade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{data.promocoes.map((p) => <tr key={p.procod}><td><strong>{p.prodes}</strong><small>{p.marcasdes} · {p.tipodes}</small></td><td>{p.promocaotipo === "P" ? `${p.promocaovalor}%` : money(p.promocaovalor)}</td><td><s>{money(p.provl)}</s><small>{money(p.promopreco)}</small></td><td>{date(p.promocaodtinicio)} — {date(p.promocaodtfim)}</td><td><Status tone={p.promocaoativo ? "success" : "neutral"}>{p.promocaoativo ? "Ativa" : "Inativa"}</Status></td><td><div className="row"><button className="text-button" onClick={() => setEditing(p)}>Editar</button><button className="text-button error-text" onClick={() => remove(p)}>Remover</button></div></td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhuma promoção cadastrada.</p>}</Resource></section>{editing && <Editor promotion={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => setRevision((n) => n + 1)}/>}</div>;
}
