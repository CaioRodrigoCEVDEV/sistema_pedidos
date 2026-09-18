const pool = require("../config/db");
const { parseIntegerParam } = require("../utils/parseIntegerParam");
const {
  disponibilidadeProdutoSql,
} = require("../utils/disponibilidadeProdutoSql");
const { getEstoqueConfig } = require("../utils/estoqueConfig");
const { buildFlagsEstoqueSql } = require("../utils/estoqueFlagsSql");

function parseOptionalInventoryFilter(value) {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "todos" || normalizedValue === "todas") {
      return null;
    }
  }

  return parseIntegerParam(value);
}

async function listarTodosProdutos() {
  const result = await pool.query(`
        select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        case when provl is null then 0 else provl end as provl,
        ${disponibilidadeProdutoSql} as prosemest,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        where prosit = 'A'`);
  return result.rows;
}

async function listarProdutosComEstoque() {
  const result = await pool.query(`
        select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        where case when procorcorescod is null then proqtde else procorqtde end > 0
        and prosit = 'A'`);
  return result.rows;
}

async function listarProdutosSemEstoque() {
  const result = await pool.query(`
        select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        where case when procorcorescod is null then proqtde else coalesce(procorqtde,0) end <= 0
        and prosit = 'A'`);
  return result.rows;
}

async function listarProdutosComEstoqueItem(marca, modelo) {
  const params = [];
  const filtros = [];

  const marcaId = parseOptionalInventoryFilter(marca);
  const modeloId = parseOptionalInventoryFilter(modelo);

  if (marcaId !== null) {
    params.push(marcaId);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloId !== null) {
    params.push(modeloId);
    filtros.push(
      `(promodcod = $${params.length} OR EXISTS (SELECT 1 FROM promod WHERE promodprocod = pro.procod AND promodmodcod = $${params.length}))`
    );
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select distinct
                        procod,
                        prodes,
                        marcasdes,
                        (
                          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
                          FROM promod pm
                          JOIN modelo m ON pm.promodmodcod = m.modcod
                          WHERE pm.promodprocod = pro.procod
                        ) as moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else procorqtde end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                where case when procorcorescod is null then proqtde else procorqtde end > 0
                        and prosit = 'A'
                        ${filtrosExtras}
        `;
  const result = await pool.query(query, params);
  return result.rows;
}

async function listarProdutosSemEstoqueItem(marca, modelo) {
  const params = [];
  const filtros = [];

  const marcaId = parseOptionalInventoryFilter(marca);
  const modeloId = parseOptionalInventoryFilter(modelo);

  if (marcaId !== null) {
    params.push(marcaId);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloId !== null) {
    params.push(modeloId);
    filtros.push(
      `(promodcod = $${params.length} OR EXISTS (SELECT 1 FROM promod WHERE promodprocod = pro.procod AND promodmodcod = $${params.length}))`
    );
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select distinct
                        procod,
                        prodes,
                        marcasdes,
                        (
                          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
                          FROM promod pm
                          JOIN modelo m ON pm.promodmodcod = m.modcod
                          WHERE pm.promodprocod = pro.procod
                        ) as moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else coalesce(procorqtde,0) end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                where case when procorcorescod is null then proqtde else coalesce(procorqtde,0) end <= 0
                        and prosit = 'A'
                        ${filtrosExtras}
        `;
  const result = await pool.query(query, params);
  return result.rows;
}

async function listarProdutosComEstoqueAcabando() {
  const config = await getEstoqueConfig();
  const condicao = config.usaEstoque
    ? `case when procorcorescod is null then proqtde else procorqtde end
              between 1 and $1`
    : "proacabando = 'S'";
  const params = config.usaEstoque ? [config.estoqueMin] : [];

  const result = await pool.query(
    `
        select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        where ${condicao}
          and prosit = 'A'`,
    params
  );
  return result.rows;
}

async function listarProdutosComEstoqueAcabandoItem(marca, modelo) {
  const config = await getEstoqueConfig();

  const params = [];
  const filtros = [];

  const marcaId = parseOptionalInventoryFilter(marca);
  const modeloId = parseOptionalInventoryFilter(modelo);

  if (marcaId !== null) {
    params.push(marcaId);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloId !== null) {
    params.push(modeloId);
    filtros.push(
      `(promodcod = $${params.length} OR EXISTS (SELECT 1 FROM promod WHERE promodprocod = pro.procod AND promodmodcod = $${params.length}))`
    );
  }

  let condicao;
  if (config.usaEstoque) {
    params.push(config.estoqueMin);
    condicao = `case when procorcorescod is null then proqtde else procorqtde end
                        between 1 and $${params.length}`;
  } else {
    condicao = "proacabando = 'S'";
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select distinct
                        procod,
                        prodes,
                        marcasdes,
                        (
                          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
                          FROM promod pm
                          JOIN modelo m ON pm.promodmodcod = m.modcod
                          WHERE pm.promodprocod = pro.procod
                        ) as moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else procorqtde end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                where ${condicao}
                        and prosit = 'A'
                        ${filtrosExtras}
        `;
  const result = await pool.query(query, params);
  return result.rows;
}

async function listarProdutosEmFalta() {
  const config = await getEstoqueConfig();
  const flags = buildFlagsEstoqueSql(config);

  const result = await pool.query(`
        select distinct
        procod,
        prodes,
        marcasdes,
        (
          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
          FROM promod pm
          JOIN modelo m ON pm.promodmodcod = m.modcod
          WHERE pm.promodprocod = pro.procod
        ) as moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        where prosit = 'A' and ${flags.disponibilidadeSql} = 'S'`);
  return result.rows;
}

async function listarProdutosEmFaltaItem(marca, modelo) {
  const config = await getEstoqueConfig();
  const flags = buildFlagsEstoqueSql(config);

  const params = [];
  const filtros = [];

  const marcaId = parseOptionalInventoryFilter(marca);
  const modeloId = parseOptionalInventoryFilter(modelo);

  if (marcaId !== null) {
    params.push(marcaId);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloId !== null) {
    params.push(modeloId);
    filtros.push(
      `(promodcod = $${params.length} OR EXISTS (SELECT 1 FROM promod WHERE promodprocod = pro.procod AND promodmodcod = $${params.length}))`
    );
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select distinct
                        procod,
                        prodes,
                        marcasdes,
                        (
                          SELECT string_agg(m.moddes, ', ' ORDER BY m.moddes)
                          FROM promod pm
                          JOIN modelo m ON pm.promodmodcod = m.modcod
                          WHERE pm.promodprocod = pro.procod
                        ) as moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else procorqtde end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                where prosit = 'A' and ${flags.disponibilidadeSql} = 'S'
                        ${filtrosExtras}
        `;
  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = {
  listarTodosProdutos,
  listarProdutosComEstoque,
  listarProdutosSemEstoque,
  listarProdutosComEstoqueAcabando,
  listarProdutosComEstoqueItem,
  listarProdutosSemEstoqueItem,
  listarProdutosComEstoqueAcabandoItem,
  listarProdutosEmFalta,
  listarProdutosEmFaltaItem,
};
