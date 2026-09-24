import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
function loadCart() {
  try { const value = JSON.parse(localStorage.getItem("cart") || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  useEffect(() => { localStorage.setItem("cart", JSON.stringify(items)); }, [items]);
  useEffect(() => { const sync = () => setItems(loadCart()); window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);
  function add(product, quantity = 1, color = null) {
    const baseId = product.procod ?? product.id;
    const id = color ? `${baseId}-${color.cornome}` : String(baseId);
    const price = product.provlpromo ?? product.preco ?? product.provl ?? 0;
    const original = product.provlpromo != null ? Number(product.provl || 0) : null;
    setItems((old) => {
      const found = old.findIndex((item) => String(item.id) === String(id));
      if (found >= 0) return old.map((item, index) => index === found ? { ...item, qt: Number(item.qt || 0) + quantity, preco: Number(price), precoOriginal: original } : item);
      return [...old, { id, nome: color ? `${product.prodes} (${color.cornome})` : product.prodes, tipo: product.tipodes || "", marca: product.marcasdes || "", modelo: product.moddes || product.modelos || "", preco: Number(price), precoOriginal: original, qt: quantity, corSelecionada: color?.cornome || null, idCorSelecionada: color?.corcod || null }];
    });
  }
  function change(id, delta) { setItems((old) => old.flatMap((item) => String(item.id) === String(id) ? (Number(item.qt) + delta > 0 ? [{ ...item, qt: Number(item.qt) + delta }] : []) : [item])); }
  function remove(id) { setItems((old) => old.filter((item) => String(item.id) !== String(id))); }
  const value = useMemo(() => ({ items, setItems, add, change, remove, clear: () => setItems([]), count: items.reduce((sum, item) => sum + Number(item.qt || 0), 0), total: items.reduce((sum, item) => sum + Number(item.preco || 0) * Number(item.qt || 0), 0) }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);
