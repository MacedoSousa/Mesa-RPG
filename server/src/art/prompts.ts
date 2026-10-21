import { MONSTERS } from '@mesa/shared';

/**
 * Descrições (em inglês, que os modelos de imagem entendem melhor) para gerar a arte
 * de cada monstro no ComfyUI. São descrições originais das criaturas mitológicas.
 */
export const MONSTER_PROMPTS: Record<string, string> = {
  harpia: 'a harpy, winged woman with feathered arms and sharp talons, wild storm-tossed hair, screeching, stormy sky',
  cao_infernal: 'a hellhound, enormous black mastiff made of shadow and smoke, glowing red eyes, fangs, embers',
  minotauro: 'a minotaur, huge muscular bull-headed warrior, bronze nose ring, double-headed labrys axe, stone labyrinth',
  ciclope_selvagem: 'a savage cyclops, towering one-eyed giant with a crude tree-trunk club, shaggy hair, dark cave',
  dracena: 'a dracaena, reptilian woman with twin serpent tails instead of legs, green scales, bronze armor, spear',
  empusa: 'an empousa, pale vampiric spirit woman with glowing red eyes, sharp fangs, hair made of flames, mismatched legs',
  esqueleto_spartoi: 'a spartoi skeleton warrior in ancient greek bronze hoplite armor, crested helmet, round shield, glowing eye sockets',
  quimera: 'a chimera, lion head breathing fire, goat head rising from its back, venomous serpent tail',
  hidra_jovem: 'a young hydra, five-headed green serpent dragon rising from a foggy swamp',
  gorgona: 'a gorgon, fierce woman with living venomous snakes for hair, scaled skin, golden glowing eyes',
  lestrigao: 'a laestrygonian, towering cannibal giant with tusks, holding a boulder, stormy harbor',
  telquine: 'a telkhine, sea demon with sleek seal body, dog-like face and flipper hands, glowing underwater forge',
  erinia: 'a fury, leathery bat-winged hag with burning eyes and a whip of fire, dark clouds',
  equidna: 'echidna, mother of monsters, regal half woman half giant serpent, cruel smile, cavern',
  procrustes: 'procrustes, sinister tall innkeeper giant with a heavy bronze hammer, iron bed in the background, candlelight',
  aranha_automato: 'a small bronze clockwork spider automaton with glowing gem eyes and visible gears',
  cerbero: 'cerberus, gigantic three-headed black hound guarding the gates of the underworld, ghostly green fire',
  avatar_ares: 'a menacing war god in mortal guise, leather jacket, burning eyes behind dark sunglasses, scarred face, bronze sword',
};

export const ART_STYLE =
  'fantasy tabletop RPG token portrait, ancient greek mythology, dramatic painted illustration, rich colors, centered, facing the viewer, dark vignette background, highly detailed digital painting';

export const ART_NEGATIVE =
  'text, letters, watermark, signature, logo, frame, border, blurry, lowres, jpeg artifacts, deformed, extra limbs, cropped, multiple creatures, nsfw, gore';

export function defaultPrompt(key: string): string {
  const subject = MONSTER_PROMPTS[key] ?? `${MONSTERS[key]?.label ?? key}, mythical greek monster`;
  return `${subject}, ${ART_STYLE}`;
}
