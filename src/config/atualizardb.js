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
      `ALTER TABLE public.emp ADD IF NOT exists empusapv varchar(1) default 'N';`
    );
    await pool.query(
      `ALTER TABLE public.emp ADD IF NOT exists empusaest varchar(1) default 'N';`
    );
    await pool.query(
      `alter table public.procor add IF NOT exists procorqtde int null;`
    );

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
      INSERT INTO public.usu (usunome, usuemail, ususenha)
      VALUES ('orderup', 'admin@orderup.com.br', md5('orderup@'))
      ON CONFLICT (usuemail) DO NOTHING;
    `);

    // View Tipo peças
    await pool.query(`
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
    `);

    // Table EST (estoque)
    await pool.query(`
        CREATE TABLE public.est (
      estprocod int4 NOT NULL,
      estqt int4 NOT NULL,
      esttipo varchar(4) NULL,
      CONSTRAINT est_pkey PRIMARY KEY (estprocod)
      );
    `);

    // Table PV (pedidos de venda)
    await pool.query(`
        CREATE TABLE public.pv (
        pvcod int4 NOT NULL,
        pvvl numeric(14, 4) DEFAULT 0 NULL,
        pvobs varchar(254) NULL,
        pvcanal varchar(10) NULL,
        pvconfirmado bpchar(2) NULL,
        pvsta bpchar(2) NULL,
        CONSTRAINT pvcod_pkey PRIMARY KEY (pvcod)
      );

      -- Table Triggers

      create trigger t_atualizar_saldo after
      update
          of pvconfirmado on
          public.pv for each row execute procedure atualizar_saldo();
    `);

    // Table PVI (itens dos pedidos de venda)
    await pool.query(`
        CREATE TABLE public.pvi (
          pvipvcod int4 NOT NULL,
          pviprocod int4 NOT NULL,
          pvivl numeric(14, 4) DEFAULT 0 NULL,
          pviqtde numeric(14, 4) DEFAULT 0 NULL
      );
    `);

    // função de trigger para atualizar saldo no estoque
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.atualizar_saldo()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      BEGIN
        IF NEW.pvconfirmado = 'S' THEN
          UPDATE pro
            SET proqtde = proqtde - pvi.pviqtde
            FROM pvi
          WHERE pvi.pviprocod = pro.procod
            AND pvi.pvipvcod = NEW.pvcod;
        END IF;

        RETURN NEW;
      END;
      $function$
      ;  
    `);

    // FIM INSERTS CONDICIONAIS

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
