const pool = require("../config/db");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Substitui as permissões de tela de um usuário. A presença da linha com
// permitido='S' libera a tela; a ausência mantém o acesso negado.
async function salvarTelasUsuario(usucod, telas) {
  if (!usucod || !Array.isArray(telas)) return;

  await pool.query("DELETE FROM usu_telas WHERE usutelausucod = $1", [usucod]);

  if (telas.length === 0) return;

  await pool.query(
    `INSERT INTO usu_telas (usutelausucod, usutelatelacod, usutelapermitido)
     SELECT $1, telacod, 'S' FROM telas WHERE telachave = ANY($2::text[])`,
    [usucod, telas]
  );
}

// Mantém as colunas legadas usupv/usuest coerentes com as telas liberadas.
// Elas continuam existindo para compatibilidade, mas a fonte da verdade das
// telas de Pedidos e Estoque passa a ser usu_telas.
function derivarFlagsTela(telas, fallback = {}) {
  if (Array.isArray(telas)) {
    return {
      usupv: telas.includes("pedidos") ? "S" : "N",
      usuest: telas.includes("estoque") ? "S" : "N",
    };
  }
  // Quando o cliente não envia a lista de telas nem as flags, mantém o valor
  // atual (COALESCE no UPDATE) em vez de gravar NULL.
  return {
    usupv: fallback.usupv || null,
    usuest: fallback.usuest || null,
  };
}

exports.validarLogin = async (req, res) => {
  const { usucod, usunome, usuemail, ususenha } = req.body;

  try {
    const result = await pool.query(
      "SELECT usucod,usunome,usuemail, ususenha FROM usu WHERE usuemail = $1",
      [usuemail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensagem: "Usuário não encontrado" });
    }

    const usuario = result.rows[0];

    // Gera o hash MD5 da senha recebida
    const senhaHash = crypto.createHash("md5").update(ususenha).digest("hex");

    if (usuario.ususenha !== senhaHash) {
      return res.status(401).json({ mensagem: "Senha incorreta" });
    }

    // Se tudo ok, retorna sucesso

    const token = jwt.sign(
      {
        usuemail: usuario.usuemail,
        usucod: usuario.usucod,
        usunome: usuario.usunome,
      },
      "chave-secreta",
      { expiresIn: "60m" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.HTTPS,
      sameSite: "Strict",
    });

    res.status(200).json({
      mensagem: "Login bem-sucedido",
      token,
      usunome: usuario.usunome,
      usuemail: usuario.usuemail,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao validar login" });
  }
};

exports.atualizarCadastro = async (req, res) => {
  const { id } = req.params;
  const { usunome, ususenha, usuadm, ususta, usurca, telas } = req.body;
  const { usupv, usuest } = derivarFlagsTela(telas, req.body);

  try {
    let usucod;

    if (ususenha === undefined || ususenha.trim() === "") {
      // Atualiza sem alterar a senha
      const result = await pool.query(
        "UPDATE usu SET usunome = $1, usuadm = $2, ususta = $3,usupv = COALESCE($4, usupv) ,usuest = COALESCE($5, usuest), usurca = $6 WHERE usuemail = $7 RETURNING usucod",
        [usunome, usuadm, ususta, usupv, usuest, usurca, id]
      );
      usucod = result.rows[0] && result.rows[0].usucod;
      await salvarTelasUsuario(usucod, telas);
      return res
        .status(200)
        .json({ mensagem: "Usuario atualizado com sucesso" });
    }

    // Gera o hash MD5 da nova senha
    const newSenhaHash = crypto
      .createHash("md5")
      .update(ususenha)
      .digest("hex");

    const result = await pool.query(
      "UPDATE usu SET  usunome = $1, ususenha = $2,usuadm = $3, ususta = $4 ,usupv = COALESCE($5, usupv) ,usuest = COALESCE($6, usuest), usurca = $7 WHERE usuemail = $8 RETURNING usucod",
      [usunome, newSenhaHash, usuadm, ususta, usupv, usuest, usurca, id]
    );
    usucod = result.rows[0] && result.rows[0].usucod;
    await salvarTelasUsuario(usucod, telas);

    res.status(200).json({ mensagem: "Usuario atualizado com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar usuario" });
  }
};

exports.cadastrarlogin = async (req, res) => {
  const { usunome, usuemail, ususenha, usuadm, ususta, usurca, telas } =
    req.body;
  const { usupv, usuest } = derivarFlagsTela(telas, req.body);
  const senhaHash = crypto.createHash("md5").update(ususenha).digest("hex");

  try {
    const { rowCount } = await pool.query(
      "SELECT 1 FROM usu WHERE usuemail = $1",
      [usuemail]
    );
    if (rowCount > 0) {
      return res
        .status(409)
        .json({ error: "Email já existe na base de dados, Faça o Login!" });
    }
    const result = await pool.query(
      "INSERT INTO usu (usunome, usuemail, ususenha,usuadm,ususta,usupv,usuest,usurca) VALUES ($1, $2, $3,$4,$5,$6,$7,$8) RETURNING usucod",
      [usunome, usuemail, senhaHash, usuadm, ususta, usupv || "N", usuest || "N", usurca]
    );
    await salvarTelasUsuario(result.rows[0].usucod, telas);
    return res.status(201).json({ message: "Usuário cadastrado com sucesso" });
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);
    return res.status(500).json({ error: "Erro ao cadastrar usuário" });
  }
};

// Trás somente o usuario logado
exports.listarlogin = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT usucod, usunome, usuemail FROM usu WHERE usucod = $1",
      [req.token.usucod]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar documentos" });
  }
};
// Trás todos os usuarios, utilizado apenos pelo adm
exports.listarUsuarios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*,
              COALESCE((
                SELECT json_agg(t.telachave ORDER BY t.telaordem)
                  FROM usu_telas ut
                  JOIN telas t ON t.telacod = ut.usutelatelacod
                 WHERE ut.usutelausucod = u.usucod
                   AND ut.usutelapermitido = 'S'
                   AND t.telaativa = 'S'
              ), '[]'::json) AS telas
         FROM usu u
        WHERE u.ususta in ('A','I') and u.usuemail <> 'admin@orderup.com.br'
        ORDER BY u.ususta,u.usucod DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuarios" });
  }
};

exports.excluirCadastro = async (req, res) => {
  const { id } = req.params;
  //const  ususta  = "X";

  try {
    //await pool.query(`UPDATE usu SET ususta = $1 , usuemail = usuemail || 'EX' WHERE usucod = $2`, [ususta,id]);
    await pool.query(`delete from usu  WHERE usucod = $1`, [id]);

    res.status(200).json({ mensagem: "Usuario Excluido com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao Excluir usuario" });
  }
};

exports.listarVendedores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT usucod,usunome,usuemail,usurca FROM usu WHERE ususta in ('A','I') and usurca = 'S' and usuemail <> 'admin@orderup.com.br' ORDER BY ususta,usucod DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuarios" });
  }
};

exports.viuVersao = async (req, res) => {
  const { usucod,viuversao } = req.body;

  try {
    await pool.query(`UPDATE usu SET usuviuversao = $1 WHERE usucod = $2`, [
      viuversao,
      usucod,
    ]);

    res.status(200).json({ mensagem: "Versão visualizada com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao visualizar versão" });
  }
};

exports.usuViuVersao = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT usucod,usuviuversao FROM usu WHERE usucod = $1`,
      [req.token.usucod]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter viuversao" });
  }
};
