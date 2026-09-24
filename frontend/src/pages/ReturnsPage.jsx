import { useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";
import { date, money } from "../lib/format.js";

function ReturnForm({ item, onClose, onSaved }) {
  const action = useAction();
  const [form, setForm] = useState({ quantidade: 1, motivo: "", observacao: "", reporEstoque: true });
  async function submit(event) {
    event.preventDefault();
    const quantity = Number(form.quantidade), max = Number(item.quantidade_disponivel);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) return;
    const ok = await action.run(() => apiRequest("/devolucoes", { method: "POST", json: {
      pvcod: item.pvcod, procod: item.procod, pviprocorid: item.pviprocorid || null,
      quantidade: quantity, motivo: form.motivo.trim(), observacao: form.observacao.trim(), reporEstoque: form.reporEstoque,
    }}), "Devolução registrada.");
    if (ok) onSaved();
  }
  return <Modal title={`Devolver item do pedido #${item.pvcod}`} onClose={onClose} busy={action.busy}>
    {action.feedback}<div className="selected-record"><strong>{item.prodes}</strong><p>{item.cornome || "Sem cor"} · {money(item.valor_unitario)}</p></div>
    <form onSubmit={submit}><fieldset disabled={action.busy}><div className="form-grid single-column">
      <Field label={`Quantidade (máximo ${item.quantidade_disponivel})`} type="number" min="1" max={item.quantidade_disponivel} step="1" required value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })}/>
      <Field label="Motivo" required maxLength="80" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}/>
      <Field label="Observação"><textarea maxLength="254" rows="3" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}/></Field>
      <label className="checkbox-field"><input type="checkbox" checked={form.reporEstoque} onChange={(e) => setForm({ ...form, reporEstoque: e.target.checked })}/><span>Repor a quantidade no estoque</span></label>
    </div><div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Voltar</button><button className="button">Confirmar devolução</button></div></fieldset></form>
  </Modal>;
}

export default function ReturnsPage() {
  const [form, setForm] = useState({ q: "", start: "", end: "" }), [filters, setFilters] = useState(form), [revision, setRevision] = useState(0), [selected, setSelected] = useState(null);
  const query = useMemo(() => { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.start) p.set("dataInicio", filters.start); if (filters.end) p.set("dataFim", filters.end); return p.toString(); }, [filters]);
  const sold = useResource(`/devolucoes/itens?${query}`, revision), history = useResource("/devolucoes/historico", revision);
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">PÓS-VENDA</p><h1>Devoluções</h1><p>Localize itens vendidos, registre devoluções e acompanhe a reposição.</p></div></div>
    <section className="panel"><form className="filter-bar" onSubmit={(e) => { e.preventDefault(); setFilters({ ...form, q: form.q.trim() }); }}>
      <Field label="Pedido, peça, descrição ou cor" value={form.q} placeholder="Digite para buscar" onChange={(e) => setForm({ ...form, q: e.target.value })}/>
      <Field label="De" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}/><Field label="Até" type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}/><button className="button">Buscar</button>
    </form></section>
    <section className="panel"><div className="section-heading"><div><h2>Itens disponíveis</h2><p className="muted">Somente pedidos confirmados e ativos.</p></div><Status>{sold.data?.length || 0} resultado(s)</Status></div>
      <Resource resource={sold}>{(rows) => rows.length ? <div className="table-scroll"><table className="operations-table returns-table"><thead><tr><th>Pedido</th><th>Data</th><th>Peça</th><th>Cor</th><th>Vendida</th><th>Devolvida</th><th>Disponível</th><th>Valor</th><th>Ação</th></tr></thead><tbody>{rows.map((item) => <tr key={`${item.pvcod}-${item.procod}-${item.pviprocorid || 0}`}><td><strong>#{item.pvcod}</strong><small>{item.pvcanal || "—"}</small></td><td>{date(item.pvdtcad)}</td><td><strong>{item.prodes}</strong><small>Cód. {item.procod} · {item.vendedor}</small></td><td>{item.cornome || "Sem cor"}</td><td>{item.quantidade_vendida}</td><td>{item.quantidade_devolvida}</td><td><Status tone="success">{item.quantidade_disponivel}</Status></td><td>{money(item.valor_unitario)}</td><td><button className="button" onClick={() => setSelected(item)}>Devolver</button></td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhum item disponível para devolução.</p>}</Resource>
    </section>
    <section className="panel"><div className="section-heading"><div><h2>Histórico de devoluções</h2><p className="muted">Últimos 100 registros.</p></div></div>
      <Resource resource={history}>{(rows) => rows.length ? <div className="table-scroll"><table className="operations-table"><thead><tr><th>Data</th><th>Devolução</th><th>Pedido</th><th>Peça</th><th>Qtd.</th><th>Motivo</th><th>Estoque</th><th>Usuário</th></tr></thead><tbody>{rows.map((item) => <tr key={item.devcod}><td>{date(item.devdtcad)}</td><td><strong>#{item.devcod}</strong></td><td>#{item.pvcod}</td><td>{item.prodes}<small>{item.cornome || "Sem cor"}</small></td><td>{item.quantidade}</td><td>{item.devmotivo}</td><td><Status tone={item.repor_estoque ? "success" : "neutral"}>{item.repor_estoque ? "Reposto" : "Não reposto"}</Status></td><td>{item.usuario}</td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhuma devolução registrada.</p>}</Resource>
    </section>
    {selected && <ReturnForm item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setRevision((n) => n + 1); }}/>} 
  </div>;
}
