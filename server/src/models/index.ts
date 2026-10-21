import { Campaign, CampaignMember } from './Campaign';
import { Character, CharacterSheet, InventoryItem } from './Character';
import { GameEvent, GameMap, SaveGame } from './Game';
import { Item } from './Item';
import { User } from './User';

// ───────────── Associações ─────────────
User.hasMany(Character, { foreignKey: 'userId', as: 'characters' });
Character.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

Character.hasOne(CharacterSheet, { foreignKey: 'characterId', as: 'sheet' });
CharacterSheet.belongsTo(Character, { foreignKey: 'characterId' });

Character.hasMany(InventoryItem, { foreignKey: 'characterId', as: 'inventory' });
InventoryItem.belongsTo(Character, { foreignKey: 'characterId' });

User.hasMany(Campaign, { foreignKey: 'masterId', as: 'campaigns' });
Campaign.belongsTo(User, { foreignKey: 'masterId', as: 'master' });

Campaign.hasMany(CampaignMember, { foreignKey: 'campaignId', as: 'members' });
CampaignMember.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
CampaignMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export { Campaign, CampaignMember, Character, CharacterSheet, GameEvent, GameMap, InventoryItem, Item, SaveGame, User };
