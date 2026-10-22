#!/usr/bin/env bash
# Confere e corrige o server/.env da Mesa RPG (faz backup antes).
#
# Uso:  ./scripts/corrigir-env.sh
#       DOMINIO=mesarpgweb.duckdns.org ./scripts/corrigir-env.sh   (libera também o endereço do DuckDNS)
#
# O que ele corrige:
#   - cria o .env a partir do .env.example se não existir
#   - remove quebras de linha do Windows (\r), espaços e aspas sobrando
#   - chaves repetidas (vale a última; as outras viram comentário)
#   - completa as chaves que faltam com o valor do .env.example
#   - troca os segredos JWT de exemplo (ou curtos) por segredos fortes
#   - acerta PORT e NODE_ENV, e libera o endereço do DuckDNS
#   - testa o DATABASE_URL e, se não conectar, procura o banco (Docker ou Ubuntu)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$REPO/server/.env"
EXAMPLE="$REPO/server/.env.example"

if [ ! -f "$ENV" ]; then
  cp "$EXAMPLE" "$ENV"
  echo "📄 server/.env não existia: criei a partir do .env.example."
fi
BACKUP="$ENV.bak-$(date +%Y%m%d-%H%M%S)"
cp "$ENV" "$BACKUP"
echo "💾 Backup: $BACKUP"

SECRET1="$(openssl rand -hex 48 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"
SECRET2="$(openssl rand -hex 48 2>/dev/null || head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"

python3 -I - "$ENV" "$EXAMPLE" "$SECRET1" "$SECRET2" "${DOMINIO:-}" <<'PY'
import re, sys
env_path, ex_path, s1, s2, dominio = sys.argv[1:6]
KEY = re.compile(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$')
PLACEHOLDERS = {'troque-este-segredo-de-acesso-por-algo-bem-longo', 'troque-este-segredo-de-refresh-por-outro-valor'}

def clean(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
        v = v[1:-1]
    elif ' #' in v:
        v = v.split(' #', 1)[0].strip()
    return v

raw = open(env_path, encoding='utf-8', errors='replace').read().replace('﻿', '')
lines = raw.replace('\r\n', '\n').replace('\r', '\n').split('\n')
example = {}
for l in open(ex_path, encoding='utf-8').read().split('\n'):
    m = KEY.match(l)
    if m: example[m.group(1)] = clean(m.group(2))

changes = []
last = {}
for i, l in enumerate(lines):
    m = KEY.match(l)
    if m: last[m.group(1)] = i
out, values = [], {}
for i, l in enumerate(lines):
    m = KEY.match(l)
    if not m:
        out.append(l.rstrip()); continue
    k, v = m.group(1), clean(m.group(2))
    if last[k] != i:
        out.append('# (repetida, vale a de baixo) ' + l.strip()); changes.append(f'{k}: linha repetida virou comentário'); continue
    if l != f'{k}={v}':
        changes.append(f'{k}: formato corrigido (espaços/aspas/\\r)')
    values[k] = v
    out.append(f'{k}={v}')

def setv(k, v, why):
    if values.get(k) == v: return
    values[k] = v
    for j, l in enumerate(out):
        if l.startswith(k + '='):
            out[j] = f'{k}={v}'; break
    else:
        out.append(f'{k}={v}')
    changes.append(f'{k}: {why}')

for k, v in example.items():
    if k not in values:
        setv(k, v, 'faltava (valor do exemplo)')

for k, s in (('JWT_SECRET', s1), ('JWT_REFRESH_SECRET', s2)):
    v = values.get(k, '')
    if v in PLACEHOLDERS or len(v) < 32:
        setv(k, s, 'segredo novo e forte gerado (todos precisarão entrar de novo)')
if values.get('JWT_SECRET') == values.get('JWT_REFRESH_SECRET'):
    setv('JWT_REFRESH_SECRET', s2, 'era igual ao JWT_SECRET: gerei outro')

if not re.fullmatch(r'\d{2,5}', values.get('PORT', '')):
    setv('PORT', '3333', 'porta inválida, usei 3333')
if values.get('NODE_ENV') not in ('development', 'production'):
    setv('NODE_ENV', 'production', 'valor inválido, usei production')
if not values.get('DATABASE_URL', '').startswith(('postgres://', 'postgresql://')):
    setv('DATABASE_URL', example['DATABASE_URL'], 'endereço do banco inválido, usei o padrão')
for b in ('DATABASE_SSL', 'DATABASE_LOGGING'):
    if values.get(b) not in ('true', 'false', '1', '0'):
        setv(b, 'false', 'deveria ser true/false')
if not re.match(r'^https?://', values.get('COMFYUI_URL', '')):
    setv('COMFYUI_URL', 'http://127.0.0.1:8188', 'endereço do ComfyUI inválido')
for k in ('AUTOSAVE_SECONDS', 'AUTOSAVE_KEEP', 'REFRESH_TOKEN_DAYS'):
    if not re.fullmatch(r'\d+', values.get(k, '')):
        setv(k, example.get(k, '60'), 'deveria ser um número')

if dominio:
    port = values['PORT']
    origins = [o.strip() for o in values.get('CORS_ORIGIN', '').split(',') if o.strip()]
    for o in (f'http://{dominio}:{port}', f'http://{dominio}'):
        if o not in origins: origins.append(o)
    setv('CORS_ORIGIN', ','.join(origins), f'liberado o endereço {dominio}')

while out and out[-1] == '': out.pop()
open(env_path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('\n'.join('   🔧 ' + c for c in changes) if changes else '   ✅ Nada para corrigir no formato e nas chaves.')
PY

# Testa a conexão com o banco; se falhar, procura um que funcione
testa() {
  (cd "$REPO/server" && URL="$1" REPO="$REPO" node -e "
    const { Client } = require(require.resolve('pg', { paths: [process.env.REPO + '/server', process.env.REPO] }));
    const c = new Client({ connectionString: process.env.URL, connectionTimeoutMillis: 4000 });
    c.connect().then(() => c.query('SELECT 1')).then(() => { console.log('ok'); return c.end(); }).catch((e) => { console.log('erro: ' + e.message); process.exit(1); });
  " 2>&1 | tail -1)
}
DB="$(grep -E '^DATABASE_URL=' "$ENV" | tail -1 | cut -d= -f2-)"
r="$(testa "$DB" || true)"
if [ "$r" = ok ]; then
  echo "   ✅ Banco conecta com o DATABASE_URL do .env"
else
  echo "   ⚠️  O banco não conectou ($r). Procurando…"
  ACHOU=""
  for cand in "postgres://mesa:mesa@localhost:5432/mesa_rpg" "postgres://mesa:mesa@127.0.0.1:5432/mesa_rpg" "postgres://mesa:mesa@localhost:5433/mesa_rpg"; do
    if [ "$(testa "$cand" || true)" = ok ]; then ACHOU="$cand"; break; fi
  done
  if [ -n "$ACHOU" ]; then
    sed -i "s#^DATABASE_URL=.*#DATABASE_URL=$ACHOU#" "$ENV"
    echo "   🔧 DATABASE_URL: encontrei o banco em $ACHOU"
  else
    echo "   ❌ Não achei o banco. Ligue-o:"
    echo "      Docker:  cd $REPO && docker compose up -d"
    echo "      Ubuntu:  sudo systemctl start postgresql"
  fi
fi

echo
echo "Resumo do server/.env (segredos escondidos):"
sed -E 's/^(JWT_SECRET|JWT_REFRESH_SECRET|MASTER_INVITE_CODE)=(.{4}).*/\1=\2…(escondido)/; s#(postgres(ql)?://[^:]+:)[^@]+@#\1***@#' "$ENV" | grep -vE '^\s*(#|$)' | sed 's/^/   /'
echo
if systemctl list-unit-files 2>/dev/null | grep -q '^mesa-rpg.service'; then
  echo "➡️  Reinicie para valer:  sudo systemctl restart mesa-rpg   e depois  ./scripts/verificar.sh"
else
  echo "➡️  Reinicie a mesa (Ctrl+C e npm start) e depois rode ./scripts/verificar.sh"
fi
