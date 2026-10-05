# Política de privacidade

Última atualização: 5 de outubro de 2026.

Esta política explica quais dados o serviço all-draw oferecido em **https://alldraw.bezenti.com**
(o “serviço”) trata, para quê, onde e por quanto tempo, e como você pode exercer seus direitos. Ela foi
escrita para ser entendida; se algo não estiver claro, escreva para nós.

> [!NOTE]
> Esta política cobre o serviço hospedado. Se você usa o all-draw instalado no servidor da sua empresa ou
> no seu próprio, o controlador dos seus dados é quem opera essa instalação, não nós.

## Quem é o responsável {#responsable}

- Controlador: o autor do projeto, uma pessoa física que opera o serviço gratuitamente e é publicamente
  identificada pela conta do GitHub [darwinva97](https://github.com/darwinva97).
- Contato para privacidade: um [relato privado no GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visível somente para o operador. Para todo o resto, as [issues públicas](https://github.com/darwinva97/all-draw/issues) do projeto.
- Você pode fazer quase tudo por conta própria, sem escrever para ninguém: exportar e excluir seus dados estão
  em **Conta → Seus dados**.
- Se o serviço passar a ter uso comercial, os dados fiscais do operador serão publicados aqui.

## Resumo {#resumen}

- Só pedimos o necessário para que você tenha uma conta: **e-mail, nome e senha** (a
  senha é armazenada com hash irreversível, nunca em texto simples).
- Seus diagramas são seus. Nós os armazenamos para devolvê-los a você e não os usamos para mais nada.
- **Sem publicidade, sem análise de terceiros, sem rastreamento.** Nosso único cookie é o de
  sessão.
- Você pode usar o all-draw **sem conta**: os espaços locais nunca saem do seu navegador.
- Você pode levar tudo com você a qualquer momento exportando um `.alldraw.json`.

## Quais dados tratamos {#que-datos}

### Se você usa espaços locais (sem conta) {#datos-locales}

Nada chega ao nosso servidor. Seus espaços são armazenados **no seu navegador** (IndexedDB) e só
saem dele se você decidir: ao exportar um arquivo ou clicar em **Enviar ao servidor**. Para baixar o
aplicativo, seu navegador faz requisições comuns ao site (veja
[infraestrutura](#donde)).

### Se você cria uma conta {#datos-de-cuenta}

| Dado | Para quê |
|---|---|
| E-mail | Para identificar você quando entra. Você pode alterá-lo em **Conta → Perfil** |
| Nome | Para mostrá-lo às pessoas com quem você compartilha. Você pode alterá-lo em **Conta → Perfil** |
| Senha | Só a sua impressão digital é armazenada (hash PBKDF2-SHA256 com salt, 100.000 iterações); ninguém, nem mesmo quem opera o serviço, pode lê-la |
| Data de cadastro e se você é administrador | Gestão da conta |
| Sessões | Para manter você conectado: armazenamos uma impressão digital do identificador da sessão e suas datas de criação e de expiração. Não armazenamos seu endereço IP nem seu navegador |
| Chaves de API | Nome, primeiros caracteres, impressão digital da chave, data de criação e data do último uso. A chave completa é mostrada só uma vez, ao ser criada |

### Conteúdo que você armazena no servidor {#datos-de-contenido}

- **Espaços**: nome, proprietário, datas e todo o seu conteúdo (elementos, relações, visões,
  bibliotecas, regras, pessoas e comentários).
- **Membros e links compartilhados**: quem tem acesso a cada espaço, com qual papel, quem criou cada
  link e quando ele expira.
- **Snapshots do histórico**: cópias completas do espaço em momentos diferentes, com quem as
  criou (veja [histórico](historial.md)).
- **Comentários**: texto, data e o nome com que foram assinados.

Enquanto você edita um espaço compartilhado, seu nome, sua cor, seu cursor e sua seleção são enviados **ao vivo** para as
outras pessoas conectadas (presença). Isso não é armazenado.

### Dados técnicos {#datos-tecnicos}

- Para frear ataques (por exemplo, muitas tentativas de senha), o servidor conta as tentativas por **endereço
  IP** e por e-mail durante alguns minutos. Essa contagem fica apenas na memória e se perde quando o servidor
  reinicia; não é armazenada no banco de dados.
- **Registro de requisições**: para cada requisição ao servidor, registramos a data, o método, o caminho (sem tokens
  nem senhas), o resultado, o tempo de resposta, o identificador interno da sua conta se você tiver entrado e
  seu **endereço IP truncado** (sem o último número, por exemplo `203.0.113.0`), o que nos permite
  detectar abusos sem armazenar seu endereço exato. O conteúdo dos seus diagramas nunca é registrado.
  Erros técnicos do servidor também são registrados.
- **Relatórios de erros do aplicativo**: se o aplicativo falhar no seu navegador, ele envia um relatório
  técnico com a mensagem de erro, o ponto do código em que ocorreu, a página (sem tokens) e a
  identificação do seu navegador (*user agent*). Nunca inclui conteúdo de diagramas. O servidor o registra
  com seu endereço IP truncado.
- Nossos provedores de infraestrutura (veja [onde](#donde)) tratam seu endereço IP e os dados técnicos da
  conexão para entregar o site, e podem manter registros segundo suas próprias políticas.
  O proxy do servidor (Caddy) não mantém registros de acesso próprios; a Cloudflare mantém os seus registros segundo sua política
  de privacidade. Na instalação do Cloudflare Workers, os registros do aplicativo são mantidos pela Cloudflare por alguns dias
  para diagnosticar falhas.

### Dados de outras pessoas que você insere {#datos-de-terceros}

No painel **Pessoas** você pode registrar nomes, e-mails e equipes de outras pessoas, e pode mencioná-las
nos comentários. Você decide sobre esses dados: insira apenas o necessário e certifique-se de que tem
permissão para isso. Em relação a esses dados, atuamos como operador em seu nome.

## Para que os usamos e com qual base legal {#finalidades}

| Finalidade | Base legal (RGPD) |
|---|---|
| Criar e manter sua conta, armazenar e sincronizar seus espaços, compartilhá-los conforme você indicar | Execução de contrato: os [termos de uso](terminos.md) que você aceita ao criar a conta (art. 6.º, n.º 1, alínea b) |
| Segurança: limitar tentativas, proteger sessões, detectar abusos | Interesse legítimo em proteger o serviço e seus usuários (art. 6.º, n.º 1, alínea f) |
| Backups para recuperar o serviço após uma falha | Interesse legítimo em não perder seus dados (art. 6.º, n.º 1, alínea f) |
| Atender suas solicitações e cumprir obrigações legais | Obrigação legal (art. 6.º, n.º 1, alínea c) |

Não usamos seus dados para publicidade, não traçamos seu perfil e não tomamos decisões automatizadas
sobre você. Não vendemos nem cedemos dados.

## Onde estão seus dados {#donde}

- **Servidor principal**: um servidor virtual privado (VPS) na Europa, onde ficam o banco de dados, os espaços,
  os snapshots e os backups. O provedor é a Contabo GmbH e o servidor fica na Alemanha (União Europeia).
- **Cloudflare**: o site passa pela Cloudflare, que atua como rede de distribuição de conteúdo e
  proxy (gerencia o DNS e a criptografia da conexão e, portanto, vê o tráfego).
  A Cloudflare, Inc. é uma empresa dos EUA; as transferências internacionais se baseiam no
  Data Privacy Framework UE-EUA, ao qual a Cloudflare aderiu, e nas cláusulas contratuais padrão do
  seu acordo de tratamento de dados.
- **Cópia de backup no Cloudflare Workers**: o endereço
  [alldraw.darwin-sva-97.workers.dev](https://alldraw.darwin-sva-97.workers.dev) é uma **cópia de backup somente leitura** do
  serviço, na infraestrutura da Cloudflare, atualizada **toda noite** com os dados do servidor principal (contas,
  espaços, membros e links). Ela permite consultar seus diagramas se o servidor principal estiver fora do ar; não é possível editar
  nela. O que você excluir no servidor principal desaparece da cópia na sincronização seguinte.
- **Backups externos**: toda noite, uma cópia do banco de dados e dos espaços é enviada para o Backblaze B2, um serviço
  de armazenamento da Backblaze, Inc. (EUA), na sua região do leste dos EUA (`us-east`). Eles são criptografados em repouso, mantidos em um
  armazenamento privado ao qual só o operador tem acesso, e excluídos automaticamente após **90 dias**. Só são usados para
  restaurar o serviço após uma falha grave. As transferências internacionais se baseiam nas cláusulas contratuais padrão do
  seu acordo de tratamento de dados.
- **Monitor de disponibilidade**: um pequeno serviço na Cloudflare verifica a cada 5 minutos se o serviço responde e
  publica uma [página de status](https://alldraw-monitor.darwin-sva-97.workers.dev). Ele só lê o status técnico
  (versão, tempo em funcionamento e se o banco de dados responde): **não vê contas, diagramas nem dados pessoais**.

## Por quanto tempo os mantemos {#conservacion}

| Dado | Prazo |
|---|---|
| Conta | Até ser excluída |
| Sessão | 30 dias a partir do último uso; é excluída quando você sai |
| Chaves de API | Até você revogá-las ou a conta ser excluída |
| Espaços e comentários | Até o proprietário excluí-los |
| Snapshots | Até 100 por espaço; os automáticos mais antigos são excluídos sozinhos; todos são excluídos junto com o espaço |
| Backups do servidor | 30 dias; depois são excluídos automaticamente |
| Backups externos (Backblaze) | 90 dias; depois são excluídos automaticamente |
| Cópia de backup na Cloudflare | Substituída toda noite pelo conteúdo do servidor principal |
| Contagem de tentativas por IP | Minutos, somente na memória |
| Cópia final dos espaços excluídos junto com uma conta | 30 dias, com os backups |
| Registros de requisições e de erros | No registro do sistema do servidor, que só os exclui por rotação quando fica cheio; contêm o IP truncado e nunca o conteúdo dos diagramas |

Tenha em mente que um dado excluído pode permanecer por até 30 dias nos backups do servidor e por até 90 dias
nos backups externos, que não são modificados; depois disso, ele desaparece. Da cópia de backup
na Cloudflare, ele desaparece na sincronização da noite seguinte.

## Sem publicidade nem rastreamento {#sin-rastreo}

O all-draw não inclui ferramentas de análise, pixels de rastreamento, publicidade nem recursos de terceiros (fontes,
scripts) carregados de outros domínios. A política de segurança de conteúdo do site só permite recursos
do próprio serviço.

A única exceção é por segurança: a Cloudflare pode adicionar à página um pequeno script de **detecção de bots**
e definir seus próprios cookies técnicos de segurança (por exemplo `__cf_bm`) para distinguir pessoas de
ataques automatizados. Eles não são usados para publicidade nem para seguir você em outros sites.
No domínio principal, estão ativadas a verificação de integridade do navegador, a ofuscação de e-mails e a geolocalização aproximada por IP (somente o país,
para segurança).

## Cookies e armazenamento no seu navegador {#cookies}

O all-draw usa **um único cookie**, técnico e necessário, por isso não requer o seu consentimento:

| Nome | Para quê | Duração |
|---|---|---|
| `alldraw_session` | Manter sua sessão iniciada (só se você tiver conta). É `HttpOnly` (os scripts não podem lê-lo) e só trafega para este site | 30 dias a partir do último uso |

A Cloudflare pode adicionar seus próprios cookies técnicos de segurança (veja [sem rastreamento](#sin-rastreo)).

O aplicativo também armazena no seu navegador dados que **não são enviados** ao servidor:

| Onde | O quê |
|---|---|
| `localStorage` → `alldraw:lang` | Idioma escolhido |
| `localStorage` → `alldraw:theme` | Tema (sistema, claro, escuro) |
| `localStorage` → `alldraw:snap`, `alldraw:panels` | Preferências do editor (ajuste à grade, painéis abertos) |
| `localStorage` → `alldraw:index` | Lista dos seus espaços locais |
| `localStorage` → `alldraw:me` | Nome com que assinar comentários, se houver |
| `sessionStorage` → `alldraw:token:…` | Token de um link compartilhado, só enquanto a aba estiver aberta |
| IndexedDB | Seus espaços locais e uma cópia dos espaços do servidor que você abre, para trabalhar sem conexão |
| Cache do aplicativo (PWA) | Os arquivos do aplicativo, para que ele inicie sem rede |

> [!WARNING]
> Sair **não exclui** as cópias dos espaços do servidor mantidas pelo navegador. Se você usa um
> computador compartilhado, limpe os dados do site nas configurações do navegador ao terminar.

## Com quem são compartilhados {#terceros}

- Com as **pessoas a quem você dá acesso** a um espaço (por link ou como membros).
- Com nossos **provedores de infraestrutura** (hospedagem do VPS, Cloudflare e Backblaze para os backups externos),
  somente para prestar o serviço e como operadores.
- Os **administradores do servidor** podem ver a lista de contas (nome e e-mail) para gerenciá-las, por
  exemplo para redefinir uma senha. Tecnicamente, eles também podem abrir qualquer espaço do servidor; só
  o fazem para manutenção, para resolver um incidente ou quando você pede.
- Com autoridades, somente se uma lei nos obrigar.

Ninguém mais.

## Seus direitos {#tus-derechos}

Você pode solicitar a qualquer momento:

- **Acesso**: saber quais dados seus mantemos.
- **Retificação**: corrigi-los.
- **Eliminação**: excluí-los.
- **Portabilidade**: levar seus dados com você. Você já pode fazer isso sozinho: **Conta → Seus
  dados → Exportar meus dados** baixa um JSON com sua conta, suas chaves de API (sem o segredo) e
  seus espaços com o conteúdo, membros e links; e **Importar / Exportar → JSON do all-draw**
  baixa um espaço específico em um formato aberto.
- **Oposição e limitação** do tratamento baseado em interesse legítimo.

Faça a solicitação por meio de um [relato privado no GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visível somente para o operador, informando o e-mail da sua conta. Responderemos em até um
mês. Se não ficar satisfeito, você pode apresentar uma reclamação à autoridade de proteção de
dados do seu país (na União Europeia, a do seu Estado-membro).

## Como excluir seus dados {#borrar-datos}

- **Espaços locais**: na tela inicial, **Excluir** ao lado do espaço; ou limpe os dados do site
  no seu navegador.
- **Espaços do servidor**: o proprietário os exclui com **Excluir** na tela inicial. Os snapshots,
  membros e links deles são excluídos junto.
- **Chaves de API e sessões**: **Conta** → **Revogar** e **Sair de todas as sessões**.
- **Conta**: **Conta → Seus dados → Excluir conta…**, com a sua senha. Sua conta,
  suas sessões, suas chaves de API e seu acesso aos espaços de outras pessoas são excluídos. Cada espaço do qual você é proprietário
  passa para o membro mais antigo que **pode editar**; os que não têm nenhum são excluídos, e deles se mantém uma cópia final
  que é removida automaticamente após 30 dias, como os demais backups. Se você não conseguir
  entrar, faça a solicitação por meio de um [relato privado no GitHub](https://github.com/darwinva97/all-draw/security/advisories/new), visível somente para o operador.

## Segurança {#seguridad}

- Conexão criptografada (HTTPS) e cabeçalhos de segurança rigorosos.
- Senhas com hash PBKDF2 e salt; sessões e chaves de API armazenadas somente como impressões digitais.
- Cookie de sessão `HttpOnly` e `SameSite`, com proteção contra requisições de outros sites.
- Limites de tentativas de entrar e de criar conta.
- Backups diários, mantidos também fora do servidor (criptografados em repouso).

Se você encontrar um problema de segurança, relate-o de forma privada em
https://github.com/darwinva97/all-draw/security.

Nenhum sistema é infalível. Se detectarmos uma violação que afete seus dados, avisaremos você e a comunicaremos
à autoridade quando a lei exigir.

## Menores {#menores}

O serviço não é destinado a menores de 14 anos. Se você tem menos dessa idade, não crie uma conta.

## Alterações nesta política {#cambios}

Se mudarmos algo importante, anunciaremos em [novidades](novedades.md) e atualizaremos a
data no topo. Se a mudança afetar a forma como usamos seus dados, avisaremos você antes que ela entre em vigor.
