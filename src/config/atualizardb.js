const pool = require("./db");
const TELAS = require("./telas");
const { ensureReleasesSchema } = require("./releasesSchema");

async function atualizarDB() {
  const LOCK_KEY = 20250911;

  await pool.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    await pool.query("BEGIN");

    // ==================================================================================================================================
    // NOVOS CAMPOS QUE FOMOS ADICIONANDO ADD AQUI: pleaSE

    // Exemplo: LEMBRAR SEMPRE DE COLOCAR O "IF NOT EXISTS"

    //  await pool.query(`ALTER TABLE public.emp ADD IF NOT exists empcod serial4 NOT NULL;`);

    await pool.query(
      `ALTER TABLE public.emp ADD IF NOT exists empcod serial4 NOT NULL;`
    );

    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS emp_empcod_key ON public.emp (empcod);`
    );

    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS usu_usucod_key ON public.usu (usucod);`
    );

    await pool.query(
      `ALTER TABLE public.marcas ADD IF NOT exists marcasordem int;`
    );

    await pool.query(
      `ALTER TABLE public.tipo ADD IF NOT exists tipoordem int;`
    );
    await pool.query(
      `ALTER TABLE public.usu ADD IF NOT exists ususta varchar(1) default 'A';`
    );
    await pool.query(
      `ALTER TABLE public.usu ADD IF NOT exists usuest varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.usu ADD IF NOT exists usupv varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.usu ADD IF NOT exists usurca varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.usu ADD IF NOT exists usuviuversao varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.emp ADD IF NOT exists empusapv varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.emp ADD IF NOT exists empusaest varchar(1) default 'N';`
    );
    await pool.query(
      `alter table public.procor add IF NOT exists procorqtde int null;`
    );
    await pool.query(
      `ALTER TABLE public.pro ADD IF NOT exists proqtde int4 DEFAULT 0 NOT NULL;`
    );
    await pool.query(
      `ALTER TABLE public.pv ADD if not exists pvdtcad date DEFAULT now() NOT NULL;`
    );
    await pool.query(
      `ALTER TABLE public.pv ADD if not exists pvrcacod int4 NULL;`
    );
    await pool.query(
      `ALTER TABLE public.pro ADD if not exists prosemest varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.pvi ADD if not exists pviprocorid int4 NULL;`
    );
    await pool.query(
      `ALTER TABLE public.procor ADD if not exists procorsemest bpchar(1) DEFAULT 'N'::bpchar NULL;`
    );
    await pool.query(
      `ALTER TABLE public.pro ADD if not exists proacabando bpchar(1) DEFAULT 'N'::bpchar NULL;`
    );
    await pool.query(
      `ALTER TABLE public.pro ADD if not exists procusto numeric(14, 4) NULL;`
    );
    //temporatrio
    await pool.query(`
        ALTER TABLE public.procor ALTER COLUMN procorqtde SET DEFAULT 0;
        ALTER TABLE public.procor ALTER COLUMN procorsemest SET DEFAULT 'S'::bpchar;

    `);
    await pool.query(`update usu set usuviuversao = 'N';`);

    //fim temporatrio

    // Tabela de relacionamento muitos-para-muitos entre produtos e modelos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.promod (
        promodprocod int4 NOT NULL,
        promodmodcod int4 NOT NULL,
        CONSTRAINT promod_pkey PRIMARY KEY (promodprocod, promodmodcod),
        CONSTRAINT promod_procod_fkey FOREIGN KEY (promodprocod) REFERENCES public.pro(procod) ON DELETE CASCADE,
        CONSTRAINT promod_modcod_fkey FOREIGN KEY (promodmodcod) REFERENCES public.modelo(modcod) ON DELETE CASCADE
      );
    `);

    // Migrar dados existentes de promodcod para a tabela promod (se existirem)
    await pool.query(`
      INSERT INTO public.promod (promodprocod, promodmodcod)
      SELECT procod, promodcod FROM public.pro 
      WHERE promodcod IS NOT NULL
      ON CONFLICT (promodprocod, promodmodcod) DO NOTHING;
    `);

    // ==================================================================================================================================
    // GRUPOS DE COMPATIBILIDADE (PART GROUPS) - Grupos para gerenciamento de estoque compartilhado
    // Simplificado: usa INTEGER como ID (auto increment) ao invés de UUID
    // ==================================================================================================================================

    // Verifica se a tabela part_groups existe com UUID e precisa de migração
    await pool.query(`
      DO $$
      BEGIN
        -- Se a tabela existe com coluna UUID, faz a migração para INTEGER
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'part_groups' 
          AND column_name = 'id' 
          AND data_type = 'uuid'
        ) THEN
          -- Remove as constraints antigas
          ALTER TABLE public.pro DROP CONSTRAINT IF EXISTS fk_pro_part_group;
          DROP INDEX IF EXISTS idx_pro_part_group_id;
          DROP INDEX IF EXISTS idx_part_group_audit_group_id;
          
          -- Cria tabela temporária para migração dos dados
          CREATE TEMP TABLE temp_part_groups AS SELECT * FROM public.part_groups;
          CREATE TEMP TABLE temp_audit AS SELECT * FROM public.part_group_audit;
          CREATE TEMP TABLE temp_pro_groups AS SELECT procod, part_group_id FROM public.pro WHERE part_group_id IS NOT NULL;
          
          -- Remove as tabelas antigas
          DROP TABLE IF EXISTS public.part_group_audit;
          DROP TABLE IF EXISTS public.part_groups CASCADE;
          
          -- Limpa a coluna part_group_id da tabela pro
          ALTER TABLE public.pro DROP COLUMN IF EXISTS part_group_id;
        END IF;
      END$$;
    `);

    // Cria tabela part_groups com ID INTEGER (auto increment) - mais simples e fácil de entender
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.part_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Adiciona coluna grpcusto na tabela part_groups (custo do grupo)
    await pool.query(`
      ALTER TABLE public.part_groups ADD COLUMN IF NOT EXISTS grpcusto NUMERIC(14, 4) NULL;
    `);

    // Adiciona coluna color_id na tabela part_groups (vincula grupo a uma cor)
    await pool.query(`
      ALTER TABLE public.part_groups ADD COLUMN IF NOT EXISTS color_id INTEGER NULL;
    `);

    // Adiciona coluna part_group_id na tabela pro (FK para grupos de compatibilidade)
    await pool.query(`
      ALTER TABLE public.pro ADD IF NOT EXISTS part_group_id INTEGER NULL;
    `);

    // Adiciona a constraint de chave estrangeira se não existir
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_pro_part_group' 
          AND table_name = 'pro'
        ) THEN
          ALTER TABLE public.pro 
            ADD CONSTRAINT fk_pro_part_group 
            FOREIGN KEY (part_group_id) 
            REFERENCES public.part_groups(id) 
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // Cria tabela de auditoria para histórico de movimentações de estoque do grupo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.part_group_audit (
        id SERIAL PRIMARY KEY,
        part_group_id INTEGER NOT NULL REFERENCES public.part_groups(id) ON DELETE CASCADE,
        change INTEGER NOT NULL,
        reason TEXT,
        reference_id TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Índice para buscas rápidas no histórico de auditoria
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_part_group_audit_group_id 
      ON public.part_group_audit(part_group_id);
    `);

    // Índice para buscas rápidas de peças por grupo
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pro_part_group_id 
      ON public.pro(part_group_id);
    `);

    // Adiciona coluna corhex na tabela cores (código HEX opcional para exibição)
    await pool.query(`
      ALTER TABLE public.cores ADD COLUMN IF NOT EXISTS corhex TEXT NULL;
    `);

    // Tabela de itens do grupo de compatibilidade, vinculando grupo a uma variação procor
    // Substitui o campo part_group_id em pro, permitindo o mesmo produto em vários grupos
    // desde que com cores diferentes (procorid diferente).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.part_group_items (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES public.part_groups(id) ON DELETE CASCADE,
        procorid INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_part_group_item UNIQUE (group_id, procorid)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_part_group_items_group_id
      ON public.part_group_items(group_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_part_group_items_procorid
      ON public.part_group_items(procorid);
    `);

    // Adiciona coluna qtde_ideal em part_groups (quantidade ideal de estoque por grupo)
    await pool.query(`
      ALTER TABLE public.part_groups ADD COLUMN IF NOT EXISTS qtde_ideal INTEGER NULL;
    `);

    // ==================================================================================================================================
    // RELEASES DO SISTEMA
    // Histórico de atualizações persistido no PostgreSQL. O modal "Ver
    // atualizações" lê apenas o banco; a API do GitHub só é usada pelo script
    // de sincronização (scripts/sync-releases.js / npm run releases:sync).
    // ==================================================================================================================================

    await ensureReleasesSchema(pool);

    // ==================================================================================================================================
    // FIM RELEASES DO SISTEMA
    // ==================================================================================================================================

    // ==================================================================================================================================
    // FIM GRUPOS DE COMPATIBILIDADE
    // ==================================================================================================================================

    // FIM NOVOS CAMPOS
    // ==================================================================================================================================

    //   INSERTS CONDICIONAIS

    // EMP default (empcod = 1)
    await pool.query(`
      INSERT INTO public.emp (empcod, emprazao, empwhatsapp1, empwhatsapp2)
      VALUES (1, 'Razao Social ou Fantasia', '', '')
      ON CONFLICT (empcod) DO NOTHING;
    `);

    // USU default (usucod = 1, usunome = 'orderup')
    await pool.query(`
      INSERT INTO public.usu (usunome, usuemail, ususenha,usuadm,usupv,usuest)
      VALUES ('orderup', 'admin@orderup.com.br', md5('orderup@'),'S','S','S')
      ON CONFLICT (usuemail) DO NOTHING;
    `);

    // View Tipo peças
    await pool.query(`
      CREATE OR REPLACE VIEW public.vw_tipo_pecas
      AS SELECT tipo.tipocod,
          tipo.tipodes,
          pro.promarcascod,
          promod.promodmodcod as promodcod,
          tipo.tipoordem
        FROM pro
          left join promod on promodprocod = pro.procod
          left JOIN tipo ON tipo.tipocod = pro.protipocod
        GROUP BY tipo.tipocod, tipo.tipodes, pro.promarcascod, promod.promodmodcod;

      -- Permissions

      ALTER TABLE public.vw_tipo_pecas OWNER TO postgres;
      GRANT ALL ON TABLE public.vw_tipo_pecas TO postgres;
    `);

    // Table EST (estoque)
    await pool.query(`
        CREATE TABLE IF NOT exists public.est (
      estprocod int4 NOT NULL,
      estqt int4 NOT NULL,
      esttipo varchar(4) NULL,
      CONSTRAINT est_pkey PRIMARY KEY (estprocod)
      );
    `);

    // Table PV (pedidos de venda)
    await pool.query(`
        CREATE TABLE IF NOT exists public.pv (
        pvcod int4 NOT NULL,
        pvdtcad date DEFAULT now() NOT NULL,
        pvvl numeric(14, 4) DEFAULT 0 NULL,
        pvobs varchar(254) NULL,
        pvcanal varchar(10) NULL,
        pvconfirmado bpchar(2) NULL,
        pvsta bpchar(2) NULL,
        CONSTRAINT pvcod_pkey PRIMARY KEY (pvcod)
      );

    `);

    // Table PVI (itens dos pedidos de venda)
    await pool.query(`
        CREATE TABLE IF NOT exists public.pvi (
          pvipvcod int4 NOT NULL,
          pviprocod int4 NOT NULL,
          pvivl numeric(14, 4) DEFAULT 0 NULL,
          pviqtde numeric(14, 4) DEFAULT 0 NULL
      );
    `);

    // Devolucoes sao registradas separadamente para preservar a venda
    // original e permitir devolucoes parciais com rastreabilidade.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.devolucoes (
        devcod BIGSERIAL PRIMARY KEY,
        devpvcod INT4 NOT NULL REFERENCES public.pv(pvcod),
        devdtcad TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        devusucod INT4 NULL,
        devmotivo VARCHAR(80) NOT NULL,
        devobs VARCHAR(254) NULL,
        devsta BPCHAR(1) NOT NULL DEFAULT 'A',
        CONSTRAINT devolucoes_status_check CHECK (devsta IN ('A', 'X'))
      );

      CREATE TABLE IF NOT EXISTS public.devolucao_itens (
        devicod BIGSERIAL PRIMARY KEY,
        devidevcod BIGINT NOT NULL REFERENCES public.devolucoes(devcod) ON DELETE CASCADE,
        deviprocod INT4 NOT NULL,
        deviprocorid INT4 NULL,
        deviqtde INT4 NOT NULL,
        devivl NUMERIC(14, 4) NOT NULL DEFAULT 0,
        deviprodes VARCHAR(254) NOT NULL,
        devicornome VARCHAR(80) NULL,
        devirepor_estoque BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT devolucao_itens_qtde_check CHECK (deviqtde > 0)
      );

      CREATE INDEX IF NOT EXISTS idx_devolucoes_pedido
        ON public.devolucoes(devpvcod);
      CREATE INDEX IF NOT EXISTS idx_devolucoes_data
        ON public.devolucoes(devdtcad DESC);
      CREATE INDEX IF NOT EXISTS idx_devolucao_itens_busca
        ON public.devolucao_itens(deviprocod, deviprocorid);
      CREATE INDEX IF NOT EXISTS idx_devolucao_itens_devolucao
        ON public.devolucao_itens(devidevcod);
    `);

    //Estrutura para cadastro de clientes:

    await pool.query(`
      -- Extensões úteis (opcional, mas recomendado)
      CREATE EXTENSION IF NOT EXISTS citext;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      -- Tipo para status do parceiro
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'par_status') THEN
          CREATE TYPE par_status AS ENUM ('A','I');
        END IF;
      END$$;

      -- =========================
      -- TABELAS BASE (PAÍS/REGIÃO)
      -- =========================
      CREATE TABLE IF NOT exists public.pais (
        paiscod           INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        paisdes           VARCHAR(40) NOT NULL UNIQUE,
        paispop           NUMERIC(14,4),
        paismoe           VARCHAR(20),
        paiscontcod       INT NOT NULL
      );

      -- Região/Tipo de UF (mínima para atender a FK citada)
      CREATE TABLE IF NOT exists public.tufreg (
        tufregcod INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        tufregdes VARCHAR(40) NOT NULL
      );

      -- ========
      -- TABELA UF
      -- ========
      CREATE TABLE IF NOT exists public.uf (
        ufsigla     VARCHAR(2) PRIMARY KEY,
        ufcodibge   INT NOT NULL,
        ufdes       VARCHAR(40) NOT NULL,
        ufie        VARCHAR(20),
        ufconv      VARCHAR(20),
        ufmen       VARCHAR(500),
        ufpaiscod   INT NOT NULL REFERENCES public.pais(paiscod),
        uftufregcod INT REFERENCES public.tufreg(tufregcod),
        CONSTRAINT ck_uf_sigla_fmt CHECK (ufsigla ~ '^[A-Z]{2}$')
      );

      -- =============
      -- TABELA MUN (Município)
      -- =============
      CREATE TABLE IF NOT exists public.mun (
        muncod       INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        mundes       VARCHAR(40) NOT NULL,
        munufsigla   VARCHAR(2) NOT NULL REFERENCES public.uf(ufsigla),
        muncodibge   INT UNIQUE,
        CONSTRAINT uq_mun_nome_uf UNIQUE (mundes, munufsigla)
      );


      -- ======================
      -- TABELA PAR (Parceiros)
      -- ======================
      CREATE TABLE IF NOT exists public.par (
        parcod      INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        parcnpjcpf  VARCHAR(14) NOT NULL,                 -- somente dígitos (11=CPF, 14=CNPJ)
        parierg     VARCHAR(20),
        pardes      VARCHAR(120) NOT NULL,                -- razão/nome
        parfan      VARCHAR(120),                         -- fantasia
        parrua      VARCHAR(80),
        parbai      VARCHAR(40),
        parmuncod   INT NOT NULL REFERENCES public.mun(muncod),
        parcep      VARCHAR(9),                           -- 99999-999 (aceita com/sem hífen via CHECK)
        parfone     VARCHAR(20),
        paremail    CITEXT,
        pardcad     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- criado_em
        pardua      TIMESTAMPTZ,                          -- atualizado_em
        parsit      par_status NOT NULL DEFAULT 'A',
        CONSTRAINT uq_par_parcnpjcpf UNIQUE (parcnpjcpf),
        CONSTRAINT ck_par_doc_fmt CHECK (parcnpjcpf ~ '^[0-9]{11}$' OR parcnpjcpf ~ '^[0-9]{14}$'),
        CONSTRAINT ck_par_cep_fmt CHECK (parcep IS NULL OR parcep ~ '^[0-9]{5}-?[0-9]{3}$'),
        CONSTRAINT ck_par_email_fmt CHECK (paremail IS NULL OR paremail ~* '^[^@]+@[^@]+\.[^@]+$')
      );

      -- =================
      -- TABELA CLI (Cliente)
      -- =================
      CREATE TABLE IF NOT exists public.cli (
        cliparcod INT PRIMARY KEY REFERENCES public.par(parcod) ON DELETE RESTRICT,
        clibloq   BOOLEAN NOT NULL DEFAULT false,
        clilim    NUMERIC(14,2) NOT NULL DEFAULT 0
      );



      -- =======================================
      -- INSERTS PARA POPULAR AS TABELAS NECESSÁRIAS
      -- =======================================

      -- ====== PAÍS ======
      -- =======================================
      -- INSERTS PARA POPULAR A TABELA PAIS
      -- =======================================

      INSERT INTO public.pais
      (paiscod, paisdes, paispop, paismoe, paiscontcod)
      VALUES (1058, 'BRASIL', 170000000.0000, 'REAL', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais
      (paiscod, paisdes, paispop, paismoe, paiscontcod)
      VALUES (1600, 'CHINA, REPUBLICA POPULAR', 300000000.0000, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais
      (paiscod, paisdes, paispop, paismoe, paiscontcod)
      VALUES (3514, 'HONG KONG', NULL, 'DOLAR HONG KONG', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais
      (paiscod, paisdes, paispop, paismoe, paiscontcod)
      VALUES (2496, 'ESTADOS UNIDOS', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais
      (paiscod, paisdes, paispop, paismoe, paiscontcod)
      VALUES (3867, 'ITALIA', NULL, 'EURO', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (6289, 'ESCOCIA', NULL, 'LIBRA', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (1490, 'CANADA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (7676, 'SUICA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (6033, 'POLONIA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (5380, 'NORUEGA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (698, 'AUSTRALIA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (876, 'BELGICA', NULL, 'DOLAR', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (2453, 'ESPANHA', NULL, 'EURO', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (230, 'ALEMANHA', NULL, 'EURO', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3516, 'INGLATERRA', NULL, 'LBR', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3515, 'ROMENIA', NULL, 'EUR', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3517, 'AUSTRIA', NULL, 'EURO', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3518, 'TURQUIA', NULL, 'LIRA TURCA', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3519, 'HOLANDA', NULL, 'EURO', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3520, 'REINO UNIDO', NULL, 'LIBRA ESTERLINA', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3521, 'REPÚBLICA TCHECA', NULL, 'COROA TCHECA', 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3522, 'TAIWAN', NULL, NULL, 5)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3524, 'ARGENTINA', NULL, NULL, 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3525, 'FRANCA', NULL, NULL, 6)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3832, 'ISRAEL', NULL, 'shekel israelense', 4)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3526, 'JAPAO', NULL, 'IENE', 5)
      ON CONFLICT (paiscod) DO NOTHING;

      INSERT INTO public.pais VALUES (3523, 'PANAMA', NULL, NULL, 3)
      ON CONFLICT (paiscod) DO NOTHING;


      -- ====== TUFREG ======
      INSERT INTO public.tufreg (tufregcod, tufregdes) VALUES (1, 'CENTRO-OESTE')
      ON CONFLICT (tufregcod) DO NOTHING;
      INSERT INTO public.tufreg (tufregcod, tufregdes) VALUES (2, 'NORDESTE')
      ON CONFLICT (tufregcod) DO NOTHING;
      INSERT INTO public.tufreg (tufregcod, tufregdes) VALUES (3, 'NORTE')
      ON CONFLICT (tufregcod) DO NOTHING;
      INSERT INTO public.tufreg (tufregcod, tufregdes) VALUES (4, 'SUDESTE')
      ON CONFLICT (tufregcod) DO NOTHING;
      INSERT INTO public.tufreg (tufregcod, tufregdes) VALUES (5, 'SUL')
      ON CONFLICT (tufregcod) DO NOTHING;

      -- ====== UF ======
      INSERT INTO public.uf VALUES ('RJ', 33, 'RIO DE JANEIRO', '', '', '', 1058, 4)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('PR', 41, 'PARANA', '', '', '', 1058, 5)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('SC', 42, 'SANTA CATARINA', '', '', '', 1058, 5)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('RS', 43, 'RIO GRANDE DO SUL', '', '', '', 1058, 5)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('MS', 50, 'MATO GROSSO DO SUL', '', '', '', 1058, 1)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('MT', 51, 'MATO GROSSO', '', '', '', 1058, 1)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('AP', 16, 'AMAPA', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('RO', 11, 'RONDONIA', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('RR', 14, 'RORAIMA', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('PA', 14, 'PARA', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('TO', 17, 'TOCANTINS', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('MA', 21, 'MARANHAO', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('PI', 22, 'PIAUI', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('RN', 24, 'RIO GRANDE DO NORTE', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('MG', 31, 'MINAS GERAIS', '', '', '', 1058, 4)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('CE', 23, 'CEARA', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('PB', 25, 'PARAIBA', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('PE', 26, 'PERNAMBUCO', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('SP', 35, 'SAO PAULO', '', '', '', 1058, 4)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('SE', 28, 'SERGIPE', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('ES', 32, 'ESPIRITO SANTO', '', '', '', 1058, 4)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('AM', 13, 'AMAZONAS', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('GO', 52, 'GOIAS', '', '', '', 1058, 1)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('BA', 29, 'BAHIA', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('AC', 12, 'ACRE', '', '', '', 1058, 3)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('AL', 27, 'ALAGOAS', '', '', '', 1058, 2)
      ON CONFLICT (ufsigla) DO NOTHING;
      INSERT INTO public.uf VALUES ('DF', 53, 'DISTRITO FEDERAL', '', '', '', 1058, 1)
      ON CONFLICT (ufsigla) DO NOTHING;


    `);

    // Baixa o estoque somente quando o pedido passa de pendente para confirmado.
    // O vínculo atual de grupos é part_group_items -> procor. O campo legado
    // pro.part_group_id não deve ser usado para decidir o estoque compartilhado.
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.atualizar_saldo()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        DECLARE
          r RECORD;
          v_available NUMERIC;
          v_group_name TEXT;
          v_new_stock INTEGER;
        BEGIN
          IF OLD.pvconfirmado = 'N' AND NEW.pvconfirmado = 'S' THEN
            IF EXISTS (
              SELECT 1
              FROM pvi i
              WHERE i.pvipvcod = NEW.pvcod
                AND (
                  COALESCE(i.pviqtde, 0) < 0
                  OR COALESCE(i.pviqtde, 0) <> TRUNC(COALESCE(i.pviqtde, 0))
                )
            ) THEN
              RAISE EXCEPTION 'Quantidade inválida no pedido %. Use apenas quantidades inteiras e não negativas.', NEW.pvcod;
            END IF;

            -- Uma cor informada no pedido precisa existir para aquela peça.
            IF EXISTS (
              SELECT 1
              FROM pvi i
              WHERE i.pvipvcod = NEW.pvcod
                AND i.pviprocorid IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM procor pc
                  WHERE pc.procorprocod = i.pviprocod
                    AND pc.procorcorescod = i.pviprocorid
                )
            ) THEN
              RAISE EXCEPTION 'Variação de cor inválida em um dos itens do pedido %.', NEW.pvcod;
            END IF;

            -- Grupos: soma todos os itens que consomem o mesmo estoque compartilhado,
            -- bloqueia o grupo, valida e baixa uma única vez.
            FOR r IN
              SELECT pgi.group_id, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              JOIN LATERAL (
                SELECT pc_resolvida.procorid
                FROM procor pc_resolvida
                WHERE pc_resolvida.procorprocod = i.pviprocod
                  AND (
                    pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
                    OR (i.pviprocorid IS NULL AND pc_resolvida.procorcorescod = 0)
                  )
                ORDER BY
                  CASE WHEN pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
                    THEN 0 ELSE 1 END,
                  pc_resolvida.procorid
                LIMIT 1
              ) sold_pc ON TRUE
              JOIN part_group_items pgi ON pgi.procorid = sold_pc.procorid
              WHERE i.pvipvcod = NEW.pvcod
                AND COALESCE(i.pviqtde, 0) > 0
              GROUP BY pgi.group_id
              ORDER BY pgi.group_id
            LOOP
              SELECT pg.stock_quantity, pg.name
                INTO v_available, v_group_name
              FROM part_groups pg
              WHERE pg.id = r.group_id
              FOR UPDATE;

              IF NOT FOUND THEN
                RAISE EXCEPTION 'Grupo de estoque % não encontrado.', r.group_id;
              END IF;

              IF v_available < r.total_qty THEN
                RAISE EXCEPTION 'Estoque insuficiente no grupo "%". Disponível: %, Solicitado: %',
                  v_group_name, v_available, r.total_qty;
              END IF;

              v_new_stock := v_available::INTEGER - r.total_qty::INTEGER;

              UPDATE part_groups
              SET stock_quantity = v_new_stock, updated_at = NOW()
              WHERE id = r.group_id;

              -- Todas as variações do grupo refletem exatamente o saldo compartilhado.
              UPDATE procor pc
              SET procorqtde = v_new_stock
              FROM part_group_items pgi
              WHERE pgi.group_id = r.group_id
                AND pgi.procorid = pc.procorid;

              -- Peças sem cor são exibidas pelo saldo de pro.proqtde no catálogo.
              UPDATE pro pr
              SET proqtde = v_new_stock
              WHERE EXISTS (
                SELECT 1
                FROM part_group_items pgi
                JOIN procor pc ON pc.procorid = pgi.procorid
                WHERE pgi.group_id = r.group_id
                  AND pc.procorprocod = pr.procod
                  AND COALESCE(pc.procorcorescod, 0) = 0
              );

              INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
              VALUES (r.group_id, -r.total_qty::INTEGER, 'Venda', NEW.pvcod::TEXT);
            END LOOP;

            -- Variações com cor que não pertencem a grupo usam procor.procorqtde.
            FOR r IN
              SELECT pc.procorid, p.prodes, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              JOIN pro p ON p.procod = i.pviprocod
              JOIN procor pc
                ON pc.procorprocod = i.pviprocod
               AND pc.procorcorescod = i.pviprocorid
              WHERE i.pvipvcod = NEW.pvcod
                AND i.pviprocorid IS NOT NULL
                AND COALESCE(i.pviqtde, 0) > 0
                AND NOT EXISTS (
                  SELECT 1 FROM part_group_items pgi WHERE pgi.procorid = pc.procorid
                )
              GROUP BY pc.procorid, p.prodes
              ORDER BY pc.procorid
            LOOP
              SELECT COALESCE(pc.procorqtde, 0)
                INTO v_available
              FROM procor pc
              WHERE pc.procorid = r.procorid
              FOR UPDATE;

              IF v_available < r.total_qty THEN
                RAISE EXCEPTION 'Estoque insuficiente para a peça "%". Disponível: %, Solicitado: %',
                  r.prodes, v_available, r.total_qty;
              END IF;

              UPDATE procor
              SET procorqtde = procorqtde - r.total_qty
              WHERE procorid = r.procorid;
            END LOOP;

            -- Peças sem cor e sem grupo usam pro.proqtde.
            FOR r IN
              SELECT p.procod, p.prodes, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              JOIN pro p ON p.procod = i.pviprocod
              WHERE i.pvipvcod = NEW.pvcod
                AND i.pviprocorid IS NULL
                AND COALESCE(i.pviqtde, 0) > 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM procor pc
                  JOIN part_group_items pgi ON pgi.procorid = pc.procorid
                  WHERE pc.procorprocod = i.pviprocod
                    AND COALESCE(pc.procorcorescod, 0) = 0
                )
              GROUP BY p.procod, p.prodes
              ORDER BY p.procod
            LOOP
              SELECT COALESCE(p.proqtde, 0)
                INTO v_available
              FROM pro p
              WHERE p.procod = r.procod
              FOR UPDATE;

              IF v_available < r.total_qty THEN
                RAISE EXCEPTION 'Estoque insuficiente para a peça "%". Disponível: %, Solicitado: %',
                  r.prodes, v_available, r.total_qty;
              END IF;

              UPDATE pro
              SET proqtde = proqtde - r.total_qty
              WHERE procod = r.procod;
            END LOOP;
          END IF;

          RETURN NEW;
        END;
        $function$;
  
    `);

    // Devolve o estoque usando a mesma resolução peça/cor/grupo da aprovação.
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.retornar_saldo()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        DECLARE
          r RECORD;
          v_new_stock INTEGER;
        BEGIN
          IF OLD.pvsta <> 'X' AND NEW.pvsta = 'X' AND NEW.pvconfirmado = 'S' THEN
            FOR r IN
              SELECT pgi.group_id, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              JOIN LATERAL (
                SELECT pc_resolvida.procorid
                FROM procor pc_resolvida
                WHERE pc_resolvida.procorprocod = i.pviprocod
                  AND (
                    pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
                    OR (i.pviprocorid IS NULL AND pc_resolvida.procorcorescod = 0)
                  )
                ORDER BY
                  CASE WHEN pc_resolvida.procorcorescod IS NOT DISTINCT FROM i.pviprocorid
                    THEN 0 ELSE 1 END,
                  pc_resolvida.procorid
                LIMIT 1
              ) sold_pc ON TRUE
              JOIN part_group_items pgi ON pgi.procorid = sold_pc.procorid
              WHERE i.pvipvcod = NEW.pvcod
                AND COALESCE(i.pviqtde, 0) > 0
              GROUP BY pgi.group_id
              ORDER BY pgi.group_id
            LOOP
              SELECT pg.stock_quantity + r.total_qty::INTEGER
                INTO v_new_stock
              FROM part_groups pg
              WHERE pg.id = r.group_id
              FOR UPDATE;

              UPDATE part_groups
              SET stock_quantity = v_new_stock, updated_at = NOW()
              WHERE id = r.group_id;

              UPDATE procor pc
              SET procorqtde = v_new_stock
              FROM part_group_items pgi
              WHERE pgi.group_id = r.group_id
                AND pgi.procorid = pc.procorid;

              UPDATE pro pr
              SET proqtde = v_new_stock
              WHERE EXISTS (
                SELECT 1
                FROM part_group_items pgi
                JOIN procor pc ON pc.procorid = pgi.procorid
                WHERE pgi.group_id = r.group_id
                  AND pc.procorprocod = pr.procod
                  AND COALESCE(pc.procorcorescod, 0) = 0
              );

              INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
              VALUES (r.group_id, r.total_qty::INTEGER, 'Cancelado', NEW.pvcod::TEXT);
            END LOOP;

            UPDATE procor pc
            SET procorqtde = COALESCE(pc.procorqtde, 0) + sold.total_qty
            FROM (
              SELECT pc2.procorid, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              JOIN procor pc2
                ON pc2.procorprocod = i.pviprocod
               AND pc2.procorcorescod = i.pviprocorid
              WHERE i.pvipvcod = NEW.pvcod
                AND i.pviprocorid IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM part_group_items pgi WHERE pgi.procorid = pc2.procorid
                )
              GROUP BY pc2.procorid
            ) sold
            WHERE pc.procorid = sold.procorid;

            UPDATE pro pr
            SET proqtde = COALESCE(pr.proqtde, 0) + sold.total_qty
            FROM (
              SELECT i.pviprocod, SUM(COALESCE(i.pviqtde, 0)) AS total_qty
              FROM pvi i
              WHERE i.pvipvcod = NEW.pvcod
                AND i.pviprocorid IS NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM procor pc
                  JOIN part_group_items pgi ON pgi.procorid = pc.procorid
                  WHERE pc.procorprocod = i.pviprocod
                    AND COALESCE(pc.procorcorescod, 0) = 0
                )
              GROUP BY i.pviprocod
            ) sold
            WHERE pr.procod = sold.pviprocod;
          END IF;

          RETURN NEW;
        END;
        $function$;
 
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION fn_marcar_prosemest()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM procor
              WHERE procorprocod = NEW.procod
          ) THEN
              IF NEW.proqtde = 0 THEN
                  NEW.prosemest := 'S';
              ELSE
                  NEW.prosemest := 'N';
              END IF;
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION fn_marcar_procorsemest()
      RETURNS TRIGGER AS $$
      BEGIN
          IF NEW.procorqtde = 0 THEN
              NEW.procorsemest := 'S';
          ELSE
              NEW.procorsemest := 'N';
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

    `);

    // Qualquer alteracao no saldo principal do grupo e propagada para os seus
    // membros. Assim, part_groups.stock_quantity permanece a fonte da verdade
    // mesmo quando o grupo for atualizado por uma nova tela ou integracao.
    await pool.query(`
      CREATE OR REPLACE FUNCTION fn_sincronizar_estoque_grupo()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE procor pc
        SET procorqtde = NEW.stock_quantity
        FROM part_group_items pgi
        WHERE pgi.group_id = NEW.id
          AND pgi.procorid = pc.procorid;

        UPDATE pro pr
        SET proqtde = NEW.stock_quantity
        WHERE EXISTS (
          SELECT 1
          FROM part_group_items pgi
          JOIN procor pc ON pc.procorid = pgi.procorid
          WHERE pgi.group_id = NEW.id
            AND pc.procorprocod = pr.procod
            AND COALESCE(pc.procorcorescod, 0) = 0
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Mantem o indicador geral da peca coerente com as variacoes. Para uma
    // variacao agrupada, a disponibilidade vem diretamente do estoque do grupo.
    await pool.query(`
      CREATE OR REPLACE FUNCTION fn_sincronizar_prosemest_por_cor()
      RETURNS TRIGGER AS $$
      DECLARE
        v_procod INTEGER;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          v_procod := OLD.procorprocod;
        ELSE
          v_procod := NEW.procorprocod;
        END IF;

        UPDATE pro pr
        SET prosemest = CASE WHEN EXISTS (
          SELECT 1
          FROM procor pc
          WHERE pc.procorprocod = v_procod
            AND (
              EXISTS (
                SELECT 1
                FROM part_group_items pgi
                JOIN part_groups pg ON pg.id = pgi.group_id
                WHERE pgi.procorid = pc.procorid
                  AND COALESCE(pg.stock_quantity, 0) > 0
              )
              OR (
                NOT EXISTS (
                  SELECT 1 FROM part_group_items pgi
                  WHERE pgi.procorid = pc.procorid
                )
                AND COALESCE(TRIM(pc.procorsemest), 'N') <> 'S'
              )
            )
        ) THEN 'N' ELSE 'S' END
        WHERE pr.procod = v_procod;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);


    // FIM INSERTS CONDICIONAIS

    //inicio das triggers
    // Trigger for stock decrement on order confirmation
    // The trigger fires AFTER UPDATE OF pvconfirmado and the condition ensures
    // it only runs when transitioning from 'N' to 'S' (idempotent)
    await pool.query(`
      DROP TRIGGER IF EXISTS t_atualizar_saldo ON pv;
      CREATE TRIGGER t_atualizar_saldo
      AFTER UPDATE OF pvconfirmado
      ON public.pv
      FOR EACH ROW
      WHEN (OLD.pvconfirmado = 'N' AND NEW.pvconfirmado = 'S')
      execute procedure atualizar_saldo()
    `);

    // Trigger for stock return on order cancellation
    // The trigger fires AFTER UPDATE OF pvsta and the condition ensures
    // it only runs when transitioning to 'X' from a non-cancelled state (idempotent)
    await pool.query(`
      DROP TRIGGER IF EXISTS t_retornar_saldo ON public.pv;
      CREATE TRIGGER t_retornar_saldo
      AFTER UPDATE OF pvsta
      ON public.pv
      FOR EACH ROW
      WHEN (OLD.pvsta <> 'X' AND NEW.pvsta = 'X')
      execute procedure retornar_saldo()
    `);
    await pool.query(`
        DROP TRIGGER IF EXISTS trg_marcar_prosemest ON pro;
        CREATE TRIGGER trg_marcar_prosemest
        BEFORE UPDATE OF proqtde ON pro
        FOR EACH ROW
        EXECUTE PROCEDURE fn_marcar_prosemest();

        

        DROP TRIGGER IF EXISTS trg_marcar_procorsemest ON procor;
        CREATE TRIGGER trg_marcar_procorsemest
        BEFORE UPDATE OF procorqtde ON procor
        FOR EACH ROW
        EXECUTE PROCEDURE fn_marcar_procorsemest();

        DROP TRIGGER IF EXISTS trg_sincronizar_estoque_grupo ON part_groups;
        CREATE TRIGGER trg_sincronizar_estoque_grupo
        AFTER UPDATE OF stock_quantity ON part_groups
        FOR EACH ROW
        WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
        EXECUTE PROCEDURE fn_sincronizar_estoque_grupo();

        DROP TRIGGER IF EXISTS trg_sincronizar_prosemest_por_cor ON procor;
        CREATE TRIGGER trg_sincronizar_prosemest_por_cor
        AFTER INSERT OR DELETE OR UPDATE OF procorqtde, procorsemest ON procor
        FOR EACH ROW
        EXECUTE PROCEDURE fn_sincronizar_prosemest_por_cor();

        
    `);

    // Reconcilia cadastros anteriores usando o grupo como fonte da verdade.
    // Depois desta migracao, toda alteracao de stock_quantity sera propagada
    // automaticamente pelo trigger trg_sincronizar_estoque_grupo.
    await pool.query(`
      UPDATE procor pc
      SET procorqtde = pg.stock_quantity
      FROM part_group_items pgi
      JOIN part_groups pg ON pg.id = pgi.group_id
      WHERE pgi.procorid = pc.procorid
        AND pc.procorqtde IS DISTINCT FROM pg.stock_quantity;

      UPDATE pro pr
      SET proqtde = pg.stock_quantity
      FROM part_group_items pgi
      JOIN procor pc ON pc.procorid = pgi.procorid
      JOIN part_groups pg ON pg.id = pgi.group_id
      WHERE pc.procorprocod = pr.procod
        AND COALESCE(pc.procorcorescod, 0) = 0
        AND pr.proqtde IS DISTINCT FROM pg.stock_quantity;
    `);

    // Corrige os indicadores atuais. Isso faz grupos que ja estao zerados
    // aparecerem imediatamente como indisponiveis.
    await pool.query(`
      UPDATE pro pr
      SET prosemest = CASE WHEN EXISTS (
        SELECT 1
        FROM procor pc
        WHERE pc.procorprocod = pr.procod
          AND (
            EXISTS (
              SELECT 1
              FROM part_group_items pgi
              JOIN part_groups pg ON pg.id = pgi.group_id
              WHERE pgi.procorid = pc.procorid
                AND COALESCE(pg.stock_quantity, 0) > 0
            )
            OR (
              NOT EXISTS (
                SELECT 1 FROM part_group_items pgi
                WHERE pgi.procorid = pc.procorid
              )
              AND COALESCE(TRIM(pc.procorsemest), 'N') <> 'S'
            )
          )
      ) THEN 'N' ELSE 'S' END
      WHERE EXISTS (
        SELECT 1 FROM procor pc_existente
        WHERE pc_existente.procorprocod = pr.procod
      );
    `);

    // pvivl e o preco unitario; mantem o total persistido coerente com as
    // quantidades atuais, inclusive para pedidos editados antes desta correcao.
    await pool.query(`
      UPDATE pv pedido
      SET pvvl = totais.total
      FROM (
        SELECT pv_base.pvcod,
               COALESCE(SUM(COALESCE(i.pviqtde, 0) * COALESCE(i.pvivl, 0)), 0) AS total
        FROM pv pv_base
        LEFT JOIN pvi i ON i.pvipvcod = pv_base.pvcod
        GROUP BY pv_base.pvcod
      ) totais
      WHERE pedido.pvcod = totais.pvcod
        AND pedido.pvvl IS DISTINCT FROM totais.total;
    `);
    //fim das triggers

    //inicio das sequences

    await pool.query(`CREATE SEQUENCE IF NOT EXISTS public.pv_seq
                      INCREMENT BY 1
                      MINVALUE 1
                      MAXVALUE 9223372036854775807
                      START 1
                      CACHE 1
                      NO CYCLE;`);
    //fim das sequences

    // ==================================================================================================================================
    // ÍNDICES DE PERFORMANCE — criados com IF NOT EXISTS para ser idempotente
    // ==================================================================================================================================

    // pv: filtros de status, confirmação, data e vendedor (usados em todas as listagens de pedidos)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_sta          ON public.pv (pvsta);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_confirmado   ON public.pv (pvconfirmado);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_dtcad        ON public.pv (pvdtcad);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_rcacod       ON public.pv (pvrcacod);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pv_canal        ON public.pv (pvcanal);`);

    // pvi: join com pv e com pro (chaves de join mais usadas)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pvi_pvcod       ON public.pvi (pvipvcod);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pvi_procod      ON public.pvi (pviprocod);`);

    // pro: filtros de marca, tipo, status e estoque (usados em listagens de produtos)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pro_marcas      ON public.pro (promarcascod);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pro_tipo        ON public.pro (protipocod);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pro_sit         ON public.pro (prosit);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pro_semest      ON public.pro (prosemest);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pro_acabando    ON public.pro (proacabando);`);

    // promod: join de peças com modelos (correlated subquery em proModels e proController)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_promod_procod   ON public.promod (promodprocod);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_promod_modcod   ON public.promod (promodmodcod);`);

    // par: busca textual por nome/fantasia via ILIKE — índices GIN trigram para acelerar
    // Requer a extensão pg_trgm que já foi habilitada acima (CREATE EXTENSION IF NOT EXISTS pg_trgm)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_par_des_trgm
      ON public.par USING gin (pardes gin_trgm_ops);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_par_fan_trgm
      ON public.par USING gin (parfan gin_trgm_ops);
    `);

    // ==================================================================================================================================
    // FIM ÍNDICES DE PERFORMANCE
    // ==================================================================================================================================

    // ==================================================================================================================================
    // CORREÇÃO: permitir procorcorescod NULL em procor (peças sem cor)
    // A PK original (procorprocod, procorcorescod) exigia ambas NOT NULL, impedindo
    // adicionar uma peça sem variação de cor ao grupo de compatibilidade.
    // Solução: trocar PK para procorid (serial, já único) e relaxar a constraint.
    // ==================================================================================================================================

    // 1. Dropa a PK antiga somente se ainda for a composta (procorprocod, procorcorescod)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_name = tc.table_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = 'procor'
            AND kcu.column_name = 'procorcorescod'
        ) THEN
          ALTER TABLE public.procor DROP CONSTRAINT IF EXISTS pk_procor;
        END IF;
      END$$;
    `);

    // 2. Torna procorcorescod nullable (para peças sem cor)
    await pool.query(`
      ALTER TABLE public.procor ALTER COLUMN procorcorescod DROP NOT NULL;
    `);

    // 3. Adiciona PK em procorid (serial, já único por definição)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_type = 'PRIMARY KEY'
            AND table_name = 'procor'
        ) THEN
          ALTER TABLE public.procor ADD CONSTRAINT pk_procor_id PRIMARY KEY (procorid);
        END IF;
      END$$;
    `);

    // 4. Unique index para pares (produto, cor) onde cor NÃO é nula (comportamento original)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_procor_procod_corcod
      ON public.procor(procorprocod, procorcorescod)
      WHERE procorcorescod IS NOT NULL;
    `);

    // 5. Unique partial index: garante no máximo um registro "sem cor" por produto
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_procor_procod_sem_cor
      ON public.procor(procorprocod)
      WHERE procorcorescod IS NULL;
    `);

    // ==================================================================================================================================
    // FIM CORREÇÃO procorcorescod NULL
    // ==================================================================================================================================

    // ==================================================================================================================================
    // CLIENTES: VÍNCULO COM PEDIDOS, CONTA, MOVIMENTAÇÕES E COBRANÇAS
    // Simplificação do cadastro: cidade/UF passa a ser opcional e o telefone
    // é armazenado normalizado (somente dígitos) para uso no WhatsApp.
    // ==================================================================================================================================

    // Cidade/UF deixa de ser obrigatória no cadastro do cliente.
    await pool.query(
      `ALTER TABLE public.par ALTER COLUMN parmuncod DROP NOT NULL;`
    );

    // Normaliza telefone legado para somente dígitos (padrão novo).
    await pool.query(`
      UPDATE public.par
      SET parfone = regexp_replace(parfone, '\\D', '', 'g')
      WHERE parfone IS NOT NULL
        AND parfone <> regexp_replace(parfone, '\\D', '', 'g');
    `);

    // Normaliza CEP legado para somente dígitos (padrão novo).
    await pool.query(`
      UPDATE public.par
      SET parcep = regexp_replace(parcep, '\\D', '', 'g')
      WHERE parcep IS NOT NULL
        AND char_length(regexp_replace(parcep, '\\D', '', 'g')) = 8
        AND parcep <> regexp_replace(parcep, '\\D', '', 'g');
    `);

    // Vínculo manual pedido -> cliente. Pedidos continuam podendo existir sem
    // cliente; a associação é feita na tela de clientes.
    await pool.query(
      `ALTER TABLE public.pv ADD COLUMN IF NOT EXISTS pvparcod INT4 NULL;`
    );
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'pv_pvparcod_fkey'
            AND table_name = 'pv'
        ) THEN
          ALTER TABLE public.pv
            ADD CONSTRAINT pv_pvparcod_fkey
            FOREIGN KEY (pvparcod) REFERENCES public.par(parcod)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_pv_parcod ON public.pv (pvparcod);`
    );

    // Conta corrente do cliente: saldo mantido em sincronia com o histórico de
    // movimentações (nunca sobrescrito isoladamente).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cli_conta (
        cliparcod  INT PRIMARY KEY REFERENCES public.cli(cliparcod) ON DELETE CASCADE,
        contasaldo NUMERIC(14,2) NOT NULL DEFAULT 0,
        contadtua  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      INSERT INTO public.cli_conta (cliparcod, contasaldo)
      SELECT cliparcod, 0 FROM public.cli
      ON CONFLICT (cliparcod) DO NOTHING;
    `);

    // Histórico de movimentações (ledger) — rastreabilidade do saldo.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cli_mov (
        movcod    BIGSERIAL PRIMARY KEY,
        movparcod INT NOT NULL REFERENCES public.par(parcod) ON DELETE RESTRICT,
        movtipo   VARCHAR(20) NOT NULL,
        movvalor  NUMERIC(14,2) NOT NULL,
        movsaldo  NUMERIC(14,2) NOT NULL,
        movdesc   VARCHAR(254) NULL,
        movref    VARCHAR(60) NULL,
        movusucod INT NULL,
        movdtcad  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ck_cli_mov_tipo CHECK (
          movtipo IN ('CREDITO','DEBITO','PAGAMENTO','ESTORNO','AJUSTE','COBRANCA')
        )
      );

      CREATE INDEX IF NOT EXISTS idx_cli_mov_parcod
        ON public.cli_mov (movparcod, movdtcad DESC);
    `);

    // Cobranças vinculadas (opcionalmente) a um pedido, com baixa/pagamento.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cli_cobranca (
        cobcod    BIGSERIAL PRIMARY KEY,
        cobparcod INT NOT NULL REFERENCES public.par(parcod) ON DELETE RESTRICT,
        cobpvcod  INT NULL REFERENCES public.pv(pvcod) ON DELETE SET NULL,
        cobvalor  NUMERIC(14,2) NOT NULL,
        cobvenc   DATE NULL,
        cobsta    CHAR(1) NOT NULL DEFAULT 'A',
        cobobs    VARCHAR(254) NULL,
        cobdtcad  TIMESTAMPTZ NOT NULL DEFAULT now(),
        cobdtpg   TIMESTAMPTZ NULL,
        cobusucod INT NULL,
        CONSTRAINT ck_cli_cobranca_sta CHECK (cobsta IN ('A','P','C'))
      );

      CREATE INDEX IF NOT EXISTS idx_cli_cobranca_parcod
        ON public.cli_cobranca (cobparcod, cobsta);
      CREATE INDEX IF NOT EXISTS idx_cli_cobranca_pvcod
        ON public.cli_cobranca (cobpvcod);
    `);

    // Reconcilia o saldo da conta com o extrato de crédito, ignorando os
    // lançamentos gerados por cobranças (ref "COB:*"). Isso corrige dados
    // antigos em que a cobrança compensava o crédito automaticamente.
    await pool.query(`
      UPDATE public.cli_conta c
      SET contasaldo = COALESCE((
        SELECT SUM(m.movvalor)
        FROM public.cli_mov m
        WHERE m.movparcod = c.cliparcod
          AND COALESCE(m.movref, '') NOT LIKE 'COB:%'
      ), 0);
    `);

    // ==================================================================================================================================
    // FIM CLIENTES: CONTA, MOVIMENTAÇÕES E COBRANÇAS
    // ==================================================================================================================================

    // ==================================================================================================================================
    // PERMISSÕES POR TELA
    // Cada tela controlável é registrada na tabela "telas". O vínculo com o
    // usuário fica em "usu_telas" (a presença da linha com permitido='S'
    // significa acesso liberado; a ausência significa negado).
    // ==================================================================================================================================

    // Detecta se é a primeira carga para popular as permissões dos usuários
    // existentes sem sobrescrever escolhas feitas pelo administrador depois.
    const telasPreExiste = await pool.query(
      `SELECT to_regclass('public.telas') AS reg;`
    );
    const primeiraCargaTelas = !telasPreExiste.rows[0].reg;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.telas (
        telacod    SERIAL PRIMARY KEY,
        telachave  VARCHAR(50) NOT NULL UNIQUE,
        telanome   VARCHAR(100) NOT NULL,
        telarota   VARCHAR(100),
        telaicone  VARCHAR(60),
        telagrupo  VARCHAR(60),
        telaordem  INT NOT NULL DEFAULT 0,
        telaativa  BPCHAR(1) NOT NULL DEFAULT 'S'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.usu_telas (
        usutelausucod     INT NOT NULL,
        usutelatelacod    INT NOT NULL REFERENCES public.telas(telacod) ON DELETE CASCADE,
        usutelapermitido  BPCHAR(1) NOT NULL DEFAULT 'N',
        CONSTRAINT usu_telas_pkey PRIMARY KEY (usutelausucod, usutelatelacod),
        CONSTRAINT usu_telas_usucod_fkey FOREIGN KEY (usutelausucod)
          REFERENCES public.usu(usucod) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_usu_telas_usucod
        ON public.usu_telas(usutelausucod);
    `);

    // Marca migrações que devem rodar apenas uma vez (evita reaplicar
    // backfills e sobrescrever escolhas feitas pelo administrador).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.app_migrations (
        migracao     VARCHAR(80) PRIMARY KEY,
        aplicada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Sincroniza o catálogo de telas com o registro em código.
    for (const tela of TELAS) {
      await pool.query(
        `INSERT INTO public.telas
           (telachave, telanome, telarota, telaicone, telagrupo, telaordem, telaativa)
         VALUES ($1, $2, $3, $4, $5, $6, 'S')
         ON CONFLICT (telachave) DO UPDATE SET
           telanome  = EXCLUDED.telanome,
           telarota  = EXCLUDED.telarota,
           telaicone = EXCLUDED.telaicone,
           telagrupo = EXCLUDED.telagrupo,
           telaordem = EXCLUDED.telaordem;`,
        [
          tela.chave,
          tela.nome,
          tela.rota,
          tela.icone,
          tela.grupo,
          tela.ordem,
        ]
      );
    }

    // Na primeira carga preserva o acesso atual: libera as novas telas para os
    // usuários existentes, exceto "grupos" (restrita a admins) e as telas que
    // já tinham controle próprio (pedidos/estoque), migradas logo abaixo.
    if (primeiraCargaTelas) {
      await pool.query(`
        INSERT INTO public.usu_telas
          (usutelausucod, usutelatelacod, usutelapermitido)
        SELECT u.usucod, t.telacod, 'S'
        FROM public.usu u
        CROSS JOIN public.telas t
        WHERE t.telachave NOT IN ('grupos', 'pedidos', 'estoque')
        ON CONFLICT (usutelausucod, usutelatelacod) DO NOTHING;

        INSERT INTO public.usu_telas
          (usutelausucod, usutelatelacod, usutelapermitido)
        SELECT u.usucod, t.telacod, 'S'
        FROM public.usu u
        CROSS JOIN public.telas t
        WHERE t.telachave = 'grupos' AND u.usuadm = 'S'
        ON CONFLICT (usutelausucod, usutelatelacod) DO NOTHING;
      `);
    }

    // Migra as permissões legadas de tela (usu.usupv -> Pedidos,
    // usu.usuest -> Estoque) para o modelo novo. Roda uma única vez para não
    // recriar permissões que o administrador tenha revogado.
    const migracaoLegado = await pool.query(
      `SELECT 1 FROM public.app_migrations WHERE migracao = $1`,
      ["telas_pedidos_estoque_v1"]
    );
    if (migracaoLegado.rowCount === 0) {
      await pool.query(`
        INSERT INTO public.usu_telas
          (usutelausucod, usutelatelacod, usutelapermitido)
        SELECT u.usucod, t.telacod, 'S'
        FROM public.usu u
        JOIN public.telas t ON t.telachave = 'pedidos'
        WHERE u.usupv = 'S'
        ON CONFLICT (usutelausucod, usutelatelacod) DO NOTHING;

        INSERT INTO public.usu_telas
          (usutelausucod, usutelatelacod, usutelapermitido)
        SELECT u.usucod, t.telacod, 'S'
        FROM public.usu u
        JOIN public.telas t ON t.telachave = 'estoque'
        WHERE u.usuest = 'S'
        ON CONFLICT (usutelausucod, usutelatelacod) DO NOTHING;

        INSERT INTO public.app_migrations (migracao)
        VALUES ('telas_pedidos_estoque_v1')
        ON CONFLICT (migracao) DO NOTHING;
      `);
    }

    // Mantém as colunas legadas usupv/usuest coerentes com as telas liberadas.
    // Assim qualquer código/middleware antigo que ainda leia essas colunas
    // continua funcionando, sem precisar de re-login.
    await pool.query(`
      UPDATE public.usu u
      SET usupv = d.ped, usuest = d.est
      FROM (
        SELECT u2.usucod,
          CASE WHEN EXISTS (
            SELECT 1 FROM public.usu_telas ut
            JOIN public.telas t ON t.telacod = ut.usutelatelacod
            WHERE ut.usutelausucod = u2.usucod
              AND ut.usutelapermitido = 'S'
              AND t.telachave = 'pedidos'
          ) THEN 'S' ELSE 'N' END AS ped,
          CASE WHEN EXISTS (
            SELECT 1 FROM public.usu_telas ut
            JOIN public.telas t ON t.telacod = ut.usutelatelacod
            WHERE ut.usutelausucod = u2.usucod
              AND ut.usutelapermitido = 'S'
              AND t.telachave = 'estoque'
          ) THEN 'S' ELSE 'N' END AS est
        FROM public.usu u2
      ) d
      WHERE u.usucod = d.usucod
        AND (u.usupv IS DISTINCT FROM d.ped OR u.usuest IS DISTINCT FROM d.est);
    `);

    // ==================================================================================================================================
    // FIM PERMISSÕES POR TELA
    // ==================================================================================================================================

    await pool.query("COMMIT");
    console.log("✅ atualizardb: tabelas e registros padrão garantidos.");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ atualizardb: erro:", err);
    throw err;
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}

module.exports = { atualizarDB };
