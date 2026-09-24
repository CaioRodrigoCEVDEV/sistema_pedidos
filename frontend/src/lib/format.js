export const money = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const number = (v) => Number(v || 0).toLocaleString("pt-BR");
export const digits = (v) => String(v || "").replace(/\D/g, "");
export const date = (v) => {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
export const isoDate = (v = new Date()) =>
  `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
export const documentNumber = (v) => {
  const s = digits(v);
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return s || "—";
};
export const normalize = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function whatsapp(phone, text = "") {
  let v = digits(phone).replace(/^0+/, "");
  if (v.length === 10 || v.length === 11) v = `55${v}`;
  return /^55\d{10,11}$/.test(v)
    ? `https://api.whatsapp.com/send?phone=${v}&text=${encodeURIComponent(text)}`
    : null;
}
export function periodDates(preset, today = new Date()) {
  let start = new Date(today),
    end = new Date(today);
  if (preset === "todos" || preset === "personalizado") return { start: "", end: "" };
  if (preset === "ult7") start.setDate(start.getDate() - 6);
  if (preset === "ult30") start.setDate(start.getDate() - 29);
  if (preset === "mesAtual") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }
  if (preset === "anoAtual") {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear(), 11, 31);
  }
  return { start: isoDate(start), end: isoDate(end) };
}
