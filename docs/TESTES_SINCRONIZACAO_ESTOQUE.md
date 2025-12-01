# Documentação de Testes - Sincronização de Estoque de Grupos

Este documento descreve os casos de teste manuais para validar a funcionalidade de sincronização de estoque de grupos de peças.

## Pré-requisitos

1. Banco de dados PostgreSQL configurado e rodando
2. Aplicação Node.js rodando (`npm run dev`)
3. Acesso ao banco de dados para inserir dados de teste

## Configuração do Ambiente de Teste

### 1. Criar um Grupo de Peças com Estoque Definido

```sql
-- Inserir um grupo de teste com estoque definido
INSERT INTO part_grups (grupdes, estoque) 
VALUES ('Grupo Teste A - Com Estoque', 10);

-- Obter o ID do grupo criado
SELECT grupcod FROM part_grups WHERE grupdes = 'Grupo Teste A - Com Estoque';
```

### 2. Criar um Grupo de Peças SEM Estoque Definido

```sql
-- Inserir um grupo de teste sem estoque (NULL)
INSERT INTO part_grups (grupdes, estoque) 
VALUES ('Grupo Teste B - Sem Estoque', NULL);

-- Obter o ID do grupo criado
SELECT grupcod FROM part_grups WHERE grupdes = 'Grupo Teste B - Sem Estoque';
```

### 3. Vincular Peças aos Grupos

```sql
-- Vincular peças ao grupo com estoque (substitua {GRUPCOD_A} pelo ID real)
UPDATE pro SET progrupcod = {GRUPCOD_A}, proqtde = 10 WHERE procod IN (1, 2, 3);

-- Vincular peças ao grupo sem estoque (substitua {GRUPCOD_B} pelo ID real)
UPDATE pro SET progrupcod = {GRUPCOD_B}, proqtde = 5 WHERE procod IN (4, 5);

-- Manter algumas peças sem grupo para teste
UPDATE pro SET progrupcod = NULL, proqtde = 8 WHERE procod = 6;
```

---

## Casos de Teste

### Caso 1: Vender Peça SEM Grupo

**Objetivo:** Verificar que o comportamento padrão (sem grupo) continua funcionando.

**Passos:**
1. Adicionar ao carrinho a peça com `procod = 6` (sem grupo)
2. Definir quantidade = 2
3. Finalizar pedido (botão Balcão ou Entrega)
4. Confirmar o pedido no painel administrativo

**Resultado Esperado:**
- A validação de estoque deve passar
- O pedido deve ser criado
- Após confirmar o pedido, apenas a peça vendida deve ter estoque reduzido de 8 para 6
- Outras peças NÃO devem ser afetadas

**Verificação SQL:**
```sql
SELECT procod, prodes, proqtde, progrupcod FROM pro WHERE procod = 6;
-- proqtde deve ser 6 (8 - 2)
```

---

### Caso 2: Vender Peça de Grupo COM Estoque Definido

**Objetivo:** Verificar sincronização quando o grupo tem campo `estoque` definido.

**Passos:**
1. Verificar estoque inicial do grupo e peças:
```sql
SELECT grupcod, grupdes, estoque FROM part_grups WHERE grupcod = {GRUPCOD_A};
SELECT procod, prodes, proqtde FROM pro WHERE progrupcod = {GRUPCOD_A};
```
2. Adicionar ao carrinho uma peça do grupo (ex: `procod = 1`)
3. Definir quantidade = 1
4. Finalizar pedido
5. Confirmar o pedido no painel

**Resultado Esperado:**
- Validação de estoque deve verificar `part_grups.estoque >= 1`
- Após confirmar:
  - `part_grups.estoque` reduzido de 10 para 9
  - TODAS as peças do grupo devem ter `proqtde = 9`

**Verificação SQL:**
```sql
SELECT grupcod, grupdes, estoque FROM part_grups WHERE grupcod = {GRUPCOD_A};
-- estoque deve ser 9

SELECT procod, prodes, proqtde FROM pro WHERE progrupcod = {GRUPCOD_A};
-- todas devem ter proqtde = 9
```

---

### Caso 3: Vender Peça de Grupo SEM Estoque Definido

**Objetivo:** Verificar sincronização quando o grupo NÃO tem campo `estoque` definido.

**Passos:**
1. Verificar estoque inicial das peças:
```sql
SELECT procod, prodes, proqtde FROM pro WHERE progrupcod = {GRUPCOD_B};
-- todas devem ter proqtde = 5
```
2. Adicionar ao carrinho uma peça do grupo (ex: `procod = 4`)
3. Definir quantidade = 2
4. Finalizar pedido
5. Confirmar o pedido no painel

**Resultado Esperado:**
- Validação de estoque deve verificar que TODAS as peças do grupo têm `proqtde >= 2`
- Após confirmar:
  - TODAS as peças do grupo devem ter `proqtde` reduzido de 5 para 3

**Verificação SQL:**
```sql
SELECT procod, prodes, proqtde FROM pro WHERE progrupcod = {GRUPCOD_B};
-- todas devem ter proqtde = 3 (5 - 2)
```

---

### Caso 4: Estoque Insuficiente - Grupo COM Estoque

**Objetivo:** Verificar bloqueio de venda quando estoque do grupo é insuficiente.

**Passos:**
1. Definir estoque do grupo para 1:
```sql
UPDATE part_grups SET estoque = 1 WHERE grupcod = {GRUPCOD_A};
UPDATE pro SET proqtde = 1 WHERE progrupcod = {GRUPCOD_A};
```
2. Adicionar ao carrinho uma peça do grupo
3. Definir quantidade = 5
4. Tentar finalizar pedido

**Resultado Esperado:**
- Um alerta deve aparecer: "Estoque do grupo 'Grupo Teste A - Com Estoque' insuficiente. Disponível: 1, Solicitado: 5"
- O pedido NÃO deve ser criado
- O WhatsApp NÃO deve abrir
- Nenhum dado no banco deve ser alterado

---

### Caso 5: Estoque Insuficiente - Grupo SEM Estoque (Uma Peça Insuficiente)

**Objetivo:** Verificar bloqueio quando uma das peças do grupo não tem estoque suficiente.

**Passos:**
1. Definir estoques diferentes nas peças:
```sql
UPDATE pro SET proqtde = 10 WHERE procod = 4;
UPDATE pro SET proqtde = 1 WHERE procod = 5;
```
2. Adicionar ao carrinho a peça `procod = 4`
3. Definir quantidade = 3
4. Tentar finalizar pedido

**Resultado Esperado:**
- Um alerta deve aparecer indicando que uma peça do grupo tem estoque insuficiente
- O pedido NÃO deve ser criado
- Nenhum dado no banco deve ser alterado

---

### Caso 6: Cancelamento de Pedido - Retorno de Estoque

**Objetivo:** Verificar que ao cancelar um pedido confirmado, o estoque é devolvido corretamente.

**Passos:**
1. Ter um pedido confirmado de uma peça de grupo
2. No painel, cancelar o pedido
3. Verificar estoques

**Resultado Esperado:**
- Estoque do grupo e todas as peças devem ser restaurados

---

### Caso 7: Quantidade Maior que 1 (Q > 1)

**Objetivo:** Verificar que a lógica funciona corretamente para quantidades maiores que 1.

**Passos:**
1. Resetar estoque do grupo para 20:
```sql
UPDATE part_grups SET estoque = 20 WHERE grupcod = {GRUPCOD_A};
UPDATE pro SET proqtde = 20 WHERE progrupcod = {GRUPCOD_A};
```
2. Adicionar ao carrinho uma peça do grupo
3. Definir quantidade = 7
4. Finalizar e confirmar pedido

**Resultado Esperado:**
- Estoque do grupo reduzido para 13 (20 - 7)
- Todas as peças do grupo com `proqtde = 13`

---

## APIs para Teste via cURL/Postman

### Validar Estoque do Carrinho

```bash
curl -X POST http://localhost:3000/validar-estoque \
  -H "Content-Type: application/json" \
  -d '{
    "cart": [
      {"id": "1", "qt": 2, "nome": "Peça Teste"}
    ]
  }'
```

### Listar Grupos

```bash
curl -X GET http://localhost:3000/grupos \
  -H "Cookie: token=SEU_TOKEN_AQUI"
```

### Criar Grupo

```bash
curl -X POST http://localhost:3000/grupos \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN_AQUI" \
  -d '{"grupdes": "Novo Grupo", "estoque": 50}'
```

### Vincular Peça a Grupo

```bash
curl -X POST http://localhost:3000/grupos/vincular \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN_AQUI" \
  -d '{"grupcod": 1, "procod": 10}'
```

### Atualizar Estoque do Grupo

```bash
curl -X PUT http://localhost:3000/grupos/1/estoque \
  -H "Content-Type: application/json" \
  -H "Cookie: token=SEU_TOKEN_AQUI" \
  -d '{"estoque": 100}'
```

---

## Limpeza após Testes

```sql
-- Remover vínculos de teste
UPDATE pro SET progrupcod = NULL WHERE progrupcod IN (
  SELECT grupcod FROM part_grups WHERE grupdes LIKE 'Grupo Teste%'
);

-- Inativar grupos de teste
UPDATE part_grups SET grupsit = 'I' WHERE grupdes LIKE 'Grupo Teste%';
```

---

## Observações

1. O decremento de estoque só ocorre quando o pedido é **confirmado** (`pvconfirmado = 'S'`)
2. A validação de estoque ocorre **antes** de criar o pedido
3. Toda a operação é transacional - se falhar, nenhuma alteração é persistida
4. O WhatsApp só abre após sucesso na criação do pedido
