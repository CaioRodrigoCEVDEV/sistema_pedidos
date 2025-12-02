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
- **`consumirEstoqueParaPedido(itens, reason, referenceId?, externalClient?)`**: Processa múltiplos itens em uma transação

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

### Fluxo do Carrinho (Retirada/Entrega)

**IMPORTANTE**: O fluxo de carrinho (validarEDecrementarEstoque) **NÃO movimenta estoque**.
- A função apenas valida os itens do carrinho (IDs e quantidades válidas)
- O estoque é movimentado **SOMENTE** na confirmação do pedido (função `confirmarPedido`)

---

## 🔍 Comandos SQL para Inspeção Direta no Banco

Use estes comandos para inspecionar o estado do banco de dados durante os testes:

### Ver todos os grupos e suas peças:
```sql
-- Listar grupos com contagem de peças
SELECT 
  pg.id,
  pg.name,
  pg.stock_quantity,
  COUNT(p.procod) as total_pecas
FROM part_groups pg
LEFT JOIN pro p ON p.part_group_id = pg.id
GROUP BY pg.id, pg.name, pg.stock_quantity
ORDER BY pg.name;

-- Ver peças de um grupo específico (substituir X pelo ID do grupo)
SELECT procod, prodes, proqtde, part_group_id
FROM pro
WHERE part_group_id = X
ORDER BY procod;
```

### Verificar histórico de auditoria:
```sql
-- Ver últimos 20 registros de auditoria com nome da peça
SELECT 
  a.id,
  a.part_group_id,
  pg.name as grupo_nome,
  a.change,
  a.reason,
  a.reference_id,
  p.prodes as peca_nome,
  a.created_at
FROM part_group_audit a
LEFT JOIN part_groups pg ON pg.id = a.part_group_id
LEFT JOIN pro p ON p.procod::text = a.reference_id
ORDER BY a.created_at DESC
LIMIT 20;

-- Ver auditoria de um grupo específico (substituir X pelo ID do grupo)
SELECT a.*, p.prodes 
FROM part_group_audit a
LEFT JOIN pro p ON p.procod::text = a.reference_id
WHERE a.part_group_id = X
ORDER BY a.created_at DESC;
```

### Verificar pedidos pendentes e confirmados:
```sql
-- Pedidos pendentes
SELECT pvcod, pvvl, pvobs, pvcanal, pvsta, pvconfirmado, pvdtcad
FROM pv
WHERE pvconfirmado = 'N' AND pvsta = 'A'
ORDER BY pvcod DESC
LIMIT 10;

-- Itens de um pedido específico (substituir Y pelo pvcod)
SELECT 
  pvi.pvipvcod,
  pvi.pviprocod,
  pvi.pviqtde,
  pvi.pvivl,
  pro.prodes,
  pro.part_group_id
FROM pvi
JOIN pro ON pro.procod = pvi.pviprocod
WHERE pvi.pvipvcod = Y;
```

### Resetar estoque para testes:
```sql
-- Resetar estoque de peças de um grupo para 10
UPDATE pro 
SET proqtde = 10 
WHERE part_group_id = X;

-- Atualizar stock_quantity do grupo
UPDATE part_groups
SET stock_quantity = (
  SELECT COALESCE(MIN(proqtde), 0) FROM pro WHERE part_group_id = X
)
WHERE id = X;
```

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

### Cenário 7: Itens diferentes no mesmo grupo

**Objetivo**: Verificar que múltiplas peças do mesmo grupo no pedido são tratadas corretamente.

**Configuração SQL:**
```sql
-- Grupo com 2 peças, ambas no pedido
-- (usar o grupo já criado nos cenários anteriores)
```

**Passos:**
1. Adicionar ao carrinho: 1 unidade de peça A (procod=1) do grupo
2. Adicionar ao carrinho: 1 unidade de peça B (procod=2) do mesmo grupo
3. Finalizar e confirmar pedido

**Resultado esperado (modo 'each'):**
- ✅ O sistema agrega as quantidades por grupo: total = 2
- ✅ Peça A: estoque -2 (de 10 para 8)
- ✅ Peça B: estoque -2 (de 10 para 8)
- ✅ `part_group_audit`: **2 linhas** com `change = -2` cada (uma por peça)

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

## 🐛 Logs de Debug

O sistema inclui logs de debug (`console.debug`) para facilitar diagnóstico:

- **[Pedidos]**: Logs do controlador de pedidos
- **[Stock Service]**: Logs do serviço de estoque

Para ver os logs de debug durante testes:
```bash
# Iniciar servidor em modo desenvolvimento
npm run dev

# Os logs aparecerão no terminal conforme pedidos são confirmados
```

### Exemplos de logs:
```
[Pedidos] ========================================
[Pedidos] Iniciando confirmação do pedido 12345
[Pedidos] Carregando itens do pedido 12345...
[Pedidos] Itens carregados: 2 item(s)
[Stock Service] consumirEstoqueParaPedido: 2 item(s), reason="sale"
[Stock Service] Itens agregados por partId: 2 linhas -> 1 peças únicas
[Stock Service] Modo 'each' - 2 peça(s) no grupo. Cada uma receberá -2
[Stock Service] Peça 1 ("Peça Teste A"): estoque 10 -> 8
[Stock Service] Peça 2 ("Peça Teste B"): estoque 10 -> 8
[Pedidos] Pedido 12345 confirmado com sucesso!
```

---

## 📦 Arquivos Modificados

### Arquivos Principais
- `src/services/stock.js` - Serviço de gestão de estoque (modo 'each')
- `src/controllers/pedidosController.js` - Confirmação idempotente com consumo de estoque
- `scripts/fix_part_group_audit_reference.sql` - Script de correção de dados históricos
- `README_TESTING.md` - Documentação de testes

### Regras de Negócio Implementadas
1. Estoque movimentado **SOMENTE** na confirmação do pedido
2. Modo 'each': debita de CADA peça do grupo
3. Agregação de itens por `part_id` antes do processamento
4. Endpoint de confirmação idempotente
5. Auditoria completa em `part_group_audit`
6. Carrinho/validação NÃO movimenta estoque
7. `part_id` e quantidades normalizados para inteiros (evita erro `invalid input syntax for integer`)

---

## 🔧 Scripts de Manutenção

### Script de Correção de Dados Históricos

O arquivo `scripts/fix_part_group_audit_reference.sql` é um script idempotente para corrigir registros históricos na tabela `part_group_audit`.

**Como executar:**

```bash
# 1. Primeiro, execute em HOMOLOGAÇÃO para validar
psql -d nome_do_banco_homologacao -f scripts/fix_part_group_audit_reference.sql

# 2. Verifique os resultados com as queries do script
# 3. Após validação, execute em PRODUÇÃO
psql -d nome_do_banco_producao -f scripts/fix_part_group_audit_reference.sql
```

**O que o script faz:**
- Atualiza `reference_id` de registros que têm `procod` válido
- Para grupos com apenas uma peça, infere o `reference_id` automaticamente
- Mantém um log de quantos registros foram atualizados
- É seguro executar múltiplas vezes (idempotente)

---

## ✅ Critérios de Aceitação

| Cenário | Esperado | Como Verificar |
|---------|----------|----------------|
| Pedido com produto em grupo (2 peças), qty=1 | Cada peça do grupo recebe -1 no estoque | `SELECT proqtde FROM pro WHERE part_group_id = X` |
| Auditoria | 2 entradas em part_group_audit com reference_id = código de cada peça | `SELECT * FROM part_group_audit WHERE part_group_id = X ORDER BY created_at DESC` |
| Quantidades com decimais ("1.0000") | Convertidas para inteiro sem erro | Log mostra normalização |
| Confirmação duplicada | Retorna sucesso com `idempotente: true` | Segunda chamada não debita estoque |
| pvdtcad em outras queries | Mantido sem alteração | Código não modifica pvdtcad |

---

## 🔒 Normalização de Tipos

O sistema normaliza automaticamente:

| Entrada | Normalizado para |
|---------|-----------------|
| `partId: "123"` | `123` (inteiro) |
| `partId: 123.0` | `123` (inteiro) |
| `quantidade: "1.0000"` | `1` (inteiro) |
| `quantidade: 2.5` | `3` (inteiro, arredondado) |

Isso evita erros como `invalid input syntax for integer: "1.0000"` que podem ocorrer quando valores numéricos vêm do banco ou do frontend como strings.

---

## 📋 Instruções para Abrir PR

```bash
# 1. Criar branch a partir de release
git checkout release
git pull origin release
git checkout -b feature/sync-group-stock

# 2. Fazer alterações e commitar
git add .
git commit -m "Debitar de cada peça do grupo ao confirmar pedido (sem duplicidade)"

# 3. Enviar para o repositório remoto
git push origin feature/sync-group-stock

# 4. Abrir PR no GitHub
# - Base branch: release
# - Título: "Debitar de cada peça do grupo ao confirmar pedido (sem duplicidade)"
# - Descrição: incluir cenários testados e referências às imagens
```
