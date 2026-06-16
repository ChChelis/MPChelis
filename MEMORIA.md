# Memoria do projeto Interface MPChelis

## Regra operacional

- Antes de executar comandos nesta pasta, ler este arquivo `MEMORIA.md`.
- Depois de comandos ou alteracoes relevantes, atualizar este arquivo com o que foi feito, o motivo e o resultado.
- Usar esta memoria como contexto persistente do projeto para evitar repetir investigacoes e para manter o historico claro.

Observacao pratica: a regra deve ser aplicada aos comandos e edicoes do projeto. Se uma unica acao precisar criar ou reparar a propria memoria, registrar isso imediatamente aqui.

## Estado atual

- Pasta do projeto: `C:\Users\GG_0031712\Desktop\@Chelis Pessoal\Interface MPChelis`.
- O projeto passou a ser preparado para Git/GitHub nesta etapa; inicialmente nao havia `.git`.
- Arquivos principais criados:
  - `index.html`
  - `server.mjs`
  - `config.html`
  - `config.json`
  - `MEMORIA.md`
  - `.gitignore`
  - `README.md`
- Servidor local esperado: `http://localhost:8080`.
- Comando para rodar: `node server.mjs`.

## Estado Git/GitHub

- `git` esta instalado: versao 2.54.0.windows.1.
- Repositorio local inicializado na branch `main`.
- Commit inicial criado com mensagem `Initial commit`; consultar o hash atual com `git log -1 --oneline`.
- Identidade global configurada:
  - user.name: `Chelis`
  - user.email: `contato.chelles@gmail.com`
- `gh` nao esta disponivel no PATH, mas o remoto foi configurado manualmente.
- Remoto `origin`: `https://github.com/ChChelis/MPChelis.git`.
- Push inicial concluido: branch local `main` rastreia `origin/main`.
- Variaveis/recursos de autenticacao checados e ausentes: `GITHUB_TOKEN`, `GH_TOKEN`, `GIT_ASKPASS`, `SSH_AUTH_SOCK`.
- A pasta `downloads/` foi marcada para ficar fora do versionamento.

## Historico do trabalho feito

### Criacao da interface MPChelis XML Builder

Foi criado um site HTML estatico em `index.html` para:

- Receber uma lista de cartas digitada pelo usuario.
- Consultar artes no backend publico do MPCFill.
- Mostrar thumbs dos resultados retornados.
- Permitir que o usuario escolha uma arte.
- Montar um XML compativel com o formato aceito pelo MPCFill e pelo desktop tool.
- Exportar o XML como `cards.xml`.
- Copiar o XML para a area de transferencia.

### Investigacao tecnica do MPCFill

Foi consultado o repositorio oficial `chilli-axe/mpc-autofill` para confirmar:

- O formato XML esperado:
  - `<order>`
  - `<details>`
  - `<quantity>`
  - `<stock>`
  - `<foil>`
  - `<fronts>`
  - `<card>`
  - `<id>`
  - `<sourceType>`
  - `<slots>`
  - `<name>`
  - `<query>`
  - `<cardback>`
- O endpoint de busca usado pelo frontend:
  - `/2/editorSearch/`
- O endpoint para obter detalhes das cartas por ID:
  - `/2/cards/`
- O endpoint de fontes:
  - `/2/sources/`
- O endpoint de saude:
  - `/2/searchEngineHealth/`

### Proxy local

Foi criado `server.mjs` porque o backend `https://mpcfill.com` nao envia `Access-Control-Allow-Origin` para HTML local. Sem proxy, o navegador retorna `Failed to fetch`.

O proxy local:

- Serve o `index.html`.
- Encaminha chamadas `/api/...` para o backend MPCFill configurado no campo da interface.
- Normaliza o backend para origem, por exemplo `https://mpcfill.com`.
- Libera CORS local com `access-control-allow-origin: *`.
- Responde `OPTIONS` para preflight.

### Correcao do erro `Failed to fetch`

Foi ajustado o `index.html` para:

- Usar `/api` quando aberto por `http://localhost:8080`.
- Usar `http://localhost:8080/api` quando aberto diretamente como `file://`.
- Mostrar mensagem mais clara se o proxy local nao estiver rodando:
  - `Nao foi possivel conectar ao proxy local. Rode: node server.mjs e abra http://localhost:8080`

### Remocao de campos

Por solicitacao do usuario, foram removidos da interface:

- Campo `Papel`.
- Campo `Cardback comum`.

O XML continua preenchendo internamente:

- `<stock>(S30) Standard Smooth</stock>`
- `<foil>false</foil>`
- `<cardback></cardback>`

## Validacoes ja realizadas

- `http://localhost:8080/` respondeu `200`.
- `http://localhost:8080/api/2/searchEngineHealth/?backend=https%3A%2F%2Fmpcfill.com` respondeu:
  - `{"online": true}`
- O proxy retornou header:
  - `access-control-allow-origin: *`
- A busca por `lightning bolt` via `/2/editorSearch/` retornou resultados reais, incluindo o ID:
  - `1taR38keSBJgplwmZkX3NETXQSblhPYSh`
- Foi confirmado que os textos `Papel` e `Cardback comum` nao aparecem mais no HTML.

## Processos locais

- Um processo `node server.mjs` foi iniciado durante o trabalho.
- Em uma verificacao anterior, o processo do servidor tinha comando:
  - `"C:\Program Files\nodejs\node.exe" server.mjs`
- Tambem havia um processo Node da Adobe Creative Cloud, que nao deve ser encerrado.

## Decisoes importantes

- Nao e possivel "entrar" ou controlar diretamente `https://mpcfill.com/editor` a partir de um site comum por causa de restricoes do navegador e do proprio site.
- A solucao implementada usa a API/backend do MPCFill para reproduzir o fluxo necessario sem embutir nem controlar o editor original.
- O campo `Backend MPCFill` foi mantido para permitir trocar de servidor, mas o padrao e `https://mpcfill.com`.

### Configuracao externa da origem e uploaders

Por solicitacao do usuario, a URL de origem foi removida da tela principal.

Foi criado o arquivo `config.json` com:

- `backendURL`: URL de origem usada pelo proxy/API.
- `uploaders`: lista de uploaders permitidos para filtrar fontes e resultados.

Foi criada a pagina `config.html` para editar `config.json` sem mexer direto no codigo.

A pagina de configuracao permite:

- Alterar a URL de origem.
- Informar uploaders permitidos, um por linha.
- Listar uploaders/fontes encontrados na origem atual.
- Clicar em um uploader listado para adiciona-lo ao filtro.
- Salvar a configuracao via endpoint local.

O `server.mjs` agora possui o endpoint:

- `GET /config`: le `config.json`, criando o arquivo com defaults se ele nao existir.
- `POST /config`: valida e grava `backendURL` e `uploaders` em `config.json`.

O proxy `/api/...` agora usa `backendURL` do `config.json` quando nenhuma URL e passada por query string.

A tela principal `index.html` agora:

- Nao mostra mais o campo `Backend MPCFill`.
- Carrega `config.json` antes de buscar.
- Usa a URL de origem configurada via servidor.
- Filtra as fontes habilitadas por uploader configurado.
- Filtra os resultados exibidos por uploader configurado.
- Mantem um link para `/config.html` para controle da configuracao.

Validacoes desta etapa:

- `http://localhost:8080/config` retornou `{"backendURL":"https://mpcfill.com","uploaders":[]}`.
- `http://localhost:8080/` nao contem mais o texto `Backend MPCFill`.
- `http://localhost:8080/` contem link para `config.html`.
- `http://localhost:8080/config.html` contem referencia a `config.json`.
- Busca via `http://localhost:8080/api/2/editorSearch/` continuou respondendo `200`.

### Uploaders pre-carregados

O usuario forneceu uma lista no formato `{ id, name }` e pediu para carregar apenas os nomes no arquivo de uploaders.

O `config.json` foi atualizado para manter `backendURL` como `https://mpcfill.com` e usar estes uploaders:

- Coderanger
- CompC
- Hathwellcrisping
- MrTeferi
- Nelynes
- PsilosX
- RustyShackleford
- TwoSheds
- WarpDandy

Validacao:

- `config.json` foi lido e parseado com sucesso.
- `http://localhost:8080/config` retornou a mesma lista de uploaders quando o servidor local estava rodando.

### Consulta externa de uploaders especializados

O usuario pediu para consultar o arquivo:

- `D:\GITHUB\ChelisVault\Chelis Pessoal\Pesquisa Gemini Uploaders.md`

Na secao `Mapeamento de Uploaders Especializados em Digitalizações e Leiautes Originais`, foram identificados nomes de uploaders na tabela e no paragrafo adicional.

Nenhuma configuracao do projeto foi alterada nesta consulta.

### Inclusao dos uploaders especializados na configuracao

O usuario pediu para adicionar ao `config.json` os uploaders encontrados no documento externo que ainda nao estavam configurados.

Foram preservados os uploaders existentes e adicionados os ausentes. A lista final em `config.json` ficou com 18 nomes:

- Coderanger
- CompC
- berndt_toast83
- Coop
- cooperaa
- Hathwellcrisping
- john prime
- MrTeferi
- Nelynes
- PsilosX
- RustyShackleford
- TwoSheds
- WarpDandy
- Willie tanner
- Warp daddy
- chili_axe
- ChilliAxe
- stmilton

Validacao:

- `config.json` foi parseado com sucesso.
- A lista final tem 18 uploaders.
- `http://localhost:8080/config` tambem retornou 18 uploaders com o servidor local ativo.

### Comportamento de teclado da caixa de cartas

Por solicitacao do usuario, a caixa `Cartas` em `index.html` foi ajustada para:

- `Enter`: confirmar/disparar a pesquisa.
- `Shift+Enter`: inserir quebra de linha.
- Preservar o texto digitado apos cada pesquisa.

Validacao estatica:

- Foi adicionado listener `keydown` no elemento `decklist`.
- A pesquisa continua apenas lendo `$("decklist").value`.
- Nao ha atribuicao limpando `decklist.value`.

### Categorias de uploaders e modal inicial

Por solicitacao do usuario, o `config.json` foi migrado de uma lista unica `uploaders` para categorias:

- `OldFrame & Scan`: recebeu todos os 18 uploaders que ja estavam no arquivo.
- `Arte Livre`: ficou com `uploaders: []`, o que significa nao aplicar filtro e permitir toda a gama de resultados.

O `server.mjs` foi atualizado para:

- Ler e gravar `categories`.
- Migrar automaticamente configuracoes antigas com `uploaders` para `OldFrame & Scan`.
- Garantir a existencia da categoria `Arte Livre`.
- Continuar usando `backendURL` do `config.json`.

O `config.html` foi atualizado para:

- Editar uploaders de `OldFrame & Scan`.
- Editar uploaders de `Arte Livre`, embora ela deva ficar vazia para liberar todos os resultados.
- Adicionar uploaders listados pela origem ao campo `OldFrame & Scan`.

O `index.html` foi atualizado para:

- Abrir uma modal de escolha de categoria ao carregar a pagina.
- Bloquear pesquisa enquanto nenhuma categoria estiver selecionada.
- Aplicar o filtro da categoria selecionada.
- Interpretar categoria com lista vazia como sem filtro de uploader.
- Mostrar a categoria atual na lateral.
- Permitir reabrir a modal pelo botao `Trocar categoria`.

Validacoes:

- `http://localhost:8080/config` retornou categorias `OldFrame & Scan` e `Arte Livre`.
- `OldFrame & Scan` retornou 18 uploaders.
- `Arte Livre` retornou 0 uploaders.
- `index.html` contem `categoryModal`, `changeCategory`, `OldFrame & Scan`, `Arte Livre` e `function activeUploaders`.
- `config.html` contem editores `oldFrameUploaders` e `freeArtUploaders`.

### Download direto das imagens selecionadas

Por solicitacao do usuario, o site passou a baixar as imagens selecionadas diretamente pelo servidor local, sem depender das confirmacoes de download do navegador.

Implementacao:

- `server.mjs` ganhou o endpoint `POST /download-images`.
- O endpoint recebe `identifiers`, consulta o backend configurado em `config.json` via `/2/cards/`, usa `downloadLink` de cada carta e grava os arquivos em disco.
- As imagens sao salvas em `downloads/<timestamp>` dentro da pasta do projeto.
- Os nomes de arquivo usam `nome - identifier.extensao`, com sanitizacao para caracteres invalidos no Windows.
- O endpoint retorna `outputDirectory`, `downloaded` e `failed`.
- `index.html` ganhou o botao `Baixar imagens`.
- O botao envia os IDs unicos das escolhas atuais para `/download-images` e mostra a pasta onde os arquivos foram gravados.

Validacao:

- O servidor local foi reiniciado.
- Teste manual em `POST http://localhost:8080/download-images` com o ID `1taR38keSBJgplwmZkX3NETXQSblhPYSh` baixou `Lightning Bolt (Full Art B)` com `11461394` bytes.
- O arquivo foi criado em uma subpasta de `downloads`.
- `index.html` contem `downloadImages` e referencia `/download-images`.
- `server.mjs` contem `serveDownloadImages`.

Observacao futura:

- Este desenho ja concentra a escrita no servidor local, entao pode ser adaptado depois para gravar em uma pasta de repositorio ou sincronizada, como Google Drive, sem mudar o fluxo principal do navegador.

### Seleção fina de uploaders ativos em OldFrame & Scan

Por solicitacao do usuario, a categoria `OldFrame & Scan` no modal inicial ganhou um texto/botao sublinhado `Configurar uploaders`.

Implementacao:

- `config.json` agora diferencia:
  - `uploaders`: lista completa de opcoes da categoria.
  - `activeUploaders`: lista de uploaders realmente ativos no filtro.
- `OldFrame & Scan` iniciou com os 18 uploaders tambem ativos.
- `Arte Livre` continua com `uploaders: []` e `activeUploaders: []`, preservando comportamento sem filtro.
- `server.mjs` normaliza e persiste `activeUploaders`, filtrando ativos que nao existam mais em `uploaders`.
- `index.html` usa `activeUploaders` no filtro quando a categoria possui uploaders configurados.
- O modal agora tem um painel de configuracao de uploaders para `OldFrame & Scan`.
- O painel exibe checkboxes para todos os uploaders da categoria.
- Foram adicionados controles gerais `Nenhum` e `Todos`.
- O painel tem botao `Salvar uploaders`, que grava a selecao em `/config`.
- A tela `config.html` foi ajustada para preservar `activeUploaders` ao salvar a configuracao textual.

Validacoes:

- `http://localhost:8080/config` retornou `OldFrame & Scan` com 18 `uploaders` e 18 `activeUploaders`.
- `Arte Livre` retornou 0 `uploaders` e 0 `activeUploaders`.
- `index.html` contem `Configurar uploaders`, `selectNoUploaders`, `selectAllUploaders`, `saveUploaderSelection`, `activeUploaders` e `uploaderPanel`.
- `config.html` contem `activeUploaders`, `currentConfig` e `categoryActiveUploaders`.
- Um POST de round-trip para `/config` preservou 18 uploaders ativos.

### Modal de progresso para download de imagens

Por solicitacao do usuario, o fluxo `Baixar imagens` foi alterado para explicitar o carregamento em uma modal bloqueante.

Implementacao no servidor:

- `POST /download-images` agora cria um job assíncrono e retorna `202` com `id`.
- `GET /download-images?id=<jobId>` retorna status do job.
- `POST /download-images?id=<jobId>&action=cancel` solicita cancelamento.
- `server.mjs` mantém `downloadJobs` em memoria.
- Cada job informa:
  - `status`
  - `total`
  - `completed`
  - `percent`
  - `currentFile`
  - `currentPercent`
  - `elapsedMs`
  - `currentElapsedMs`
  - `outputDirectory`
  - `downloaded`
  - `failed`
  - `canCancel`
- O download de cada arquivo passou a usar stream para contar bytes e calcular porcentagem quando `content-length` existe.
- `canCancel` fica ativo se:
  - o job total durar mais de 5 minutos; ou
  - o arquivo atual durar mais de 1 minuto.
- O cancelamento usa `AbortController` para interromper o download em andamento.

Implementacao no front:

- `index.html` ganhou `downloadModal`.
- A modal mostra:
  - porcentagem total;
  - barra de progresso;
  - contagem `concluidos de total`;
  - nome do arquivo atual;
  - porcentagem do arquivo atual quando disponivel;
  - pasta de destino.
- A modal bloqueia cliques nos botoes atras por estar em `modal-backdrop`.
- O botao `Cancelar` inicia desabilitado e so habilita quando o status do job retorna `canCancel: true`.
- O botao `Fechar` so habilita quando o job termina, falha ou e cancelado.

Validacoes:

- O servidor local foi reiniciado.
- Teste com o ID `1taR38keSBJgplwmZkX3NETXQSblhPYSh` criou job `running`, depois retornou `completed`.
- Durante o teste, `currentFile` mostrou `Lightning Bolt (Full Art B)`.
- Durante o teste, `currentPercent` chegou a reportar progresso parcial e terminou em `100`.
- O arquivo foi criado em `downloads/<timestamp>` com `11461394` bytes.
- `index.html` contem `downloadModal`, `downloadPercent`, `downloadCurrentFile`, `cancelDownload`, `closeDownloadModal`, `pollDownloadJob` e `currentPercent`.
- `server.mjs` contem `downloadJobs`, `publicJob`, `runDownloadJob`, rota de cancelamento e `canCancel`.

### Adicionar uploader de resultado a categorias

Por solicitacao do usuario, cada item de resultado de pesquisa passou a exibir um botao pequeno `Adicionar à categoria` ao lado do nome do uploader/fonte.

Implementacao:

- `index.html` ganhou o modal `addUploaderModal`.
- O modal mostra o uploader pendente e uma lista resumida de categorias.
- A lista permite selecionar mais de uma categoria.
- Categorias com mais de um uploader exibem refinamento de `activeUploaders` por checkbox.
- O modal permite criar uma nova categoria com:
  - `Nome`
  - `Pequena descrição`
- Ao criar a categoria, ela e salva em `config.json`, o modal retorna para a lista e a categoria nova aparece como opcao para adicionar o uploader.
- O salvamento adiciona o uploader em `uploaders` e atualiza `activeUploaders` conforme o refinamento marcado.
- `config.json` e `server.mjs` passaram a preservar `description` em cada categoria.
- `config.html` foi ajustado para preservar categorias adicionais e descricoes ao salvar os campos existentes.

Validacoes:

- `index.html` contem `Adicionar à categoria`, `addUploaderModal`, `saveUploaderToCategories`, `createNewCategory`, `newCategoryName`, `newCategoryDescription`, `category-select-list` e `escapeSelector`.
- Foi feito teste temporario via `/config` criando `Categoria Temporaria Teste` com descricao e uploader.
- A categoria temporaria foi retornada pelo servidor com descricao e `activeUploaders`.
- O `config.json` original foi restaurado em seguida.
- `OldFrame & Scan` permaneceu com 18 uploaders e 1 uploader ativo no estado atual do arquivo.

### Seleção múltipla no modal inicial e paginação de resultados

O usuario apontou que o modal de abertura ainda permitia selecionar apenas uma categoria. Isso foi corrigido.

Implementacao de categorias:

- `index.html` trocou `selectedCategory` por `selectedCategories`.
- O modal inicial agora permite marcar mais de uma categoria.
- Foi adicionado o botao `Usar categorias selecionadas`.
- A lateral mostra todas as categorias selecionadas, separadas por virgula.
- O filtro usa a uniao dos `activeUploaders` das categorias selecionadas.
- Se qualquer categoria selecionada nao tiver uploaders, como `Arte Livre`, o filtro de uploader e liberado e todos os resultados sao aceitos.
- Se uma categoria filtrada estiver selecionada mas sem uploaders ativos, nenhum uploader passa por essa categoria.

Implementacao de paginacao:

- A pesquisa agora guarda, por item pesquisado, a lista completa de IDs retornada pelo MPCFill.
- O dropdown `Resultados por carta` define o tamanho da pagina.
- Cada bloco de resultado possui pagina independente.
- Quando a lista original tem mais IDs do que o tamanho da pagina, aparecem botoes `Anterior` e `Proxima`.
- A troca de pagina busca os detalhes das cartas daquela fatia via `/2/cards/`, sem refazer a busca textual inteira.
- O bloco exibe a contagem de `resultado(s) no site original`.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro.
- `index.html` contem `selectedCategories`, `applyCategories`, `data-page-delta`, `loadBlockPage`, `changeBlockPage`, `resultado(s) no site original` e `Usar categorias selecionadas`.
- A versao servida em `http://localhost:8080/` tambem contem `applyCategories`, `data-page-delta` e `selectedCategories`.

### Feedback visual de seleção no modal inicial

O usuario apontou que o modal inicial nao mostrava feedback claro de selecao.

Implementacao:

- Cada categoria no modal inicial agora mostra uma checkbox visual.
- O card selecionado fica com fundo escuro (`#233245`) e texto claro.
- A checkbox e apenas visual dentro do botao do card, mantendo o clique no card inteiro como controle de selecao.
- Foi adicionada a estrutura `category-option-content` para manter texto e contador alinhados ao lado da checkbox.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro.
- A pagina servida em `http://localhost:8080/` contem `category-check`, `category-option-content`, `background: #233245` e `checked`.

### Posicao da paginacao dos resultados

Por solicitacao do usuario, os botoes de paginacao dos blocos de resultado foram movidos para baixo da quantidade de resultados.

Implementacao:

- Em `index.html`, o bloco `.pager` deixou de ser renderizado no topo/direita do cabecalho do resultado.
- O bloco `.pager` agora fica dentro da coluna do titulo, imediatamente abaixo de `resultado(s) no site original`.
- O CSS de `.pager` foi ajustado para alinhar os botoes a esquerda e adicionar margem superior.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro usando arquivo temporario para evitar limite de tamanho de argumento no Windows.
- Foi confirmado que `resultado(s) no site original` aparece antes de `<div class="pager">` no template de resultados.

### Correcao final da posicao da paginacao

O usuario esclareceu que os botoes nao deveriam ficar perto do nome da carta nem da contagem, mas sim ao fim da ultima linha de cartas daquele bloco de resultado.

Implementacao:

- Em `index.html`, o bloco `.pager` foi removido de dentro de `.query-head`.
- O bloco `.pager` passou a ser renderizado depois de `<div class="grid"></div>`, ou seja, apos a grade de cartas.
- O CSS de `.pager` foi ajustado para `justify-content: flex-end`, deixando os botoes no fim do bloco de resultados.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro.
- Foi confirmado que `<div class="grid"></div>` aparece antes de `<div class="pager">` no template de resultados.

### Correcoes de categorias, cards e modais longas

O usuario relatou tres problemas:

- categorias criadas pelo usuario nao exibiam o link `Configurar uploaders`;
- alguns resultados de pesquisa cortavam o botao `Escolher` na direita;
- a modal de adicionar uploader a categorias ficava alta demais e o botao de confirmacao saia da tela sem scroll utilizavel.

Implementacao:

- Em `index.html`, o botao `Configurar uploaders` deixou de ser exclusivo de `OldFrame & Scan` e agora aparece para qualquer categoria que tenha uploaders.
- O painel de checklist de uploaders agora usa `state.configuringCategoryName`, permitindo configurar qualquer categoria clicada.
- Os cards de resultado ficaram com largura minima maior na grade e botoes internos limitados a `max-width: 100%`; o botao `Escolher` usa `width: 100%`.
- A linha de fonte/uploader nos cards agora permite quebra e `overflow-wrap: anywhere`, reduzindo estouro com nomes longos.
- As modais ganharam `max-height` e `overflow: auto`; a lista de categorias da modal de adicionar uploader tambem ganhou altura maxima e scroll proprio.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro.
- `git status` mostrou `index.html` alterado por esta correcao e `config.json` ja modificado localmente antes; `config.json` nao foi editado nesta etapa.

### Colapso de grupos apos escolha de arte

Por solicitacao do usuario, ao escolher uma carta entre os resultados de um grupo de pesquisa, o grupo inteiro passa a recolher para economizar espaco e indicar conclusao.

Implementacao:

- Cada bloco em `state.resultBlocks` ganhou os campos `collapsed` e `selectedDocName`.
- Ao clicar em `Escolher`, `addSelection` recebe tambem o indice do bloco e marca somente aquele bloco como colapsado.
- O bloco colapsado mostra um resumo com o nome da arte selecionada, a pagina atual e um botao `Expandir resultados`.
- O botao de expandir apenas altera `collapsed` para `false` e chama `renderResults`, sem refazer busca e sem alterar `page`, `ids` ou `docs`.
- A escolha continua sendo registrada em `state.selections` e no XML normalmente.

Validacoes:

- O script embutido de `index.html` foi parseado com `new Function` sem erro.
- Foi confirmado no codigo que `block.page` e preservado no grupo colapsado e usado novamente ao expandir.

### Ampliacao de pesquisa por grupo de resultado

O usuario pediu um botao `Ampliar pesquisa?` ao lado do nome de cada grupo de resultado para escolher novas categorias de uploaders apenas para aquela secao.

Implementacao:

- `index.html` recebeu uma modal `blockCategoryModal` para escolher categorias por grupo.
- Cada bloco de resultado ganhou `categoryNames`, separado da selecao global.
- O filtro de fontes e documentos foi parametrizado por lista de categorias.
- O botao `Ampliar pesquisa?` foi adicionado no cabecalho do bloco aberto e tambem no bloco recolhido.
- Ao aplicar categorias no grupo, somente aquele bloco refaz a busca textual e recarrega sua pagina atual.

Validacao parcial:

- Foi confirmado por busca textual que `Ampliar pesquisa?`, `blockCategoryModal` e `query-title-row` existem em `index.html`.
- Foi confirmado que nao ha referencia restante a `defaultSearchSettings`.
- A primeira tentativa de parse via `node` falhou por limite de tamanho de argumento do Windows; refazer a validacao usando arquivo temporario.
- A validacao foi refeita com o script extraido para arquivo temporario e `new Function` passou sem erro.
- Foi confirmado que existem as funcoes `sourcesForCategories`, `searchSettingsForSources`, `openBlockCategoryModal` e `applyBlockCategories`.
- Foi confirmado que `categoryNames` e salvo por bloco e usado para filtrar os documentos daquele resultado especifico.
- `git status --short --branch` ao final mostrou `MEMORIA.md`, `index.html` e `config.json` modificados; `config.json` ja estava modificado localmente antes desta rodada e nao foi alterado nesta implementacao.

### Preparacao para novo push ao GitHub

O usuario pediu para subir o projeto no GitHub.

Checagem antes do commit:

- `git status --short --branch` mostrou a branch `main` rastreando `origin/main` e tres arquivos modificados: `MEMORIA.md`, `config.json`, `index.html`.
- `git diff --stat` mostrou 357 insercoes e 33 remocoes.
- `git diff -- config.json` mostrou alteracao na categoria `FullArt`, adicionando `j1va`, `Nelynes`, `PsilosX` e `JohnPrime` em `uploaders` e `activeUploaders`.
- Como o pedido foi subir o projeto atual, a intencao e incluir o estado atual dos tres arquivos no commit.
