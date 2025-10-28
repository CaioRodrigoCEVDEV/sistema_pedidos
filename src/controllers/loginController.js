const pool = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

exports.validarLogin = async (req, res) => {
    const { usucod,usunome,usuemail, ususenha } = req.body;

    try {
        const result = await pool.query('SELECT usucod,usunome,usuemail, ususenha,usuadm ,ususta FROM usu WHERE usuemail = $1', [usuemail]);

        if (result.rowCount === 1 && result.rows[0].ususta === 'I') {
            return res.status(403).json({ mensagem: 'Usuário inativo. Contate o administrador.' });
        }

        if (result.rowCount === 1 && result.rows[0].ususta === 'X') {
            return res.status(403).json({ mensagem: 'Usuário excluído. Contate o administrador.' });
        }

        if (result.rows.length === 0) {
            return res.status(401).json({ mensagem: 'Usuário não encontrado' });
        }

        const usuario = result.rows[0];

        // Gera o hash MD5 da senha recebida
        const senhaHash = crypto.createHash('md5').update(ususenha).digest('hex');

        if (usuario.ususenha !== senhaHash) {
            return res.status(401).json({ mensagem: 'Senha incorreta' });
        }

        // Se tudo ok, retorna sucesso

        const token = jwt.sign({ 
            usuemail: usuario.usuemail,
            usucod: usuario.usucod,
            usunome: usuario.usunome,
            usuadm: usuario.usuadm,
            ususta: usuario.ususta    }, 'chave-secreta', { expiresIn: '60m' });

        res.cookie('token',token,{
            httpOnly: true,
            secure: process.env.HTTPS,
            sameSite: 'Strict',
        });

        res.status(200).json({ mensagem: 'Login bem-sucedido',token, usunome: usuario.usunome, usuemail: usuario.usuemail, usuadm: usuario.usuadm, ususta: usuario.ususta  });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao validar login' });
    }
};

exports.atualizarCadastro = async (req, res) => {
    const { id } = req.params;
    const { usunome, usuemail, ususenha } = req.body;

    try {
        // Gera o hash MD5 da nova senha
        const newSenhaHash = crypto.createHash('md5').update(ususenha).digest('hex');

        await pool.query('UPDATE usu SET usunome = $1, ususenha = $2 WHERE usucod = $3', [usunome, newSenhaHash, id]);


        res.status(200).json({ mensagem: 'Senha atualizada com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar senha' });
    }
};

exports.cadastrarlogin = async (req, res) => {
  const { usunome, usuemail, ususenha } = req.body;
  const senhaHash = crypto.createHash('md5').update(ususenha).digest('hex');

  try {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM usu WHERE usuemail = $1',
      [usuemail]
    );
    if (rowCount > 0) {
      return res.status(409).json({ error: 'Email já existe na base de dados, Faça o Login!' });
    }
    await pool.query(
      'INSERT INTO usu (usunome, usuemail, ususenha) VALUES ($1, $2, $3)',
      [usunome, usuemail, senhaHash]
    );
    return res.status(201).json({ message: 'Usuário cadastrado com sucesso' });

  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
};

exports.listarlogin = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT usucod, usunome, usuemail FROM usu WHERE usucod = $1',
            [req.token.usucod]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao listar documentos' });
    }
};


