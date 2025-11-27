const pool = require("../config/db");

/**
 * Part Group Model/DAO
 * Handles compatibility groups for shared inventory management
 */

/**
 * Get all part groups with their member parts count
 */
async function listAllGroups() {
  const result = await pool.query(`
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at,
      COUNT(p.procod) as parts_count
    FROM part_groups pg
    LEFT JOIN pro p ON p.part_group_id = pg.id
    GROUP BY pg.id, pg.name, pg.stock_quantity, pg.created_at, pg.updated_at
    ORDER BY pg.name
  `);
  return result.rows;
}

/**
 * Get a single part group by ID with its member parts
 */
async function getGroupById(groupId) {
  const groupResult = await pool.query(`
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at
    FROM part_groups pg
    WHERE pg.id = $1
  `, [groupId]);

  if (groupResult.rows.length === 0) {
    return null;
  }

  const partsResult = await pool.query(`
    SELECT 
      p.procod,
      p.prodes,
      p.provl,
      m.marcasdes,
      t.tipodes
    FROM pro p
    LEFT JOIN marcas m ON m.marcascod = p.promarcascod
    LEFT JOIN tipo t ON t.tipocod = p.protipocod
    WHERE p.part_group_id = $1
    ORDER BY p.prodes
  `, [groupId]);

  return {
    ...groupResult.rows[0],
    parts: partsResult.rows
  };
}

/**
 * Get the group for a specific part
 */
async function getGroupByPartId(partId) {
  const result = await pool.query(`
    SELECT 
      pg.id,
      pg.name,
      pg.stock_quantity,
      pg.created_at,
      pg.updated_at
    FROM part_groups pg
    JOIN pro p ON p.part_group_id = pg.id
    WHERE p.procod = $1
  `, [partId]);
  return result.rows[0] || null;
}

/**
 * Get the stock quantity for a part's group
 * If part has no group, returns the part's individual stock (proqtde)
 */
async function getGroupStock(partId) {
  const result = await pool.query(`
    SELECT 
      CASE 
        WHEN p.part_group_id IS NOT NULL THEN pg.stock_quantity
        ELSE p.proqtde
      END as stock_quantity,
      p.part_group_id,
      pg.id as group_id,
      pg.name as group_name
    FROM pro p
    LEFT JOIN part_groups pg ON pg.id = p.part_group_id
    WHERE p.procod = $1
  `, [partId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0];
}

/**
 * Decrement stock for a part's group with transaction locking
 * Uses SELECT ... FOR UPDATE to prevent race conditions
 * @param {number} partId - The part ID
 * @param {number} qty - Quantity to decrement
 * @param {object} client - Transaction client (optional, creates new transaction if not provided)
 * @returns {object} Result with success status and updated stock
 */
async function decrementGroupStock(partId, qty, client = null) {
  const shouldCommit = !client;
  const txClient = client || await pool.connect();
  
  try {
    if (shouldCommit) await txClient.query('BEGIN');

    // Get the part's group with lock
    const partResult = await txClient.query(`
      SELECT p.procod, p.part_group_id, p.prodes
      FROM pro p
      WHERE p.procod = $1
      FOR UPDATE
    `, [partId]);

    if (partResult.rows.length === 0) {
      throw new Error(`Part with ID ${partId} not found`);
    }

    const part = partResult.rows[0];
    
    if (!part.part_group_id) {
      // Part has no group, decrement individual stock
      const updateResult = await txClient.query(`
        UPDATE pro 
        SET proqtde = proqtde - $1
        WHERE procod = $2 AND proqtde >= $1
        RETURNING proqtde
      `, [qty, partId]);

      if (updateResult.rows.length === 0) {
        throw new Error('Insufficient stock');
      }

      if (shouldCommit) await txClient.query('COMMIT');
      return { 
        success: true, 
        newStock: updateResult.rows[0].proqtde,
        groupId: null
      };
    }

    // Lock and update group stock
    const groupResult = await txClient.query(`
      SELECT id, stock_quantity, name
      FROM part_groups
      WHERE id = $1
      FOR UPDATE
    `, [part.part_group_id]);

    if (groupResult.rows.length === 0) {
      throw new Error('Part group not found');
    }

    const group = groupResult.rows[0];

    if (group.stock_quantity < qty) {
      throw new Error('Insufficient group stock');
    }

    // Decrement group stock
    const updateResult = await txClient.query(`
      UPDATE part_groups 
      SET stock_quantity = stock_quantity - $1, updated_at = NOW()
      WHERE id = $2 AND stock_quantity >= $1
      RETURNING stock_quantity
    `, [qty, part.part_group_id]);

    if (updateResult.rows.length === 0) {
      throw new Error('Insufficient group stock');
    }

    // Create audit record
    await txClient.query(`
      INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `, [part.part_group_id, -qty, 'sale', partId.toString()]);

    if (shouldCommit) await txClient.query('COMMIT');
    
    return { 
      success: true, 
      newStock: updateResult.rows[0].stock_quantity,
      groupId: part.part_group_id,
      groupName: group.name
    };

  } catch (error) {
    if (shouldCommit) await txClient.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldCommit) txClient.release();
  }
}

/**
 * Increment stock for a part's group with transaction locking
 * @param {number} partId - The part ID
 * @param {number} qty - Quantity to increment
 * @param {string} reason - Reason for the stock increase
 * @param {object} client - Transaction client (optional)
 * @returns {object} Result with success status and updated stock
 */
async function incrementGroupStock(partId, qty, reason = 'manual', client = null) {
  const shouldCommit = !client;
  const txClient = client || await pool.connect();
  
  try {
    if (shouldCommit) await txClient.query('BEGIN');

    // Get the part's group
    const partResult = await txClient.query(`
      SELECT p.procod, p.part_group_id, p.prodes
      FROM pro p
      WHERE p.procod = $1
    `, [partId]);

    if (partResult.rows.length === 0) {
      throw new Error(`Part with ID ${partId} not found`);
    }

    const part = partResult.rows[0];
    
    if (!part.part_group_id) {
      // Part has no group, increment individual stock
      const updateResult = await txClient.query(`
        UPDATE pro 
        SET proqtde = proqtde + $1
        WHERE procod = $2
        RETURNING proqtde
      `, [qty, partId]);

      if (shouldCommit) await txClient.query('COMMIT');
      return { 
        success: true, 
        newStock: updateResult.rows[0].proqtde,
        groupId: null
      };
    }

    // Update group stock
    const updateResult = await txClient.query(`
      UPDATE part_groups 
      SET stock_quantity = stock_quantity + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING stock_quantity
    `, [qty, part.part_group_id]);

    // Create audit record
    await txClient.query(`
      INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
      VALUES ($1, $2, $3, $4)
    `, [part.part_group_id, qty, reason, partId.toString()]);

    if (shouldCommit) await txClient.query('COMMIT');
    
    return { 
      success: true, 
      newStock: updateResult.rows[0].stock_quantity,
      groupId: part.part_group_id
    };

  } catch (error) {
    if (shouldCommit) await txClient.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldCommit) txClient.release();
  }
}

/**
 * Create a new part group
 */
async function createGroup(name, stockQuantity = 0) {
  const result = await pool.query(`
    INSERT INTO part_groups (name, stock_quantity)
    VALUES ($1, $2)
    RETURNING *
  `, [name, stockQuantity]);
  return result.rows[0];
}

/**
 * Update a part group
 */
async function updateGroup(groupId, name, stockQuantity = null) {
  let query, params;
  
  if (stockQuantity !== null) {
    query = `
      UPDATE part_groups 
      SET name = $1, stock_quantity = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    params = [name, stockQuantity, groupId];
  } else {
    query = `
      UPDATE part_groups 
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    params = [name, groupId];
  }
  
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

/**
 * Delete a part group (parts will have part_group_id set to NULL due to ON DELETE SET NULL)
 */
async function deleteGroup(groupId) {
  const result = await pool.query(`
    DELETE FROM part_groups WHERE id = $1 RETURNING *
  `, [groupId]);
  return result.rows[0] || null;
}

/**
 * Add a part to a group
 */
async function addPartToGroup(partId, groupId) {
  const result = await pool.query(`
    UPDATE pro 
    SET part_group_id = $1
    WHERE procod = $2
    RETURNING procod, prodes, part_group_id
  `, [groupId, partId]);
  return result.rows[0] || null;
}

/**
 * Remove a part from its group (set to NULL)
 */
async function removePartFromGroup(partId) {
  const result = await pool.query(`
    UPDATE pro 
    SET part_group_id = NULL
    WHERE procod = $1
    RETURNING procod, prodes, part_group_id
  `, [partId]);
  return result.rows[0] || null;
}

/**
 * Get parts that are available for grouping (not in any group or in the specified group)
 */
async function getAvailableParts(currentGroupId = null) {
  let query, params;
  
  if (currentGroupId) {
    query = `
      SELECT 
        p.procod,
        p.prodes,
        p.provl,
        p.proqtde,
        p.part_group_id,
        m.marcasdes,
        t.tipodes
      FROM pro p
      LEFT JOIN marcas m ON m.marcascod = p.promarcascod
      LEFT JOIN tipo t ON t.tipocod = p.protipocod
      WHERE p.part_group_id IS NULL OR p.part_group_id = $1
      ORDER BY p.prodes
    `;
    params = [currentGroupId];
  } else {
    query = `
      SELECT 
        p.procod,
        p.prodes,
        p.provl,
        p.proqtde,
        p.part_group_id,
        m.marcasdes,
        t.tipodes
      FROM pro p
      LEFT JOIN marcas m ON m.marcascod = p.promarcascod
      LEFT JOIN tipo t ON t.tipocod = p.protipocod
      WHERE p.part_group_id IS NULL
      ORDER BY p.prodes
    `;
    params = [];
  }
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get audit history for a group
 */
async function getGroupAuditHistory(groupId, limit = 50) {
  const result = await pool.query(`
    SELECT 
      a.id,
      a.change,
      a.reason,
      a.reference_id,
      a.created_at,
      p.prodes as part_name
    FROM part_group_audit a
    LEFT JOIN pro p ON p.procod::text = a.reference_id
    WHERE a.part_group_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2
  `, [groupId, limit]);
  return result.rows;
}

/**
 * Update group stock directly (for manual adjustments)
 */
async function updateGroupStock(groupId, newQuantity, reason = 'manual_adjustment') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get current stock to calculate the change
    const currentResult = await client.query(`
      SELECT stock_quantity FROM part_groups WHERE id = $1 FOR UPDATE
    `, [groupId]);

    if (currentResult.rows.length === 0) {
      throw new Error('Group not found');
    }

    const currentStock = currentResult.rows[0].stock_quantity;
    const change = newQuantity - currentStock;

    // Update stock
    const updateResult = await client.query(`
      UPDATE part_groups 
      SET stock_quantity = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newQuantity, groupId]);

    // Create audit record if there was a change
    if (change !== 0) {
      await client.query(`
        INSERT INTO part_group_audit (part_group_id, change, reason)
        VALUES ($1, $2, $3)
      `, [groupId, change, reason]);
    }

    await client.query('COMMIT');
    return updateResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listAllGroups,
  getGroupById,
  getGroupByPartId,
  getGroupStock,
  decrementGroupStock,
  incrementGroupStock,
  createGroup,
  updateGroup,
  deleteGroup,
  addPartToGroup,
  removePartFromGroup,
  getAvailableParts,
  getGroupAuditHistory,
  updateGroupStock
};
