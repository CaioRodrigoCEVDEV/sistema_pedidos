const pool = require("../config/db");

function montarConsulta(query = {}) {
  const params = [], where = [];
  const bind = (value) => { params.push(value); return `$${params.length}`; };
  for (const key of ["inicio", "fim"]) {
    if (!query[key]) continue;
    const value = String(query[key]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      throw new Error("Período inválido.");
    }
    const p = bind(value);
    where.push(key === "inicio"
      ? `h.ocorrido_em >= (${p}::date::timestamp AT TIME ZONE 'America/Sao_Paulo')`
      : `h.ocorrido_em < ((${p}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
  }
  if (query.inicio && query.fim && query.inicio > query.fim) throw new Error("A data inicial deve ser anterior à final.");
  const itemFilters = [];
  for (const key of ["marca", "modelo", "tipo"]) {
    if (!query[key]) continue;
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Filtro inválido.");
    const p = bind(value);
    itemFilters.push(key === "modelo"
      ? `EXISTS (SELECT 1 FROM jsonb_array_elements(i->'modelos') m WHERE (m->>'id')::int = ${p})`
      : `(i->>'${key}_id')::int = ${p}`);
  }
  if (query.q && String(query.q).trim()) {
    const p = bind(`%${String(query.q).trim().slice(0, 150)}%`);
    itemFilters.push(`(i->>'peca' ILIKE ${p} OR h.descricao ILIKE ${p})`);
    if (!query.marca && !query.modelo && !query.tipo) {
      where.push(`(h.descricao ILIKE ${p} OR EXISTS (SELECT 1 FROM jsonb_array_elements(h.itens) i WHERE i->>'peca' ILIKE ${p}))`);
      itemFilters.pop();
    }
  }
  if (itemFilters.length) where.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(h.itens) i WHERE ${itemFilters.join(" AND ")})`);
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const pageSize = 50;
  const limit = bind(pageSize), offset = bind((page - 1) * pageSize);
  const sql = `WITH filtrados AS (
    SELECT h.* FROM public.estoque_historico h ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
  ), pagina AS (
    SELECT *, CASE WHEN variacao > 0 THEN 'Entrada' ELSE 'Saída' END AS movimento,
      ABS(variacao) AS quantidade
    FROM filtrados ORDER BY ocorrido_em DESC, id DESC LIMIT ${limit} OFFSET ${offset}
  ) SELECT (SELECT COUNT(*)::int FROM filtrados) AS total,
    (SELECT COALESCE(SUM(variacao) FILTER (WHERE variacao > 0), 0) FROM filtrados) AS entradas,
    (SELECT COALESCE(-SUM(variacao) FILTER (WHERE variacao < 0), 0) FROM filtrados) AS saidas,
    (SELECT iniciado_em FROM public.estoque_historico_meta WHERE id = 1) AS iniciado_em,
    COALESCE((SELECT jsonb_agg(pagina ORDER BY ocorrido_em DESC, id DESC) FROM pagina), '[]') AS data`;
  return { sql, params, page, pageSize };
}

async function listar(req, res) {
  let consulta;
  try { consulta = montarConsulta(req.query); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const result = await pool.query(consulta.sql, consulta.params);
    res.json({ ...result.rows[0], page: consulta.page, pageSize: consulta.pageSize });
  } catch (error) {
    console.error("Erro no histórico de estoque:", error);
    res.status(500).json({ error: "Não foi possível carregar as movimentações." });
  }
}

module.exports = { listar, montarConsulta };
