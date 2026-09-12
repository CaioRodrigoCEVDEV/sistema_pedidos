const assert = require('assert');

process.env.LOGIN_MAX_ATTEMPTS = '4';
process.env.LOGIN_BLOCK_MS = '60';
process.env.LOGIN_WINDOW_MS = '60000';

const {
  buildLoginKey,
  checkLoginAttempt,
  registerLoginFailure,
  resetLoginAttempts,
  clearAllLoginAttempts,
} = require('../src/utils/loginAttempts');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const testes = [];
function test(nome, fn) {
  testes.push({ nome, fn });
}

test('bloqueia somente após a 4ª falha', () => {
  clearAllLoginAttempts();
  const key = buildLoginKey('10.0.0.1', 'user@teste.com');

  for (let i = 1; i <= 3; i++) {
    registerLoginFailure(key);
    assert.strictEqual(checkLoginAttempt(key).blocked, false, `não deveria bloquear na falha ${i}`);
  }

  registerLoginFailure(key);
  const resultado = checkLoginAttempt(key);
  assert.strictEqual(resultado.blocked, true, 'deveria bloquear após a 4ª falha');
  assert.ok(resultado.retryAfterSec >= 1, 'deveria informar Retry-After');
});

test('expira o bloqueio após o tempo configurado', async () => {
  clearAllLoginAttempts();
  const key = buildLoginKey('10.0.0.2', 'user@teste.com');

  for (let i = 0; i < 4; i++) registerLoginFailure(key);
  assert.strictEqual(checkLoginAttempt(key).blocked, true);

  await sleep(90);
  assert.strictEqual(checkLoginAttempt(key).blocked, false, 'bloqueio deveria expirar');
});

test('reset limpa o contador após login bem-sucedido', () => {
  clearAllLoginAttempts();
  const key = buildLoginKey('10.0.0.3', 'user@teste.com');

  for (let i = 0; i < 4; i++) registerLoginFailure(key);
  assert.strictEqual(checkLoginAttempt(key).blocked, true);

  resetLoginAttempts(key);
  assert.strictEqual(checkLoginAttempt(key).blocked, false);
});

test('chaves diferentes (IP ou e-mail) não interferem entre si', () => {
  clearAllLoginAttempts();
  const alvo = buildLoginKey('10.0.0.4', 'user@teste.com');
  const outroIp = buildLoginKey('10.0.0.5', 'user@teste.com');
  const outroEmail = buildLoginKey('10.0.0.4', 'outro@teste.com');

  for (let i = 0; i < 4; i++) registerLoginFailure(alvo);

  assert.strictEqual(checkLoginAttempt(alvo).blocked, true);
  assert.strictEqual(checkLoginAttempt(outroIp).blocked, false);
  assert.strictEqual(checkLoginAttempt(outroEmail).blocked, false);
});

test('buildLoginKey normaliza e-mail e IPv6 mapeado', () => {
  assert.strictEqual(
    buildLoginKey('::ffff:192.168.0.1', '  User@Teste.COM '),
    '192.168.0.1|user@teste.com'
  );
});

(async () => {
  let falhas = 0;
  for (const { nome, fn } of testes) {
    try {
      await fn();
      console.log(`ok - ${nome}`);
    } catch (err) {
      falhas++;
      console.error(`FALHOU - ${nome}`);
      console.error(err);
    }
  }

  if (falhas > 0) {
    console.error(`\n${falhas} de ${testes.length} teste(s) falharam.`);
    process.exit(1);
  }
  console.log(`\n${testes.length} teste(s) passaram.`);
})();
