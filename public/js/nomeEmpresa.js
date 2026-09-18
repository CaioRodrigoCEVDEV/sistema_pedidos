// Fonte única dos dados da empresa no frontend: memoiza a promise para que
// nome, whatsapp, estoque e carrinho não repitam o GET /emp na mesma página.
window.obterDadosEmpresa = window.obterDadosEmpresa || function obterDadosEmpresa() {
    if (!window.__ouEmpresaPromise) {
        window.__ouEmpresaPromise = fetch(`${BASE_URL}/emp`)
            .then((response) => response.json())
            .catch((error) => {
                window.__ouEmpresaPromise = null;
                throw error;
            });
    }
    return window.__ouEmpresaPromise;
};

document.addEventListener('DOMContentLoaded', function() {
    function formatCompanyName(name) {
        return name ? name.toUpperCase() : '';
    }

    if (typeof BASE_URL === 'undefined') {
        console.error('BASE_URL não está definida.');
        return;
    }

    window.obterDadosEmpresa()
        .then((data) => {
            const companyName = data.emprazao || '';
            const formattedName = formatCompanyName(companyName);
            const companyNameElem = document.getElementById('nomeEmpresa');
            const titleElem = document.getElementById('title');
            if (companyNameElem) {
                let nameSpan = companyNameElem.querySelector('.company-name');
                if (!nameSpan) {
                    nameSpan = document.createElement('span');
                    nameSpan.className = 'company-name';
                    nameSpan.style.marginLeft = '8px';
                    companyNameElem.appendChild(nameSpan);
                }
                nameSpan.textContent = formattedName;
            }
            if (titleElem) {
                titleElem.textContent = formattedName;
            }
        })
        .catch((error) => {
            console.error('Erro ao buscar o nome da empresa:', error);
        });
});