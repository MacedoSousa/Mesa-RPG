/**
 * Camada de "bonecos" do mapa: cada token vira uma figura pré-renderizada do 3D,
 * que anda pelo caminho, vira para onde vai, ataca, se fere e cai.
 * O código 3D (three.js) só é carregado quando esta camada é usada.
 */
import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { CONDITIONS, type ProjectedState } from '@mesa/shared';
import { TILE } from './mapRender';

type Token = ProjectedState['tokens'][number];
type BakeState = 'idle' | 'walk' | 'attack' | 'hit' | 'death';
type Dir = 's' | 'e' | 'n' | 'w';
type FiguresModule = typeof import('./hero3d/tokenFigures');

/** Unidades do mundo 3D por casa do mapa (o herói fica com ~1,5 casa de altura). */
const UNITS_PER_TILE = 1.6;
const SPEED = 5 * TILE; // px por segundo andando

interface Sheet {
  frames: Record<'s' | 'e' | 'n', Record<BakeState, Texture[]>>;
  fps: Record<BakeState, number>;
  anchorY: number;
  scale: number;
  heightPx: number;
}

interface Fig {
  key: string;
  cont: Container;
  base: Graphics;
  sprite: Sprite;
  overlay: Container;
  px: number;
  py: number;
  path: { x: number; y: number }[];
  dir: Dir;
  state: BakeState;
  t: number;
  dead: boolean;
  /** Cor base (monstro morto fica acinzentado). */
  tint: number;
  /** ms restantes do clarão vermelho de dano. */
  flash: number;
  /** ms até o golpe chegar (o boneco só reage no impacto). */
  hitIn: number;
  dust: number;
}

interface Puff { g: Graphics; life: number }

const feet = (x: number, y: number) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE * 0.74 });

export class FigureLayer {
  readonly container = new Container();
  private mod: FiguresModule | null = null;
  private loading: Promise<FiguresModule | null> | null = null;
  private sheets = new Map<string, Sheet | 'loading' | 'failed'>();
  private figs = new Map<string, Fig>();
  private unitPx = qualityPx(figureMode());

  /** Troca a resolução dos bonecos (alta / leve). */
  setMode(mode: FigureMode) {
    const px = qualityPx(mode);
    if (px === this.unitPx) return;
    this.unitPx = px;
    this.reset();
  }
  private destroyed = false;

  constructor(private onReady: () => void) {
    this.container.sortableChildren = true;
    (globalThis as { __figureLayer?: FigureLayer }).__figureLayer = this; // inspeção nos testes visuais
  }

  /** Estado das folhas (diagnóstico). */
  debug() {
    return { module: !!this.mod, sheets: [...this.sheets].map(([k, v]) => `${k}:${typeof v === 'string' ? v : 'ok'}`), figs: this.figs.size };
  }

  private loadModule() {
    if (!this.loading) {
      this.loading = import('./hero3d/tokenFigures')
        .then((m) => (m.webglOk() ? m : null))
        .catch(() => null)
        .then((m) => {
          this.mod = m;
          if (!this.destroyed) this.onReady();
          return m;
        });
    }
    return this.loading;
  }

  private sheetFor(t: Token): Sheet | null {
    const m = this.mod;
    if (!m) return null;
    const f = m.atlasFor(t as never, this.unitPx);
    if (!f) return null;
    const sk = `${f.key}@${this.unitPx}`;
    const cur = this.sheets.get(sk);
    if (cur === 'loading' || cur === 'failed') return null;
    if (cur) return cur;
    this.sheets.set(sk, 'loading');
    void f.atlas.then((atlas) => {
      if (this.destroyed) return;
      if (!atlas) { this.sheets.set(sk, 'failed'); return; }
      if (atlas.unitPx !== this.unitPx) return;
      const base = Texture.from(atlas.canvas);
      const frames = {} as Sheet['frames'];
      for (const d of ['s', 'e', 'n'] as const) {
        frames[d] = {} as Record<BakeState, Texture[]>;
        for (const [state, list] of Object.entries(atlas.frames[d])) {
          frames[d][state as BakeState] = list.map((r) => new Texture({ source: base.source, frame: new Rectangle(r.x, r.y, atlas.frameW, atlas.frameH) }));
        }
      }
      const fps = Object.fromEntries(m.BAKE_STATES.map((b) => [b.state, b.fps])) as Record<BakeState, number>;
      const scale = TILE / UNITS_PER_TILE / atlas.unitPx;
      this.sheets.set(sk, { frames, fps, anchorY: atlas.anchorY / atlas.frameH, scale, heightPx: atlas.anchorY * scale });
      this.onReady();
    });
    return null;
  }

  private keyOf(t: Token) {
    return this.mod?.figureFor(t as never)?.key ?? null;
  }

  /**
   * Atualiza as figuras a partir do estado. Devolve os ids desenhados como boneco
   * (os demais continuam como fichas redondas até a folha ficar pronta).
   */
  sync(tokens: Token[], o: { currentId: string | null; selectedId: string | null | undefined }): Set<string> {
    const drawn = new Set<string>();
    if (!this.mod) { void this.loadModule(); return drawn; }
    const alive = new Set<string>();
    for (const t of tokens) {
      const sheet = this.sheetFor(t);
      const key = this.keyOf(t);
      if (!sheet || !key) continue;
      alive.add(t.id);
      drawn.add(t.id);
      let f = this.figs.get(t.id);
      const target = feet(t.x, t.y);
      if (!f || f.key !== key) {
        if (f) f.cont.destroy({ children: true });
        const cont = new Container();
        const base = new Graphics();
        const sprite = new Sprite(sheet.frames.s.idle[0]);
        sprite.anchor.set(0.5, sheet.anchorY);
        sprite.scale.set(sheet.scale);
        const overlay = new Container();
        cont.addChild(base, sprite, overlay);
        this.container.addChild(cont);
        f = { key, cont, base, sprite, overlay, px: target.x, py: target.y, path: [], dir: 's', state: t.dead ? 'death' : 'idle', t: t.dead ? 1e6 : 0, dead: t.dead, tint: 0xffffff, flash: 0, hitIn: 0, dust: 0 };
        this.figs.set(t.id, f);
      }
      // Andou sem caminho (ex.: o Mestre arrastou): vai em linha reta
      const last = f.path.length ? f.path[f.path.length - 1] : { x: f.px, y: f.py };
      if (Math.abs(last.x - target.x) > 1 || Math.abs(last.y - target.y) > 1) f.path = [target];
      if (t.dead && !f.dead) this.setState(f, 'death');
      if (!t.dead && f.dead) this.setState(f, 'idle');
      f.dead = t.dead;
      this.decorate(f, t, sheet, o);
    }
    for (const [id, f] of this.figs) if (!alive.has(id)) { f.cont.destroy({ children: true }); this.figs.delete(id); }
    return drawn;
  }

  /** Base (sombra e anéis), barra de vida e condições. */
  private decorate(f: Fig, t: Token, sheet: Sheet, o: { currentId: string | null; selectedId: string | null | undefined }) {
    const g = f.base;
    g.clear();
    const rx = TILE * 0.36, ry = TILE * 0.13;
    g.ellipse(0, 0, rx, ry).fill({ color: 0x000000, alpha: 0.38 });
    const color = parseInt((t.color ?? '#888888').replace('#', ''), 16);
    if (!t.dead) g.ellipse(0, 0, rx, ry).stroke({ width: 2, color: t.kind === 'monstro' ? 0xff4040 : color, alpha: 0.7 });
    if (t.id === o.currentId) g.ellipse(0, 0, rx + 5, ry + 3).stroke({ width: 3, color: 0xffd34d, alpha: 0.95 });
    if (t.id === o.selectedId) g.ellipse(0, 0, rx + 3, ry + 2).stroke({ width: 2.5, color: 0x7cf3ff });
    for (const c of f.overlay.removeChildren()) c.destroy();
    const hp = typeof t.hp === 'number' && typeof t.maxHp === 'number' ? t.hp / Math.max(1, t.maxHp) : null;
    if (!t.dead) {
      if (hp !== null) {
        f.overlay.addChild(new Graphics().roundRect(-TILE * 0.34, ry + 3, TILE * 0.68, 5, 2.5).fill(0x220000).roundRect(-TILE * 0.34, ry + 3, TILE * 0.68 * hp, 5, 2.5).fill(hp > 0.5 ? 0x4cd964 : hp > 0.25 ? 0xffcc00 : 0xff3b30));
      } else if ('hpStatus' in t) {
        const status = (t as { hpStatus: string }).hpStatus;
        g.ellipse(0, 0, rx - 3, ry - 2).stroke({ width: 2, color: status === 'ileso' ? 0x4cd964 : status === 'ferido' ? 0xffcc00 : 0xff3b30, alpha: 0.9 });
      }
      const icons = [t.emblem ?? '', ...t.conditions.slice(0, 3).map((k) => CONDITIONS[k]?.icon ?? '')].join('');
      if (icons) {
        const txt = new Text({ text: icons, style: { fontSize: 11 } });
        txt.anchor.set(0.5, 1);
        txt.position.set(0, -sheet.heightPx * 0.92);
        f.overlay.addChild(txt);
      }
    }
    f.cont.alpha = t.hidden ? 0.45 : t.dead && t.kind === 'monstro' ? 0.8 : 1;
    f.tint = t.dead && t.kind === 'monstro' ? 0x9a9a9a : 0xffffff;
  }

  private setState(f: Fig, s: BakeState) {
    if (f.state === 'death' && s !== 'idle') return;
    f.state = s;
    f.t = 0;
  }

  private face(f: Fig, dx: number, dy: number) {
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  }

  /** Caminho vindo do servidor: anda casa a casa. */
  onMove(tokenId: string, path: { x: number; y: number }[]) {
    const f = this.figs.get(tokenId);
    if (!f || !path.length) return;
    f.path = path.map((p) => feet(p.x, p.y));
  }

  onAttack(attackerId: string, targetId: string) {
    const a = this.figs.get(attackerId);
    const b = this.figs.get(targetId);
    if (!a) return;
    if (b) this.face(a, b.px - a.px, b.py - a.py);
    this.setState(a, 'attack');
  }

  onHit(tokenId: string, delayMs = 0) {
    const f = this.figs.get(tokenId);
    if (!f) return;
    if (delayMs > 0) f.hitIn = delayMs;
    else { f.flash = 220; if (!f.dead) this.setState(f, 'hit'); }
  }

  private puffs: Puff[] = [];

  /** Nuvenzinha de poeira nos pés de quem anda. */
  private puff(x: number, y: number) {
    const g = new Graphics();
    for (let i = 0; i < 3; i++) g.circle((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 4, 2.5 + Math.random() * 2.5).fill({ color: 0xd8c8a8, alpha: 0.55 });
    g.position.set(x, y + 2);
    g.zIndex = y - 1;
    this.container.addChild(g);
    this.puffs.push({ g, life: 450 });
  }

  tick(dtMs: number) {
    for (const p of this.puffs) {
      p.life -= dtMs;
      p.g.alpha = Math.max(0, p.life / 450);
      p.g.scale.set(1 + (1 - p.life / 450) * 0.8);
      p.g.y -= dtMs * 0.01;
    }
    for (const p of this.puffs.filter((x) => x.life <= 0)) p.g.destroy();
    this.puffs = this.puffs.filter((x) => x.life > 0);
    for (const f of this.figs.values()) {
      const sheet = this.sheets.get(`${f.key}@${this.unitPx}`);
      if (!sheet || typeof sheet === 'string') continue;
      // Movimento ao longo do caminho
      if (f.path.length) {
        const next = f.path[0];
        const dx = next.x - f.px, dy = next.y - f.py;
        const dist = Math.hypot(dx, dy);
        const step = (SPEED * dtMs) / 1000;
        this.face(f, dx, dy);
        if (dist <= step) { f.px = next.x; f.py = next.y; f.path.shift(); } else { f.px += (dx / dist) * step; f.py += (dy / dist) * step; }
        f.dust -= dtMs;
        if (f.dust <= 0) { this.puff(f.px, f.py); f.dust = 160; }
        if (f.state === 'idle') this.setState(f, 'walk');
      } else if (f.state === 'walk') this.setState(f, 'idle');
      if (f.hitIn > 0) {
        f.hitIn -= dtMs;
        if (f.hitIn <= 0) { f.flash = 220; if (!f.dead) this.setState(f, 'hit'); }
      }
      if (f.flash > 0) f.flash -= dtMs;
      f.sprite.tint = f.flash > 0 ? 0xff7070 : f.tint;
      // Pulinho de investida no começo do ataque
      const lunge = f.state === 'attack' ? Math.sin(Math.min(1, f.t / 300) * Math.PI) * 5 : 0;
      const ld = f.dir === 'e' ? [1, 0] : f.dir === 'w' ? [-1, 0] : f.dir === 'n' ? [0, -1] : [0, 1];
      f.cont.position.set(f.px + ld[0] * lunge, f.py + ld[1] * lunge);
      f.cont.zIndex = f.py;
      // Quadro da animação
      f.t += dtMs;
      const dir = f.dir === 'w' ? 'e' : f.dir;
      const list = sheet.frames[dir][f.state];
      const n = list.length;
      let i = Math.floor((f.t / 1000) * sheet.fps[f.state]);
      if (f.state === 'idle' || f.state === 'walk') i %= n;
      else if (i >= n) {
        if (f.state === 'death') i = n - 1;
        else { this.setState(f, f.path.length ? 'walk' : 'idle'); i = 0; }
      }
      const tex = sheet.frames[dir][f.state][Math.min(i, sheet.frames[dir][f.state].length - 1)];
      if (f.sprite.texture !== tex) f.sprite.texture = tex;
      f.sprite.scale.x = (f.dir === 'w' ? -1 : 1) * sheet.scale;
    }
  }

  /** Recria texturas e figuras (ex.: depois de o contexto gráfico voltar). */
  reset() {
    for (const f of this.figs.values()) f.cont.destroy({ children: true });
    this.figs.clear();
    this.sheets.clear();
  }

  destroy() {
    this.destroyed = true;
    this.container.destroy({ children: true });
    this.figs.clear();
  }
}

// ───────────── Preferência: bonecos ou fichas ─────────────

const PREF = 'mesa.figuras';
const prefListeners = new Set<() => void>();
/** ultra: placa de vídeo dedicada (ex.: RTX 2060) · alta: padrão · leve: celulares fracos · fichas: sem bonecos. */
export type FigureMode = 'ultra' | 'alta' | 'leve' | 'fichas';
let memo: FigureMode | null = null;

/** Pixels por unidade 3D: "leve" é para celulares mais fracos. */
function qualityPx(mode: FigureMode) {
  if (mode === 'leve') return 20;
  if (mode === 'ultra') return Math.round(58 * Math.min(1.6, Math.max(1, (globalThis.devicePixelRatio || 1) * 0.8)));
  return Math.round(34 * Math.min(1.5, Math.max(1, (globalThis.devicePixelRatio || 1) * 0.75)));
}

export function figureMode(): FigureMode {
  if (memo) return memo;
  try {
    const v = localStorage.getItem(PREF);
    memo = v === 'fichas' || v === 'leve' || v === 'alta' || v === 'ultra' ? v : strongGpu() ? 'ultra' : 'alta';
  } catch {
    memo = 'alta';
  }
  return memo;
}

/** Qualidade gráfica máxima ligada? (bonecos em alta resolução, brilho, sombras e reflexos). */
export function ultraGraphics(): boolean {
  return figureMode() === 'ultra';
}

let gpuMemo: boolean | null = null;
/** Placa de vídeo dedicada de desktop (GeForce/Radeon/Apple M): liga o Ultra por padrão. */
export function strongGpu(): boolean {
  if (gpuMemo !== null) return gpuMemo;
  gpuMemo = false;
  try {
    if (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) return gpuMemo;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    if (!gl) return gpuMemo;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gpuMemo = /RTX|GTX 1[0-9]{3}|GTX 16|Radeon RX|Radeon Pro|Apple M\d|Arc A/i.test(name);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* sem WebGL */
  }
  return gpuMemo;
}

export function figuresPreferred(): boolean {
  return figureMode() !== 'fichas';
}

export function setFigureMode(mode: FigureMode) {
  memo = mode;
  try {
    localStorage.setItem(PREF, mode);
  } catch {
    /* sem armazenamento: vale só nesta tela */
  }
  for (const l of prefListeners) l();
}

export function onFiguresPref(fn: () => void) {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}
