/**
 * Vida no mapa: partículas e sombras de nuvem conforme o ambiente.
 *  dia      → folhas caindo e sombras de nuvens passando
 *  noite    → vaga-lumes piscando
 *  caverna  → poeira flutuando na luz
 *  submundo → brasas subindo
 *  olimpo   → brilhos dourados e nuvens claras
 */
import { Container, Graphics } from 'pixi.js';
import type { MapMood } from '@mesa/shared';
import { TILE, glowTexture } from './mapRender';
import { Sprite } from 'pixi.js';

interface P { node: Container; x: number; y: number; vx: number; vy: number; phase: number; life: number; max: number }

export class AmbientLayer {
  readonly container = new Container();
  readonly glow = new Container(); // partículas que brilham (modo aditivo, acima da escuridão)
  private parts: P[] = [];
  private clouds: { node: Graphics; speed: number }[] = [];
  private mood: MapMood = 'dia';
  private w = 0;
  private h = 0;
  private hasTrees = false;

  constructor() {
    this.glow.blendMode = 'add';
  }

  /** Reinicia quando o mapa ou o ambiente mudam. */
  setup(width: number, height: number, mood: MapMood, hasTrees: boolean) {
    if (width === this.w && height === this.h && mood === this.mood && hasTrees === this.hasTrees) return;
    this.w = width; this.h = height; this.mood = mood; this.hasTrees = hasTrees;
    for (const c of this.container.removeChildren()) c.destroy({ children: true });
    for (const c of this.glow.removeChildren()) c.destroy({ children: true });
    this.parts = [];
    this.clouds = [];
    const W = width * TILE, H = height * TILE;
    const area = width * height;
    // Sombras de nuvens (dia e Olimpo)
    if (mood === 'dia' || mood === 'olimpo') {
      for (let i = 0; i < Math.max(2, Math.round(area / 220)); i++) {
        const g = new Graphics();
        const r = TILE * (3 + Math.random() * 3);
        for (let k = 0; k < 4; k++) g.ellipse((k - 1.5) * r * 0.55, Math.sin(k * 2.1) * r * 0.2, r * 0.75, r * 0.45).fill({ color: mood === 'olimpo' ? 0xffffff : 0x000000, alpha: mood === 'olimpo' ? 0.05 : 0.07 });
        g.position.set(Math.random() * W, Math.random() * H);
        this.container.addChild(g);
        this.clouds.push({ node: g, speed: 6 + Math.random() * 8 });
      }
    }
    const n = Math.min(70, Math.round(area / (mood === 'dia' ? 9 : 5)));
    for (let i = 0; i < n; i++) this.spawn(true);
  }

  private spawn(initial = false) {
    const W = this.w * TILE, H = this.h * TILE;
    const mood = this.mood;
    let node: Container;
    let vx = 0, vy = 0;
    const max = 4 + Math.random() * 6;
    if (mood === 'dia') {
      if (!this.hasTrees && Math.random() < 0.6) return; // sem árvores, poucas folhas
      const g = new Graphics().ellipse(0, 0, 3, 1.6).fill(Math.random() < 0.5 ? 0x7fae3a : 0xc9a43a);
      node = g;
      vx = 10 + Math.random() * 10; vy = 8 + Math.random() * 8;
      this.container.addChild(node);
    } else {
      const sp = new Sprite(glowTexture());
      sp.anchor.set(0.5);
      const size = mood === 'noite' ? 10 : mood === 'submundo' ? 8 : mood === 'olimpo' ? 9 : 6;
      sp.width = sp.height = size;
      sp.tint = mood === 'noite' ? 0xd8ff6a : mood === 'submundo' ? 0xff6a2a : mood === 'olimpo' ? 0xffe38a : 0xd8d0c0;
      node = sp;
      if (mood === 'submundo') { vx = (Math.random() - 0.5) * 6; vy = -(12 + Math.random() * 14); }
      else if (mood === 'caverna') { vx = (Math.random() - 0.5) * 4; vy = (Math.random() - 0.5) * 3; }
      else { vx = (Math.random() - 0.5) * 8; vy = (Math.random() - 0.5) * 8; }
      this.glow.addChild(node);
    }
    const p: P = { node, x: Math.random() * W, y: mood === 'submundo' && !initial ? H : Math.random() * H, vx, vy, phase: Math.random() * 6.28, life: initial ? Math.random() * max : 0, max };
    node.position.set(p.x, p.y);
    this.parts.push(p);
  }

  tick(dtMs: number, clock: number) {
    const dt = dtMs / 1000;
    const W = this.w * TILE, H = this.h * TILE;
    for (const c of this.clouds) {
      c.node.x += c.speed * dt;
      if (c.node.x > W + TILE * 6) c.node.x = -TILE * 6;
    }
    const dead: P[] = [];
    for (const p of this.parts) {
      p.life += dt;
      const wob = Math.sin(clock * 1.7 + p.phase);
      p.x += (p.vx + wob * 6) * dt;
      p.y += (p.vy + Math.cos(clock * 1.3 + p.phase) * 4) * dt;
      p.node.position.set(p.x, p.y);
      const k = p.life / p.max;
      const fade = Math.min(1, k * 4, (1 - k) * 4);
      if (this.mood === 'noite') p.node.alpha = Math.max(0, fade * (0.35 + 0.65 * Math.max(0, Math.sin(clock * 3 + p.phase))));
      else if (this.mood === 'dia') { p.node.alpha = fade * 0.9; p.node.rotation = clock * 2 + p.phase; }
      else p.node.alpha = fade * 0.8;
      if (p.life >= p.max || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) dead.push(p);
    }
    for (const p of dead) {
      p.node.destroy();
      this.parts.splice(this.parts.indexOf(p), 1);
      this.spawn();
    }
  }

  destroy() {
    this.container.destroy({ children: true });
    this.glow.destroy({ children: true });
  }
}
