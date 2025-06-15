const pool = require('../config/db');

exports.listarProduto = async (req, res) => {
    
    try {
        const result = await pool.query(
            'select * from pro'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
};


