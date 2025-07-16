const pool = require('../config/db');

exports.listarModelo = async (req, res) => {
    const {id} = req.params;

    try {
        const result = await pool.query(
                        
            `select * from modelo where modmarcascod = $1 
                        ORDER BY 
                        COALESCE(CAST(substring(moddes from '^\d+') AS INT), 0),
                        moddes;  `,[id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar modelos' });
    }
};

exports.inserirModelo =async (req, res) => {
    const { moddes,modmarcascod } = req.body;

    try {
        const result = await pool.query(
            `insert into modelo (moddes,modmarcascod) values ($1,$2) returning *`,[moddes,modmarcascod]
        );
        res.status(200).json(result.rows);
    } catch {
        console.error(error);
        res.status(500).json({error: 'Erro ao criar modelo'});
    }
};

exports.atualizarModelo =async (req, res) => {
    const { id } = req.params;
    const { moddes,modmarcascod } = req.body;

    try {
        const result = await pool.query(
            `update modelo set moddes = $1, modmarcascod = $2 where modcod = $3 returning *`,[moddes,modmarcascod,id]
        );
        res.status(200).json(result.rows);
    } catch {
        console.error(error);
        res.status(500).json({error: 'Erro ao alterar modelo'});
    }
};

exports.deletarModelo =async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `delete from modelo where modcod = $1 returning *`,[id]
        );
        res.status(200).json(result.rows);
    } catch {
        console.error(error);
        res.status(500).json({error: 'Erro ao excluir modelo'});
    }
};

exports.listarTodosModelos = async (req, res) => {
    try {
        const result = await pool.query(`select * from modelo 
                                            ORDER BY 
                                            CAST(substring(moddes from '^\d+') AS INT), 
                                            moddes;    `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar modelos' });
    }
};

