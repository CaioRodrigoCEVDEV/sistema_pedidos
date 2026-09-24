import { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client.js";
const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);
export function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0),
    [workspace, setWorkspace] = useState({});
  const generation = useRef(0);
  useEffect(() => {
    const expire = () => {
      generation.current++;
      setSession({ status: "anonymous" });
      setWorkspace({});
    };
    window.addEventListener("orderup:session-expired", expire);
    return () => window.removeEventListener("orderup:session-expired", expire);
  }, []);
  useEffect(() => {
    const controller = new AbortController(),
      current = ++generation.current;
    setSession({ status: "loading" });
    Promise.all([
      apiRequest("/me/usuario", { signal: controller.signal }),
      apiRequest("/me/permissoes", { signal: controller.signal }),
    ])
      .then(([user, permissions]) => {
        if (!controller.signal.aborted && current === generation.current)
          setSession({ status: "ready", user, permissions });
      })
      .catch((error) => {
        if (!controller.signal.aborted && current === generation.current)
          setSession({ status: error.status === 401 ? "anonymous" : "error", error });
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <SessionContext.Provider
      value={{
        ...session,
        workspace,
        setWorkspace,
        refresh: () => setAttempt((n) => n + 1),
        clear: () => {
          generation.current++;
          setSession({ status: "anonymous" });
          setWorkspace({});
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useWorkspace(key, initial) {
  const { workspace, setWorkspace } = useSession();
  return [
    workspace[key] ?? initial,
    (value) =>
      setWorkspace((old) => ({
        ...old,
        [key]: typeof value === "function" ? value(old[key] ?? initial) : value,
      })),
  ];
}
