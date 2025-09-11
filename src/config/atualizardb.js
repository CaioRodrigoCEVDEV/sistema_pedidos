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

  
      await pool.query(`ALTER TABLE public.emp ADD IF NOT exists empcod serial4 NOT NULL;`);

      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS emp_empcod_key ON public.emp (empcod);`);

      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS usu_usucod_key ON public.usu (usucod);`);


    // FIM NOVOS CAMPOS
    // ==================================================================================================================================

    /* =========================
       TABELAS (CREATE IF N/E)
    ==========================*/

    // USUÁRIOS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.usu (
        usucod   SERIAL PRIMARY KEY,
        usunome  VARCHAR NULL,
        usuemail VARCHAR(120) NOT NULL UNIQUE,
        ususenha VARCHAR(32) NULL,
        usuadm   BPCHAR(1) DEFAULT 'N'
      );
    `);

    // MARCAS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.marcas (
        marcascod SERIAL PRIMARY KEY,
        marcasdes VARCHAR(40) NULL,
        marcassit BPCHAR(1) DEFAULT 'A'
      );
    `);

    // MODELO
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.modelo (
        modcod       SERIAL PRIMARY KEY,
        moddes       VARCHAR(40) NULL,
        modsit       BPCHAR(1) DEFAULT 'A',
        modmarcascod INT NULL,
        ordem        INT NULL,
        CONSTRAINT fk_modelo_marcas
          FOREIGN KEY (modmarcascod) REFERENCES public.marcas(marcascod)
      );
    `);

    // TIPO
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.tipo (
        tipocod SERIAL PRIMARY KEY,
        tipodes VARCHAR(40) NULL,
        tiposit BPCHAR(1) DEFAULT 'A'
      );
    `);

    // CORES
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.cores (
        corcod  SERIAL PRIMARY KEY,
        cornome VARCHAR(50) NOT NULL
      );
    `);

    // PRODUTOS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.pro (
        procod      SERIAL PRIMARY KEY,
        prodes      VARCHAR(40) NULL,
        promarcascod INT NULL,
        protipocod   INT NULL,
        promodcod    INT NULL,
        prosit       BPCHAR(1) DEFAULT 'A',
        provl        NUMERIC(14,4) NULL,
        prousucad    INT NULL,
        prodtcad     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        prousualt    INT NULL,
        prodtalt     TIMESTAMP NULL,
        procor       INT NULL,
        CONSTRAINT fk_pro_cor    FOREIGN KEY (procor)       REFERENCES public.cores(corcod),
        CONSTRAINT fk_pro_marcas FOREIGN KEY (promarcascod) REFERENCES public.marcas(marcascod),
        CONSTRAINT fk_pro_modelo FOREIGN KEY (promodcod)    REFERENCES public.modelo(modcod),
        CONSTRAINT fk_pro_tipo   FOREIGN KEY (protipocod)   REFERENCES public.tipo(tipocod)
      );
    `);

    // PRODUTO x COR
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.procor (
        procorprocod  INT NOT NULL,
        procorcorescod INT NOT NULL,
        procorid      SERIAL NOT NULL,
        CONSTRAINT pk_procor PRIMARY KEY (procorprocod, procorcorescod)
      );
    `);

    // EMPRESA (com empcod, pois você quer checar empcod = 1)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.emp (
        empcod       SERIAL PRIMARY KEY,
        emprazao     VARCHAR(254) NULL,
        empwhatsapp1 VARCHAR(13) NULL,
        empwhatsapp2 VARCHAR(13) NULL
      );
    `);

    //   INSERTS CONDICIONAIS
    
    // EMP default (empcod = 1)
    await pool.query(`
      INSERT INTO public.emp (empcod, emprazao, empwhatsapp1, empwhatsapp2)
      VALUES (1, 'Razao Social ou Fantasia', '', '')
      ON CONFLICT (empcod) DO NOTHING;
    `);

    // USU default (usucod = 1, usunome = 'orderup')
    await pool.query(`
      INSERT INTO public.usu (usucod, usunome, usuemail, ususenha)
      VALUES (1, 'orderup', 'admin@ordeup.com.br', md5('orderup@'))
      ON CONFLICT (usucod) DO NOTHING;
    `);

    // Ajusta os sequences para não colidirem após inserts com ID fixo
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('public.emp','empcod'),
                    GREATEST((SELECT COALESCE(MAX(empcod),0) FROM public.emp), 1));
    `);
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('public.usu','usucod'),
                    GREATEST((SELECT COALESCE(MAX(usucod),0) FROM public.usu), 1));
    `);


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
