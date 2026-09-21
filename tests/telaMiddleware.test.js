const assert = require("node:assert/strict");
const { test } = require("node:test");
const jwt = require("jsonwebtoken");

const db = require("../src/config/db");
const requireTela = require("../src/middlewares/telaMiddleware");

function token(payload) {
  return jwt.sign(payload, "chave-secreta", { expiresIn: "60m" });
}

function fakeRes() {
  return {
    statusCode: null,
    redirected: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect(url) {
      this.redirected = url;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

function fakeReq(tokenValue) {
  return {
    cookies: { token: tokenValue },
    token: null,
    user: null,
  };
}

async function runMiddleware(req, res, chave = "estoque") {
  await requireTela(chave)(req, res, () => {
    res.next = true;
  });
  return res;
}

test("acesso por tela liberada não é bloqueado por empusaest/empusapv desligados", async () => {
  const original = db.query;
  db.query = async () => ({ rowCount: 1 });
  try {
    const req = fakeReq(
      token({
        usucod: 1,
        usuadm: "N",
        usuest: "S",
        empusaest: "N",
        empusapv: "N",
      })
    );
    const res = await runMiddleware(req, fakeRes());
    assert.equal(res.next, true);
    assert.equal(res.statusCode, null);
    assert.equal(res.redirected, null);
  } finally {
    db.query = original;
  }
});

test("sem permissão de tela o acesso é negado", async () => {
  const original = db.query;
  db.query = async () => ({ rowCount: 0 });
  try {
    const req = fakeReq(token({ usucod: 2, usuadm: "N", empusaest: "S", empusapv: "S" }));
    const res = await runMiddleware(req, fakeRes());
    assert.equal(res.next, undefined);
    assert.equal(res.statusCode, 403);
  } finally {
    db.query = original;
  }
});

test("administrador acessa sem consultar telas", async () => {
  const original = db.query;
  db.query = async () => {
    throw new Error("não deveria consultar telas para admin");
  };
  try {
    const req = fakeReq(token({ usucod: 3, usuadm: "S", empusaest: "N" }));
    const res = await runMiddleware(req, fakeRes());
    assert.equal(res.next, true);
  } finally {
    db.query = original;
  }
});
