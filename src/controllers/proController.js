const pool = require('../config/db');

exports.listarProduto = async (req, res) => {
    const {id} = req.params;
    const {marca,modelo} = req.query;
    
    try {
        const result = await pool.query(
            'select procod, prodes, provl from pro where promarcascod = $1 and promodcod  = $2 and protipocod  = $3', [marca, modelo, id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};

exports.listarProdutoCarrinho = async (req, res) => {
    const {id} = req.params;
    
    try {
        const result = await pool.query(
            'select procod, prodes, provl from pro where procod = $1 ', [id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};


