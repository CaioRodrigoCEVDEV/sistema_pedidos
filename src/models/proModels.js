const pool = require("../config/db");

async function listarProdutosComEstoque() {
  const result = await pool.query(`
        select 
        procod,
        prodes,
        marcasdes,
        moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        join modelo on modcod = promodcod
        where case when procorcorescod is null then proqtde else procorqtde end > 0
        and prosit = 'A'`);
  return result.rows;
}

async function listarProdutosSemEstoque() {
  const result = await pool.query(`
        select 
        procod,
        prodes,
        marcasdes,
        moddes,
        tipodes,
        coalesce(cornome, 'Sem Cor') as cordes,
        case when procorcorescod is null then proqtde else procorqtde end as qtde,
        procorcorescod
        from pro
        join marcas on marcascod = promarcascod 
        join tipo on tipocod = protipocod
        left join procor on procod = procorprocod
        left join cores on corcod = procorcorescod
        join modelo on modcod = promodcod
        where case when procorcorescod is null then proqtde else procorqtde end <= 0
        and prosit = 'A'`);
  return result.rows;
}

async function listarProdutosComEstoqueItem(marca, modelo) {
  const params = [];
  const filtros = [];

  // Aceita 'todos', 'todas', null, undefined ou ''
  const marcaValida =
    marca && !["todos", "todas"].includes(String(marca).toLowerCase());
  const modeloValido =
    modelo && !["todos", "todas"].includes(String(modelo).toLowerCase());

  if (marcaValida) {
    params.push(marca);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloValido) {
    params.push(modelo);
    filtros.push(`promodcod = $${params.length}`);
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select 
                        procod,
                        prodes,
                        marcasdes,
                        moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else procorqtde end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                join modelo on modcod = promodcod
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

  const marcaValida =
    marca && !["todos", "todas"].includes(String(marca).toLowerCase());
  const modeloValido =
    modelo && !["todos", "todas"].includes(String(modelo).toLowerCase());

  if (marcaValida) {
    params.push(marca);
    filtros.push(`promarcascod = $${params.length}`);
  }
  if (modeloValido) {
    params.push(modelo);
    filtros.push(`promodcod = $${params.length}`);
  }

  const filtrosExtras = filtros.length ? ` and ${filtros.join(" and ")}` : "";

  const query = `
                select 
                        procod,
                        prodes,
                        marcasdes,
                        moddes,
                        tipodes,
                        coalesce(cornome, 'Sem Cor') as cordes,
                        case when procorcorescod is null then proqtde else procorqtde end as qtde,
                        procorcorescod
                from pro
                join marcas on marcascod = promarcascod 
                join tipo on tipocod = protipocod
                left join procor on procod = procorprocod
                left join cores on corcod = procorcorescod
                join modelo on modcod = promodcod
                where case when procorcorescod is null then proqtde else procorqtde end <= 0
                        and prosit = 'A'
                        ${filtrosExtras}
        `;
  const result = await pool.query(query, params);
  return result.rows;
}
module.exports = {
  listarProdutosComEstoque,
  listarProdutosSemEstoque,
  listarProdutosComEstoqueItem,
  listarProdutosSemEstoqueItem,
};
