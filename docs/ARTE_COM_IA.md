# 🎨 Arte dos monstros com IA local (ComfyUI)

A Mesa RPG pinta a arte dos monstros **no seu próprio PC**, usando a sua placa de vídeo (a RTX 2060 Super dá conta). Nada vai para a internet: o servidor da mesa conversa com o **ComfyUI**, um programa gratuito que gera imagens localmente. Cada imagem pronta vira o token do monstro no mapa e aparece no celular de todos.

Sem ComfyUI tudo continua funcionando: os monstros usam os ícones desenhados, e você pode **enviar imagens prontas** pelo Host.

---

## 1. Instalar o ComfyUI (uma vez)

1. Atualize o driver da NVIDIA (GeForce Experience ou nvidia.com).
2. Baixe o **ComfyUI portátil para Windows** na página de *Releases* do GitHub do ComfyUI. Escolha a versão para **NVIDIA série 20 ou mais nova**.
3. Extraia o `.7z` (7-Zip ou o próprio Windows) numa pasta, por exemplo `C:\ComfyUI_windows_portable`.
4. Rode `run_nvidia_gpu.bat`. Quando o terminal mostrar o endereço, ele está no ar em **http://127.0.0.1:8188**.

> Prefere o **app ComfyUI Desktop**? Também serve. Ele costuma usar outra porta (veja o endereço nas configurações do app) e você só precisa apontar `COMFYUI_URL` para ela (passo 3).

## 2. Baixar um modelo (o "pintor")

O modelo é um arquivo `.safetensors` que vai em `ComfyUI\models\checkpoints\`. Para arte de RPG pintada, um modelo **SDXL** fica ótimo e cabe nos 8 GB da RTX 2060 Super:

- **DreamShaper XL** ou **Juggernaut XL** (Civitai / Hugging Face): ótimos para fantasia.
- **SDXL Base 1.0** (Stability AI, Hugging Face): o padrão oficial.

A mesa escolhe sozinha um modelo com "XL" no nome. Se tiver vários, você escolhe no painel.

> Leia a licença do modelo que baixar. Para jogar em casa com a família, os modelos citados permitem uso pessoal.

## 3. Ligar a mesa ao ComfyUI

Se o ComfyUI está em `http://127.0.0.1:8188`, **não precisa configurar nada**. Para mudar, edite `server/.env`:

```env
COMFYUI_URL=http://127.0.0.1:8188
# opcional: força um modelo específico
COMFYUI_CHECKPOINT=dreamshaperXL_v21.safetensors
# opcional: tempo máximo por imagem (segundos)
COMFYUI_TIMEOUT_SECONDS=300
```

Reinicie a mesa (`npm start`).

## 4. Pintar os monstros

**Pelo Host (recomendado):** abra a mesa como Mestre → aba **🎨 Arte**.

- O quadro verde confirma: *ComfyUI conectado · NVIDIA GeForce RTX 2060 SUPER*.
- **🎨 Pintar os que faltam** coloca todos os monstros sem arte na fila. Na RTX 2060 Super cada um leva cerca de 20 a 60 segundos.
- Em cada monstro:
  - **🎲 Outra versão** gera outra pintura com nova semente.
  - **✏️ Descrição** edita o que a IA vai pintar (em inglês funciona melhor).
  - **📤 Enviar imagem** usa uma imagem sua, que o Host já recorta para 512×512.
  - **↩️ Voltar ao ícone** apaga a pintura.
- Os tokens mudam na hora para todos os jogadores conectados.

**Pelo terminal:**

```bash
npm run art                 # pinta só os monstros sem arte
npm run art -- --todos      # refaz todos
npm run art -- harpia cerbero
```

As imagens ficam em `server/data/art/monsters/` (uma `.png` + um `.json` com a descrição e a semente). Copie a pasta para guardar ou levar para outro PC.

## 5. Dicas

- **Quer outro estilo?** Edite a descrição. Exemplos: *"…, watercolor"*, *"…, dark souls style"*, *"…, cute chibi"*.
- **A placa esquentou ou o PC travou?** Escolha a qualidade **Rápida (18 passos)** no painel.
- **Jogo e IA ao mesmo tempo:** gere a arte **antes** da sessão. Durante o jogo, a GPU fica livre para o navegador.

## 6. Usuário avançado: FLUX ou workflow próprio

O padrão usa só os nós nativos do ComfyUI (Load Checkpoint → KSampler → VAE Decode → redimensionar para 512 → Save Image). Para usar **FLUX** ou outro fluxo:

1. Monte o workflow no ComfyUI e teste.
2. Exporte em **formato API**: no menu *Workflow*, use *Export (API)*. Em versões antigas, ative o *Dev mode* nas configurações para aparecer *Save (API Format)*.
3. No arquivo exportado, troque o texto do prompt por `{{PROMPT}}`, o negativo por `{{NEGATIVE}}`, a semente por `{{SEED}}` e, se quiser, o nome do modelo por `{{CHECKPOINT}}`.
4. Aponte o `.env` para ele: `COMFYUI_WORKFLOW=C:\caminho\meu_workflow_api.json`.

A mesa pega a primeira imagem que o workflow salvar.
