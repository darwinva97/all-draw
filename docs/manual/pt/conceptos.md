# Conceitos

Este capítulo explica as ideias em que o all-draw se apoia, sem entrar em botões. Quando elas estiverem claras, o
resto do aplicativo faz sentido por si só. Para o “como fazer” passo a passo, vá para
[Modelo e visões](modelo-y-vistas.md) e [O editor](editor.md).

A ideia central cabe em uma frase: **você desenha um modelo uma vez e o enxerga por muitas notações**.

## Modelo e visões {#modelo-y-vistas}

**O que é.** O all-draw tem dois níveis:

- O **modelo** guarda *o que existe*: os **elementos** (um processo, uma aplicação, uma pessoa, uma tabela…) e
  as **relações** entre eles (a aplicação *serve* o processo, o processo *acessa* os dados…).
  Cada elemento tem um tipo, um nome, documentação, campos e etiquetas.
- As **visões** guardam *como ele é desenhado*. Uma visão é um diagrama: ela escolhe alguns elementos do modelo e os
  posiciona na tela. Cada desenho de um elemento em uma visão é uma **ocorrência** (um *nó*); cada desenho de uma
  relação é uma **aresta**.

![Um elemento do modelo e suas ocorrências em duas visões](../img/conceptos-modelo-vistas.en.svg)

**Por que existe.** Porque, na vida real, a mesma coisa aparece em muitos diagramas. Se o CRM aparece no mapa de
arquitetura, no diagrama de contêineres e na grade de capacidades, você quer que ele seja **o mesmo CRM**: para que,
ao renomeá-lo, ele mude em todo lugar, e para que você possa perguntar “onde o CRM aparece?”.

**O que isso significa na prática.**

| Você faz isto… | …e acontece isto |
|---|---|
| Renomeia um elemento em uma visão | Ele muda em todas as visões em que aparece |
| Edita os dados dele no inspetor | Você vê os mesmos dados a partir de qualquer visão |
| Move ou redimensiona um nó | Só aquela visão muda (a posição pertence à ocorrência) |
| Remove um nó de uma visão (**Del**) | O elemento continua no modelo e nas outras visões |
| Usa **Excluir do modelo** em um elemento | Ele desaparece de todas as visões, junto com as suas relações |
| Arrasta um elemento da aba **Modelo** da paleta | Ele aparece mais uma vez, nesta visão |

Uma relação funciona da mesma forma: existe uma vez no modelo e pode ser desenhada como aresta em várias visões, cada
uma com o seu próprio traçado e pontos de dobra.

> [!NOTE]
> Também há nós que **não** pertencem ao modelo: as notas, grupos, rótulos e imagens da aba **Visual** da
> paleta. Eles só existem na sua visão e não podem ser conectados com relações.

## Notações {#notaciones}

**O que é.** Uma **notação** é uma linguagem de diagramas: ArchiMate, BPMN, máquina de estados, C4, sequência,
entidade-relacionamento, classes UML, mapa mental, fluxograma, fluxo de dados (DFD), camadas × etapas e livre. No
all-draw, cada notação vem em um **pack** que define:

- os **tipos de elemento** (no BPMN: tarefa, evento de início, gateway…), com sua forma, cor e ícone;
- os **tipos de relação** (fluxo de sequência, fluxo de mensagem…);
- quais relações são válidas entre quais tipos (a [matriz de validade](conceptos.md#validez));
- os [viewpoints](conceptos.md#viewpoints) da notação;
- o que pode ficar dentro de quê (uma raia dentro de uma pool, um contêiner dentro de um sistema…).

**Por que existe.** Cada notação é boa para responder a uma pergunta: ArchiMate para a arquitetura corporativa, BPMN
para o passo a passo de um processo, estados para o ciclo de vida de algo. Em vez de escolher uma, o all-draw permite
usar todas sobre o mesmo modelo.

Cada visão tem **uma** notação, que define a sua paleta e como os nós são desenhados. Mesmo assim, você pode misturar: a
paleta oferece as outras notações, recolhidas, como “outra notação”. A lista completa e a referência de cada pack
estão em [Notações](notaciones.md).

## Dimensões {#dimensiones}

**O que é.** Uma **dimensão** é um eixo pelo qual você pode olhar *qualquer* elemento: “vê-lo como processo
BPMN”, “vê-lo na arquitetura”, “vê-lo como máquina de estados”. Tecnicamente, é só um nome, uma
notação e, opcionalmente, um viewpoint. A demo vem com seis: Arquitetura, Processo (BPMN),
Estados, C4, Camadas × etapas e Sequência.

![Um elemento visto em quatro dimensões](../img/conceptos-dimensiones.en.svg)

**Por que existe.** Para navegar. Com dimensões definidas, o menu de clique com o botão direito de qualquer nó oferece
**Abrir em outra dimensão**, com uma entrada por dimensão:

- Se o elemento já tem uma visão de detalhe naquela notação, ela é aberta.
- Se não tem, a entrada diz **(criar)** e cria uma visão nova naquela notação, dedicada a esse elemento.

Assim, a partir do processo “Cadastro de cliente” você chega ao BPMN, aos estados ou à sequência dele com um clique, sem
procurar na lista de visões.

> [!TIP]
> Sem dimensões, o menu **Abrir em outra dimensão** fica vazio. Adicione-as no painel **Visões → Dimensões**
> (veja [Modelo e visões](modelo-y-vistas.md#dimensiones)).

## Visões de detalhe e drill-down {#drill-down}

**O que é.** Uma visão pode ser **dedicada a um elemento**: esse elemento é o seu **elemento raiz**. A visão BPMN
“Cadastro de cliente · BPMN” tem como raiz o processo “Cadastro de cliente”: ela é *o detalhe dele*. No painel Visões,
as visões com raiz têm um pequeno losango (◇) na frente.

Além disso, cada ocorrência (nó) pode apontar para uma visão específica como a sua **visão ao clicar duas vezes**.
**Clicar duas vezes** nesse nó leva você para dentro: esse é o *drill-down* (descer ao detalhe).

**Por que existe.** Para ir do geral ao específico sem se perder. Ao entrar em um detalhe, a
barra de ferramentas mostra o **caminho de visões** (por exemplo, *Arquitetura › Cadastro de cliente · BPMN*) e o botão
**voltar** (←) para retornar. Você pode encadear níveis: arquitetura → processo → estados.

Quando você cria uma visão com **Abrir em outra dimensão → … (criar)** ou **Nova visão de detalhe…**, o all-draw faz
as duas coisas de uma vez: a nova visão recebe aquele elemento como raiz, e o nó a partir do qual você a criou aponta
para ela no clique duplo (a menos que já apontasse para outra).

## Pinos {#pines}

**O que é.** Um **pino** é um valor específico de um elemento exposto como **ponto de conexão** na borda da
sua caixa (um quadradinho laranja). Os pinos permitem dizer não só “este serviço conversa com aquele”, mas “**este
dado** deste serviço vai para **aquele campo** daquele outro”.

Os pinos surgem automaticamente dos **campos** do elemento:

- Um campo **JSON** gera um pino por valor final. Se a resposta de um serviço é
  `{"cliente": {"id": "c-1", "email": "ana@acme.com"}}`, você obtém os pinos `cliente.id` e `cliente.email`.
- Um campo **lista** gera um pino por entrada, e um campo **chave→valor**, um pino por chave.
- Qualquer outro campo pode gerar um pino se a sua definição pedir. Os pinos também podem ser declarados à mão.

![Dois componentes conectados por pinos, com um mapeamento de campos](../img/conceptos-pines.en.svg)

Quando você conecta um pino a outro, a relação também guarda um **mapeamento**: qual campo de origem vai para qual
campo de destino (`response.cliente.email → request.destinatario`). A aresta o mostra com um rótulo como
`email ⇄`, e o inspetor da relação lista os mapeamentos.

**Por que existe.** Para documentar integrações com precisão: quais dados trafegam entre sistemas e de qual
campo para qual campo. Na demo, o microsserviço `clientes-api` envia `cliente.email` para o campo `destinatario`
(destinatário) de `notificacoes`.

Em cada nó você escolhe quais pinos são exibidos (inspetor, aba **Pinos**): um serviço com uma resposta grande pode
ter dezenas, e normalmente só alguns interessam. Os pinos já usados por uma relação são marcados com ● e
não podem ser ocultados. Ao conectar dois pinos, só são oferecidas as relações compatíveis com eles.

## Rastros e relações ponte {#trazas}

**O que é.** Às vezes o mesmo conceito é modelado **duas vezes, em duas notações**: a tarefa BPMN “Verificar
identidade” e o serviço ArchiMate “Verificação KYC” falam da
mesma coisa em níveis diferentes. As **relações ponte** registram essa correspondência. Elas são relações do núcleo,
válidas entre quaisquer notações:

| Relação | Linha | Significado |
|---|---|---|
| **Rastreia** | tracejada, ponta aberta | “É o mesmo que” / “corresponde a” (a mais geral) |
| **Realiza** | tracejada, ponta triangular | “Implementa”: uma tarefa BPMN realiza um processo ArchiMate; um contêiner C4 realiza um componente de aplicação |
| **Refina** | pontilhada, ponta aberta | “Detalha”: um estado refina um objeto de negócio |

![Rastros entre tarefas BPMN e elementos ArchiMate, com uma lacuna sem rastro](../img/conceptos-trazas.en.svg)

**Por que existe.** Para a **rastreabilidade**: poder responder “quais tarefas do processo usam este serviço?” ou
“quais elementos do BPMN não estão conectados à arquitetura?”. A segunda pergunta é a **cobertura**: a proporção de
elementos de uma notação que têm pelo menos um rastro para outra notação. Os que não têm nenhum são **lacunas**.

O all-draw ajuda você a criar rastros **sugerindo** pares: elementos de outra notação com o mesmo nome,
que aparecem na visão de detalhe do outro, que compartilham palavras ou cujos tipos costumam se corresponder. As
sugestões aparecem:

- no menu de clique com o botão direito do nó, seção **Rastros** (“Vincular a …”);
- na aba **Onde** do inspetor, seções **Rastros** e **Sugestões**;
- no painel **Espaço → Rastreabilidade**: uma matriz entre duas notações, a cobertura, as lacunas e um botão para
  vincular várias sugestões de uma vez (veja [Bibliotecas, regras e pessoas](librerias-reglas-personas.md)).

O painel de problemas também adiciona uma nota para cada elemento sem rastro, com um botão para criar a melhor
sugestão.

> [!NOTE]
> A cobertura só faz sentido se o espaço misturar pelo menos duas notações. Com apenas uma, não há lacunas
> para mostrar.

## Viewpoints {#viewpoints}

**O que é.** Um **viewpoint** é um subconjunto de uma notação voltado para um público ou uma pergunta. O C4 tem um por
nível (*Contexto*, *Contêiner*, *Componente*, *Código*, *Implantação*); o ArchiMate traz 25 (*Layered*,
*Business Process Cooperation*…); o BPMN tem *Processo* e *Coreografia*.

Cada visão pode ter um viewpoint (escolhido no inspetor da visão). Quando tem, a paleta **esmaece** os tipos
que não pertencem a ele e os move para o final.

![A paleta com um viewpoint: tipos normais e tipos esmaecidos](../img/conceptos-viewpoint.en.svg)

**Por que existe.** Para orientar você sem prendê-lo. Em uma visão C4 de *Contexto*, normalmente se desenham pessoas e
sistemas, não contêineres; o viewpoint lembra você disso, mas **não proíbe**. Se você usar um tipo esmaecido,
o painel de problemas mostra um **aviso** (o elemento não pertence ao viewpoint da visão) com a opção
de removê-lo da visão. A decisão é sua.

Alguns viewpoints (como o *Layered* do ArchiMate) aceitam todos os tipos, então não esmaecem nada.

## Matriz de validade {#validez}

**O que é.** Cada notação com regras formais traz uma **matriz de validade**: para cada par de tipos (origem,
destino), quais relações são permitidas. No ArchiMate, por exemplo, um componente de aplicação pode *servir* um
processo de negócio, mas não pode *compô-lo*. A matriz do ArchiMate vem diretamente da especificação (a mesma
que o Archi usa).

**Por que existe.** Para que o modelo fique correto sem que você precise saber a especificação de cor.

**Como você percebe isso ao desenhar.** Quando você solta uma conexão entre dois nós, o menu **Tipo de relação**
aparece com as opções possíveis:

- Entre dois elementos da **mesma notação**: as relações que a matriz permite para esses dois tipos (a
  habitual da notação aparece primeiro), mais as relações gerais do núcleo (**Vínculo**, **Rastreia**, **Realiza**,
  **Refina**, **Fluxo de dados**), que estão sempre disponíveis.
- Entre elementos de **notações diferentes**: só as relações do núcleo.
- Entre dois **pinos**: só as relações compatíveis com esses pinos.
- Com uma nota, grupo, rótulo ou imagem: a conexão é **recusada**, porque eles não são elementos do modelo.

A notação **Livre** não tem matriz: ela aceita qualquer relação entre qualquer par.

**Relações que se tornam inválidas.** Se você importar um modelo de outra ferramenta ou mudar tipos, pode sobrar
alguma relação que a matriz não permite. O painel de problemas a marca como **erro** (a relação não é
válida entre esses dois tipos) e oferece correções: trocá-la por uma relação válida ou excluí-la.

## Espaços {#espacios}

**O que é.** Um **espaço de trabalho** é um projeto completo: o modelo, todas as suas visões, as dimensões, as
bibliotecas de tipos, as regras de estilo, as pessoas e os comentários. Tudo no all-draw fica dentro de um espaço, e
os elementos de um espaço não são visíveis a partir de outro.

Há dois tipos:

- **Local**: fica só no seu navegador. Não precisa de conta e sempre funciona offline, mas não pode ser
  compartilhado nem copiado para outro computador.
- **No servidor**: fica no servidor, com uma cópia no seu navegador. Pode ser compartilhado com links de edição ou de
  somente leitura, várias pessoas podem editá-lo ao mesmo tempo, ele mantém histórico e funciona offline
  (sincroniza quando a conexão volta).

Um espaço local pode ser **enviado ao servidor** a qualquer momento (uma cópia é criada). Os detalhes práticos estão
em [Primeiros passos](primeros-pasos.md#espacios-locales-y-servidor) e em
[Compartilhar e colaborar](compartir-y-colaborar.md).

## Resumo {#resumen}

| Conceito | Em uma frase | Onde você o vê |
|---|---|---|
| Elemento | Uma coisa que existe no modelo, uma única vez | Inspetor (aba **Dados**), paleta → **Modelo** |
| Relação | Um vínculo com tipo entre dois elementos | Inspetor de uma aresta |
| Visão | Um diagrama em uma notação | Painel **Visões** |
| Ocorrência (nó) | Um elemento desenhado em uma visão | A tela; inspetor → **Onde** |
| Notação | Uma linguagem de diagramas (pack de tipos e regras) | Paleta → **Notação**; [Notações](notaciones.md) |
| Dimensão | Um eixo para ver qualquer elemento em uma notação | Painel **Visões → Dimensões**; botão direito → **Abrir em outra dimensão** |
| Elemento raiz / visão de detalhe | A visão dedicada a um elemento | Inspetor da visão; ◇ no painel Visões; clique duplo no nó |
| Pino | Um valor de um elemento utilizável como ponto de conexão | Inspetor → **Pinos**; quadradinhos na borda do nó |
| Mapeamento | Qual campo vai para qual campo em uma relação entre pinos | Inspetor da relação; rótulo `⇄` na aresta |
| Rastro | Liga o mesmo conceito em duas notações | Inspetor → **Onde**; **Espaço → Rastreabilidade** |
| Viewpoint | Um subconjunto de uma notação; esmaece, não proíbe | Inspetor da visão; paleta esmaecida |
| Matriz de validade | Quais relações a notação permite entre dois tipos | Menu **Tipo de relação**; painel de problemas |
| Espaço | O projeto inteiro, local ou no servidor | Tela de início |

## Confusões comuns {#confusiones-habituales}

**“Excluí uma caixa e o elemento continua aparecendo na paleta.”**
**Del** remove a ocorrência *desta* visão, não o elemento. Para excluí-lo de todo lugar: botão direito →
**Excluir do modelo**. Veja [Modelo e visões](modelo-y-vistas.md#quitar-o-borrar).

**“Copiei e colei uma caixa, renomeei e as duas mudaram.”**
**Ctrl+V** cola uma *nova ocorrência do mesmo elemento*. Se você queria um elemento diferente, use
**Ctrl+Shift+V** (colar como cópia) ou **Ctrl+D** (duplicar).

**“Abrir em outra dimensão não mostra nada.”**
O espaço não tem dimensões. Adicione-as em **Visões → Dimensões**.

**“A relação que eu quero não está no menu.”**
A matriz da notação não a permite entre esses dois tipos. Confira se os tipos são os que você imagina, ou use uma
relação do núcleo (**Vínculo**, **Rastreia**…) se quiser apenas registrar a conexão.

**“Usei um tipo esmaecido e recebi um aviso.”**
É o viewpoint da visão. Você pode ignorar o aviso, remover o nó ou definir o viewpoint da visão como
*(nenhum: tudo)*.
