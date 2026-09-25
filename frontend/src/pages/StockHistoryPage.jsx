import { useState } from 'react';
import { Field, Resource, Status } from '../components/UI.jsx';
import { useResource } from '../hooks/useResource.js';

const empty = { inicio: '', fim: '', marca: '', modelo: '', tipo: '', q: '' };
const number = n => Number(n).toLocaleString('pt-BR');
const date = d => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
export default function StockHistoryPage() {
  const [form, setForm] = useState(empty), [filters, setFilters] = useState(empty), [page, setPage] = useState(1);
  const resource = useResource(`/api/estoque-historico?${new URLSearchParams({ ...filters, page })}`);
  const brands = useResource('/marcas'), models = useResource('/modelos'), types = useResource('/tipos');
  const change = key => e => setForm({ ...form, [key]: e.target.value });
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">OPERAÇÕES</p><h1>Histórico de movimentação</h1><p>Entradas e saídas do estoque da loja.</p></div></div>
    <section className="panel"><form className="filter-bar" onSubmit={e => { e.preventDefault(); setPage(1); setFilters(form); }}>
      <Field label="Data inicial" type="date" value={form.inicio} onChange={change('inicio')} />
      <Field label="Data final" type="date" min={form.inicio} value={form.fim} onChange={change('fim')} />
      {[[brands,'marca','Marca','marcascod','marcasdes'],[models,'modelo','Modelo','modcod','moddes'],[types,'tipo','Tipo de peça','tipocod','tipodes']].map(([list,key,label,id,name]) => <Field key={key} label={label}><select value={form[key]} onChange={change(key)}><option value="">Todos</option>{(list.data || []).map(item => <option key={item[id]} value={item[id]}>{item[name]}</option>)}</select>{list.error && <small>Não foi possível carregar as opções.</small>}</Field>)}
      <Field label="Peça ou grupo" type="search" value={form.q} onChange={change('q')} />
      <button className="button">Filtrar</button><button type="button" className="button secondary" onClick={() => { setForm(empty); setFilters(empty); setPage(1); }}>Limpar</button>
    </form></section>
    <section className="panel"><Resource resource={resource}>{result => <>
      <div className="section-heading"><h2>{number(result.total)} movimentações</h2><p>Entradas: {number(result.entradas)} un. · Saídas: {number(result.saidas)} un.</p></div>
      <p className="muted">Registro completo desde {date(result.iniciado_em)}. Antes dessa data, somente o histórico disponível dos grupos. Cada movimento do grupo é contado uma vez.</p>
      <div className="record-list" style={{ maxHeight: '65vh', overflow: 'auto' }}>{result.data.map(row => <article className="record" key={row.id}><div><strong>{row.descricao}</strong><p>{date(row.ocorrido_em)} · {row.origem === 'grupo' ? 'Estoque do grupo' : 'Estoque da peça'}</p>{row.itens?.length > 0 && <details><summary>Peças e identificação</summary>{row.itens.map((item, i) => <p key={i}>{[item.peca,item.cor,item.marca,...(item.modelos || []).map(m => m.nome),item.tipo].filter(Boolean).join(' · ')}</p>)}</details>}</div><div><Status tone={Number(row.variacao) > 0 ? 'success' : 'danger'}>{row.movimento}</Status><p><strong>{number(row.quantidade)} un.</strong></p><small>Saldo após: {row.saldo_atual == null ? '—' : number(row.saldo_atual)}</small></div></article>)}</div>
      {!result.data.length && <p className="empty-state">Nenhuma movimentação encontrada para esses filtros.</p>}
      <div className="filter-bar"><button className="button secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(result.total / result.pageSize))}</span><button className="button secondary" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>Próxima</button></div>
    </>}</Resource></section>
  </div>;
}
