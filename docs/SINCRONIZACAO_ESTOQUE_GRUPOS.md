# Sincronização de Estoque de Grupos de Peças

## Visão Geral

Esta funcionalidade permite sincronizar o estoque entre peças que pertencem ao mesmo grupo. Quando uma peça é vendida, todas as outras peças do grupo têm seu estoque atualizado automaticamente.

## Tabela part_grups

A tabela `part_grups` é criada automaticamente ao iniciar a aplicação (via `atualizardb.js`):

```sql
CREATE TABLE IF NOT EXISTS public.part_grups (
  grupcod SERIAL PRIMARY KEY,      -- ID único do grupo
  grupdes VARCHAR(120) NOT NULL,   -- Descrição do grupo
  estoque INT NULL,                -- Estoque do grupo (pode ser NULL)
  grupsit CHAR(1) DEFAULT 'A'      -- Situação: 'A' = Ativo, 'I' = Inativo
);
```

## Coluna progrupcod na Tabela pro

Uma nova coluna `progrupcod` foi adicionada à tabela `pro` para vincular peças a grupos:

```sql
ALTER TABLE public.pro ADD IF NOT EXISTS progrupcod INT NULL 
  REFERENCES public.part_grups(grupcod) ON DELETE SET NULL;
```

## Comportamento

### 1. Peça SEM Grupo
- Comportamento inalterado
- Apenas a peça vendida tem seu estoque decrementado

### 2. Peça COM Grupo - Grupo TEM Estoque Definido
Quando `part_grups.estoque` NÃO É NULL:
- O campo `estoque` do grupo é a fonte da verdade
- Validação: `grupo.estoque >= quantidade_vendida`
- Ao confirmar venda:
  - `part_grups.estoque` é decrementado
  - Todas as peças do grupo são sincronizadas com o novo valor

### 3. Peça COM Grupo - Grupo NÃO TEM Estoque Definido
Quando `part_grups.estoque` É NULL:
- O estoque individual de cada peça é a fonte da verdade
- Validação: todas as peças do grupo devem ter `proqtde >= quantidade_vendida`
- Ao confirmar venda:
  - Todas as peças do grupo têm `proqtde` decrementado pela mesma quantidade

## APIs

### Validação de Estoque
```
POST /validar-estoque
Body: { "cart": [{ "id": "procod", "qt": quantidade, "nome": "...", "idCorSelecionada": null }] }
Response: { "valido": true } ou { "valido": false, "erro": "mensagem" }
```

### CRUD de Grupos (requer autenticação)
```
GET    /grupos              - Listar grupos ativos
GET    /grupos/:id          - Buscar grupo por ID
POST   /grupos              - Criar grupo { "grupdes": "...", "estoque": 10 }
PUT    /grupos/:id          - Atualizar grupo
DELETE /grupos/:id          - Excluir (inativar) grupo
GET    /grupos/:id/pecas    - Listar peças de um grupo
PUT    /grupos/:id/estoque  - Atualizar estoque do grupo e sincronizar peças
```

### Vincular/Desvincular Peças
```
POST   /grupos/vincular              - { "grupcod": 1, "procod": 10 }
DELETE /grupos/desvincular/:procod   - Desvincular peça do grupo
```

## Fluxo de Venda

1. Usuário adiciona itens ao carrinho
2. Ao clicar em "Finalizar" (Balcão/Entrega):
   - Frontend chama `POST /validar-estoque`
   - Se válido, cria o pedido
   - Se inválido, exibe erro e bloqueia a venda
3. Administrador confirma o pedido no painel
4. Trigger `atualizar_saldo` é disparado
5. Estoque é atualizado atomicamente (grupo + peças)
6. WhatsApp é enviado somente após sucesso

## Mensagens de Erro

- "Estoque do grupo '{nome}' insuficiente. Disponível: X, Solicitado: Y"
- "Estoque insuficiente em uma das peças do grupo '{nome}'. Peça '{peça}' tem apenas X unidades disponíveis."
- "Estoque insuficiente para {produto}. Disponível: X, Solicitado: Y"

## Migração / Upgrade

Nenhuma migração manual é necessária. As alterações no banco são aplicadas automaticamente pelo `atualizardb.js` ao iniciar a aplicação:

1. Tabela `part_grups` é criada se não existir
2. Coluna `progrupcod` é adicionada à tabela `pro` se não existir
3. Índice é criado para otimizar buscas
4. Triggers são atualizados para suportar a nova lógica

## Considerações Técnicas

- **Transações**: Todas as operações de estoque são atômicas com locks FOR UPDATE
- **Triggers**: `atualizar_saldo` e `retornar_saldo` foram atualizadas para suportar grupos
- **Rollback**: Se houver erro, toda a operação é revertida
- **Compatibilidade**: Peças sem grupo continuam funcionando normalmente
