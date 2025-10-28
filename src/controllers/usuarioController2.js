const usuarioModels = require('../models/usuarioModels');

exports.listarUsuarios = async (req, res) => {
    try {
        const usuarios = await usuarioModels.listarUsuarios();
        res.json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar usuarios' });
    }
};


exports.excluirCadastro = async (req, res) => {
    const { id } = req.params;

    try {
        const { id } = req.params;
         const resultado = await usuarioModels.excluirCadastro(id);
        res.json(resultado);
        } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao Excluir usuario' });
    }
};