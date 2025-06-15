const pool = require('../config/db');

exports.listarQualidade = async (req, res) => {
    
    try {
        const result = await pool.query(
            'select * from qualidade'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar qualidade' });
    }
};


