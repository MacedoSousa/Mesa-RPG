# ⚡ Mesa RPG

RPG de mesa tático para jogar em casa, com o **PC do Mestre como Host** e os jogadores no **navegador ou celular**.
As regras vêm do D&D 5e (SRD). O combate tático, com superfícies e cenário destrutível, é inspirado em *Baldur's Gate 3*.
O tema é mitologia grega no estilo *Percy Jackson*: semideuses, pais olímpicos e monstros dos mitos.

> **Versão:** 0.2.0-alpha. Projeto pessoal e recreativo, para jogar com família e amigos (veja [Avisos](#avisos)).
>
> 🎬 **Primeira vez como Mestre?** Comece por [`docs/GUIA_PRIMEIRA_SESSAO.md`](docs/GUIA_PRIMEIRA_SESSAO.md) e pela aba **🎬 Roteiro** do Host. O vídeo de apresentação está em [`docs/video/mesa-rpg-apresentacao.mp4`](docs/video/mesa-rpg-apresentacao.mp4).

---

## Sumário

- [Como funciona](#como-funciona)
- [Começando rápido](#começando-rápido)
- [Jogando na rede de casa](#jogando-na-rede-de-casa)
- [Arquitetura](#arquitetura)
- [Banco de dados e Soft Delete](#banco-de-dados-e-soft-delete)
- [Regras implementadas](#regras-implementadas)
- [Permissões (RBAC)](#permissões-rbac)
- [API REST](#api-rest)
- [Protocolo WebSocket](#protocolo-websocket)
- [Testes](#testes)
- [Criando suas próprias aventuras](#criando-suas-próprias-aventuras)
- [Avisos](#avisos)

---

## Como funciona

```
          PC do Mestre (Host)                         Jogadores (Wi-Fi de casa)
┌──────────────────────────────────────┐        ┌───────────────────────────────┐
│  Navegador: HUD do Mestre (/host)    │        │  Celular / notebook (/)       │
│      │                               │        │  - Criação de personagem      │
│      ▼  WebSocket + REST             │◄──────►│  - HUD do jogador (PV/Estam.) │
│  Node.js (Express + Socket.io)       │  LAN   │  - Mapa tático, dados, guia   │
│   └─ Motor de regras (@mesa/shared)  │        └───────────────────────────────┘
│  PostgreSQL (Docker)                 │
└──────────────────────────────────────┘
```

- **O servidor é a autoridade.** Os clientes só enviam *intenções* (mover, atacar, rolar).
  O servidor valida permissão, turno e regras, aplica e devolve o estado.
- **Cada pessoa recebe só o que pode ver.** Monstros ocultos, rolagens secretas, PV de monstros e quests escondidas nunca saem do servidor para os jogadores.
- **Tudo é salvo.** Snapshots versionados (manuais e automáticos) e um histórico de eventos permitem parar e retomar exatamente de onde pararam.

---

## Começando rápido

**Pré-requisitos:** Node.js 22.12 ou superior e Docker Desktop (para o PostgreSQL). No Windows, rode os comandos no PowerShell ou no terminal do VS Code.

```bash
git clone https://github.com/MacedoSousa/Mesa-RPG.git
cd Mesa-RPG
npm install                      # instala todos os workspaces
npm run db:up                    # sobe o PostgreSQL (cria mesa_rpg e mesa_rpg_test)
cp server/.env.example server/.env
#   → edite server/.env e troque JWT_SECRET, JWT_REFRESH_SECRET e MASTER_INVITE_CODE
npm run migrate                  # cria as tabelas e o catálogo de itens
```

### Modo jogo (recomendado para a sessão)

```bash
npm run build                    # compila shared, server e os dois clientes
npm start                        # sobe tudo na porta 3333
```

- **Mestre:** abra `http://localhost:3333/host` no PC e crie a primeira conta. **O primeiro cadastro do servidor vira Mestre.**
- **Jogadores:** abrem o endereço de rede mostrado no terminal (ex.: `http://192.168.0.10:3333`), ou escaneiam o QR code no HUD do Mestre.

### Modo desenvolvimento (hot reload)

```bash
npm run dev
```

| Serviço | Endereço |
|---|---|
| API + WebSocket | http://localhost:3333 |
| Cliente do Jogador (Vite) | http://localhost:5173 |
| HUD do Mestre (Vite) | http://localhost:5174/host/ |

O Vite encaminha `/api` e `/socket.io` para o servidor, então os cookies e o WebSocket funcionam como em produção.

### Contas e papéis

- **O papel vale por campanha.** Quem cria a campanha é o Mestre *dela*. Nas campanhas dos outros, essa mesma conta joga normalmente pelo endereço sem `/host`.
- **Primeira conta do servidor = Mestre.** Nas contas seguintes, quem quiser mestrar usa o **código de Mestre** (`MASTER_INVITE_CODE` no `server/.env`, também mostrado no terminal ao iniciar). Ele pode ser usado no cadastro ou depois, em **"👑 Virar Mestre"**, na tela inicial do jogador ou no `/host`.
  - Espaços nas pontas e maiúsculas/minúsculas são ignorados.
  - Não confunda com o **código da campanha** (6 letras, ex.: `K7QX2M`), que é o que os jogadores usam para entrar numa mesa.
- **Amigos que já têm conta:** abrem o endereço ou o QR code, tocam em **Entrar** com o usuário e a senha de sempre, escolhem o herói e digitam o código da campanha. O mesmo herói pode ir para campanhas diferentes.
- **Trocar quem mestra:** se outra pessoa vai mestrar no seu PC, ela entra no `/host` com a conta dela (já liberada com o código de Mestre). Você abre o cliente de jogador no celular ou em outra aba anônima.
- **Para conferir se o banco está ok:** abra `http://localhost:3333/api/health`. Deve mostrar `"database": "ok"`.

### Fluxo da primeira sessão

1. **Mestre:** cria a campanha no HUD e recebe um código de convite (ex.: `K7QX2M`) com QR code.
2. **Jogadores:** criam conta, criam o personagem no assistente de 4 passos e entram com o código.
3. **Mestre:** na aba **🎬 Roteiro**, escolhe o capítulo e carrega a cena pronta (mapa, monstros, baús e quests aparecem sozinhos). Também dá para escolher um mapa (Acampamento Meio-Sangue, Submundo, Olimpo, Rio Hudson ou um desenhado por ele) e montar tudo à mão.
4. Salve com 💾 quando quiser parar. O autosave roda a cada 60 s.

---

## Jogando na rede de casa

- O servidor escuta em `0.0.0.0`. Se o celular não conectar, libere a porta `3333` no **Firewall do Windows** (o Node pede permissão na primeira execução; marque "Redes privadas").
- O celular precisa estar no **mesmo Wi-Fi** que o PC. Redes de convidados costumam isolar os aparelhos.
- O acesso é HTTP puro na rede local. O jogo funciona normalmente, mas o navegador não permite "instalar como app" (PWA), porque isso exige HTTPS.
- **Jogadores fora de casa:** use um túnel como [Tailscale](https://tailscale.com) (cada jogador instala) ou o Cloudflare Tunnel. Teste o WebSocket antes da sessão.

## Ligar sozinho e conferir que tudo carregou

Tudo o que importa fica guardado em disco e volta ao religar o PC:

| O quê | Onde fica |
|---|---|
| Contas, heróis, campanhas, mapas, saves | Banco PostgreSQL (volume do Docker `mesa_pgdata` ou o PostgreSQL do Ubuntu) |
| Estado da mesa no meio da sessão | Save automático a cada 60 s e ao desligar (o servidor salva ao receber o sinal de desligar) |
| Arte dos monstros e mapas pintados | `server/data/art/` |
| Configurações | `server/.env` |
| Modelos da IA | `~/ComfyUI/models/` |

**Ligar junto com o PC (Ubuntu):**
```bash
sudo ./scripts/instalar-servicos.sh
```
- Cria os serviços `mesa-rpg` e `comfyui` (este se houver `~/ComfyUI`).
- Liga o banco (Docker ou PostgreSQL) no boot e reinicia o que cair.
- Se o banco demorar a subir, o servidor espera até 2 minutos antes de desistir.
- Para desfazer: `--remover`.

**Corrigir o `server/.env`** (faz backup antes):
```bash
DOMINIO=mesarpgweb.duckdns.org ./scripts/corrigir-env.sh
```
- Remove `\r` do Windows, aspas e espaços sobrando, e chaves repetidas.
- Completa o que falta com o `.env.example`.
- Troca os segredos JWT fracos (de exemplo, curtos ou com palavras comuns) por segredos fortes. Para trocar de qualquer jeito: `./scripts/corrigir-env.sh --trocar-jwt`. Todos precisam entrar de novo uma vez; contas e heróis não se perdem.
- Libera o endereço do DuckDNS.
- Testa o banco e, se não conectar, procura onde ele está.

**Conferir depois de ligar:**
```bash
./scripts/verificar.sh
DOMINIO=mesarpgweb.duckdns.org ./scripts/verificar.sh   # confere também o DuckDNS
```
- O script espera o servidor responder e mostra ✅/⚠️/❌ para:
  - serviços;
  - banco e estrutura do banco;
  - contas e heróis, e o último save;
  - `.env`;
  - imagens;
  - espaço em disco;
  - telas;
  - IA.
- A mesma checagem aparece no log do servidor ao ligar (`journalctl -u mesa-rpg -n 30`) e no botão **🩺** do topo do Host.

---

## Arquitetura

Monorepo com **npm workspaces**:

```
Mesa-RPG/
├── shared/          @mesa/shared: motor de regras puro (TypeScript, sem I/O)
│   ├── src/rules/       atributos, point-buy, ficha, restrição de equipamento
│   ├── src/content/     raças, divindades, classes, itens, monstros, mapas, guia
│   ├── src/engine/      estado da mesa, comandos (zod), reducer, combate,
│   │                    superfícies, destruição, pathfinding, visibilidade, saves
│   ├── src/dice.ts      motor de dados (NdX, kh/kl, críticos, RNG injetável)
│   └── tests/           testes unitários do motor
├── server/          API REST + Socket.io + PostgreSQL (Sequelize)
│   ├── src/config/      env (validado com zod) e conexão
│   ├── src/models/      User, Campaign, CampaignMember, Character, CharacterSheet,
│   │                    InventoryItem, Item, GameMap, SaveGame, GameEvent
│   ├── src/database/    migrações (Umzug), seed do catálogo, CLI
│   ├── src/services/    regras de negócio (auth, personagens, campanhas, itens)
│   ├── src/controllers/ camada HTTP
│   ├── src/game/        TableManager: mesas ao vivo, fila de comandos, autosave, timers
│   ├── src/sockets/     autenticação JWT, join, comandos, ressincronização
│   └── tests/           testes de integração (Supertest + Socket.io + Postgres real)
├── client-common/   código de navegador compartilhado: API, stores, mapa PixiJS, UI
├── client-host/     HUD do Mestre (React + Vite + Tailwind), servido em /host
├── client-web/      cliente do Jogador, mobile-first, servido em /
└── docs/            Guia para Novatos e relatório de pesquisa
```

### Decisões técnicas

| Camada | Escolha | Por quê |
|---|---|---|
| Regras | Pacote `shared` puro | O mesmo código valida no servidor e desenha prévias no cliente (alcance de movimento, itens bloqueados). |
| Sincronização | Servidor autoritativo + comandos | CRDTs resolvem conflitos com "última escrita vence" e não aplicam regras de jogo. Num jogo por turnos, validar no Host é mais simples e seguro. |
| Estado → clientes | Snapshot projetado por destinatário + `seq` | Com poucos jogadores numa LAN o estado inteiro é pequeno; o `seq` descarta mensagens fora de ordem e permite ressincronizar. |
| ORM | **Sequelize 6** (`paranoid`) | O soft delete é nativo e vale também para `include`. O Prisma 7 exige uma extensão própria que não filtra relações. |
| Senhas | Argon2id (parâmetros OWASP) | Recomendação atual; bcrypt trunca senhas em 72 bytes. |
| Sessão | Access JWT (15 min) em memória + refresh JWT em cookie HttpOnly | O JavaScript nunca vê o token longo. "Sair de todos os dispositivos" invalida tudo via `token_version`. |
| Mapa | PixiJS 8 (WebGL) | Leve no celular. O estado do grid fica no motor; o Pixi só desenha. |
| Ícones | SVG originais (`client-common/src/tokenArt.ts`) | Um por classe e por monstro, sem assets de terceiros. Fáceis de editar ou trocar. |
| Testes | Jest + ts-jest, Supertest, socket.io-client | Testes contra um PostgreSQL de verdade (sem mocks de banco). |

### Fluxo de um comando

```
Cliente  ── table:command {commandId, command} ──►  Socket.io
                                                     │ JWT ok? rate limit ok? zod ok?
                                                     ▼
                                               TableManager (fila por mesa)
                                                     │ id duplicado? → devolve seq anterior
                                                     ▼
                                    applyCommand(estado, ator, comando)   ← @mesa/shared
                                      authorize: papel, posse do token, turno, pausa
                                      execute numa CÓPIA (erro = estado intacto)
                                                     │
                     ┌───────────────────────────────┼────────────────────────────┐
                     ▼                               ▼                            ▼
          efeitos colaterais no banco     log → game_events          broadcast: projectStateFor(viewer)
          (PV, poções, afinidade, ban)                                + efeitos visuais (fx)
```

---

## Banco de dados e Soft Delete

PostgreSQL 16. Migrações em `server/src/database/migrations`, executadas pelo Umzug (`npm run migrate`; o servidor também aplica as pendentes ao iniciar).

| Tabela | Soft delete | Descrição |
|---|:-:|---|
| `users` | ✅ | Contas (`MASTER` / `PLAYER`), hash Argon2id, `token_version` |
| `campaigns` | ✅ | Campanhas do Mestre, código de convite |
| `campaign_members` | — | Jogador na campanha (`ativo` / `banido`) |
| `characters` | ✅ | Personagem: raça, divindade, classe, atributos base, perícias, equipamento, PV, estamina, afinidade |
| `character_sheets` | ✅ | Ficha narrativa: história, personalidade, aparência, anotações |
| `inventory_items` | — | Itens do personagem e quantidades |
| `items` | ✅ | Catálogo base (seed) e itens personalizados por campanha |
| `game_maps` | ✅ | Mapas salvos da campanha |
| `save_games` | ✅ | Snapshots versionados do estado da mesa (manual/auto) |
| `game_events` | — | Histórico append-only de turnos e eventos |

**Como funciona o soft delete:**

- `destroy()` só preenche `deleted_at`, e as consultas ignoram registros removidos automaticamente (Sequelize `paranoid`).
- Os índices únicos são **parciais** (`WHERE deleted_at IS NULL`): uma conta excluída libera o username e o e-mail.
- Excluir a conta remove (logicamente) usuário, personagens, fichas e campanhas que ele mestra. Excluir um personagem remove também a ficha.
- Há rotas `POST .../restore` para personagens e campanhas.

---

## Regras implementadas

### Criação de personagem (4 passos)

1. **Raça:** Semideus, Caçador(a) de Ártemis, Sátiro, Ninfa, Legado ou Ciclope Jovem. Cada uma dá bônus de atributo e traços passivos (PV extra, resistências, visão no escuro, perícias, armas) e pode **restringir o pai divino** (Caçador(a) só com Ártemis, Sátiro com Pã/Dionísio…).
2. **Pai Olímpico:** 16 opções (Zeus, Poseidon, Hades, Atena, Ares, Apolo, Ártemis, Hefesto, Afrodite, Hermes, Dionísio, Deméter, Hécate, Nêmesis, Hipnos, Pã) ou *Não Reclamado*.
   - Cada um dá **+1 no atributo favorecido**, uma **bênção passiva** e, em alguns casos, um **poder elemental** (relâmpago, onda, labareda, geada, névoa tóxica…).
   - A **afinidade (0–100)** é ajustada pelo Mestre durante o jogo.
3. **Classe, atributos e perícias:** as 12 classes do SRD. Point-buy de **27 pontos** (valores 8–15 antes dos bônus) e a quantidade de perícias da classe.
4. **Inventário restrito:** cada item é checado contra a classe, a raça e o personagem:
   - proficiência de arma e armadura da classe;
   - Druida não usa metal;
   - Força mínima para armadura pesada;
   - divindade e afinidade (ex.: Arco de Apolo exige Apolo/Ártemis, Destreza 13 e afinidade 30);
   - raça (Legado não consome Ambrosia).

   Itens não permitidos aparecem **bloqueados com o motivo**. Também são validadas as regras de mãos: duas mãos impede escudo, e a mão secundária precisa de arma leve.

PV, CA, estamina, deslocamento, iniciativa e ataques são **calculados no servidor**.

> No 5e, usar equipamento sem proficiência é permitido com penalidade. Aqui o item fica **bloqueado**, porque é mais claro para quem está começando.

### Combate (estilo BG3)

- **Iniciativa:** d20 + Destreza (+ bônus). Empates são decididos pela Destreza.
- **Turnos estritos:** só age quem está no turno, e só sobre o próprio token.
- **Economia de ações por turno:**
  - **Ação:** atacar, Disparada, Desengajar, Esquivar ou poder divino.
  - **Ação Bônus:** empurrar ou usar poção.
  - **Reação:** ataque de oportunidade.
  - **Movimento:** em quadrados de 1,5 m; terreno difícil custa 2.
- **Ataques:**
  - d20 + bônus contra a CA do alvo. 20 natural é crítico (dobra os dados) e 1 natural sempre erra.
  - Vantagem e desvantagem se anulam. Atacar alguém caído ou inconsciente dá vantagem; atirar com inimigo adjacente dá desvantagem.
  - **Terreno elevado:** +2/−2.
  - Linha de visão por Bresenham.
  - **Bronze celestial** causa dano extra contra monstros.
- **Empurrar** um inimigo adjacente pode jogá-lo na água, na lava ou no abismo.
- **Condições:** caído, esquivando, molhado, envenenado, atordoado, amedrontado, enfeitiçado, inconsciente, desengajado.
- **Monstros agem:** no turno do monstro, o Mestre clica num ataque e no herói, ou usa **🤖 Agir sozinho**: o monstro anda até o alvo mais próximo e ataca com a melhor arma.
- **Dano automático:** acerto tira PV na hora. O Mestre também aplica dano/cura em vários tokens (valor, fórmula ou "última rolagem"), com metade para quem passou no teste.
- **Caído e morte:** herói a 0 PV fica inconsciente e faz testes contra a morte sozinho no início do turno (3 sucessos = estável, 3 falhas = morte, 20 natural = levanta com 1 PV).
- **Descanso** curto e longo para o grupo, fora de combate.

### Testes, recompensas e progressão

- **Testes pedidos pelo Mestre:** perícia, atributo ou resistência com CD (pública ou secreta). O pedido aparece no celular do jogador, que rola com um toque; o bônus certo (atributo + proficiência) entra sozinho e o resultado ✅/❌ volta para o Mestre.
- **XP:** monstro derrotado divide o XP entre o grupo; quests concluídas dão XP, dracmas e itens. Subida de nível automática (tabela do SRD 5e) com PV e estamina extras, salva no banco.
- **Baús de tesouro:** o Mestre posiciona com loot manual ou sorteado (comum/incomum/raro) e tranca opcional. O conteúdo fica escondido dos jogadores até alguém abrir (ação, adjacente; tranca = teste de Prestidigitação ou Atletismo).
- **Cobrar dracmas / tirar itens** e dar recompensas avulsas pelo painel **🎯 Testes & 🎁**.

### Superfícies e mapa destrutível

| Combinação | Resultado |
|---|---|
| Fogo + água | Vapor (bloqueia visão) |
| Raio + água | Água eletrificada (dano elétrico; *molhado* dobra o dano) |
| Gelo + água | Gelo (escorregadio). Água profunda congelada vira caminho! |
| Fogo + óleo/veneno | Explosão de fogo |
| Água + lava | Vapor, e a lava esfria em pedra |

- **Terreno destrutível:**
  - Paredes e colunas viram escombros, e árvores viram tocos.
  - Pontes desabam e derrubam quem está em cima na água.
  - Portões quebram, e árvores, pontes e portões queimam.
- **Objetos:** barril de pólvora grega (explode em cadeia), barris de água e óleo, caixotes, estátuas, braseiros e baús.
- **Gerador de mapas** (determinístico por semente): floresta, caverna, submundo, templo, rio, praia, interior e estrada. Usa ruído fBm, autômato celular para cavernas, BSP para interiores, rios e estradas escavados e espalhamento tipo Poisson.
- **Visual "RPG 2D":** texturas procedurais com variação, bordas suaves entre terrenos, paredes em 3/4, copas de árvore por cima dos tokens, água animada, luzes de braseiro e lava, e ambiente (dia, noite, caverna, submundo, Olimpo).
- Tudo é sincronizado instantaneamente para todos via WebSocket, com efeitos visuais (`fx`).

### Dados

Fórmulas `NdX±M` combináveis (`1d8+1d6+2`), `kh`/`kl` (vantagem `2d20kh1`), e rolagens **públicas**, **privadas** (autor + Mestre) e **secretas** (só Mestre).

### Ferramentas do Mestre

- **Capítulos/fases:** criar, editar, ativar e excluir.
- **Side quests temporárias:** progresso (ex.: 0/3) e expiração por rodada de combate ou contagem regressiva em segundos.
  - Ao expirar, um **gatilho** pode mostrar uma mensagem ou invocar um monstro.
- **Mapa e monstros:** bestiário mitológico (18 monstros, cada um com boneco 3D) injetável em tempo real, inclusive oculto. O editor de mapa pinta terreno, objetos e superfícies.
- **Controle da mesa:** pausar a mesa ou um jogador, banir, ajustar PV e condições, ajustar afinidade divina.
- **Save/Load** e histórico.
- **🎬 Roteiro com cenas prontas:** 11 cenas de *O Ladrão de Raios* em 6 capítulos. Um clique monta cada cena:
  - o mapa (gerado ou pré-pronto) e o ambiente;
  - monstros e baús **à mostra ou escondidos**: só o Mestre os vê (translúcidos, com 👁) até tocar em **✨ Revelar**;
  - quests **obrigatórias** e **opcionais** (e secretas), com XP e itens;
  - o texto para ler em voz alta (com **📺 Mostrar na tela dos jogadores**);
  - a regra que a cena ensina e as dicas **✅ pode / ⛔ evite** para o Mestre de primeira viagem.
- **Aventura pronta:** *O Ladrão de Raios* (adaptação livre, 6 capítulos, quests principais e secundárias com XP), carregada com um clique em **📖 Fases → Aventuras prontas**. O roteiro do narrador está em [`docs/campanha/O_LADRAO_DE_RAIOS.md`](docs/campanha/O_LADRAO_DE_RAIOS.md) e o manual do HUD em [`docs/GUIA_MESTRE.md`](docs/GUIA_MESTRE.md).

### Rostos dos heróis

Cada herói ganha um retrato gerado (SVG em camadas, por semente): formato do rosto, cabelo, olhos, boca, barba, cicatriz, acessório, pele e traço de raça (chifres de sátiro, folhas de ninfa, olho de ciclope…). Dá para sortear e ajustar na criação ou depois, na ficha. O rosto aparece no token do mapa, com o emblema da classe.

### Herói em 3D na criação (estilo criador de personagem de RPG de PC)

- **Palco:** o herói aparece em 3D animado num pedestal de mármore grego, com colunas, névoa e partículas na cor do pai olímpico. Arraste para girar; use pinça ou roda para aproximar do rosto.
- **Cada escolha reage na hora:**
  - Trocar a classe troca a silhueta: hoplita, bárbaro, sábio, aventureiro ou encapuzado.
  - Escolher o deus faz o herói ser **reclamado**: o símbolo brilha sobre a cabeça.
  - Investir em Força faz golpear; Destreza, esquivar; Inteligência, conjurar.
  - A arma equipada aparece na mão com o golpe certo: espada, montante, machado, adaga, besta, arco, lança, tridente, martelo, cajado ou varinha. O escudo, o grimório e a lira vão na outra mão.
- **Aparência:**
  - Pele, cabelo e olhos vêm do retrato.
  - Traços de raça: chifres de sátiro, coroa de folhas de ninfa, olho único de ciclope, diadema lunar das caçadoras.
  - Roupa: cor livre, com o laranja do Acampamento incluído.
  - Altura, porte e elmo/chapéu ajustáveis.
- **13 animações:** atacar, defender, magia, esquivar, pular, comemorar, reclamado, andar, correr, fogueira, ferido, cair e parado.
- **Também na ficha:** o herói aparece em 3D, e a aparência pode ser editada depois.
- **Técnica:**
  - three.js, carregado só quando a tela abre.
  - Modelos KayKit (CC0), ~2,8 MB no total, com animações compartilhadas.
  - Funciona no celular; sem WebGL, vale o retrato 2D.

### Ranks de armas e armaduras

- **5 ranks**, com cor e nível mínimo:

  | Rank | Cor | Bônus | Nível mínimo |
  |---|---|---|---|
  | Comum | cinza | — | 1 |
  | Refinado | verde | +1 | 1 |
  | Heroico | azul | +2 | 3 |
  | Épico | roxo | +3 | 5 |
  | Divino | dourado | +4 | 8 |

  O bônus vai no acerto e no dano das armas e na CA das armaduras; escudos ganham no máximo +2.
- **17 encantamentos:**
  - Dano elemental extra: *de Fogo*, *de Gelo*, *do Trovão*.
  - Atributos: *do Titã*, *da Raposa*, *do Oráculo*, *do Vigor*, *do Herói*.
  - Resistências: *contra Fogo*, *contra Gelo*, *contra Raios*, *contra Veneno*.
  - Defesa: *do Guardião*, *da Leveza*.
  - Com preço: *Brutal* (+3 de dano, −1 acerto) e *da Fortaleza* (+2 CA, −1,5 m).
- **Chave do item:** o rank e o encantamento vão na própria chave (`espada_longa+2~de_fogo`), então inventário, baús e recompensas funcionam sem tabela nova. O motor resolve o item derivado em `getItem`.
- **Comparação ▲▼ na ficha:** CA, acerto, dano médio, atributos, PV, deslocamento e resistências; as melhorias aparecem primeiro.
- **Forja de Hefesto:** o Mestre cria e dá itens com rank, cobrando ou não, ou põe num baú.
- **Loot:** baús sorteados incluem equipamento com rank, e monstros derrotados podem deixar **espólio** (desligável).
- **Rank no boneco 3D:** armas Heroicas ou melhores brilham na cor do rank.

### 🧌 Oficina de bonecos (gerador de criaturas)

Funciona como o gerador de mapas: escolha uma **base**, uma **semente** e clique em **✨ Gerar**. A mesma semente gera sempre o mesmo boneco.

- **Bases:** fera de quatro patas, serpente, hidra, aranha/escorpião, ave gigante, criatura marinha, golem/autômato e humanoide.
- **Superfícies** desenhadas por código, com relevo: pelo, escamas, couro, penas, pedra, bronze, osso, carapaça e lodo brilhante. A barriga fica mais clara que o dorso.
- **Partes:** chifres (curvos, de bode, de touro, coroa), asas (morcego, penas, inseto), caudas (curta, longa, serpente com cabeça, ferrão, clava, chamas), espinhos, juba, armadura de bronze, várias cabeças e auras (brasas, névoa, faíscas, bolhas).
- **Detalhes:** olhos com íris, pupila (redonda ou em fenda) e pálpebras que piscam, dentes, língua, garras e mandíbula que abre ao atacar.
- **Humanoides:** corpo, cabeça (touro, ciclope, serpentes, chamas, caveira), arma, escudo e metade serpente.
- **Usar:**
  - **Usar na espécie:** todos daquele monstro na campanha ganham o visual.
  - **Aplicar no token** selecionado.
  - **Invocar no mapa** com as regras de qualquer monstro.
- O visual não muda as regras. A biblioteca fica salva com a mesa, na aba **🧌 Bonecos**.

### Bonecos 3D no mapa e monstros por espécie

- **Bestiário 3D:** cada espécie tem aparência fixa.
  - Humanoides: rig KayKit (aventureiros e esqueletos, CC0) com cores e adornos procedurais — cabeça de touro, olho de ciclope, presas, cabelo de serpentes ou de chamas, asas de morcego ou de penas, caudas de serpente.
  - Feras: criaturas procedurais com animação por código (quadrúpedes com 1 a 3 cabeças, hidra de 5 pescoços, aranha mecânica, telquine).
  - Visualização em **👹 Monstros → 👁️ 3D**.
- **Bonecos no mapa:** cada figura é pré-renderizada em folhas de sprites, 3 direções (o oeste é espelhado) × parado/andar/atacar/ferido/caído, com câmera ortográfica a 40°.
  - A montagem é feita no navegador, aos poucos e sem travar a tela, e o contexto WebGL é liberado depois.
  - Os heróis usam a aparência e o equipamento da ficha.
- **Animações:**
  - Andar casa a casa pelo caminho, com poeira.
  - Investida e golpe: corte, garras ou projétil em arco.
  - Clarão vermelho e número de dano no impacto; tremor de tela em golpes fortes e explosões.
  - Pose de queda.
- **Mapa vivo:** árvores balançando com o vento, sombras de nuvens, folhas, vaga-lumes, poeira, brasas e brilhos conforme o ambiente.
- **Qualidade:** 💎 ultra, alta, leve (celular fraco) ou fichas redondas, num botão do mapa.
  - **Ultra** liga sozinho em PCs com placa de vídeo dedicada (RTX, GTX 10/16, Radeon RX):
    - bonecos com o dobro de resolução, reflexos nos metais e luz de contorno;
    - no criador de personagem, brilho (bloom), sombras 2048 px e supersampling;
    - mapa em resolução maior.
- **Efeitos de cinema:**
  - banner de capítulo, "Seu turno!", "Vitória!" e subida de nível com confete;
  - d20 rolando na tela;
  - narração letra por letra;
  - baú soltando moedas, brilho ao revelar algo escondido;
  - poder divino na cor do pai olímpico.

### HUD do jogador (celular)

- **Quadro do herói:**
  - retrato com anel de XP e nível;
  - vida com **rastro de dano**, PV temporários, Estamina e CA;
  - condições com ícone e explicação;
  - pisca vermelho ao levar dano.
- **Economia do turno:** pedras de Ação ●, Ação bônus ▲ e Reação ◆, e a barra de passos 👣.
- **Fita de iniciativa** (estilo BG3): retratos na ordem do turno, com o atual destacado.
- **Rastreador de quests:** obrigatórias ◆ e opcionais ◇, com progresso e tempo.
- **Barra rápida:** Mover, Atacar, Poder, Poção, Baú e Fim do turno, com botões grandes para o dedo.

### Arte dos monstros com IA local

Na aba **🎨 Arte** do Host, a mesa pinta a arte de cada monstro usando o **ComfyUI** no próprio PC do Mestre (RTX 2060 Super: ~20 a 60 s por monstro). A pintura vira o token no mapa de todos na hora.

- Dá para editar a descrição, gerar outra versão, enviar uma imagem sua ou voltar ao ícone.
- Pelo terminal: `npm run art`.
- Workflows próprios, como FLUX, também funcionam.
- **🎨 Mapa pintado (🗺️ Mapa → Pintar o mapa com IA):**
  - a mesa envia o desenho do mapa ao ComfyUI (img2img) e a IA repinta mantendo paredes, árvores e caminhos no lugar;
  - objetos, fichas, bonecos e efeitos continuam por cima;
  - se o terreno mudar, volta o desenho original;
  - cada jogador alterna entre 🎨 pintado e 🗺️ desenhado num botão do mapa.
- Passo a passo em [`docs/ARTE_COM_IA.md`](docs/ARTE_COM_IA.md).

---

## Permissões (RBAC)

| Ação | Mestre | Jogador |
|---|:-:|:-:|
| Criar/excluir campanhas, mapas, capítulos, quests | ✅ | — |
| Injetar/ocultar/remover monstros, editar tokens | ✅ | — |
| Iniciar/encerrar combate, forçar próximo turno | ✅ | — |
| Rolagem **secreta** | ✅ | — |
| Pausar/banir jogadores, pausar a mesa | ✅ | — |
| Editar/destruir mapa diretamente, lançar elementos | ✅ | — |
| Save/Load | ✅ | — |
| Mover/atacar/usar poder com o **próprio** personagem no **próprio** turno | ✅ | ✅ |
| Rolagem pública/privada, chat | ✅ | ✅ |
| Ver monstros ocultos, PV de monstros, quests ocultas, rolagens secretas | ✅ | — |

O papel é verificado em três lugares: na rota REST (`requireRole`), no acesso à campanha (Mestre dono ou membro ativo) e em cada comando do motor (`authorize`).

---

## API REST

Base: `/api`. Rotas autenticadas exigem `Authorization: Bearer <accessToken>`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status do servidor e do banco |
| GET | `/rules` | Catálogo completo (raças, divindades, classes, itens, monstros, terreno, guia) |
| GET | `/rules/maps/:key` | Mapa padrão completo |
| POST | `/auth/register` | `{ username, email, password, displayName?, masterCode? }` |
| POST | `/auth/login` | `{ login (e-mail ou username), password }` |
| POST | `/auth/refresh` | Usa o cookie HttpOnly `mesa_rt` |
| POST | `/auth/promote` | `{ masterCode }`: conta existente vira Mestre |
| POST | `/auth/logout` · `/auth/logout-all` | Sair / sair de todos os dispositivos |
| GET · DELETE | `/auth/me` | Perfil / excluir conta (soft delete) |
| GET · POST | `/characters` | Listar (`?includeDeleted=true` para a lixeira) / criar |
| POST | `/characters/preview` | Valida a ficha sem salvar |
| GET · PATCH · DELETE | `/characters/:id` | Detalhe / nome e ficha narrativa / soft delete |
| POST | `/characters/:id/equip` | `{ slot, itemKey \| null }` com validação de restrições |
| PUT | `/characters/:id/portrait` | Salvar o retrato do herói |
| POST | `/characters/:id/restore` | Restaurar da lixeira |
| GET · POST | `/campaigns` | Listar / criar (Mestre) |
| POST | `/campaigns/join` | `{ code, characterId }` |
| GET · PATCH · DELETE | `/campaigns/:id` | Detalhe / editar / soft delete |
| POST | `/campaigns/:id/restore` | Restaurar |
| GET | `/campaigns/:id/members` | Jogadores |
| POST | `/campaigns/:id/members/:userId/ban` · `/unban` | Banir / readmitir |
| GET | `/campaigns/:id/history?before=` | Histórico de eventos (filtrado por visibilidade) |
| GET · POST | `/campaigns/:id/maps` | Listar / criar (`{preset}`, `{blank}` ou `{map}`) |
| GET · PUT · DELETE | `/campaigns/:id/maps/:mapId` | Abrir / salvar / soft delete |
| GET · POST | `/campaigns/:id/saves` | Listar / salvar agora |
| POST | `/campaigns/:id/saves/:saveId/load` | Restaurar a mesa |
| DELETE | `/campaigns/:id/saves/:saveId` | Excluir save |
| GET · POST · DELETE | `/campaigns/:id/items[/:itemId]` | Catálogo + itens personalizados |
| GET | `/host/info` | URLs da rede local (Mestre) |
| GET | `/art` | Artes pintadas dos monstros (`{ monsters: { chave: url } }`) |
| GET | `/art/comfy` · `/art/prompts` · `/art/jobs` | Status do ComfyUI, descrições padrão, fila de geração (Mestre) |
| POST | `/art/monsters/:key/generate` | `{ prompt?, seed?, checkpoint?, steps? }`: entra na fila (202) |
| PUT · DELETE | `/art/monsters/:key` | Enviar imagem (`{ image: dataURL }`) / voltar ao ícone |

---

## Protocolo WebSocket

Conexão: `io(URL, { auth: { token: accessToken } })`. A sessão recupera eventos perdidos por até 2 min, para cobrir quedas de rede do celular.

| Cliente → servidor | Payload | Resposta (ack) |
|---|---|---|
| `table:join` | `{ campaignId }` | `{ ok, data: { seq, state } }` |
| `table:command` | `{ commandId, command }` | `{ ok, data: { seq } }` ou `{ ok: false, error, code }` |
| `table:resync` | `{ campaignId }` | estado completo |
| `table:leave` | — | — |

| Servidor → cliente | Descrição |
|---|---|
| `table:state` | `{ seq, state }`: estado projetado **para você** |
| `table:fx` | Efeitos visuais e novas entradas do log visíveis para você |
| `table:presence` | Jogador conectou/desconectou |
| `table:kicked` | Você foi banido |
| `art:updated` | A arte de um monstro mudou (os clientes recarregam `/api/art`) |

Os comandos são validados com zod (`shared/src/engine/commands.ts`):

- **Jogador:** `token.move`, `combat.attack`, `combat.attackTile`, `combat.action`, `combat.shove`, `combat.power`, `combat.endTurn`, `item.use`, `object.open`, `check.roll`, `dice.roll`, `chat.say`.
- **Mestre (além dos acima):** `table.setPaused`, `chapter.*`, `monster.spawn`, `token.update`, `token.remove`, `combat.start`, `combat.end`, `combat.next`, `map.set`, `map.paint`, `map.element`, `map.damage`, `quest.*`, `player.pause`, `player.ban`, `affinity.adjust`, `combat.auto`, `token.damage`, `check.request`, `check.clear`, `party.rest`, `reward.grant`, `item.take`, `chest.place` (com `hidden`), `object.reveal`, `figure.save`, `figure.delete`, `figure.assign`, `scene.load`, `table.narrate`, `adventure.load`, `map.generate`, `map.mood`.

---

## Testes

```bash
npm run db:up        # o banco mesa_rpg_test é criado pelo docker compose
npm test             # motor (shared) + integração (server)
```

**136 testes:**

- **Motor e guardas do frontend (`shared/tests`, 92):**
  - Dados: parser, vantagem, críticos, limites.
  - Point-buy e atributos derivados.
  - Restrições de armas e armaduras por classe, atributo, divindade e raça.
  - Regras de mãos.
  - Reações de superfície e destruição em cadeia.
  - Pontes e gelo sobre água.
  - Turnos estritos e economia de ações.
  - Ataques, empurrar e poder divino.
  - RBAC e informação oculta.
  - Side quests com gatilho e migração de saves.
  - Ranks e encantamentos (acerto, dano, CA, atributos, resistências, nível mínimo), comparação ▲▼, loot com rank e espólio de monstros.
  - Monstros agindo sozinhos, dano/cura, testes contra a morte, testes pedidos, XP e nível, recompensas de quest, baús e carga de aventura.
  - Guarda de regressão: nenhum `useEffect` dos clientes devolve valor por engano (causa da tela quebrando).
- **Integração (`server/tests`, 44, com PostgreSQL real):**
  - Autenticação: Argon2id, primeiro usuário Mestre, convite, login, refresh por cookie e revogação.
  - Papéis: código de Mestre tolerante a espaços e maiúsculas, conta existente virando Mestre, Mestre jogando na campanha de outro.
  - Criação e edição de fichas via API.
  - Soft delete de usuários, personagens, fichas, campanhas e itens.
  - WebSockets: autenticação, entrada na mesa e bloqueio de comandos de Mestre.
  - Monstro oculto e rolagem secreta filtrados.
  - Comandos duplicados descartados.
  - Pausar e banir.
  - Save/load idêntico e histórico filtrado.
  - Recompensa com subida de nível persistida, baú aberto e teste pedido pelo Mestre resolvido pelo jogador.
  - Arte com IA contra um ComfyUI simulado: workflow enviado, imagem salva e servida, upload, recusa de não-imagens e workflows próprios.

Por segurança, a bateria se recusa a rodar se `TEST_DATABASE_URL` não tiver "test" no nome, porque ela recria o schema do zero.

---

## Criando suas próprias aventuras

O conteúdo temático está separado do motor, então dá para criar campanhas de fantasia, policial ou o que imaginar:

- **Pela interface do Mestre:** mapas desenhados à mão, capítulos, side quests com gatilhos e itens personalizados por campanha.
- **Pelo código (`shared/src/content/`):**
  - **Mapas padrão:** `maps.ts`. Desenhe em ASCII, um caractere por casa; a legenda está no arquivo.
  - **Monstros:** `monsters.ts`.
  - **Raças e divindades:** `races.ts` e `divinities.ts`. Para um tema policial, por exemplo, "divindades" viram "facções" e "raças" viram "origens".
  - **Itens:** `items.ts` (requisitos via `requirements`).
  - **Textos do guia:** `guide.ts`.

Depois de editar, rode `npm test` para garantir que os mapas e as regras continuam válidos.

---

## Avisos

Projeto **pessoal e recreativo**, sem fins comerciais, feito para jogar com família e amigos.

- As regras de base usam material do **System Reference Document 5.2** da Wizards of the Coast, sob licença CC-BY-4.0 (veja [NOTICE.md](NOTICE.md)).
- *Baldur's Gate 3* é da Larian Studios. *Percy Jackson e os Olimpianos* é obra de Rick Riordan (marcas da Disney).
- Este projeto não tem afiliação com essas empresas e não usa arte, textos ou assets delas.
- A mitologia grega é de domínio público.
- Se um dia quiser publicar o projeto, o relatório em [docs/PESQUISA.md](docs/PESQUISA.md) lista os nomes que valeria renomear.

Para quem vai jogar pela primeira vez: **[Guia de Iniciação Rápida para Novatos](docs/GUIA_NOVATOS.md)**. Para quem vai mestrar pela primeira vez: **[Sua primeira sessão como Mestre](docs/GUIA_PRIMEIRA_SESSAO.md)**.
