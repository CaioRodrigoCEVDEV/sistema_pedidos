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
    get() {
      return "";
    },
  };
}

async function runMiddleware(req, res, chave = "estoque") {
  await requireTela(chave)(req, res, () => {
    res.next = true;
  });
  return res;
}

test("acesso é liberado pela tela, independente de admin e módulos", async () => {
  const original = db.query;
  db.query = async () => ({ rowCount: 1 });
  try {
    const req = fakeReq(
      token({
        usucod: 1,
        usuadm: "N",
        usuest: "N",
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

test("sem a tela liberada o acesso é negado", async () => {
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

test("administrador sem a tela liberada também é negado", async () => {
  const original = db.query;
  let consultou = false;
  db.query = async () => {
    consultou = true;
    return { rowCount: 0 };
  };
  try {
    const req = fakeReq(token({ usucod: 3, usuadm: "S", empusaest: "S" }));
    const res = await runMiddleware(req, fakeRes());
    assert.equal(consultou, true, "não deve haver bypass de administrador");
    assert.equal(res.next, undefined);
    assert.equal(res.statusCode, 403);
  } finally {
    db.query = original;
  }
});

test("usuário master acessa qualquer tela sem consultar usu_telas", async () => {
  const original = db.query;
  let consultou = false;
  db.query = async () => {
    consultou = true;
    return { rowCount: 0 };
  };
  try {
    const req = fakeReq(
      token({
        usucod: 1,
        usuadm: "S",
        usuemail: "ADMIN@orderup.com.br",
      })
    );
    const res = await runMiddleware(req, fakeRes(), "tela-inexistente");
    assert.equal(res.next, true);
    assert.equal(res.statusCode, null);
    assert.equal(consultou, false, "master não deve depender de usu_telas");
  } finally {
    db.query = original;
  }
});
