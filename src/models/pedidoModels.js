const pool = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

async function totalVendas() {   
        const result = await pool.query(`select
            count(pvcod) as total_pedido,
            pvconfirmado,
            pvcanal,
            sum(pvvl) as vl_total  
            from pv
            group by pv.pvconfirmado ,pv.pvcanal 
            order by pv.pvcanal`);
        return result.rows;
}

module.exports = { totalVendas };