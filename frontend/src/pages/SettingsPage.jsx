import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
import { Field, Resource, Status, useAction } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";

function CompanySettings({ company, reload }) {
  const [form, setForm] = useState(company), action = useAction();
  useEffect(() => setForm(company), [company]);
  async function submit(e) { e.preventDefault(); const ok = await action.run(() => apiRequest("/emp", { method: "PUT", json: form }), "Dados da empresa atualizados."); if (ok) reload(); }
  return <form onSubmit={submit}>{action.feedback}<div className="form-grid"><Field label="Razão social / nome fantasia" required value={form.emprazao || ""} onChange={(e) => setForm({ ...form, emprazao: e.target.value })}/><Field label="WhatsApp principal" inputMode="tel" value={form.empwhatsapp1 || ""} onChange={(e) => setForm({ ...form, empwhatsapp1: e.target.value.replace(/\D/g, "") })}/><Field label="WhatsApp secundário" inputMode="tel" value={form.empwhatsapp2 || ""} onChange={(e) => setForm({ ...form, empwhatsapp2: e.target.value.replace(/\D/g, "") })}/></div><div className="form-actions"><button className="button" disabled={action.busy}>Salvar dados</button></div></form>;
}
function StockSettings({ company, reload }) {
  const [enabled, setEnabled] = useState(company.empusaest === "S"), [minimum, setMinimum] = useState(company.empestoqmin ?? 5), action = useAction();
  async function submit(e) { e.preventDefault(); const ok = await action.run(() => apiRequest("/emp/estoque", { method: "PUT", json: { empusaest: enabled ? "S" : "N", empestoqmin: Number(minimum) } }), "Configuração de estoque atualizada."); if (ok) reload(); }
  return <form onSubmit={submit}>{action.feedback}<div className="section-heading"><div><h2>Controle de estoque</h2><p className="muted">Ative as sinalizações automáticas e defina o limite de últimas unidades.</p></div><Status tone={enabled ? "success" : "neutral"}>{enabled ? "Controlado" : "Desativado"}</Status></div><label className="switch-line"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/><span><strong>Controlar estoque</strong><small>Atualiza as flags de disponibilidade no catálogo.</small></span></label><Field label="Quantidade mínima" type="number" min="0" max="9999" required disabled={!enabled} value={minimum} onChange={(e) => setMinimum(e.target.value)}/><div className="form-actions"><button className="button" disabled={action.busy}>Salvar estoque</button></div></form>;
}
function LogoSettings() {
  const [file, setFile] = useState(null), [version, setVersion] = useState(Date.now()), action = useAction();
  async function submit(e) { e.preventDefault(); const data = new FormData(); data.append("logo", file); const ok = await action.run(() => apiRequest("/upload-logo", { method: "POST", body: data }), "Logo atualizada."); if (ok) setVersion(Date.now()); }
  return <form onSubmit={submit}>{action.feedback}<div className="logo-editor"><img src={`/uploads/logo.jpg?v=${version}`} alt="Logo atual da empresa"/><Field label="Nova logo"><input type="file" accept="image/*" required onChange={(e) => setFile(e.target.files[0])}/></Field><button className="button" disabled={!file || action.busy}>Enviar logo</button></div></form>;
}
export default function SettingsPage() {
  const company = useResource("/emp");
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">PREFERÊNCIAS</p><h1>Configurações</h1><p>Atualize os dados da empresa, o estoque e a identidade visual.</p></div></div><Resource resource={company}>{(data) => <><div className="settings-grid"><section className="panel"><h2>Dados da empresa</h2><CompanySettings company={data} reload={company.reload}/></section><section className="panel"><StockSettings company={data} reload={company.reload}/></section></div><section className="panel"><div className="section-heading"><div><h2>Identidade visual</h2><p className="muted">A imagem será usada na loja e nos atalhos instalados.</p></div></div><LogoSettings/></section></>}</Resource></div>;
}
