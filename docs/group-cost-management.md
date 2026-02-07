# Group Cost Management

## Overview

This feature allows managing product costs at the group level. When a cost is set for a compatibility group (part_group), it automatically propagates to all products within that group.

## Business Rules

1. **Group Cost is Optional**: Groups can exist without a defined cost (NULL value is allowed)
2. **Cost Propagation**: When a group cost is set or updated, all products in the group automatically receive that cost
3. **New Product Addition**: When a product is added to a group that has a cost, the product automatically receives the group's cost
4. **Atomic Updates**: All cost updates are performed within database transactions to ensure data consistency

## Database Schema

### Added Column

```sql
ALTER TABLE public.part_groups ADD IF NOT EXISTS group_cost numeric(14, 4) NULL;
```

- **Table**: `part_groups`
- **Column**: `group_cost`
- **Type**: `numeric(14, 4)` - supports up to 14 digits with 4 decimal places
- **Nullable**: Yes (NULL means no cost defined)

## API Changes

### Create Group

**Endpoint**: `POST /part-groups`

**Request Body**:
```json
{
  "name": "Group Name",
  "group_cost": 25.50  // Optional
}
```

### Update Group

**Endpoint**: `PUT /part-groups/:id`

**Request Body**:
```json
{
  "name": "Updated Name",
  "group_cost": 30.00  // Optional - if provided, propagates to all products
}
```

**Note**: When `group_cost` is updated, the following happens automatically:
1. The group's `group_cost` field is updated
2. All products with `part_group_id = :id` have their `procusto` field updated to match
3. Both updates happen within a single transaction (ACID compliant)

### Get Group

**Endpoint**: `GET /part-groups/:id`

**Response**:
```json
{
  "id": 1,
  "name": "Group Name",
  "stock_quantity": 100,
  "group_cost": 25.50,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-02T00:00:00Z",
  "parts": [...]
}
```

## UI Changes

### Group Edit Modal

The edit group modal now includes a cost input field:

- **Field Label**: "Custo do Grupo (R$)"
- **Input Type**: Number (step: 0.01, min: 0)
- **Help Text**: "O custo será aplicado a todos os produtos do grupo."

### Group Details View

The group details section displays the current cost:

- **Display Location**: Card next to the stock quantity card
- **Label**: "Custo do Grupo"
- **Format**: "R$ 25.50" or "-" if no cost is defined

## Code Changes Summary

### Backend

1. **src/config/atualizardb.js**: Added `group_cost` column to migration
2. **src/models/partGroupModels.js**:
   - `createGroup()`: Accepts optional `groupCost` parameter
   - `updateGroup()`: Handles `groupCost` and propagates to products
   - `addPartToGroup()`: Propagates group cost to newly added part
   - `listAllGroups()`, `getGroupById()`: Include `group_cost` in SELECT queries

3. **src/controllers/partGroupController.js**:
   - `createGroup()`: Parses and passes `group_cost` from request
   - `updateGroup()`: Parses and passes `group_cost` to model

### Frontend

1. **public/html/auth/admin/html/painel-part-groups.html**:
   - Added cost input field in edit modal
   - Added cost display card in group details

2. **public/html/auth/js/painel-part-groups.js**:
   - `abrirModalEditar()`: Fetches and populates cost field
   - `salvarEdicaoGrupo()`: Sends cost to backend
   - `abrirDetalhes()`: Displays cost in details view

## Testing

Three test cases were added to `tests/partGroups.test.js`:

1. **Create Group with Cost**: Verifies that groups can be created with an initial cost
2. **Update Group Cost Propagation**: Verifies that updating a group's cost propagates to all products in the group
3. **Add Part to Group with Cost**: Verifies that adding a product to a group with a cost automatically assigns that cost to the product

## Usage Example

### Scenario: Setting Cost for a Group of Compatible Parts

1. Create a group for compatible Samsung A50/A50s screens
2. Set the group cost to R$ 45.00
3. Add multiple compatible screen parts to the group
4. All parts automatically receive the R$ 45.00 cost
5. If the cost changes (e.g., supplier price update), update the group cost to R$ 50.00
6. All parts in the group automatically update to R$ 50.00

This ensures consistent pricing across all compatible parts and simplifies cost management.

## Migration

To apply this change to an existing database, run the migration:

```bash
node -e "const { atualizarDB } = require('./src/config/atualizardb'); atualizarDB();"
```

This will:
- Add the `group_cost` column to the `part_groups` table
- Existing groups will have `group_cost = NULL`
- Products already in groups will keep their existing `procusto` values
- New cost assignments will take effect when groups are updated

## Compatibility

- **Backward Compatible**: Yes - existing groups without costs continue to work
- **NULL Handling**: UI displays "-" when cost is NULL
- **Default Behavior**: Groups created without a cost have `group_cost = NULL`
- **Product Independence**: Products can have individual costs if not in a group or if group has no cost defined

## Security

- **Input Validation**: Cost values are validated and parsed as floats
- **Transaction Safety**: All updates use database transactions
- **Access Control**: Only admin users can modify group costs (enforced by existing `requireAdmin` middleware)
- **SQL Injection Prevention**: All queries use parameterized statements

## Performance Considerations

- **Bulk Updates**: When updating group cost, a single UPDATE query updates all products in the group
- **Transaction Overhead**: Minimal - updates complete in milliseconds for typical group sizes
- **Index Usage**: Existing indexes on `part_group_id` are utilized for efficient updates

## Future Enhancements

Potential improvements for future versions:

1. **Cost History**: Track cost changes over time for audit purposes
2. **Bulk Cost Updates**: Update costs for multiple groups at once
3. **Cost Import**: Import costs from CSV or external systems
4. **Profit Margin Calculation**: Calculate suggested selling prices based on cost and margin
5. **Cost Alerts**: Notify when product costs deviate from group costs
