import { useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";
export function useResource(url, revision = 0) {
  const [result, setResult] = useState({ url: null, loading: true, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setResult((old) => ({
      url,
      data: old.url === url ? old.data : null,
      loading: true,
      error: null,
    }));
    apiRequest(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ url, loading: false, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ url, loading: false, data: null, error });
      });
    return () => controller.abort();
  }, [url, revision, attempt]);
  return {
    ...(result.url === url ? result : { data: null, error: null, loading: Boolean(url) }),
    reload: () => setAttempt((n) => n + 1),
  };
}
