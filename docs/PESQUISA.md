# Construa o Mesa-RPG sobre SRD e autoridade

O caminho mais seguro e mais barato para o Mesa-RPG tem três partes. A primeira é construir as regras sobre o **SRD 5.2.1 (regras de 2024, licenciado em CC-BY-4.0)** e tratar cada desvio do Baldur's Gate 3 como uma *flag* de regra configurável, em vez de copiar o jogo. A segunda é rodar no PC do Mestre um **servidor Node.js autoritativo único**: os clientes enviam intenções, o servidor valida, aplica e transmite deltas filtrados para cada destinatário. A terceira é vestir tudo com mitologia grega de domínio público, sem nenhum nome criado por Rick Riordan. Na prática, a mesa vira um pequeno "servidor por partida", como no Owlbear Rodeo 2.0, com o modelo de documentos e permissões do Foundry VTT, e não precisa de Redis, CRDTs nem infraestrutura em nuvem. A stack recomendada é **TypeScript em monorepo pnpm + Turborepo**, Socket.io 4.8, PostgreSQL com **Prisma 7 (não o 8, que ainda é RC)**, PixiJS 8 para o grid, React 19 + Vite 8, Vitest 5 e Argon2id. O cuidado que mais conta é legal, não técnico. "Percy Jackson & the Olympians" é marca registrada hoje de uma empresa Disney, e a política de fã da Wizards proíbe usar a propriedade dela em outros jogos. Por isso o projeto deve se apoiar só no SRD, com o texto de atribuição exato, e nunca usar nomes de BG3, Forgotten Realms ou Riordan. Algumas conclusões técnicas, como a fórmula exata de iniciativa do BG3 e o suporte a WebSocket nos túneis, foram marcadas como "verificar antes de lançar".

## Regras: SRD 5.2.1 como núcleo, BG3 como camada de flags

O motor de regras deve ser **TypeScript puro**, sem APIs de Node nem de DOM, e ficar no pacote compartilhado. Assim o mesmo código valida a jogada no servidor e desenha a prévia de alcance no celular. Quase todo o conteúdo pode vir do SRD 5.2.1, publicado em 1º de maio de 2025 sob CC-BY-4.0. A Wizards declarou que os próximos SRDs sairão exclusivamente nessa licença ([D&D Beyond SRD](https://www.dndbeyond.com/srd)). Onde BG3 diverge do tabuleiro, a divergência vira configuração, nunca um fork da lógica.

### Criação de personagem cabe em quatro fórmulas e uma tabela de custos

O **point-buy dá 27 pontos para valores de 8 a 15**, com custos 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7 e 15=9. O *standard array* é 15, 14, 13, 12, 10, 8 ([Free Rules 2024: Creating a Character](https://www.dndbeyond.com/sources/dnd/free-rules/creating-a-character)). O modificador é `Math.floor((score-10)/2)`. O bônus de proficiência é `2 + Math.floor((nível-1)/4)`, de +2 até +6 ([SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)).

A grande mudança de 2024 é que **os aumentos de atributo vêm do antecedente, não da raça**. Cada antecedente lista três atributos e dá +2/+1 ou +1/+1/+1, com teto 20. Por exemplo, Soldado lista For/Des/Con e Acólito lista Int/Sab/Car ([Free Rules](https://www.dndbeyond.com/sources/dnd/free-rules/creating-a-character); [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)). O PV depois do 1º nível é o dado de vida rolado (ganho mínimo de 1) ou o valor fixo, mais o modificador de Con.

O BG3 simplifica esse quadro de quatro formas ([bg3.wiki: D&D 5e rule changes](https://bg3.wiki/wiki/D%26D_5e_rule_changes)):

- **só point-buy**;
- bônus flutuante **apenas +2/+1** (não existe a opção +1/+1/+1);
- **PV fixo** a cada nível;
- nível máximo 12.

Para o Mesa-RPG isso vira um *enum* `fonteDeBonus = 'raça' | 'antecedente'` e um seletor "modo tabuleiro / modo BG3" para a rolagem de PV. O tema grego encaixa aqui com naturalidade: o "pai ou mãe divino" pode ocupar o lugar da raça como fonte do +2/+1, e o antecedente fornece as perícias.

### Proficiências aplicam penalidade, não bloqueiam o equipamento

As classes de 2024 definem dado de vida, testes de resistência, armas, treino de armadura e número de maestrias. Bárbaro tem d12, resistências For/Con, armas simples e marciais, armaduras leve, média e escudos, e 2 maestrias. Guerreiro tem d10, todas as armaduras e 3 maestrias. Monge tem d8, armas simples mais marciais com a propriedade Leve, e nenhuma armadura ([Free Rules: Character Classes](https://www.dndbeyond.com/sources/dnd/free-rules/character-classes)).

Vestir uma armadura sem treino impõe **desvantagem em testes d20 de For e Des e impede conjurar magias**. Um escudo sem treino não dá bônus de CA ([Rules Glossary](https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary)). A CA segue `base + min(modDes, teto)`, com teto ilimitado na armadura leve, +2 na média e 0 na pesada. Na pesada, Cota de Malha exige For 13 e Placas exige For 15 ([5thSRD Armor](https://5thsrd.org/adventuring/equipment/armor/)). A recomendação de projeto é permitir equipar e calcular `isProficient()` como modificador de rolagem, como no tabuleiro.

As **oito maestrias** de 2024 são Cleave, Graze, Nick, Push, Sap, Slow, Topple e Vex. Exemplos de efeito: Topple força um teste de Con contra CD 8 + mod + PB ou derruba o alvo; Graze causa dano igual ao modificador mesmo num erro ([D&D Beyond: Weapon Mastery](https://www.dndbeyond.com/posts/1742-your-guide-to-weapon-mastery-in-the-2024-players)). Elas são o equivalente "oficial e livre" das ações especiais de arma do BG3. No BG3 essas ações dependem de proficiência e costumam recarregar por descanso curto ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)). Vale implementar as maestrias do SRD e deixar as ações ao estilo BG3 como conteúdo próprio.

Outras mudanças do BG3 em equipamento ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)):

- armadura pesada não exige Força;
- a propriedade Pesada some;
- bestas não têm a restrição de recarga;
- munição normal não é consumida;
- vestir ou tirar qualquer armadura custa uma ação.

### Iniciativa e economia de ações seguem o SRD, com variantes do BG3 como opção

No turno, a criatura se move até seu Deslocamento e tem **uma Ação, uma Ação Bônus (se alguma habilidade conceder), uma interação livre com objeto e uma Reação por rodada**. O glossário de 2024 descreve as ações em detalhe ([Rules Glossary](https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary)):

- **Esquivar**: ataques contra você têm desvantagem.
- **Ajudar**: dá vantagem a um aliado.
- **Esconder**: teste de Des (Furtividade) contra CD 15 com cobertura ou escuridão; o sucesso concede a condição Invisível.
- **Preparar**: define um gatilho e gasta a Reação.
- **Ataque de oportunidade**: um ataque corpo a corpo quando um alvo sai do seu alcance.
- **Agarrar e Empurrar**: resistência contra CD 8 + For + PB.

A **cobertura** dá +2 (meia) ou +5 (três quartos) na CA. O **crítico** em 20 natural rola os dados de dano duas vezes. Vantagem e desvantagem não se acumulam e se anulam.

Os testes de morte usam CD 10 e terminam em 3 sucessos ou 3 falhas. Um 1 natural conta como duas falhas, e um 20 natural recupera 1 PV. Dano excedente igual ou maior que o PV máximo mata na hora ([5thSRD Damage and Healing](https://5thsrd.org/combat/damage_and_healing/)).

No BG3 a economia vira quatro recursos com uma carga cada, recarregados no início do turno: Ação, Ação Bônus, Reação e Movimento. **Empurrar, Pular, Mergulhar a arma em superfície e ataques com a mão secundária custam Ação Bônus** ([bg3.wiki: Actions](https://bg3.wiki/wiki/Actions)). O BG3 também muda várias regras de combate ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)):

- a iniciativa usa **d4, não d20**, e aliados adjacentes compartilham a iniciativa;
- Esquivar, Preparar, Agarrar e cobertura não existem;
- PdMs morrem a 0 PV, sem testes de morte;
- ataques à distância a até 3 m de um inimigo têm desvantagem;
- beber uma poção é Ação Bônus.

Há uma incerteza aqui. A nota de pesquisa registra a iniciativa do BG3 como "d4, sem teste de Des", mas a memória do pesquisador era 1d4 + Des. Confirme em bg3.wiki/wiki/Initiative antes de implementar. Para uma mesa com Mestre humano, a recomendação é manter a iniciativa d20 + Des do SRD e oferecer o "grupo adjacente age junto" como opção. Esse é um dos poucos desvios do BG3 que de fato aceleram partidas presenciais.

### Condições viram dados, e os dados ficam no servidor

As 15 condições de 2024 se traduzem quase todas em *flags* de rolagem e de bloqueio de ação ([Rules Glossary](https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary)). Exemplos:

- **Paralisado**: Incapacitado, deslocamento 0, falha automática em For/Des, e acertos a até 1,5 m (5 ft) viram crítico.
- **Caído**: ataques a até 1,5 m (5 ft) têm vantagem e os de mais longe têm desvantagem.
- **Exaustão**: −2 por nível em testes d20 e −1,5 m (5 ft) de deslocamento por nível; o nível 6 mata.

Cada condição pode ser modelada como um objeto `{concedeVantagemAAtacantes, falhaAutomatica:['for','des'], deslocamentoZero, critAutomaticoAte: 1.5, implica:['incapacitado']}`. O BG3 muda os raios para 3 m e faz Amedrontado significar "não pode se mover" ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)). Esses valores devem ser parâmetros, não constantes.

A rolagem é sempre a mesma primitiva, o "Teste d20": d20 + mod + PB contra CA ou CD, com vantagem modelada como `2d20kh1`. O BG3 acrescenta os **Karmic Dice**, ligados por padrão, além de falha automática com 1 natural e sucesso automático com 20 em perícias ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)). "Karmic Dice" é termo do BG3, então use outro nome se oferecer algo parecido.

Tecnicamente, dados públicos e secretos são a mesma rolagem com visibilidade diferente: `public`, `gm-only` ou `blind`. O resultado é **sempre gerado no servidor** com RNG criptográfico e gravado no evento. Isso torna replays determinísticos e impede que um jogador "role" no próprio celular.

## Superfícies e terreno: o diferencial do BG3 é uma tabela de transformações

O que separa o BG3 de um VTT comum é o ambiente reativo. Esse ambiente se modela como **superfícies em células com efeito por turno e uma tabela (superfície × tipo de dano) → nova superfície**. O wiki documenta as interações ([bg3.wiki: Surfaces](https://bg3.wiki/wiki/Surfaces)) e os efeitos individuais:

| Superfície | Efeito por turno (BG3) | Transformação |
|---|---|---|
| Água | Molhado; remove fogo/veneno da arma mergulhada | + Raio → Água Eletrificada (1d4 elétrico); + Fogo → Nuvem de Vapor; + Frio → Gelo |
| Gelo | Caído + terreno difícil | + Fogo → Água |
| Graxa | Caído + terreno difícil | inflamável |
| Óleo / Pólvora | — | + Fogo → explosão (pólvora: 2d6 fogo + 2d6 força) e superfície de Fogo |
| Fogo | 1d4 fogo + Queimando | — |
| Sangue / Álcool | — | + Frio → Gelo; álcool + Fogo → Fogo |
| Ácido | condição Ácido, CA −2 | — |
| Teia | Enredado + terreno difícil | — |
| Espinhos | 2d4 perfurante a cada 1,5 m percorrido | — |

O terreno difícil dobra o custo de movimento e criaturas voadoras ignoram superfícies ([bg3.wiki: Surfaces](https://bg3.wiki/wiki/Surfaces)). A condição **Molhado** impede Queimando, dá resistência a fogo e vulnerabilidade a raio e frio ([bg3.wiki](https://bg3.wiki/wiki/D%26D_5e_rule_changes)). Molhado fecha o ciclo tático "molhar e depois eletrocutar", o mais memorável do jogo. A página não traz CDs nem durações das superfícies, então esses números terão de ser desenhados e balanceados pela equipe.

A verticalidade vem de três sistemas com números públicos:

- **Terreno elevado**: +2 para acertar quando o atacante está pelo menos 2,5 m acima do alvo e −2 quando está 2,5 m abaixo. Disparos para baixo também ganham alcance ([bg3.wiki: High ground](https://bg3.wiki/wiki/High_ground)).
- **Empurrar**: Ação Bônus com alcance de 1,5 m. O teste de Atletismo vai contra CD 10 + a maior entre Atletismo e Acrobacia do alvo. Exige que For × 12 seja pelo menos o peso do alvo. A distância vai de 1 a 6 m, e empurrar para um abismo mata ([bg3.wiki: Shove](https://bg3.wiki/wiki/Shove)).
- **Queda**: menos de 4 m não causa dano. Acima disso o dano é proporcional ao PV máximo, e a fórmula do wiki é experimental e internamente inconsistente ([bg3.wiki: Falling damage](https://bg3.wiki/wiki/Falling_damage)).

Para um jogo de mesa, a recomendação é substituir a fórmula percentual de queda pela regra do SRD (1d6 por 3 m) e manter o limiar de 4 m como opção.

O **terreno destrutível** não tem fonte primária nas notas. Barris explosivos e objetos com PV e CA vêm de conhecimento prévio do BG3 e das tabelas de objetos do DMG. Como desenho, o caminho natural é tratar cada objeto (ponte, corda, coluna, barril) como entidade com PV, CA e resistências. Destruir uma ponte remove arestas do grafo de pathfinding e aplica queda a quem estava sobre ela. Destruir um barril gera uma superfície pela tabela acima.

O mapa é um array 2D tipado (id do tile + PV/estado) no pacote compartilhado. O servidor transmite só os tiles alterados. A métrica de distância deve ser plugável: `chebyshev` (diagonal = 5 ft), `5-10-5` ou euclidiana em metros, que é a escolha do BG3 com 1,5 m = 5 ft ([bg3.wiki: Shove](https://bg3.wiki/wiki/Shove)).

## Arquitetura: o PC do Mestre é a única fonte da verdade

### Copie o modelo de documentos do Foundry, não o de CRDTs

O Foundry VTT é o análogo mais próximo do Mesa-RPG: um servidor Node auto-hospedado, dono do banco, que recebe pedidos de `create`, `update` e `delete` sobre "Documents" tipados. O fluxo de uma alteração tem quatro passos ([Foundry API v12: ClientDatabaseBackend](https://foundryvtt.com/api/v12/classes/foundry.data.ClientDatabaseBackend.html)):

1. O cliente monta a operação com **arrays de deltas, não documentos inteiros**, e informa `parent` para filhos embutidos, como tokens dentro de uma cena.
2. O cliente envia a operação como requisição websocket.
3. O servidor valida e persiste.
4. O servidor transmite o resultado aos demais clientes.

As permissões têm dois eixos:

- **Papel do usuário**: NONE, PLAYER, TRUSTED, ASSISTANT, GAMEMASTER. O GAMEMASTER "vê todos os documentos" ([USER_ROLES](https://foundryvtt.com/api/v12/enums/foundry.CONST.USER_ROLES.html)).
- **Nível de propriedade por documento**: NONE (não vê), LIMITED (vê conteúdo reduzido), OBSERVER (vê como dono, sem editar), OWNER ([DOCUMENT_OWNERSHIP_LEVELS](https://foundryvtt.com/api/v12/enums/foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.html)).

Para o Mesa-RPG bastam os papéis Mestre e Jogador, mais um mapa `ownership: {[userId]: nível, default: nível}` por entidade.

O Owlbear Rodeo contribui com dois detalhes. O primeiro: no OBR 2.0 cada partida roda em seu próprio servidor isolado, depois que balancear muitas conexões WebSocket entre servidores se mostrou difícil de escalar e de atualizar ([OBR 2.0 Dev Log 4](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dev-log-4/)). O Mesa-RPG já nasce nesse modelo. O segundo: o jogador tem um **`id` estável entre reconexões e um `connectionId` novo a cada entrada** ([OBR player API](https://docs.owlbear.rodeo/extensions/apis/player)). Isso é essencial num celular, que dorme e reconecta o tempo todo. Permissões devem ser associadas ao `userId`, e sockets tratados como descartáveis.

CRDTs como Yjs e Automerge convergem sempre, mas são "difíceis de estender". Num Map do Yjs, por exemplo, incrementos concorrentes se perdem, porque o merge é *last-write-wins* por chave ([Rocicorp: Ready Player Two](https://rocicorp.dev/blog/ready-player-two)). Na comunidade Yjs, a tentativa de usar CRDT para estado de jogo esbarrou no caso de dois usuários pegando o mesmo assento. A solução proposta foi um árbitro central, o que "reintroduz a autoridade central" ([discuss.yjs.dev](https://discuss.yjs.dev/t/exploring-the-use-of-a-crdt-for-game-state/1487)). Um jogo por turnos, com regras e informação oculta, precisa justamente dessa autoridade. O padrão certo é o de comandos: o cliente envia nome e argumentos, o servidor aplica na ordem de chegada e o resultado é a verdade ([Ready Player Two](https://rocicorp.dev/blog/ready-player-two)). Yjs pode servir no máximo para notas compartilhadas.

### Pipeline de comando: validar, autorizar, reduzir, registrar, projetar

O pipeline recomendado tem seis passos:

1. `socket.emit("cmd", {commandId, type: "token.move", payload}, ack)`.
2. Validação do payload com zod.
3. Checagem de papel e propriedade.
4. Execução de um *reducer* puro com Immer `produceWithPatches`, que devolve `[novoEstado, patches, inversePatches]` ([Immer: Patches](https://immerjs.github.io/immer/patches/)).
5. Gravação de um evento `{seq, type, actorUserId, payload, patches, inverse}`.
6. Transmissão de patches filtrados com `seq` e ack `{ok, seq}` ao remetente.

Os patches inversos dão o "desfazer" do Mestre de graça. Como os patches do Immer são "corretos, não mínimos", talvez convenha pós-processá-los ([Immer](https://immerjs.github.io/immer/patches/)). Atualização otimista só vale para arrastar tokens. HP, turno e dano esperam o ack, porque a latência em LAN num jogo por turnos é irrelevante. Já houve relato de "quicar" visível quando muitos usuários moviam coisas ao mesmo tempo com otimismo contra um servidor autoritativo ([discuss.yjs.dev](https://discuss.yjs.dev/t/exploring-the-use-of-a-crdt-for-game-state/1487)).

### Informação oculta: filtre no servidor, nunca esconda no cliente

Esconder no cliente vaza para quem abre o devtools. O servidor precisa de uma camada pura `projectStateFor(usuario, estado)` e de sua gêmea `projectPatchFor(usuario, patch)`. Essa camada:

- remove tokens `hidden` para quem não é Mestre;
- troca o PV de monstros por um status grosseiro ("ileso / ferido / caído");
- elimina notas do Mestre e resultados secretos, que vão só para a sala do Mestre enquanto os jogadores recebem "o Mestre rolou em segredo";
- envia de fog of war **apenas as células ou polígonos revelados**.

O Socket.io facilita isso. Cada socket entra numa sala com seu `userId` e o servidor usa `io.to(userId).emit(...)`. `io.except(sala)` alcança todos fora de uma sala, e as salas existem só no servidor, invisíveis para o cliente ([Socket.io Rooms](https://socket.io/docs/v4/rooms/)). Um detalhe sutil: revelar um token escondido é uma transição de visibilidade. O servidor deve enviar "adicionar entidade" aos jogadores, e não um patch de campo, porque eles nunca receberam o objeto base.

### Save/load é snapshot versionado mais log de eventos

O Foundry migrou o armazenamento de NeDB para LevelDB na v11 de forma "automática e não destrutiva", com sublevels que gravam mudanças parciais sem reescrever registros inteiros ([Foundry v11.292](https://foundryvtt.com/releases/11.292)). O equivalente no PostgreSQL usa três tabelas:

- `tables`;
- `snapshots(table_id, seq, schema_version, state jsonb)`, gravada a cada N eventos, no fim de cada rodada e no "Salvar" manual;
- `events(table_id, seq, type, actor_user_id, payload jsonb, inverse jsonb)`, com `(table_id, seq)` único.

Carregar é: último snapshot → migrações puras `(estado) => estado` por versão → *replay* dos eventos posteriores. A exportação é um arquivo `.mesa.json` com `{format, schemaVersion, state, assets[]}`, validado com zod na importação. Os eventos são persistidos em lotes assíncronos para que o loop do socket nunca espere o disco. Tabelas normalizadas ficam só para o conteúdo de biblioteca: personagens, itens e modelos de monstro.

### Socket.io: JWT no handshake, recovery como bônus, resync como garantia

A autenticação é `io({ auth: (cb) => cb({ token }) })`, na forma de função para renovar o token a cada reconexão. A validação fica num middleware `io.use()`, e todo caminho precisa chamar `next()`, senão a conexão trava ([Socket.io Middlewares](https://socket.io/docs/v4/middlewares/)).

O `connectionStateRecovery` (por exemplo, `maxDisconnectionDuration` de 2 min) preserva salas, dados e pacotes perdidos depois de uma queda. O adaptador em memória padrão suporta esse recurso. Mas a documentação avisa que ele "nem sempre terá sucesso", e `skipMiddlewares: true` é um risco de segurança ([Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery)).

A entrega padrão é *at-most-once*, com ordem preservada. Para *at-least-once* do cliente ao servidor, use `retries` com `ackTimeout`. No sentido inverso, use ids de evento persistidos e o último *offset* do cliente ([Delivery Guarantees](https://socket.io/docs/v4/delivery-guarantees)).

O protocolo de ressincronização, então, depende do que o cliente envia em `auth: {token, lastSeq}`:

- se `socket.recovered`, nada a fazer;
- se `lastSeq` ainda está na janela do log, o servidor envia os eventos redigidos que faltam;
- caso contrário, envia um snapshot redigido completo.

O cliente ignora `seq` repetidos e pede resync quando detecta lacunas. O `commandId` (UUID) permite descartar retries duplicados. Com menos de 20 sockets num único processo, Redis não é necessário. Um rate limit por usuário com orçamento maior para `token.drag` (cerca de 20 Hz, sem persistência) e `maxHttpBufferSize` baixo completam o quadro. Essas duas medidas são prática padrão, não estão documentadas nas fontes.

### Acesso em LAN funciona em HTTP puro, mas o PWA exige HTTPS

Escute em `0.0.0.0`, sirva o cliente do jogador **na mesma origem e porta do Socket.io** (isso elimina CORS) e mostre no painel do Host um QR com `http://<ip-lan>:<porta>/join?code=XXXX`. Há um limite: `http://192.168.x.x` não é contexto seguro, e **só contextos seguros podem registrar service workers**. Sem HTTPS não há instalação de PWA, e `getUserMedia` também fica bloqueado ([MDN Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts); [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/navigator/mediaDevices.getUserMedia)).

Para jogadores remotos há duas opções:

- **Cloudflare Quick Tunnel** (`cloudflared tunnel --url http://localhost:8080`): dá HTTPS em `*.trycloudflare.com` sem conta, mas tem teto de **200 requisições simultâneas** e nenhum SLA ([TryCloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)).
- **Tailscale Funnel**: expõe o serviço publicamente em `*.ts.net` com certificado automático, mas só nas portas 443, 8443 e 10000, e ainda está em beta ([Tailscale Funnel](https://tailscale.com/kb/1223/funnel)).

Nenhuma das duas páginas menciona WebSocket explicitamente. Teste antes. O *fallback* para long-polling do Socket.io funciona mesmo se o WS falhar, mas consome o teto de requisições do Quick Tunnel. A v1 mais simples é **HTTP puro na LAN, sem PWA, mais túnel opcional para quem joga de casa**, sempre com JWT e código de mesa, porque a URL do túnel é pública.

## Stack: escolhas atuais e uma armadilha de versão no Prisma

| Camada | Escolha | Por quê |
|---|---|---|
| ORM | **Prisma 7.10 (fixar `^7`)** + `@prisma/adapter-pg` | Soft delete via `$extends`; o 8 ainda é RC e não tem `$extends` |
| Alternativas | Drizzle 0.45 / Sequelize 6 | Drizzle 1.0 ainda é RC e não tem soft delete nativo; Sequelize tem modo *paranoid*, mas a v7 segue alfa |
| Grid | **PixiJS 8.22 + @pixi/react 8** | Renderizador, não framework: o estado fica no motor de regras |
| Alternativa de grid | Phaser 4.2 | Cenas, câmeras, loader Tiled nativo e `TilemapGPULayer` |
| Frontend | React 19.3, Vite 8.3, Tailwind 4.3, Zustand 5, vite-plugin-pwa 2.0 | Mainstream e atual |
| Monorepo | **pnpm + Turborepo 2.11** | `packages/shared` com tipos, zod, mapa de eventos e regras |
| Testes | **Vitest 5** + Supertest + Postgres real (Testcontainers ou compose) | Jest ainda trata ESM como experimental |
| Auth | **Argon2id** (m=19 MiB, t=2, p=1) + JWT curto + refresh em cookie HttpOnly | Recomendação da OWASP |

As versões vêm do registro npm em 20/10/2026 ([npm registry](https://registry.npmjs.org/)).

O ponto mais traiçoeiro é o Prisma. **O dist-tag `latest` do pacote `prisma` aponta para 8.0.0-rc.23**, então um `npm install prisma` instala o RC ([npm](https://registry.npmjs.org/prisma)). Ao Prisma 8 faltam `$extends`, filtros em JSON, `increment` atômico, a maioria das escritas aninhadas e os códigos de erro do tipo P2002. A própria documentação manda fixar em `^7` ([Prisma release status](https://www.prisma.io/docs/orm/release-status)). Há conflito sobre o suporte ao 7 depois do GA do 8: a página de status fala em 18 meses e um post do líder do Prisma 8 fala em 12 ([Prisma blog](https://www.prisma.io/blog/is-prisma-8-ready-for-long-lived-production-apps)).

O Prisma 7 também mudou a configuração ([Prisma changelog 7.0](https://www.prisma.io/changelog/2025-11-19)):

- exige *driver adapter*;
- move a URL do banco para `prisma.config.ts`;
- não carrega mais `.env` sozinho;
- exige `output` no gerador;
- não roda seed implícito.

O soft delete se faz com uma *query extension* em `$allModels.$allOperations`. Ela pode reescrever `args.where` (injetar `deletedAt: null`), mas **não pode alterar `include`/`select`** ([Prisma: query extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query)). Em consequência, relações incluídas precisam de `where: {deletedAt: null}` explícito. Essa é a principal desvantagem em relação ao *paranoid* do Sequelize, que filtra automaticamente e oferece `restore()` e `destroy({force: true})` ([Sequelize paranoid](https://sequelize.org/docs/v6/core-concepts/paranoid/)). O desenho completo:

- `deletedAt` em User, Character, Campaign, Item e Sheet;
- `delete` reescrito como `update`;
- um cliente "admin" sem filtro para restaurar ou expurgar registros;
- **índices únicos parciais** `WHERE "deletedAt" IS NULL`, criados por migração SQL manual, para que um e-mail apagado possa se cadastrar de novo.

No grid, o Pixi vence por ser só renderizador: Zustand e o motor compartilhado guardam o estado, e o Pixi desenha. Para tiles destrutíveis basta reconstruir o *chunk* alterado, e mapas táticos de 30×30 a 64×64 cabem com folga. O Phaser 4, lançado em abril de 2026, é a escolha "com baterias". Seu `TilemapGPULayer` desenha uma camada inteira como um único quad, um ganho em celular ([Phaser 3 vs Phaser 4](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)). Ainda não está confirmado se ele aceita edição de tiles em tempo de execução de forma eficiente. Em qualquer caso, desligue a renderização contínua num jogo por turnos para poupar bateria.

No monorepo, siga o guia do Turborepo ([Turborepo TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript)):

- um pacote `@repo/typescript-config`;
- `exports` com `types` apontando para o código-fonte;
- compilação das libs internas com `tsc`;
- uma tarefa `check-types`;
- **nada de Project References nem tsconfig na raiz**.

O TypeScript 7 (compilador nativo) já é o `latest` no npm. Sem compatibilidade verificada com Prisma, Vitest e typescript-eslint, fixar o TS 5.9.x é a escolha prudente; o Prisma 8 exige TS ≥ 5.9 ([Prisma release status](https://www.prisma.io/docs/orm/release-status)).

Nos testes, o Vitest 5 exige Vite ≥ 6.4 e Node ≥ 22.12 ([Vitest 5](https://vitest.dev/blog/vitest-5)). O Jest ainda depende de `--experimental-vm-modules` para ESM ([Jest ESM](https://jestjs.io/docs/ecmascript-modules)). O Socket.io recomenda testes de integração reais: servidor HTTP numa porta aleatória, `socket.io-client` conectado em `beforeAll` e verificação de `emitWithAck()` ([Socket.io testing](https://socket.io/docs/v4/testing/)). Para isso, exporte `createApp()` separado de `listen()`. Evite o pg-mem com Prisma e use Postgres real. Na autenticação, a OWASP prefere **Argon2id com no mínimo m=19456 KiB, t=2, p=1** e reserva o bcrypt para legado, por causa do limite de 72 bytes ([OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Para jogadores no celular, um código de convite que gera uma conta de jogador evita cadastro com senha.

## Licenciamento: o SRD é a única licença que serve para um jogo

### Atribuição exata do SRD e nada além dela

O SRD 5.2 em CC-BY-4.0 permite uso livre, inclusive comercial, desde que a obra traga a declaração literal: *"This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode."*. O texto legal pede para **não incluir nenhuma outra atribuição à Wizards** e permite dizer "compatible with fifth edition" ou "5E compatible" ([SRD 5.2 legal](https://mailbun.codeberg.page/dnd-srd5.5-mdbook/Book/00_Legal.html)). Falta confirmar no PDF do 5.2.1 se a frase cita "5.2" ou "5.2.1".

Ficam fora do SRD, entre outros, o Artífice, o Aasimar e o Beholder. O SRD 5.2 renomeou o Deck of Many Things para "Mysterious Deck" por questão de marca ([D&D Beyond SRD](https://www.dndbeyond.com/srd)). O SRD 5.1 reserva termos como Sigil e Underdark e exclui devoradores de mente ([GeekWire](https://www.geekwire.com/2023/after-fan-outcry-wizards-of-the-coast-will-leave-its-original-open-license-in-place/)).

A **Fan Content Policy da Wizards** é inadequada para este projeto. Ela proíbe usar a propriedade da Wizards em outros jogos e incorporar mecânicas fora da OGL, e pode ser revogada a qualquer momento ([Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)). A conclusão é usar **somente o SRD**, nunca "D&D" nem o logo do E comercial, e reescrever qualquer criatura que não esteja no SRD. Como a CC-BY também exige indicar modificações, acrescente "modificado/adaptado" no arquivo de atribuição.

### BG3: mecânicas são livres, expressão não é

A lei americana (17 U.S.C. §102(b)) exclui de proteção "ideia, procedimento, processo, sistema, método de operação". Nomes de jogos e métodos de jogo não são protegidos por copyright. Mas no caso *Tetris v. Xio* o tribunal protegeu o estilo visual específico, um aviso de que um clone visual próximo infringe mesmo com regras livres ([ABA Landslide](https://www.americanbar.org/groups/intellectual_property_law/resources/landslide/archive/why-videogame-rules-are-not-expression-protected-copyright-law/)).

Portanto, economia de ações, superfícies elementais, terreno elevado, empurrar e pular estão liberados. Ficam de fora:

- companheiros e lugares do BG3 (Astarion, Faerûn, Baldur's Gate);
- ícones, fontes e interface do BG3;
- textos de magias do BG3;
- nomes como "Karmic Dice" e "Hellfire".

A política da Larian proíbe logos, proíbe vender mods e **proíbe usar a propriedade dela para gerar ou treinar IA**. Conteúdo derivado do BG3 cai em termos próprios, que não foram lidos ([Larian Fan Content Policy](https://larian.com/fan-content-policy)). E o dono do cenário é agressivo: em 2025 a Wizards emitiu DMCA contra o mod gratuito "Baldur's Village" apesar do elogio do CEO da Larian. A retirada posterior do pedido não foi confirmada ([Techdirt](https://www.techdirt.com/2025/04/08/wotc-dmcas-stardew-valley-bg3-mod-despite-larians-endorsement/)).

### Percy Jackson: use o mito, renomeie a obra

"PERCY JACKSON & THE OLYMPIANS" é marca registrada nos EUA (registro 3841393, renovada em 2020), em nome da Twentieth Century Fox, hoje uma empresa Disney, na classe de entretenimento ([Justia](https://trademarks.justia.com/779/32/percy-jackson-the-77932163.html)). "Camp Half-Blood" é marca de série, com novos romances anunciados em maio de 2026 ([News4Jax](https://www.news4jax.com/entertainment/2026/05/12/rick-riordan-unveils-new-camp-half-blood-novels-starting-this-fall/)). Riordan tolera fanfic "para diversão pessoal e não para publicação profissional" ([Goodreads](https://www.goodreads.com/questions/2940925-so-i-saw-a-question-from-about-8-years)), e não foi encontrada nenhuma política formal para jogos de fã. Trate isso como "nenhuma licença concedida".

A ideia de "filhos de deuses treinados num refúgio oculto" não é protegida. O risco cresce à medida que a seleção de detalhes espelha os livros: Camp Half-Blood, Bronze Celestial, a espada-caneta Contracorrente, chalés numerados por pai divino, a Névoa, Annabeth e Grover. Há ainda uma armadilha de nome: **"Heróis do Olimpo"/"Heroes of Olympus" também é título de série de Riordan**.

As alternativas seguras vêm do próprio mito:

- Quíron treinava heróis numa caverna do **Monte Pélion**, o que sugere um "Refúgio de Pélion" como base dos heróis;
- o metal divino pode ser **oricalco** (Platão) ou **adamante**;
- os nomes do jogo podem ser "Hemítheoi" ou "Filhos de Pélion".

### Material de domínio público para o jogo

Os doze olímpicos e seus domínios estão bem documentados ([Theoi](https://www.theoi.com/greek-mythology/olympian-gods.html)) e viram a escolha de "ascendência divina" na criação. Os símbolos e as bênçãos abaixo são sugestões de design a partir de conhecimento mitográfico geral, e devem ser conferidos verbete a verbete no Theoi.

| Ascendência | Domínio | Bênção sugerida |
|---|---|---|
| Zeus | céu, clima, lei | resistência a raio/trovão; explosão trovejante 1/descanso longo |
| Poseidon | mar, cavalos, terremotos | deslocamento de natação, respirar na água; interage com superfícies de Água |
| Atena | estratégia, ofícios | bônus tático de iniciativa; perícia em História |
| Apolo | música, cura, arquearia | bônus à distância ou cura |
| Ártemis | caça, lua | visão no escuro, Sobrevivência |
| Ares | guerra | dano extra quando ferido; Intimidação |
| Hefesto | forja, fogo | resistência a fogo; reparar objetos destrutíveis |
| Hermes | viagem, ladrões | +deslocamento; Desengajar como Ação Bônus |
| Hades / Héstia / Dioniso / Afrodite / Deméter / Hera | submundo / lar / vinho / amor / colheita / matrimônio | necrótico e invisibilidade / cura no descanso / resistência a veneno / persuasão / crescimento de plantas / proteção de aliados |

O bestiário tem fontes clássicas claras:

- **Doze Trabalhos de Hércules**: Leão de Nemeia, Hidra de Lerna, Aves do Estínfalo, Cérbero.
- **Odisseia**: Polifemo, Sereias, Cila e Caríbdis.
- **Argonáuticas**: Talos, Harpias, touros de bronze.
- **Hesíodo**: Tífon e Équidna, as Górgonas.
- **Lugares**: Olimpo, Ótris, Delfos, Creta e o Labirinto, os cinco rios do Submundo, Ogígia, Eeia, Etna.

Talos, o gigante de bronze, combina com terreno destrutível. As superfícies também têm leitura mitológica natural: o Flegetonte vira lava, o Estige vira água amaldiçoada e o Lete vira uma água que causa esquecimento.

Vários monstros gregos (minotauro, medusa, hidra, quimera, ciclope, harpia) provavelmente já têm ficha no SRD, mas a lista de monstros do 5.2.1 não foi conferida. Confira cada um no PDF antes de usá-lo. Os textos de lore devem ser escritos do zero.

O repositório deve ter:

- uma licença de código (MIT ou Apache-2.0);
- uma licença de conteúdo;
- um `ATTRIBUTION.md` com a frase literal do SRD, a nota de modificação e os créditos de cada asset (a licença do game-icons.net, lembrada como CC BY 3.0, precisa ser verificada);
- um aviso genérico de não afiliação com Wizards, Larian, Riordan e Disney;
- um contato para pedidos de retirada.

## Conclusão

O padrão de todo o estudo é que **regras são livres e autoridade é barata quando a mesa é uma só**. A tentação natural seria clonar o BG3 e espalhar estado por CRDTs e nuvem. O resultado mostra o inverso: o maior valor do BG3 está numa tabela de transformações de superfícies e em alguns números de verticalidade, todos mecânicas sem proteção. E o PC do Mestre, por ser único, dispensa justamente a infraestrutura que tornaria o projeto caro. A peça de engenharia que mais pede cuidado não é o grid nem o banco. É a camada de **projeção por destinatário**. Dados secretos, monstros ocultos, fog of war e PV "ferido" dependem todos dela, e um erro nela vaza segredos de forma silenciosa. Ela merece testes de integração próprios desde o primeiro dia.

Dois riscos ficam abertos e devem ser resolvidos com testes curtos, não com mais pesquisa. O primeiro é se WebSocket atravessa o Quick Tunnel e o Funnel nas condições reais de um celular em 4G. O segundo é se o ecossistema aceita TS 7 e Prisma 8 até a data de lançamento, já que o GA do Prisma 8 estava previsto para outubro de 2026 e a escolha de `^7` pode precisar ser revista em poucos meses. No plano legal, o risco cai quase a zero com uma regra simples. Tudo o que vier do SRD leva a atribuição literal; tudo o que vier do mito é escrito do zero; e nada que venha de Riordan, Larian ou Forgotten Realms entra no jogo, nem no nome do repositório.
