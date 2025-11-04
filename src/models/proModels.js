const pool = require('../config/db');

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
module.exports = { listarProdutosComEstoque, listarProdutosSemEstoque };