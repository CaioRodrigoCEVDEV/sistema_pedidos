/**
 * Part Groups Feature Tests
 * 
 * These tests validate the part groups (compatibility groups) functionality.
 * 
 * PREREQUISITES:
 * - PostgreSQL database running with the schema created
 * - Environment variables configured (.env file)
 * - Run migration first: node -e "require('./src/config/atualizardb').atualizarDB()"
 * 
 * HOW TO RUN:
 * node tests/partGroups.test.js
 * 
 * NOTE: These are integration tests that require a database connection.
 * For production use, consider setting up a separate test database.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Simple test framework
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value should not be null');
  }
}

async function test(name, fn) {
  testsRun++;
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Load dependencies
let pool;
let partGroupModels;

try {
  pool = require('../src/config/db');
  partGroupModels = require('../src/models/partGroupModels');
} catch (error) {
  console.error('Failed to load dependencies:', error.message);
  console.log('\nMake sure you have:');
  console.log('1. Set up the .env file with database credentials');
  console.log('2. Installed dependencies (npm install)');
  console.log('3. Run this from the project root directory');
  process.exit(1);
}

// Test data cleanup
async function cleanup() {
  try {
    // Clean up test data
    await pool.query("DELETE FROM part_group_audit WHERE reason LIKE 'test_%'");
    await pool.query("DELETE FROM part_groups WHERE name LIKE 'Test Group%'");
  } catch (error) {
    console.log('Cleanup warning:', error.message);
  }
}

// Tests
async function runTests() {
  console.log('\n🧪 Part Groups Feature Tests\n');
  console.log('=' .repeat(50));

  // Test 1: Create a new group
  await test('Create a new part group', async () => {
    const group = await partGroupModels.createGroup('Test Group 1', 100);
    assertNotNull(group, 'Group should be created');
    assertNotNull(group.id, 'Group should have an ID');
    assertEqual(group.name, 'Test Group 1', 'Group name should match');
    assertEqual(group.stock_quantity, 100, 'Stock quantity should match');
  });

  // Test 2: List groups
  await test('List all groups', async () => {
    const groups = await partGroupModels.listAllGroups();
    assert(Array.isArray(groups), 'Should return an array');
    assert(groups.length > 0, 'Should have at least one group');
  });

  // Test 3: Get group by ID
  await test('Get group by ID', async () => {
    // First create a group
    const created = await partGroupModels.createGroup('Test Group 2', 50);
    
    // Then get it by ID
    const group = await partGroupModels.getGroupById(created.id);
    assertNotNull(group, 'Should find the group');
    assertEqual(group.name, 'Test Group 2', 'Name should match');
    assert(Array.isArray(group.parts), 'Should have parts array');
  });

  // Test 4: Update group
  await test('Update group name', async () => {
    const created = await partGroupModels.createGroup('Test Group 3', 25);
    const updated = await partGroupModels.updateGroup(created.id, 'Test Group 3 Updated');
    
    assertNotNull(updated, 'Should return updated group');
    assertEqual(updated.name, 'Test Group 3 Updated', 'Name should be updated');
  });

  // Test 5: Update group stock with audit
  await test('Update group stock creates audit record', async () => {
    const created = await partGroupModels.createGroup('Test Group Stock', 10);
    
    // Update stock
    await partGroupModels.updateGroupStock(created.id, 25, 'test_adjustment');
    
    // Check stock was updated
    const updated = await partGroupModels.getGroupById(created.id);
    assertEqual(updated.stock_quantity, 25, 'Stock should be updated');
    
    // Check audit record exists
    const history = await partGroupModels.getGroupAuditHistory(created.id);
    assert(history.length > 0, 'Should have audit history');
    assertEqual(history[0].change, 15, 'Audit should show change of +15');
    assertEqual(history[0].reason, 'test_adjustment', 'Audit reason should match');
  });

  // Test 6: Delete group
  await test('Delete group', async () => {
    const created = await partGroupModels.createGroup('Test Group Delete', 0);
    const deleted = await partGroupModels.deleteGroup(created.id);
    
    assertNotNull(deleted, 'Should return deleted group');
    
    // Verify it's gone
    const found = await partGroupModels.getGroupById(created.id);
    assertEqual(found, null, 'Group should no longer exist');
  });

  // Test 7: Concurrency safety (basic check)
  await test('Stock decrement with insufficient stock fails', async () => {
    const created = await partGroupModels.createGroup('Test Group Concurrency', 5);
    
    // Create a test part linked to this group
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Test Part Concurrency', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    try {
      // Try to decrement more than available
      await partGroupModels.decrementGroupStock(partId, 10);
      throw new Error('Should have thrown insufficient stock error');
    } catch (error) {
      assert(
        error.message.includes('Insufficient') || error.message.includes('insufficient'),
        'Should throw insufficient stock error'
      );
    }
    
    // Cleanup test part
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Test 8: Stock decrement success
  await test('Stock decrement succeeds with sufficient stock', async () => {
    const created = await partGroupModels.createGroup('Test Group Decrement', 20);
    
    // Create a test part linked to this group
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Test Part Decrement', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    // Decrement stock
    const result = await partGroupModels.decrementGroupStock(partId, 5);
    
    assertEqual(result.success, true, 'Decrement should succeed');
    assertEqual(result.newStock, 15, 'New stock should be 15');
    
    // Verify audit record
    const history = await partGroupModels.getGroupAuditHistory(created.id);
    const saleAudit = history.find(h => h.reason === 'sale');
    assertNotNull(saleAudit, 'Should have sale audit record');
    assertEqual(saleAudit.change, -5, 'Audit should show -5 change');
    
    // Cleanup test part
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Test 9: Stock increment
  await test('Stock increment works correctly', async () => {
    const created = await partGroupModels.createGroup('Test Group Increment', 10);
    
    // Create a test part linked to this group
    const partResult = await pool.query(`
      INSERT INTO pro (prodes, promarcascod, protipocod, provl, part_group_id)
      SELECT 'Test Part Increment', 
             (SELECT marcascod FROM marcas LIMIT 1),
             (SELECT tipocod FROM tipo LIMIT 1),
             100,
             $1
      RETURNING procod
    `, [created.id]);
    
    const partId = partResult.rows[0].procod;
    
    // Increment stock
    const result = await partGroupModels.incrementGroupStock(partId, 5, 'test_return');
    
    assertEqual(result.success, true, 'Increment should succeed');
    assertEqual(result.newStock, 15, 'New stock should be 15');
    
    // Cleanup test part
    await pool.query('DELETE FROM pro WHERE procod = $1', [partId]);
  });

  // Cleanup
  await cleanup();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed}/${testsRun} passed`);
  
  if (testsFailed > 0) {
    console.log(`❌ ${testsFailed} test(s) failed\n`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
}).finally(() => {
  // Close pool after tests
  setTimeout(() => {
    pool.end();
  }, 1000);
});
