#!/usr/bin/env bash
# Baixa modelos de imagem para o ComfyUI (arte dos monstros da Mesa RPG).
#
# Uso:
#   ./scripts/baixar-modelos.sh                 → mostra os pacotes
#   ./scripts/baixar-modelos.sh essencial       → DreamShaper XL Turbo + Juggernaut XL + LoRA pixel art (~14 GB)
#   ./scripts/baixar-modelos.sh completo        → essencial + Animagine XL (anime) + FLUX.1 schnell (~38 GB)
#   ./scripts/baixar-modelos.sh flux-dev        → FLUX.1 dev fp8 (licença não comercial; ~17 GB)
#   ./scripts/baixar-modelos.sh sdxl-base       → SDXL Base 1.0 oficial (~7 GB)
#   ./scripts/baixar-modelos.sh url <URL> [nome.safetensors] [checkpoints|loras]
#                                              → qualquer modelo (ex.: Civitai)
#
# Variáveis opcionais:
#   COMFYUI_DIR=~/ComfyUI     pasta do ComfyUI
#   HF_TOKEN=hf_xxx           para modelos do Hugging Face que pedem login (aceite a licença na página antes)
#   CIVITAI_TOKEN=xxx         para downloads do Civitai que pedem conta
set -euo pipefail

COMFY="${COMFYUI_DIR:-$HOME/ComfyUI}"
CKPT="$COMFY/models/checkpoints"
LORA="$COMFY/models/loras"
HF="https://huggingface.co"

if [ ! -d "$COMFY" ]; then
  echo "❌ Não achei o ComfyUI em $COMFY (defina COMFYUI_DIR=/caminho)." >&2
  exit 1
fi
mkdir -p "$CKPT" "$LORA"
command -v wget >/dev/null || { echo "Instalando wget…"; sudo apt-get install -y wget; }

livre_gb() { df -BG --output=avail "$COMFY" | tail -1 | tr -dc '0-9'; }

# baixar <url> <arquivo de destino> <tamanho aproximado em GB>
baixar() {
  local url="$1" dest="$2" gb="$3"
  if [ -s "$dest" ] && [ ! -f "$dest.part" ]; then
    echo "✅ Já existe: $(basename "$dest")"
    return
  fi
  if [ "$(livre_gb)" -lt $((gb + 2)) ]; then
    echo "❌ Pouco espaço: $(basename "$dest") precisa de ~${gb} GB e há $(livre_gb) GB livres." >&2
    return 1
  fi
  echo "⬇️  $(basename "$dest") (~${gb} GB)"
  local hdr=()
  if [[ "$url" == "$HF"* ]] && [ -n "${HF_TOKEN:-}" ]; then hdr=(--header="Authorization: Bearer $HF_TOKEN"); fi
  if [[ "$url" == *civitai.com* ]] && [ -n "${CIVITAI_TOKEN:-}" ]; then
    if [[ "$url" == *\?* ]]; then url="$url&token=$CIVITAI_TOKEN"; else url="$url?token=$CIVITAI_TOKEN"; fi
  fi
  touch "$dest.part"
  # -c continua de onde parou se a internet cair
  wget -c --show-progress -q "${hdr[@]}" -O "$dest" "$url"
  rm -f "$dest.part"
}

hf() { echo "$HF/$1/resolve/main/$2?download=true"; }

essencial() {
  # Pintura de fantasia rápida (Turbo: ~8 passos) — ótimo padrão
  baixar "$(hf Lykon/dreamshaper-xl-v2-turbo DreamShaperXL_Turbo_v2_1.safetensors)" "$CKPT/DreamShaperXL_Turbo_v2_1.safetensors" 7
  # Realista / fantasia sombria
  baixar "$(hf RunDiffusion/Juggernaut-XL-v9 Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors)" "$CKPT/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors" 7
  # LoRA de pixel art (estilo "Pixel art 16-bit")
  baixar "$(hf nerijs/pixel-art-xl pixel-art-xl.safetensors)" "$LORA/pixel-art-xl.safetensors" 1
}

completo() {
  essencial
  # Anime
  baixar "$(hf cagliostrolab/animagine-xl-3.1 animagine-xl-3.1.safetensors)" "$CKPT/animagine-xl-3.1.safetensors" 7
  # FLUX.1 schnell (Apache 2.0): segue muito bem a descrição, 4 passos; na RTX 2060 usa a RAM também
  baixar "$(hf Comfy-Org/flux1-schnell flux1-schnell-fp8.safetensors)" "$CKPT/flux1-schnell-fp8.safetensors" 17
}

case "${1:-}" in
  essencial) essencial ;;
  completo) completo ;;
  flux-dev)
    echo "ℹ️  FLUX.1 dev tem licença NÃO comercial (uso pessoal ok)."
    baixar "$(hf Comfy-Org/flux1-dev flux1-dev-fp8.safetensors)" "$CKPT/flux1-dev-fp8.safetensors" 17 ;;
  sdxl-base)
    baixar "$(hf stabilityai/stable-diffusion-xl-base-1.0 sd_xl_base_1.0.safetensors)" "$CKPT/sd_xl_base_1.0.safetensors" 7 ;;
  url)
    [ -n "${2:-}" ] || { echo "Uso: $0 url <URL> [nome.safetensors] [checkpoints|loras]" >&2; exit 1; }
    nome="${3:-$(basename "${2%%\?*}")}"
    [[ "$nome" == *.safetensors ]] || nome="$nome.safetensors"
    pasta="$CKPT"; [ "${4:-checkpoints}" = "loras" ] && pasta="$LORA"
    baixar "$2" "$pasta/$nome" 7 ;;
  *)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    echo
    echo "Instalados agora em $CKPT:"
    ls -1sh "$CKPT" 2>/dev/null | tail -n +2 || true
    exit 0 ;;
esac

echo
echo "🎉 Pronto. Reinicie o ComfyUI (Ctrl+C e python main.py) e clique em 🔄 Verificar na aba 🎨 Arte."
