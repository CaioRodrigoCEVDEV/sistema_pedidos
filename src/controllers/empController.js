const pool = require('../config/db');

exports.listarEmpresa = async (req, res) => {
    try {
        const result = await pool.query(
            'select * from emp'
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao carregar dados da empresa' });
    }
};
