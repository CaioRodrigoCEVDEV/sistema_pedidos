/* ==========================================================================
   OrderUp — Ícone do tipo de peça (fonte única, Bootstrap Icons).
   Reutilizado pela tela de Tipos e pela lista de Peças.
   Expõe window.OrderUpTipoIcon(nomeDoTipo).
   ========================================================================== */
(function () {
  "use strict";

  var ICONES = [
    { match: ["lente"], icon: "bi-record-circle" },
    { match: ["camera", "cam"], icon: "bi-camera" },
    { match: ["touch", "digitalizador"], icon: "bi-hand-index" },
    { match: ["tela", "display", "lcd"], icon: "bi-phone" },
    { match: ["bateria", "battery"], icon: "bi-battery-full" },
    { match: ["carga", "carregad", "dock"], icon: "bi-lightning-charge" },
    { match: ["usb", "tipo c", "tipo-c", "conector"], icon: "bi-usb-c" },
    { match: ["jack", "p2", "fone", "audio"], icon: "bi-plug" },
    {
      match: ["tampa", "carcaca", "protecao", "pelicula", "vidro", "aro"],
      icon: "bi-shield",
    },
    { match: ["cola", "adesivo", "fita"], icon: "bi-droplet" },
    {
      match: ["falante", "speaker", "buzzer", "auricular", "arualhad", "som"],
      icon: "bi-volume-up",
    },
    { match: ["microfone", "micro"], icon: "bi-mic" },
    { match: ["chip", "sim", "bandeja", "gaveta"], icon: "bi-sim" },
    { match: ["placa", "circuito", "integrado", "mother"], icon: "bi-cpu" },
    { match: ["botao", "power", "volume"], icon: "bi-power" },
    { match: ["vibra", "motor"], icon: "bi-phone-vibrate" },
    { match: ["antena", "sinal"], icon: "bi-broadcast" },
  ];

  // Ícone coerente com o nome do tipo; fallback genérico "bi-tools".
  function getTipoIcon(nome) {
    var slug = String(nome || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    for (var i = 0; i < ICONES.length; i++) {
      var entrada = ICONES[i];
      for (var j = 0; j < entrada.match.length; j++) {
        if (slug.indexOf(entrada.match[j]) !== -1) return entrada.icon;
      }
    }
    return "bi-tools";
  }

  window.OrderUpTipoIcon = getTipoIcon;
})();
