# 🧪 Testes Manuais - Sincronização de Estoque de Grupos

Este documento descreve os passos para testar manualmente a funcionalidade de sincronização de estoque entre grupos de compatibilidade (part_groups).

## 📋 Pré-requisitos

1. Banco de dados PostgreSQL configurado e rodando
2. Servidor Node.js em execução (`npm run dev`)
3. Tabelas `part_groups`, `part_group_audit` e `pro` criadas

## 🔧 Estrutura do Sistema de Estoque

### Serviço de Estoque (`src/services/stock.js`)

O serviço de estoque implementa a lógica de consumo conforme especificado:

- **`consumirEstoqueParaItem(partId, quantidade, reason, client?)`**: Consome estoque para um único item
- **`consumirEstoqueParaPedido(itens, reason, referenceId?)`**: Processa múltiplos itens em uma transação

### Modo de Consumo: 'each' (ATIVO)

**IMPORTANTE**: O sistema utiliza o modo 'each' para consumo de estoque de grupos.

**Regra do modo 'each':**
- Ao confirmar um pedido contendo uma peça que pertence a um grupo, **debita a quantidade vendida de CADA peça do grupo**.
- Exemplo: Grupo com peças A e B, venda qty=2 → A recebe -2 **E** B recebe -2.
- Cada peça afetada gera uma linha na tabela `part_group_audit`.

**Alternativa não ativa (modo 'pool'):**
- Distribui a retirada entre as peças do grupo, começando pelas de maior estoque.
- Este modo está documentado/comentado no código para uso futuro se necessário.

### Lógica de Funcionamento

1. **Peças SEM grupo**: Decrementa apenas o estoque individual (`proqtde`)
2. **Peças COM grupo (modo 'each')**:
   - Debita a quantidade de CADA peça do grupo
   - Usa `FOR UPDATE` para evitar condições de corrida
   - Valida estoque suficiente em TODAS as peças antes de debitar
   - Quando o grupo tem `stock_quantity` definido, atualiza para `MIN(estoque das peças)`
3. **Auditoria**: Grava em `part_group_audit` com:
   - `part_group_id`: ID do grupo
   - `change`: valor negativo da quantidade
   - `reason`: 'sale'
   - `reference_id`: código do produto (procod)
   - `created_at`: timestamp da operação

### Mudança Importante: reference_id

O campo `reference_id` na tabela `part_group_audit` contém o **código do produto (procod)** da peça afetada, permitindo rastreabilidade completa no histórico de movimentações.

### Correção de Bug: Débito Duplicado

**Problema**: Quando um pedido continha a mesma peça em múltiplas linhas, o sistema poderia processar a mesma peça duas vezes.

**Solução**: A função `consumirEstoqueParaPedido` agora **agrega itens por `partId`** ANTES de processar:
- Múltiplas linhas com a mesma peça são somadas em uma única entrada
- O estoque é decrementado apenas uma vez por peça única
- O registro de auditoria reflete a quantidade total consumida

### Idempotência na Confirmação

O endpoint de confirmação (`PUT /pedidos/confirmar/:pvcod`) é **idempotente**:
- Usa `SELECT ... FOR UPDATE` para bloquear a linha do pedido
- Se o pedido já está confirmado (`pvconfirmado = 'S'`), retorna sucesso sem reprocessar
- Evita débito duplicado de estoque em caso de requisições repetidas

---

## 🧪 Cenários de Teste

### Cenário 1: Peça de grupo com qty=1 (modo 'each')

**Configuração SQL:**
```sql
-- Criar um grupo com 2 peças
INSERT INTO part_groups (name, stock_quantity) VALUES ('Grupo Teste Each', 10);

-- Vincular 2 peças ao grupo, cada uma com estoque 10
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste Each'), proqtde = 10 WHERE procod = 1;
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste Each'), proqtde = 10 WHERE procod = 2;
```

**Passos:**
1. Adicionar ao carrinho 1 unidade de uma peça do grupo (procod=1)
2. Finalizar pedido (Retirada Balcão)
3. Confirmar o pedido no painel administrativo

**Resultado esperado (modo 'each'):**
- ✅ Peça A (procod=1): estoque vai de 10 para **9** (-1)
- ✅ Peça B (procod=2): estoque vai de 10 para **9** (-1)
- ✅ `part_group_audit`: **2 linhas** com `change = -1` cada
- ✅ `part_groups.stock_quantity` = 9 (MIN das peças)

**Verificação SQL:**
```sql
-- Verificar estoque das peças
SELECT procod, prodes, proqtde 
FROM pro 
WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste Each');
-- Esperado: ambas com proqtde = 9

-- Verificar auditoria (deve ter 2 linhas)
SELECT a.*, p.prodes 
FROM part_group_audit a
LEFT JOIN pro p ON p.procod::text = a.reference_id
WHERE a.part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste Each') 
ORDER BY a.created_at DESC;
-- Esperado: 2 linhas com change = -1
```

---

### Cenário 2: Peça de grupo com qty=2 (modo 'each')

**Configuração**: Mesmo grupo do Cenário 1 (resetar estoque para 10 se necessário)

**Passos:**
1. Adicionar ao carrinho 2 unidades de uma peça do grupo
2. Finalizar e confirmar pedido

**Resultado esperado (modo 'each'):**
- ✅ Peça A: estoque -2 (de 10 para 8)
- ✅ Peça B: estoque -2 (de 10 para 8)
- ✅ `part_group_audit`: **2 linhas** com `change = -2` cada

---

### Cenário 3: Mesma peça em múltiplas linhas (correção de duplicidade)

**Objetivo**: Verificar que itens duplicados são agregados corretamente.

**Configuração SQL:**
```sql
-- Criar pedido diretamente no banco com mesma peça em 2 linhas
INSERT INTO pv (pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado) 
VALUES (99999, 100, 'Teste duplicidade', 'BALCAO', 'A', 'N');

-- Mesma peça (procod=1) em 2 linhas: qty=1 + qty=1
INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl) VALUES (99999, 1, 1, 50);
INSERT INTO pvi (pvipvcod, pviprocod, pviqtde, pvivl) VALUES (99999, 1, 1, 50);
```

**Passos:**
1. Confirmar o pedido 99999 via painel

**Resultado esperado:**
- ✅ As 2 linhas são agregadas: qty total = 2
- ✅ Peça A: estoque -2
- ✅ Peça B: estoque -2 (modo 'each')
- ✅ Log do servidor mostra: "Itens agregados por partId: 2 linhas -> 1 peças únicas"

---

### Cenário 4: Confirmar pedido já confirmado (idempotência)

**Passos:**
1. Confirmar um pedido normalmente
2. Tentar confirmar o mesmo pedido novamente

**Resultado esperado:**
- ✅ Primeira confirmação: sucesso, estoque debitado
- ✅ Segunda confirmação: sucesso com `idempotente: true`, estoque **NÃO** debitado novamente
- ✅ Resposta: `{ success: true, message: "Pedido já está confirmado.", idempotente: true }`

---

### Cenário 5: Estoque insuficiente (validação)

**Configuração SQL:**
```sql
-- Reduzir estoque de uma das peças do grupo
UPDATE pro SET proqtde = 1 WHERE procod = 1;
-- Outra peça continua com estoque 10
UPDATE pro SET proqtde = 10 WHERE procod = 2;
```

**Passos:**
1. Criar pedido com qty=5 de uma peça do grupo
2. Tentar confirmar

**Resultado esperado:**
- ✅ Erro: "Estoque insuficiente para a peça X no grupo Y. Disponível: 1, Solicitado: 5"
- ✅ Toast vermelho exibido
- ✅ Nenhuma alteração no banco (ROLLBACK completo)
- ✅ Pedido permanece pendente

---

### Cenário 6: Peça SEM grupo (estoque individual)

**Passos:**
1. Selecionar uma peça que NÃO pertence a nenhum grupo
2. Adicionar ao carrinho e finalizar pedido
3. Confirmar pedido

**Resultado esperado:**
- ✅ Apenas o estoque individual da peça é decrementado
- ✅ Nenhum registro em `part_group_audit`

---

## 📝 Comandos Git

```bash
# Clonar o repositório
git clone https://github.com/CaioRodrigoCEVDEV/sistema_pedidos.git
cd sistema_pedidos

# Criar branch para feature
git checkout -b feature/sync-group-stock release

# Instalar dependências
npm install

# Iniciar servidor
npm run dev
```

---

## 📦 Arquivos Modificados

### Arquivos Principais
- `src/services/stock.js` - Serviço de gestão de estoque (modo 'each')
- `src/controllers/pedidosController.js` - Confirmação idempotente com consumo de estoque
- `README_TESTING.md` - Documentação de testes

### Regras de Negócio Implementadas
1. Estoque movimentado **SOMENTE** na confirmação do pedido
2. Modo 'each': debita de CADA peça do grupo
3. Agregação de itens por `part_id` antes do processamento
4. Endpoint de confirmação idempotente
5. Auditoria completa em `part_group_audit`
