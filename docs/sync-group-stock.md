# Sincronização de Estoque entre Grupos de Peças

## Visão Geral

Esta funcionalidade implementa a sincronização automática de estoque entre peças que pertencem ao mesmo grupo de compatibilidade. Quando uma peça de um grupo é vendida, o estoque é decrementado de forma atômica e sincronizada com todas as outras peças do grupo.

## Regras de Negócio

### 1. Peça sem Grupo
- Comportamento inalterado
- Decrementa apenas o estoque individual da peça vendida (`pro.proqtde`)

### 2. Peça com Grupo (part_groups)

#### 2a. Grupo com campo `stock_quantity` definido (não nulo)
- O campo `stock_quantity` do grupo é usado como fonte da verdade
- Ao vender Q unidades:
  1. Valida se `group.stock_quantity >= Q`
  2. Se insuficiente, bloqueia a venda com erro
  3. Se suficiente, decrementa `group.stock_quantity -= Q`
  4. Atualiza o estoque de todas as peças do grupo para o novo valor

#### 2b. Grupo sem campo `stock_quantity` definido (nulo)
- Carrega todas as peças do grupo com lock `FOR UPDATE`
- Valida que cada peça tem estoque >= Q
- Se alguma não tiver, bloqueia a venda
- Caso todas tenham, decrementa o estoque de cada peça em Q

### 3. Garantias Transacionais
- Toda operação é atômica (usa transação PostgreSQL)
- Usa locks `SELECT ... FOR UPDATE` para evitar condições de corrida
- WhatsApp só é enviado após commit bem-sucedido
- Em caso de falha, rollback é executado e nenhuma alteração persiste

## Fluxo de Venda

```
Cliente adiciona itens ao carrinho
        ↓
Cliente clica em "Finalizar" (Balcão ou Entrega)
        ↓
Frontend envia POST /pedidos/enviar
        ↓
[NOVO] Middleware validarEDecrementarEstoque
        ├── Valida estoque de cada item
        ├── Para itens com grupo: sincroniza estoque
        ├── Executa tudo em uma transação
        └── Em caso de erro: retorna 400 com mensagem clara
        ↓
Se sucesso: Cria pedido (pv) e itens (pvi)
        ↓
Frontend recebe resposta OK
        ↓
WhatsApp é enviado (só após commit do estoque)
```

## Instruções de Teste Manual

### Pré-requisitos
1. Ter o sistema rodando localmente
2. Ter peças cadastradas no banco de dados
3. Ter pelo menos um grupo de compatibilidade criado

### Cenário 1: Venda de peça com grupo que tem `stock_quantity` definido

1. Crie um grupo de compatibilidade:
   ```sql
   INSERT INTO part_groups (name, stock_quantity) VALUES ('Grupo Teste', 10);
   ```

2. Adicione peças ao grupo:
   ```sql
   UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste')
   WHERE procod IN (1, 2, 3); -- IDs das peças que deseja agrupar
   ```

3. No sistema, adicione uma das peças ao carrinho com quantidade 1

4. Finalize o pedido (Balcão ou Entrega)

5. **Resultado esperado**:
   - Pedido criado com sucesso
   - WhatsApp enviado
   - Estoque do grupo diminuído para 9
   - Estoque de todas as peças do grupo (1, 2, 3) agora é 9

6. Verificação SQL:
   ```sql
   SELECT pg.name, pg.stock_quantity, p.procod, p.prodes, p.proqtde
   FROM part_groups pg
   JOIN pro p ON p.part_group_id = pg.id
   WHERE pg.name = 'Grupo Teste';
   ```

### Cenário 2: Venda de 2 unidades de peça sem grupo

1. Certifique-se que a peça não pertence a nenhum grupo:
   ```sql
   SELECT procod, prodes, proqtde, part_group_id 
   FROM pro 
   WHERE part_group_id IS NULL AND proqtde > 2
   LIMIT 1;
   ```

2. No sistema, adicione esta peça ao carrinho com quantidade 2

3. Finalize o pedido

4. **Resultado esperado**:
   - Pedido criado com sucesso
   - Apenas o estoque da peça vendida foi decrementado em 2

5. Verificação SQL:
   ```sql
   SELECT procod, prodes, proqtde FROM pro WHERE procod = [ID_DA_PECA];
   ```

### Cenário 3: Estoque insuficiente - deve bloquear a venda

1. Crie uma situação de estoque baixo:
   ```sql
   UPDATE part_groups SET stock_quantity = 1 WHERE name = 'Grupo Teste';
   UPDATE pro SET proqtde = 1 WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste');
   ```

2. No sistema, adicione uma peça do grupo ao carrinho com quantidade 5

3. Tente finalizar o pedido

4. **Resultado esperado**:
   - Erro exibido: "Estoque do grupo 'Grupo Teste' insuficiente. Disponível: 1, Solicitado: 5"
   - Nenhum pedido foi criado
   - Nenhuma alteração no estoque
   - WhatsApp NÃO foi enviado

### Cenário 4: Venda de múltiplos itens do mesmo grupo

1. Configure estoque do grupo:
   ```sql
   UPDATE part_groups SET stock_quantity = 20 WHERE name = 'Grupo Teste';
   ```

2. No sistema, adicione duas peças diferentes do mesmo grupo ao carrinho:
   - Peça A: quantidade 3
   - Peça B: quantidade 2

3. Finalize o pedido

4. **Resultado esperado**:
   - Pedido criado com sucesso
   - Estoque do grupo diminuído em 5 (3+2)
   - Novo estoque do grupo e de todas as peças: 15

## Arquivos Modificados

- `src/models/partGroupModels.js` - Nova função `venderItens()` para venda atômica
- `src/controllers/pedidosController.js` - Novo middleware `validarEDecrementarEstoque`
- `src/routes/pedidosRoutes.js` - Adicionado middleware à rota `/pedidos/enviar`
- `public/js/carrinho.js` - Tratamento de erros de estoque no frontend

## Tratamento de Erros

| Erro | Mensagem para o usuário |
|------|------------------------|
| Peça não encontrada | "Peça com ID X não encontrada" |
| Estoque individual insuficiente | "Estoque insuficiente para a peça 'Nome'. Disponível: X, Solicitado: Y" |
| Estoque do grupo insuficiente | "Estoque do grupo 'Nome' insuficiente. Disponível: X, Solicitado: Y" |
| Estoque de peça do grupo insuficiente | "Estoque insuficiente em uma das peças do grupo 'Nome'. Peça 'Nome' tem apenas X unidades..." |

## Auditoria

Todas as vendas de peças com grupo são registradas na tabela `part_group_audit`:

```sql
SELECT * FROM part_group_audit 
WHERE reason = 'sale' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Considerações Técnicas

- A função `venderItens()` usa `SELECT ... FOR UPDATE` para evitar race conditions
- Múltiplos itens do mesmo grupo são acumulados e processados uma única vez
- A transação é isolada: em caso de qualquer erro, todas as alterações são revertidas
- O frontend só envia WhatsApp após receber resposta OK do servidor
