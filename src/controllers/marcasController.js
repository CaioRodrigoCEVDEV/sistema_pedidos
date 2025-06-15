const pool = require('../config/db');

exports.listarMarcas = async (req, res) => {
    
    try {
        const result = await pool.query(
            'select * from marcas'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar marcas' });
    }
};


