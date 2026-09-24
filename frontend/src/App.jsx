import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router";
import { SessionProvider, useSession } from "./state/Session.jsx";
import { canAccess } from "./lib/navigation.js";
import Shell from "./components/Shell.jsx";
import Login from "./components/Login.jsx";
import { ErrorState, Loading } from "./components/UI.jsx";
const ClientsPage = lazy(() => import("./pages/ClientsPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const ProductsPage = lazy(() => import("./pages/ProductsPage.jsx"));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage.jsx"));
const GroupsPage = lazy(() => import("./pages/GroupsPage.jsx"));
const ShowcasesPage = lazy(() => import("./pages/ShowcasesPage.jsx"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.jsx"));
const ReturnsPage = lazy(() => import("./pages/ReturnsPage.jsx"));
const StockPage = lazy(() => import("./pages/StockPage.jsx"));
const GroupStockPage = lazy(() => import("./pages/GroupStockPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));
const BackupsPage = lazy(() => import("./pages/BackupsPage.jsx"));
const UsersPage = lazy(() => import("./pages/UsersPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
function Allowed({ permission, children }) {
  const { permissions } = useSession();
  return canAccess(permissions, permission) ? (
    children
  ) : (
    <section className="panel">
      <h1>Acesso não permitido</h1>
      <p>Seu usuário não tem acesso a esta tela. Solicite a liberação ao administrador.</p>
      <Link to="/">Voltar ao painel</Link>
    </section>
  );
}
function Home() {
  const { permissions } = useSession();
  if (canAccess(permissions, "dashboard")) return <Navigate replace to="/dashboard" />;
  if (canAccess(permissions, "clientes")) return <Navigate replace to="/clientes" />;
  return (
    <section className="panel">
      <h1>Bem-vindo ao painel</h1>
      <p>Escolha uma opção disponível no menu para continuar.</p>
      <Link to="/perfil">Minha conta</Link>
    </section>
  );
}
function AuthenticatedApp() {
  const session = useSession();
  if (session.status === "loading") return <Loading>Verificando sua sessão…</Loading>;
  if (session.status === "anonymous") return <Login />;
  if (session.status === "error")
    return <ErrorState error={session.error} retry={session.refresh} />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route
          path="dashboard"
          element={
            <Allowed permission="dashboard">
              <Suspense fallback={<Loading />}>
                <DashboardPage />
              </Suspense>
            </Allowed>
          }
        />
        <Route
          path="clientes"
          element={
            <Allowed permission="clientes">
              <Suspense fallback={<Loading />}>
                <ClientsPage />
              </Suspense>
            </Allowed>
          }
        />
        {[
          ["produtos", "produtos", <ProductsPage />],
          ["promocoes", "promocoes", <PromotionsPage />],
          ["grupos", "grupos", <GroupsPage />],
          ["vitrines", "vitrines", <ShowcasesPage />],
        ].map(([path, permission, page]) => (
          <Route
            key={path}
            path={path}
            element={
              <Allowed permission={permission}>
                <Suspense fallback={<Loading />}>{page}</Suspense>
              </Allowed>
            }
          />
        ))}
        <Route
          path="pedidos"
          element={
            <Allowed permission="pedidos">
              <Suspense fallback={<Loading />}><OrdersPage /></Suspense>
            </Allowed>
          }
        />
        <Route
          path="devolucoes"
          element={
            <Allowed permission="devolucoes">
              <Suspense fallback={<Loading />}><ReturnsPage /></Suspense>
            </Allowed>
          }
        />
        <Route
          path="estoque"
          element={
            <Allowed permission="estoque">
              <Suspense fallback={<Loading />}><StockPage /></Suspense>
            </Allowed>
          }
        />
        <Route
          path="estoque-grupos"
          element={
            <Allowed permission="estoque-grupos">
              <Suspense fallback={<Loading />}><GroupStockPage /></Suspense>
            </Allowed>
          }
        />
        {[
          ["relatorios", "relatorios", <ReportsPage />],
          ["backup", "backups", <BackupsPage />],
          ["users", "usuarios", <UsersPage />],
          ["configuracoes", "configuracoes", <SettingsPage />],
          ["perfil", "always", <ProfilePage />],
        ].map(([path, permission, page]) => (
          <Route key={path} path={path} element={<Allowed permission={permission}><Suspense fallback={<Loading />}>{page}</Suspense></Allowed>} />
        ))}
        <Route
          path="conexao"
          element={
            <section className="panel">
              <h1>Conexão estabelecida</h1>
              <p>{session.user.usunome}, sua sessão está ativa.</p>
              <Link to="/">Ir para o painel</Link>
            </section>
          }
        />
        <Route
          path="*"
          element={
            <section className="panel">
              <h1>Página não encontrada</h1>
              <Link to="/">Voltar ao painel</Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <AuthenticatedApp />
    </SessionProvider>
  );
}
