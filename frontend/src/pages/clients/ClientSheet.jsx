import { useState } from "react";
import { apiRequest } from "../../api/client.js";
import { useResource } from "../../hooks/useResource.js";
import { Field, Modal, Resource, Status, useAction } from "../../components/UI.jsx";
import { money, normalize, whatsapp } from "../../lib/format.js";
import OrdersTab from "./OrdersTab.jsx";
import { AccountTab, ChargesTab } from "./FinanceTabs.jsx";

const empty = {
  pardes: "",
  parfan: "",
  parcnpjcpf: "",
  parfone: "",
  paremail: "",
  parcep: "",
  parrua: "",
  parbai: "",
  parmuncod: null,
  parierg: "",
  parsit: "A",
};
export default function ClientSheet({ id, onClose, onChange }) {
  const resource = useResource(id === "new" ? null : `/cli/${id}`);
  return id === "new" ? (
    <Editor client={empty} onClose={onClose} onChange={onChange} />
  ) : resource.data ? (
    <Editor client={resource.data} onClose={onClose} onChange={onChange} />
  ) : (
    <Modal title="Ficha do cliente" onClose={onClose}>
      <Resource resource={resource}>{() => null}</Resource>
    </Modal>
  );
}
function Editor({ client, onClose, onChange }) {
  const id = client.parcod,
    action = useAction();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(Object.keys(empty).map((key) => [key, client[key] ?? empty[key]]))
  );
  const [dirty, setDirty] = useState(false),
    [tab, setTab] = useState("dados"),
    [revision, setRevision] = useState(0);
  const [city, setCity] = useState([client.mundes, client.ufsigla].filter(Boolean).join(" - "));
  const [cityError, setCityError] = useState("");
  const municipalities = useResource("/municipios");
  const account = useResource(id ? `/cli/${id}/conta` : null, revision);
  function edit(key, value) {
    setDirty(true);
    setDraft((old) => ({ ...old, [key]: value }));
  }
  function close() {
    if (action.busy) return;
    if (!dirty || window.confirm("Descartar as alterações não salvas do cadastro?")) onClose();
  }
  async function mutate(path, options, message, done) {
    return action.run(async () => {
      await apiRequest(path, options);
      setRevision((n) => n + 1);
      onChange();
      done?.();
    }, message);
  }
  async function save(event) {
    event.preventDefault();
    if (city.trim() && !draft.parmuncod) {
      setCityError("Selecione uma cidade válida da lista.");
      return;
    }
    await mutate(
      id ? `/cli/${id}` : "/cli",
      { method: id ? "PUT" : "POST", json: draft },
      "Cliente salvo.",
      onClose
    );
  }
  async function remove(hard) {
    const message = hard
      ? "Excluir este cliente definitivamente? Esta ação só é permitida se ele não possuir vínculos."
      : "Inativar este cliente? Os pedidos e o histórico serão preservados.";
    if (window.confirm(message))
      await mutate(
        `/cli/${id}${hard ? "?hard=1" : ""}`,
        { method: "DELETE" },
        "Cliente atualizado.",
        onClose
      );
  }
  const tabs = id
    ? [
        ["dados", "Dados"],
        ["pedidos", "Pedidos"],
        ["conta", "Conta"],
        ["cobrancas", "Cobranças"],
      ]
    : [["dados", "Dados"]];
  const cityOptions = (municipalities.data || [])
    .filter((m) =>
      normalize(`${m.mundes} ${m.munufsigla}`).includes(normalize(city).replace(" - ", " "))
    )
    .slice(0, 50);
  const phoneLink = whatsapp(client.parfone);
  return (
    <Modal wide title={id ? client.pardes : "Novo cliente"} onClose={close} busy={action.busy}>
      {id && (
        <>
          <div className="sheet-identity">
            <span>Cliente #{id}</span>
            <Status tone={client.parsit === "I" ? "neutral" : "success"}>
              {client.parsit === "I" ? "Inativo" : "Ativo"}
            </Status>
            {phoneLink && (
              <a className="text-button" href={phoneLink} target="_blank" rel="noreferrer">
                WhatsApp ↗
              </a>
            )}
          </div>
          <Resource resource={account}>
            {(data) => (
              <div className="summary-grid">
                <div>
                  <span>Em aberto</span>
                  <strong className="error-text">{money(data.em_aberto)}</strong>
                </div>
                <div>
                  <span>Crédito disponível</span>
                  <strong className="success-text">{money(data.credito)}</strong>
                </div>
                <div>
                  <span>Pedidos vinculados</span>
                  <strong>{data.pedidos_vinculados}</strong>
                </div>
              </div>
            )}
          </Resource>
        </>
      )}
      <div className="tabs" aria-label="Seções da ficha">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            className={tab === key ? "active" : ""}
            disabled={action.busy}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {action.feedback}
      <div hidden={tab !== "dados"}>
        <form onSubmit={save}>
          <fieldset disabled={action.busy}>
            <div className="form-grid">
              <Field
                label="Nome / Razão social *"
                required
                maxLength={120}
                value={draft.pardes}
                onChange={(e) => edit("pardes", e.target.value)}
              />
              <Field
                label="Nome fantasia"
                value={draft.parfan}
                onChange={(e) => edit("parfan", e.target.value)}
              />
              <Field
                label="CPF / CNPJ *"
                required
                inputMode="numeric"
                maxLength={18}
                value={draft.parcnpjcpf}
                onChange={(e) => edit("parcnpjcpf", e.target.value)}
              />
              <Field
                label="Telefone / WhatsApp *"
                required
                type="tel"
                value={draft.parfone}
                onChange={(e) => edit("parfone", e.target.value)}
              />
              <Field
                label="E-mail"
                type="email"
                value={draft.paremail}
                onChange={(e) => edit("paremail", e.target.value)}
              />
              <Field label="Situação">
                <select value={draft.parsit} onChange={(e) => edit("parsit", e.target.value)}>
                  <option value="A">Ativo</option>
                  <option value="I">Inativo</option>
                </select>
              </Field>
              <Field
                label="RG / Inscrição estadual"
                value={draft.parierg}
                onChange={(e) => edit("parierg", e.target.value)}
              />
              <Field
                label="CEP"
                inputMode="numeric"
                maxLength={9}
                value={draft.parcep}
                onChange={(e) => edit("parcep", e.target.value)}
              />
              <Field
                label="Endereço"
                value={draft.parrua}
                onChange={(e) => edit("parrua", e.target.value)}
              />
              <Field
                label="Bairro"
                value={draft.parbai}
                onChange={(e) => edit("parbai", e.target.value)}
              />
              <Field
                label="Cidade / UF"
                list="municipios-react"
                value={city}
                placeholder="Digite e selecione a cidade"
                onChange={(e) => {
                  const value = e.target.value;
                  setCity(value);
                  setCityError("");
                  const match = municipalities.data?.find(
                    (m) => `${m.mundes} - ${m.munufsigla}` === value
                  );
                  edit("parmuncod", match ? match.muncod : null);
                }}
              />
              <datalist id="municipios-react">
                {cityOptions.map((m) => (
                  <option value={`${m.mundes} - ${m.munufsigla}`} key={m.muncod} />
                ))}
              </datalist>
              {cityError && (
                <p role="alert" className="error-text">
                  {cityError}
                </p>
              )}
              {municipalities.error && (
                <p role="alert" className="error-text">
                  Não foi possível carregar as cidades.{" "}
                  <button type="button" className="text-button" onClick={municipalities.reload}>
                    Tentar novamente
                  </button>
                </p>
              )}
            </div>
            <div className="form-actions">
              {id && (
                <>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={client.parsit === "I"}
                    onClick={() => remove(false)}
                  >
                    Inativar
                  </button>
                  <button
                    className="button danger-outline"
                    type="button"
                    onClick={() => remove(true)}
                  >
                    Excluir
                  </button>
                </>
              )}
              <span className="spacer" />
              <button className="button secondary" type="button" onClick={close}>
                Cancelar
              </button>
              <button className="button">{action.busy ? "Salvando…" : "Salvar cliente"}</button>
            </div>
          </fieldset>
        </form>
      </div>
      {tab === "pedidos" && (
        <OrdersTab id={id} revision={revision} mutate={mutate} busy={action.busy} />
      )}
      {tab === "conta" && (
        <AccountTab id={id} revision={revision} mutate={mutate} busy={action.busy} />
      )}
      {tab === "cobrancas" && (
        <ChargesTab client={client} revision={revision} mutate={mutate} busy={action.busy} />
      )}
    </Modal>
  );
}
