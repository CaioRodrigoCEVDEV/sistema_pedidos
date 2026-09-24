import { useEffect, useId, useRef, useState } from "react";
export function Loading({ children = "Carregando…" }) {
  return (
    <div className="empty-state" role="status">
      <span className="spinner" />
      {children}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state" role="alert">
      <p>
        {error?.status === 403
          ? "Você não tem permissão para acessar estas informações."
          : error?.message || "Não foi possível carregar os dados."}
      </p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
export function Resource({ resource, children }) {
  if (resource.error) return <ErrorState error={resource.error} retry={resource.reload} />;
  if (resource.data === null) return <Loading />;
  return <div aria-busy={resource.loading}>{children(resource.data)}</div>;
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input id={id} {...props} />}
    </label>
  );
}
export function Status({ children, tone = "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
export function Modal({ title, onClose, children, wide = false, busy = false }) {
  const ref = useRef(null),
    titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}>
          ×
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  async function run(action, success = "Operação concluída.") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await action();
      setMessage(success);
      return true;
    } catch (error) {
      setError(error);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    message,
    run,
    feedback: (
      <>
        {error && <ErrorState error={error} />}
        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}
      </>
    ),
  };
}
