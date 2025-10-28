const pool = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');



async function listarUsuarios() {   
        const result = await pool.query(`SELECT * FROM usu WHERE ususta in ('A','I') and usuemail <> 'admin@orderup.com.br' ORDER BY usucod DESC`);
        return result.rows;
}

async function excluirCadastro (id) {
    //const  ususta  = "X";
        //await pool.query('UPDATE usu SET ususta = $1 WHERE usucod = $2', [ususta, id]);
        await pool.query(`delete from usu  WHERE usucod = $1`, [id]);        
        return { mensagem: 'Usuário inativado com sucesso' };
}

module.exports = { listarUsuarios, excluirCadastro };