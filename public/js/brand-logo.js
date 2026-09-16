/* ==========================================================================
   OrderUp — Logo/ícone de marca (fonte única).
   Reutilizado pelos cards de marca e pelos resultados da busca da home.
   Expõe window.OrderUpBrandLogo.
   ========================================================================== */
(function () {
  "use strict";

  var brandMap = {
    samsung: { icon: "samsung", domain: "samsung.com" },
    motorola: { icon: "motorola", domain: "motorola.com" },
    xiaomi: { icon: "xiaomi", domain: "mi.com" },
    iphone: { icon: "apple", domain: "apple.com" },
    apple: { icon: "apple", domain: "apple.com" },
    realme: { icon: null, domain: "realme.com" },
    infinix: { icon: null, domain: "infinixmobility.com" },
    nokia: { icon: "nokia", domain: "nokia.com" },
    lg: { icon: "lg", domain: "lg.com" },
    asus: { icon: "asus", domain: "asus.com" },
    tecnospark: { icon: null, domain: "www.tecno-mobile.com" },
    itel: { icon: null, domain: "itel-mobile.com" },
    acessorios: { icon: null, domain: "www.orderup.com.br" },
    oppo: { icon: "oppo", domain: "oppo.com" },
    caio: { icon: null, domain: "xvideos.com" },
    huawei: { icon: "huawei", domain: "huawei.com" },
  };

  var FALLBACK = "https://cdn.simpleicons.org/cog/000";

  // Normaliza marca (remove acentos, espaços...)
  function normalize(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  // Lógica de qual logo usar (sem HEAD): ícone oficial > favicon > upload.
  function getBrandLogo(brandName) {
    var slug = normalize(brandName);
    var info = brandMap[slug];

    if (info && info.icon) {
      return {
        primary: "https://cdn.simpleicons.org/" + info.icon + "/000",
        isUploaded: false,
        slug: slug,
      };
    }

    if (info && info.domain) {
      return {
        primary:
          "https://www.google.com/s2/favicons?sz=64&domain=" + info.domain,
        isUploaded: false,
        slug: slug,
      };
    }

    return {
      primary: "/uploads/" + slug + ".jpg",
      isUploaded: true,
      slug: slug,
    };
  }

  window.OrderUpBrandLogo = {
    get: getBrandLogo,
    normalize: normalize,
    fallback: FALLBACK,
  };
})();
