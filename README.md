# 💰 Sistema de pedidos simples

Sistema web para pedidos simples com login e senha para administrador, onde o usuário comum pode selecionar os produtos, inserir no carrinho e finalizar enviando o pedido ao whatsapp e o administrador pode acessar o painal registrar os produtos e visualizar o dashboard.

---
## 🛠️ Tecnologias Utilizadas

| 🖥️ Frontend  | ⚙️ Backend     | 📦 Pacotes Node.js                        |
|--------------|----------------|-------------------------------------------|
| HTML5        | Node.js        | **Servidor & Roteamento:**               |
| CSS3         | Express        | • express                                 |
| JavaScript   | PostgreSQL     |                                           |
| TailwindCSS       |                                           |
|              |                | **Banco de Dados:**                      |
|              |                | • pg                                      |
|              |                | **Autenticação & Sessões:**             |
|              |                | • bcryptjs                                |
|              |                | • jsonwebtoken                            |
|              |                | **Middlewares & Utilitários:**          |
|              |                | • body-parser                             |
|              |                | • cookie-parser                           |
|              |                | • dotenv                                  |
|              |                | • morgan *(logger)*                       |

---


# 📥 Instalação:

### 1. Clone o repositório:
```bash
git clone https://github.com/CaioRodrigoCEVDEV/sistema_pedidos.git
```
### 2. Instalação dos pacotes Node.js

```bash
npm init -y
npm install express pg bcryptjs jsonwebtoken body-parser dotenv cookie-parser morgan
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

Este repositório contém a definição de um banco de dados PostgreSQL com três tabelas principais: `usu`, `pro` , `modelo`, `tipo`, `qualidade` e `marcas`.

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
	CONSTRAINT pk_usu PRIMARY KEY (usucod, usuemail)
);

-- Permissions

ALTER TABLE public.usu OWNER TO postgres;
GRANT ALL ON TABLE public.usu TO postgres;
```
- **usucod**  : Código do usuario.
- **usunome**  : Nome do usuario.
- **usuemail**: E-mail do usuário (chave primária).
- **ususenha**: Senha do usuário (armazenada como hash MD5, por exemplo).
- **usuadm**  : S ou N para administrador.

### 👤 Inserção de exemplo:
```sql
INSERT INTO usu (usunome,usuemail,ususenha)VALUES ('usuario','email@email.com', md5('123'));
```

---



## 💳 Tabela `marcas` (marcas dos produtos)

Tabela com as marcas disponíveis no sistema.

```sql

CREATE TABLE public.marcas (
	marcascod serial4 NOT NULL,
	marcasdes varchar(40) NULL,
	marcasit bpchar(1) DEFAULT 'N'::bpchar NULL,
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
	modsit bpchar(1) DEFAULT 'N'::bpchar NULL,
	CONSTRAINT pk_modelo PRIMARY KEY (modcod)
);

-- Permissions

ALTER TABLE public.modelo OWNER TO postgres;
GRANT ALL ON TABLE public.modelo TO postgres;

```
- **modcod**: Código do modelo (chave primária).
- **moddes**: Descrição (ex: "S25 ultra").
- **modsit**: Situação (ex: "A","I","X").


### ➕ Inserção de exemplo:
```sql
INSERT INTO modelo (modcod, moddes, modsit) VALUES (1, 'A10', 'A');
```

### 🔐 Permissões:
- Dono: `postgres`
- Permissões completas: `postgres`

---



## 💳 Tabela `qualidade` (Qualidade dos produtos)

Tabela com as qualidades dos produtos disponíveis no sistema.

```sql

CREATE TABLE public.qualidade (
	qualicod serial4 NOT NULL,
	qualides varchar(40) NULL,
	qualisit bpchar(1) DEFAULT 'N'::bpchar NULL,
	CONSTRAINT pk_qualidade PRIMARY KEY (qualicod)
);

-- Permissions

ALTER TABLE public.qualidade OWNER TO postgres;
GRANT ALL ON TABLE public.qualidade TO postgres;
```
- **qualicod**: Código da qualidade (chave primária).
- **moqualidesddes**: Descrição (ex: "Original","Paralela").
- **qualisit**: Situação (ex: "A","I","X").


### ➕ Inserção de exemplo:
```sql
INSERT INTO qualidade (qualicod, qualides, qualisit) VALUES (1, 'Original', 'A');
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
	tiposit bpchar(1) DEFAULT 'N'::bpchar NULL,
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

## 📄 Tabela `pro` (produto)

Cadastro dos produtos disponiveis no sistema

```sql

CREATE TABLE public.pro (
	procod serial4 NOT NULL,
	prodes varchar(40) NULL,
	promarcascod int4 NULL,
	protipocod int4 NULL,
	promodcod int4 NULL,
	proqualicod int4 NULL,
	prosit bpchar(1) DEFAULT 'N'::bpchar NULL,
	provl numeric(14, 4) NULL,
	prousucad int4 NULL,
	prodtcad timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	prousualt int4 NULL,
	prodtalt timestamp NULL,
	CONSTRAINT pk_pro PRIMARY KEY (procod),
	CONSTRAINT fk_pro_marcas FOREIGN KEY (promarcascod) REFERENCES public.marcas(marcascod),
	CONSTRAINT fk_pro_modelo FOREIGN KEY (promodcod) REFERENCES public.modelo(modcod),
	CONSTRAINT fk_pro_qualidade FOREIGN KEY (proqualicod) REFERENCES public.qualidade(qualicod),
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
