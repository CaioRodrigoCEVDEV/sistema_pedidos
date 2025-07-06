const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Painel modals', () => {
  test('modals exist with forms', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public/html/auth/admin/html/painel.html'), 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    expect(doc.querySelector('#modalMarca')).not.toBeNull();
    expect(doc.querySelector('#modalModelo')).not.toBeNull();
    expect(doc.querySelector('#modalTipo')).not.toBeNull();
    expect(doc.querySelector('#modalPeca')).not.toBeNull();

    expect(doc.querySelector('#modalMarca form#cadastrarPainelMarca')).not.toBeNull();
    expect(doc.querySelector('#modalPeca form#cadastrarPainelPeca')).not.toBeNull();
  });
});
