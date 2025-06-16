const pool = require('../config/db');

exports.listarModelo = async (req, res) => {
    const {id} = req.params;

    try {
        const result = await pool.query(
                        
            'select * from modelo where modmarcascod = $1',[id]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar modelos' });
    }
};


