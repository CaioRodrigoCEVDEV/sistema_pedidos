const pool = require("./db");

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
      //temporatrio 

      await pool.query(
      `update usu set usuviuversao = 'N';`
    );

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
    // PART GROUPS - Compatibility groups for shared inventory
    // ==================================================================================================================================

    // Enable uuid-ossp extension for UUID generation
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create part_groups table for compatibility groups
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.part_groups (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add part_group_id foreign key to pro table
    await pool.query(`
      ALTER TABLE public.pro ADD IF NOT EXISTS part_group_id UUID NULL;
    `);

    // Add foreign key constraint if it doesn't exist
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

    // Create part_group_audit table for stock change tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.part_group_audit (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        part_group_id UUID NOT NULL REFERENCES public.part_groups(id) ON DELETE CASCADE,
        change INTEGER NOT NULL,
        reason TEXT,
        reference_id TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create index on part_group_audit for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_part_group_audit_group_id 
      ON public.part_group_audit(part_group_id);
    `);

    // Create index on pro.part_group_id for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pro_part_group_id 
      ON public.pro(part_group_id);
    `);

    // Migration: Create individual part_groups for existing parts that don't have a group
    // This preserves existing behavior - each part gets its own group with its current stock
    await pool.query(`
      INSERT INTO public.part_groups (id, name, stock_quantity, created_at, updated_at)
      SELECT 
        uuid_generate_v4(),
        COALESCE(prodes, 'Part ' || procod::text),
        COALESCE(proqtde, 0),
        COALESCE(prodtcad, NOW()),
        NOW()
      FROM public.pro
      WHERE part_group_id IS NULL
      ON CONFLICT DO NOTHING;
    `);

    // Update parts to reference their newly created groups
    await pool.query(`
      UPDATE public.pro p
      SET part_group_id = pg.id
      FROM public.part_groups pg
      WHERE p.part_group_id IS NULL
        AND pg.name = COALESCE(p.prodes, 'Part ' || p.procod::text)
        AND pg.stock_quantity = COALESCE(p.proqtde, 0);
    `);

    // For any remaining parts without groups (edge cases), create groups individually
    await pool.query(`
      DO $$
      DECLARE
        r RECORD;
        new_group_id UUID;
      BEGIN
        FOR r IN SELECT procod, prodes, proqtde, prodtcad FROM public.pro WHERE part_group_id IS NULL
        LOOP
          INSERT INTO public.part_groups (name, stock_quantity, created_at, updated_at)
          VALUES (
            COALESCE(r.prodes, 'Part ' || r.procod::text),
            COALESCE(r.proqtde, 0),
            COALESCE(r.prodtcad, NOW()),
            NOW()
          )
          RETURNING id INTO new_group_id;
          
          UPDATE public.pro SET part_group_id = new_group_id WHERE procod = r.procod;
        END LOOP;
      END$$;
    `);

    // ==================================================================================================================================
    // END PART GROUPS
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

    // função de trigger para atualizar saldo no estoque
    // Updated to support part_groups (compatibility groups)
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.atualizar_saldo()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        DECLARE
          r RECORD;
        BEGIN
          IF NEW.pvconfirmado = 'S' THEN

            -- 1) Itens COM cor -> baixa em procor
            UPDATE procor pc
              SET procorqtde = COALESCE(pc.procorqtde, 0) - COALESCE(i.pviqtde, 0)
              FROM pvi i
            WHERE i.pvipvcod      = NEW.pvcod
              AND i.pviprocorid  IS NOT NULL
              AND i.pviprocorid   = pc.procorcorescod;

            -- 2) Itens SEM cor e produto SEM variações -> baixa em pro.proqtde (legacy)
            UPDATE pro pr
              SET proqtde = COALESCE(pr.proqtde, 0) - COALESCE(i.pviqtde, 0)
              FROM pvi i
            WHERE i.pvipvcod = NEW.pvcod
              AND i.pviprocod = pr.procod
              AND i.pviprocorid IS NULL
              AND NOT EXISTS (
                    SELECT 1
                      FROM procor pc
                      WHERE pc.procorprocod = pr.procod
                  );

            -- 3) NEW: Decrement part_group stock for products with a group
            -- This is the new compatibility groups feature
            FOR r IN 
              SELECT DISTINCT 
                pr.part_group_id,
                pr.procod,
                COALESCE(i.pviqtde, 0) as qty
              FROM pvi i
              JOIN pro pr ON pr.procod = i.pviprocod
              WHERE i.pvipvcod = NEW.pvcod
                AND pr.part_group_id IS NOT NULL
            LOOP
              -- Update group stock
              UPDATE part_groups 
              SET stock_quantity = stock_quantity - r.qty,
                  updated_at = NOW()
              WHERE id = r.part_group_id;
              
              -- Create audit record
              INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
              VALUES (r.part_group_id, -r.qty, 'sale', NEW.pvcod::text || ':' || r.procod::text);
            END LOOP;

          END IF;

          RETURN NEW;
        END;
        $function$;
  
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.retornar_saldo()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        DECLARE
          r RECORD;
        BEGIN
          IF NEW.pvsta = 'X' AND NEW.pvconfirmado = 'S' THEN

            -- 1) Itens COM cor -> devolve em procor
            UPDATE procor pc
              SET procorqtde = COALESCE(pc.procorqtde, 0) + COALESCE(i.pviqtde, 0)
              FROM pvi i
            WHERE i.pvipvcod      = NEW.pvcod
              AND i.pviprocorid  IS NOT NULL
              AND i.pviprocorid   = pc.procorcorescod;

            -- 2) Itens SEM cor e produto SEM variações -> devolve em pro.proqtde (legacy)
            UPDATE pro pr
              SET proqtde = COALESCE(pr.proqtde, 0) + COALESCE(i.pviqtde, 0)
              FROM pvi i
            WHERE i.pvipvcod = NEW.pvcod
              AND i.pviprocod = pr.procod
              AND i.pviprocorid IS NULL
              AND NOT EXISTS (
                    SELECT 1
                      FROM procor pc
                      WHERE pc.procorprocod = pr.procod
                  );

            -- 3) NEW: Return stock to part_group for products with a group (order cancellation)
            FOR r IN 
              SELECT DISTINCT 
                pr.part_group_id,
                pr.procod,
                COALESCE(i.pviqtde, 0) as qty
              FROM pvi i
              JOIN pro pr ON pr.procod = i.pviprocod
              WHERE i.pvipvcod = NEW.pvcod
                AND pr.part_group_id IS NOT NULL
            LOOP
              -- Return stock to group
              UPDATE part_groups 
              SET stock_quantity = stock_quantity + r.qty,
                  updated_at = NOW()
              WHERE id = r.part_group_id;
              
              -- Create audit record
              INSERT INTO part_group_audit (part_group_id, change, reason, reference_id)
              VALUES (r.part_group_id, r.qty, 'cancellation', NEW.pvcod::text || ':' || r.procod::text);
            END LOOP;

          END IF;

          RETURN NEW;
        END;
        $function$;
 
    `);

    // FIM INSERTS CONDICIONAIS

    //inicio das triggers
    await pool.query(`
      DROP TRIGGER IF EXISTS t_atualizar_saldo ON pv;
      CREATE TRIGGER t_atualizar_saldo
      AFTER UPDATE OF pvconfirmado
      ON public.pv
      FOR EACH ROW
      WHEN (NEW.pvconfirmado = 'S')
      execute procedure atualizar_saldo()
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS t_retornar_saldo ON public.pv;
      CREATE TRIGGER t_retornar_saldo
      AFTER UPDATE OF pvsta
      ON public.pv
      FOR EACH ROW
      WHEN (NEW.pvsta = 'X')
      execute procedure retornar_saldo()
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
