// Gera os modelos 3D leves usados no criador de personagem a partir do pacote
// KayKit Adventurers (CC0, Kay Lousberg — https://kaylousberg.com).
//
// Uso:  git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0.git /tmp/kk
//       node client-web/tools/build-models.mjs /tmp/kk/addons/kaykit_character_pack_adventures
//
// Saída (client-web/public/models):
//   anims.glb          esqueleto + só as animações que o jogo usa (compartilhadas por todos os corpos)
//   <corpo>.glb        corpo sem animações e sem armas (as armas são anexadas na mão em tempo real)
//   weapons/<arma>.glb armas e escudos avulsos
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('Informe a pasta do pacote KayKit.'); process.exit(1); }
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
mkdirSync(join(out, 'weapons'), { recursive: true });
const io = new NodeIO();
const dropAnim = (a) => { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); };

export const CLIPS = [
  'Idle', 'Unarmed_Idle', '2H_Melee_Idle', 'Walking_A', 'Running_A', 'Cheer', 'Interact', 'PickUp', 'Use_Item',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin',
  'Dualwield_Melee_Attack_Slice', '1H_Ranged_Shoot', '2H_Ranged_Shoot', 'Throw',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcasting', 'Spellcast_Long',
  'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick', 'Block', 'Blocking', 'Hit_A', 'Death_A', 'Death_A_Pose',
  'Dodge_Forward', 'Jump_Full_Short', 'Sit_Floor_Idle', 'Lie_Idle',
];

const BODIES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
const HAND_ITEMS = /Sword|Shield|Axe|Mug|Spellbook|Wand|Staff|Knife|Crossbow|Throwable/;

// 1) Animações compartilhadas.
{
  const doc = await io.read(join(src, 'Characters/gltf/Knight.glb'));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!CLIPS.includes(a.getName())) dropAnim(a);
  for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); }
  for (const s of root.listSkins()) s.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }));
  await io.write(join(out, 'anims.glb'), doc);
}

// 2) Corpos sem animação e sem armas.
for (const b of BODIES) {
  const doc = await io.read(join(src, `Characters/gltf/${b}.glb`));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) dropAnim(a);
  for (const n of root.listNodes()) if (n.getMesh() && HAND_ITEMS.test(n.getName())) n.dispose();
  await doc.transform(dedup(), prune({ keepLeaves: true }));
  await io.write(join(out, `${b.toLowerCase()}.glb`), doc);
}

// 3) Armas avulsas.
const WEAPONS = ['sword_1handed', 'sword_2handed', 'axe_1handed', 'axe_2handed', 'dagger', 'crossbow_1handed', 'crossbow_2handed',
  'staff', 'wand', 'spellbook_closed', 'spellbook_open', 'shield_round', 'shield_square', 'shield_badge', 'shield_spikes', 'quiver', 'mug_full'];
for (const w of WEAPONS) {
  const doc = await io.read(join(src, `Assets/gltf/${w}.gltf`));
  await doc.transform(dedup(), prune());
  await io.write(join(out, 'weapons', `${w}.glb`), doc);
}
console.log('Modelos gerados em', out);
