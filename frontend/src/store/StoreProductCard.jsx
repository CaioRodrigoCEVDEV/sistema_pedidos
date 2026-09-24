import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { Modal, Status } from "../components/UI.jsx";
import { money } from "../lib/format.js";
import { useCart } from "./CartContext.jsx";

function stateOf(product) {
  if (String(product.prosemest || "").trim().toUpperCase() === "S") return ["Sem estoque", "danger"];
  if (String(product.proacabando || "").trim().toUpperCase() === "S") return ["Últimas unidades", "warning"];
  return ["Em estoque", "success"];
}
export default function StoreProductCard({ product, compact = false }) {
  const cart = useCart(), [colors, setColors] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [status, tone] = stateOf(product), unavailable = tone === "danger";
  const original = Number(product.provl || 0), promotional = product.provlpromo != null, price = promotional ? Number(product.provlpromo) : original;
  async function choose() {
    if (unavailable || busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await apiRequest(`/proCoresDisponiveis/${product.procod}`);
      const real = (result || []).filter((color) => color.cornome);
      if (real.length) setColors(real); else { cart.add(product); setMessage("Adicionado ao carrinho."); }
    } catch { setMessage("Não foi possível verificar as cores. Tente novamente."); }
    finally { setBusy(false); }
  }
  function addColor(color) { cart.add(product, 1, color); setColors(null); setMessage("Adicionado ao carrinho."); }
  return <article className={`store-product ${compact ? "is-compact" : ""}`}><div className="store-product__visual"><span>{String(product.tipodes || "Peça").slice(0, 1).toUpperCase()}</span>{promotional && <b>Oferta</b>}</div><div className="store-product__body"><div className="store-product__context">{[product.marcasdes, product.moddes || product.modelos, product.tipodes].filter(Boolean).join(" · ")}</div><h3>{product.prodes}</h3><Status tone={tone}>{status}</Status><div className="store-product__price">{promotional && <del>{money(original)}</del>}<strong>{money(price)}</strong></div>{message && <small className="store-added" role="status">{message}</small>}<button className="button" disabled={unavailable || busy} onClick={choose}>{unavailable ? "Indisponível" : busy ? "Verificando…" : "Adicionar"}</button></div>{colors && <Modal title={`Escolha a cor · ${product.prodes}`} onClose={() => setColors(null)}><div className="color-list">{colors.map((color) => <button key={color.corcod} className="color-option" disabled={color.procorsemest === "S"} onClick={() => addColor(color)}><span>{color.cornome}</span><Status tone={color.procorsemest === "S" ? "danger" : "success"}>{color.procorsemest === "S" ? "Sem estoque" : "Disponível"}</Status></button>)}</div></Modal>}</article>;
}
