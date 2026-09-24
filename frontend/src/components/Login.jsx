import { useState } from "react";
import { apiRequest } from "../api/client.js";
import { useSession } from "../state/Session.jsx";
import { Field, useAction } from "./UI.jsx";
export default function Login() {
  const session = useSession(),
    action = useAction();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  async function submit(event) {
    event.preventDefault();
    await action.run(async () => {
      await apiRequest("/auth/login", {
        method: "POST",
        json: { usuemail: email, ususenha: password },
      });
      setPassword("");
      session.refresh();
    }, "");
  }
  return (
    <div className="login-layout">
      <form className="panel login-panel" onSubmit={submit}>
        <span className="brand">OrderUp</span>
        <h1>Acesse sua conta</h1>
        <p>Entre para continuar no painel.</p>
        <Field
          label="E-mail"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {action.feedback}
        <button className="button" disabled={action.busy}>
          {action.busy ? "Entrando…" : "Entrar"}
        </button>
        <a href="/loja">Voltar para a loja</a>
      </form>
    </div>
  );
}
