import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";
import { money, periodDates } from "../lib/format.js";

function countValue(resource) {
  return Number(resource.data?.[0]?.count || 0);
}

function OrderDetail({ order, onClose, onChange }) {
  const resource = useResource(`/pedido/detalhe/${order.pvcod}`);
  const action = useAction();
  const [quantities, setQuantities] = useState({});
  useEffect(() => {
    if (!resource.data) return;
    setQuantities(Object.fromEntries(resource.data.map((item, index) => [index, Math.floor(Number(item.pviqtde || 0))])));
  }, [resource.data]);
  async function save(kind, items) {
    const path = kind === "confirm"
      ? `/pedidos/confirmar/${order.pvcod}`
      : `/pedidos/confirmados/${order.pvcod}/itens`;
    const ok = await action.run(
      () => apiRequest(path, { method: "PUT", json: { itens: items } }),
      kind === "confirm" ? "Pedido confirmado." : "Itens atualizados.",
    );
    if (ok) onChange();
  }
  async function cancel() {
    if (!window.confirm(`Cancelar o pedido #${order.pvcod}?`)) return;
    const ok = await action.run(
      () => apiRequest(`/pedidos/cancelar/${order.pvcod}`, { method: "PUT", json: {} }),
      "Pedido cancelado.",
    );
    if (ok) onChange(true);
  }
  return (
    <Modal wide title={`Pedido #${order.pvcod}`} onClose={onClose} busy={action.busy}>
      {action.feedback}
      <Resource resource={resource}>{(items) => {
        const mapped = items.map((item, index) => ({
          procod: Number(item.pviprocod),
          pviprocorid: item.pviprocorid || null,
          ...(order.status === "pending"
            ? { qtd: Number(quantities[index] ?? item.pviqtde) }
            : { pviqtde: Number(quantities[index] ?? item.pviqtde) }),
        }));
        const total = items.reduce((sum, item, index) => sum + Number(item.pvivl || 0) * Number(quantities[index] ?? item.pviqtde), 0);
        return <div className="page-stack">
          <div className="sheet-identity">
            <Status tone={order.status === "confirmed" ? "success" : "warning"}>
              {order.status === "confirmed" ? "Confirmado" : "Pendente"}
            </Status>
            <span>{order.pvcanal || "Canal não informado"}</span>
            <span>{order.usunome || "Sem vendedor"}</span>
          </div>
          {items.length ? <div className="table-scroll"><table className="operations-table">
            <thead><tr><th>Peça</th><th>Cor</th><th>Quantidade</th><th>Unitário</th><th>Subtotal</th></tr></thead>
            <tbody>{items.map((item, index) => <tr key={`${item.pviprocod}-${item.pviprocorid || 0}`}>
              <td><strong>{item.prodes}</strong><small>Cód. {item.pviprocod}</small></td>
              <td>{item.cornome || "Sem cor"}</td>
              <td><input className="quantity-input" aria-label={`Quantidade de ${item.prodes}`} type="number" min="0" step="1" value={quantities[index] ?? item.pviqtde} onChange={(e) => setQuantities({ ...quantities, [index]: e.target.value })}/></td>
              <td>{money(item.pvivl)}</td>
              <td>{money(Number(item.pvivl || 0) * Number(quantities[index] ?? item.pviqtde))}</td>
            </tr>)}</tbody>
          </table></div> : <p className="empty-state">Nenhum item ativo neste pedido.</p>}
          <div className="order-total"><span>Total atualizado</span><strong>{money(total)}</strong></div>
          {items[0]?.pvobs && <p className="inset-panel"><strong>Observação:</strong> {items[0].pvobs}</p>}
          <div className="form-actions split-actions">
            <button className="button danger-outline" type="button" disabled={action.busy} onClick={cancel}>Cancelar pedido</button>
            <div className="row">
              <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>Fechar</button>
              <button className="button" type="button" disabled={action.busy || !items.length} onClick={() => save(order.status === "pending" ? "confirm" : "edit", mapped)}>
                {order.status === "pending" ? "Confirmar pedido" : "Salvar quantidades"}
              </button>
            </div>
          </div>
        </div>;
      }}</Resource>
    </Modal>
  );
}

function OrdersTable({ rows, status, selected, setSelected, open }) {
  if (!rows.length) return <p className="empty-state">Nenhum pedido encontrado neste período.</p>;
  return <div className="table-scroll"><table className="operations-table">
    <thead><tr>{status === "pending" && <th className="check-cell">Selecionar</th>}<th>Pedido</th><th>Canal</th><th>Vendedor</th><th>Valor</th><th>Ação</th></tr></thead>
    <tbody>{rows.map((order) => <tr key={order.pvcod}>
      {status === "pending" && <td className="check-cell"><input aria-label={`Selecionar pedido ${order.pvcod}`} type="checkbox" checked={selected.includes(order.pvcod)} onChange={(e) => setSelected(e.target.checked ? [...selected, order.pvcod] : selected.filter((id) => id !== order.pvcod))}/></td>}
      <td><strong>#{order.pvcod}</strong></td><td>{order.pvcanal || "—"}</td><td>{order.usunome || "Sem vendedor"}</td><td>{money(order.pvvl)}</td>
      <td><button className="button secondary" onClick={() => open({ ...order, status })}>Ver detalhes</button></td>
    </tr>)}</tbody>
  </table></div>;
}

export default function OrdersPage() {
  const [revision, setRevision] = useState(0), [tab, setTab] = useState("pending"), [selected, setSelected] = useState([]), [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState({ preset: "todos", start: "", end: "" });
  const [applied, setApplied] = useState({ start: "", end: "" });
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (applied.start) params.set("dataInicio", applied.start);
    if (applied.end) params.set("dataFim", applied.end);
    return params.toString();
  }, [applied]);
  const pending = useResource(`/pedidos/pendentes?${query}`, revision), confirmed = useResource(`/pedidos/confirmados?${query}`, revision);
  const pendingCount = useResource("/pedidos/pendentescount", revision), counter = useResource("/pedidos/balcao", revision), delivery = useResource("/pedidos/entrega", revision), confirmedCount = useResource("/pedidos/total/confirmados", revision);
  const action = useAction();
  function choosePreset(preset) {
    const dates = periodDates(preset);
    setFilter({ preset, start: dates.start, end: dates.end });
  }
  function refresh(close = false) {
    setRevision((n) => n + 1); setSelected([]); if (close) setDetail(null);
  }
  async function cancelSelected() {
    if (!selected.length || !window.confirm(`Cancelar ${selected.length} pedido(s) selecionado(s)?`)) return;
    const ok = await action.run(() => apiRequest("/pedidos/cancelar", { method: "PUT", json: { pvcods: selected } }), "Pedidos cancelados.");
    if (ok) refresh();
  }
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">VENDAS</p><h1>Pedidos</h1><p>Confirme, ajuste e acompanhe pedidos sem sair do painel.</p></div><a className="button secondary" href="/">Nova venda</a></div>
    {action.feedback}
    <div className="kpi-grid">
      {[["Pendentes", countValue(pendingCount), "symbol-2", "…"], ["Balcão", countValue(counter), "symbol-0", "▤"], ["Entrega", countValue(delivery), "symbol-3", "↗"], ["Confirmados", countValue(confirmedCount), "symbol-1", "✓"]].map(([label, value, tone, icon]) => <article className="kpi" key={label}><span className={`kpi-symbol ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>)}
    </div>
    <section className="panel"><form className="filter-bar" onSubmit={(e) => { e.preventDefault(); setApplied({ start: filter.start, end: filter.end }); }}>
      <Field label="Período"><select value={filter.preset} onChange={(e) => choosePreset(e.target.value)}><option value="todos">Todos</option><option value="hoje">Hoje</option><option value="ult7">Últimos 7 dias</option><option value="ult30">Últimos 30 dias</option><option value="personalizado">Personalizado</option></select></Field>
      <Field label="De" type="date" disabled={filter.preset !== "personalizado"} value={filter.start} onChange={(e) => setFilter({ ...filter, start: e.target.value })}/>
      <Field label="Até" type="date" disabled={filter.preset !== "personalizado"} value={filter.end} onChange={(e) => setFilter({ ...filter, end: e.target.value })}/>
      <button className="button">Aplicar período</button>
    </form></section>
    <section className="panel">
      <div className="section-heading"><div className="tabs compact-tabs"><button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>Pendentes</button><button className={tab === "confirmed" ? "active" : ""} onClick={() => setTab("confirmed")}>Confirmados</button></div>{tab === "pending" && <button className="button danger-outline" disabled={!selected.length || action.busy} onClick={cancelSelected}>Cancelar selecionados ({selected.length})</button>}</div>
      {tab === "pending" ? <Resource resource={pending}>{(rows) => <OrdersTable rows={rows} status="pending" selected={selected} setSelected={setSelected} open={setDetail}/>}</Resource> : <Resource resource={confirmed}>{(rows) => <OrdersTable rows={rows} status="confirmed" selected={selected} setSelected={setSelected} open={setDetail}/>}</Resource>}
    </section>
    {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} onChange={refresh}/>} 
  </div>;
}
