# Aplicativo Flutter

Este diretório contém um exemplo mínimo de aplicativo Flutter que consome as rotas do backend Node.js deste repositório.

## Como executar

É necessário ter o ambiente Flutter configurado.

```bash
cd flutter_app
flutter pub get
flutter run
```

O aplicativo faz uma requisição HTTP para `http://localhost:3000/pro` e exibe a lista de produtos.
