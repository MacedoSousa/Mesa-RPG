/**
 * "Assa" figuras 3D em folhas de sprites para o mapa 2D (como os RPGs clássicos com
 * personagens pré-renderizados). Câmera ortográfica a 40°, 3 direções (o oeste é o
 * leste espelhado) e 5 estados animados.
 */
import * as THREE from 'three';
import type { BakeState, Figure } from './figure';

export type Dir = 's' | 'e' | 'n';
export const BAKE_STATES: { state: BakeState; frames: number; fps: number; loop: boolean }[] = [
  { state: 'idle', frames: 4, fps: 4, loop: true },
  { state: 'walk', frames: 6, fps: 10, loop: true },
  { state: 'attack', frames: 5, fps: 11, loop: false },
  { state: 'hit', frames: 3, fps: 10, loop: false },
  { state: 'death', frames: 4, fps: 7, loop: false },
];
const DIRS: { dir: Dir; yaw: number }[] = [
  { dir: 's', yaw: 0 },
  { dir: 'e', yaw: Math.PI / 2 },
  { dir: 'n', yaw: Math.PI },
];
const ELEVATION = THREE.MathUtils.degToRad(40);

export interface FigureAtlas {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  /** Onde ficam os pés no quadro (px a partir do topo). */
  anchorY: number;
  /** Pixels por unidade do mundo (o mapa usa para escalar). */
  unitPx: number;
  /** Retângulo de cada quadro: [dir][estado][i]. */
  frames: Record<Dir, Record<BakeState, { x: number; y: number }[]>>;
}

let shared: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null = null;

function setup() {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a1a', 1.1));
  const key = new THREE.DirectionalLight('#fff0d8', 2.0);
  key.position.set(-3, 6, 5); // luz vindo do alto à esquerda, como no mapa
  scene.add(key);
  const fill = new THREE.DirectionalLight('#9fb8ff', 0.5);
  fill.position.set(4, 2, -2);
  scene.add(fill);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  shared = { renderer, scene, camera };
  return shared;
}

/** Desenha todos os quadros de uma figura numa única folha. */
export async function bakeFigure(fig: Figure, unitPx = 34, yieldFn: () => Promise<void> = async () => undefined): Promise<FigureAtlas> {
  const { renderer, scene, camera } = setup();
  const H = fig.height;
  const R = Math.max(0.6, fig.radius);
  // Margens para golpes, armas compridas e investidas
  const halfW = Math.max(R * 1.35, H * 0.5) + 0.55;
  const top = H * Math.cos(ELEVATION) + R * Math.sin(ELEVATION) + 0.35;
  const bottom = R * Math.sin(ELEVATION) + 0.45;
  const frameW = Math.ceil(halfW * 2 * unitPx);
  const frameH = Math.ceil((top + bottom) * unitPx);
  camera.left = -halfW; camera.right = halfW; camera.top = top; camera.bottom = -bottom;
  camera.position.set(0, Math.sin(ELEVATION) * 20, Math.cos(ELEVATION) * 20);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.setSize(frameW, frameH, false);

  const perDir = BAKE_STATES.reduce((s, b) => s + b.frames, 0);
  const cols = Math.max(1, Math.min(perDir, Math.floor(4096 / frameW)));
  const rowsPerDir = Math.ceil(perDir / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * frameW;
  canvas.height = rowsPerDir * DIRS.length * frameH;
  const g = canvas.getContext('2d')!;
  // Contorno escuro suave: o boneco "descola" do chão do mapa
  g.filter = 'drop-shadow(0 0 1px rgba(8,6,16,0.95)) drop-shadow(0 0 0.5px rgba(8,6,16,0.9))';

  const prevParent = fig.root.parent;
  const prevYaw = fig.root.rotation.y;
  scene.add(fig.root);
  const frames = {} as FigureAtlas['frames'];
  for (let di = 0; di < DIRS.length; di++) {
    const d = DIRS[di];
    frames[d.dir] = {} as Record<BakeState, { x: number; y: number }[]>;
    fig.root.rotation.y = d.yaw;
    let idx = 0;
    for (const b of BAKE_STATES) {
      const list: { x: number; y: number }[] = [];
      for (let i = 0; i < b.frames; i++) {
        const t01 = b.loop ? i / b.frames : b.frames === 1 ? 1 : i / (b.frames - 1);
        fig.sample(b.state, t01);
        fig.root.updateMatrixWorld(true);
        renderer.render(scene, camera);
        const x = (idx % cols) * frameW;
        const y = (di * rowsPerDir + Math.floor(idx / cols)) * frameH;
        g.drawImage(renderer.domElement, x, y);
        list.push({ x, y });
        idx++;
      }
      frames[d.dir][b.state] = list;
      // Devolve a vez para a página entre um estado e outro (sem travar o celular)
      scene.remove(fig.root);
      await yieldFn();
      renderer.setSize(frameW, frameH, false);
      camera.left = -halfW; camera.right = halfW; camera.top = top; camera.bottom = -bottom;
      camera.updateProjectionMatrix();
      scene.add(fig.root);
      fig.root.rotation.y = d.yaw;
    }
  }
  scene.remove(fig.root);
  if (prevParent) prevParent.add(fig.root);
  fig.root.rotation.y = prevYaw;
  return { canvas, frameW, frameH, anchorY: Math.round(top * unitPx), unitPx, frames };
}

// ───────────── Cache e fila (uma figura por vez, sem travar a tela) ─────────────

const atlases = new Map<string, Promise<FigureAtlas | null>>();
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Libera o contexto WebGL do "estúdio" quando não há nada para assar (celulares têm poucos). */
function scheduleRelease() {
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    if (pending > 0 || !shared) return;
    shared.renderer.dispose();
    shared.renderer.forceContextLoss();
    shared = null;
  }, 1500);
}
const idle = () => new Promise<void>((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 300 }) : setTimeout(r, 16)));

export function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Folha de sprites de uma figura (montada uma vez por chave e reaproveitada). */
export function getFigureAtlas(key: string, make: () => Promise<Figure>, unitPx = 34): Promise<FigureAtlas | null> {
  let p = atlases.get(key);
  if (!p) {
    pending++;
    p = (queue = queue.then(async () => {
      await idle();
      try {
        const fig = await make();
        const atlas = await bakeFigure(fig, unitPx, idle);
        fig.dispose();
        return atlas;
      } catch (e) {
        console.warn('Não consegui montar o boneco', key, e);
        return null;
      } finally {
        pending--;
        scheduleRelease();
      }
    })) as Promise<FigureAtlas | null>;
    atlases.set(key, p);
    if (atlases.size > 60) atlases.delete(atlases.keys().next().value!);
  }
  return p;
}
