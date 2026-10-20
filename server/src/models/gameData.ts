/**
 * Dados estáticos de regras do Mesa RPG.
 * Base mecânica: D&D 5e / Baldur's Gate 3. Sabor: mitologia grega (Percy Jackson).
 *
 * Os identificadores (chaves) são usados no banco; os rótulos são para exibição.
 */

// ───────────────────────────── Atributos ─────────────────────────────

export const ATTRIBUTES = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'] as const;
export type AttributeKey = (typeof ATTRIBUTES)[number];
export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 30;

/** Modificador padrão 5e: floor((valor - 10) / 2). */
export function attributeModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Bônus de proficiência por nível (5e). */
export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

// ───────────────────────────── Raças ─────────────────────────────

export const RACES = {
  humano: { label: 'Humano', speed: 9 },
  elfo: { label: 'Elfo', speed: 9 },
  meio_elfo: { label: 'Meio-Elfo', speed: 9 },
  anao: { label: 'Anão', speed: 7.5 },
  halfling: { label: 'Halfling', speed: 7.5 },
  gnomo: { label: 'Gnomo', speed: 7.5 },
  tiefling: { label: 'Tiefling', speed: 9 },
  draconato: { label: 'Draconato', speed: 9 },
  meio_orc: { label: 'Meio-Orc', speed: 9 },
  githyanki: { label: 'Githyanki', speed: 9 },
  satiro: { label: 'Sátiro', speed: 10.5 },
  ninfa: { label: 'Ninfa', speed: 9 },
} as const;
export type RaceKey = keyof typeof RACES;
export const RACE_KEYS = Object.keys(RACES) as RaceKey[];

// ───────────────────────────── Pais Olímpicos ─────────────────────────────

export const GODLY_PARENTS = {
  nao_reclamado: { label: 'Não Reclamado', domain: 'Ainda aguardando um sinal dos deuses', favoredAttribute: null },
  zeus: { label: 'Zeus', domain: 'Céu e Trovão', favoredAttribute: 'carisma' },
  poseidon: { label: 'Poseidon', domain: 'Mares e Terremotos', favoredAttribute: 'constituicao' },
  hades: { label: 'Hades', domain: 'Mundo Inferior e Riquezas', favoredAttribute: 'sabedoria' },
  atena: { label: 'Atena', domain: 'Sabedoria e Estratégia', favoredAttribute: 'inteligencia' },
  ares: { label: 'Ares', domain: 'Guerra', favoredAttribute: 'forca' },
  apolo: { label: 'Apolo', domain: 'Sol, Música e Cura', favoredAttribute: 'carisma' },
  artemis: { label: 'Ártemis', domain: 'Caça e Lua', favoredAttribute: 'destreza' },
  hefesto: { label: 'Hefesto', domain: 'Forja e Fogo', favoredAttribute: 'constituicao' },
  afrodite: { label: 'Afrodite', domain: 'Amor e Beleza', favoredAttribute: 'carisma' },
  hermes: { label: 'Hermes', domain: 'Viajantes e Ladrões', favoredAttribute: 'destreza' },
  dionisio: { label: 'Dionísio', domain: 'Vinho e Loucura', favoredAttribute: 'constituicao' },
  demeter: { label: 'Deméter', domain: 'Colheita e Natureza', favoredAttribute: 'sabedoria' },
  hecate: { label: 'Hécate', domain: 'Magia e Encruzilhadas', favoredAttribute: 'inteligencia' },
  nemesis: { label: 'Nêmesis', domain: 'Vingança e Equilíbrio', favoredAttribute: 'sabedoria' },
  hipnos: { label: 'Hipnos', domain: 'Sono', favoredAttribute: 'sabedoria' },
} as const satisfies Record<string, { label: string; domain: string; favoredAttribute: AttributeKey | null }>;
export type GodlyParentKey = keyof typeof GODLY_PARENTS;
export const GODLY_PARENT_KEYS = Object.keys(GODLY_PARENTS) as GodlyParentKey[];

/** Afinidade com o pai divino: 0 (ignorado) a 100 (favorito do Olimpo). */
export const AFFINITY_MIN = 0;
export const AFFINITY_MAX = 100;

export function affinityTier(affinity: number): string {
  if (affinity >= 90) return 'Campeão do Olimpo';
  if (affinity >= 70) return 'Favorecido';
  if (affinity >= 40) return 'Reconhecido';
  if (affinity >= 15) return 'Observado';
  return 'Ignorado';
}

// ───────────────────────────── Equipamentos ─────────────────────────────

export type WeaponCategory = 'simples' | 'marcial';
export type ArmorCategory = 'leve' | 'media' | 'pesada' | 'escudo';

export interface Weapon {
  label: string;
  category: WeaponCategory;
  damage: string;
  damageType: 'cortante' | 'perfurante' | 'concussao';
  properties: string[];
}

export interface Armor {
  label: string;
  category: ArmorCategory;
  baseAC: number;
  /** Limite do modificador de Destreza na CA (null = sem limite, 0 = não soma). */
  maxDexBonus: number | null;
  strengthRequirement?: number;
  metal: boolean;
}

export const WEAPONS = {
  // Simples
  adaga: { label: 'Adaga', category: 'simples', damage: '1d4', damageType: 'perfurante', properties: ['acuidade', 'leve', 'arremesso'] },
  clava: { label: 'Clava', category: 'simples', damage: '1d4', damageType: 'concussao', properties: ['leve'] },
  bordao: { label: 'Bordão', category: 'simples', damage: '1d6', damageType: 'concussao', properties: ['versatil'] },
  maca: { label: 'Maça', category: 'simples', damage: '1d6', damageType: 'concussao', properties: [] },
  lanca: { label: 'Lança', category: 'simples', damage: '1d6', damageType: 'perfurante', properties: ['arremesso', 'versatil'] },
  azagaia: { label: 'Azagaia', category: 'simples', damage: '1d6', damageType: 'perfurante', properties: ['arremesso'] },
  foice_curta: { label: 'Foice Curta', category: 'simples', damage: '1d4', damageType: 'cortante', properties: ['leve'] },
  dardo: { label: 'Dardo', category: 'simples', damage: '1d4', damageType: 'perfurante', properties: ['acuidade', 'arremesso'] },
  funda: { label: 'Funda', category: 'simples', damage: '1d4', damageType: 'concussao', properties: ['distancia'] },
  besta_leve: { label: 'Besta Leve', category: 'simples', damage: '1d8', damageType: 'perfurante', properties: ['distancia', 'duas_maos'] },
  arco_curto: { label: 'Arco Curto', category: 'simples', damage: '1d6', damageType: 'perfurante', properties: ['distancia', 'duas_maos'] },
  // Marciais
  espada_curta: { label: 'Espada Curta', category: 'marcial', damage: '1d6', damageType: 'perfurante', properties: ['acuidade', 'leve'] },
  espada_longa: { label: 'Espada Longa', category: 'marcial', damage: '1d8', damageType: 'cortante', properties: ['versatil'] },
  rapieira: { label: 'Rapieira', category: 'marcial', damage: '1d8', damageType: 'perfurante', properties: ['acuidade'] },
  cimitarra: { label: 'Cimitarra', category: 'marcial', damage: '1d6', damageType: 'cortante', properties: ['acuidade', 'leve'] },
  montante: { label: 'Montante', category: 'marcial', damage: '2d6', damageType: 'cortante', properties: ['pesada', 'duas_maos'] },
  machado_grande: { label: 'Machado Grande', category: 'marcial', damage: '1d12', damageType: 'cortante', properties: ['pesada', 'duas_maos'] },
  martelo_de_guerra: { label: 'Martelo de Guerra', category: 'marcial', damage: '1d8', damageType: 'concussao', properties: ['versatil'] },
  tridente: { label: 'Tridente', category: 'marcial', damage: '1d8', damageType: 'perfurante', properties: ['arremesso', 'versatil'] },
  xiphos: { label: 'Xiphos de Bronze Celestial', category: 'marcial', damage: '1d6', damageType: 'perfurante', properties: ['acuidade', 'leve', 'bronze_celestial'] },
  besta_de_mao: { label: 'Besta de Mão', category: 'marcial', damage: '1d6', damageType: 'perfurante', properties: ['distancia', 'leve'] },
  arco_longo: { label: 'Arco Longo', category: 'marcial', damage: '1d8', damageType: 'perfurante', properties: ['distancia', 'pesada', 'duas_maos'] },
} as const satisfies Record<string, Weapon>;
export type WeaponKey = keyof typeof WEAPONS;

export const ARMORS = {
  acolchoada: { label: 'Armadura Acolchoada', category: 'leve', baseAC: 11, maxDexBonus: null, metal: false },
  couro: { label: 'Armadura de Couro', category: 'leve', baseAC: 11, maxDexBonus: null, metal: false },
  couro_batido: { label: 'Couro Batido', category: 'leve', baseAC: 12, maxDexBonus: null, metal: false },
  gibao_de_peles: { label: 'Gibão de Peles', category: 'media', baseAC: 12, maxDexBonus: 2, metal: false },
  cota_de_escamas: { label: 'Cota de Escamas', category: 'media', baseAC: 14, maxDexBonus: 2, metal: true },
  peitoral: { label: 'Peitoral de Bronze Celestial', category: 'media', baseAC: 14, maxDexBonus: 2, metal: true },
  meia_armadura: { label: 'Meia-Armadura', category: 'media', baseAC: 15, maxDexBonus: 2, metal: true },
  cota_de_malha: { label: 'Cota de Malha', category: 'pesada', baseAC: 16, maxDexBonus: 0, strengthRequirement: 13, metal: true },
  armadura_de_placas: { label: 'Armadura de Placas', category: 'pesada', baseAC: 18, maxDexBonus: 0, strengthRequirement: 15, metal: true },
  escudo_madeira: { label: 'Escudo de Madeira', category: 'escudo', baseAC: 2, maxDexBonus: null, metal: false },
  escudo_bronze: { label: 'Escudo de Bronze (Aspis)', category: 'escudo', baseAC: 2, maxDexBonus: null, metal: true },
} as const satisfies Record<string, Armor>;
export type ArmorKey = keyof typeof ARMORS;

// ───────────────────────────── Classes ─────────────────────────────

export interface ClassDefinition {
  label: string;
  hitDie: number;
  armorProficiencies: ArmorCategory[];
  weaponCategoryProficiencies: WeaponCategory[];
  /** Armas específicas permitidas além das categorias. */
  weaponProficiencies: WeaponKey[];
  /** Restrições extras (ex.: Druida não usa metal). */
  forbidsMetalArmor?: boolean;
}

export const CLASSES = {
  barbaro: { label: 'Bárbaro', hitDie: 12, armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [] },
  bardo: { label: 'Bardo', hitDie: 8, armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['besta_de_mao', 'espada_longa', 'rapieira', 'espada_curta'] },
  clerigo: { label: 'Clérigo', hitDie: 8, armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: [] },
  druida: {
    label: 'Druida', hitDie: 8, armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: [],
    weaponProficiencies: ['clava', 'adaga', 'dardo', 'azagaia', 'maca', 'bordao', 'cimitarra', 'foice_curta', 'funda', 'lanca'],
    forbidsMetalArmor: true,
  },
  guerreiro: { label: 'Guerreiro', hitDie: 10, armorProficiencies: ['leve', 'media', 'pesada', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [] },
  monge: { label: 'Monge', hitDie: 8, armorProficiencies: [], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['espada_curta'] },
  paladino: { label: 'Paladino', hitDie: 10, armorProficiencies: ['leve', 'media', 'pesada', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [] },
  patrulheiro: { label: 'Patrulheiro', hitDie: 10, armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [] },
  ladino: { label: 'Ladino', hitDie: 8, armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['besta_de_mao', 'espada_longa', 'rapieira', 'espada_curta'] },
  feiticeiro: { label: 'Feiticeiro', hitDie: 6, armorProficiencies: [], weaponCategoryProficiencies: [], weaponProficiencies: ['adaga', 'dardo', 'funda', 'bordao', 'besta_leve'] },
  bruxo: { label: 'Bruxo', hitDie: 8, armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: [] },
  mago: { label: 'Mago', hitDie: 6, armorProficiencies: [], weaponCategoryProficiencies: [], weaponProficiencies: ['adaga', 'dardo', 'funda', 'bordao', 'besta_leve'] },
} as const satisfies Record<string, ClassDefinition>;
export type ClassKey = keyof typeof CLASSES;
export const CLASS_KEYS = Object.keys(CLASSES) as ClassKey[];
