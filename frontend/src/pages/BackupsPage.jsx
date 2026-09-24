import { useMemo, useState } from "react";
import { Field, Resource } from "../components/UI.jsx";
import { useResource } from "../hooks/useResource.js";

export default function BackupsPage() {
  const [folder, setFolder] = useState(""), [search, setSearch] = useState(""), [extension, setExtension] = useState("");
  const resource = useResource(folder ? `/backups/folder/${encodeURIComponent(folder)}` : "/backups");
  const items = useMemo(() => (resource.data?.backups || []).filter((item) => {
    const name = String(item.nome || "").toLowerCase();
    return (!search || name.includes(search.toLowerCase())) && (!extension || (item.tipo === "arquivo" && name.endsWith(extension)));
  }).sort((a, b) => (a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === "pasta" ? -1 : 1)), [resource.data, search, extension]);
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">SEGURANÇA</p><h1>Backups</h1><p>Consulte e baixe os arquivos gerados pelo servidor.</p></div><button className="button secondary" onClick={resource.reload}>Atualizar</button></div>
    <section className="panel"><div className="backup-breadcrumb"><button className="text-button" onClick={() => setFolder("")}>Backups</button>{folder && <><span>/</span><strong>{folder}</strong></>}</div><div className="filter-bar"><Field label="Buscar" placeholder="Nome do arquivo" value={search} onChange={(e) => setSearch(e.target.value)}/><Field label="Tipo"><select value={extension} onChange={(e) => setExtension(e.target.value)}><option value="">Todos</option><option value=".zip">ZIP</option><option value=".tgz">TGZ</option><option value=".sql">SQL</option><option value=".dump">DUMP</option><option value=".log">LOG</option></select></Field></div>
      <Resource resource={resource}>{() => items.length ? <div className="table-scroll"><table className="operations-table"><thead><tr><th>Nome</th><th>Tamanho</th><th>Ação</th></tr></thead><tbody>{items.map((item) => <tr key={`${item.tipo}-${item.nome}`}><td><strong>{item.tipo === "pasta" ? "▣" : "▤"} {item.nome}</strong></td><td>{item.tipo === "pasta" ? "—" : `${Number(item.tamanhoKB || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} KB`}</td><td>{item.tipo === "pasta" ? <button className="button secondary" onClick={() => setFolder(item.nome)}>Abrir</button> : <a className="button secondary" href={item.url} download>Baixar</a>}</td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhum backup encontrado.</p>}</Resource>
    </section></div>;
}
