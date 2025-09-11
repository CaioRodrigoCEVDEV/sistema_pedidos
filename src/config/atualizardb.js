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
      VALUES ('orderup', 'admin@ordeup.com.br', md5('orderup@'))
      ON CONFLICT (usuemail) DO NOTHING;
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
