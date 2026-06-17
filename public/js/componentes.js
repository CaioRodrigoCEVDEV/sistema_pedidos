function createHeaderUser() {
  const header = document.getElementById("header");
  header.innerHTML = `
  <nav class="navbar navbar-expand-lg navbar-light  shadow-sm rounded p-2 m-1">
                <a class="navbar-brand" href="index" id="nomeEmpresa"><img src="/uploads/logo.jpg" width="30"
                        height="30" alt="" /></a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Alterna navegação">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item active">
                            <a class="nav-link" href="index">Inicio</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="dash">Acesso</a>
                        </li>
                    </ul>
                </div>
            </nav>
  `;
}
document.addEventListener("DOMContentLoaded", createHeaderUser);


function createFooter() {
  const footer = document.getElementById("footer");
  footer.className = "border-top py-4 bg-white shadow";
  footer.innerHTML = `
      <div class="container d-flex justify-content-center align-items-center">
      <a 
        href="https://www.orderup.com.br"
        class="text-muted text-decoration-none"
        style="font-size: 11px; opacity: .75;"
        target="_blank"
        rel="noopener noreferrer"
      >
        Desenvolvido com OrderUp
      </a>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", createFooter);
