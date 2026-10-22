#!/usr/bin/env bash
# Faz a Mesa RPG (e o ComfyUI, se instalado) ligar sozinha quando o PC liga, e reiniciar se cair.
#
# Uso (no Ubuntu, dentro da pasta do projeto):
#   sudo ./scripts/instalar-servicos.sh            → instala e liga os serviços
#   sudo ./scripts/instalar-servicos.sh --remover  → desliga e remove os serviços
#
# Depois:  ./scripts/verificar.sh   (confere banco, configs, imagens e IA)
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Rode com sudo: sudo $0 $*" >&2; exit 1; fi
U="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
HOME_U="$(getent passwd "$U" | cut -d: -f6)"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
COMFY="${COMFYUI_DIR:-$HOME_U/ComfyUI}"

if [ "${1:-}" = "--remover" ]; then
  for s in mesa-rpg comfyui; do
    systemctl disable --now "$s" 2>/dev/null || true
    rm -f "/etc/systemd/system/$s.service"
  done
  systemctl daemon-reload
  echo "🗑️  Serviços removidos. Para ligar à mão: cd $REPO && npm start"
  exit 0
fi

# Node do usuário (funciona com nvm também)
NODE="$(sudo -u "$U" bash -lc 'command -v node' || true)"
if [ -z "$NODE" ]; then echo "❌ Não achei o Node.js para o usuário $U." >&2; exit 1; fi
NODE_DIR="$(dirname "$NODE")"

[ -f "$REPO/server/.env" ] || { echo "❌ Falta $REPO/server/.env (copie de server/.env.example)." >&2; exit 1; }
[ -f "$REPO/server/dist/server.js" ] || { echo "🔨 Fazendo o build primeiro…"; sudo -u "$U" bash -lc "cd '$REPO' && npm run build"; }

# Banco de dados: Docker (docker-compose.yml) ou PostgreSQL instalado no Ubuntu
DB_AFTER=""
if command -v docker >/dev/null && docker ps -a --format '{{.Names}}' | grep -qx mesa-rpg-db; then
  systemctl enable --now docker >/dev/null
  docker update --restart unless-stopped mesa-rpg-db >/dev/null
  docker start mesa-rpg-db >/dev/null || true
  DB_AFTER="docker.service"
  echo "🐳 Banco no Docker (mesa-rpg-db): liga junto com o Docker."
elif systemctl list-unit-files | grep -q '^postgresql'; then
  systemctl enable --now postgresql >/dev/null
  DB_AFTER="postgresql.service"
  echo "🐘 PostgreSQL do Ubuntu: liga sozinho com o PC."
else
  echo "⚠️  Não achei o banco (nem o container mesa-rpg-db, nem o PostgreSQL). O servidor vai tentar conectar mesmo assim."
fi

cat > /etc/systemd/system/mesa-rpg.service <<EOF
[Unit]
Description=Mesa RPG (servidor da mesa)
After=network-online.target $DB_AFTER
Wants=network-online.target $DB_AFTER

[Service]
Type=simple
User=$U
WorkingDirectory=$REPO/server
Environment=PATH=$NODE_DIR:/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE dist/server.js
# Ao desligar o PC: SIGTERM → a mesa salva tudo antes de sair
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [ -x "$COMFY/venv/bin/python" ]; then
  cat > /etc/systemd/system/comfyui.service <<EOF
[Unit]
Description=ComfyUI (IA local da Mesa RPG)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$U
WorkingDirectory=$COMFY
ExecStart=$COMFY/venv/bin/python main.py --listen 127.0.0.1 --port 8188
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
  echo "🎨 ComfyUI encontrado em $COMFY: vai ligar sozinho também."
  COMFY_ON=1
else
  echo "ℹ️  ComfyUI não encontrado em $COMFY (defina COMFYUI_DIR=… se estiver em outra pasta). Ele continua manual."
  COMFY_ON=0
fi

systemctl daemon-reload
systemctl enable --now mesa-rpg >/dev/null
[ "$COMFY_ON" = 1 ] && systemctl enable --now comfyui >/dev/null

echo
echo "✅ Pronto! A Mesa RPG liga sozinha quando o PC liga e reinicia se cair."
echo "   Ver o que está acontecendo:  journalctl -u mesa-rpg -f"
echo "   Reiniciar depois de um git pull + build:  sudo systemctl restart mesa-rpg"
echo "   Conferir tudo:  ./scripts/verificar.sh"
