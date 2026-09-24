import { Route, Routes } from "react-router";
import { CartProvider } from "./CartContext.jsx";
import StoreShell from "./StoreShell.jsx";
import StoreHomePage from "./pages/StoreHomePage.jsx";
import StoreCatalogPage from "./pages/StoreCatalogPage.jsx";
import StoreCartPage from "./pages/StoreCartPage.jsx";

export default function StorefrontApp() {
  return <CartProvider><Routes><Route element={<StoreShell/>}><Route index element={<StoreHomePage/>}/><Route path="catalogo" element={<StoreCatalogPage/>}/><Route path="carrinho" element={<StoreCartPage/>}/><Route path="*" element={<StoreHomePage/>}/></Route></Routes></CartProvider>;
}
