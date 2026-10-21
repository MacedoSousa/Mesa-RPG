import type { Ability, Skill } from '../rules/abilities';

export type ArmorCategory = 'leve' | 'media' | 'pesada' | 'escudo';
export type WeaponCategory = 'simples' | 'marcial';

export interface ClassDef {
  key: string;
  label: string;
  description: string;
  hitDie: number;
  primaryAbilities: Ability[];
  savingThrows: Ability[];
  armorProficiencies: ArmorCategory[];
  weaponCategoryProficiencies: WeaponCategory[];
  /** Armas específicas além das categorias. */
  weaponProficiencies: string[];
  skillChoices: { count: number; from: Skill[] };
  /** Estamina base no nível 1 (soma-se o modificador de CON x2). */
  staminaBase: number;
  /** Druidas tradicionalmente recusam armaduras e escudos de metal. */
  forbidsMetalArmor?: boolean;
  /** Kit sugerido na criação. */
  startingKit: string[];
}

const ALL_SKILLS: Skill[] = [
  'acrobacia', 'arcanismo', 'atletismo', 'atuacao', 'enganacao', 'furtividade', 'historia', 'intimidacao',
  'intuicao', 'investigacao', 'lidar_animais', 'medicina', 'natureza', 'percepcao', 'persuasao',
  'prestidigitacao', 'religiao', 'sobrevivencia',
];

/** Proficiências baseadas no SRD (CC-BY-4.0). */
export const CLASSES = {
  barbaro: {
    key: 'barbaro', label: 'Bárbaro', description: 'Fúria primal e resistência sobre-humana na linha de frente.',
    hitDie: 12, primaryAbilities: ['forca'], savingThrows: ['forca', 'constituicao'],
    armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [],
    skillChoices: { count: 2, from: ['lidar_animais', 'atletismo', 'intimidacao', 'natureza', 'percepcao', 'sobrevivencia'] },
    staminaBase: 12, startingKit: ['machado_grande', 'azagaia', 'pocao_cura'],
  },
  bardo: {
    key: 'bardo', label: 'Bardo', description: 'Músico e contador de histórias cuja voz carrega magia.',
    hitDie: 8, primaryAbilities: ['carisma'], savingThrows: ['destreza', 'carisma'],
    armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['besta_de_mao', 'espada_longa', 'rapieira', 'espada_curta'],
    skillChoices: { count: 3, from: ALL_SKILLS },
    staminaBase: 8, startingKit: ['rapieira', 'couro', 'lira', 'pocao_cura'],
  },
  clerigo: {
    key: 'clerigo', label: 'Clérigo', description: 'Sacerdote que canaliza o poder direto do seu deus patrono.',
    hitDie: 8, primaryAbilities: ['sabedoria'], savingThrows: ['sabedoria', 'carisma'],
    armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: [],
    skillChoices: { count: 2, from: ['historia', 'intuicao', 'medicina', 'persuasao', 'religiao'] },
    staminaBase: 8, startingKit: ['maca', 'cota_de_escamas', 'escudo_madeira', 'ambrosia'],
  },
  druida: {
    key: 'druida', label: 'Druida', description: 'Guardião da natureza que fala com plantas, feras e rios.',
    hitDie: 8, primaryAbilities: ['sabedoria'], savingThrows: ['inteligencia', 'sabedoria'],
    armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: [],
    weaponProficiencies: ['clava', 'adaga', 'dardo', 'azagaia', 'maca', 'bordao', 'cimitarra', 'foice_curta', 'funda', 'lanca'],
    skillChoices: { count: 2, from: ['arcanismo', 'lidar_animais', 'intuicao', 'medicina', 'natureza', 'percepcao', 'religiao', 'sobrevivencia'] },
    staminaBase: 8, forbidsMetalArmor: true, startingKit: ['bordao', 'gibao_de_peles', 'escudo_madeira', 'pocao_cura'],
  },
  guerreiro: {
    key: 'guerreiro', label: 'Guerreiro', description: 'Mestre de armas e táticas, treinado para qualquer combate.',
    hitDie: 10, primaryAbilities: ['forca', 'destreza'], savingThrows: ['forca', 'constituicao'],
    armorProficiencies: ['leve', 'media', 'pesada', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [],
    skillChoices: { count: 2, from: ['acrobacia', 'lidar_animais', 'atletismo', 'historia', 'intuicao', 'intimidacao', 'percepcao', 'sobrevivencia'] },
    staminaBase: 12, startingKit: ['espada_bronze_celestial', 'cota_de_malha', 'escudo_bronze', 'pocao_cura'],
  },
  monge: {
    key: 'monge', label: 'Monge', description: 'Artista marcial que transforma disciplina em golpes velozes.',
    hitDie: 8, primaryAbilities: ['destreza', 'sabedoria'], savingThrows: ['forca', 'destreza'],
    armorProficiencies: [], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['espada_curta'],
    skillChoices: { count: 2, from: ['acrobacia', 'atletismo', 'historia', 'intuicao', 'religiao', 'furtividade'] },
    staminaBase: 12, startingKit: ['bordao', 'dardo', 'nectar'],
  },
  paladino: {
    key: 'paladino', label: 'Paladino', description: 'Campeão sagrado ligado por juramento a um ideal divino.',
    hitDie: 10, primaryAbilities: ['forca', 'carisma'], savingThrows: ['sabedoria', 'carisma'],
    armorProficiencies: ['leve', 'media', 'pesada', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [],
    skillChoices: { count: 2, from: ['atletismo', 'intuicao', 'intimidacao', 'medicina', 'persuasao', 'religiao'] },
    staminaBase: 10, startingKit: ['espada_longa', 'cota_de_malha', 'escudo_bronze', 'ambrosia'],
  },
  patrulheiro: {
    key: 'patrulheiro', label: 'Patrulheiro', description: 'Rastreador e caçador das terras selvagens.',
    hitDie: 10, primaryAbilities: ['destreza', 'sabedoria'], savingThrows: ['forca', 'destreza'],
    armorProficiencies: ['leve', 'media', 'escudo'], weaponCategoryProficiencies: ['simples', 'marcial'], weaponProficiencies: [],
    skillChoices: { count: 3, from: ['lidar_animais', 'atletismo', 'intuicao', 'investigacao', 'natureza', 'percepcao', 'furtividade', 'sobrevivencia'] },
    staminaBase: 10, startingKit: ['arco_longo', 'espada_curta', 'couro_batido', 'pocao_cura'],
  },
  ladino: {
    key: 'ladino', label: 'Ladino', description: 'Especialista em furtividade, armadilhas e golpes precisos.',
    hitDie: 8, primaryAbilities: ['destreza'], savingThrows: ['destreza', 'inteligencia'],
    armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: ['besta_de_mao', 'espada_longa', 'rapieira', 'espada_curta'],
    skillChoices: { count: 4, from: ['acrobacia', 'atletismo', 'enganacao', 'intuicao', 'intimidacao', 'investigacao', 'percepcao', 'atuacao', 'persuasao', 'prestidigitacao', 'furtividade'] },
    staminaBase: 10, startingKit: ['espada_curta', 'adaga', 'couro', 'pocao_cura'],
  },
  feiticeiro: {
    key: 'feiticeiro', label: 'Feiticeiro', description: 'Magia inata que corre no sangue — às vezes literalmente divino.',
    hitDie: 6, primaryAbilities: ['carisma'], savingThrows: ['constituicao', 'carisma'],
    armorProficiencies: [], weaponCategoryProficiencies: [], weaponProficiencies: ['adaga', 'dardo', 'funda', 'bordao', 'besta_leve'],
    skillChoices: { count: 2, from: ['arcanismo', 'enganacao', 'intuicao', 'intimidacao', 'persuasao', 'religiao'] },
    staminaBase: 6, startingKit: ['bordao', 'adaga', 'nectar'],
  },
  bruxo: {
    key: 'bruxo', label: 'Bruxo', description: 'Fez um pacto com uma entidade poderosa em troca de magia.',
    hitDie: 8, primaryAbilities: ['carisma'], savingThrows: ['sabedoria', 'carisma'],
    armorProficiencies: ['leve'], weaponCategoryProficiencies: ['simples'], weaponProficiencies: [],
    skillChoices: { count: 2, from: ['arcanismo', 'enganacao', 'historia', 'intimidacao', 'investigacao', 'natureza', 'religiao'] },
    staminaBase: 8, startingKit: ['besta_leve', 'adaga', 'couro', 'pocao_cura'],
  },
  mago: {
    key: 'mago', label: 'Mago', description: 'Estudioso que domina a magia por meio de livros e rituais.',
    hitDie: 6, primaryAbilities: ['inteligencia'], savingThrows: ['inteligencia', 'sabedoria'],
    armorProficiencies: [], weaponCategoryProficiencies: [], weaponProficiencies: ['adaga', 'dardo', 'funda', 'bordao', 'besta_leve'],
    skillChoices: { count: 2, from: ['arcanismo', 'historia', 'intuicao', 'investigacao', 'medicina', 'religiao'] },
    staminaBase: 6, startingKit: ['bordao', 'grimorio', 'nectar'],
  },
} as const satisfies Record<string, ClassDef>;

export type ClassKey = keyof typeof CLASSES;
export const CLASS_KEYS = Object.keys(CLASSES) as ClassKey[];

export function getClass(key: string): ClassDef | undefined {
  return (CLASSES as Record<string, ClassDef>)[key];
}
