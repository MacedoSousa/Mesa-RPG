import 'pixi.js/unsafe-eval';
import { Application, Assets, Container, type Texture } from 'pixi.js';
import type { MapState } from '@mesa/shared';
import { api } from './api';
import { TILE, buildStaticLayers, terrainSignature } from './mapRender';

/**
 * Mapa repintado pela IA (ComfyUI img2img no PC do Mestre). A pintura fica por baixo de
 * objetos, fichas e bonecos, e só vale enquanto o terreno for o mesmo que foi pintado.
 */
export interface MapArt { url: string; signature: string; width: number; height: number; style?: string }

const cache = new Map<string, MapArt | null>();
const textures = new Map<string, Texture>();
const listeners = new Set<() => void>();
const PREF = 'mesa.mapaPintado';

export function onMapArt(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const notify = () => { for (const l of listeners) l(); };

export async function loadMapArt(campaignId: string, force = false): Promise<MapArt | null> {
  if (!force && cache.has(campaignId)) return cache.get(campaignId) ?? null;
  try {
    const r = await api<{ map: MapArt | null }>(`/art/maps/${campaignId}`);
    const prev = cache.get(campaignId);
    cache.set(campaignId, r.map);
    if (prev?.url !== r.map?.url) notify();
    return r.map;
  } catch {
    return null;
  }
}

export function mapArtFor(campaignId: string | null, map: MapState): MapArt | null {
  if (!campaignId) return null;
  const a = cache.get(campaignId);
  return a && a.signature === terrainSignature(map) && a.width === map.width && a.height === map.height ? a : null;
}

/** Textura da pintura (carrega na primeira vez e avisa quando chegar). */
export function mapArtTexture(art: MapArt): Texture | null {
  const t = textures.get(art.url);
  if (t) return t;
  if (!textures.has(art.url)) {
    textures.set(art.url, null as unknown as Texture);
    void Assets.load<Texture>({ src: art.url, parser: 'loadTextures' }).then((tex) => { textures.set(art.url, tex); notify(); }).catch(() => textures.delete(art.url));
  }
  return null;
}

export function paintedMapPreferred(): boolean {
  try {
    return localStorage.getItem(PREF) !== 'nao';
  } catch {
    return true;
  }
}
export function setPaintedMapPreferred(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'sim' : 'nao');
  } catch {
    /* sem armazenamento */
  }
  notify();
}

/**
 * Desenha o mapa (só o terreno, sem fichas nem objetos) numa imagem para servir de
 * rascunho à IA. Usa um contexto WebGL próprio e o libera ao terminar.
 */
export async function captureMapForPainting(map: MapState, maxSide = 1280): Promise<string> {
  const w = map.width * TILE;
  const h = map.height * TILE;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const app = new Application();
  await app.init({ width: Math.round(w * scale), height: Math.round(h * scale), background: 0x000000, antialias: true, preference: 'webgl' });
  try {
    const built = buildStaticLayers({ ...map, mood: 'dia' });
    const root = new Container();
    root.addChild(built.water, built.ground, built.features, built.canopy);
    root.scale.set(scale);
    app.stage.addChild(root);
    app.render();
    const canvas = app.renderer.extract.canvas({ target: app.stage, frame: undefined }) as HTMLCanvasElement;
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    app.destroy(true, { children: true, texture: false });
  }
}
