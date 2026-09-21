const pool = require("../config/db");
const { precoPromocionalSql } = require("../utils/promocaoSql");

// Lista as promoções do painel com os dados do produto e o preço promocional
// já calculado. Inclui produtos inativos para o administrador conseguir revisar
// ou remover a promoção mesmo que a peça tenha sido desativada.
async function listarAdmin() {
  const result = await pool.query(
    `SELECT prom.promocaocod,
            prom.procod,
            prom.promocaotipo,
            prom.promocaovalor,
            prom.promocaoativo,
            to_char(prom.promocaodtinicio, 'YYYY-MM-DD') AS promocaodtinicio,
            to_char(prom.promocaodtfim, 'YYYY-MM-DD') AS promocaodtfim,
            COALESCE(pro.prodes, '') AS prodes,
            COALESCE(pro.provl, 0) AS provl,
            pro.prosit,
            CASE
              WHEN prom.promocaotipo = 'P'
                THEN GREATEST(COALESCE(pro.provl, 0) - (COALESCE(pro.provl, 0) * prom.promocaovalor / 100), 0)
              ELSE GREATEST(COALESCE(pro.provl, 0) - prom.promocaovalor, 0)
            END AS promopreco,
            ${precoPromocionalSql("pro")} AS provlpromo,
            tipo.tipodes,
            marcas.marcasdes
       FROM public.promocoes prom
       JOIN public.pro ON pro.procod = prom.procod
       LEFT JOIN public.tipo ON tipo.tipocod = pro.protipocod
       LEFT JOIN public.marcas ON marcas.marcascod = pro.promarcascod
      ORDER BY prom.promocaoativo DESC, prom.updated_at DESC, prom.promocaocod DESC`
  );
  return result.rows;
}

async function buscarPorProcod(procod) {
  const result = await pool.query(
    `SELECT promocaocod,
            procod,
            promocaotipo,
            promocaovalor,
            promocaoativo,
            to_char(promocaodtinicio, 'YYYY-MM-DD') AS promocaodtinicio,
            to_char(promocaodtfim, 'YYYY-MM-DD') AS promocaodtfim
       FROM public.promocoes
      WHERE procod = $1`,
    [procod]
  );
  return result.rows[0] || null;
}

// Produto usado na validação do desconto de valor fixo (não pode superar provl).
async function buscarProduto(procod) {
  const result = await pool.query(
    `SELECT procod,
            COALESCE(prodes, '') AS prodes,
            COALESCE(provl, 0) AS provl,
            prosit
       FROM public.pro
      WHERE procod = $1`,
    [procod]
  );
  return result.rows[0] || null;
}

// Cria ou substitui a promoção do produto (uma por produto).
async function salvar({ procod, tipo, valor, ativo, dtinicio, dtfim }) {
  const result = await pool.query(
    `INSERT INTO public.promocoes
       (procod, promocaotipo, promocaovalor, promocaoativo, promocaodtinicio, promocaodtfim)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (procod) DO UPDATE SET
       promocaotipo = EXCLUDED.promocaotipo,
       promocaovalor = EXCLUDED.promocaovalor,
       promocaoativo = EXCLUDED.promocaoativo,
       promocaodtinicio = EXCLUDED.promocaodtinicio,
       promocaodtfim = EXCLUDED.promocaodtfim,
       updated_at = NOW()
     RETURNING *`,
    [procod, tipo, valor, ativo, dtinicio, dtfim]
  );
  return result.rows[0] || null;
}

// Atualização parcial. Campos ausentes (undefined) são preservados; datas podem
// ser definidas como null para limpar o limite.
async function atualizar(procod, campos) {
  const sets = [];
  const params = [procod];
  const add = (coluna, valor) => {
    params.push(valor);
    sets.push(`${coluna} = $${params.length}`);
  };

  if (campos.tipo !== undefined) add("promocaotipo", campos.tipo);
  if (campos.valor !== undefined) add("promocaovalor", campos.valor);
  if (campos.ativo !== undefined) add("promocaoativo", campos.ativo);
  if (campos.dtinicio !== undefined) add("promocaodtinicio", campos.dtinicio);
  if (campos.dtfim !== undefined) add("promocaodtfim", campos.dtfim);

  if (sets.length === 0) return null;

  const result = await pool.query(
    `UPDATE public.promocoes
        SET ${sets.join(", ")}, updated_at = NOW()
      WHERE procod = $1
      RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

async function remover(procod) {
  const result = await pool.query(
    `DELETE FROM public.promocoes WHERE procod = $1`,
    [procod]
  );
  return result.rowCount > 0;
}

// Calcula, no servidor, o preço efetivo de cada item do carrinho.
// Fonte única de preço para o checkout e para a revalidação do carrinho.
// O id do item pode vir como "123" ou "123-cor"; apenas o código do produto
// importa para o preço (que é por produto, não por variação de cor).
async function calcularPrecosItens(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return [];

  const itens = [];
  for (const item of cart) {
    const procod = parseInt(String(item && item.id).split("-")[0], 10);
    const qt = Number(item && item.qt) || 0;
    if (!Number.isInteger(procod) || procod <= 0) continue;
    itens.push({ procod, qt });
  }

  if (itens.length === 0) return [];

  const procods = [...new Set(itens.map((item) => item.procod))];
  const result = await pool.query(
    `SELECT pro.procod,
            COALESCE(pro.provl, 0) AS provl,
            ${precoPromocionalSql("pro")} AS provlpromo
       FROM public.pro
      WHERE pro.procod = ANY($1::int[])`,
    [procods]
  );

  const porProcod = new Map(
    result.rows.map((row) => [Number(row.procod), row])
  );

  return itens.map(({ procod, qt }) => {
    const row = porProcod.get(procod);
    const provl = row ? Number(row.provl) || 0 : 0;
    const provlpromo =
      row && row.provlpromo !== null && row.provlpromo !== undefined
        ? Number(row.provlpromo)
        : null;
    const preco = provlpromo === null ? provl : provlpromo;
    return { procod, qt, provl, provlpromo, preco };
  });
}

module.exports = {
  listarAdmin,
  buscarPorProcod,
  buscarProduto,
  salvar,
  atualizar,
  remover,
  calcularPrecosItens,
};
