# Mesa RPG — Server

Backend do RPG de mesa inspirado em **Baldur's Gate 3** (regras 5e) e no universo de **Percy Jackson** (semideuses e pais olímpicos).

Node.js + TypeScript · Express 5 · Socket.io · PostgreSQL · JWT · Soft Delete

## Como rodar

```bash
cd server
cp .env.example .env        # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run migrate             # cria as tabelas
npm run dev                 # http://localhost:3333/api/health
```

O servidor escuta em `0.0.0.0` e imprime o IP da rede local no console — é esse endereço que os celulares dos jogadores usam.

Para tornar sua conta o **Mestre** (Host), depois de se cadastrar:

```sql
UPDATE users SET role = 'mestre' WHERE username = 'seu_usuario';
```

## Estrutura

```
src/
├── config/        env.ts (validação do .env) · database.ts (pool pg + transações)
├── models/        gameData.ts (raças, classes, deuses, armas, armaduras)
│                  equipmentRules.ts (restrição de armas/armaduras por classe, cálculo de CA)
│                  User.ts · Character.ts (acesso a dados + validação zod)
├── controllers/   authController.ts · characterController.ts
├── routes/        index.ts
├── middlewares/   auth.ts (JWT) · errorHandler.ts
├── sockets/       index.ts (sessões Host ↔ Jogadores)
├── database/      migrate.ts · migrations/
├── utils/         jwt.ts · dice.ts · HttpError.ts
└── server.ts
```

## Soft Delete

`users` e `characters` têm `deleted_at`. Excluir apenas preenche a data; todas as consultas filtram `deleted_at IS NULL`. Excluir a conta também "apaga" as fichas dela. Os índices de unicidade de e-mail/username são parciais, então uma conta excluída não bloqueia o reuso do e-mail. As views `active_users` e `active_characters` já vêm filtradas.

## API REST (`/api`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status |
| GET | `/rules` | Catálogo: raças, classes (com armas/armaduras permitidas), deuses, itens |
| POST | `/auth/register` | `{ username, email, password, displayName? }` |
| POST | `/auth/login` | `{ login (email ou username), password }` |
| GET | `/auth/me` | Usuário logado |
| DELETE | `/auth/me` | Soft delete da conta |
| GET | `/characters?includeDeleted=true` | Lista fichas |
| POST | `/characters` | Cria ficha |
| GET | `/characters/:id` | Detalhe |
| PATCH | `/characters/:id` | Atualiza (revalida equipamento) |
| DELETE | `/characters/:id` | Soft delete |
| POST | `/characters/:id/restore` | Restaura da lixeira |

Rotas autenticadas exigem `Authorization: Bearer <token>`.

### Exemplo de ficha

```json
{
  "name": "Jackson",
  "race": "humano",
  "class": "guerreiro",
  "level": 3,
  "godlyParent": "poseidon",
  "godlyAffinity": 60,
  "attributes": { "forca": 15, "destreza": 14, "constituicao": 14, "inteligencia": 10, "sabedoria": 10, "carisma": 12 },
  "equipment": { "mainHand": "xiphos", "shield": "escudo_bronze", "armor": "cota_de_malha" }
}
```

PV máximo, CA e bônus de proficiência são calculados no servidor. Equipamento fora das proficiências da classe retorna **422** com a lista de violações (ex.: Mago com Montante, Druida com armadura de metal, armadura pesada sem a Força mínima, arma de duas mãos + escudo).

## WebSockets

Conecte com `io(URL, { auth: { token } })`.

| Evento (cliente → servidor) | Quem | Payload |
|---|---|---|
| `session:create` | Mestre | — (ack retorna `{ code }`) |
| `session:join` | Jogador | `{ code, characterId }` |
| `session:leave` | Todos | — |
| `dice:roll` | Todos | `{ expression: "1d20+5", label?, private? }` |
| `chat:message` | Todos | `{ text }` |
| `host:scene` | Mestre | qualquer payload (narração, mapa, música) |

| Evento (servidor → cliente) | Descrição |
|---|---|
| `session:player-joined` / `session:player-left` | Entrada/saída de jogadores |
| `session:closed` | Mestre saiu |
| `dice:result` | Resultado (rolado no servidor; `private` vai só para o Mestre e quem rolou) |
| `chat:message` · `host:scene` | Retransmissões |
| `character:updated` | Ficha alterada via `PATCH` |

As sessões vivem em memória: reiniciar o servidor encerra as mesas abertas.
