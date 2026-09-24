import { useEffect, useState } from "react";
import { useResource } from "../hooks/useResource.js";
import { useWorkspace } from "../state/Session.jsx";
import { Resource, Status } from "../components/UI.jsx";
import { documentNumber, money } from "../lib/format.js";
import ClientSheet from "./clients/ClientSheet.jsx";

export default function ClientsPage() {
  const [filter, setFilter] = useWorkspace("clients", { search: "", q: "", page: 1 });
  const [selected, setSelected] = useState(null),
    [revision, setRevision] = useState(0);
  const resource = useResource(
    `/cli?${new URLSearchParams({ page: filter.page, pageSize: 20, q: filter.q })}`,
    revision
  );
  useEffect(() => {
    if (!resource.data || resource.loading) return;
    const lastPage = Math.max(1, Math.ceil(resource.data.total / 20));
    if (filter.page > lastPage) setFilter({ ...filter, page: lastPage });
  }, [resource.data, resource.loading, filter, setFilter]);
  function search(event) {
    event.preventDefault();
    setFilter({ ...filter, q: filter.search.trim(), page: 1 });
  }
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RELACIONAMENTO</p>
          <h1>Clientes</h1>
          <p>Cadastros, pedidos e conta dos seus clientes.</p>
        </div>
        <button className="button" onClick={() => setSelected("new")}>
          + Novo cliente
        </button>
      </div>
      <section className="panel clients-panel">
        <form className="search-bar" onSubmit={search}>
          <label className="search-field">
            <span className="sr-only">Buscar clientes</span>
            <input
              type="search"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </label>
          <button className="button secondary">Buscar</button>
        </form>
        <Resource resource={resource}>
          {(data) => (
            <>
              <div className="results-heading">
                <span>
                  {data.total} {data.total === 1 ? "cliente" : "clientes"}
                </span>
                <button
                  className="text-button"
                  onClick={resource.reload}
                  disabled={resource.loading}
                >
                  Atualizar lista
                </button>
              </div>
              {data.data.length ? (
                <div className="table-scroll">
                  <table className="clients-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>CPF/CNPJ</th>
                        <th>Cidade/UF</th>
                        <th>Contato</th>
                        <th>Em aberto</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((client) => (
                        <tr key={client.parcod}>
                          <td>
                            <button
                              className="client-name text-button"
                              onClick={() => setSelected(client.parcod)}
                            >
                              {client.pardes}
                            </button>
                            <small>
                              #{client.parcod}
                              {client.parfan ? ` · ${client.parfan}` : ""}
                            </small>
                          </td>
                          <td>{documentNumber(client.parcnpjcpf)}</td>
                          <td>
                            {[client.mundes, client.ufsigla].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td>
                            {client.parfone || "—"}
                            <small>{client.paremail}</small>
                          </td>
                          <td className={Number(client.em_aberto) > 0 ? "error-text" : ""}>
                            {money(client.em_aberto)}
                          </td>
                          <td>
                            <Status tone={client.parsit === "I" ? "neutral" : "success"}>
                              {client.parsit === "I" ? "Inativo" : "Ativo"}
                            </Status>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  {filter.q
                    ? "Nenhum cliente encontrado para esta busca."
                    : "Nenhum cliente cadastrado."}
                </div>
              )}
              <div className="pagination">
                <span>
                  Página {filter.page} de {Math.max(1, Math.ceil(data.total / 20))}
                </span>
                <div className="row">
                  <button
                    className="button secondary"
                    disabled={filter.page <= 1 || resource.loading}
                    onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
                  >
                    Anterior
                  </button>
                  <button
                    className="button secondary"
                    disabled={filter.page * 20 >= data.total || resource.loading}
                    onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </Resource>
      </section>
      {selected !== null && (
        <ClientSheet
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChange={() => setRevision((v) => v + 1)}
        />
      )}
    </div>
  );
}
