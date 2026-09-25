const { test } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const pool = require('../src/config/db');
const { ESTOQUE_HISTORICO_SQL } = require('../src/config/estoqueHistoricoSchema');
const { montarConsulta } = require('../src/controllers/estoqueHistoricoController');

test('valida datas e parametriza filtros', () => {
  assert.throws(() => montarConsulta({ inicio: '2026-02-30' }));
  assert.throws(() => montarConsulta({ inicio: '2026-09-20', fim: '2026-09-01' }));
  assert.throws(() => montarConsulta({ marca: 'abc' }));
  const query = montarConsulta({ q: "' OR true --", modelo: '1' });
  assert.ok(!query.sql.includes("' OR true --"));
  assert.ok(query.params.includes("%' OR true --%"));
});

test('ledger transacional: grupos, cores, produto, filtros e importação idempotente', async () => {
  const client = await pool.connect();
  const schema = `history_test_${process.pid}`;
  const sql = s => s.replaceAll('public.', `${schema}.`);
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE marcas(marcascod int,marcasdes text);
      CREATE TABLE tipo(tipocod int,tipodes text);
      CREATE TABLE modelo(modcod int,moddes text);
      CREATE TABLE promod(promodprocod int,promodmodcod int);
      CREATE TABLE cores(corcod int,cornome text);
      CREATE TABLE pro(procod int,prodes text,promarcascod int,protipocod int,promodcod int,proqtde int);
      CREATE TABLE procor(procorid int,procorprocod int,procorcorescod int,procorqtde int);
      CREATE TABLE part_groups(id int,name text,stock_quantity int);
      CREATE TABLE part_group_items(group_id int,procorid int);
      CREATE TABLE part_group_audit(id int,part_group_id int,change int,reason text,created_at timestamptz);
      INSERT INTO marcas VALUES(1,'Marca'); INSERT INTO tipo VALUES(1,'Tela'); INSERT INTO modelo VALUES(1,'A01');
      INSERT INTO cores VALUES(1,'Azul');
      INSERT INTO pro VALUES(1,'Peça simples',1,1,1,10),(2,'Peça colorida',1,1,1,0),(3,'Peça agrupada',1,1,1,10);
      INSERT INTO procor VALUES(1,1,0,10),(2,2,1,10),(3,3,0,10);
      INSERT INTO part_groups VALUES(1,'Grupo dourado',10);
      INSERT INTO part_group_items VALUES(1,3);
      INSERT INTO part_group_audit VALUES(1,1,10,'Reposição','2026-09-01T12:00:00Z');`);
    await client.query(sql(ESTOQUE_HISTORICO_SQL));
    await client.query(sql(ESTOQUE_HISTORICO_SQL));
    assert.equal((await client.query('SELECT count(*)::int n FROM estoque_historico')).rows[0].n, 1);
    await client.query(`UPDATE pro SET proqtde=8 WHERE procod=1;
      UPDATE procor SET procorqtde=8 WHERE procorid=1;
      UPDATE procor SET procorqtde=7 WHERE procorid=2;
      UPDATE part_groups SET stock_quantity=5 WHERE id=1;
      UPDATE procor SET procorqtde=5 WHERE procorid=3;
      UPDATE pro SET proqtde=5 WHERE procod=3;
      UPDATE pro SET proqtde=8 WHERE procod=1;`);
    const rows = (await client.query('SELECT origem,variacao FROM estoque_historico ORDER BY id')).rows;
    assert.deepEqual(rows.map(r => [r.origem,Number(r.variacao)]), [['grupo',10],['produto',-2],['cor',-3],['grupo',-5]]);
    const query = montarConsulta({marca:'1',modelo:'1',tipo:'1',q:'agrupada'});
    const result = (await client.query(sql(query.sql),query.params)).rows[0];
    assert.equal(result.total, 2); assert.equal(Number(result.saidas), 5);
    const period = montarConsulta({inicio:'2026-09-01',fim:'2026-09-01'});
    assert.equal((await client.query(sql(period.sql),period.params)).rows[0].total,1);
    await client.query("DELETE FROM part_group_items; DELETE FROM pro WHERE procod=3;");
    assert.equal((await client.query(sql(query.sql),query.params)).rows[0].total,2);
    await client.query('SAVEPOINT adjustment');
    await client.query('UPDATE pro SET proqtde=100 WHERE procod=1');
    await client.query('ROLLBACK TO SAVEPOINT adjustment');
    assert.equal((await client.query('SELECT count(*)::int n FROM estoque_historico')).rows[0].n,4);
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
  }
});
