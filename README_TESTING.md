# 🧪 Testes Manuais - Sincronização de Estoque de Grupos

Este documento descreve os passos para testar manualmente a funcionalidade de sincronização de estoque entre grupos de compatibilidade (part_groups).

## 📋 Pré-requisitos

1. Banco de dados PostgreSQL configurado e rodando
2. Servidor Node.js em execução (`npm run dev`)
3. Tabelas `part_groups`, `part_group_audit` e `pro` criadas

## 🔧 Estrutura do Sistema de Estoque

### Serviço de Estoque (`src/services/stock.js`)

O novo serviço de estoque implementa a lógica de consumo conforme especificado:

- **`consumirEstoqueParaItem(partId, quantidade, reason, client?)`**: Consome estoque para um único item
- **`consumirEstoqueParaPedido(itens, reason, referenceId?)`**: Processa múltiplos itens em uma transação

### Lógica de Funcionamento

1. **Peças SEM grupo**: Decrementa apenas o estoque individual (`proqtde`)
2. **Peças COM grupo**:
   - Distribui a retirada entre as peças do grupo (ordenadas por estoque DESC)
   - Usa `FOR UPDATE` para evitar condições de corrida
   - Não permite estoque negativo
   - Quando o grupo tem `stock_quantity` definido, atualiza para `MIN(estoque das peças)`
3. **Auditoria**: Grava em `part_group_audit` com `reference_id` = código do produto

### Mudança Importante: reference_id

O campo `reference_id` na tabela `part_group_audit` agora contém o **código do produto (procod)** da peça afetada, permitindo rastreabilidade completa no histórico de movimentações.

---

## 🧪 Cenários de Teste

### Cenário 1: Criar pedido e confirmar peça de grupo COM estoque definido

**Configuração SQL:**
```sql
-- Criar um grupo com estoque definido
INSERT INTO part_groups (name, stock_quantity) VALUES ('Grupo Teste 1', 10);

-- Vincular peças ao grupo (ajustar os IDs conforme seu banco)
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1'), proqtde = 10 WHERE procod IN (1, 2, 3);
```

**Passos:**
1. Acessar o sistema como usuário
2. Adicionar ao carrinho 2 unidades de uma peça do grupo
3. Finalizar pedido (Retirada Balcão ou Entrega)
4. **Verificar que o estoque NÃO foi alterado** (pedido fica pendente)
5. Acessar o painel administrativo de pedidos
6. Localizar o pedido pendente e clicar em "Confirmar Pedido"
7. Verificar resultado após confirmação

**Resultado esperado (após criar pedido):**
- ✅ Pedido criado com status pendente (pvconfirmado = 'N')
- ✅ **Estoque NÃO foi movimentado**
- ✅ WhatsApp abre normalmente

**Resultado esperado (após confirmar pedido):**
- ✅ Estoque das peças do grupo decrementado
- ✅ `part_groups.stock_quantity` = MIN(estoque das peças)
- ✅ Registro de auditoria criado em `part_group_audit` com `reference_id` = código do produto
- ✅ Mensagem de sucesso via **toast**: "Pedido confirmado com sucesso!"

**Verificação SQL:**
```sql
-- ANTES da confirmação: verificar que estoque não mudou
SELECT procod, prodes, proqtde 
FROM pro 
WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1');

-- APÓS confirmação: verificar estoque decrementado
SELECT procod, prodes, proqtde 
FROM pro 
WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1');

-- Verificar estoque do grupo
SELECT * FROM part_groups WHERE name = 'Grupo Teste 1';

-- Verificar auditoria (reference_id deve conter o código do produto)
SELECT a.*, p.prodes 
FROM part_group_audit a
LEFT JOIN pro p ON p.procod::text = a.reference_id
WHERE a.part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1') 
ORDER BY a.created_at DESC;
```

---

### Cenário 2: Confirmar pedido com peça de grupo SEM estoque definido (NULL)

**Configuração SQL:**
```sql
-- Criar um grupo sem estoque definido
INSERT INTO part_groups (name, stock_quantity) VALUES ('Grupo Teste 2', NULL);

-- Vincular peças ao grupo com estoques diferentes
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 2'), proqtde = 5 WHERE procod = 4;
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 2'), proqtde = 3 WHERE procod = 5;
```

**Passos:**
1. Acessar o sistema como usuário
2. Adicionar ao carrinho 6 unidades de uma peça do grupo
3. Finalizar pedido (cria pedido pendente, sem movimentar estoque)
4. Acessar o painel administrativo e confirmar o pedido

**Resultado esperado (após confirmação):**
- ✅ Estoque é consumido das peças, começando pela de maior estoque
- ✅ Peça com 5 unidades fica com 0 (retirou 5)
- ✅ Peça com 3 unidades fica com 2 (retirou 1)
- ✅ Registros de auditoria criados para cada peça afetada
- ✅ `part_groups.stock_quantity` permanece NULL

---

### Cenário 3: Estoque insuficiente na confirmação

**Passos:**
1. Usar um grupo com estoque baixo (ex: 8 unidades)
2. Adicionar ao carrinho 100 unidades de uma peça do grupo
3. Finalizar pedido (cria pedido pendente normalmente)
4. Acessar o painel administrativo e tentar confirmar o pedido

**Resultado esperado:**
- ✅ Pedido é criado com status pendente (criação funciona normalmente)
- ❌ Confirmação FALHA devido a estoque insuficiente
- ✅ Toast de erro exibe: "Estoque insuficiente no grupo..."
- ✅ Nenhuma alteração no banco de dados (ROLLBACK completo)
- ✅ Pedido permanece com status pendente

---

### Cenário 4: Confirmar pedido com peça sem grupo (estoque individual)

**Passos:**
1. Selecionar uma peça que NÃO pertence a nenhum grupo
2. Verificar que `part_group_id` é NULL
3. Adicionar ao carrinho e finalizar pedido (cria pedido pendente)
4. Acessar o painel administrativo e confirmar o pedido

**Resultado esperado (após confirmação):**
- ✅ Apenas o estoque individual da peça (`proqtde`) é decrementado
- ✅ Nenhum registro em `part_group_audit` é criado

---

### Cenário 5: Histórico no Frontend (Painel Administrativo)

**Passos:**
1. Acessar o painel administrativo
2. Navegar para "Grupos de Compatibilidade"
3. Selecionar um grupo e visualizar histórico

**Resultado esperado:**
- ✅ Histórico exibe movimentações com o código do produto como referência
- ✅ Cada entrada mostra: quantidade alterada, motivo (sale), data
- ✅ Nome da peça é exibido quando disponível (join com tabela `pro`)

---

## 🖼️ Interface do Usuário

### Substituição de alert() por showToast()

Todos os alertas foram substituídos por notificações toast para melhor experiência do usuário:

- **Erros**: Toast vermelho com ícone ❌
- **Sucesso**: Toast verde com ícone ✅  
- **Avisos**: Toast amarelo com ícone ⚠️

Os toasts são exibidos no canto superior direito e fecham automaticamente após 3 segundos.

---

## 🔄 Fluxo de Criação e Confirmação de Pedido

O fluxo atualizado garante que o estoque seja movimentado **SOMENTE** na confirmação do pedido:

### Criação do Pedido (Carrinho → Retirada Balcão / Entrega)

```
1. Validar carrinho (itens e quantidades)
2. Criar registro do pedido (pv) com status = pendente (pvconfirmado = 'N')
3. Criar itens do pedido (pvi)
4. Redirecionar para WhatsApp
⚠️ ESTOQUE NÃO É MOVIMENTADO NESTE MOMENTO
```

### Confirmação do Pedido (Painel de Pedidos)

```
1. Usuário clica em "Confirmar Pedido" no painel administrativo
2. [TRANSAÇÃO] Inicia transação no banco
3. Bloqueia o pedido com FOR UPDATE
4. Carrega os itens do pedido (pvi)
5. [ESTOQUE] Consome estoque via consumirEstoqueComClient()
   - Para peças sem grupo: decrementa estoque individual
   - Para peças com grupo: distribui consumo entre peças (maior estoque primeiro)
   - Atualiza part_groups.stock_quantity = MIN(estoques)
   - Registra auditoria em part_group_audit (reference_id = código do produto)
6. Atualiza pedido: pvconfirmado = 'S', pvdtconfirmado = NOW()
7. [COMMIT] Persiste todas as alterações
8. Retorna sucesso para o frontend (exibe toast de sucesso)
```

### Tratamento de Erros

Se houver estoque insuficiente durante a confirmação:
- Toda a transação é revertida (ROLLBACK)
- Nenhum estoque é movimentado
- Toast de erro é exibido: "Estoque insuficiente no grupo..."
- Pedido permanece com status pendente

---

## 📝 Comandos Git

Para trabalhar com esta feature:

```bash
# Clonar o repositório (se ainda não tiver)
git clone https://github.com/CaioRodrigoCEVDEV/sistema_pedidos.git
cd sistema_pedidos

# Verificar a branch atual
git branch -a

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev

# Executar testes (se disponíveis)
npm test
```

---

## 📦 Arquivos Modificados/Criados

### Novos Arquivos
- `src/services/stock.js` - Serviço de gestão de estoque

### Arquivos Modificados
- `src/controllers/pedidosController.js` - Integração com serviço de estoque
- `public/html/auth/js/perfil.js` - alert → showToast
- `public/html/auth/js/painel.js` - alert → showToast
- `public/html/auth/js/painel-cor.js` - alert → showToast
- `public/html/auth/js/painel-tipo.js` - alert → showToast
- `public/html/auth/js/painel-produto.js` - alert → showToast
- `public/html/auth/js/usuarios.js` - alert → showToast
- `public/html/auth/js/lista-pecas.js` - alert → showToast
- `public/html/auth/js/painel-marca.js` - alert → showToast
- `public/html/auth/js/pecas.js` - alert → showToast
- `public/html/auth/js/modelo.js` - alert → showToast
- `public/html/auth/js/painel-pedidos.js` - alert → showToast
- Diversos arquivos HTML - Inclusão de toast.js

---

## ✅ Critérios de Aceitação

- [x] Confirmar pedido que contenha itens agrupados: estoques decrementados apenas na confirmação
- [x] `part_group_audit` registra `reference_id` com o código do produto
- [x] `part_groups.estoque` atualizado para MIN(estoques) quando aplicável
- [x] WhatsApp enviado APÓS commit bem-sucedido
- [x] Se estoque insuficiente: erro "Estoque insuficiente no grupo" e ROLLBACK completo
- [x] Todos os `alert()` substituídos por `showToast()`
