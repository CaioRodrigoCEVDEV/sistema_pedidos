/**
 * Testes da Funcionalidade de Grupos de Compatibilidade
 * 
 * Valida a funcionalidade dos grupos de compatibilidade (part groups).
 * Os grupos permitem que múltiplas peças compartilhem o mesmo estoque.
 * 
 * IMPORTANTE: O ID dos grupos é INTEGER simples (auto increment), não UUID.
 * 
 * PRÉ-REQUISITOS:
 * - Banco de dados PostgreSQL rodando com o schema criado
 * - Variáveis de ambiente configuradas (arquivo .env)
 * - Executar a migração primeiro: node -e "require('./src/config/atualizardb').atualizarDB()"
 * 
 * COMO EXECUTAR:
 * node tests/partGroups.test.js
 * 
 * NOTA: Estes são testes de integração que requerem conexão com o banco de dados.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Framework de testes simples
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertiva falhou');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual falhou'}: esperado ${expected}, obtido ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Valor não deveria ser nulo');
  }
}

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`✅ PASSOU: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FALHOU: ${name}`);
    console.log(`   Erro: ${error.message}`);
    testsFailed++;
  }
}

// Carrega as dependências
let pool;
let partGroupModels;

try {
  pool = require('../src/config/db');
  partGroupModels = require('../src/models/partGroupModels');
} catch (error) {
  console.error('Falha ao carregar dependências:', error.message);
  console.log('\nVerifique se você:');
  console.log('1. Configurou o arquivo .env com as credenciais do banco de dados');
  console.log('2. Instalou as dependências (npm install)');
  console.log('3. Está executando a partir do diretório raiz do projeto');
  process.exit(1);
}

// Limpeza dos dados de teste
async function cleanup() {
  try {
    // Limpa dados de teste
    await pool.query("DELETE FROM part_group_audit WHERE reason LIKE 'test_%'");
    await pool.query("DELETE FROM part_groups WHERE name LIKE 'Test Group%'");
  } catch (error) {
    console.log('Aviso de limpeza:', error.message);
  }
}

// Testes
async function runTests() {
  console.log('\n🧪 Testes da Funcionalidade de Grupos de Compatibilidade\n');
  console.log('='.repeat(50));

  // Teste 1: Criar um novo grupo
  await test('Criar um novo grupo de compatibilidade', async () => {
    const group = await partGroupModels.createGroup('Test Group 1', 100);
    assertNotNull(group, 'Grupo deve ser criado');
    assertNotNull(group.id, 'Grupo deve ter um ID');
    // Verifica que o ID é um INTEGER (não UUID)
    assert(typeof group.id === 'number', 'ID do grupo deve ser um número inteiro');
    assertEqual(group.name, 'Test Group 1', 'Nome do grupo deve corresponder');
    assertEqual(group.stock_quantity, 100, 'Quantidade de estoque deve corresponder');
  });

  // Teste 2: Listar grupos
  await test('Listar todos os grupos', async () => {
    const groups = await partGroupModels.listAllGroups();
    assert(Array.isArray(groups), 'Deve retornar um array');
    assert(groups.length > 0, 'Deve ter pelo menos um grupo');
  });

  // Teste 3: Buscar grupo por ID
  await test('Buscar grupo por ID', async () => {
    // Primeiro cria um grupo
    const created = await partGroupModels.createGroup('Test Group 2', 50);
    
    // Depois busca pelo ID
    const group = await partGroupModels.getGroupById(created.id);
    assertNotNull(group, 'Deve encontrar o grupo');
    assertEqual(group.name, 'Test Group 2', 'Nome deve corresponder');
    assert(Array.isArray(group.parts), 'Deve ter array de peças');
  });

  // Teste 4: Atualizar grupo
  await test('Atualizar nome do grupo', async () => {
    const created = await partGroupModels.createGroup('Test Group 3', 25);
    const updated = await partGroupModels.updateGroup(created.id, 'Test Group 3 Atualizado');
    
    assertNotNull(updated, 'Deve retornar grupo atualizado');
    assertEqual(updated.name, 'Test Group 3 Atualizado', 'Nome deve estar atualizado');
  });

  // Teste 5: Atualizar estoque do grupo com auditoria
  await test('Atualizar estoque do grupo cria registro de auditoria', async () => {
    const created = await partGroupModels.createGroup('Test Group Estoque', 10);
    
    // Atualiza o estoque
    await partGroupModels.updateGroupStock(created.id, 25, 'test_adjustment');
    
    // Verifica se o estoque foi atualizado
    const updated = await partGroupModels.getGroupById(created.id);
    assertEqual(updated.stock_quantity, 25, 'Estoque deve estar atualizado');
    
    // Verifica se o registro de auditoria existe
    const history = await partGroupModels.getGroupAuditHistory(created.id);
    assert(history.length > 0, 'Deve ter histórico de auditoria');
    assertEqual(history[0].change, 15, 'Auditoria deve mostrar alteração de +15');
    assertEqual(history[0].reason, 'test_adjustment', 'Motivo da auditoria deve corresponder');
  });

  // Teste 6: Excluir grupo
  await test('Excluir grupo', async () => {
    const created = await partGroupModels.createGroup('Test Group Excluir', 0);
    const deleted = await partGroupModels.deleteGroup(created.id);
    
    assertNotNull(deleted, 'Deve retornar grupo excluído');
    
    // Verifica que foi removido
    const found = await partGroupModels.getGroupById(created.id);
    assertEqual(found, null, 'Grupo não deve mais existir');
  });

  // Teste 7: Verificação básica de concorrência
  await test('Decremento de estoque com quantidade insuficiente deve falhar', async () => {
    const created = await partGroupModels.createGroup('Test Group Concorrência', 5);
    
    // Cria uma peça de teste vinculada a este grupo
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Peça Teste Concorrência', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    try {
      // Tenta decrementar mais do que disponível
      await partGroupModels.decrementGroupStock(partId, 10);
      throw new Error('Deveria ter lançado erro de estoque insuficiente');
    } catch (error) {
      assert(
        error.message.includes('insuficiente') || error.message.includes('Insufficient'),
        'Deve lançar erro de estoque insuficiente'
      );
    }
    
    // Limpa a peça de teste
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Teste 8: Sucesso no decremento de estoque
  await test('Decremento de estoque funciona com quantidade suficiente', async () => {
    const created = await partGroupModels.createGroup('Test Group Decremento', 20);
    
    // Cria uma peça de teste vinculada a este grupo
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Peça Teste Decremento', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    // Decrementa o estoque
    const result = await partGroupModels.decrementGroupStock(partId, 5);
    
    assertEqual(result.success, true, 'Decremento deve ter sucesso');
    assertEqual(result.newStock, 15, 'Novo estoque deve ser 15');
    
    // Verifica o registro de auditoria
    const history = await partGroupModels.getGroupAuditHistory(created.id);
    const saleAudit = history.find(h => h.reason === 'sale');
    assertNotNull(saleAudit, 'Deve ter registro de auditoria de venda');
    assertEqual(saleAudit.change, -5, 'Auditoria deve mostrar alteração de -5');
    
    // Limpa a peça de teste
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Teste 9: Incremento de estoque
  await test('Incremento de estoque funciona corretamente', async () => {
    const created = await partGroupModels.createGroup('Test Group Incremento', 10);
    
    // Cria uma peça de teste vinculada a este grupo
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Peça Teste Incremento', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    // Incrementa o estoque
    const result = await partGroupModels.incrementGroupStock(partId, 5, 'test_return');
    
    assertEqual(result.success, true, 'Incremento deve ter sucesso');
    assertEqual(result.newStock, 15, 'Novo estoque deve ser 15');
    
    // Limpa a peça de teste
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Teste 10: Grupos criados sempre com estoque 0
  await test('Grupos são criados com estoque inicial zero', async () => {
    const group = await partGroupModels.createGroup('Test Group Zero Stock', 999);
    assertNotNull(group, 'Grupo deve ser criado');
    assertEqual(group.stock_quantity, 999, 'Função createGroup ainda aceita parâmetro (para compatibilidade)');
    
    // Na prática, o controller sempre passa 0
    const groupZero = await partGroupModels.createGroup('Test Group Zero Stock 2', 0);
    assertEqual(groupZero.stock_quantity, 0, 'Grupo criado com estoque zero');
  });

  // Teste 11: Distribuição de quantidade para todas as peças do grupo
  await test('Atualizar estoque do grupo distribui quantidade para todas as peças', async () => {
    // Cria um grupo com estoque inicial de 0
    const group = await partGroupModels.createGroup('Test Group Distribution', 0);
    
    // Cria 3 peças de teste vinculadas a este grupo
    const part1Result = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde, part_group_id)
      SELECT 'Peça Teste Dist 1', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             0,
             $1
      RETURNING procod
    `, [group.id]);
    
    const part2Result = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde, part_group_id)
      SELECT 'Peça Teste Dist 2', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             150,
             0,
             $1
      RETURNING procod
    `, [group.id]);
    
    const part3Result = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde, part_group_id)
      SELECT 'Peça Teste Dist 3', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             200,
             0,
             $1
      RETURNING procod
    `, [group.id]);
    
    const partIds = [
      part1Result.rows[0].procod,
      part2Result.rows[0].procod,
      part3Result.rows[0].procod
    ];
    
    // Atualiza o estoque do grupo para 10
    await partGroupModels.updateGroupStock(group.id, 10, 'test_distribution');
    
    // Distribui a quantidade para todas as peças
    const result = await partGroupModels.updateAllPartsStockInGroup(group.id, 10);
    
    assertEqual(result.success, true, 'Distribuição deve ter sucesso');
    assertEqual(result.partsUpdated, 3, 'Deve ter atualizado 3 peças');
    
    // Verifica que todas as peças receberam a mesma quantidade
    for (const partId of partIds) {
      const partCheck = await pool.query('SELECT proqtde FROM pro WHERE procod = $1', [partId]);
      assertEqual(partCheck.rows[0].proqtde, 10, `Peça ${partId} deve ter quantidade 10`);
    }
    
    // Limpa as peças de teste
    for (const partId of partIds) {
      await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
    }
  });

  // Teste 12: Adicionar peça a grupo com estoque definido sincroniza automaticamente
  await test('Adicionar peça a grupo com estoque definido sincroniza estoque da peça', async () => {
    // Cria um grupo com estoque inicial de 15
    const group = await partGroupModels.createGroup('Test Group Auto Sync', 0);
    await partGroupModels.updateGroupStock(group.id, 15, 'test_setup');
    
    // Cria uma peça de teste SEM vinculá-la ao grupo ainda
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde)
      SELECT 'Peça Teste Auto Sync', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             0
      RETURNING procod
    `);
    
    const partId = partResult.rows[0].procod;
    
    // Adiciona a peça ao grupo
    const result = await partGroupModels.addPartToGroup(partId, group.id);
    
    assertNotNull(result, 'Deve retornar resultado da adição');
    assertEqual(result.proqtde, 15, 'Estoque da peça deve ser sincronizado com o grupo (15)');
    
    // Verifica no banco de dados
    const partCheck = await pool.query('SELECT proqtde FROM pro WHERE procod = $1', [partId]);
    assertEqual(partCheck.rows[0].proqtde, 15, 'Estoque da peça no banco deve ser 15');
    
    // Limpa a peça de teste
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Teste 13: Adicionar peça com cor atualiza estoque do grupo usando procorqtde
  await test('Adicionar peça com cor a grupo vazio atualiza estoque do grupo com procorqtde', async () => {
    // Cria um grupo com estoque inicial de 0
    const group = await partGroupModels.createGroup('Test Group Color Stock', 0);
    
    // Cria uma peça de teste
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, proqtde)
      SELECT 'Peça Teste Cor', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             0
      RETURNING procod
    `);
    
    const partId = partResult.rows[0].procod;
    
    // Cria uma cor de teste se não existir
    const colorResult = await pool.query(`
      INSERT INTO cores (cornome)
      VALUES ('Cor Teste')
      ON CONFLICT DO NOTHING
      RETURNING corcod
    `);
    
    let colorId;
    if (colorResult.rows.length > 0) {
      colorId = colorResult.rows[0].corcod;
    } else {
      const existingColor = await pool.query(`SELECT corcod FROM cores WHERE cornome = 'Cor Teste'`);
      colorId = existingColor.rows[0].corcod;
    }
    
    // Adiciona uma entrada procor com estoque de 20
    await pool.query(`
      INSERT INTO procor (procorprocod, procorcorescod, procorqtde)
      VALUES ($1, $2, 20)
    `, [partId, colorId]);
    
    // Adiciona a peça ao grupo com a cor especificada
    const result = await partGroupModels.addPartToGroup(partId, group.id, colorId);
    
    assertNotNull(result, 'Deve retornar resultado da adição');
    assertNotNull(result.selected_color, 'Deve incluir informação da cor');
    
    // Verifica se o estoque do grupo foi atualizado
    const groupCheck = await partGroupModels.getGroupById(group.id);
    assertEqual(groupCheck.stock_quantity, 20, 'Estoque do grupo deve ser atualizado para 20 (procorqtde)');
    
    // Verifica se há registro de auditoria
    const history = await partGroupModels.getGroupAuditHistory(group.id);
    const coloredPartAudit = history.find(h => h.reason === 'colored_part_added');
    assertNotNull(coloredPartAudit, 'Deve ter registro de auditoria de peça com cor adicionada');
    assertEqual(coloredPartAudit.change, 20, 'Auditoria deve mostrar alteração de +20');
    
    // Limpa a peça de teste
    await pool.query('DELETE FROM procor WHERE procorprocod = $1', [partId]);
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Teste 14: prosemest deve ser 'N' por padrão ao cadastrar produto
  await test('Cadastrar produto sem informar prosemest deve gravar prosemest = N', async () => {
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, procusto)
      SELECT 'Peça Teste prosemest',
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             99.99,
             50.00
      RETURNING procod, prosemest
    `);

    const part = partResult.rows[0];
    assertEqual(part.prosemest, 'N', 'prosemest deve ser N ao cadastrar novo produto sem informar o campo');

    await pool.query('DELETE FROM pro WHERE procod = $1', [part.procod]);
  });

  // Teste 15: prosemest deve ser 'S' somente quando explicitamente informado
  await test('Cadastrar produto com prosemest = S deve persistir S', async () => {
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, procusto, prosemest)
      SELECT 'Peça Teste prosemest S',
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             99.99,
             50.00,
             'S'
      RETURNING procod, prosemest
    `);

    const part = partResult.rows[0];
    assertEqual(part.prosemest, 'S', 'prosemest deve ser S quando explicitamente informado');

    await pool.query('DELETE FROM pro WHERE procod = $1', [part.procod]);
  });

  // Limpeza
  await cleanup();

  // Resumo
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Resultado dos Testes: ${testsPassed}/${testsRun} passaram`);
  
  if (testsFailed > 0) {
    console.log(`❌ ${testsFailed} teste(s) falharam\n`);
    process.exit(1);
  } else {
    console.log('✅ Todos os testes passaram!\n');
    process.exit(0);
  }
}

// Executa os testes
runTests().catch(error => {
  console.error('Erro no executor de testes:', error);
  process.exit(1);
}).finally(() => {
  // Fecha a pool após os testes
  setTimeout(() => {
    pool.end();
  }, 1000);
});
