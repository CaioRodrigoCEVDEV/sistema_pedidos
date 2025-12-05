# 💰 Sistema de pedidos simples

Sistema web para pedidos simples com login e senha para administrador, onde o usuário comum pode selecionar os produtos, inserir no carrinho e finalizar enviando o pedido ao whatsapp e o administrador pode acessar o painal registrar os produtos e visualizar o dashboard.

---

## 🛠️ Tecnologias Utilizadas

| 🖥️ Frontend | ⚙️ Backend | 📦 Pacotes Node.js             |
| ----------- | ---------- | ------------------------------ |
| HTML5       | Node.js    | **Servidor & Roteamento:**     |
| CSS3        | Express    | • express                      |
| JavaScript  | PostgreSQL | • multer                       |
|             |            | **Banco de Dados:**            |
|             |            | • pg                           |
|             |            | **Autenticação & Sessões:**    |
|             |            | • bcryptjs                     |
|             |            | • jsonwebtoken                 |
|             |            | **Middlewares & Utilitários:** |
|             |            | • body-parser                  |
|             |            | • cookie-parser                |
|             |            | • dotenv                       |
|             |            | • morgan _(logger)_            |
|             |            | • nodemon                      |
|             |            | • sharp                        |

---

# 📥 Instalação:

### 1. Clone o repositório:

```bash
git clone https://github.com/CaioRodrigoCEVDEV/sistema_pedidos.git
```

### 2. Instalação dos pacotes Node.js

```bash
npm init -y
npm install express pg bcryptjs jsonwebtoken body-parser dotenv cookie-parser morgan multer
npm install -g nodemon

```

### 3. Crie um arquivo .env na raiz com o seguinte conteúdo:

```bash
DB_HOST=SEU_IP
DB_PORT=PORTA
DB_USER=USUARIO
DB_PASSWORD=SENHA
DB_NAME=BASE_DADOS
BASE_URL=http://localhost:3000
HTTPS=false

```

---

# 📦 Estrutura do Banco de Dados

Este repositório contém a definição de um banco de dados PostgreSQL com três tabelas principais: `usu`, `pro` , `modelo`, `tipo` e `marcas`.

---

## 🔐 Tabela `usu` (Usuários)

Armazena os dados de login dos usuários do sistema.

```sql
CREATE TABLE public.usu (
  usucod serial4 NOT NULL,
  usunome varchar NULL,
  usuemail varchar(120) NOT NULL,
  ususenha varchar(32) NULL,
  usuadm bpchar(1) default 'N',
  ususta varchar(1) DEFAULT 'A'::character varying NULL,
  usuest varchar(1) default 'S',
  usupv varchar(1) default 'S',
	CONSTRAINT pk_usu PRIMARY KEY (usuemail)
);

-- Permissions

ALTER TABLE public.usu OWNER TO postgres;
GRANT ALL ON TABLE public.usu TO postgres;
```

- **usucod** : Código do usuario.
- **usunome** : Nome do usuario.
- **usuemail**: E-mail do usuário (chave primária).
- **ususenha**: Senha do usuário (armazenada como hash MD5, por exemplo).
- **usuadm** : S ou N para administrador.

### 👤 Inserção de exemplo:

```sql
INSERT INTO usu (usunome,usuemail,ususenha)VALUES ('usuario','admin@orderup.com.br', md5('orderup@'));
```

---

## 💳 Tabela `marcas` (marcas dos produtos)

Tabela com as marcas disponíveis no sistema.

```sql

CREATE TABLE public.marcas (
	marcascod serial4 NOT NULL,
	marcasdes varchar(40) NULL,
	marcassit bpchar(1) DEFAULT 'A'::bpchar NULL,
	marcasordem int4 NULL,
	CONSTRAINT pk_marcas PRIMARY KEY (marcascod)
);

-- Permissions

ALTER TABLE public.marcas OWNER TO postgres;
GRANT ALL ON TABLE public.marcas TO postgres;
```

- **marcascod**: Código da marca (chave primária).
- **marcasdes**: Descrição (ex: "Samsung").
- **marcasit**: Situação (ex: "A","I","X").

### ➕ Inserção de exemplo:

```sql
INSERT INTO marcas (marcascod, marcasdes, marcasit) VALUES (1, 'Samsung', 'A');
```

### 🔐 Permissões:

- Permissões completas: `postgres`

---

## 💳 Tabela `modelo` (modelo do produto)

Tabela com os modelos disponíveis no sistema.

```sql

CREATE TABLE public.modelo (
	modcod serial4 NOT NULL,
	moddes varchar(40) NULL,
	modsit bpchar(1) DEFAULT 'A'::bpchar NULL,
	modmarcascod int4 NULL,
	ordem int4 NULL,
	CONSTRAINT pk_modelo PRIMARY KEY (modcod),
	CONSTRAINT fk_modelo_marcas FOREIGN KEY (modmarcascod) REFERENCES public.marcas(marcascod)
);


-- Permissions

ALTER TABLE public.modelo OWNER TO postgres;
GRANT ALL ON TABLE public.modelo TO postgres;

```

- **modcod**: Código do modelo (chave primária).
- **moddes**: Descrição (ex: "S25 ultra").
- **modsit**: Situação (ex: "A","I","X").
- **modmarcascod**: Código do modelo (chave estrangeira MARCAS).

### ➕ Inserção de exemplo:

```sql
INSERT INTO modelo (modcod, moddes, modsit) VALUES (1, 'A10', 'A');
```

### 🔐 Permissões:

- Dono: `postgres`
- Permissões completas: `postgres`

---

## 📄 Tabela `tipo` (tipo do produto)

Registra o tipo dos produtos, Tela, Bateria e etc.

```sql

CREATE TABLE public.tipo (
	tipocod serial4 NOT NULL,
	tipodes varchar(40) NULL,
	tiposit bpchar(1) DEFAULT 'A'::bpchar NULL,
	tipoordem int4 NULL,
	CONSTRAINT pk_tipo PRIMARY KEY (tipocod)
);

-- Permissions

ALTER TABLE public.tipo OWNER TO postgres;
GRANT ALL ON TABLE public.tipo TO postgres;
```

- **tipocod**: Código do tipo (chave primária).
- **tipodes**: Descrição (ex: "Tela","Bateria").
- **tiposit**: Situação (ex: "A","I","X").

### ➕ Inserção de exemplo:

```sql
INSERT INTO tipo (tipocod, tipodes, tiposit) VALUES (1, 'Tela', 'A');
```

### 🔐 Permissões:

- Dono: `postgres`
- Permissões completas: `postgres`

---

## 📄 Tabela `cores` (produto)

Cadastro de cores dos produtos disponiveis no sistema

```sql

CREATE TABLE cores (
  corcod SERIAL PRIMARY KEY,
  cornome VARCHAR(50) NOT NULL
);

```

- **corcod**: Código da cor (chave primária).
- **cornome**: Descrição (ex: "Branco","Azul").

### ➕ Inserção de exemplo:

```sql

INSERT INTO cores (cornome) VALUES
  ('Preto'),
  ('Branco'),
  ('Cinza'),
  ('Prata'),
  ('Azul'),
  ('Vermelho'),
  ('Verde'),
  ('Amarelo'),
  ('Marrom'),
  ('Laranja'),
  ('Rosa'),
  ('Roxo'),
  ('Dourado'),
  ('Bege');

```

### 🔐 Permissões:

- Dono: `postgres`
- Permissões completas: `postgres`

---

## 📄 Tabela `pro` (produto)

Cadastro dos produtos disponiveis no sistema

```sql

CREATE TABLE public.pro (
	procod serial4 NOT NULL,
	prodes varchar(40) NULL,
	promarcascod int4 NULL,
	protipocod int4 NULL,
	promodcod int4 NULL,
	prosit bpchar(1) DEFAULT 'A'::bpchar NULL,
	provl numeric(14, 4) NULL,
	prousucad int4 NULL,
	prodtcad timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	prousualt int4 NULL,
	prodtalt timestamp NULL,
	procor int,
	proordem int,
	CONSTRAINT pk_pro PRIMARY KEY (procod),
	CONSTRAINT fk_pro_cor FOREIGN KEY (procor) REFERENCES public.cores(corcod),
	CONSTRAINT fk_pro_marcas FOREIGN KEY (promarcascod) REFERENCES public.marcas(marcascod),
	CONSTRAINT fk_pro_modelo FOREIGN KEY (promodcod) REFERENCES public.modelo(modcod),
	CONSTRAINT fk_pro_tipo FOREIGN KEY (protipocod) REFERENCES public.tipo(tipocod)
);
-- Permissions

ALTER TABLE public.pro OWNER TO postgres;
GRANT ALL ON TABLE public.pro TO postgres;
```

- **procod**: Código do tipo (chave primária).
- **prodes**: Descrição (ex: "Tela","Bateria").

### ➕ Inserção de exemplo:

```sql
INSERT INTO pro (procod, prodes, promarcascod, protipocod, promodcod, proqualicod, prosit, provl) VALUES (1, 'Numquam in iste.', 1, 5, 3, 1, 'A', 320.96);
```

### 🔐 Permissões:

- Dono: `postgres`
- Permissões completas: `postgres`

---

## 📄 Tabela `procor` (produto)

Vinculo de cores com os produtos disponiveis no sistema

```sql
CREATE TABLE public.procor (
	procorprocod int4 NOT NULL,
	procorcorescod int4 NOT NULL,
	procorid serial4 NOT NULL,
	CONSTRAINT pk_procor PRIMARY KEY (procorprocod, procorcorescod)
);

-- Permissions

ALTER TABLE public.procor OWNER TO postgres;
GRANT ALL ON TABLE public.procor TO postgres;
```

---

## 📄 Tabela `emp` (Empresa)

```sql
CREATE TABLE public.emp (
	empcod serial4 NOT NULL,
	emprazao varchar(254) NULL,
	empwhatsapp1 varchar(13) NULL,
	empwhatsapp2 varchar(13) NULL,
	empdtpag date NULL,
	empdtvenc date NULL
);
```

### ➕ Inserção de exemplo:

```
INSERT INTO public.emp
(emprazao, empwhatsapp1, empwhatsapp2)
VALUES('Razao Social ou Fantasia', '', '');
```

---

# 💰 View Tipo de Peças

```sql
CREATE OR REPLACE VIEW public.vw_tipo_pecas
AS SELECT tipo.tipocod,
    tipo.tipodes,
    pro.promarcascod,
    pro.promodcod,
	tipo.tipoordem
   FROM pro
     JOIN tipo ON tipo.tipocod = pro.protipocod
  GROUP BY tipo.tipocod, tipo.tipodes, pro.promarcascod, pro.promodcod;

-- Permissions

ALTER TABLE public.vw_tipo_pecas OWNER TO postgres;
GRANT ALL ON TABLE public.vw_tipo_pecas TO postgres;
```

---

# 💰 View Marcas

```sql

CREATE OR REPLACE VIEW public.vw_marcas
AS SELECT marcas.marcascod,
    marcas.marcasdes,
    marcas.marcassit
   FROM marcas;

-- Permissions

ALTER TABLE public.vw_marcas OWNER TO postgres;
GRANT ALL ON TABLE public.vw_marcas TO postgres;
```

---

# View modelos

```sql
CREATE OR REPLACE VIEW public.vw_modelos
AS SELECT modelo.modcod,
    modelo.moddes,
    modelo.modsit,
    modelo.modmarcascod,
    modelo.ordem
   FROM modelo
  ORDER BY ("substring"(modelo.moddes::text, '^\D*'::text)), ("substring"(modelo.moddes::text, '\d+'::text)::integer);

```

---

# 🧪 Testes Manuais - Sincronização de Estoque de Grupos

Esta seção descreve os passos para testar manualmente a funcionalidade de sincronização de estoque entre grupos de compatibilidade (part_groups).

## Pré-requisitos

1. Banco de dados PostgreSQL configurado e rodando
2. Servidor Node.js em execução
3. Tabelas `part_groups`, `part_group_audit` e `pro` criadas (executar migração do banco)

## Cenários de Teste

### Cenário 1: Vender peça de grupo COM estoque definido

**Configuração:**
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
4. Verificar resultado

**Resultado esperado:**
- Todas as peças do grupo devem ter estoque decrementado em 2 unidades
- `part_groups.stock_quantity` deve ser igual ao MIN(estoque das peças) = 8
- Registro de auditoria criado em `part_group_audit` com `reference_id` = código do produto
- Mensagem de sucesso via toast (não alert)
- WhatsApp abre apenas após commit bem-sucedido

**Verificação SQL:**
```sql
-- Verificar estoque das peças do grupo
SELECT procod, prodes, proqtde FROM pro WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1');

-- Verificar estoque do grupo
SELECT * FROM part_groups WHERE name = 'Grupo Teste 1';

-- Verificar auditoria
SELECT * FROM part_group_audit WHERE part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 1') ORDER BY created_at DESC;
```

---

### Cenário 2: Vender peça de grupo SEM estoque definido (NULL)

**Configuração:**
```sql
-- Criar um grupo sem estoque definido
INSERT INTO part_groups (name, stock_quantity) VALUES ('Grupo Teste 2', NULL);

-- Vincular peças ao grupo com estoques diferentes
UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 2') WHERE procod = 4;
UPDATE pro SET proqtde = 5 WHERE procod = 4;

UPDATE pro SET part_group_id = (SELECT id FROM part_groups WHERE name = 'Grupo Teste 2') WHERE procod = 5;
UPDATE pro SET proqtde = 3 WHERE procod = 5;
```

**Passos:**
1. Acessar o sistema como usuário
2. Adicionar ao carrinho 6 unidades de uma peça do grupo
3. Finalizar pedido

**Resultado esperado:**
- Estoque é consumido das peças, começando pela de maior estoque
- Peça com 5 unidades fica com 0
- Peça com 3 unidades fica com 2 (5-5+3-1=2)
- Registros de auditoria criados para cada peça afetada
- `part_groups.stock_quantity` permanece NULL

---

### Cenário 3: Estoque insuficiente

**Configuração:**
```sql
-- Usar o Grupo Teste 1 com estoque = 8 (após Cenário 1)
-- Ou criar novo grupo com estoque baixo
```

**Passos:**
1. Acessar o sistema como usuário
2. Adicionar ao carrinho 100 unidades de uma peça do grupo
3. Tentar finalizar pedido

**Resultado esperado:**
- Pedido NÃO é criado
- Toast de erro exibe: "Estoque insuficiente no grupo..."
- Nenhuma alteração no banco de dados
- Botões são reabilitados para nova tentativa

---

### Cenário 4: Histórico no Frontend

**Passos:**
1. Acessar o painel administrativo
2. Navegar para "Grupos de Compatibilidade"
3. Selecionar um grupo e visualizar histórico

**Resultado esperado:**
- Histórico exibe movimentações com o código do produto (procod) como referência
- Cada entrada mostra: quantidade alterada, motivo (sale/cancellation), data

---

## Comandos Git

Para criar a branch e trabalhar nesta feature:

```bash
# Criar branch a partir da release
git checkout release
git pull origin release
git checkout -b feature/sync-group-stock

# Após fazer as alterações, commitar
git add .
git commit -m "feat: implementa sincronização de estoque de grupos"

# Enviar para o repositório remoto
git push -u origin feature/sync-group-stock
```

---
