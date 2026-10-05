# Primeiros passos

O all-draw é uma ferramenta de diagramação em que você desenha **um único modelo** e o enxerga por **muitas notações**:
ArchiMate, BPMN, máquina de estados, C4, sequência, entidade-relacionamento, UML, mapa mental e mais. Um elemento
(“Cadastro de cliente”, o processo de cadastro de um cliente) existe uma só vez e pode aparecer em quantas visões você quiser; se você o
renomear em uma, ele muda em todas. Funciona no navegador, sem instalar nada, em
[alldraw.bezenti.com](https://alldraw.bezenti.com).

> [!TIP]
> Está com pressa? Vá direto para [Seu primeiro diagrama em 5 minutos](primeros-pasos.md#primer-diagrama). Quer
> entender a ideia antes de desenhar? Leia [Conceitos](conceptos.md).

## O que é o all-draw {#que-es}

A maioria das ferramentas trata cada diagrama como um desenho isolado: se a mesma aplicação aparece no diagrama de
arquitetura e no diagrama de processos, são duas caixas diferentes que você precisa manter sincronizadas à mão. O
all-draw tem duas camadas:

- O **modelo**: as coisas que existem (processos, aplicações, pessoas, dados…) e como se relacionam.
- As **visões**: os diagramas. Cada visão desenha uma parte do modelo em uma notação específica.

É isso que permite saltar de um processo de negócio para o seu detalhe em BPMN, de lá para a máquina de estados do
processo do cliente, e verificar quais peças não estão conectadas entre os níveis. Tudo isso é explicado com desenhos em
[Conceitos](conceptos.md).

## A tela de início {#pantalla-de-inicio}

![Tela de início do all-draw](../img/01-inicio-en.png)

Ao abrir o aplicativo, você vê uma breve apresentação, três botões e, abaixo deles, os seus espaços de trabalho:

| Botão | O que faz |
|---|---|
| **Novo espaço** | Cria um espaço vazio e o abre no editor. Quando você está conectado, ele se chama **Novo espaço no servidor**. |
| **Abrir a demo** | Cria uma cópia do espaço de exemplo “Cadastro de cliente” (veja [a demo](primeros-pasos.md#demo)). Pode mexer à vontade: ele é seu. |
| **Importar…** | Cria um espaço a partir de um arquivo: `.drawer`, `.alldraw.json`, `.archimate` (Archi), Open Exchange, BPMN 2.0 XML, Structurizr, XState, Mermaid ou OpenAPI. Veja [Importar e exportar](importar-exportar.md). |

Na mesma linha, à direita, aparece **Entrar / cadastrar-se** se o servidor de contas estiver disponível. Na primeira
vez, enquanto você não tiver nenhum espaço nem estiver conectado, você verá a página inicial do all-draw em vez da tela
de início; lá, o botão para entrar se chama **Entrar**. O **seletor de idioma** fica na parte superior da tela.

Um **espaço de trabalho** é a unidade de trabalho: ele contém o modelo, todas as suas visões, as bibliotecas, as regras
de estilo e as pessoas. Cada espaço abre no seu próprio endereço web, então você pode salvá-lo nos favoritos.

A lista de espaços tem duas seções:

- **No servidor**: só aparece quando você está conectado. Lista cada espaço com o seu papel (**proprietário**,
  **pode editar** ou **somente leitura**) e a data da última alteração. O proprietário vê um botão **Excluir**.
- **Neste navegador**: os espaços locais. Cada um tem **Excluir** e, quando você está conectado,
  **Enviar ao servidor**.

Clique no nome (ou em qualquer parte da linha) para abrir um espaço.

## Espaços locais e espaços no servidor {#espacios-locales-y-servidor}

O all-draw funciona sem conta. O que você cria sem entrar é **local**: fica no armazenamento do seu navegador. Com uma
conta, você pode manter espaços **no servidor** e compartilhá-los.

| | Espaço local | Espaço no servidor |
|---|---|---|
| Onde fica | **Neste navegador** (neste computador) | No servidor, com uma cópia no seu navegador |
| Endereço | `…/#/w/<id>` | `…/#/s/<id>` |
| Precisa de conta | Não | Sim (ou de um link compartilhado) |
| Funciona offline | Sempre | Sim: salva localmente e sincroniza quando a conexão volta |
| Pode ser compartilhado | Não (primeiro é preciso enviá-lo para o servidor) | Sim: links de edição e de leitura, edição simultânea |
| Histórico de versões | Não | Sim (veja [Histórico](historial.md)) |
| É perdido se… | Você limpar os dados do navegador ou trocar de computador | O proprietário o excluir |

> [!WARNING]
> Um espaço local **não** é copiado para lugar nenhum automaticamente. Se você limpar os dados de navegação, usar uma
> janela anônima ou trocar de computador, não o verá. Para mantê-lo seguro, envie-o para o servidor ou exporte-o para um
> arquivo `.alldraw.json` (veja [Importar e exportar](importar-exportar.md)).

Para levar um espaço local ao servidor: entre e pressione **Enviar ao servidor**, na lista da tela de início ou na
barra de ferramentas do editor. Uma **cópia** é criada no servidor e aberta; o espaço local continua existindo até você
excluí-lo.

Mais detalhes em [Conceitos → Espaços](conceptos.md#espacios).

## Criar uma conta {#crear-cuenta}

Você precisa de uma conta para manter espaços no servidor, compartilhá-los, ver o histórico deles e criar chaves para
agentes.

1. Na tela de início, pressione **Entrar / cadastrar-se** (no canto superior direito; na página inicial ele se chama **Entrar**).
2. No diálogo, pressione **Não tenho conta**. O título muda para **Criar conta**.
3. Preencha **E-mail**, **Nome** e **Senha** (no mínimo 8 caracteres).
4. Se o servidor pedir um **Código de convite**, digite-o (quem administra o servidor é quem o fornece).
5. Pressione **Cadastrar-me**. O diálogo se fecha e você já está conectado.

![Diálogo de entrar ou criar conta](../img/02-entrar-en.png)

Para **entrar** com uma conta que você já tem: **Entrar / cadastrar-se**, digite seu e-mail e sua senha e pressione
**Entrar**. O link **Já tenho conta** leva do cadastro de volta para a entrada.

Depois de entrar:

- O primeiro botão passa a ser **Novo espaço no servidor**, e **Abrir a demo** cria a demo no
  servidor.
- Aparece a seção **No servidor**.
- No canto superior direito você vê o seu nome. Ao clicar nele, abre-se o menu da conta, com **Conta e chaves de API** e
  **Sair**.

**Conta e chaves de API** abre a tela **Conta**, onde você pode criar chaves para agentes (veja
[Agentes e API](agentes-y-api.md)), **Alterar senha**, ver suas **Sessões ativas** e encerrar as que não
reconhecer, e **Sair de todas as sessões**. Se você for administrador, a lista **Usuários do servidor**
também está ali.

Ao lado do seu nome fica o **sino** de notificações: ele avisa quando alguém menciona você em um
comentário, compartilha um espaço com você, muda o seu papel ou restaura uma versão de um dos seus espaços
(veja [notificações](compartir-y-colaborar.md#notificaciones)). Se o servidor envia e-mails, ao se cadastrar
você recebe um link para **confirmar seu e-mail** (veja [confirmar o e-mail](compartir-y-colaborar.md#verificar-correo)).

A sessão dura 30 dias e se renova sozinha enquanto você usa o aplicativo. O primeiro usuário a se cadastrar em um
servidor se torna o administrador dele.

> [!NOTE]
> Cada servidor decide se o cadastro é **aberto**, **somente com convite** ou **fechado**. Se estiver fechado, o
> diálogo informa isso (“O cadastro está fechado neste servidor.”) e o botão **Cadastrar-me** fica desativado: peça
> uma conta a quem administra o servidor.

## Seu primeiro diagrama em 5 minutos {#primer-diagrama}

Vamos desenhar um processo BPMN bem pequeno: *Pedido recebido → Preparar pedido → Pedido enviado*.

1. Na tela de início, pressione **Novo espaço**. O editor se abre com um espaço vazio.
2. No topo, clique no nome “Novo espaço” e digite o seu, por exemplo *Loja*.
3. No painel **Visões** (coluna da esquerda), pressione o botão **+** e escolha **BPMN 2.0**. A visão
   “Nova visão BPMN 2.0” é criada e aberta.
4. Clique em uma área vazia da tela: o **inspetor** (coluna da direita) mostra a visão. Renomeie-a para
   *Processo de pedido*.
5. Na **paleta** (abaixo de Visões), aba **Notação**, encontre **Evento de início** e **arraste-o** para a tela.
6. Com o novo nó selecionado, pressione **F2**, digite *Pedido recebido* e pressione **Enter**.
7. Repita com uma **Tarefa** (*Preparar pedido*) e um **Evento de fim** (*Pedido enviado*), da esquerda para a direita.
   Você pode usar o campo **Buscar…** da paleta para encontrá-los mais rápido.
8. Conecte-os: leve o mouse até a **borda inferior** de *Pedido recebido* até ver o ponto de conexão,
   arraste até *Preparar pedido* e solte. No menu **Tipo de relação**, escolha **Fluxo de sequência** (é o primeiro
   da lista). Faça o mesmo de *Preparar pedido* para *Pedido enviado*.
9. Observe a barra na parte inferior da tela: é o **painel de problemas**. Se algo violar as regras do BPMN,
   ele avisará ali.
10. Pronto. Não há nada para salvar: o indicador de status na barra de ferramentas diz `salvo neste navegador`.

> [!TIP]
> Errou? **Ctrl+Z** desfaz e **Ctrl+Y** refaz (no Mac, **Cmd+Z** e **Cmd+Y**). Todos os
> atalhos estão em [Atalhos](atajos.md).

Próximo passo: selecione *Preparar pedido* e observe o inspetor (abas **Dados**, **Pinos**, **Onde**, **Estilo**).
Depois, experimente criar outra visão e arrastar *Preparar pedido* a partir da aba **Modelo** da paleta: você verá o
mesmo elemento em duas visões. É isso que [Modelo e visões](modelo-y-vistas.md) explica.

## A demo “Cadastro de cliente” {#demo}

A demo é a melhor forma de entender o all-draw. Ela modela como um banco cadastra um novo cliente e desenha o
mesmo modelo em **seis dimensões**. O conteúdo dela segue o idioma da interface:

| Visão | Notação | O que mostra |
|---|---|---|
| Arquitetura · Cadastro de cliente | ArchiMate 3.2 (viewpoint *Layered*) | Ator, papel, processo, serviço, componentes, dados e nó |
| Cadastro de cliente · BPMN | BPMN 2.0 | O processo passo a passo, com uma pool “Banco” e duas raias |
| Cadastro de cliente · Estados | Máquina de estados | O ciclo de vida do processo do cliente: pendente, em verificação, ativo, rejeitado |
| CRM · Contêineres | C4 (viewpoint *Contêiner*) | Os contêineres do CRM (portal, API, banco de dados) e o provedor externo de KYC |
| Cadastro de cliente · Sequência | Diagrama de sequência | Cliente, portal, API e banco de dados trocando mensagens |
| Mapa camadas × etapas | Camadas × etapas | Os mesmos elementos em uma grade Negócio/Aplicação/Tecnologia × Captação/Cadastro/Operação, com dois microsserviços de uma biblioteca conectados por **pinos** |

Ela também inclui duas regras de estilo (“Externos em cinza”, que pinta de cinza os elementos externos, e
“Serviços sem repo”, para os serviços sem repositório), uma biblioteca “Sistemas” com o tipo *Microsserviço* e
vários **rastros** entre notações (por exemplo, a tarefa BPMN “Verificar identidade” está rastreada até o serviço ArchiMate
“Verificação KYC”).

![Editor mostrando a visão ArchiMate da demo](../img/03-editor-archimate-en.png)

Abra-a com **Abrir a demo** e experimente estas quatro coisas:

1. **Clique duas vezes** no processo “Cadastro de cliente” na visão ArchiMate: você entra na visão de detalhe BPMN dele. O
   **caminho de visões** aparece no topo, com o botão **voltar** para retornar.
2. **Clique com o botão direito** em qualquer nó → **Abrir em outra dimensão**: a lista de dimensões. As que já têm
   uma visão a abrem; as marcadas com **(criar)** criam uma visão nova.
3. Em “Mapa camadas × etapas”, selecione `clientes-api` e abra a aba **Pinos** do inspetor: você verá o
   pino `cliente.email` conectado a `notificacoes`.
4. Selecione qualquer elemento e abra a aba **Onde**: ela lista todas as visões em que o elemento aparece.

## Salvamento automático e indicador de status {#guardado}

Não há botão de salvar. Cada alteração é salva na hora no seu navegador e, se o espaço estiver no
servidor, é enviada assim que houver conexão. O indicador na barra de ferramentas do editor mostra o estado:

| Indicador | Significado |
|---|---|
| `salvo neste navegador` | Espaço local. Tudo está salvo neste navegador. |
| `● on-line` | Espaço no servidor, conectado. As alterações são enviadas na hora. |
| `◌ conectando…` | Tentando alcançar o servidor. Você pode continuar trabalhando. |
| `○ sem conexão (sincroniza ao voltar)` | Sem conexão. Suas alterações ficam salvas localmente e são enviadas quando a rede voltar. |

Nos espaços do servidor, o seu papel (**proprietário**, **pode editar** ou **somente leitura**) aparece ao lado do
indicador. Com **somente leitura** você pode ver, mas não editar.

Os espaços do servidor também mantêm **snapshots** automáticos que você pode restaurar pelo botão **Histórico** (veja
[Histórico](historial.md)).

## Instalar como aplicativo (PWA) {#instalar-pwa}

O all-draw é um **aplicativo web instalável** (PWA): você pode tê-lo na área de trabalho ou na tela inicial do celular;
ele abre em uma janela própria e carrega mesmo quando você está offline.

1. Abra [alldraw.bezenti.com](https://alldraw.bezenti.com) no Chrome, no Edge ou em outro navegador compatível.
2. No computador: clique no ícone de **instalar** na barra de endereços (ou menu do navegador → *Instalar all-draw*).
3. No celular: menu do navegador → *Adicionar à tela inicial* (no Safari do iPhone, botão *Compartilhar* →
   *Adicionar à Tela de Início*).

O aplicativo instalado se atualiza sozinho quando há uma versão nova. Seus espaços são os mesmos do navegador
em que você o instalou.

## Idioma {#idioma}

A interface está disponível em quatro idiomas: **espanhol**, **inglês**, **português** e **francês**. Na primeira vez,
ela segue o idioma do seu navegador (inglês, português ou francês se o navegador estiver em um desses idiomas;
espanhol nos demais casos).

Para trocar, use o seletor **Español / English / Português / Français**: ele fica no topo da tela de início e também
na barra de ferramentas do editor (no celular, dentro da folha **Mais**). A troca é imediata e fica lembrada neste
navegador.

> [!NOTE]
> O idioma muda os textos da interface e os nomes dos tipos e das categorias da paleta. Ele **não**
> traduz o que você escreve (nomes de elementos, documentação). Os nomes dos tipos ArchiMate continuam em inglês em
> todos os idiomas, como na especificação. O manual está traduzido em parte: os capítulos que ainda não foram
> traduzidos aparecem em inglês, com um aviso.

## Problemas frequentes {#problemas-frecuentes}

**Não vejo o botão “Entrar / cadastrar-se” (nem “Entrar” na página inicial).**
Ele só aparece quando o servidor de contas responde. Verifique sua conexão e recarregue a página. Enquanto isso, você
pode trabalhar com espaços locais.

**Meus espaços sumiram.**
Se eram locais, eles ficam no navegador em que você os criou: confira se está usando o mesmo navegador e o mesmo
perfil, e não uma janela anônima. Se você limpou os dados do site, os espaços locais foram perdidos. Por isso vale a
pena enviá-los para o servidor ou exportá-los.

**Esqueci minha senha.**
Pressione **Entrar → Esqueceu sua senha?**. Se o servidor envia e-mails, ele manda um link (válido por uma hora,
de uso único) para você escolher uma nova (veja [Esqueci minha senha](compartir-y-colaborar.md#recuperar-contrasena)).
Caso contrário, peça ao administrador do servidor que a redefina em **Conta → Usuários do servidor → Redefinir**: você
receberá uma senha temporária que depois pode trocar em **Alterar senha**.

**“Enviar ao servidor” diz que preciso de uma conta.**
Entre primeiro na tela de início e pressione **Enviar ao servidor** de novo.

**O indicador fica parado em `○ sem conexão`.**
Suas alterações não se perdem: continuam no navegador. Elas são enviadas automaticamente quando a conexão
voltar. Se demorar muito, recarregue a página.

**Não consigo editar nada em um espaço compartilhado.**
Confira o seu papel ao lado do indicador: com **somente leitura** (ou com um link de leitura) você só pode ver. Peça ao
proprietário um link de edição (veja [Compartilhar e colaborar](compartir-y-colaborar.md)).

## Próximos passos {#siguientes-pasos}

- [Conceitos](conceptos.md): modelo e visões, dimensões, pinos, rastros e viewpoints, com desenhos.
- [O editor](editor.md): cada área da tela e como usá-la.
- [Modelo e visões](modelo-y-vistas.md): criar visões, navegar entre dimensões, remover e excluir.
- [Atalhos](atajos.md): teclado, mouse e gestos de toque.
- [Perguntas frequentes](faq.md): dúvidas comuns.
