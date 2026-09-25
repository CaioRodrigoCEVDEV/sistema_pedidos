const pool = require("../config/db");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const releaseModels = require("../models/releaseModels");
const { MASTER_EMAIL } = require("../config/masterUser");

// Substitui as permissões de tela de um usuário dentro de uma transação.
// A presença da linha com permitido='S' libera a tela; a ausência mantém o
// acesso negado.
//
// Deve receber um client já em transação. O advisory lock serializa alterações
// do mesmo usuário (cliques repetidos em Salvar não geram chave duplicada) e o
// ON CONFLICT torna o INSERT idempotente.
async function salvarTelasUsuario(client, usucod, telas) {
  if (!usucod || !Array.isArray(telas)) return;

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('usu_telas'), $1::int)",
    [usucod]
  );
  await client.query("DELETE FROM usu_telas WHERE usutelausucod = $1", [usucod]);

  if (telas.length === 0) return;

  await client.query(
    `INSERT INTO usu_telas (usutelausucod, usutelatelacod, usutelapermitido)
     SELECT $1, telacod, 'S' FROM telas WHERE telachave = ANY($2::text[])
     ON CONFLICT (usutelausucod, usutelatelacod)
     DO UPDATE SET usutelapermitido = 'S'`,
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

// Apenas administradores podem alterar as telas liberadas (e a flag de
// administrador) de um usuário.
function requisicaoDeAdmin(req) {
  return Boolean(req.token && req.token.usuadm === "S");
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
  // Editar usuário (inclusive telas e flag de administrador) é exclusivo de
  // administradores. Ter a tela "usuarios" apenas permite visualizar a lista.
  if (!requisicaoDeAdmin(req)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  const { id } = req.params;
  const { usunome, ususenha, usuadm, ususta, usurca, telas } = req.body;
  const { usupv, usuest } = derivarFlagsTela(telas, req.body);

  const trocarSenha = !(ususenha === undefined || ususenha.trim() === "");
  const client = await pool.connect();
  try {
    // A atualização do usuário e a substituição das telas acontecem na mesma
    // transação: ou tudo é aplicado, ou nada é.
    await client.query("BEGIN");

    let result;
    if (!trocarSenha) {
      result = await client.query(
        "UPDATE usu SET usunome = $1, usuadm = $2, ususta = $3,usupv = COALESCE($4, usupv) ,usuest = COALESCE($5, usuest), usurca = $6 WHERE usuemail = $7 RETURNING usucod",
        [usunome, usuadm, ususta, usupv, usuest, usurca, id]
      );
    } else {
      // Gera o hash MD5 da nova senha
      const newSenhaHash = crypto
        .createHash("md5")
        .update(ususenha)
        .digest("hex");

      result = await client.query(
        "UPDATE usu SET  usunome = $1, ususenha = $2,usuadm = $3, ususta = $4 ,usupv = COALESCE($5, usupv) ,usuest = COALESCE($6, usuest), usurca = $7 WHERE usuemail = $8 RETURNING usucod",
        [usunome, newSenhaHash, usuadm, ususta, usupv, usuest, usurca, id]
      );
    }

    const usucod = result.rows[0] && result.rows[0].usucod;
    await salvarTelasUsuario(client, usucod, telas);

    await client.query("COMMIT");
    res.status(200).json({ mensagem: "Usuario atualizado com sucesso" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar usuario" });
  } finally {
    client.release();
  }
};

exports.cadastrarlogin = async (req, res) => {
  // Criar usuário é exclusivo de administradores. A tela "usuarios" apenas
  // permite visualizar a lista.
  if (!requisicaoDeAdmin(req)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  const { usunome, usuemail, ususenha, usuadm, ususta, usurca, telas } =
    req.body;
  const { usupv, usuest } = derivarFlagsTela(telas, req.body);
  const senhaHash = crypto.createHash("md5").update(ususenha).digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      "SELECT 1 FROM usu WHERE usuemail = $1",
      [usuemail]
    );
    if (rowCount > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "Email já existe na base de dados, Faça o Login!" });
    }
    const result = await client.query(
      "INSERT INTO usu (usunome, usuemail, ususenha,usuadm,ususta,usupv,usuest,usurca) VALUES ($1, $2, $3,$4,$5,$6,$7,$8) RETURNING usucod",
      [usunome, usuemail, senhaHash, usuadm, ususta, usupv || "N", usuest || "N", usurca]
    );
    await salvarTelasUsuario(client, result.rows[0].usucod, telas);

    await client.query("COMMIT");
    return res.status(201).json({ message: "Usuário cadastrado com sucesso" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Erro ao cadastrar usuário:", error);
    return res.status(500).json({ error: "Erro ao cadastrar usuário" });
  } finally {
    client.release();
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
        WHERE u.ususta in ('A','I') and u.usuemail <> $1
        ORDER BY u.ususta,u.usucod DESC`,
      [MASTER_EMAIL]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuarios" });
  }
};

exports.excluirCadastro = async (req, res) => {
  // Excluir usuário é exclusivo de administradores. A tela "usuarios" apenas
  // permite visualizar a lista.
  if (!requisicaoDeAdmin(req)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

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
      `SELECT usucod,usunome,usuemail,usurca FROM usu WHERE ususta in ('A','I') and usurca = 'S' and usuemail <> $1 ORDER BY ususta,usucod DESC`,
      [MASTER_EMAIL]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuarios" });
  }
};

exports.viuVersao = async (req, res) => {
  const body = req.body || {};
  let versao = typeof body.versao === "string" ? body.versao.trim() : "";

  // Compatibilidade com clientes antigos em cache: sinalizam "visto" via
  // viuversao = "S", sem informar a versão. Assume a mais recente.
  if (!versao && body.viuversao === "S") {
    versao = (await releaseModels.latestVersion()) || "";
  }

  if (!versao || versao.length > 64) {
    return res.status(400).json({ error: "Versão inválida" });
  }

  try {
    await pool.query(
      `UPDATE usu SET usuversaovista = $1, usuviuversao = 'S' WHERE usucod = $2`,
      [versao, req.token.usucod]
    );

    res.status(200).json({ mensagem: "Versão visualizada com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao visualizar versão" });
  }
};

exports.usuViuVersao = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT usucod,usuviuversao,usuversaovista FROM usu WHERE usucod = $1`,
      [req.token.usucod]
    );

    let versaoAtual = releaseModels.versionCache.get();
    if (!versaoAtual) {
      const version = await releaseModels.latestVersion();
      versaoAtual = releaseModels.versionCache.set({ version: version || null });
    }

    res.status(200).json({
      ...(result.rows[0] || {}),
      versaoAtual: versaoAtual ? versaoAtual.version : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter viuversao" });
  }
};

// Preferência "já visualizou o tour guiado" da tela de Vitrines.
// Sempre usa o usuário do token (nunca o corpo da requisição).
exports.viuTour = async (req, res) => {
  const viuTour = req.body && req.body.viuTour === "S" ? "S" : "N";

  try {
    await pool.query(`UPDATE usu SET usuvitour = $1 WHERE usucod = $2`, [
      viuTour,
      req.token.usucod,
    ]);

    res.status(200).json({ mensagem: "Preferência do tour atualizada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar preferência do tour" });
  }
};

exports.usuViuTour = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT usucod,usuvitour FROM usu WHERE usucod = $1`,
      [req.token.usucod]
    );
    res.status(200).json(result.rows[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter preferência do tour" });
  }
};

// Preferência "já viu o tour do item Vitrines no menu" (apresentado no shell
// autenticado). Também usa sempre o usuário do token.
exports.viuTourMenu = async (req, res) => {
  const viuTourMenu = req.body && req.body.viuTourMenu === "S" ? "S" : "N";

  try {
    await pool.query(`UPDATE usu SET usuvitourmenu = $1 WHERE usucod = $2`, [
      viuTourMenu,
      req.token.usucod,
    ]);

    res.status(200).json({ mensagem: "Preferência do tour do menu atualizada" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Erro ao atualizar preferência do tour do menu" });
  }
};

exports.usuViuTourMenu = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT usucod,usuvitourmenu FROM usu WHERE usucod = $1`,
      [req.token.usucod]
    );
    res.status(200).json(result.rows[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao obter preferência do tour do menu" });
  }
};
