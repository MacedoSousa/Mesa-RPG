# ⚡ Mesa RPG

RPG de mesa tático para jogar em casa, com o **PC do Mestre como Host** e os jogadores no **navegador ou celular**.
As regras vêm do D&D 5e (SRD). O combate tático, com superfícies e cenário destrutível, é inspirado em *Baldur's Gate 3*.
O tema é mitologia grega no estilo *Percy Jackson*: semideuses, pais olímpicos e monstros dos mitos.

> **Versão:** 0.2.0-alpha. Projeto pessoal e recreativo, para jogar com família e amigos (veja [Avisos](#avisos)).

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
3. **Mestre:** escolhe o mapa (Acampamento Meio-Sangue, Submundo, Olimpo, Rio Hudson, ou um desenhado por ele), posiciona monstros e inicia o combate.
4. Salve com 💾 quando quiser parar. O autosave roda a cada 60 s.

---

## Jogando na rede de casa

- O servidor escuta em `0.0.0.0`. Se o celular não conectar, libere a porta `3333` no **Firewall do Windows** (o Node pede permissão na primeira execução; marque "Redes privadas").
- O celular precisa estar no **mesmo Wi-Fi** que o PC. Redes de convidados costumam isolar os aparelhos.
- O acesso é HTTP puro na rede local. O jogo funciona normalmente, mas o navegador não permite "instalar como app" (PWA), porque isso exige HTTPS.
- **Jogadores fora de casa:** use um túnel como [Tailscale](https://tailscale.com) (cada jogador instala) ou o Cloudflare Tunnel. Teste o WebSocket antes da sessão.

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
- **Mapa e monstros:** bestiário mitológico (18 monstros) injetável em tempo real, inclusive oculto. O editor de mapa pinta terreno, objetos e superfícies.
- **Controle da mesa:** pausar a mesa ou um jogador, banir, ajustar PV e condições, ajustar afinidade divina.
- **Save/Load** e histórico.
- **Aventura pronta:** *O Ladrão de Raios* (adaptação livre, 6 capítulos, quests principais e secundárias com XP), carregada com um clique em **📖 Fases → Aventuras prontas**. O roteiro do narrador está em [`docs/campanha/O_LADRAO_DE_RAIOS.md`](docs/campanha/O_LADRAO_DE_RAIOS.md) e o manual do HUD em [`docs/GUIA_MESTRE.md`](docs/GUIA_MESTRE.md).

### Rostos dos heróis

Cada herói ganha um retrato gerado (SVG em camadas, por semente): formato do rosto, cabelo, olhos, boca, barba, cicatriz, acessório, pele e traço de raça (chifres de sátiro, folhas de ninfa, olho de ciclope…). Dá para sortear e ajustar na criação ou depois, na ficha. O rosto aparece no token do mapa, com o emblema da classe.

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

Os comandos são validados com zod (`shared/src/engine/commands.ts`):

- **Jogador:** `token.move`, `combat.attack`, `combat.attackTile`, `combat.action`, `combat.shove`, `combat.power`, `combat.endTurn`, `item.use`, `object.open`, `check.roll`, `dice.roll`, `chat.say`.
- **Mestre (além dos acima):** `table.setPaused`, `chapter.*`, `monster.spawn`, `token.update`, `token.remove`, `combat.start`, `combat.end`, `combat.next`, `map.set`, `map.paint`, `map.element`, `map.damage`, `quest.*`, `player.pause`, `player.ban`, `affinity.adjust`, `combat.auto`, `token.damage`, `check.request`, `check.clear`, `party.rest`, `reward.grant`, `item.take`, `chest.place`, `adventure.load`, `map.generate`, `map.mood`.

---

## Testes

```bash
npm run db:up        # o banco mesa_rpg_test é criado pelo docker compose
npm test             # motor (shared) + integração (server)
```

**121 testes:**

- **Motor e guardas do frontend (`shared/tests`, 82):**
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
  - Monstros agindo sozinhos, dano/cura, testes contra a morte, testes pedidos, XP e nível, recompensas de quest, baús e carga de aventura.
  - Guarda de regressão: nenhum `useEffect` dos clientes devolve valor por engano (causa da tela quebrando).
- **Integração (`server/tests`, 39, com PostgreSQL real):**
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

Para quem vai jogar pela primeira vez: **[Guia de Iniciação Rápida para Novatos](docs/GUIA_NOVATOS.md)**.
