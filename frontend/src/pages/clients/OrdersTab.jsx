import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { Resource, Status } from "../../components/UI.jsx";
import { date, money, normalize } from "../../lib/format.js";
function OrderStatus({ order }) {
  return (
    <Status
      tone={order.pvsta === "X" ? "danger" : order.pvconfirmado === "S" ? "success" : "warning"}
    >
      {order.pvsta === "X" ? "Cancelado" : order.pvconfirmado === "S" ? "Confirmado" : "Pendente"}
    </Status>
  );
}
function Detail({ id, order, onClose }) {
  const items = useResource(`/cli/${id}/pedidos/${order.pvcod}/itens`);
  return (
    <section className="inset-panel">
      <div className="section-heading">
        <h3>Pedido #{order.pvcod}</h3>
        <button className="text-button" onClick={onClose}>
          Fechar detalhes
        </button>
      </div>
      <p>
        {order.pvcanal} · {date(order.pvdtcad)} · <OrderStatus order={order} />
      </p>
      <Resource resource={items}>
        {(data) =>
          data.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Cor</th>
                    <th>Quantidade</th>
                    <th>Unitário</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => (
                    <tr key={i}>
                      <td>{item.prodes}</td>
                      <td>{item.cornome || "Sem cor"}</td>
                      <td>{item.pviqtde}</td>
                      <td>{money(item.pvivl)}</td>
                      <td>{money(Number(item.pviqtde) * Number(item.pvivl))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sem itens para exibir.</p>
          )
        }
      </Resource>
      <p>
        <strong>Total do pedido: {money(order.pvvl)}</strong>
      </p>
    </section>
  );
}
function LinkOrders({ id, mutate, busy, onClose }) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const resource = useResource(`/cli/pedidos/disponiveis?q=${encodeURIComponent(query)}&limit=30`);
  return (
    <section className="inset-panel">
      <div className="section-heading">
        <h3>Vincular pedido</h3>
        <button className="text-button" onClick={onClose} disabled={busy}>
          Fechar busca
        </button>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <input
          aria-label="Buscar pedido disponível"
          placeholder="Número do pedido ou observação"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="button secondary">Buscar pedidos</button>
      </form>
      <Resource resource={resource}>
        {(data) =>
          data.length ? (
            <div className="record-list">
              {data.map((p) => (
                <article key={p.pvcod} className="record">
                  <div>
                    <strong>
                      #{p.pvcod} · {money(p.pvvl)}
                    </strong>
                    <p>
                      {date(p.pvdtcad)} · {p.pvcanal} · <OrderStatus order={p} />
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      mutate(
                        `/cli/${id}/pedidos/${p.pvcod}`,
                        { method: "POST" },
                        "Pedido vinculado.",
                        resource.reload
                      )
                    }
                  >
                    Vincular #{p.pvcod}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nenhum pedido disponível.</p>
          )
        }
      </Resource>
    </section>
  );
}
export default function OrdersTab({ id, revision, mutate, busy }) {
  const resource = useResource(`/cli/${id}/pedidos`, revision);
  const [filter, setFilter] = useState(""),
    [linking, setLinking] = useState(false),
    [detail, setDetail] = useState(null);
  return (
    <div className="page-stack">
      <div className="section-heading">
        <h3>Pedidos vinculados</h3>
        <button className="button secondary" disabled={busy} onClick={() => setLinking(!linking)}>
          Vincular pedido
        </button>
      </div>
      {linking && (
        <LinkOrders id={id} mutate={mutate} busy={busy} onClose={() => setLinking(false)} />
      )}
      <input
        aria-label="Filtrar pedidos vinculados"
        placeholder="Filtrar por número ou canal"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <Resource resource={resource}>
        {(data) => {
          const rows = data.filter((p) =>
            normalize(`${p.pvcod} ${p.pvcanal}`).includes(normalize(filter))
          );
          return (
            <>
              <p className="muted">
                {data.length} pedido(s) · Total:{" "}
                {money(data.reduce((sum, p) => sum + Number(p.pvvl || 0), 0))}
              </p>
              {rows.length ? (
                <div className="record-list">
                  {rows.map((p) => (
                    <article className="record" key={p.pvcod}>
                      <div>
                        <strong>
                          Pedido #{p.pvcod} · {money(p.pvvl)}
                        </strong>
                        <p>
                          {p.pvcanal} · {date(p.pvdtcad)}
                        </p>
                        <OrderStatus order={p} />
                      </div>
                      <div className="record-actions">
                        <button className="text-button" onClick={() => setDetail(p)}>
                          Ver detalhes #{p.pvcod}
                        </button>
                        <button
                          className="text-button error-text"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Desvincular o pedido #${p.pvcod}? O pedido não será excluído.`
                              )
                            )
                              mutate(
                                `/cli/${id}/pedidos/${p.pvcod}`,
                                { method: "DELETE" },
                                "Pedido desvinculado.",
                                () => setDetail(null)
                              );
                          }}
                        >
                          Desvincular
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Nenhum pedido encontrado.</p>
              )}
            </>
          );
        }}
      </Resource>
      {detail && (
        <Detail id={id} key={detail.pvcod} order={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
