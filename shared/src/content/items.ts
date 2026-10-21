import type { Ability } from '../rules/abilities';
import type { ArmorCategory, WeaponCategory } from './classes';

export const DAMAGE_TYPES = [
  'cortante', 'perfurante', 'concussao', 'fogo', 'frio', 'eletrico', 'trovao', 'acido', 'veneno', 'necrotico', 'radiante', 'psiquico', 'energia',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export type WeaponProperty =
  | 'acuidade' | 'leve' | 'pesada' | 'duas_maos' | 'versatil' | 'arremesso' | 'distancia' | 'alcance' | 'municao';

/** Material mítico: bronze divino fere monstros com mais facilidade. */
export type Material = 'comum' | 'bronze_celestial' | 'adamante' | 'oricalco';

export interface ItemRequirements {
  minAbilities?: Partial<Record<Ability, number>>;
  /** O personagem precisa ser filho(a)/protegido(a) de uma destas divindades. */
  divinities?: string[];
  minAffinity?: number;
  races?: string[];
  forbiddenRaces?: string[];
}

interface BaseItem {
  key: string;
  name: string;
  description: string;
  weight: number;
  value: number; // dracmas
  requirements?: ItemRequirements;
  rarity?: 'comum' | 'incomum' | 'raro' | 'lendario';
}

export interface WeaponItem extends BaseItem {
  kind: 'arma';
  category: WeaponCategory;
  damage: string;
  versatileDamage?: string;
  damageType: DamageType;
  properties: WeaponProperty[];
  /** Alcance em quadrados de 1,5 m (corpo a corpo = 1, alcance = 2). */
  range: number;
  longRange?: number;
  material: Material;
  /** Dano extra contra monstros (ex.: bronze celestial). */
  bonusVsMonsters?: string;
  attackBonus?: number;
}

export interface ArmorItem extends BaseItem {
  kind: 'armadura' | 'escudo';
  category: ArmorCategory;
  baseAC: number;
  maxDexBonus: number | null;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  metal: boolean;
}

export interface ConsumableItem extends BaseItem {
  kind: 'consumivel';
  effect: { heal?: string; stamina?: string; removeConditions?: string[] };
}

export interface GearItem extends BaseItem {
  kind: 'equipamento';
}

export type ItemDef = WeaponItem | ArmorItem | ConsumableItem | GearItem;

const W = (i: Omit<WeaponItem, 'kind' | 'material' | 'weight' | 'value'> & Partial<Pick<WeaponItem, 'material' | 'weight' | 'value'>>): WeaponItem => ({
  kind: 'arma', material: 'comum', weight: 1, value: 5, ...i,
});
const A = (i: Omit<ArmorItem, 'weight' | 'value'> & Partial<Pick<ArmorItem, 'weight' | 'value'>>): ArmorItem => ({ weight: 10, value: 50, ...i });

/** Catálogo base de itens (semeado na tabela items). */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  ([
    // ───── Armas simples ─────
    W({ key: 'adaga', name: 'Adaga', description: 'Lâmina curta, fácil de esconder e arremessar.', category: 'simples', damage: '1d4', damageType: 'perfurante', properties: ['acuidade', 'leve', 'arremesso'], range: 1, longRange: 4 }),
    W({ key: 'clava', name: 'Clava', description: 'Um pedaço pesado de madeira.', category: 'simples', damage: '1d4', damageType: 'concussao', properties: ['leve'], range: 1 }),
    W({ key: 'bordao', name: 'Bordão', description: 'Cajado longo de carvalho.', category: 'simples', damage: '1d6', versatileDamage: '1d8', damageType: 'concussao', properties: ['versatil'], range: 1 }),
    W({ key: 'maca', name: 'Maça', description: 'Cabeça de metal num cabo firme.', category: 'simples', damage: '1d6', damageType: 'concussao', properties: [], range: 1 }),
    W({ key: 'lanca', name: 'Lança (Dóri)', description: 'A lança dos hoplitas gregos.', category: 'simples', damage: '1d6', versatileDamage: '1d8', damageType: 'perfurante', properties: ['arremesso', 'versatil'], range: 1, longRange: 4 }),
    W({ key: 'azagaia', name: 'Azagaia', description: 'Dardo de arremesso pesado.', category: 'simples', damage: '1d6', damageType: 'perfurante', properties: ['arremesso'], range: 1, longRange: 6 }),
    W({ key: 'foice_curta', name: 'Foice Curta', description: 'Ferramenta de colheita afiada.', category: 'simples', damage: '1d4', damageType: 'cortante', properties: ['leve'], range: 1 }),
    W({ key: 'dardo', name: 'Dardo', description: 'Projétil leve de arremesso.', category: 'simples', damage: '1d4', damageType: 'perfurante', properties: ['acuidade', 'arremesso'], range: 4 }),
    W({ key: 'funda', name: 'Funda', description: 'Tira de couro para arremessar pedras.', category: 'simples', damage: '1d4', damageType: 'concussao', properties: ['distancia', 'municao'], range: 6 }),
    W({ key: 'besta_leve', name: 'Besta Leve', description: 'Arma de disparo mecânico.', category: 'simples', damage: '1d8', damageType: 'perfurante', properties: ['distancia', 'duas_maos', 'municao'], range: 16 }),
    W({ key: 'arco_curto', name: 'Arco Curto', description: 'Arco compacto de caça.', category: 'simples', damage: '1d6', damageType: 'perfurante', properties: ['distancia', 'duas_maos', 'municao'], range: 16 }),
    // ───── Armas marciais ─────
    W({ key: 'espada_curta', name: 'Espada Curta (Xiphos)', description: 'A espada curta dos guerreiros gregos.', category: 'marcial', damage: '1d6', damageType: 'perfurante', properties: ['acuidade', 'leve'], range: 1 }),
    W({ key: 'espada_longa', name: 'Espada Longa', description: 'Lâmina reta e versátil.', category: 'marcial', damage: '1d8', versatileDamage: '1d10', damageType: 'cortante', properties: ['versatil'], range: 1 }),
    W({ key: 'rapieira', name: 'Rapieira', description: 'Lâmina fina para estocadas rápidas.', category: 'marcial', damage: '1d8', damageType: 'perfurante', properties: ['acuidade'], range: 1 }),
    W({ key: 'cimitarra', name: 'Cimitarra', description: 'Lâmina curva e leve.', category: 'marcial', damage: '1d6', damageType: 'cortante', properties: ['acuidade', 'leve'], range: 1 }),
    W({ key: 'montante', name: 'Montante', description: 'Espadão de duas mãos.', category: 'marcial', damage: '2d6', damageType: 'cortante', properties: ['pesada', 'duas_maos'], range: 1, weight: 3 }),
    W({ key: 'machado_grande', name: 'Machado Grande', description: 'Machado de guerra de duas mãos.', category: 'marcial', damage: '1d12', damageType: 'cortante', properties: ['pesada', 'duas_maos'], range: 1, weight: 3 }),
    W({ key: 'martelo_guerra', name: 'Martelo de Guerra', description: 'Martelo pesado de forja.', category: 'marcial', damage: '1d8', versatileDamage: '1d10', damageType: 'concussao', properties: ['versatil'], range: 1, weight: 2 }),
    W({ key: 'tridente', name: 'Tridente', description: 'Arma de três pontas dos senhores do mar.', category: 'marcial', damage: '1d8', versatileDamage: '1d10', damageType: 'perfurante', properties: ['arremesso', 'versatil'], range: 1, longRange: 4 }),
    W({ key: 'besta_de_mao', name: 'Besta de Mão', description: 'Besta compacta de uma mão.', category: 'marcial', damage: '1d6', damageType: 'perfurante', properties: ['distancia', 'leve', 'municao'], range: 6 }),
    W({ key: 'arco_longo', name: 'Arco Longo', description: 'Arco alto de longo alcance.', category: 'marcial', damage: '1d8', damageType: 'perfurante', properties: ['distancia', 'pesada', 'duas_maos', 'municao'], range: 30 }),
    W({ key: 'glaive', name: 'Glaive', description: 'Lâmina na ponta de uma haste longa.', category: 'marcial', damage: '1d10', damageType: 'cortante', properties: ['pesada', 'alcance', 'duas_maos'], range: 2, weight: 3 }),
    // ───── Armas míticas ─────
    W({
      key: 'espada_bronze_celestial', name: 'Espada de Bronze Celestial', rarity: 'incomum', material: 'bronze_celestial', value: 250,
      description: 'Forjada com bronze dos deuses: atravessa mortais sem feri-los, mas corta monstros com facilidade.',
      category: 'marcial', damage: '1d8', versatileDamage: '1d10', damageType: 'cortante', properties: ['versatil', 'acuidade'], range: 1,
      bonusVsMonsters: '1d4',
    }),
    W({
      key: 'arco_de_apolo', name: 'Arco de Apolo', rarity: 'raro', material: 'oricalco', value: 1200,
      description: 'Arco dourado que brilha como o sol. Só aceita mãos favorecidas por Apolo ou Ártemis.',
      category: 'marcial', damage: '1d8', damageType: 'radiante', properties: ['distancia', 'duas_maos', 'municao'], range: 30, attackBonus: 1,
      requirements: { minAbilities: { destreza: 13 }, divinities: ['apolo', 'artemis'], minAffinity: 30 },
    }),
    W({
      key: 'lanca_adamante', name: 'Lança de Adamante', rarity: 'raro', material: 'adamante', value: 900,
      description: 'O metal inquebrável dos mitos. Pesada demais para braços fracos.',
      category: 'marcial', damage: '1d10', damageType: 'perfurante', properties: ['pesada', 'alcance', 'duas_maos'], range: 2, attackBonus: 1,
      requirements: { minAbilities: { forca: 15 } },
    }),
    W({
      key: 'tridente_mares', name: 'Tridente das Marés', rarity: 'raro', material: 'oricalco', value: 1000,
      description: 'Vibra com o som das ondas. Responde apenas ao sangue de Poseidon.',
      category: 'marcial', damage: '1d8', versatileDamage: '1d10', damageType: 'perfurante', properties: ['arremesso', 'versatil'], range: 1, longRange: 4,
      bonusVsMonsters: '1d6', requirements: { divinities: ['poseidon'], minAffinity: 20 },
    }),
    W({
      key: 'martelo_forja', name: 'Martelo da Forja Divina', rarity: 'raro', material: 'bronze_celestial', value: 1000,
      description: 'Ainda quente da forja sob o vulcão. Exige força e a bênção de Hefesto.',
      category: 'marcial', damage: '1d10', damageType: 'fogo', properties: ['pesada', 'duas_maos'], range: 1,
      bonusVsMonsters: '1d4', requirements: { minAbilities: { forca: 14 }, divinities: ['hefesto'] },
    }),
    // ───── Armaduras ─────
    A({ key: 'acolchoada', name: 'Armadura Acolchoada', kind: 'armadura', description: 'Camadas de tecido grosso.', category: 'leve', baseAC: 11, maxDexBonus: null, stealthDisadvantage: true, metal: false }),
    A({ key: 'couro', name: 'Armadura de Couro', kind: 'armadura', description: 'Couro endurecido em óleo.', category: 'leve', baseAC: 11, maxDexBonus: null, metal: false }),
    A({ key: 'couro_batido', name: 'Couro Batido', kind: 'armadura', description: 'Couro reforçado com rebites.', category: 'leve', baseAC: 12, maxDexBonus: null, metal: false }),
    A({ key: 'gibao_de_peles', name: 'Gibão de Peles', kind: 'armadura', description: 'Peles grossas de feras.', category: 'media', baseAC: 12, maxDexBonus: 2, metal: false }),
    A({ key: 'cota_de_escamas', name: 'Cota de Escamas', kind: 'armadura', description: 'Escamas de metal sobrepostas.', category: 'media', baseAC: 14, maxDexBonus: 2, stealthDisadvantage: true, metal: true }),
    A({ key: 'peitoral_bronze', name: 'Peitoral de Bronze Celestial', kind: 'armadura', description: 'Couraça leve que brilha levemente na escuridão.', category: 'media', baseAC: 14, maxDexBonus: 2, metal: true, rarity: 'incomum', value: 400 }),
    A({ key: 'meia_armadura', name: 'Meia-Armadura', kind: 'armadura', description: 'Placas que cobrem o tronco.', category: 'media', baseAC: 15, maxDexBonus: 2, stealthDisadvantage: true, metal: true }),
    A({ key: 'cota_de_malha', name: 'Cota de Malha', kind: 'armadura', description: 'Anéis de metal entrelaçados.', category: 'pesada', baseAC: 16, maxDexBonus: 0, strengthRequirement: 13, stealthDisadvantage: true, metal: true, weight: 25 }),
    A({ key: 'armadura_placas', name: 'Armadura de Placas', kind: 'armadura', description: 'Placas de metal cobrindo todo o corpo.', category: 'pesada', baseAC: 18, maxDexBonus: 0, strengthRequirement: 15, stealthDisadvantage: true, metal: true, weight: 30 }),
    A({ key: 'escudo_madeira', name: 'Escudo de Madeira', kind: 'escudo', description: 'Escudo redondo de madeira.', category: 'escudo', baseAC: 2, maxDexBonus: null, metal: false, weight: 3 }),
    A({ key: 'escudo_bronze', name: 'Escudo de Bronze (Aspis)', kind: 'escudo', description: 'O escudo redondo dos hoplitas.', category: 'escudo', baseAC: 2, maxDexBonus: null, metal: true, weight: 4 }),
    // ───── Consumíveis ─────
    { key: 'pocao_cura', name: 'Poção de Cura', kind: 'consumivel', description: 'Líquido vermelho que fecha ferimentos.', weight: 0.5, value: 50, effect: { heal: '2d4+2' } },
    {
      key: 'ambrosia', name: 'Ambrosia', kind: 'consumivel', description: 'O alimento dos deuses. Cura sangue divino — e queima mortais.', weight: 0.2, value: 150, rarity: 'incomum',
      effect: { heal: '3d4+3' }, requirements: { forbiddenRaces: ['legado'] },
    },
    {
      key: 'nectar', name: 'Néctar', kind: 'consumivel', description: 'A bebida dos deuses: restaura o fôlego e afasta o medo.', weight: 0.2, value: 120, rarity: 'incomum',
      effect: { stamina: '1d6+2', removeConditions: ['amedrontado'] }, requirements: { forbiddenRaces: ['legado'] },
    },
    // ───── Equipamentos ─────
    { key: 'lira', name: 'Lira', kind: 'equipamento', description: 'Instrumento de cordas de Apolo e dos bardos.', weight: 1, value: 30 },
    { key: 'grimorio', name: 'Grimório', kind: 'equipamento', description: 'Livro de magias encadernado em couro.', weight: 1.5, value: 50 },
    { key: 'corda', name: 'Corda de Seda (15 m)', kind: 'equipamento', description: 'Leve e resistente.', weight: 1, value: 10 },
    { key: 'tocha', name: 'Tocha', kind: 'equipamento', description: 'Ilumina 6 m por 1 hora.', weight: 0.5, value: 1 },
    { key: 'dracmas', name: 'Dracmas de Ouro', kind: 'equipamento', description: 'Moeda aceita por deuses, ninfas e barqueiros.', weight: 0, value: 1 },
  ] as ItemDef[]).map((i) => [i.key, i]),
);

export function getItem(key: string, custom?: Record<string, ItemDef>): ItemDef | undefined {
  return custom?.[key] ?? ITEMS[key];
}

export function isWeapon(i: ItemDef | undefined): i is WeaponItem {
  return i?.kind === 'arma';
}
export function isArmor(i: ItemDef | undefined): i is ArmorItem {
  return i?.kind === 'armadura';
}
export function isShield(i: ItemDef | undefined): i is ArmorItem {
  return i?.kind === 'escudo';
}
