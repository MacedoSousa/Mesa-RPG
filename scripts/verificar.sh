#!/usr/bin/env bash
# Confere se a Mesa RPG subiu inteira: servidor, banco, configs, imagens, saves, IA e acesso externo.
#
# Uso:  ./scripts/verificar.sh                         (espera até 2 min o servidor ligar)
#       DOMINIO=mesarpgweb.duckdns.org ./scripts/verificar.sh   (confere também o DuckDNS)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORT="$(grep -E '^PORT=' "$REPO/server/.env" 2>/dev/null | cut -d= -f2 | tr -d '\r ')"
PORT="${PORTA:-${PORT:-3333}}"
URL="http://127.0.0.1:$PORT"
FALHAS=0

echo "🩺 Mesa RPG — checagem ($(date '+%d/%m %H:%M'))"
echo

# Serviços do Ubuntu (se instalados com scripts/instalar-servicos.sh)
if systemctl list-unit-files 2>/dev/null | grep -q '^mesa-rpg.service'; then
  for s in mesa-rpg comfyui docker postgresql; do
    systemctl list-unit-files 2>/dev/null | grep -q "^$s.service" || continue
    st="$(systemctl is-active "$s" 2>/dev/null)"
    [ "$st" = active ] && echo "✅ Serviço $s: ligado" || { echo "❌ Serviço $s: $st  (veja: journalctl -u $s -n 30)"; [ "$s" = mesa-rpg ] && FALHAS=1; }
  done
fi
if command -v docker >/dev/null && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx mesa-rpg-db; then
  h="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' mesa-rpg-db 2>/dev/null)"
  [ "$h" = healthy ] || [ "$h" = running ] && echo "✅ Banco no Docker: $h" || { echo "❌ Banco no Docker: $h  (rode: docker compose up -d)"; FALHAS=1; }
fi

# Espera o servidor responder (logo depois de ligar o PC ele pode demorar um pouco)
printf '⏳ Esperando o servidor em %s ' "$URL"
for i in $(seq 1 40); do
  # qualquer resposta HTTP serve (503 = servidor no ar, mas banco fora)
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/health")" != 000 ] && break
  printf '.'; sleep 3
done
echo
if [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/health")" = 000 ]; then
  echo "❌ O servidor não respondeu. Veja: journalctl -u mesa-rpg -n 50  (ou rode: cd $REPO && npm start)"
  exit 1
fi

# Checagem completa feita pelo próprio servidor
curl -s "$URL/api/health/detalhe" | python3 -c '
import json, sys
d = json.load(sys.stdin)
icon = {"ok": "✅", "aviso": "⚠️ ", "erro": "❌"}
for c in d["checks"]:
    print(icon[c["level"]], c["label"] + ":", c["detail"])
sys.exit(0 if d["ok"] else 2)
' || FALHAS=1

# Acesso de fora de casa (DuckDNS + porta do roteador)
if [ -n "${DOMINIO:-}" ]; then
  ipdns="$(getent ahostsv4 "$DOMINIO" | awk 'NR==1{print $1}')"
  ippub="$(curl -s --max-time 5 https://api.ipify.org || true)"
  if [ -z "$ipdns" ]; then echo "❌ DuckDNS: $DOMINIO não resolve"; FALHAS=1
  elif [ -n "$ippub" ] && [ "$ipdns" != "$ippub" ]; then echo "⚠️  DuckDNS: $DOMINIO aponta para $ipdns, mas seu IP público é $ippub (o atualizador do DuckDNS está rodando?)"
  else echo "✅ DuckDNS: $DOMINIO → $ipdns"; fi
fi

echo
if [ "$FALHAS" = 0 ]; then
  echo "🎲 Tudo certo! Mestre: http://localhost:$PORT/host"
else
  echo "Há itens com ❌ acima: resolva antes de chamar os jogadores."
  exit 2
fi
