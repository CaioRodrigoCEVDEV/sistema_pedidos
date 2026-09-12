document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formPerfil");
  const nome = document.getElementById("nome");
  const email = document.getElementById("email");
  const senha = document.getElementById("senha");
  const confirmarSenha = document.getElementById("confirmarSenha");
  const erroSenha = document.getElementById("erroSenha");
  const btnSalvar = document.getElementById("btnSalvar");

  function iniciais(nomeCompleto) {
    if (!nomeCompleto) return "U";
    const partes = String(nomeCompleto).trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return "U";
    return partes
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join("");
  }

  function atualizarIdentidade(nomeCompleto, emailCompleto) {
    const avatar = document.getElementById("perfilAvatar");
    const perfilNome = document.getElementById("perfilNome");
    const perfilEmail = document.getElementById("perfilEmail");
    if (avatar) avatar.textContent = iniciais(nomeCompleto);
    if (perfilNome) perfilNome.textContent = nomeCompleto || "Usuário";
    if (perfilEmail) perfilEmail.textContent = emailCompleto || "—";

    // Mantém o topbar/menu do shell coerentes após a alteração do nome.
    const topNome = document.getElementById("ouUserName");
    const menuNome = document.getElementById("ouMenuName");
    const topAvatar = document.getElementById("ouUserAvatar");
    if (topNome) topNome.textContent = nomeCompleto || "";
    if (menuNome) menuNome.textContent = nomeCompleto || "Usuário autenticado";
    if (topAvatar) topAvatar.textContent = iniciais(nomeCompleto);
  }

  function marcarInvalido(input, invalido) {
    if (!input) return;
    input.classList.toggle("is-invalid", invalido);
  }

  function limparErros() {
    marcarInvalido(nome, false);
    marcarInvalido(senha, false);
    marcarInvalido(confirmarSenha, false);
    if (erroSenha) {
      erroSenha.textContent = "";
      erroSenha.classList.add("d-none");
    }
  }

  function exibirErroSenha(mensagem) {
    if (!erroSenha) return;
    erroSenha.textContent = mensagem;
    erroSenha.classList.remove("d-none");
  }

  [nome, senha, confirmarSenha].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", () => {
      marcarInvalido(input, false);
      if (input !== nome && erroSenha) {
        erroSenha.textContent = "";
        erroSenha.classList.add("d-none");
      }
    });
  });

  function validar() {
    limparErros();
    let valido = true;

    if (!nome.value.trim()) {
      marcarInvalido(nome, true);
      valido = false;
    }

    if (!senha.value) {
      marcarInvalido(senha, true);
      exibirErroSenha("Informe a nova senha.");
      valido = false;
    } else if (!confirmarSenha.value) {
      marcarInvalido(confirmarSenha, true);
      exibirErroSenha("Repita a nova senha.");
      valido = false;
    } else if (senha.value !== confirmarSenha.value) {
      marcarInvalido(confirmarSenha, true);
      exibirErroSenha("As senhas não coincidem.");
      valido = false;
    }

    return valido;
  }

  function setLoading(loading) {
    if (!btnSalvar) return;
    btnSalvar.disabled = loading;
    btnSalvar.innerHTML = loading
      ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Salvando...'
      : '<i class="bi bi-check2 me-1"></i> Salvar alterações';
  }

  // Mostrar/ocultar senha (mesmo padrão do painel de usuários)
  document.querySelectorAll(".js-toggle-senha").forEach((botao) => {
    botao.addEventListener("click", () => {
      const input = document.getElementById(botao.dataset.target);
      if (!input) return;
      const mostrar = input.type === "password";
      input.type = mostrar ? "text" : "password";
      const icone = botao.querySelector("i");
      if (icone) icone.className = mostrar ? "bi bi-eye-slash" : "bi bi-eye";
      botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    });
  });

  function resetarVisibilidadeSenha() {
    [senha, confirmarSenha].forEach((input) => {
      if (input) input.type = "password";
    });
    document.querySelectorAll(".js-toggle-senha").forEach((botao) => {
      const icone = botao.querySelector("i");
      if (icone) icone.className = "bi bi-eye";
      botao.setAttribute("aria-label", "Mostrar senha");
    });
  }

  async function carregarUsuario() {
    try {
      const resp = await fetch(`${BASE_URL}/auth/listarlogin`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Não foi possível carregar os dados do usuário.");
      const user = await resp.json();
      nome.value = user.usunome || "";
      email.value = user.usuemail || "";
      form.dataset.userId = user.usucod;
      atualizarIdentidade(user.usunome, user.usuemail);
    } catch (err) {
      console.error("Erro ao carregar dados do usuário", err);
      if (typeof window.showToast === "function") {
        window.showToast("Erro ao carregar os dados do perfil.", "error");
      }
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const id = form.dataset.userId;
    if (!id) {
      if (typeof window.showToast === "function") {
        window.showToast("Não foi possível identificar o usuário.", "error");
      }
      return;
    }

    const usunome = nome.value.trim();
    const usuemail = email.value;
    const ususenha = senha.value;

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/atualizarCadastro/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usunome, usuemail, ususenha }),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (typeof window.showToast === "function") {
          window.showToast("Dados atualizados com sucesso!", "success");
        }
        senha.value = "";
        confirmarSenha.value = "";
        resetarVisibilidadeSenha();
        atualizarIdentidade(usunome, usuemail);
      } else {
        const mensagem = data.error || data.mensagem || "Erro ao atualizar dados.";
        if (typeof window.showToast === "function") {
          window.showToast(mensagem, "error");
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar dados", err);
      if (typeof window.showToast === "function") {
        window.showToast("Erro ao atualizar dados.", "error");
      }
    } finally {
      setLoading(false);
    }
  });

  carregarUsuario();
});
