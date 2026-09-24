import { useEffect, useState } from "react";
import { useResource } from "../hooks/useResource.js";
import { apiRequest } from "../api/client.js";
import { Modal, Resource } from "./UI.jsx";
import { date } from "../lib/format.js";
export function NewsButton() {
  const [open, setOpen] = useState(false);
  const [versaoVista, setVersaoVista] = useState(null);
  const [versaoAtual, setVersaoAtual] = useState(null);
  const resource = useResource(open ? "/api/releases" : null);

  useEffect(() => {
    let active = true;
    apiRequest("/usuario/viuversao")
      .then((data) => {
        if (!active) return;
        setVersaoVista(data?.usuversaovista || null);
        setVersaoAtual(data?.versaoAtual || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const hasUnseen = Boolean(versaoAtual) && versaoVista !== versaoAtual;

  function openModal() {
    setOpen(true);
    if (!hasUnseen) return;
    apiRequest("/usuario/viuversao/", { method: "POST", json: { versao: versaoAtual } }).catch(
      () => {}
    );
    setVersaoVista(versaoAtual);
  }

  return (
    <>
      <button
        className={`button secondary news-button${hasUnseen ? " has-unseen" : ""}`}
        onClick={openModal}
        aria-label={hasUnseen ? "Novidades — há atualizações não vistas" : "Novidades"}
      >
        Novidades
      </button>
      {open && (
        <Modal title="Novidades do sistema" onClose={() => setOpen(false)}>
          <Resource resource={resource}>
            {(data) =>
              data.length ? (
                <div className="page-stack">
                  {data.map((release) => (
                    <article key={release.id || release.version}>
                      <h3>{release.name || release.version}</h3>
                      <p className="muted">
                        {release.version} · {date(release.published_at)}
                      </p>
                      <div className="release-body">{release.body}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>Nenhuma atualização disponível.</p>
              )
            }
          </Resource>
        </Modal>
      )}
    </>
  );
}
export function MaintenanceNotice() {
  const resource = useResource("/api/manutencao");
  const [dismissed, setDismissed] = useState(false);
  if (!resource.data?.ativo || dismissed) return null;
  return (
    <aside className="maintenance-notice" role="status">
      <div>
        <strong>{resource.data.titulo || "Manutenção programada"}</strong>
        <p>{resource.data.mensagem}</p>
      </div>
      <button
        className="icon-button"
        aria-label="Fechar aviso de manutenção"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
