// Seletor compartilhado pelo catalogo e pagina inicial.
window.ouEscolherCor = function ({ cores, nome, onConfirm }) {
  document.querySelector(".ou-color-dialog")?.close();
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "ou-color-dialog";
  dialog.setAttribute("aria-labelledby", "ou-color-title");
  dialog.innerHTML = `
    <form method="dialog">
      <header class="ou-color-header">
        <div><span class="ou-color-eyebrow">SELECIONE UMA OPÇÃO</span>
        <h2 id="ou-color-title">Escolha a cor</h2></div>
        <button class="ou-color-close" type="button" aria-label="Fechar">×</button>
      </header>
      <p class="ou-color-product"></p>
      <fieldset class="ou-color-options"><legend class="visually-hidden">Cores do produto</legend></fieldset>
      <footer class="ou-color-footer">
        <button type="button" class="ou-color-cancel">Cancelar</button>
        <button type="submit" class="ou-color-confirm">Confirmar cor</button>
      </footer>
    </form>`;
  dialog.querySelector(".ou-color-product").textContent = nome;
  const options = dialog.querySelector(".ou-color-options");
  let selected = null;
  cores.forEach((cor, index) => {
    const unavailable = String(cor.procorsemest || "").trim().toUpperCase() === "S";
    const label = document.createElement("label");
    label.className = "ou-color-option" + (unavailable ? " is-unavailable" : "");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "product-color";
    input.value = String(index);
    input.disabled = unavailable;
    if (!unavailable && selected === null) { input.checked = true; selected = cor; }
    input.addEventListener("change", () => { selected = cor; });
    const name = document.createElement("span");
    name.className = "ou-color-name";
    name.textContent = cor.cornome;
    const status = document.createElement("span");
    const low = !unavailable && cor.procoracabando === "S";
    status.className = "ou-color-status" + (low ? " is-low" : "");
    status.textContent = unavailable ? "Sem estoque" : low ? "Últimas unidades" : "Disponível";
    label.append(input, name, status);
    options.append(label);
  });
  const confirm = dialog.querySelector(".ou-color-confirm");
  confirm.disabled = selected === null;
  if (!selected) confirm.textContent = "Indisponível";
  const close = () => dialog.close();
  dialog.querySelector(".ou-color-close").addEventListener("click", close);
  dialog.querySelector(".ou-color-cancel").addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  dialog.addEventListener("close", () => { dialog.remove(); previousFocus?.focus(); }, { once: true });
  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selected || confirm.disabled) return;
    confirm.disabled = true;
    close();
    onConfirm(selected);
  });
  document.body.append(dialog);
  dialog.showModal();
};
