# Aplicativo Flutter

Este diretório contém um pequeno cliente Flutter para o backend Node.js deste repositório.

O aplicativo possui duas telas principais:

1. **Login** – onde o usuário informa email e senha.
2. **Lista de Produtos** – após o login, a listagem é obtida pela API.

## Como executar

É necessário ter o ambiente Flutter configurado.

```bash
cd flutter_app
flutter pub get
flutter run
```

O app espera que o backend esteja rodando em `http://localhost:3000`.
