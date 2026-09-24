import { useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Modal, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";

const blank = { usucod: "", usunome: "", usuemail: "", ususenha: "", usuadm: "N", ususta: "A", usurca: "N", telas: [] };
function UserForm({ initial, screens, onClose, onSaved }) {
  const [form, setForm] = useState({ ...blank, ...initial }), action = useAction();
  const toggle = (key) => setForm((old) => ({ ...old, telas: old.telas.includes(key) ? old.telas.filter((v) => v !== key) : [...old.telas, key] }));
  async function submit(e) {
    e.preventDefault();
    const path = form.usucod ? `/usuario/atualizar/${encodeURIComponent(form.usuemail)}` : "/usuario/novo/";
    const ok = await action.run(() => apiRequest(path, { method: "POST", json: form }), form.usucod ? "Usuário atualizado." : "Usuário criado.");
    if (ok) { onSaved(); onClose(); }
  }
  async function remove() {
    if (!window.confirm("Deseja realmente excluir este usuário?")) return;
    const ok = await action.run(() => apiRequest(`/usuario/excluir/${form.usucod}`, { method: "POST" }), "Usuário excluído.");
    if (ok) { onSaved(); onClose(); }
  }
  return <Modal wide title={form.usucod ? "Editar usuário" : "Novo usuário"} onClose={onClose} busy={action.busy}><form onSubmit={submit}>{action.feedback}<div className="form-grid"><Field label="Nome" required value={form.usunome} onChange={(e) => setForm({ ...form, usunome: e.target.value })}/><Field label="E-mail" type="email" required disabled={Boolean(form.usucod)} value={form.usuemail} onChange={(e) => setForm({ ...form, usuemail: e.target.value })}/><Field label={form.usucod ? "Nova senha (opcional)" : "Senha"} type="password" required={!form.usucod} value={form.ususenha} onChange={(e) => setForm({ ...form, ususenha: e.target.value })}/><Field label="Situação"><select value={form.ususta} onChange={(e) => setForm({ ...form, ususta: e.target.value })}><option value="A">Ativo</option><option value="I">Inativo</option></select></Field></div><div className="check-row"><label><input type="checkbox" checked={form.usuadm === "S"} onChange={(e) => setForm({ ...form, usuadm: e.target.checked ? "S" : "N" })}/> Administrador</label><label><input type="checkbox" checked={form.usurca === "S"} onChange={(e) => setForm({ ...form, usurca: e.target.checked ? "S" : "N" })}/> Vendedor</label></div><fieldset className="permission-grid"><legend>Telas permitidas</legend>{screens.map((screen) => <label key={screen.telachave}><input type="checkbox" checked={form.telas.includes(screen.telachave)} onChange={() => toggle(screen.telachave)}/><span><strong>{screen.telanome}</strong><small>{screen.telagrupo}</small></span></label>)}</fieldset><div className="form-actions">{form.usucod && <button type="button" className="button danger" disabled={action.busy} onClick={remove}>Excluir</button>}<span className="spacer"/><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button" disabled={action.busy}>Salvar</button></div></form></Modal>;
}
export default function UsersPage() {
  const [revision, setRevision] = useState(0), [search, setSearch] = useState(""), [editing, setEditing] = useState(null);
  const users = useResource("/usuario/listar/", revision), screens = useResource("/telas");
  const filtered = useMemo(() => (users.data || []).filter((u) => `${u.usucod} ${u.usunome} ${u.usuemail}`.toLowerCase().includes(search.toLowerCase())), [users.data, search]);
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Usuários</h1><p>Gerencie contas, situação e acesso às telas.</p></div><button className="button" onClick={() => setEditing(blank)}>Novo usuário</button></div><section className="panel"><div className="search-bar"><input aria-label="Buscar usuários" placeholder="Buscar por nome, e-mail ou código" value={search} onChange={(e) => setSearch(e.target.value)}/><button className="button secondary" onClick={users.reload}>Atualizar</button></div><Resource resource={users}>{() => filtered.length ? <div className="table-scroll"><table className="operations-table"><thead><tr><th>Código</th><th>Usuário</th><th>Administrador</th><th>Situação</th><th></th></tr></thead><tbody>{filtered.map((u) => <tr key={u.usucod}><td>#{u.usucod}</td><td><strong>{u.usunome || "Sem nome"}</strong><small>{u.usuemail}</small></td><td>{u.usuadm === "S" ? "Sim" : "Não"}</td><td><Status tone={u.ususta === "A" ? "success" : "warning"}>{u.ususta === "A" ? "Ativo" : "Inativo"}</Status></td><td><button className="button secondary" onClick={() => setEditing(u)}>Editar</button></td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhum usuário encontrado.</p>}</Resource></section>{editing && <UserForm initial={editing} screens={screens.data || []} onClose={() => setEditing(null)} onSaved={() => setRevision((n) => n + 1)}/>}</div>;
}
