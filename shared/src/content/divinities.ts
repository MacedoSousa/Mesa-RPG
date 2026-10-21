import type { Ability } from '../rules/abilities';
import type { PassiveMechanics } from './races';

/** Elementos que podem ser aplicados no mapa (interagem com superfícies). */
export type Element = 'fogo' | 'agua' | 'raio' | 'gelo' | 'veneno' | 'oleo';

export interface DivinePower {
  key: string;
  label: string;
  description: string;
  /** Elemento lançado no mapa (ação + estamina). */
  element?: Element;
  damage?: string;
  radius?: number;
  range?: number; // em quadrados
  staminaCost: number;
}

export interface DivinityDef {
  key: string;
  label: string;
  domain: string;
  symbol: string;
  description: string;
  favoredAbility: Ability | null;
  blessing: { label: string; description: string; mechanics: PassiveMechanics };
  power: DivinePower | null;
  /** Afinidade inicial (0–100). */
  startingAffinity: number;
}

export const DIVINITIES = {
  nao_reclamado: {
    key: 'nao_reclamado', label: 'Não Reclamado', domain: 'Aguardando um sinal', symbol: '❔',
    description: 'Seu pai ou mãe divino ainda não se revelou. O Mestre pode revelar durante a campanha!',
    favoredAbility: null, startingAffinity: 0,
    blessing: { label: 'Destino Incerto', description: '+2 de Estamina: você aprendeu a se virar sozinho.', mechanics: { staminaBonus: 2 } },
    power: null,
  },
  zeus: {
    key: 'zeus', label: 'Zeus', domain: 'Céu, trovão e justiça', symbol: '⚡',
    description: 'Rei dos deuses. Seus filhos comandam relâmpagos e ventos.',
    favoredAbility: 'carisma', startingAffinity: 10,
    blessing: { label: 'Senhor dos Céus', description: 'Resistência a dano elétrico e trovão.', mechanics: { resistances: ['eletrico', 'trovao'] } },
    power: { key: 'relampago', label: 'Relâmpago', description: 'Invoca um raio: dano elétrico e eletrifica água.', element: 'raio', damage: '2d6', radius: 0, range: 12, staminaCost: 3 },
  },
  poseidon: {
    key: 'poseidon', label: 'Poseidon', domain: 'Mares, terremotos e cavalos', symbol: '🔱',
    description: 'Senhor dos oceanos. Seus filhos respiram sob a água e moldam ondas.',
    favoredAbility: 'constituicao', startingAffinity: 10,
    blessing: { label: 'Filho das Marés', description: 'Resistência a frio e +1 PV por nível.', mechanics: { resistances: ['frio'], hpBonusPerLevel: 1 } },
    power: { key: 'onda', label: 'Onda', description: 'Cria uma poça de água em área, apagando fogo.', element: 'agua', damage: '1d6', radius: 1, range: 8, staminaCost: 2 },
  },
  hades: {
    key: 'hades', label: 'Hades', domain: 'Mundo Inferior e riquezas da terra', symbol: '💀',
    description: 'Senhor dos mortos. Seus filhos caminham nas sombras.',
    favoredAbility: 'sabedoria', startingAffinity: 10,
    blessing: { label: 'Herdeiro das Sombras', description: 'Resistência a necrótico e visão no escuro de 36 m.', mechanics: { resistances: ['necrotico'], darkvision: 36 } },
    power: { key: 'fogo_estigio', label: 'Chamas do Flegetonte', description: 'Fogo do rio infernal em área.', element: 'fogo', damage: '2d4', radius: 1, range: 6, staminaCost: 3 },
  },
  atena: {
    key: 'atena', label: 'Atena', domain: 'Sabedoria, estratégia e artesanato', symbol: '🦉',
    description: 'Deusa da estratégia. Seus filhos sempre têm um plano (e um plano B).',
    favoredAbility: 'inteligencia', startingAffinity: 10,
    blessing: { label: 'Mente Estratégica', description: '+2 na iniciativa e proficiência em História e Investigação.', mechanics: { initiativeBonus: 2, skillProficiencies: ['historia', 'investigacao'] } },
    power: null,
  },
  ares: {
    key: 'ares', label: 'Ares', domain: 'Guerra e fúria', symbol: '🗡️',
    description: 'Deus da guerra. Seus filhos nasceram para o combate.',
    favoredAbility: 'forca', startingAffinity: 10,
    blessing: { label: 'Sede de Batalha', description: '+1 PV por nível e proficiência em Intimidação e Atletismo.', mechanics: { hpBonusPerLevel: 1, skillProficiencies: ['intimidacao', 'atletismo'] } },
    power: null,
  },
  apolo: {
    key: 'apolo', label: 'Apolo', domain: 'Sol, música, profecia e cura', symbol: '☀️',
    description: 'Deus do sol e das artes. Seus filhos curam, cantam e acertam qualquer alvo.',
    favoredAbility: 'carisma', startingAffinity: 10,
    blessing: { label: 'Luz Solar', description: 'Resistência a radiante e proficiência em Medicina e Atuação.', mechanics: { resistances: ['radiante'], skillProficiencies: ['medicina', 'atuacao'] } },
    power: null,
  },
  artemis: {
    key: 'artemis', label: 'Ártemis', domain: 'Caça, Lua e vida selvagem', symbol: '🌙',
    description: 'Deusa da caça. Não tem filhos, mas protege suas caçadoras juradas.',
    favoredAbility: 'destreza', startingAffinity: 15,
    blessing: { label: 'Olhar da Lua', description: '+1,5 m de deslocamento e proficiência em Percepção.', mechanics: { speedBonus: 1.5, skillProficiencies: ['percepcao'] } },
    power: { key: 'geada_lunar', label: 'Geada Lunar', description: 'Congela o chão (e a água) numa área.', element: 'gelo', damage: '1d6', radius: 1, range: 8, staminaCost: 2 },
  },
  hefesto: {
    key: 'hefesto', label: 'Hefesto', domain: 'Forja, fogo e metalurgia', symbol: '🔨',
    description: 'Ferreiro dos deuses. Seus filhos constroem máquinas e dominam o fogo.',
    favoredAbility: 'constituicao', startingAffinity: 10,
    blessing: { label: 'Mãos de Forja', description: 'Resistência a fogo e +1 na CA.', mechanics: { resistances: ['fogo'], acBonus: 1 } },
    power: { key: 'labareda', label: 'Labareda', description: 'Lança fogo que incendeia óleo, madeira e barris.', element: 'fogo', damage: '2d6', radius: 0, range: 8, staminaCost: 3 },
  },
  afrodite: {
    key: 'afrodite', label: 'Afrodite', domain: 'Amor e beleza', symbol: '🕊️',
    description: 'Deusa do amor. Seus filhos encantam com palavras e olhares.',
    favoredAbility: 'carisma', startingAffinity: 10,
    blessing: { label: 'Charme Divino', description: 'Proficiência em Persuasão e Enganação; vantagem contra Enfeitiçado.', mechanics: { skillProficiencies: ['persuasao', 'enganacao'], conditionAdvantage: ['enfeiticado'] } },
    power: null,
  },
  hermes: {
    key: 'hermes', label: 'Hermes', domain: 'Viajantes, mensageiros e ladrões', symbol: '🪽',
    description: 'O mensageiro veloz. Seus filhos são rápidos e têm dedos leves.',
    favoredAbility: 'destreza', startingAffinity: 10,
    blessing: { label: 'Sandálias Aladas', description: '+3 m de deslocamento e proficiência em Prestidigitação.', mechanics: { speedBonus: 3, skillProficiencies: ['prestidigitacao'] } },
    power: null,
  },
  dionisio: {
    key: 'dionisio', label: 'Dionísio', domain: 'Vinho, festas e loucura', symbol: '🍇',
    description: 'Deus das festas e da loucura. Seus filhos têm uma relação curiosa com videiras.',
    favoredAbility: 'constituicao', startingAffinity: 10,
    blessing: { label: 'Fígado Divino', description: 'Resistência a veneno e vantagem contra Envenenado.', mechanics: { resistances: ['veneno'], conditionAdvantage: ['envenenado'] } },
    power: { key: 'vinho_ardente', label: 'Vinho Ardente', description: 'Espalha vinho escorregadio e inflamável (óleo).', element: 'oleo', radius: 1, range: 6, staminaCost: 2 },
  },
  demeter: {
    key: 'demeter', label: 'Deméter', domain: 'Colheita e agricultura', symbol: '🌾',
    description: 'Deusa da colheita. Seus filhos fazem plantas brotarem do chão.',
    favoredAbility: 'sabedoria', startingAffinity: 10,
    blessing: { label: 'Fertilidade', description: 'Proficiência em Natureza e Sobrevivência; +2 de Estamina.', mechanics: { skillProficiencies: ['natureza', 'sobrevivencia'], staminaBonus: 2 } },
    power: null,
  },
  hecate: {
    key: 'hecate', label: 'Hécate', domain: 'Magia, encruzilhadas e névoa', symbol: '🗝️',
    description: 'Deusa da magia. Seus filhos manipulam a Névoa que engana os mortais.',
    favoredAbility: 'inteligencia', startingAffinity: 10,
    blessing: { label: 'Arcano Nato', description: 'Proficiência em Arcanismo e resistência a energia.', mechanics: { skillProficiencies: ['arcanismo'], resistances: ['energia'] } },
    power: { key: 'nevoa_toxica', label: 'Névoa Tóxica', description: 'Uma névoa venenosa cobre a área.', element: 'veneno', damage: '1d6', radius: 1, range: 8, staminaCost: 3 },
  },
  nemesis: {
    key: 'nemesis', label: 'Nêmesis', domain: 'Vingança e equilíbrio', symbol: '⚖️',
    description: 'Deusa da retribuição. Seus filhos sempre cobram as dívidas.',
    favoredAbility: 'sabedoria', startingAffinity: 10,
    blessing: { label: 'Equilíbrio', description: 'Proficiência em Intuição e +1 na iniciativa.', mechanics: { skillProficiencies: ['intuicao'], initiativeBonus: 1 } },
    power: null,
  },
  hipnos: {
    key: 'hipnos', label: 'Hipnos', domain: 'Sono', symbol: '💤',
    description: 'Deus do sono. Seus filhos são calmos… até demais.',
    favoredAbility: 'sabedoria', startingAffinity: 10,
    blessing: { label: 'Sono Profundo', description: 'Vantagem contra Enfeitiçado e Amedrontado; +2 de Estamina.', mechanics: { conditionAdvantage: ['enfeiticado', 'amedrontado'], staminaBonus: 2 } },
    power: null,
  },
  pa: {
    key: 'pa', label: 'Pã', domain: 'Natureza selvagem, pastores e música rústica', symbol: '🪈',
    description: 'O deus selvagem dos bosques, patrono dos sátiros.',
    favoredAbility: 'sabedoria', startingAffinity: 15,
    blessing: { label: 'Chamado Selvagem', description: 'Proficiência em Lidar com Animais e Sobrevivência.', mechanics: { skillProficiencies: ['lidar_animais', 'sobrevivencia'] } },
    power: null,
  },
} as const satisfies Record<string, DivinityDef>;

export type DivinityKey = keyof typeof DIVINITIES;
export const DIVINITY_KEYS = Object.keys(DIVINITIES) as DivinityKey[];

export function getDivinity(key: string): DivinityDef | undefined {
  return (DIVINITIES as Record<string, DivinityDef>)[key];
}

export const AFFINITY_MIN = 0;
export const AFFINITY_MAX = 100;

export function affinityTier(affinity: number): string {
  if (affinity >= 90) return 'Campeão do Olimpo';
  if (affinity >= 70) return 'Favorecido';
  if (affinity >= 40) return 'Reconhecido';
  if (affinity >= 15) return 'Observado';
  return 'Ignorado';
}
