import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest } from "../../api/client.js";
import { ErrorState } from "../../components/UI.jsx";
import { money } from "../../lib/format.js";
import { useCart } from "../CartContext.jsx";

function messageFor(items, total, note, channel, order) {
  let text = "📦 Pedido de Peças:\n\n";
  items.forEach((item) => { text += `(${item.qt}) ${item.nome} R$${Number(item.preco).toFixed(2)}\n\n`; });
  if (note) text += `📌 Observações: ${note}\n`;
  text += `💰 Total: R$ ${total.toFixed(2)}\n${channel === "ENTREGA" ? "🚚 Entrega" : "🏬 Retirada: No balcão"}\nPedido N°: ${order}\n`;
  return text;
}
export default function StoreCartPage() {
  const cart = useCart(), navigate = useNavigate();
  const [note, setNote] = useState(""), [channel, setChannel] = useState("BALCAO"), [busy, setBusy] = useState(false), [error, setError] = useState(null), [priceChecked, setPriceChecked] = useState(false);
  useEffect(() => {
    if (!cart.items.length || priceChecked) return;
    const controller = new AbortController();
    apiRequest("/carrinho/precos", { method: "POST", signal: controller.signal, json: { itens: cart.items.map((item) => ({ id: item.id, qt: item.qt })) } }).then((data) => {
      const byId = new Map((data.itens || []).map((item) => [Number(item.procod), item]));
      cart.setItems((old) => old.map((item) => { const current = byId.get(parseInt(String(item.id).split("-")[0], 10)); return current ? { ...item, preco: Number(current.preco || 0), precoOriginal: current.provlpromo != null ? Number(current.provl || 0) : null } : item; }));
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError); }).finally(() => setPriceChecked(true));
    return () => controller.abort();
  }, [cart.items.length, priceChecked]);
  async function seller() {
    try { const response = await fetch("/auth/listarlogin", { headers: { Accept: "application/json" }, credentials: "same-origin" }); return response.ok ? (await response.json()).usucod || null : null; }
    catch { return null; }
  }
  async function finish() {
    if (!cart.items.length || busy) return;
    const popup = window.open("", "_blank");
    setBusy(true); setError(null);
    try {
      const sequence = await apiRequest("/pedidos/sequencia");
      const order = sequence.nextval;
      const company = await apiRequest("/emp");
      await apiRequest("/pedidos/enviar", { method: "POST", json: { pvcod: order, cart: cart.items, total: cart.total, obs: note.trim(), canal: channel, status: "A", confirmado: "N", codigoVendedor: await seller() } });
      const text = messageFor(cart.items, cart.total, note.trim(), channel, order);
      const phone = channel === "ENTREGA" ? company.empwhatsapp2 : company.empwhatsapp1;
      const url = `https://api.whatsapp.com/send?phone=${String(phone || "").replace(/\D/g, "")}&text=${encodeURIComponent(text)}`;
      cart.clear();
      if (popup) { popup.location.href = url; navigate("/", { replace: true }); }
      else window.location.href = url;
    } catch (requestError) { try { popup?.close(); } catch {} setError(requestError); }
    finally { setBusy(false); }
  }
  async function copyQuote() {
    const text = messageFor(cart.items, cart.total, note.trim(), channel, "—").replace("📦 Pedido", "📦 Orçamento");
    await navigator.clipboard.writeText(text);
  }
  if (!cart.items.length) return <div className="store-stack"><section className="store-empty store-empty--large"><span>🛒</span><h1>Seu carrinho está vazio</h1><p>Adicione produtos pelo catálogo para montar seu pedido.</p><Link className="button" to="/catalogo">Ver catálogo</Link></section></div>;
  return <div className="store-stack"><div className="store-page-heading"><div><span>SEU PEDIDO</span><h1>Carrinho de compras</h1><p>Revise quantidades e escolha como deseja receber.</p></div><button className="button secondary" onClick={cart.clear}>Limpar carrinho</button></div>{error && <ErrorState error={error}/>}<div className="cart-layout"><section className="store-panel"><h2>Itens do pedido</h2><div className="cart-items">{cart.items.map((item) => <article className="cart-row" key={item.id}><div className="cart-row__identity"><span>{String(item.tipo || "P").slice(0, 1)}</span><div><small>{[item.marca, item.modelo, item.tipo].filter(Boolean).join(" · ")}</small><strong>{item.nome}</strong><p>{money(item.preco)} por unidade</p></div></div><div className="cart-row__actions"><strong>{money(Number(item.preco) * Number(item.qt))}</strong><div><button aria-label={`Diminuir ${item.nome}`} onClick={() => cart.change(item.id, -1)}>−</button><b>{item.qt}</b><button aria-label={`Aumentar ${item.nome}`} onClick={() => cart.change(item.id, 1)}>+</button><button className="remove" onClick={() => cart.remove(item.id)}>Remover</button></div></div></article>)}</div><label className="cart-note">Observações<textarea rows="4" placeholder="Informações importantes sobre o pedido" value={note} onChange={(e) => setNote(e.target.value)}/></label></section><aside className="cart-summary"><h2>Resumo</h2><div><span>Itens</span><strong>{cart.count}</strong></div><div><span>Subtotal</span><strong>{money(cart.total)}</strong></div><div className="cart-summary__total"><span>Total</span><strong>{money(cart.total)}</strong></div><fieldset><legend>Como deseja receber?</legend><label className={channel === "BALCAO" ? "selected" : ""}><input type="radio" name="channel" value="BALCAO" checked={channel === "BALCAO"} onChange={(e) => setChannel(e.target.value)}/><span><strong>Retirada no balcão</strong><small>Retire seu pedido no local</small></span></label><label className={channel === "ENTREGA" ? "selected" : ""}><input type="radio" name="channel" value="ENTREGA" checked={channel === "ENTREGA"} onChange={(e) => setChannel(e.target.value)}/><span><strong>Entrega</strong><small>Receba seu pedido</small></span></label></fieldset><button className="button store-checkout" disabled={busy} onClick={finish}>{busy ? "Registrando pedido…" : "Finalizar pelo WhatsApp"}</button><button className="button secondary" onClick={copyQuote}>Copiar orçamento</button><small>O pedido é registrado antes da abertura do WhatsApp.</small></aside></div></div>;
}
