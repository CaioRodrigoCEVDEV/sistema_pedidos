const pool = require('../config/db');

exports.listarProduto = async (req, res) => {
    const {id} = req.params;
    const {marca,modelo} = req.query;
    
    try {
        const result = await pool.query(
            'select prodes, provl from pro where promarcascod = $1 and promodcod  = $2 and protipocod  = $3', [marca, modelo, id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};


