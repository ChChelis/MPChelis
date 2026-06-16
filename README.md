# Interface MPChelis

Interface local para pesquisar artes no MPCFill, selecionar resultados, gerar XML compativel e baixar imagens pelo servidor local.

## Como rodar

```powershell
node server.mjs
```

Depois abra:

```text
http://localhost:8080
```

## Configuracao

- `config.json`: URL de origem e categorias/uploaders.
- `config.html`: interface local para editar a configuracao.

## Observacoes

- A pasta `downloads/` e gerada localmente ao baixar imagens e nao entra no Git.
- O proxy local em `server.mjs` evita o erro de CORS ao consultar o MPCFill pelo navegador.
