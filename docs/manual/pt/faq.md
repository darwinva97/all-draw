# Perguntas frequentes

Respostas curtas para as dúvidas mais comuns. Cada uma leva ao capítulo em que o assunto é explicado em
detalhe.

## Primeiros passos {#empezar}

### O que é o all-draw e qual a diferença em relação a outras ferramentas de diagramas? {#que-es}

É uma ferramenta de diagramas em que **um mesmo modelo** é desenhado em **muitas notações**: o processo
“Cadastro de cliente” pode aparecer em um mapa ArchiMate, em um diagrama BPMN e em uma máquina de estados, e
continua sendo uma coisa só. Renomeie em um lugar e ele muda em todos. Veja [conceitos](conceptos.md).

### Preciso de uma conta? {#necesito-cuenta}

Não. Sem conta, você trabalha com **espaços locais**, salvos no seu navegador. A conta é necessária
para salvar no servidor, compartilhar e ter histórico. Veja [primeiros passos](primeros-pasos.md).

### Não consigo criar conta. Por quê? {#no-puedo-registrarme}

Cada servidor decide se o cadastro está aberto, se exige um **código de convite** ou se está fechado
(“O cadastro está fechado neste servidor.”). Nos dois últimos casos, peça acesso a quem administra o
servidor. Enquanto isso, você pode usar espaços locais.

### Posso usar no celular ou no tablet? {#movil}

Sim. No tablet os painéis se recolhem; no celular há uma barra inferior e os painéis aparecem como
folhas deslizantes. O **toque longo** substitui o clique com o botão direito. Para diagramas grandes, uma
tela maior é mais confortável. Veja [editor](editor.md).

### Como mudo o idioma ou o tema? {#idioma-y-tema}

O **idioma** (espanhol, inglês, português ou francês) é escolhido no seletor **Español / English / Português /
Français** da tela inicial ou da barra de ferramentas do editor; ele fica gravado nesse navegador. Na primeira vez, a
interface segue o idioma do navegador (inglês, português ou francês se ele estiver em um desses idiomas; espanhol nos
demais casos). O manual está traduzido em parte: os capítulos que ainda não foram traduzidos aparecem em inglês, com um
aviso. Os nomes dos tipos ArchiMate continuam em inglês em todos os idiomas. O **tema** é alterado com o botão da barra de ferramentas do editor, que
alterna entre *sistema* → *claro* → *escuro*. Veja [editor](editor.md).

### Existem atalhos de teclado? {#atajos}

Sim: pressione **?** no editor para ver todos, ou consulte [atalhos](atajos.md). Os mais úteis:
**Ctrl+Z** desfazer, **Ctrl+Y** refazer, **Ctrl+K** buscar, **F2** renomear, **Del** remover da visão.

## Salvamento e dados {#guardar-y-datos}

### Ele salva sozinho? {#se-guarda-solo}

Sim, sempre. Não existe botão de salvar. Em um espaço local, cada alteração é salva na hora no
navegador (“salvo neste navegador”). Em um espaço do servidor, as alterações são enviadas em menos de
um segundo; o indicador “● on-line” confirma a conexão. Veja [primeiros passos](primeros-pasos.md).

### Funciona sem conexão? {#sin-conexion}

Sim. Os espaços locais nunca precisam de rede, e o aplicativo inicia sem conexão. Os espaços do
servidor que você já abriu nesse navegador também abrem sem conexão, a partir da cópia deles e com a
última permissão que você tinha (“○ sem conexão — as alterações serão sincronizadas”); se a conexão cair
enquanto você trabalha, o indicador muda para “○ sem conexão (sincroniza ao voltar)” e você continua
editando. Quando a rede volta, suas permissões são verificadas e tudo é mesclado. Só um espaço do
servidor que você nunca abriu nesse navegador precisa de rede para abrir. Veja [sem conexão](compartir-y-colaborar.md#sin-conexion).

### Onde ficam meus espaços locais e como não perdê-los? {#espacios-locales}

Eles ficam **dentro deste navegador, neste computador**, na lista “Neste navegador” da tela
inicial. Não passam para outro navegador nem para outro computador, e se perdem se você limpar os dados
do site ou usar uma janela anônima. Para protegê-los: exporte de vez em quando um **JSON do all-draw**
(`.alldraw.json`) ou envie-os para o servidor. Veja [espaços](conceptos.md#espacios).

### Como passo um espaço local para o servidor? {#subir-al-servidor}

Com a sessão iniciada, clique em **Enviar ao servidor**, na barra de ferramentas do editor ou ao
lado do espaço na tela inicial. Uma **cópia** é criada no servidor e aberta; o original local continua no
seu navegador até você excluí-lo. Veja [primeiros passos](primeros-pasos.md).

### Como recupero uma versão anterior? {#version-anterior}

- Um erro de agora há pouco: **Ctrl+Z**.
- Um espaço do servidor de horas ou dias atrás: **Histórico** → **Restaurar** no snapshot desejado
  (o estado atual é salvo antes).
- Um espaço local: importe o último `.alldraw.json` que você exportou.

Veja [histórico](historial.md).

### Quanto custa? Existem limites? {#coste-y-limites}

O serviço em alldraw.bezenti.com é **gratuito** e mantido por uma equipe pequena: não há garantia
de disponibilidade (SLA) nem suporte com prazos de resposta. Há limites para que o serviço continue
utilizável por todos: cada conta pode ser proprietária de até 100 espaços, cada espaço pode ocupar até
20 MB, um arquivo que você importar para o servidor pode ter até 5 MB, cada espaço guarda até 100
snapshots e as tentativas de entrar são limitadas. Suas cotas aparecem em **Conta**. Veja [termos](terminos.md).

### Meus dados são privados? {#privacidad}

Seus espaços do servidor são vistos somente por você, pelas pessoas a quem você der acesso e, quando
for necessário para mantê-lo ou resolver um incidente, por quem administra o servidor. Não há publicidade nem análise de terceiros. Os
espaços locais nunca saem do seu navegador. Veja [privacidade](privacidad.md).

### O serviço não responde. Onde vejo se ele está fora do ar? {#estado-del-servicio}

Na [página de status](https://alldraw-monitor.darwin-sva-97.workers.dev) (também no rodapé do aplicativo, **Status
do serviço**): ele é verificado a cada 5 minutos e mostra a disponibilidade das últimas 24 horas e 7 dias e os
incidentes mais recentes. Enquanto o servidor principal estiver fora do ar, os espaços que você já abriu no navegador continuam
disponíveis sem conexão, e em [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev) há uma **cópia
de backup somente leitura**, atualizada toda noite, onde você pode entrar com sua conta e consultar seus diagramas (sem editá-los:
as alterações são feitas em https://alldraw.bezenti.com).

## Edição {#editar}

### Qual a diferença entre excluir da visão e excluir do modelo? {#borrar-vista-o-modelo}

**Del** (ou botão direito → **Remover desta visão**) remove o desenho desta visão; o
elemento continua no modelo e nas demais visões. Botão direito → **Excluir do modelo** exclui de
verdade, de todas as visões, junto com as suas relações. Veja [modelo e visões](modelo-y-vistas.md).

### Por que não consigo conectar estes dois elementos? {#no-puedo-conectar}

Porque a notação da visão não permite **nenhuma** relação entre esses dois tipos: cada notação tem uma
[matriz de validade](conceptos.md#validez) e o editor a respeita. Se você conectar pinos, os campos
deles também precisam ser compatíveis. Tente outro tipo de elemento, conecte no sentido oposto ou use
um [rastro](conceptos.md#trazas) se eles forem de níveis diferentes. Veja [editor](editor.md).

### Posso colocar o mesmo elemento em vários diagramas? {#mismo-elemento}

Sim, essa é a ideia central. Arraste-o da aba **Modelo** da paleta para outra visão, ou use
botão direito → **Abrir em outra dimensão**. Veja [modelo e visões](modelo-y-vistas.md).

### Por que não consigo editar nada? {#solo-lectura}

Você está em modo **somente leitura**: tem o papel de **leitor** no espaço ou entrou por um link de leitura. Peça
ao proprietário um link de edição. Veja [compartilhar e colaborar](compartir-y-colaborar.md).

### Como deixo comentários para meus colegas? {#comentar}

Botão direito em um nó → **Comentar**, ou na tela → **Comentar aqui**. Você pode responder, mencionar com @ e
resolver. Veja [comentários](comentarios.md).

## Notações {#notaciones}

### Quais notações posso usar? {#que-notaciones}

ArchiMate, BPMN, máquina de estados, C4, camadas × etapas, livre, sequência, entidade-relacionamento, classes
UML, mapa mental, fluxograma e fluxo de dados (DFD). Veja [notações](notaciones.md).

### O que é uma dimensão? {#que-es-dimension}

Outra forma de ver o mesmo elemento com outra notação: o processo em ArchiMate, o detalhe dele em
BPMN e o seu ciclo de vida como máquina de estados. Veja [dimensões](conceptos.md#dimensiones).

## Colaboração {#colaborar}

### Como convido alguém? {#invitar}

Em um espaço do servidor do qual você é proprietário, clique em **Compartilhar** → **Novo link de edição** (ou **Novo link de leitura**) →
**Copiar link**, e envie o link. Quem abri-lo não precisa de conta. Você pode **revogá-lo**
quando quiser. Veja [convidar](compartir-y-colaborar.md#invitar).

### O que acontece se duas pessoas editarem a mesma coisa ao mesmo tempo? {#edicion-simultanea}

Nada de ruim: as alterações são combinadas sem bloqueios e todos acabam vendo a mesma coisa. Se duas
pessoas alterarem **exatamente o mesmo dado** ao mesmo tempo (por exemplo, o nome do mesmo
elemento), fica um dos dois valores, o mesmo para todos. **Ctrl+Z** só desfaz as suas próprias
alterações, nunca as de outra pessoa. Veja [compartilhar e colaborar](compartir-y-colaborar.md).

### Sou avisado quando alguém me menciona ou compartilha um espaço comigo? {#notificaciones}

Sim, nos espaços do servidor: o **sino** ao lado do seu nome conta as notificações não lidas (menções,
espaços compartilhados com você, mudanças de papel e versões restauradas nos seus espaços). Para que uma menção
chegue até você, seu e-mail precisa estar na sua ficha em **Espaço → Pessoas** (ou você precisa assinar os comentários com
o mesmo nome). Se o servidor envia e-mails, as menções também chegam por e-mail; desative isso em
**Conta → E-mail e notificações**. Veja [notificações](compartir-y-colaborar.md#notificaciones) e
[quem recebe o aviso](comentarios.md#aviso-de-mencion).

### Como removo o acesso de alguém? {#quitar-acceso}

**Compartilhar** → **Revogar** ao lado do link que você deu. A partir desse momento o link não abre mais o
espaço, e quem estiver com ele aberto é desconectado na hora com o aviso “Você não tem mais
acesso a este espaço”. Se várias pessoas usavam o mesmo link, crie um novo para quem
deve manter o acesso. Veja [revogar um link](compartir-y-colaborar.md#revocar).

## Importar e exportar {#importar-y-exportar}

### Como importo um modelo do Archi? {#importar-archi}

Na tela inicial, clique em **Importar…** e escolha o arquivo `.archimate` (ou um `.xml` Open Exchange).
Um novo espaço é criado com os elementos, as relações e as visões. Veja
[Archi](importar-exportar.md#archi).

### Posso exportar para imagem? {#exportar-imagen}

Sim, em **Importar / Exportar**, para a visão aberta: **SVG** (um único arquivo que fica bem tanto no
tema claro quanto no escuro) ou **PNG** em resolução dobrada. Para todas as visões de uma vez, **HTML
autocontido**. Veja [formatos](importar-exportar.md#formatos).

### Posso levar um diagrama BPMN para outras ferramentas? {#exportar-bpmn}

Sim: **Importar / Exportar → BPMN 2.0 XML** gera um arquivo padrão que outras ferramentas de BPMN abrem. Você
também pode importá-los. Veja [BPMN](importar-exportar.md#bpmn).

### Importar substitui o que eu tenho? {#importar-sustituye}

Na **tela inicial**, importar cria um espaço **novo**. No menu **Importar / Exportar** do
editor, importar **substitui** o conteúdo do espaço aberto (é pedida uma confirmação).
Antes, exporte um `.alldraw.json` ou, em um espaço do servidor, crie um snapshot com rótulo em
**Histórico**, caso queira voltar atrás.

## Conta e segurança {#cuenta-y-seguridad}

### Esqueci a senha. O que faço? {#olvide-contrasena}

Clique em **Entrar → Esqueceu sua senha?**. Se o servidor envia e-mails, digite seu e-mail e você receberá um
link para escolher uma senha nova: ele funciona **uma vez** e expira em **uma hora**, e ao usá-lo todas as
suas sessões são encerradas. Se o servidor **não envia e-mails**, a caixa de diálogo avisa: peça a um administrador que
a redefina; ele lhe dará uma senha temporária, que você troca em **Conta → Alterar senha**. Veja
[Esqueci a senha](compartir-y-colaborar.md#recuperar-contrasena).

### Por que preciso confirmar meu e-mail? {#confirmar-correo}

Para que o servidor saiba que o endereço é seu: é para lá que vão os links de recuperação de senha e os avisos de menções.
Ao criar a conta (ou ao alterar o e-mail), você recebe um link que expira em 24 horas; se ele passou despercebido, use
**Conta → Reenviar o link**. Alguns servidores não deixam criar espaços no servidor até
você confirmar; os espaços do seu navegador funcionam sempre. Veja
[confirmar o e-mail](compartir-y-colaborar.md#verificar-correo).

### Como vejo onde estou com a sessão iniciada? {#sesiones-activas}

Em **Conta → Sessões ativas**: cada navegador com o seu sistema, o IP sem o último número, quando a
sessão foi aberta e quando foi usada pela última vez. **Encerrar esta sessão** desconecta esse navegador na hora. Veja
[sua conta](compartir-y-colaborar.md#ajustes-cuenta).

### Como altero a senha ou saio de todos os meus dispositivos? {#cambiar-contrasena}

Em **Conta** (menu do seu nome, no canto superior direito → **Conta e chaves de API**): **Alterar senha** também
encerra suas outras sessões; **Sair de todas as sessões** encerra todas, inclusive a
atual. Nos dois casos, os espaços abertos nesses navegadores são desconectados na hora e, se você
deixar marcada a caixa **Revogar também as chaves de API**, suas chaves deixam de funcionar. Para sair apenas deste
navegador, use **Sair** no menu do seu nome. Uma sessão que você não usa por 30 dias expira
sozinha. Veja [o que acontece ao encerrar sessões](compartir-y-colaborar.md#cerrar-sesiones).

### Como altero meu nome ou meu e-mail? {#cambiar-nombre}

Em **Conta → Perfil**. Para alterar o e-mail, é pedida a sua senha atual.

### Como baixo todos os meus dados? {#exportar-mis-datos}

**Conta → Seus dados → Exportar meus dados** baixa um JSON com sua conta, suas chaves de API (sem
o segredo), seus espaços com o conteúdo, membros e links, e a lista de espaços
compartilhados com você. Veja [privacidade](privacidad.md#tus-derechos).

### Como excluo minha conta? {#borrar-cuenta}

Em **Conta → Seus dados → Excluir conta…**, digite sua senha e confirme. Sua conta, suas sessões,
suas chaves de API e seu acesso aos espaços de outras pessoas são excluídos. Cada espaço do qual você é proprietário passa para o seu
**editor mais antigo** (uma conta a quem você deu o papel de editor); os que não têm editores são
**excluídos**. Não é possível desfazer: exporte seus dados antes. Se você for o único
administrador do servidor, primeiro precisa nomear outro. Veja [privacidade](privacidad.md#borrar-datos).

### Posso usar o all-draw com um assistente de IA ou a partir dos meus programas? {#ia-y-api}

Sim. Crie uma **chave de API** em **Conta** e use-a com a API REST ou com o servidor MCP para que um agente
leia e edite seus espaços. Veja [agentes e API](agentes-y-api.md).

### Posso instalar o all-draw no meu próprio servidor? {#autoalojar}

Sim: o código é aberto (licença MIT) e pode ser hospedado em um servidor próprio ou na Cloudflare.
Veja [auto-hospedagem](agentes-y-api.md#autoalojar).
