import { ArtPanel } from '../panels/ArtPanel';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { OBJECTS, SURFACES, TERRAIN, type Command, type Token } from '@mesa/shared';
import {
  Badge, Button, CinematicLayer, LogFeed, MapCanvas, Modal, Spinner, Tabs, api, cx, navigate, toast, useTable, type Cell,
} from '@mesa/common';
import { CombatPanel } from '../panels/CombatPanel';
import { TablePanel } from '../panels/TablePanel';
import { ChaptersPanel, QuestsPanel } from '../panels/StoryPanels';
import { ScriptPanel } from '../panels/ScriptPanel';
import { MapPanel, MonstersPanel, PlayersPanel, SavesPanel } from '../panels/WorldPanels';
import { toolLabel, type Tool } from '../tools';

type Panel = 'roteiro' | 'combate' | 'testes' | 'capitulos' | 'quests' | 'monstros' | 'arte' | 'jogadores' | 'mapa' | 'saves';

interface HealthCheck { key: string; label: string; level: 'ok' | 'aviso' | 'erro'; detail: string }

/** 🩺 Checagem do sistema: banco, configs, imagens, IA, saves (útil depois de religar o PC). */
function HealthBadge() {
  const [data, setData] = useState<{ ok: boolean; checks: HealthCheck[] } | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => api<{ ok: boolean; checks: HealthCheck[] }>('/health/detalhe').then(setData).catch(() => setData({ ok: false, checks: [{ key: 'api', label: 'Servidor', level: 'erro', detail: 'Não respondeu' }] }));
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, []);
  const warn = data?.checks.some((c) => c.level === 'aviso');
  const icon = { ok: '✅', aviso: '⚠️', erro: '❌' } as const;
  return (
    <>
      <button onClick={() => { setOpen(true); void load(); }} className={cx('rounded-lg px-2 py-1 text-sm', !data ? 'bg-white/5' : !data.ok ? 'bg-rose-500/20 text-rose-100' : warn ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-100')} title="Checagem do sistema">
        🩺 {!data ? '…' : !data.ok ? 'Problema' : warn ? 'Ok, com avisos' : 'Tudo ok'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="🩺 Checagem do sistema">
        <div className="space-y-2">
          {data?.checks.map((c) => (
            <div key={c.key} className={cx('rounded-lg p-2 text-sm', c.level === 'erro' ? 'bg-rose-500/15' : c.level === 'aviso' ? 'bg-amber-500/10' : 'bg-white/5')}>
              <p className="font-semibold">{icon[c.level]} {c.label}</p>
              <p className="text-xs text-slate-300">{c.detail}</p>
            </div>
          ))}
          <Button size="sm" variant="subtle" onClick={() => void load()}>🔄 Checar de novo</Button>
        </div>
      </Modal>
    </>
  );
}

export function MasterHUD({ campaignId }: { campaignId: string }) {
  const { state, status, connect, disconnect, send } = useTable();
  const [panel, setPanel] = useState<Panel>('roteiro');
  const [tool, setTool] = useState<Tool>({ kind: 'select' });
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [campaign, setCampaign] = useState<{ name: string; joinCode: string } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const paintBuffer = useRef<{ x: number; y: number; t?: string; o?: string | null; s?: string | null }[]>([]);
  const paintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    connect(campaignId);
    api<{ campaign: { name: string; joinCode: string } }>(`/campaigns/${campaignId}`).then((r) => setCampaign(r.campaign)).catch(() => navigate('/'));
    return () => disconnect();
  }, [campaignId, connect, disconnect]);

  // Atalho: Esc volta para a ferramenta de seleção
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTool({ kind: 'select' });
        setSelected(null);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  if (!state) return <Spinner label={status === 'erro' ? 'Falha ao abrir a mesa' : 'Abrindo a mesa...'} />;

  const selectedToken = selected ? (state.tokens.find((t) => t.id === selected) as Token | undefined) : undefined;
  const combat = state.combat;

  /** Pinceladas são agrupadas num único comando (respeita o rate limit do servidor). */
  function queuePaint(cell: Cell) {
    if (tool.kind !== 'paint') return;
    paintBuffer.current.push({
      x: cell.x, y: cell.y,
      ...(tool.terrain ? { t: tool.terrain } : {}),
      ...(tool.object !== undefined ? { o: tool.object } : {}),
      ...(tool.surface !== undefined ? { s: tool.surface } : {}),
    });
    if (paintTimer.current) return;
    paintTimer.current = setTimeout(() => {
      const cells = paintBuffer.current.splice(0);
      paintTimer.current = null;
      if (cells.length) void send({ type: 'map.paint', cells } as Command);
    }, 200);
  }

  async function onCellClick(cell: Cell, tokenId: string | null) {
    switch (tool.kind) {
      case 'paint':
        return queuePaint(cell);
      case 'spawn':
        return void send({ type: 'monster.spawn', monsterKey: tool.monsterKey, x: cell.x, y: cell.y, hidden: tool.hidden, rollHp: false });
      case 'element':
        return void send({ type: 'map.element', x: cell.x, y: cell.y, radius: tool.radius, element: tool.element, damage: tool.damage || undefined });
      case 'damage':
        return void send({ type: 'map.damage', x: cell.x, y: cell.y, amount: tool.amount, damageType: tool.damageType });
      case 'attack': {
        if (!tokenId) return toast('Clique numa criatura para atacar', 'erro');
        const ok = await send({ type: 'combat.attack', tokenId: tool.attackerId, targetId: tokenId, attackIndex: tool.attackIndex });
        if (ok) setTool({ kind: 'select' });
        return;
      }
      case 'chest':
        if (await send({ type: 'chest.place', x: cell.x, y: cell.y, loot: tool.loot, dracmas: tool.dracmas, lockDc: tool.lockDc, tier: tool.tier, hidden: tool.hidden })) setTool({ kind: 'select' });
        return;
      case 'select': {
        if (tokenId && tokenId !== selected) {
          const isTurn = selectedToken && combat?.currentTokenId === selectedToken.id;
          const target = state!.tokens.find((t) => t.id === tokenId)!;
          const hostile = selectedToken && (selectedToken.kind === 'monstro') !== (target.kind === 'monstro');
          if (selectedToken && hostile && (isTurn || !combat)) {
            return void send({ type: 'combat.attack', tokenId: selectedToken.id, targetId: tokenId, attackIndex: 0 });
          }
          return setSelected(tokenId);
        }
        if (!selectedToken || tokenId) return;
        const inCombat = combat?.order.some((e) => e.tokenId === selectedToken.id);
        if (combat && inCombat) {
          if (combat.currentTokenId === selectedToken.id) return void send({ type: 'token.move', tokenId: selectedToken.id, x: cell.x, y: cell.y });
          return void send({ type: 'token.update', tokenId: selectedToken.id, patch: { x: cell.x, y: cell.y } });
        }
        return void send({ type: 'token.move', tokenId: selectedToken.id, x: cell.x, y: cell.y }).then((ok) => {
          if (!ok) void send({ type: 'token.update', tokenId: selectedToken.id, patch: { x: cell.x, y: cell.y } });
        });
      }
    }
  }

  const hoverTile = hover ? state.map.tiles[hover.y * state.map.width + hover.x] : null;
  const hoverToken = hover ? state.tokens.find((t) => t.x === hover.x && t.y === hover.y && !t.dead) : null;
  const currentName = state.tokens.find((t) => t.id === combat?.currentTokenId)?.name;

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      {/* ── Barra superior ── */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-950/90 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => navigate('/')}>←</Button>
        <h1 className="font-display text-lg text-amber-200">{campaign?.name ?? state.name}</h1>
        {campaign && <button onClick={() => setQrOpen(true)} className="rounded-lg bg-white/5 px-2 py-1 text-sm hover:bg-white/10">🎟️ <code className="text-amber-200">{campaign.joinCode}</code> · QR</button>}
        <Badge color={state.phase === 'combate' ? 'rose' : 'emerald'}>{state.phase === 'combate' ? `⚔️ Combate · rodada ${combat?.round}` : '🧭 Exploração'}</Badge>
        {combat && <Badge color="amber">Turno: {currentName}</Badge>}
        <span className="flex-1" />
        <HealthBadge />
        <Badge color={status === 'conectado' ? 'emerald' : 'amber'}>{status}</Badge>
        <span className="text-sm text-slate-400">{Object.values(state.players).filter((p) => p.connected).length} jogador(es) online</span>
        <Button size="sm" variant={state.paused ? 'gold' : 'subtle'} onClick={() => void send({ type: 'table.setPaused', paused: !state.paused })}>{state.paused ? '▶️ Retomar' : '⏸️ Pausar mesa'}</Button>
        <Button size="sm" variant="subtle" onClick={() => void api(`/campaigns/${campaignId}/saves`, { method: 'POST', json: { name: `Rápido ${new Date().toLocaleTimeString('pt-BR')}` } }).then(() => toast('Mesa salva', 'sucesso'))}>💾 Salvar</Button>
      </header>

      <div className="grid min-h-0 grid-cols-[340px_1fr_320px]">
        {/* ── Painel esquerdo ── */}
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-slate-950/70">
          <Tabs
            className="flex-wrap p-2"
            value={panel}
            onChange={setPanel}
            tabs={[
              { key: 'roteiro', label: '🎬 Roteiro' }, { key: 'combate', label: '⚔️ Combate' }, { key: 'testes', label: '🎯 Testes & 🎁' }, { key: 'capitulos', label: '📖 Fases' }, { key: 'quests', label: '📜 Quests' },
              { key: 'monstros', label: '👹 Monstros' }, { key: 'arte', label: '🎨 Arte' }, { key: 'jogadores', label: '🧑‍🤝‍🧑 Jogadores' }, { key: 'mapa', label: '🗺️ Mapa' }, { key: 'saves', label: '💾 Saves' },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === 'roteiro' && <ScriptPanel state={state} />}
            {panel === 'combate' && <CombatPanel state={state} selectedId={selected} onSelect={setSelected} setTool={setTool} />}
            {panel === 'testes' && <TablePanel state={state} selectedId={selected} setTool={setTool} />}
            {panel === 'capitulos' && <ChaptersPanel state={state} />}
            {panel === 'quests' && <QuestsPanel state={state} />}
            {panel === 'monstros' && <MonstersPanel tool={tool} setTool={setTool} />}
            {panel === 'arte' && <ArtPanel />}
            {panel === 'jogadores' && <PlayersPanel campaignId={campaignId} state={state} />}
            {panel === 'mapa' && <MapPanel campaignId={campaignId} state={state} tool={tool} setTool={setTool} />}
            {panel === 'saves' && <SavesPanel campaignId={campaignId} />}
          </div>
        </aside>

        {/* ── Mapa (visão global) ── */}
        <main className="relative min-h-0">
          <MapCanvas
            state={state}
            selectedTokenId={selected}
            paintMode={tool.kind === 'paint'}
            onCellClick={(c, t) => void onCellClick(c, t)}
            onCellHover={setHover}
            highlights={hover && tool.kind === 'element' ? areaCells(hover, tool.radius) : tool.kind === 'attack' ? attackTargets(state, tool.attackerId, tool.attackIndex) : []}
          />
          <CinematicLayer state={state} master />
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-slate-950/80 px-3 py-1.5 text-sm">
            <span className={cx(tool.kind !== 'select' && 'text-amber-300')}>{toolLabel(tool)}</span>
            {tool.kind !== 'select' && <span className="text-slate-400"> · Esc para sair</span>}
          </div>
          {hover && hoverTile && (
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-slate-950/85 px-3 py-1.5 text-xs text-slate-200">
              ({hover.x}, {hover.y}) {TERRAIN[hoverTile.t].label}
              {hoverTile.hp !== undefined && ` · ${hoverTile.hp}/${TERRAIN[hoverTile.t].maxHp} PV`}
              {hoverTile.o && ` · ${OBJECTS[hoverTile.o.type].label} (${hoverTile.o.hp} PV)`}
              {hoverTile.s && ` · ${SURFACES[hoverTile.s.type].label} (${hoverTile.s.rounds} rod.)`}
              {hoverToken && ` · ${hoverToken.name} ${hoverToken.hp}/${hoverToken.maxHp}`}
            </div>
          )}
        </main>

        {/* ── Dados secretos + log ── */}
        <aside className="flex min-h-0 flex-col gap-3 border-l border-white/10 bg-slate-950/70 p-3">
          <SecretDice />
          <p className="text-sm font-semibold text-amber-200">Registro da mesa (visão do Mestre)</p>
          <LogFeed entries={state.log} className="min-h-0 flex-1" />
          <ChatBox />
        </aside>
      </div>

      <InviteModal open={qrOpen} onClose={() => setQrOpen(false)} joinCode={campaign?.joinCode ?? ''} />
    </div>
  );
}

function attackTargets(state: NonNullable<ReturnType<typeof useTable.getState>['state']>, attackerId: string, index: number) {
  const a = state.tokens.find((t) => t.id === attackerId);
  const atk = a?.attacks[index];
  if (!a || !atk) return [];
  const reach = atk.longRange ?? atk.range;
  return state.tokens
    .filter((t) => t.id !== a.id && !t.dead && Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y)) <= reach)
    .map((t) => ({ x: t.x, y: t.y, color: (t.kind === 'monstro') !== (a.kind === 'monstro') ? 0xff3b30 : 0xffcc00, alpha: 0.35 }));
}

function areaCells(c: Cell, r: number) {
  const out = [];
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) out.push({ x, y, color: 0xc084fc, alpha: 0.3 });
  return out;
}

function SecretDice() {
  const send = useTable((s) => s.send);
  const [formula, setFormula] = useState('1d20');
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState(true);
  const roll = (f: string) => void send({ type: 'dice.roll', formula: f, label: label || undefined, visibility: secret ? 'secreto' : 'publico' });
  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-950/30 p-3">
      <p className="mb-2 text-sm font-semibold text-violet-200">🔒 Caixa de dados {secret ? 'secretos' : 'públicos'}</p>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d20kh1', '1d100'].map((f) => <Button key={f} size="sm" variant="subtle" onClick={() => roll(f)}>{f.replace('2d20kh1', 'Vant.')}</Button>)}
      </div>
      <div className="flex gap-1">
        <input value={formula} onChange={(e) => setFormula(e.target.value)} className="w-20 min-w-0 rounded-lg border border-white/15 bg-slate-950 px-2 py-1 text-sm" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="rótulo" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950 px-2 py-1 text-sm" />
        <Button size="sm" variant="gold" onClick={() => roll(formula)}>Rolar</Button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> Secreto (jogadores não veem)</label>
    </div>
  );
}

function ChatBox() {
  const send = useTable((s) => s.send);
  const [text, setText] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send({ type: 'chat.say', text }); setText(''); }} className="flex gap-1">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Narrar para a mesa..." className="flex-1 rounded-lg border border-white/15 bg-slate-950 px-2 py-1.5 text-sm" />
      <Button size="sm">Enviar</Button>
    </form>
  );
}

function InviteModal({ open, onClose, joinCode }: { open: boolean; onClose: () => void; joinCode: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    api<{ lanUrls: string[]; port: number }>('/host/info').then(async (r) => {
      const list = r.lanUrls.length ? r.lanUrls : [window.location.origin];
      setUrls(list);
      const codes: Record<string, string> = {};
      for (const u of list) codes[u] = await QRCode.toDataURL(`${u}/#/entrar/${joinCode}`, { margin: 1, width: 220 });
      setQr(codes);
    }).catch(() => undefined);
  }, [open, joinCode]);
  return (
    <Modal open={open} onClose={onClose} title="Convidar jogadores">
      <p className="text-sm text-slate-300">Na mesma rede Wi-Fi, os jogadores escaneiam o QR code com a câmera do celular, criam a conta e entram com o código <code className="text-amber-200">{joinCode}</code>.</p>
      <div className="mt-3 space-y-4">
        {urls.map((u) => (
          <div key={u} className="flex items-center gap-3">
            {qr[u] && <img src={qr[u]} alt={`QR code para ${u}`} className="h-40 w-40 rounded-lg bg-white p-1" />}
            <div className="text-sm">
              <p className="font-mono text-amber-200">{u}</p>
              <p className="mt-1 text-slate-400">Se não abrir, confira se o firewall do Windows liberou a porta.</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
