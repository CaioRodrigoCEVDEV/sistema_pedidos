document
  .getElementById("buttonSair")
  .addEventListener("click", function (event) {
    event.preventDefault();

    localStorage.removeItem("usuarioLogado");

    fetch("/auth/sair", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }).finally(() => {
      // Redireciona após logout
      window.location.href = "/index";
    });
  });
