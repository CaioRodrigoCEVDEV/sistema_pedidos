import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import { useResource } from "../hooks/useResource.js";
import { useWorkspace, useSession } from "../state/Session.jsx";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { money } from "../lib/format.js";
import { canAccess } from "../lib/navigation.js";
import CatalogReferences from "./catalog/CatalogReferences.jsx";

const empty = { prodes: "", promarcascod: "", promodcod: "", protipocod: "", provl: "", procusto: "" };

function ProductEditor({ product, brands, models, types, onClose, onSaved }) {
  const action = useAction();
  const [form, setForm] = useState(() => ({ ...empty, ...product }));
  const creating = !product?.procod;
  const filteredModels = models.filter((m) => !form.promarcascod || String(m.modmarcascod) === String(form.promarcascod));
  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      const json = {
        ...form,
        provl: Number(form.provl),
        procusto: Number(form.procusto),
        ...(creating ? {} : { prosemest: product.prosemest || "N", proacabando: product.proacabando || "N" }),
      };
      if (!creating && !json.promodcod) delete json.promodcod;
      await apiRequest(creating ? "/pro" : `/pro/${product.procod}`, {
        method: creating ? "POST" : "PUT",
        json,
      });
      onSaved();
      onClose();
    }, "Produto salvo.");
  }
  return (
    <Modal wide title={creating ? "Novo produto" : `Editar produto #${product.procod}`} onClose={onClose} busy={action.busy}>
      {action.feedback}
      <form onSubmit={save}>
        <fieldset disabled={action.busy}>
          <div className="form-grid">
            <Field label="Descrição *" required value={form.prodes} onChange={(e) => setForm({ ...form, prodes: e.target.value })} />
            {creating && <Field label="Marca *"><select required value={form.promarcascod} onChange={(e) => setForm({ ...form, promarcascod: e.target.value, promodcod: "" })}><option value="">Selecione</option>{brands.map((b) => <option key={b.marcascod} value={b.marcascod}>{b.marcasdes}</option>)}</select></Field>}
            <Field label="Modelo *"><select required={creating} value={form.promodcod} onChange={(e) => setForm({ ...form, promodcod: e.target.value })}><option value="">Selecione</option>{filteredModels.map((m) => <option key={m.modcod} value={m.modcod}>{m.moddes}</option>)}</select></Field>
            {creating && <Field label="Tipo *"><select required value={form.protipocod} onChange={(e) => setForm({ ...form, protipocod: e.target.value })}><option value="">Selecione</option>{types.map((t) => <option key={t.tipocod} value={t.tipocod}>{t.tipodes}</option>)}</select></Field>}
            <Field label="Preço de venda *" type="number" min="0" step="0.01" required value={form.provl} onChange={(e) => setForm({ ...form, provl: e.target.value })} />
            <Field label="Custo" type="number" min="0" step="0.01" value={form.procusto} onChange={(e) => setForm({ ...form, procusto: e.target.value })} />
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button">Salvar produto</button></div>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const { permissions } = useSession();
  const admin = canAccess(permissions, "produtos");
  const [filter, setFilter] = useWorkspace("products", { search: "", q: "", page: 1 });
  const [revision, setRevision] = useState(0), [editing, setEditing] = useState(null);
  const action = useAction();
  const products = useResource(`/pros?${new URLSearchParams({ page: filter.page, pageSize: 20, q: filter.q })}`, revision);
  const brands = useResource("/marcas", revision), models = useResource("/modelos", revision), types = useResource("/tipos", revision);
  const maxPage = Math.max(1, Math.ceil((products.data?.total || 0) / 20));
  useEffect(() => { if (products.data && filter.page > maxPage) setFilter({ ...filter, page: maxPage }); }, [products.data, filter, maxPage, setFilter]);
  const edit = async (row) => {
    await action.run(async () => {
      const data = await apiRequest(`/pro/painel/${row.procod}`);
      setEditing({ ...row, ...(data[0] || {}) });
    }, "");
  };
  async function remove(row) {
    if (!window.confirm(`Excluir o produto #${row.procod} · ${row.prodes}?`)) return;
    await action.run(async () => { await apiRequest(`/pro/${row.procod}`, { method: "DELETE" }); setRevision((n) => n + 1); }, "Produto excluído.");
  }
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">CATÁLOGO</p><h1>Produtos</h1><p>Consulte e mantenha as peças disponíveis na loja.</p></div>{admin && <button className="button" onClick={() => setEditing(empty)}>+ Novo produto</button>}</div>
    {action.feedback}
    <section className="panel">
      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); setFilter({ ...filter, q: filter.search.trim(), page: 1 }); }}>
        <input aria-label="Buscar produtos" placeholder="Descrição do produto" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })}/><button className="button secondary">Buscar</button>
      </form>
      <Resource resource={products}>{(result) => <>
        <div className="results-heading"><span>{result.total} produto(s)</span><button className="text-button" onClick={products.reload}>Atualizar</button></div>
        <div className="table-scroll"><table><thead><tr><th>Produto</th><th>Marca / tipo</th><th>Modelos</th><th>Venda</th><th>Estoque</th>{admin && <th>Ações</th>}</tr></thead><tbody>{result.data.map((p) => <tr key={p.procod}><td><strong>#{p.procod} · {p.prodes}</strong></td><td>{p.marcasdes}<small>{p.tipodes}</small></td><td>{p.modelos || "—"}</td><td>{p.provlpromo != null ? <><s>{money(p.provl)}</s><small>{money(p.provlpromo)}</small></> : money(p.provl)}</td><td><Status tone={p.prosemest === "S" ? "danger" : p.proacabando === "S" ? "warning" : "success"}>{p.prosemest === "S" ? "Sem estoque" : p.proacabando === "S" ? "Acabando" : "Disponível"}</Status></td>{admin && <td><div className="row"><button className="text-button" onClick={() => edit(p)}>Editar</button><button className="text-button error-text" onClick={() => remove(p)}>Excluir</button></div></td>}</tr>)}</tbody></table></div>
        <div className="pagination"><span>Página {filter.page} de {maxPage}</span><div className="row"><button className="button secondary" disabled={filter.page <= 1} onClick={() => setFilter({ ...filter, page: filter.page - 1 })}>Anterior</button><button className="button secondary" disabled={filter.page >= maxPage} onClick={() => setFilter({ ...filter, page: filter.page + 1 })}>Próxima</button></div></div>
      </>}</Resource>
    </section>
    {admin && <CatalogReferences revision={revision} onChange={() => setRevision((n) => n + 1)} />}
    {editing && brands.data && models.data && types.data && <ProductEditor product={editing} brands={brands.data} models={models.data} types={types.data} onClose={() => setEditing(null)} onSaved={() => setRevision((n) => n + 1)} />}
  </div>;
}
