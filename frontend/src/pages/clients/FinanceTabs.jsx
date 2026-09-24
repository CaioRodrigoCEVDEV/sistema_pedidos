import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { Field, Resource, Status } from "../../components/UI.jsx";
import { date, isoDate, money, whatsapp } from "../../lib/format.js";
const movements = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
  PAGAMENTO: "Pagamento",
  ESTORNO: "Estorno",
  AJUSTE: "Ajuste",
  COBRANCA: "Cobrança",
};
export function AccountTab({ id, revision, mutate, busy }) {
  const resource = useResource(`/cli/${id}/movimentacoes`, revision);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "CREDITO", valor: "", descricao: "" });
  function submit(event) {
    event.preventDefault();
    mutate(
      `/cli/${id}/movimentacoes`,
      { method: "POST", json: { ...form, valor: Number(form.valor) } },
      "Movimentação registrada.",
      () => {
        setOpen(false);
        setForm({ tipo: "CREDITO", valor: "", descricao: "" });
      }
    );
  }
  return (
    <div className="page-stack">
      <div className="section-heading">
        <h3>Extrato da conta</h3>
        <button className="button secondary" disabled={busy} onClick={() => setOpen(!open)}>
          Novo lançamento
        </button>
      </div>
      <p className="muted">
        O crédito do cliente e as cobranças em aberto são controlados separadamente.
      </p>
      {open && (
        <form className="inset-panel" onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  {Object.entries(movements).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Valor do lançamento"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
              <Field
                label="Descrição"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>
            <p className="muted">
              {["DEBITO", "AJUSTE", "COBRANCA"].includes(form.tipo)
                ? "Este lançamento aumenta o saldo devedor do extrato."
                : "Este lançamento reduz o saldo devedor ou acrescenta crédito ao extrato."}
            </p>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>
                Cancelar lançamento
              </button>
              <button className="button">Registrar lançamento</button>
            </div>
          </fieldset>
        </form>
      )}
      <Resource resource={resource}>
        {(data) =>
          data.length ? (
            <div className="record-list">
              {data.map((m) => (
                <article className="record" key={m.movcod}>
                  <div>
                    <strong>{movements[m.movtipo] || m.movtipo}</strong>
                    <p>
                      {date(m.movdtcad)}
                      {m.movdesc ? ` · ${m.movdesc}` : ""}
                      {m.movref ? ` · ${m.movref}` : ""}
                    </p>
                  </div>
                  <div className="align-right">
                    <strong className={Number(m.movvalor) > 0 ? "error-text" : "success-text"}>
                      {money(m.movvalor)}
                    </strong>
                    <p>Saldo: {money(m.movsaldo)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Nenhuma movimentação registrada.</p>
          )
        }
      </Resource>
    </div>
  );
}
export function ChargesTab({ client, revision, mutate, busy }) {
  const id = client.parcod,
    resource = useResource(`/cli/${id}/cobrancas`, revision),
    orders = useResource(`/cli/${id}/pedidos`, revision);
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({ cobvalor: "", cobvenc: "", cobpvcod: "", cobobs: "" });
  function submit(event) {
    event.preventDefault();
    mutate(
      `/cli/${id}/cobrancas`,
      {
        method: "POST",
        json: {
          ...form,
          cobvalor: Number(form.cobvalor),
          cobpvcod: form.cobpvcod || null,
          cobvenc: form.cobvenc || null,
        },
      },
      "Cobrança criada.",
      () => {
        setOpen(false);
        setForm({ cobvalor: "", cobvenc: "", cobpvcod: "", cobobs: "" });
      }
    );
  }
  return (
    <div className="page-stack">
      <div className="section-heading">
        <h3>Cobranças</h3>
        <button className="button secondary" disabled={busy} onClick={() => setOpen(!open)}>
          Nova cobrança
        </button>
      </div>
      {open && (
        <form className="inset-panel" onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field
                label="Valor da cobrança"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.cobvalor}
                onChange={(e) => setForm({ ...form, cobvalor: e.target.value })}
              />
              <Field
                label="Vencimento"
                type="date"
                value={form.cobvenc}
                onChange={(e) => setForm({ ...form, cobvenc: e.target.value })}
              />
              <Field label="Pedido vinculado">
                <select
                  value={form.cobpvcod}
                  onChange={(e) => setForm({ ...form, cobpvcod: e.target.value })}
                >
                  <option value="">Sem pedido</option>
                  {orders.data
                    ?.filter((p) => p.pvsta !== "X")
                    .map((p) => (
                      <option value={p.pvcod} key={p.pvcod}>
                        #{p.pvcod} · {money(p.pvvl)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field
                label="Observação"
                value={form.cobobs}
                onChange={(e) => setForm({ ...form, cobobs: e.target.value })}
              />
            </div>
            {orders.error && (
              <p className="error-text">
                Não foi possível carregar os pedidos.{" "}
                <button className="text-button" type="button" onClick={orders.reload}>
                  Tentar novamente
                </button>
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>
                Cancelar cobrança
              </button>
              <button className="button">Gerar cobrança</button>
            </div>
          </fieldset>
        </form>
      )}
      <Resource resource={resource}>
        {(data) =>
          data.length ? (
            <div className="record-list">
              {data.map((c) => {
                const late =
                  c.cobsta === "A" && c.cobvenc && String(c.cobvenc).slice(0, 10) < isoDate();
                const label =
                  c.cobsta === "P"
                    ? "Pago"
                    : c.cobsta === "C"
                      ? "Cancelado"
                      : late
                        ? "Vencido"
                        : "Em aberto";
                const message = `Olá, ${client.pardes}!\n\nEstamos entrando em contato referente à sua cobrança.${c.cobpvcod ? `\nPedido: #${c.cobpvcod}` : ""}\nValor: ${money(c.cobvalor)}${c.cobvenc ? `\nVencimento: ${date(c.cobvenc)}` : ""}\n\nCaso já tenha realizado o pagamento, por favor desconsidere esta mensagem. Obrigado!`;
                const link = whatsapp(client.parfone, message);
                return (
                  <article className="record" key={c.cobcod}>
                    <div>
                      <strong>
                        #{c.cobcod} · {money(c.cobvalor)}
                      </strong>
                      <p>
                        Vencimento: {date(c.cobvenc)}
                        {c.cobpvcod ? ` · Pedido #${c.cobpvcod}` : ""}
                      </p>
                      {c.cobobs && <p>{c.cobobs}</p>}
                      <Status
                        tone={
                          c.cobsta === "P"
                            ? "success"
                            : late
                              ? "danger"
                              : c.cobsta === "A"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {label}
                      </Status>
                    </div>
                    {c.cobsta === "A" && (
                      <div className="record-actions">
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer">
                            Cobrar pelo WhatsApp ↗
                          </a>
                        ) : (
                          <span className="muted">Atualize o telefone para usar o WhatsApp.</span>
                        )}
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Registrar o pagamento da cobrança #${c.cobcod}?`))
                              mutate(
                                `/cli/${id}/cobrancas/${c.cobcod}/baixar`,
                                { method: "PUT" },
                                "Pagamento registrado."
                              );
                          }}
                        >
                          Registrar pagamento
                        </button>
                        <button
                          className="text-button error-text"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Cancelar a cobrança #${c.cobcod}?`))
                              mutate(
                                `/cli/${id}/cobrancas/${c.cobcod}/cancelar`,
                                { method: "PUT" },
                                "Cobrança cancelada."
                              );
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">Nenhuma cobrança registrada.</p>
          )
        }
      </Resource>
    </div>
  );
}
