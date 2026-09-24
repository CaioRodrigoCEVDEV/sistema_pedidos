import { useState } from "react";
import { Link } from "react-router";
import { useSession, useWorkspace } from "../state/Session.jsx";
import { useResource } from "../hooks/useResource.js";
import { Resource } from "../components/UI.jsx";
import { money, number, periodDates } from "../lib/format.js";
import { canAccess } from "../lib/navigation.js";

const periods = {
  ult30: "Últimos 30 dias",
  hoje: "Hoje",
  ult7: "Últimos 7 dias",
  mesAtual: "Mês atual",
  anoAtual: "Ano atual",
  todos: "Todos",
  personalizado: "Personalizado",
};
const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function Bars({ rows, currency = false }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  if (!rows.some((r) => Number(r.value)))
    return <p className="empty-state">Nenhum dado neste período.</p>;
  return (
    <ul className="bars">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`}>
          <div className="bar-label">
            <span title={row.label}>{row.label}</span>
            <strong>{currency ? money(row.value) : number(row.value)}</strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <span
              style={{
                width: `${Math.max(0, (Number(row.value) / max) * 100)}%`,
                background: `var(--chart-${i % 4})`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
function ChartCard({ title, resource, rows, currency }) {
  return (
    <section className="panel chart-card">
      <h2>{title}</h2>
      <Resource resource={resource}>
        {(data) => <Bars rows={rows(data)} currency={currency} />}
      </Resource>
    </section>
  );
}
function AnnualChart({ data }) {
  const values = months.map(() => ({ BALCAO: 0, ENTREGA: 0, VENDA: 0 }));
  data.forEach((row) => {
    const index = Number(row.mes) - 1,
      canal = row.pvcanal?.trim().toUpperCase().replace("Ã", "A");
    if (values[index] && canal in values[index])
      values[index][canal] += Number(row.vl_total_mes) || 0;
  });
  const max = Math.max(1, ...values.map((v) => v.BALCAO + v.ENTREGA + v.VENDA));
  return (
    <>
      <div
        className="annual-chart"
        role="img"
        aria-label="Vendas mensais por canal. Os valores completos estão na tabela abaixo."
      >
        {values.map((v, i) => (
          <div className="annual-column" key={i}>
            <div className="annual-stack">
              {Object.entries(v).map(([canal, value], c) => (
                <div
                  key={canal}
                  title={`${months[i]} · ${canal}: ${money(value)}`}
                  style={{ height: `${(value / max) * 100}%`, background: `var(--chart-${c})` }}
                />
              ))}
            </div>
            <span>{months[i]}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span>Balcão</span>
        <span>Entrega</span>
        <span>Venda</span>
      </div>
      <details>
        <summary>Ver valores por mês</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Balcão</th>
                <th>Entrega</th>
                <th>Venda</th>
              </tr>
            </thead>
            <tbody>
              {values.map((v, i) => (
                <tr key={i}>
                  <td>{months[i]}</td>
                  <td>{money(v.BALCAO)}</td>
                  <td>{money(v.ENTREGA)}</td>
                  <td>{money(v.VENDA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export default function DashboardPage() {
  const session = useSession();
  const initial = { preset: "ult30", ...periodDates("ult30") };
  const [filter, setFilter] = useWorkspace("dashboard", initial);
  const [draft, setDraft] = useState(filter),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const qs = new URLSearchParams();
  if (filter.start) qs.set("dataInicio", filter.start);
  if (filter.end) qs.set("dataFim", filter.end);
  if (filter.preset === "todos") qs.set("todos", "1");
  const suffix = qs.size ? `?${qs}` : "";
  const summary = useResource("/dashboard/resumo", revision);
  const products = useResource(`/v2/top/produtos/mes${suffix}`, revision);
  const brands = useResource(`/v2/top/marcas/mes${suffix}`, revision);
  const annual = useResource(`/v2/pedidos/total/anual${suffix}`, revision);
  const channels = useResource(`/v2/pedidos/total/dia${suffix}`, revision);
  function apply(event) {
    event.preventDefault();
    if (draft.start && draft.end && draft.start > draft.end) {
      setError("A data inicial deve ser anterior à data final.");
      return;
    }
    setError("");
    setFilter(draft);
  }
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Bem-vindo, {session.user.usunome}</h1>
          <p>Acompanhe os resultados e a operação da sua loja.</p>
        </div>
        <button className="button secondary" onClick={() => setRevision((v) => v + 1)}>
          Atualizar
        </button>
      </div>
      <section aria-label="Indicadores atuais">
        <Resource resource={summary}>
          {(data) => (
            <>
              <div className="kpi-grid">
                {[
                  ["Pedidos pendentes hoje", data.pedidos.pendentes],
                  ["Pedidos confirmados hoje", data.pedidos.confirmados],
                  ["Produtos acabando", data.produtos.acabando],
                  ["Produtos em falta", data.produtos.emFalta],
                  ["Marcas", data.listas.marcas],
                  ["Carteira de clientes", data.listas.clientes],
                  ["Vendedores", data.listas.vendedores],
                ].map(([label, value], i) => (
                  <article className="kpi" key={label}>
                    <span className={`kpi-symbol symbol-${i % 4}`} aria-hidden="true">
                      {["◷", "✓", "▦", "!"][i % 4]}
                    </span>
                    <div>
                      <p>{label}</p>
                      <strong>{number(value)}</strong>
                      {label === "Carteira de clientes" &&
                        canAccess(session.permissions, "clientes") && (
                          <Link to="/clientes">Ver clientes →</Link>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Resource>
      </section>
      <form className="panel filter-bar" onSubmit={apply}>
        <label>
          Período
          <select
            value={draft.preset}
            onChange={(e) => setDraft({ preset: e.target.value, ...periodDates(e.target.value) })}
          >
            {Object.entries(periods).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data inicial
          <input
            type="date"
            aria-label="Data inicial"
            value={draft.start}
            disabled={draft.preset !== "personalizado"}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            aria-label="Data final"
            value={draft.end}
            disabled={draft.preset !== "personalizado"}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </label>
        <button className="button">Aplicar filtro</button>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="chart-grid">
        <ChartCard
          title={`Top 10 produtos · ${periods[filter.preset]}`}
          resource={products}
          rows={(data) =>
            [...data]
              .sort((a, b) => Number(b.qtde) - Number(a.qtde))
              .slice(0, 10)
              .map((r) => ({ label: r.produto, value: r.qtde }))
          }
        />
        <ChartCard
          title={`Top 10 marcas · ${periods[filter.preset]}`}
          resource={brands}
          currency
          rows={(data) =>
            [...data]
              .sort((a, b) => Number(b.valor) - Number(a.valor))
              .slice(0, 10)
              .map((r) => ({
                label: r.marcasdes,
                value: Number(String(r.valor).replace(",", ".")),
              }))
          }
        />
        <ChartCard
          title="Vendas por canal · período selecionado"
          resource={channels}
          currency
          rows={(data) =>
            Object.entries(
              data.reduce((all, r) => {
                const key = r.pvcanal?.trim() || "Outros";
                all[key] = (all[key] || 0) + Number(r.vl_total_dia || 0);
                return all;
              }, {})
            ).map(([label, value]) => ({ label, value }))
          }
        />
        <section className="panel chart-card">
          <h2>Vendas por mês e canal</h2>
          <Resource resource={annual}>{(data) => <AnnualChart data={data} />}</Resource>
        </section>
      </div>
      <h2 className="section-title">Situação atual da operação</h2>
      <p className="muted">
        Os indicadores abaixo mostram a posição atual; os pedidos e canais se referem a hoje.
      </p>
      <Resource resource={summary}>
        {(data) => (
          <div className="chart-grid">
            <section className="panel chart-card">
              <h2>Pedidos de hoje</h2>
              <Bars
                rows={[
                  { label: "Pendentes", value: data.pedidos.pendentes },
                  { label: "Confirmados", value: data.pedidos.confirmados },
                ]}
              />
            </section>
            <section className="panel chart-card">
              <h2>Canais de hoje</h2>
              <Bars
                rows={[
                  { label: "Balcão", value: data.pedidos.balcao },
                  { label: "Entrega", value: data.pedidos.entrega },
                  { label: "Venda", value: data.pedidos.venda },
                ]}
              />
            </section>
            <section className="panel chart-card">
              <h2>Disponibilidade de estoque</h2>
              <Bars
                rows={[
                  { label: "Com estoque", value: data.estoque.comEstoque },
                  { label: "Sem estoque", value: data.estoque.semEstoque },
                ]}
              />
            </section>
            <section className="panel chart-card">
              <h2>Top marcas com estoque</h2>
              <Bars
                rows={data.estoque.topMarcas.map((r) => ({ label: r.marcasdes, value: r.total }))}
              />
            </section>
          </div>
        )}
      </Resource>
    </div>
  );
}
