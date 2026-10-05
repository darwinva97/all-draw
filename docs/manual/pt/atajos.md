# Atalhos de teclado, mouse e toque

Tudo o que você pode fazer com o teclado, o mouse ou o dedo no editor do all-draw, em um só lugar. No
editor, pressione **?** para ver um resumo na tela (ou use o botão **Atalhos de teclado** da barra de ferramentas).

> [!TIP]
> **No Mac**, use **Cmd** (⌘) onde esta página diz **Ctrl**: **Cmd+Z**, **Cmd+C**, **Cmd+K**… Os dois funcionam.
> **Alt** é a tecla **Option** (⌥), e **Del** é a tecla **delete** (⌫). Se **F2** não fizer nada, tente
> **fn+F2**.

## Antes de começar: onde está o foco {#foco}

Há dois tipos de atalhos:

- **Globais**: funcionam em qualquer parte do editor, desde que você não esteja digitando em um campo. São **Ctrl+K**,
  **Ctrl+F**, **?** e **F2** (e **Ctrl+Shift+E**, que funciona até mesmo enquanto você digita).
- **Da tela**: todos os outros (copiar, colar, mover com as setas, zoom, excluir…). Só funcionam quando a tela tem
  o foco. Se um atalho “não faz nada”, **clique em uma área vazia da tela** e tente de novo.

Enquanto você digita em um campo de texto (o inspetor, o campo de busca da paleta…), as teclas digitam texto e os
atalhos da tela não são acionados. Assim, **Del** apaga letras, e não nós.

## Gerais {#general}

| Atalho | O que faz |
|---|---|
| **Ctrl+K** ou **Ctrl+F** | Abre (ou fecha) a busca: elementos, visões e ações |
| **?** | Abre (ou fecha) o painel de atalhos |
| **Ctrl+Shift+E** | Abre (ou fecha) o [painel de texto](dsl.md#editar-como-texto) |
| **Esc** | Fecha menus, painéis e diálogos; cancela a renomeação |
| **Shift+F10** ou a tecla **Menu** | Abre o menu de contexto da seleção na tela (ou o menu da tela, sem nada selecionado) |
| **Ctrl+Z** | Desfazer |
| **Ctrl+Y** ou **Ctrl+Shift+Z** | Refazer |

> [!NOTE]
> No editor, **Ctrl+F** abre a busca do all-draw em vez da barra de localização do navegador.

## Seleção {#seleccion}

| Atalho | O que faz |
|---|---|
| **Clique** | Seleciona um nó ou uma aresta |
| **Shift+clique** | Adiciona à seleção ou remove dela |
| **Shift+arrastar** no fundo | Seleção por área (tudo o que estiver dentro do retângulo) |
| **Ctrl+A** | Seleciona todos os nós e arestas da visão |
| **Clique no fundo** | Limpa a seleção e mostra a visão no inspetor |
| **F2** | Renomeia o elemento selecionado (com um único nó selecionado) |

## Edição {#edicion}

| Atalho | O que faz |
|---|---|
| **Ctrl+C** | Copia os nós selecionados (e as arestas entre eles) |
| **Ctrl+V** | Cola **novas ocorrências dos mesmos elementos**. Use-o para levar elementos para outra visão |
| **Ctrl+Shift+V** | Cola como **cópia**: cria elementos novos e independentes |
| **Ctrl+D** | Duplica a seleção (elementos novos), um pouco deslocada |
| **Setas** | Movem a seleção 1 px |
| **Shift+setas** | Movem a seleção 10 px |
| **Del** ou **Backspace** | **Remove da visão os nós e as arestas selecionados** (elementos e relações continuam no modelo) |
| **Shift+Del** | Em arestas: **exclui a relação** do modelo, com todas as suas arestas em todas as visões (pede confirmação) |
| **Alt** (manter pressionada) | Desativa o encaixe na grade enquanto você arrasta |

> [!WARNING]
> **Shift+Del** em uma aresta não apenas a remove da visão: exclui a relação em todas as visões. Se errar,
> **Ctrl+Z**. Cuidado com **Ctrl+A** seguido de **Shift+Del**: como **Ctrl+A** também seleciona as arestas, isso
> excluiria todas as relações desenhadas na visão. Mais em
> [Modelo e visões](modelo-y-vistas.md#quitar-o-borrar).

Em uma grade de camadas × etapas, o que você colar vai para a célula sob o cursor.

## Visão e zoom {#vista}

| Atalho | O que faz |
|---|---|
| **+** (ou **=**) | Aproximar |
| **-** | Afastar |
| **Ctrl+0** | Zoom em 100% |
| **Ctrl+Shift+F** | Ajustar à visão (enquadra todos os nós) |

## Renomear no lugar {#renombrar}

Quando você renomeia um nó na própria tela (com **F2** ou clicando duas vezes no nome dele):

| Tecla | O que faz |
|---|---|
| **Enter** | Confirma o nome |
| **Esc** | Cancela e mantém o nome anterior |
| **Shift+Enter** | Quebra de linha (só nas notas) |

## Busca (Ctrl+K) {#busqueda}

| Tecla | O que faz |
|---|---|
| Digitar | Filtra elementos, visões e ações (ignorando acentos e tolerando um erro de digitação por palavra) |
| **↑** / **↓** | Percorre a lista |
| **Enter** | Abre o resultado escolhido |
| **Esc** | Se você estava escolhendo uma visão para um elemento, ou em *Ir para a visão…* / *Nova visão…*, volta aos resultados; caso contrário, fecha |

## Painel de texto (Ctrl+Shift+E) {#texto}

Com o foco no texto do painel ([Editar como texto](dsl.md#editar-como-texto)):

| Tecla | O que faz |
|---|---|
| **Ctrl+Espaço** | Sugestões de tipos e ids (também aparecem sozinhas enquanto você digita) |
| **↑** / **↓**, **Enter** ou **Tab** | Percorre e escolhe a sugestão; **Esc** fecha a lista |
| **Ctrl+F** | Busca no texto (não abre a busca geral) |
| **Enter** / **F3** | Próxima ocorrência; com **Shift**, a anterior |
| **Ctrl+S** | Aplica o texto agora, sem esperar |
| **Tab** / **Shift+Tab** | Aumenta / diminui o recuo |
| **Esc**, depois **Tab** | Sai do texto usando o teclado |
| **Ctrl+Z** | Desfaz o que você digitou no texto (na tela, desfaz a alteração aplicada inteira) |

## Comentários {#comentarios}

| Tecla | O que faz |
|---|---|
| **Ctrl+Enter** | Envia o comentário ou a resposta |
| **@** | Inicia uma menção; aparece a lista de pessoas |
| **↑** / **↓** | Percorre a lista de menções |
| **Enter** ou **Tab** | Escolhe a menção destacada |
| **Esc** | Fecha a lista de menções; se não houver lista, cancela o rascunho |

Mais em [Comentários](comentarios.md).

## Diálogos {#dialogos}

Nos diálogos (entrar, compartilhar, busca, atalhos, Espaço…):

| Tecla | O que faz |
|---|---|
| **Tab** / **Shift+Tab** | Passa para o controle seguinte / anterior (o foco não sai do diálogo) |
| **Esc** | Fecha o diálogo e devolve o foco ao botão que o abriu |

## Menus, paleta e painéis {#menus-y-paneles}

| Tecla | Onde | O que faz |
|---|---|---|
| **↑** / **↓**, **Home** / **End** | Menu de contexto | Percorre as opções; **Enter** escolhe uma; **Esc** ou **Tab** o fecham e o foco volta para a tela |
| **Tab**, depois **↑** / **↓** | Paleta e lista de visões | Entra na lista (uma única parada de **Tab**) e se move por ela |
| **Enter** ou **Space** | Um tipo da paleta | Adiciona-o em um espaço livre perto do centro da área visível da tela (igual a um clique) |
| **F** ou **\*** | Um tipo da paleta | Marca-o ou desmarca-o como favorito |
| **Enter** / **Del** | Uma visão da lista | Abre-a / exclui-a (pede confirmação) |
| **←** / **→** | Abas (paleta, inspetor, Espaço) | Troca de aba |

## Mouse {#raton}

| Gesto | Onde | O que faz |
|---|---|---|
| Arrastar | Fundo da tela | Desloca a visão |
| Roda | Tela | Aproxima ou afasta |
| Clique duplo | Fundo da tela | Aproxima |
| Arrastar | Da paleta para a tela | Cria um nó (ou uma ocorrência, a partir da aba **Modelo**) |
| Clique | Um tipo da paleta | Adiciona-o em um espaço livre perto do centro da tela |
| Arrastar | Um nó | Move-o; soltá-lo dentro de um contêiner o aninha |
| Arrastar | Cantos de um nó selecionado | Redimensiona-o |
| Arrastar | Da borda inferior de um nó até outro nó | Cria uma relação (aparece o menu **Tipo de relação**). Enquanto você arrasta, o destino fica verde se for válido e vermelho se não for, com o motivo |
| Arrastar | Da borda inferior de um nó até um espaço vazio | Menu **Criar e conectar**: cria ali um elemento já conectado (um único Ctrl+Z o desfaz) |
| Arrastar | De um pino até outro pino | Cria uma relação entre pinos, com o seu mapeamento |
| Clique duplo | Um nó | Entra na visão de detalhe dele |
| Clique duplo | O nome de um nó | Renomeia-o no lugar |
| Clique duplo | Uma aresta | Adiciona um ponto de dobra |
| Arrastar | Um ponto de dobra | Move-o |
| Clique duplo | Um ponto de dobra | Remove-o |
| Clique com o botão direito | Um nó | Menu do nó: abrir em outra dimensão, detalhe, rastros, comentar, pinos, remover, excluir |
| Clique com o botão direito | Fundo da tela | Menu da tela: **Colar aqui**, **Adicionar nota**, **Comentar aqui**, **Selecionar tudo**, **Ajustar à visão**, **Layout automático** |
| Arrastar ou roda | Minimapa (canto inferior direito) | Desloca ou aproxima a visão |

Os botões de aproximar, afastar e ajustar à visão também ficam no canto inferior esquerdo da tela.

## Telas sensíveis ao toque {#tactil}

O all-draw se adapta ao tamanho da tela:

- **Computador** (1100 px ou mais): as três colunas visíveis.
- **Tablet** (de 700 a 1099 px): a barra de ferramentas tem dois botões para **mostrar ou ocultar** a coluna de visões
  e paleta e a coluna do inspetor. A sua escolha fica lembrada.
- **Celular** (menos de 700 px): a tela de desenho ocupa a tela inteira e aparece uma barra na parte inferior com
  **Visões**, **Adicionar**, **Inspetor** e **Mais**. Cada botão abre uma folha que sobe a partir de baixo.

| Gesto | O que faz |
|---|---|
| Tocar | Seleciona um nó ou uma aresta |
| Arrastar um dedo no fundo | Desloca a visão |
| Pinçar | Aproxima ou afasta |
| Arrastar um nó | Move-o |
| **Tocar e manter pressionado** um nó (meio segundo, sem mover o dedo) | Abre o menu do nó, como o clique com o botão direito |
| Tocar um tipo na folha **Adicionar** | Adiciona-o em um espaço livre perto do centro da tela |
| Tocar fora da folha, arrastar a alça dela para baixo ou pressionar o **×** dela | Fecha a folha |

A folha **Mais** reúne o caminho de visões, **Espaço**, a busca, o encaixe na grade, o tema, os atalhos,
**Ajustar à visão**, **Layout automático** e as ações do espaço (importar/exportar, compartilhar…). Os botões de
desfazer e refazer ficam sempre na barra superior.

> [!TIP]
> Sem teclado, o menu do nó (tocar e manter pressionado) substitui vários atalhos: **Entrar no detalhe** em vez do
> clique duplo, **Remover desta visão** em vez de **Del**. Para renomear, abra a folha **Inspetor** e edite
> o nome no topo.

## Problemas frequentes {#problemas-frecuentes}

**Um atalho não faz nada.**
Clique em uma área vazia da tela para dar o foco a ela. Se você estiver digitando em um campo, os atalhos da tela
ficam desativados de propósito.

**Ctrl+V não cola nada.**
Primeiro é preciso copiar nós do all-draw com **Ctrl+C**. Não é possível colar em um espaço somente leitura.

**Pressionei Shift+Del e uma relação sumiu de todas as visões.**
Você tinha uma aresta selecionada: **Shift+Del** exclui a relação do modelo. Pressione **Ctrl+Z**. **Del** apenas
a teria removido desta visão.

**As setas rolam a página em vez de mover o nó.**
A tela não está com o foco, ou não há nada selecionado. Clique no nó para selecioná-lo e tente de novo.

**No celular, tocar e manter pressionado não abre o menu.**
Mantenha o dedo parado sobre o nó: se ele se mover mais do que alguns pixels, conta como arrastar. Tocar e manter
pressionado só funciona sobre nós, não sobre o fundo.

**Em um espaço somente leitura, muitos atalhos não respondem.**
É o esperado: só a navegação funciona (busca, selecionar tudo, zoom, ajustar à visão, **Esc**).
