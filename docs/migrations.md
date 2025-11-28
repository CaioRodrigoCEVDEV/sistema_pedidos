# Notas de Migração - Grupos de Peças (Grupos de Compatibilidade)

## Visão Geral

Esta migração adiciona suporte para **Grupos de Peças** (grupos de compatibilidade), que permitem que múltiplas peças compartilhem um único estoque. Isso é útil quando diferentes variantes de peças (ex: fornecedores diferentes, descrições ou preços diferentes) são fisicamente a mesma peça e devem decrementar de um pool de estoque compartilhado.

## Alterações no Banco de Dados

### Novas Tabelas

#### `part_groups`
- `id` (INTEGER, Chave Primária, SERIAL/IDENTITY) - Identificador único simples (inteiro auto-incrementado)
- `name` (TEXT, NOT NULL) - Nome de exibição do grupo
- `stock_quantity` (INTEGER, NOT NULL, DEFAULT 0) - Quantidade de estoque compartilhado
- `created_at` (TIMESTAMPTZ) - Data/hora de criação
- `updated_at` (TIMESTAMPTZ) - Data/hora da última atualização

#### `part_group_audit`
- `id` (INTEGER, Chave Primária, SERIAL/IDENTITY) - Identificador único  
- `part_group_id` (INTEGER, FK para part_groups) - Referência ao grupo
- `change` (INTEGER) - Quantidade alterada no estoque (positivo = aumento, negativo = diminuição)
- `reason` (TEXT) - Motivo da alteração (ex: "sale", "manual_adjustment")
- `reference_id` (TEXT, NULLABLE) - Referência a entidade relacionada (ex: ID da peça)
- `created_at` (TIMESTAMPTZ) - Data/hora da alteração

### Modificações em Tabelas

#### `pro` (tabela de peças/produtos)
- Adicionada coluna `part_group_id` (INTEGER, NULLABLE, FK para part_groups) - Vincula a peça ao seu grupo de compatibilidade

### Índices
- `idx_part_group_audit_group_id` em `part_group_audit(part_group_id)`
- `idx_pro_part_group_id` em `pro(part_group_id)`

## Comportamento da Migração

### Migração Automática para Peças Existentes

Quando a migração é executada, ela irá:

1. **Criar grupos individuais para cada peça existente** - Cada peça recebe seu próprio grupo com a quantidade de estoque atual da peça (`proqtde`)
2. **Vincular peças aos seus grupos** - A chave estrangeira `part_group_id` é definida
3. **Preservar o comportamento existente** - Como cada peça inicialmente tem seu próprio grupo, o comportamento de estoque permanece inalterado até que os grupos sejam consolidados

### Notas Importantes

- A coluna `pro.proqtde` é **preservada** e permanece no banco de dados
- O novo código lê/escreve estoque de `part_groups.stock_quantity`
- A migração é **não-destrutiva** - nenhum dado é perdido
- Grupos podem ser consolidados posteriormente por administradores através da interface administrativa

## Passos de Verificação

Após executar a migração, verifique o seguinte:

1. **Verificar se as tabelas existem:**
   ```sql
   SELECT COUNT(*) FROM part_groups;
   SELECT COUNT(*) FROM part_group_audit;
   ```

2. **Verificar se todas as peças têm grupos:**
   ```sql
   SELECT COUNT(*) FROM pro WHERE part_group_id IS NULL;
   -- Deve retornar 0
   ```

3. **Verificar se o estoque foi migrado corretamente:**
   ```sql
   SELECT p.procod, p.prodes, p.proqtde as estoque_antigo, pg.stock_quantity as estoque_grupo
   FROM pro p
   JOIN part_groups pg ON pg.id = p.part_group_id
   WHERE p.proqtde != pg.stock_quantity;
   -- Deve retornar 0 linhas (estoques devem coincidir)
   ```

## Como Usar

### Interface Administrativa

Navegue até `/part-groups` (requer autenticação de administrador) para:

- Visualizar todos os grupos de compatibilidade
- Criar novos grupos
- Adicionar/remover peças dos grupos
- Ajustar quantidades de estoque do grupo
- Visualizar histórico de alterações de estoque (auditoria)

### Endpoints da API (Apenas Admin)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/part-groups` | Lista todos os grupos |
| GET | `/part-groups/:id` | Busca detalhes do grupo com peças |
| GET | `/part-groups/:id/audit` | Busca histórico de auditoria |
| POST | `/part-groups` | Cria novo grupo |
| PUT | `/part-groups/:id` | Atualiza nome do grupo |
| PUT | `/part-groups/:id/stock` | Atualiza estoque do grupo |
| POST | `/part-groups/:id/parts` | Adiciona peça ao grupo |
| DELETE | `/part-groups/parts/:partId` | Remove peça do grupo |
| DELETE | `/part-groups/:id` | Exclui grupo |

### Consolidando Grupos (TODO)

Após a migração, os administradores devem:

1. Identificar peças que devem compartilhar estoque
2. Criar um novo grupo (ou usar um existente)
3. Mover peças compatíveis para o mesmo grupo
4. Definir a quantidade de estoque combinada

**Exemplo de fluxo de trabalho:**
- Peça A (Tela Samsung A50 - Fornecedor 1) tem estoque 10
- Peça B (Tela Samsung A50 - Fornecedor 2) tem estoque 5
- Criar grupo "Tela Samsung A50 Compatível"
- Adicionar ambas as peças ao grupo
- Definir estoque do grupo para 15 (combinado)

## Notas Técnicas

### Segurança de Concorrência

Operações de decremento de estoque usam `SELECT ... FOR UPDATE` para prevenir condições de corrida:

```javascript
// Em partGroupModels.js
const groupResult = await txClient.query(`
  SELECT id, stock_quantity, name
  FROM part_groups
  WHERE id = $1
  FOR UPDATE
`, [part.part_group_id]);
```

### Triggers do Banco de Dados

O sistema usa triggers do PostgreSQL para atualizar automaticamente o estoque na confirmação/cancelamento de pedidos:

- **`atualizar_saldo`** - Disparado quando `pvconfirmado = 'S'` (pedido confirmado)
  - Decrementa `procor.procorqtde` para itens com cores
  - Decrementa `pro.proqtde` para itens sem cores (legado)
  - **NOVO:** Decrementa `part_groups.stock_quantity` para peças com grupo
  - **NOVO:** Cria registros de auditoria em `part_group_audit`

- **`retornar_saldo`** - Disparado quando `pvsta = 'X'` (pedido cancelado)
  - Retorna estoque para `procor.procorqtde` e `pro.proqtde`
  - **NOVO:** Retorna estoque para `part_groups.stock_quantity`
  - **NOVO:** Cria registros de auditoria para cancelamentos

### Trilha de Auditoria

Todas as alterações de estoque são registradas em `part_group_audit`:

- Vendas criam entradas de auditoria automaticamente com motivo "sale"
- Ajustes manuais criam entradas com o motivo selecionado
- O campo `reference_id` vincula à peça envolvida (se aplicável)

## Rollback

Para reverter esta migração (se necessário):

```sql
-- Remove a chave estrangeira de pro
ALTER TABLE pro DROP CONSTRAINT IF EXISTS fk_pro_part_group;
ALTER TABLE pro DROP COLUMN IF EXISTS part_group_id;

-- Remove índices
DROP INDEX IF EXISTS idx_part_group_audit_group_id;
DROP INDEX IF EXISTS idx_pro_part_group_id;

-- Remove tabelas
DROP TABLE IF EXISTS part_group_audit;
DROP TABLE IF EXISTS part_groups;
```

**Aviso:** O rollback perderá todas as configurações de grupo. Os dados de estoque em `pro.proqtde` são preservados.

## Executando Testes

Para executar os testes de integração dos grupos de peças:

```bash
# A partir do diretório raiz do projeto
node tests/partGroups.test.js
```

**Pré-requisitos:**
- Banco de dados PostgreSQL rodando com o schema criado
- Variáveis de ambiente configuradas (arquivo `.env`)
- Migração deve ter sido executada primeiro (acontece automaticamente na inicialização do app)

**Cobertura de Testes:**
- Criação de grupos
- Listagem de grupos
- Atualização de nome e estoque do grupo
- Criação de registro de auditoria
- Decremento de estoque com estoque suficiente/insuficiente
- Incremento de estoque

## Melhorias Futuras (TODO)

- [ ] Ferramenta para consolidar grupos (mesclar múltiplos grupos em lote)
- [ ] Alertas de estoque baixo por grupo
- [ ] Transferência de estoque entre grupos
- [ ] Importação/exportação de configurações de grupos
