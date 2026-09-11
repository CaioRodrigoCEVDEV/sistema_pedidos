// Validação e normalização dos dados do cliente.
// Centraliza as regras usadas pelo controller para manter o cadastro enxuto.

const onlyDigits = (value) => String(value == null ? "" : value).replace(/\D/g, "");

const isCpf = (value) => onlyDigits(value).length === 11;
const isCnpj = (value) => onlyDigits(value).length === 14;

function validaCPF(cpf) {
  const doc = onlyDigits(cpf);
  if (doc.length !== 11 || /^(\d)\1+$/.test(doc)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(doc[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  d1 = d1 >= 10 ? 0 : d1;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(doc[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  d2 = d2 >= 10 ? 0 : d2;

  return d1 === parseInt(doc[9], 10) && d2 === parseInt(doc[10], 10);
}

function validaCNPJ(cnpj) {
  const doc = onlyDigits(cnpj);
  if (doc.length !== 14 || /^(\d)\1+$/.test(doc)) return false;

  const calc = (base) => {
    const len = base.length;
    let pos = len - 7;
    let sum = 0;
    for (let i = len; i >= 1; i--) {
      sum += base[len - i] * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const base = doc.slice(0, 12).split("").map(Number);
  const d1 = calc(base);
  const d2 = calc([...base, d1]);
  return d1 === parseInt(doc[12], 10) && d2 === parseInt(doc[13], 10);
}

const validaDoc = (value) => {
  const doc = onlyDigits(value);
  if (doc.length === 11) return validaCPF(doc);
  if (doc.length === 14) return validaCNPJ(doc);
  return false;
};

// Telefone/WhatsApp: guarda somente dígitos (DDD + número).
// Aceita 10 ou 11 dígitos e remove o DDI 55 quando presente.
function normalizaTelefone(value) {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

const isTelefone = (value) => {
  const digits = normalizaTelefone(value);
  return digits.length === 10 || digits.length === 11;
};

const isEmail = (value) => {
  if (value == null || String(value).trim() === "") return true;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value).trim());
};

function normalizaCep(value) {
  const digits = onlyDigits(value);
  return digits.length === 8 ? digits : null;
}

const isCep = (value) => {
  if (value == null || String(value).trim() === "") return true;
  return normalizaCep(value) !== null;
};

const isStatus = (value) => value === "A" || value === "I";

// Valida e normaliza o payload de criação/edição.
// partial=true permite edição apenas dos campos enviados.
function validarCliente(payload = {}, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);

  const nome = typeof payload.pardes === "string" ? payload.pardes.trim() : "";
  if (!partial || has("pardes")) {
    if (!nome) errors.push("Nome/Razão Social é obrigatório.");
    else if (nome.length > 120) errors.push("Nome/Razão Social deve ter até 120 caracteres.");
    else data.pardes = nome;
  }

  if (!partial || has("parcnpjcpf")) {
    const doc = onlyDigits(payload.parcnpjcpf);
    if (!doc) errors.push("CPF/CNPJ é obrigatório.");
    else if (!validaDoc(doc)) errors.push("CPF/CNPJ inválido.");
    else data.parcnpjcpf = doc;
  }

  if (!partial || has("parfone")) {
    const telefone = normalizaTelefone(payload.parfone);
    if (!telefone) errors.push("Telefone/WhatsApp é obrigatório.");
    else if (!isTelefone(telefone)) errors.push("Telefone/WhatsApp inválido.");
    else data.parfone = telefone;
  }

  if (has("parfan")) {
    const fantasia = payload.parfan == null ? null : String(payload.parfan).trim();
    data.parfan = fantasia || null;
  }
  if (has("parrua")) {
    const rua = payload.parrua == null ? null : String(payload.parrua).trim();
    data.parrua = rua || null;
  }
  if (has("parbai")) {
    const bairro = payload.parbai == null ? null : String(payload.parbai).trim();
    data.parbai = bairro || null;
  }
  if (has("paremail")) {
    if (!isEmail(payload.paremail)) errors.push("E-mail inválido.");
    else {
      const email = payload.paremail == null ? null : String(payload.paremail).trim();
      data.paremail = email ? email.toLowerCase() : null;
    }
  }
  if (has("parcep")) {
    if (!isCep(payload.parcep)) errors.push("CEP inválido.");
    else data.parcep = payload.parcep == null ? null : normalizaCep(payload.parcep);
  }
  if (has("parmuncod")) {
    if (
      payload.parmuncod === null ||
      payload.parmuncod === undefined ||
      payload.parmuncod === "" ||
      payload.parmuncod === 0 ||
      payload.parmuncod === "0"
    ) {
      data.parmuncod = null;
    } else {
      const muncod = Number(payload.parmuncod);
      if (!Number.isInteger(muncod) || muncod <= 0) errors.push("Município inválido.");
      else data.parmuncod = muncod;
    }
  }
  if (has("parierg")) {
    const ie = payload.parierg == null ? null : String(payload.parierg).trim();
    data.parierg = ie || null;
  }
  if (has("parsit")) {
    if (!isStatus(payload.parsit)) errors.push("Situação inválida.");
    else data.parsit = payload.parsit;
  }

  return { ok: errors.length === 0, errors, data };
}

module.exports = {
  onlyDigits,
  isCpf,
  isCnpj,
  validaCPF,
  validaCNPJ,
  validaDoc,
  normalizaTelefone,
  isTelefone,
  isEmail,
  normalizaCep,
  isCep,
  isStatus,
  validarCliente,
};
