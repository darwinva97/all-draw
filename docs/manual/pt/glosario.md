# Glossário

As palavras que o all-draw usa, explicadas em poucas linhas. Estão agrupadas por tema; use a busca
da documentação se estiver procurando uma específica.

## Espaços e modelo {#grupo-espacios-y-modelo}

### Espaço de trabalho {#espacio}

O documento com o qual você trabalha: contém o modelo, todas as suas visões, bibliotecas, regras, pessoas e comentários.
Pode ser **local** (fica no seu navegador) ou **do servidor** (salvo no servidor e
compartilhável). Veja [espaços](conceptos.md#espacios).

### Espaço local {#espacio-local}

Espaço salvo somente neste navegador, sem conta. Ninguém mais o vê e ele não tem
histórico; para não perdê-lo, exporte um `.alldraw.json` de vez em quando. Veja
[primeiros passos](primeros-pasos.md).

### Espaço do servidor {#espacio-del-servidor}

Espaço salvo no servidor com a sua conta. Pode ser compartilhado, sincroniza ao vivo e tem
[histórico](historial.md).

### Modelo {#modelo}

O conjunto de *coisas* que você descreve (elementos) e como elas se relacionam (relações), independentemente de como
são desenhadas. Um mesmo modelo pode ser mostrado em muitas visões. Veja
[modelo e visões](conceptos.md#modelo-y-vistas).

### Elemento {#elemento}

Uma coisa do modelo: um processo, um aplicativo, um estado, uma tabela… Tem tipo, nome,
documentação e campos. Renomeá-lo em uma visão o renomeia em todas.

### Relação {#relacion}

Um vínculo com tipo entre dois elementos do modelo (“serve a”, “flui para”, “realiza”…). Existe uma única vez no
modelo, mesmo que seja desenhado em várias visões.

### Tipo {#tipo}

A espécie de um elemento ou relação dentro de uma notação (por exemplo *Business Process* no
ArchiMate ou *Tarefa* no BPMN). Define sua forma, sua cor, seus campos e com o que ele pode se conectar.

### Categoria {#categoria}

Um agrupamento de tipos na paleta (por exemplo *Atividades* ou *Eventos* no BPMN). Serve apenas
para organizar a paleta.

### Campo {#campo}

Um dado com nome de um elemento (por exemplo “responsável” ou “request”). Os campos são definidos pelo
tipo ou por uma biblioteca; você também pode adicionar propriedades livres. Alguns campos geram pinos.

### Relação implícita {#relacion-implicita}

A relação que o all-draw cria por você quando você coloca um nó dentro de outro, se a notação
propõe uma (por exemplo, composição no ArchiMate). Assim, aninhar não é só um desenho: fica
registrado no modelo.

## Visões e tela {#grupo-vistas}

### Visão {#vista}

Um diagrama específico do espaço, com uma notação. Mostra uma parte do modelo, organizada como você
preferir. Um espaço pode ter quantas visões você quiser.

### Nó (ocorrência) {#nodo}

O desenho de um elemento em uma visão: posição, tamanho, estilo. Um mesmo elemento pode ter várias
ocorrências em visões diferentes. **Remover desta visão** exclui a ocorrência, não o elemento.

### Aresta {#arista}

O desenho de uma relação em uma visão: a linha com seus pontos de dobra e seu estilo. Excluir uma aresta
de uma visão não exclui a relação do modelo se ela estiver desenhada em outras visões.

### Contêiner {#contenedor}

Um nó que pode conter outros dentro dele (uma pool do BPMN, um grupo, um sistema no C4). Quando você coloca um nó
dentro, ele fica **aninhado**.

### Aninhamento {#anidamiento}

Colocar um nó dentro de outro. A notação decide o que pode ficar dentro do quê e, às vezes, cria
uma [relação implícita](#relacion-implicita). Veja [editor](editor.md).

### Ponto de dobra {#punto-de-quiebre}

Um canto em uma linha. Clicar duas vezes na linha adiciona um, arrastá-lo o move e clicar duas vezes nele
o remove.

### Roteamento {#enrutado}

Como o caminho de uma linha entre dois nós é traçado: **Ortogonal** (em ângulo reto), **Curva** ou
**Reta**. Você escolhe no inspetor da aresta, campo **Traçado**.

### Layout automático {#layout-automatico}

Um botão que reorganiza os nós da visão atual de forma ordenada, de acordo com a notação. Pode ser
desfeito com Ctrl+Z.

### Grade de camadas × etapas {#rejilla}

Um tipo de visão em forma de tabela: as linhas são **camadas** e as colunas são **etapas**, e cada nó fica em
uma célula. Útil para mapas de processos ou de arquitetura por fase. Veja
[notação de grade](notaciones/grid.md).

### Camada {#capa}

Uma linha da grade de camadas × etapas (por exemplo “Negócio”, “Aplicação”, “Tecnologia”).

### Etapa {#etapa}

Uma coluna da grade de camadas × etapas (por exemplo “Solicitação”, “Validação”, “Cadastro”). Várias
etapas podem ser agrupadas em faixas.

## Notações e dimensões {#grupo-notaciones}

### Notação {#notacion}

A linguagem de diagrama de uma visão: ArchiMate, BPMN, C4, máquina de estados, entidade-relacionamento… Define
a paleta, as formas e quais conexões são válidas. Veja [notações](notaciones.md).

### Pack {#pack}

O pacote que implementa uma notação dentro do all-draw: seus tipos, relações, matriz de validade,
viewpoints e formas. Na prática, “pack” e “notação” são usados quase como sinônimos.

### Dimensão {#dimension}

Uma forma de olhar o mesmo elemento a partir de outra notação: o processo “Cadastro de cliente”
no ArchiMate, no BPMN e como máquina de estados são três dimensões do mesmo elemento. Veja
[dimensões](conceptos.md#dimensiones).

### Viewpoint {#viewpoint}

Um enfoque dentro de uma notação que destaca os tipos relevantes para uma pergunta específica (por exemplo
*Contexto* no C4). Atenua o restante da paleta, mas não o proíbe. Veja
[viewpoints](conceptos.md#viewpoints).

### Visão de detalhe {#vista-de-detalle}

Uma visão que explica o interior de um elemento específico (seu **elemento raiz**). Por exemplo, a
visão BPMN que detalha o processo “Cadastro de cliente”.

### Elemento raiz {#elemento-raiz}

O elemento que uma visão de detalhe descreve. Você o escolhe no inspetor da visão.

### Drill-down {#drill-down}

Entrar de um nó na sua visão de detalhe e, de lá, em outra, cada vez mais fundo. Veja
[drill-down](conceptos.md#drill-down).

### Caminho de visões {#ruta}

A trilha de navegação (*breadcrumb*) da barra de ferramentas que mostra por quais visões você desceu. Clique em qualquer uma
para voltar a ela, ou na seta ← para voltar à anterior.

### Matriz de validade {#matriz-de-validez}

A tabela de cada notação que diz qual tipo de relação é permitido entre quais tipos de elemento. É
por isso que o editor não deixa você conectar duas coisas que a notação não permite. Veja
[validade](conceptos.md#validez).

### Figura ArchiMate {#figura-archimate}

A forma alternativa de um elemento ArchiMate (por exemplo, o cilindro de um objeto de dados ou o
boneco de palitos de um ator), em vez do retângulo com ícone. Você a escolhe no inspetor.
Veja [ArchiMate](notaciones/archimate.md).

### Catálogo de diagramas {#catalogo}

Uma lista de mais de 160 tipos de diagrama comuns em organizações de TI (mapa de capacidades, mapa de fluxo de valor,
arquitetura de aplicações…) que diz com qual notação do all-draw cada um é desenhado. Ajuda a
escolher o tipo de diagrama ao criar uma visão. Veja [notações](notaciones.md).

## Pinos, rastros e verificações {#grupo-pines-y-trazas}

### Pino {#pin}

Um ponto de conexão de um nó que corresponde a um dos campos do elemento (por exemplo, cada campo da
requisição de uma API). Permite conectar campo a campo. Veja [pinos](conceptos.md#pines).

### Mapeamento {#mapeo}

Em uma relação entre pinos, a correspondência entre um campo de origem e um campo de destino (por
exemplo, “customer.id → application.document”).

### Rastro {#traza}

Uma relação que liga elementos de níveis ou notações diferentes para dizer que um corresponde ao
outro (por exemplo, um processo de negócio e o aplicativo que o suporta). Veja
[rastros](conceptos.md#trazas).

### Realiza {#realiza}

Um rastro que diz que um elemento *torna real* outro mais abstrato (um aplicativo realiza um
serviço).

### Refina {#refina}

Um rastro que diz que um elemento é uma versão *mais detalhada* de outro (um subprocesso refina um
processo).

### Cobertura de rastros {#cobertura-de-trazas}

Quantos elementos de um nível têm seu rastro para o outro nível. Os que não têm aparecem como
lacunas no painel de rastreabilidade e no painel de problemas.

### Validador {#validador}

Uma verificação automática que revisa o espaço (relações inválidas, elementos não usados, regras do BPMN,
sobreposições no desenho, rastros que faltam…) e coloca os resultados no painel de problemas.

### Diagnóstico {#diagnostico}

Cada item do painel de problemas: um erro, um aviso ou uma nota, com o elemento afetado e uma
explicação.

### Correção {#arreglo}

A correção que um diagnóstico propõe e que você pode aplicar com um clique (por exemplo, excluir
um elemento que não é usado em nenhuma visão).

## Bibliotecas, regras e pessoas {#grupo-librerias}

### Biblioteca {#libreria}

Um conjunto próprio de tipos (com seus campos e pinos) e componentes reutilizáveis, para modelar o que as
notações padrão não incluem. Veja [bibliotecas, regras e pessoas](librerias-reglas-personas.md).

### Componente (template) {#componente}

Um elemento de biblioteca pronto para ser reutilizado: arrastá-lo para a tela cria uma instância com seus
campos já preenchidos.

### Instância {#instancia}

Um elemento criado a partir de um componente. Quando você altera o componente, as alterações são propagadas para
as suas instâncias.

### Regra {#regla}

Uma condição mais um estilo: “se o campo *status* for *obsoleto*, pinte o nó de cinza”. Muda
a aparência, não o modelo.

### Pessoa {#persona}

Alguém que você cadastra no espaço (nome, e-mail, equipe) para atribuir responsabilidades ou mencionar em
comentários. Não é uma conta do servidor.

### Atribuição {#asignacion}

O vínculo entre uma pessoa e algo do espaço (um elemento, uma visão, uma camada, uma etapa, um
tipo ou uma relação) com um papel, por exemplo “responsável”.

## Colaboração {#grupo-colaboracion}

### Comentário {#comentario}

Uma mensagem ancorada a um elemento, nó, linha, ponto da tela ou visão. Veja
[comentários](comentarios.md).

### Conversa {#hilo}

Um comentário e suas respostas. É resolvida ou reaberta como um todo.

### Menção {#mencion}

Escrever `@Nome` em um comentário para se referir a uma pessoa do espaço. Fica destacada, mas não envia
aviso.

### Snapshot {#instantanea}

Uma cópia completa de um espaço do servidor em um dado momento, para a qual você pode voltar. Veja
[histórico](historial.md).

### Link compartilhado {#enlace-compartido}

Um endereço que dá acesso a um espaço do servidor, para edição ou somente leitura, sem precisar de conta.
Pode ser revogado a qualquer momento. Veja [convidar](compartir-y-colaborar.md#invitar).

### Papel {#rol}

O que você pode fazer em um espaço do servidor: **proprietário** (tudo, inclusive compartilhar e excluir),
**pode editar** ou **somente leitura** (só ver). Na API, eles se chamam `owner`, `editor` e `viewer`. Veja
[compartilhar e colaborar](compartir-y-colaborar.md).

### Presença {#presencia}

Os avatares e cursores das outras pessoas conectadas ao mesmo espaço, ao vivo.

### Sincronização (CRDT) {#sincronizacion}

A técnica que o all-draw usa para combinar as alterações de várias pessoas, ou as feitas sem conexão,
sem bloqueios nem conflitos: todas as cópias acabam iguais. CRDT é o nome técnico desse tipo de
estrutura de dados.

### Modo offline {#sin-conexion}

Continuar trabalhando quando a rede cai. Os espaços locais não precisam de rede; em um espaço do servidor
que você já tem aberto, você continua editando sobre uma cópia no navegador, que sincroniza quando a conexão
volta. Veja [sem conexão](compartir-y-colaborar.md#sin-conexion).

### PWA {#pwa}

*Progressive Web App*: o all-draw pode ser instalado a partir do navegador como se fosse um aplicativo, e
inicia mesmo sem rede.

## Importação, exportação e automação {#grupo-importar-exportar}

### JSON do all-draw {#json-de-all-draw}

O formato próprio do all-draw (`.alldraw.json`): guarda o espaço inteiro, sem perdas. É o
melhor backup. Veja [formatos](importar-exportar.md#formatos).

### Exportação dupla {#exportacion-dual}

Um SVG que aparece no tema claro ou escuro conforme a preferência de quem o vê, em um único arquivo.

### HTML autocontido {#html-autocontenido}

Um único arquivo `.html` com todas as visões, navegável sem conexão e sem instalar nada. Útil para
enviar o diagrama a quem não usa o all-draw.

### Chave de API {#clave-api}

Uma senha longa para programas e agentes, que age com as suas permissões. Você a cria e revoga
em **Conta**. Veja [chaves](agentes-y-api.md#claves).

### MCP {#mcp}

*Model Context Protocol*: o protocolo que um assistente de IA usa para ler e editar seus espaços por meio de
ferramentas do all-draw. Veja [MCP](agentes-y-api.md#mcp).
