import { useState } from "react";
import { apiRequest } from "../../api/client.js";
import { useResource } from "../../hooks/useResource.js";
import { Resource, useAction } from "../../components/UI.jsx";

const configs = {
  marcas: { title: "Marcas", url: "/marcas", id: "marcascod", name: "marcasdes" },
  tipos: { title: "Tipos", url: "/tipos", id: "tipocod", name: "tipodes" },
  cores: { title: "Cores", url: "/cores", id: "corcod", name: "cornome" },
};

function SimpleReference({ type, revision, onChange }) {
  const config = configs[type];
  const resource = useResource(config.url, revision);
  const action = useAction();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);

  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      await apiRequest(editing ? `${config.url}/${editing[config.id]}` : config.url, {
        method: editing ? "PUT" : "POST",
        json: { [config.name]: name.trim() },
      });
      setName("");
      setEditing(null);
      onChange();
    }, "Cadastro salvo.");
  }
  async function remove(item) {
    if (!window.confirm(`Excluir ${item[config.name]}?`)) return;
    await action.run(async () => {
      await apiRequest(`${config.url}/${item[config.id]}`, { method: "DELETE" });
      onChange();
    }, "Cadastro excluído.");
  }
  return (
    <details className="inset-panel">
      <summary>{config.title}</summary>
      {action.feedback}
      <form className="search-bar" onSubmit={save}>
        <input aria-label={`Nome de ${config.title.toLowerCase()}`} required value={name} onChange={(e) => setName(e.target.value)} />
        <button className="button secondary">{editing ? "Salvar" : "Adicionar"}</button>
        {editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setName(""); }}>Cancelar</button>}
      </form>
      <Resource resource={resource}>{(rows) => (
        <div className="record-list compact-list">{rows.map((item) => (
          <article className="record" key={item[config.id]}><strong>{item[config.name]}</strong><div className="record-actions"><button className="text-button" onClick={() => { setEditing(item); setName(item[config.name]); }}>Editar</button><button className="text-button error-text" onClick={() => remove(item)}>Excluir</button></div></article>
        ))}</div>
      )}</Resource>
    </details>
  );
}

function Models({ revision, onChange }) {
  const resource = useResource("/modelos", revision);
  const brands = useResource("/marcas", revision);
  const action = useAction();
  const [form, setForm] = useState({ moddes: "", modmarcascod: "" });
  const [editing, setEditing] = useState(null);
  async function save(event) {
    event.preventDefault();
    await action.run(async () => {
      await apiRequest(editing ? `/modelo/${editing.modcod}` : "/modelo", { method: editing ? "PUT" : "POST", json: form });
      setEditing(null);
      setForm({ moddes: "", modmarcascod: "" });
      onChange();
    }, "Modelo salvo.");
  }
  return (
    <details className="inset-panel"><summary>Modelos</summary>{action.feedback}
      <form className="search-bar" onSubmit={save}><input aria-label="Nome do modelo" required value={form.moddes} onChange={(e) => setForm({ ...form, moddes: e.target.value })}/><select aria-label="Marca do modelo" required value={form.modmarcascod} onChange={(e) => setForm({ ...form, modmarcascod: e.target.value })}><option value="">Marca</option>{(brands.data || []).map((b) => <option key={b.marcascod} value={b.marcascod}>{b.marcasdes}</option>)}</select><button className="button secondary">{editing ? "Salvar" : "Adicionar"}</button></form>
      <Resource resource={resource}>{(rows) => <div className="record-list compact-list">{rows.map((m) => <article className="record" key={m.modcod}><strong>{m.moddes}</strong><div className="record-actions"><button className="text-button" onClick={() => { setEditing(m); setForm({ moddes: m.moddes, modmarcascod: m.modmarcascod }); }}>Editar</button><button className="text-button error-text" onClick={() => window.confirm(`Excluir ${m.moddes}?`) && action.run(async () => { await apiRequest(`/modelo/${m.modcod}`, { method: "DELETE" }); onChange(); }, "Modelo excluído.")}>Excluir</button></div></article>)}</div>}</Resource>
    </details>
  );
}

export default function CatalogReferences({ revision, onChange }) {
  return <section className="panel page-stack"><div><h2>Cadastros auxiliares</h2><p className="muted">Marcas, modelos, tipos e cores usados pelos produtos.</p></div><SimpleReference type="marcas" revision={revision} onChange={onChange}/><Models revision={revision} onChange={onChange}/><SimpleReference type="tipos" revision={revision} onChange={onChange}/><SimpleReference type="cores" revision={revision} onChange={onChange}/></section>;
}
