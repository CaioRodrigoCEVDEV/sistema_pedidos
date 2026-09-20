/* OrderUp Storefront — Service Worker.
   Estratégia: network-first (sem cache agressivo). Ao ativar uma versão
   nova, limpa caches antigos para o usuário receber o DS atualizado. */
const OU_SW_VERSION = "ou-storefront-2026.09.20.111743";

self.addEventListener("install", (event) => {
  console.log("Service Worker instalado", OU_SW_VERSION);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.indexOf("ou-storefront") === 0 && key !== OU_SW_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Cache opcional: segue para a rede por padrão.
});
