const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const catalogoCache = require("../utils/catalogoCache");
const showcasesCache = require("../utils/showcasesCache");
const {
  invalidateEstoqueConfigCache,
} = require("../utils/estoqueConfig");

exports.listarEmpresa = async (req, res) => {
  try {
    const result = await pool.query("select * from emp");
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados da empresa" });
  }
};

exports.editarNumeroEmpresa = async (req, res) => {
  const { empwhatsapp1, empwhatsapp2, emprazao } = req.body;
  try {
    const result = await pool.query(
      "update emp set empwhatsapp1 = $1, empwhatsapp2 = $2, emprazao=$3 RETURNING *",
      [empwhatsapp1, empwhatsapp2, emprazao]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados da empresa" });
  }
};

// Atualiza a configuracao de controle de estoque da empresa.
// empusaest = 'S' controla estoque (flags automaticas); 'N' ignora as flags.
// empestoqmin define a partir de quantas unidades o produto e "acabando".
exports.editarConfigEstoque = async (req, res) => {
  const { empusaest, empestoqmin } = req.body || {};

  const usaEstoque =
    String(empusaest || "N").trim().toUpperCase() === "S" ? "S" : "N";

  const min = Number(empestoqmin);
  if (!Number.isInteger(min) || min < 0 || min > 9999) {
    return res.status(400).json({
      error: "Quantidade minima invalida. Informe um inteiro entre 0 e 9999.",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE emp
          SET empusaest = $1, empestoqmin = $2
        RETURNING empusaest, empestoqmin`,
      [usaEstoque, min]
    );

    invalidateEstoqueConfigCache();
    catalogoCache.invalidate();
    showcasesCache.invalidate();

    // Reemite o token para que o modulo Estoque (empusaest) passe a valer na
    // sessao atual sem exigir novo login.
    const decoded = req.token || {};
    const novoToken = jwt.sign(
      {
        usuemail: decoded.usuemail,
        usucod: decoded.usucod,
        usunome: decoded.usunome,
        usuadm: decoded.usuadm,
        usupv: decoded.usupv,
        usuest: decoded.usuest,
        empusaest: usaEstoque,
        empusapv: decoded.empusapv,
      },
      "chave-secreta",
      { expiresIn: "60m" }
    );

    res.cookie("token", novoToken, {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env.HTTPS,
    });

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao salvar configuracao de estoque" });
  }
};

exports.dadosPagamento = async (req, res) => {
  try {
    const result = await pool.query("select empdtvenc, empdtpag from emp");
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados de pagamento" });
  }
};
