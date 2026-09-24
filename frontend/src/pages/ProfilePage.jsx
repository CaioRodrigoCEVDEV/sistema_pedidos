import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Resource, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";
import { useSession } from "../state/Session.jsx";

function ProfileForm({ user }) {
  const session = useSession(), action = useAction();
  const [name, setName] = useState(user.usunome || ""), [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  useEffect(() => setName(user.usunome || ""), [user]);
  async function submit(e) {
    e.preventDefault();
    if (password !== confirmation) return action.run(() => Promise.reject(new Error("As senhas não coincidem.")), "");
    const ok = await action.run(() => apiRequest(`/auth/atualizarCadastro/${user.usucod}`, { method: "PUT", json: { usunome: name.trim(), usuemail: user.usuemail, ususenha: password } }), "Perfil atualizado com sucesso.");
    if (ok) { setPassword(""); setConfirmation(""); session.refresh(); }
  }
  const initials = (name || user.usuemail || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <section className="panel profile-panel"><div className="profile-identity"><span className="profile-avatar">{initials}</span><div><h2>{name || "Usuário"}</h2><p>{user.usuemail}</p></div></div><form onSubmit={submit}>{action.feedback}<div className="form-grid"><Field label="Nome" required value={name} onChange={(e) => setName(e.target.value)}/><Field label="E-mail" type="email" disabled value={user.usuemail || ""}/><Field label="Nova senha" type="password" minLength="1" required value={password} onChange={(e) => setPassword(e.target.value)}/><Field label="Confirmar nova senha" type="password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)}/></div><div className="form-actions"><button className="button" disabled={action.busy}>Salvar alterações</button></div></form></section>;
}
export default function ProfilePage() {
  const profile = useResource("/auth/listarlogin");
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">CONTA</p><h1>Meu perfil</h1><p>Atualize seu nome e sua senha de acesso.</p></div></div><Resource resource={profile}>{(user) => <ProfileForm user={user}/>}</Resource></div>;
}
