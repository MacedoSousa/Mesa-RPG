# 👑 Guia do Mestre — conduzindo a mesa no Mesa RPG

Este guia explica **como conduzir uma sessão** usando o HUD do Mestre (`http://localhost:3333/host`): o que cada painel faz, como rodar um combate, pedir testes, dar recompensas, esconder tesouros e salvar a mesa. Se você nunca mestrou, leia na ordem; leva uns 15 minutos.

---

## 1. Antes da primeira sessão (checklist)

- [ ] Servidor rodando (`npm start`) e `http://localhost:3333/api/health` mostrando `"database": "ok"`.
- [ ] No HUD: **criar a campanha** e anotar o **código de convite** (6 letras).
- [ ] Jogadores: criam a conta e o herói no celular e **entram com o código** (ou pelo QR code no botão 🎟️).
- [ ] Na aba **📖 Fases**: **📚 Carregar aventura → O Ladrão de Raios**. Os capítulos e as quests aparecem prontos.
- [ ] Ler o roteiro do capítulo 1 em `docs/campanha/O_LADRAO_DE_RAIOS.md` (20 min).
- [ ] Na aba **🗺️ Mapa**: abrir o mapa da primeira cena.
- [ ] Sessão zero com o grupo (combinados, cartão X, perguntas sobre os personagens; está no roteiro).

---

## 2. A tela do Mestre

```
┌ Barra: campanha · 🎟️ código/QR · fase · turno atual · jogadores online · ⏸️ Pausar · 💾 Salvar ┐
├──────────────┬─────────────────────────────────────┬──────────────────────────────────────┤
│ Painéis      │  MAPA (visão completa: vê tudo,     │  🔒 Caixa de dados secretos           │
│ ⚔️ Combate   │  inclusive monstros ocultos)         │  Registro da mesa (inclui secretos)  │
│ 🎯 Testes&🎁 │                                     │  Narrar para a mesa (chat)           │
│ 📖 Fases     │  Clique = ferramenta ativa          │                                      │
│ 📜 Quests    │  (canto superior esquerdo; Esc sai) │                                      │
│ 👹 Monstros  │                                     │                                      │
│ 🧑‍🤝‍🧑 Jogadores│                                     │                                      │
│ 🗺️ Mapa      │                                     │                                      │
│ 💾 Saves     │                                     │                                      │
└──────────────┴─────────────────────────────────────┴──────────────────────────────────────┘
```

**Clicar num token** seleciona e abre o **inspetor** no painel ⚔️ Combate, com PV, CA, condições, ações do monstro e caixa de dano e cura.
**Clicar numa casa vazia** com um token selecionado move o token. No turno dele isso gasta movimento; fora do turno, ele é teleportado.

---

## 3. Narrando uma cena

1. **Ative o capítulo** em 📖 Fases (**Iniciar**). Os jogadores veem o título no Histórico. Toque em **📖 ver roteiro do capítulo** para ler as notas e o texto em voz alta.
2. **Leia a caixa de texto** do roteiro e termine com **"O que vocês fazem?"**.
3. **Ouça** e decida se precisa de dado. Só peça rolagem quando **falhar for interessante**. Se não há risco, o herói simplesmente consegue.
4. **Peça o teste pelo app** (próxima seção) e **narre o resultado**, seja sucesso ou falha. Na falha, a história continua com um custo.

**Para falar com a mesa:** use o campo *Narrar para a mesa* (aparece no Histórico de todos). Para segredos, fale em voz baixa ou use rolagens secretas.

---

## 4. Testes que valem (🎯 Testes & 🎁)

| Passo | Onde |
|---|---|
| Escolha **quem** (todos ou um herói), o **tipo** (perícia, atributo ou resistência), a **perícia** e a **CD** | Card *Pedir um teste* |
| Botões rápidos de CD: Muito fácil 5 · Fácil 10 · Médio 15 · Difícil 20 · Muito difícil 25 | |
| Marque **Esconder a CD** se não quiser revelar a dificuldade | |
| Clique em **Pedir…** | Os celulares mostram um cartão amarelo com o botão 🎲 Rolar |
| Os resultados aparecem na lista (✅ / ❌) e no registro. Se o jogador sumiu, use **rolar por ele** | |

O app soma **atributo + proficiência** (se o herói é treinado) automaticamente.

**Que perícia pedir?**

| Situação | Perícia (atributo) |
|---|---|
| Notar algo escondido, ouvir passos | Percepção (SAB) |
| Procurar pistas, entender um mecanismo | Investigação (INT) |
| Saber se o NPC mente | Intuição (SAB) |
| Convencer, negociar | Persuasão (CAR) |
| Mentir, blefar, disfarçar | Enganação (CAR) |
| Assustar | Intimidação (CAR) |
| Escalar, nadar, arrombar, segurar | Atletismo (FOR) |
| Equilibrar-se, escapar de uma rede | Acrobacia (DES) |
| Andar sem ser visto | Furtividade (DES) |
| Abrir fechadura, desarmar armadilha | Prestidigitação (DES) |
| Lembrar de um mito, de um deus | História / Religião (INT) |
| Acalmar um animal ou monstro-bicho | Lidar com Animais (SAB) |
| Rastrear, se orientar, achar comida | Sobrevivência (SAB) |
| Fazer música, teatro, distrair com show | Atuação (CAR) |
| Primeiros socorros (estabilizar quem caiu) | Medicina (SAB) |

**Resistências:** escapar de explosão ou armadilha = Destreza; aguentar veneno ou petrificação = Constituição; resistir a ilusão, medo ou encanto = Sabedoria; aguentar ser puxado ou preso = Força.

---

## 5. Combate, passo a passo

1. **Coloque os monstros:** 👹 Monstros → escolha → clique no mapa. Marque **oculto** para emboscadas: o jogador não vê o monstro até você clicar **👁️ Revelar** no inspetor.
2. **Inicie:** ⚔️ Combate → **Iniciar combate** (selecione os participantes ou deixe vazio para todos). O app rola a iniciativa.
3. **No turno de um herói:** o jogador age pelo celular. Você só acompanha e narra.
4. **No turno de um monstro:** o painel mostra **"⚔️ Turno deste monstro"**:
   - **Escolha um golpe** (ex.: *Machado Grande +6, 2d12+4*) e **clique no alvo**. Os alvos ao alcance ficam vermelhos.
   - Para **mover**, clique numa casa vazia antes de atacar.
   - Ou use **🤖 Agir sozinho**: o monstro anda até o herói de pé mais próximo e ataca com o melhor golpe. É ótimo para combates com muitos monstros.
   - Depois, **Encerrar turno** (ou ⏭️ Próximo turno).
5. **Dano e cura manuais:** no inspetor de qualquer token, digite **um valor (7)** ou **uma fórmula (2d6+3)**, escolha o tipo e clique em **Aplicar dano** ou **Curar**. O botão **🎲 Última rolagem (N) como dano** usa o total do último dado rolado na mesa, seja seu ou de um jogador. É assim que uma "rolagem livre" vira efeito no jogo.
6. **Heróis caídos:** com 0 PV, o app rola as salvaguardas contra a morte no turno deles sozinho. Você vê ✔/✖ no inspetor.
7. **Fim:** **Encerrar** o combate. O XP dos monstros derrotados já foi dividido entre os heróis.

**Dicas de Mestre:**

- Um combate bom tem **um objetivo além de matar**: fugir, proteger alguém, pegar um objeto, aguentar 3 rodadas.
- **Use o cenário:** coloque barris, pontes, água e terreno elevado. Os jogadores vão adorar explodir coisas.
- Monstro com pouco PV **foge ou se rende**. Isso abre conversa e pistas.
- **Errou a mão?** Faça o monstro errar, recuar, ou traga um aliado. Ninguém precisa saber.

---

## 6. Recompensas, XP e níveis

- **Automático:**
  - Derrotar um monstro divide o XP dele entre os heróis na mesa.
  - Concluir uma quest dá o XP, as dracmas e os itens dela para cada herói. O botão **✅ Concluir** fica em 📜 Quests.
- **Manual:** 🎯 Testes & 🎁 → **Recompensas e XP**:
  - Escolha *Todos* ou *Só o herói selecionado*.
  - Use os botões rápidos 25, 50, 100 ou 300 XP, dracmas e itens.
  - Escreva um **motivo** (aparece para a mesa).
- **Cobrar:** no mesmo card, **💸 Cobrar** tira dracmas ou um item. É o caso de Caronte, que cobra 10 dracmas por pessoa.
- **Subir de nível:** acontece sozinho na tabela do SRD (300 / 900 / 2.700 / 6.500 XP). O app avisa "🆙" e aumenta o PV máximo.
- **Quanto XP dar?** Siga o roteiro. Fora dele, um bom marco vale de **50 a 100 XP por herói** por desafio vencido sem luta (uma conversa difícil, um enigma resolvido).

---

## 7. Baús de tesouro

1. 🎯 Testes & 🎁 → **Baú de tesouro**.
2. **Conteúdo:**
   - **Sortear por tabela:** Comum (níveis 1–2), Incomum (níveis 3–4) ou Raro (chefe).
   - **Montar à mão:** adicione itens e dracmas.
3. **Trancado?** Informe a CD (vazio = aberto). Uma CD de 12 a 15 é boa para nível 1–3.
4. Clique em **🧰 Clicar no mapa para colocar o baú** e depois numa casa.
5. **O jogador:** fica ao lado e toca em **🧰 Abrir baú**, ou toca no baú. Se estiver trancado, o app rola Prestidigitação ou Atletismo, o que for melhor. Os itens vão para o inventário e aparecem na ficha.

Os jogadores **veem o baú, mas não o conteúdo**, nem a CD.

---

## 8. Quests, relógios e side quests

- **📜 Quests → Criar side quest:**
  - Título, descrição e meta (ex.: 3 pistas).
  - XP e dracmas por herói.
  - Tempo limite em **rodadas** ou **segundos** (com contagem regressiva ao vivo).
  - Mensagem e **monstro invocado** quando expirar.
- **Ocultar** deixa a quest só para você. Revele quando os heróis descobrirem.
- **+1 / −1** avança o contador, que é o relógio da quest. **✅ Concluir** entrega a recompensa.
- **Relógios na campanha:** o **Solstício** (10 dias) e as **Fúrias** (4) já vêm na aventura como quests ocultas. Marque +1 quando o roteiro mandar.

---

## 9. Mapas

- **🗺️ Mapa → Mapas padrão:** Acampamento, Submundo, Olimpo, Rio Hudson.
- **Gerar mapa:** escolha o tipo (floresta, caverna, templo, rio, praia, interior), o tamanho e a semente, e clique em **Gerar**. Gerar de novo com outra semente dá outro mapa. O mesmo tipo com a mesma semente sempre dá o mesmo mapa.
- **Editor:** pinte terreno, objetos (barris, caixotes, estátuas, baús) e superfícies (fogo, água, gelo, óleo).
- **Elementos e dano ao cenário:** jogue fogo ou raio numa área e destrua paredes e pontes ao vivo.
- **Salvar mapa:** guarda na campanha para reutilizar.

---

## 10. Jogadores, pausa e segurança

- **⏸️ Pausar mesa:** ninguém age (o chat continua). Use para o lanche ou para explicar uma regra.
- **🧑‍🤝‍🧑 Jogadores:** pausar um jogador, banir (ele é expulso e não volta) ou readmitir.
- **Cartão X:** se alguém disser "X", mude a cena na hora, sem perguntar por quê.

---

## 11. Salvar e continuar

- **💾 Salvar** (barra superior) faz um save manual rápido. **💾 Saves** lista todos os saves.
- **Autosave:** a cada 60 s, se algo mudou, e ao desligar o servidor com Ctrl+C.
- **Continuar:** na próxima sessão, abra a campanha. A mesa volta exatamente como estava: posições, PV dos monstros, turnos, quests e histórico. Para voltar a um ponto anterior, use **💾 Saves → Carregar**.

---

## 12. Mestre também joga?

O papel vale **por campanha**. Na campanha que você criou, você é o Mestre. Na campanha de outra pessoa, você entra pelo endereço sem `/host` com um herói, como jogador. Para alguém da família mestrar a próxima aventura, ela usa **👑 Virar Mestre** com o código do `server/.env`.
