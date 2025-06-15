

import { CardData, Character } from './types';

export const PLAYER_ID = 'player1'; // Assuming single player for now
export const MAX_LOG_ENTRIES = 25; // Display limit for Town Crier
export const MAX_INTERNAL_LOG_ENTRIES = 500; // New constant for internal log limit for AI story generation
export const HAND_LIMIT = 6;
export const EQUIP_LIMIT = 3;
export const STORE_DISPLAY_LIMIT = 3;
export const EVENT_DECK_SIZE = 20; // Target size for the event deck
export const PLAYER_DECK_TARGET_SIZE = 13; // Target size for player deck (4 starter + 9 augmentation)
export const STORE_DECK_TARGET_SIZE = 20;


export const INITIAL_PLAYER_STATE_TEMPLATE = {
    name: null,
    character: null,
    health: 0,
    gold: 10,
    hand: [], // Will be initialized as (CardData | null)[] in useGameState
    equippedItems: [],
    activeTrap: null,
    isCampfireActive: false,
    maxHealth: 0,
    handSize: HAND_LIMIT,
    equipSlots: EQUIP_LIMIT,
    playerDeck: [],
    playerDiscard: [],
    hasEquippedThisTurn: false,
    satchel: [],
    turnEnded: false,
    hasTakenActionThisTurn: false,
    hasRestockedThisTurn: false,
    isUnsortedDraw: false,
    ngPlusLevel: 0, 
    activeEventForAttack: null,
    hatDamageNegationAvailable: false, 
};

export const CHARACTERS_DATA_MAP: { [id: string]: Character } = {
    hunter: { 
        id: 'hunter', name: 'Hunter', health: 20, gold: 20,
        ability: 'A master of the wild, their aim is as true as the northern star.', 
        starterDeck: ['item_bow_t1', 'upgrade_bearskin_coat', 'provision_steak', 'upgrade_lucky_arrowhead'], 
        storyDesc: "Clad in a patchwork of deer hides and worn leather, their clothes are a testament to a life lived on the fringes. A hawk feather is tucked into the band of their faded hat, and their eyes miss nothing."
    },
    trapper: { 
        id: 'trapper', name: 'Trapper', health: 18, gold: 25,
        ability: 'Knows every trail and snare; a survivor who lives off the land.', 
        starterDeck: ['item_knife_t1', 'upgrade_bearskin_coat', 'provision_dried_meat', 'upgrade_worn_whetstone'], 
        storyDesc: "They smell of pine, smoke, and something animal. Their buckskin clothes are stained from their trade, and their hands are thick and calloused, constantly fidgeting with the handle of a well-used skinning knife."
    },
    gunslinger: { 
        id: 'gunslinger', name: 'Gunslinger', health: 24, gold: 20,
        ability: 'Their reputation is written in smoke, their legend told in thunder.', 
        starterDeck: ['item_six_shooter_t1', 'upgrade_bandolier_t1', 'provision_laudanum_t1', 'upgrade_lucky_bullet'], 
        storyDesc: "A long, dark duster coat hangs on their frame, its hem caked with the dust of a dozen towns. Their gaze is steady, and their hand hovers instinctively near the worn leather grip of their holstered pistol."
    },
    doctor: { 
        id: 'doctor', name: 'Doctor', health: 18, gold: 25,
        ability: 'A steady hand that can mend flesh or end a life with grim precision.', 
        starterDeck: ['item_knife_t1', 'upgrade_duster_coat_t1', 'provision_miracle_cure_t1', 'upgrade_medical_journal'],
        storyDesc: "Even in the wild, they maintain an air of professionalism, with a clean (if wrinkled) shirt and spectacles perched on their nose. Their leather bag smells sharply of carbolic acid and strange poultices."
    },
    herbalist: { 
        id: 'herbalist', name: 'Herbalist', health: 18, gold: 20,
        ability: 'Finds life and remedy where others only see weeds and dirt.', 
        starterDeck: ['item_knife_t1', 'upgrade_leather_satchel_t1', 'provision_juniper_t1', 'upgrade_herb_pouch'],
        storyDesc: "Their clothes are practical homespun linen, often stained with berry juice and dirt. Twigs and dried flowers are woven into their hair, and their soft deerskin pouch is always close at hand."
    },
    explorer: { 
        id: 'explorer', name: 'Explorer', health: 18, gold: 28,
        ability: 'Driven by wanderlust and the promise of what lies over the next hill.', 
        starterDeck: ['item_six_shooter_t1', 'upgrade_sturdy_boots_t1', 'provision_water_t1', 'upgrade_treasure_map'],
        storyDesc: "Their sun-faded canvas shirt is worn thin, and their boots are caked with mud from countless miles. Their eyes, always scanning the horizon, hold the glint of endless optimism and far-off lands."
    },
    preacher: {
        id: 'preacher', name: 'Preacher', health: 22, gold: 25,
        ability: 'Wields scripture and judgment with equal, unwavering conviction.',
        starterDeck: ['item_knife_t1', 'upgrade_iron_will', 'provision_laudanum_t1', 'upgrade_tattered_bible'],
        storyDesc: "A gaunt figure in a dusty, threadbare black coat. Their face is all sharp angles and hollow cheeks, and their eyes burn with a feverish intensity as they clutch a worn, leather-bound book to their chest."
    },
    prospector: {
        id: 'prospector', name: 'Prospector', health: 16, gold: 30,
        ability: 'Haunted by the glimmer of gold and the ghosts of the mountains.',
        starterDeck: ['item_sawed_off_t1', 'upgrade_leather_satchel_t1', 'provision_water_t1', 'item_gold_pan'],
        storyDesc: "Their clothes are more patch than fabric, and their wild, grey beard is stained with tobacco. There's a constant film of grime under their fingernails, and their sunken eyes glitter with a desperate hope."
    }
};
export const CHARACTERS_LIST: Character[] = Object.values(CHARACTERS_DATA_MAP);

export const ALL_CARDS_DATA_MAP: { [id: string]: CardData } = {
    // Animal Threats
    'threat_skunk_t1': { id: 'threat_skunk_t1', name: 'Skunk', type: 'Event', subType: 'animal', health: 2, goldValue: 2, effect: {type: 'damage', amount: 2 }, description: "A striped critter, best avoided. Attacks end of day if active." }, 
    
    'threat_raccoon_t1': { id: 'threat_raccoon_t1', name: 'Raccoon', type: 'Event', subType: 'animal', health: 3, goldValue: 4, effect: {type: 'damage', amount: 1}, description: "A masked bandit of the night, surprisingly fierce." }, 
    
    'threat_beaver_t1': { id: 'threat_beaver_t1', name: 'Beaver', type: 'Event', subType: 'animal', health: 4, goldValue: 4, effect: {type: 'damage', amount: 4}, description: "A large beaver, fiercely territorial and quick to defend its lodge with powerful bites." }, 

    'threat_coyote_t1': { id: 'threat_coyote_t1', name: 'Coyote', type: 'Event', subType: 'animal', health: 6, goldValue: 6, effect: {type: 'damage', amount: 2}, description: "A cunning pack hunter, wary and quick." }, 
    
    'threat_fox_t1': { id: 'threat_fox_t1', name: 'Fox', type: 'Event', subType: 'animal', health: 5, goldValue: 4, effect: {type: 'damage', amount: 2}, description: "A sly fox, more interested in outsmarting you." }, 

    'threat_wolf_t1': { id: 'threat_wolf_t1', name: 'Wolf', type: 'Event', subType: 'animal', health: 6, goldValue: 6, effect: {type:'damage', amount: 3}, description: "A lone wolf, its eyes gleaming with hunger." }, 
    'threat_wolf_t2': { id: 'threat_wolf_t2', name: 'Wolf (Alpha)', type: 'Event', subType: 'animal', health: 8, goldValue: 8, effect: {type:'damage', amount: 4}, description: "A larger, more menacing wolf, leader of a small pack." }, 
    'threat_wolf_t3': { id: 'threat_wolf_t3', name: 'Dire Wolf', type: 'Event', subType: 'animal', health: 10, goldValue: 10, effect: {type:'damage', amount: 3}, description: "An alpha wolf, strong and cunning, a true test." }, 

    'threat_boar_t1': { id: 'threat_boar_t1', name: 'Boar', type: 'Event', subType: 'animal', health: 10, goldValue: 10, effect: {type:'damage', amount: 4}, description: "A wild boar with sharp tusks and a mean temper." }, 
    'threat_boar_t2': { id: 'threat_boar_t2', name: 'Enraged Boar', type: 'Event', subType: 'animal', health: 10, goldValue: 10, effect: {type:'damage', amount: 6}, description: "A particularly enraged boar charges with fury!" }, 
    
    'threat_deer_t1': { id: 'threat_deer_t1', name: 'Deer', type: 'Event', subType: 'animal', health: 6, goldValue: 6, effect: {type:'damage', amount: 2}, description: "A graceful deer, but can be dangerous if cornered." }, 

    'threat_buck_t1': { id: 'threat_buck_t1', name: 'Buck', type: 'Event', subType: 'animal', health: 8, goldValue: 8, effect: {type:'damage', amount: 4}, description: "A powerful buck with an impressive rack of antlers." }, 
    'threat_buck_t2': { id: 'threat_buck_t2', name: 'Territorial Buck', type: 'Event', subType: 'animal', health: 8, goldValue: 8, effect: {type:'damage', amount: 5}, description: "This buck is particularly territorial and aggressive." }, 

    'threat_moose_t1': { id: 'threat_moose_t1', name: 'Moose', type: 'Event', subType: 'animal', health: 12, goldValue: 10, effect: {type:'damage', amount: 5}, description: "A towering moose, king of the northern forests." }, 
    
    'threat_elk_t1': { id: 'threat_elk_t1', name: 'Elk', type: 'Event', subType: 'animal', health: 12, goldValue: 10, effect: {type:'damage', amount: 5}, description: "A majestic elk, its bugle echoing through the valley." }, 
    
    'threat_cougar_t1': { id: 'threat_cougar_t1', name: 'Cougar', type: 'Event', subType: 'animal', health: 10, goldValue: 15, effect: {type:'damage', amount: 8}, description: "A silent predator of the mountains, swift and deadly." }, 
    'threat_cougar_t2': { id: 'threat_cougar_t2', name: 'Hungry Cougar', type: 'Event', subType: 'animal', health: 12, goldValue: 15, effect: {type:'damage', amount: 10}, description: "A larger, hungrier cougar stalks its prey." }, 

    'threat_black_bear_t1': { id: 'threat_black_bear_t1', name: 'Black Bear', type: 'Event', subType: 'animal', health: 15, goldValue: 20, effect: {type:'damage', amount: 12}, description: "A formidable black bear, a true test of survival." }, 
    'threat_black_bear_t2': { id: 'threat_black_bear_t2', name: 'Wary Black Bear', type: 'Event', subType: 'animal', health: 16, goldValue: 20, effect: {type:'damage', amount: 10}, description: "A wary, but powerful black bear, cautious yet strong." }, 

    'threat_wolf_pack_t1': { id: 'threat_wolf_pack_t1', name: 'Wolf Pack', type: 'Event', subType: 'animal', health: 18, goldValue: 25, effect: {type:'damage', amount: 15}, description: "A coordinated pack of hungry wolves, a deadly encounter." }, 
    'threat_wolf_pack_t2': { id: 'threat_wolf_pack_t2', name: 'Large Wolf Pack', type: 'Event', subType: 'animal', health: 20, goldValue: 25, effect: {type:'damage', amount: 16}, description: "A larger, more ferocious wolf pack surrounds you." }, 

    'threat_grizzly_bear_t1': { id: 'threat_grizzly_bear_t1', name: 'Grizzly Bear', type: 'Event', subType: 'animal', health: 25, goldValue: 30, effect: {type:'damage', amount: 18}, description: "An enormous grizzly, titan of the wild, a true boss." }, 

    'threat_muskrat_t1': { id: 'threat_muskrat_t1', name: 'Muskrat', type: 'Event', subType: 'animal', health: 2, goldValue: 2, effect: {type:'damage', amount: 1}, description: "A small, semi-aquatic rodent, surprisingly nippy." }, 
    
    'threat_opossum_t1': { id: 'threat_opossum_t1', name: 'Opossum', type: 'Event', subType: 'animal', health: 2, goldValue: 2, effect: {type:'damage', amount: 1}, description: "This nocturnal marsupial might play dead... or bite." }, 

    'threat_rabbit_t1': { id: 'threat_rabbit_t1', name: 'Rabbit', type: 'Event', subType: 'animal', health: 2, goldValue: 2, effect: {type:'damage', amount: 0}, description: "A swift rabbit, quick to bolt from danger." }, 
    'threat_rabbit_t3': { id: 'threat_rabbit_t3', name: 'Plump Rabbit', type: 'Event', subType: 'animal', health: 3, goldValue: 2, effect: {type:'damage', amount: 0}, description: "A plump rabbit, surprisingly quick for its size." }, 

    'threat_squirrel_t1': { id: 'threat_squirrel_t1', name: 'Squirrel', type: 'Event', subType: 'animal', health: 1, goldValue: 1, effect: {type:'damage', amount: 0}, description: "A chattering squirrel, more a noisy distraction than a threat." }, 
    
    // Human Threats
    'threat_thief_t1': { 
        id: 'threat_thief_t1', name: 'Thief', type: 'Event', subType: 'human', health: 6, goldValue: 10, 
        effect: {type: 'damage', amount: 3}, 
        immediateEffect: {type: 'random_gold_steal', maxAmount: 5}, 
        description: "A shadowy figure with nimble fingers. Steals on sight, attacks end of day if lingers." 
    }, 
    'threat_thief_t2': { 
        id: 'threat_thief_t2', name: 'Experienced Thief', type: 'Event', subType: 'human', health: 8, goldValue: 12, 
        effect: {type: 'damage', amount: 4},
        immediateEffect: {type: 'random_gold_steal', maxAmount: 6},
        description: "A more experienced cutpurse, bold and dangerous. Steals more, hits harder at end of day." 
    }, 
    'threat_thief_t3': { 
        id: 'threat_thief_t3', name: 'Desperate Thief', type: 'Event', subType: 'human', health: 5, goldValue: 8, 
        effect: {type: 'damage', amount: 2},
        immediateEffect: {type: 'random_gold_steal', maxAmount: 4},
        description: "A reckless thief, not much of a fighter but will try to snatch your coin and attack at end of day." 
    }, 

    'threat_outlaw_t1': { id: 'threat_outlaw_t1', name: 'Outlaw', type: 'Event', subType: 'human', health: 8, goldValue: 16, effect: {type:'damage', amount: 8}, description: "A hardened desperado, quick on the draw." }, 
    'threat_outlaw_t2': { id: 'threat_outlaw_t2', name: 'Notorious Outlaw', type: 'Event', subType: 'human', health: 10, goldValue: 18, effect: {type:'damage', amount: 7}, description: "A notorious outlaw, wanted dead or alive, tough as nails." }, 
    'threat_outlaw_t3': { id: 'threat_outlaw_t3', name: 'Trigger-Happy Outlaw', type: 'Event', subType: 'human', health: 9, goldValue: 15, effect: {type:'damage', amount: 9}, description: "A trigger-happy outlaw, shoots first and asks later." }, 

    'threat_bandit_t1': { id: 'threat_bandit_t1', name: 'Bandit', type: 'Event', subType: 'human', health: 10, goldValue: 20, effect: {type:'damage', amount: 8}, description: "A ruthless road agent, preying on travelers." }, 
    'threat_bandit_t2': { id: 'threat_bandit_t2', name: 'Bandit Leader', type: 'Event', subType: 'human', health: 12, goldValue: 22, effect: {type:'damage', amount: 9}, description: "A well-armed bandit, leading a small gang." }, 

    'threat_bandit_camp_t1': { id: 'threat_bandit_camp_t1', name: 'Bandit Camp', type: 'Event', subType: 'human', health: 15, goldValue: 30, effect: {type: 'damage', amount: 10}, description: "A rough encampment of outlaws, heavily guarded." }, 
    
    'threat_vagabond_t1': {
        id: 'threat_vagabond_t1', name: 'Vagabond', type: 'Event', subType: 'human', health: 5, goldValue: 5, 
        effect: {type: 'damage', amount: 2}, 
        immediateEffect: {type: 'random_gold_steal', maxAmount: 3}, 
        description: "A wandering drifter, desperate. Might snatch coins, might attack end of day."
    }, 
    'threat_vagabond_t2': {
        id: 'threat_vagabond_t2', name: 'Aggressive Vagabond', type: 'Event', subType: 'human', health: 7, goldValue: 8, 
        effect: {type: 'damage', amount: 3},
        immediateEffect: {type: 'random_gold_steal', maxAmount: 4},
        description: "An aggressive vagrant, looking for trouble or coin. More likely to get both at end of day."
    }, 

    // Illnesses & Environmental Threats - These DO have turn_end: true
    'threat_malaria': { id: 'threat_malaria', name: 'Malaria', type: 'Event', subType: 'illness', effect: {type: 'damage', amount: 2, turn_end: true}, description: "A mosquito's bite brings raging fever and chills. Turn ends." }, 
    'threat_snake_bite': { id: 'threat_snake_bite', name: 'Snake Bite', type: 'Event', subType: 'illness', effect: {type: 'poison', damage: 2, turn_end: true}, description: "A venomous serpent strikes with fangs of fire! Turn ends." }, 
    'threat_lightning_strike': { id: 'threat_lightning_strike', name: 'Lightning Strike', type: 'Event', subType: 'environmental', effect: {type: 'damage_percent', amount: 0.5, turn_end: true}, description: "The sky splits with a deafening crack, electricity fills the air. Turn ends." }, 
    'threat_rockslide': { id: 'threat_rockslide', name: 'Rockslide', type: 'Event', subType: 'environmental', effect: {type: 'damage', amount: 2, turn_end: true, discard_equipped: true}, description: "The mountain groans, unleashing a cascade of stone. Discard equipped. Turn ends." }, 
    'threat_dysentery': { id: 'threat_dysentery', name: 'Dysentery', type: 'Event', subType: 'illness', effect: {type: 'poison', damage: 2, turn_end: true}, description: "Tainted water brings debilitating sickness and weakness. Turn ends." }, 
    'threat_scarlet_fever': { id: 'threat_scarlet_fever', name: 'Scarlet Fever', type: 'Event', subType: 'illness', effect: {type: 'damage', amount: 3, turn_end: true}, description: "A dreaded sickness marked by crimson rash and high fever. Turn ends." }, 

    // Items
    'item_sawed_off_t1': { id: 'item_sawed_off_t1', name: 'Sawed Off', type: 'Item', sellValue: 20, buyCost: 40, effect: {type: 'weapon', attack: 5}, description: "Scattergun cut short for close-quarters mayhem." }, 
    
    'item_rifle_t1': { id: 'item_rifle_t1', name: 'Rifle', type: 'Item', sellValue: 25, buyCost: 50, effect: {type: 'weapon', attack: 3}, description: "A trusty long gun for taking game or targets." }, 
    
    'item_six_shooter_t1': { id: 'item_six_shooter_t1', name: 'Six Shooter', type: 'Item', sellValue: 15, buyCost: 30, effect: {type: 'weapon', attack: 2}, description: "The iconic revolver of the Wild West." }, 
    
    'item_bow_t1': { id: 'item_bow_t1', name: 'Bow', type: 'Item', sellValue: 10, buyCost: 20, effect: {type: 'weapon', attack: 2}, description: "A silent hunter's tool, arrows fly true." }, 
    
    'item_knife_t1': { id: 'item_knife_t1', name: 'Knife', type: 'Item', sellValue: 5, buyCost: 10, effect: {type: 'weapon', attack: 1}, description: "A versatile blade for utility or defense." }, 
    
    'item_small_trap_t1': { id: 'item_small_trap_t1', name: 'Small Trap', type: 'Item', sellValue: 5, buyCost: 10, effect: {type:'trap', size:'small'}, description: "A simple snare for catching small critters. Defeats animals up to 4 health." }, 
    
    'item_medium_trap_t1': { id: 'item_medium_trap_t1', name: 'Medium Trap', type: 'Item', sellValue: 8, buyCost: 16, effect: {type:'trap', size:'medium', breakDamage: 2}, description: "A sturdier trap for slightly larger game. Defeats animals up to 6 health. Damages larger creatures if broken." }, 
    
    'item_large_trap_t1': { id: 'item_large_trap_t1', name: 'Large Trap', type: 'Item', sellValue: 12, buyCost: 24, effect: {type:'trap', size:'large', breakDamage: 3}, description: "A heavy-duty trap for formidable creatures. Defeats animals up to 8 health. Damages larger creatures if broken." }, 

    'item_gold_nugget_t1': { id: 'item_gold_nugget_t1', name: 'Gold Nugget', type: 'Item', sellValue: 20, description: "A gleaming chunk of pure gold, a rare find." }, 
    'item_gold_nugget_t2': { id: 'item_gold_nugget_t2', name: 'Large Gold Nugget', type: 'Item', sellValue: 25, description: "A larger, exceptionally valuable nugget of gold." }, 
    'item_gold_nugget_t3': { id: 'item_gold_nugget_t3', name: 'Gold Dust', type: 'Item', sellValue: 10, description: "A pouch of fine gold dust, panned from a stream." }, 

    'item_jewelry_t1': { id: 'item_jewelry_t1', name: 'Tarnished Locket', type: 'Item', sellValue: 10, description: "A tarnished piece of finery, perhaps a locket." }, 
    'item_jewelry_t2': { id: 'item_jewelry_t2', name: 'Ornate Silver Ring', type: 'Item', sellValue: 15, description: "A rather ornate silver ring with a small stone." }, 
    'item_jewelry_t3': { id: 'item_jewelry_t3', name: 'Simple Gold Band', type: 'Item', sellValue: 12, description: "A simple gold band, worn smooth with time." }, 

    'item_wood_t1': { id: 'item_wood_t1', name: 'Firewood', type: 'Item', sellValue: 1, buyCost: 2, effect: {type:'campfire'}, description: "Dry wood for a warm fire. Prevents new events and animal attacks for one night." }, 
    
    // Player Upgrades
    'upgrade_boar_skin_coat_t1': { id: 'upgrade_boar_skin_coat_t1', name: 'Boar Skin Coat', type: 'Player Upgrade', sellValue: 20, buyCost: 40, effect: { type: 'upgrade', subtype: 'max_health', amount: 4, persistent: true }, description: "A rugged coat of boar hide, surprisingly sturdy." }, 
    'upgrade_wolf_fur_coat_t1': { id: 'upgrade_wolf_fur_coat_t1', name: 'Wolf Fur Coat', type: 'Player Upgrade', sellValue: 28, buyCost: 55, effect: { type: 'upgrade', subtype: 'max_health', amount: 6, persistent: true }, description: "Coat of wolf pelts, warm and intimidating." }, 
    'upgrade_moose_hide_coat_t1': { id: 'upgrade_moose_hide_coat_t1', name: 'Moose Hide Coat', type: 'Player Upgrade', sellValue: 35, buyCost: 70, effect: { type: 'upgrade', subtype: 'max_health', amount: 8, persistent: true }, description: "Thick moose hide forms a formidable bulwark." }, 
    'upgrade_elk_skin_coat_t1': { id: 'upgrade_elk_skin_coat_t1', name: 'Elk Skin Coat', type: 'Player Upgrade', sellValue: 32, buyCost: 65, effect: { type: 'upgrade', subtype: 'max_health', amount: 7, persistent: true }, description: "Supple elk skin coat, strong yet flexible." }, 
    'upgrade_deer_skin_coat_t1': { id: 'upgrade_deer_skin_coat_t1', name: 'Deer Skin Coat', type: 'Player Upgrade', sellValue: 18, buyCost: 35, effect: { type: 'upgrade', subtype: 'max_health', amount: 3, persistent: true }, description: "A light coat of deerskin, offering some defense." }, 
    'upgrade_bearskin_coat': { id: 'upgrade_bearskin_coat', name: 'Bearskin Coat', type: 'Player Upgrade', sellValue: 30, buyCost: 60, effect: {type:'upgrade', subtype:'max_health', amount: 7, persistent: true}, description: "Heavy coat from a great bear, very protective." }, 

    'upgrade_beaver_fur_hat_t1': { id: 'upgrade_beaver_fur_hat_t1', name: 'Beaver Fur Hat', type: 'Player Upgrade', sellValue: 10, buyCost: 20, effect: {type:'upgrade', subtype:'damage_negation', max_health: 2, persistent: true}, description: "Warm, water-resistant beaver hat, might save your scalp." }, 
    'upgrade_racoon_skin_hat_t1': { id: 'upgrade_racoon_skin_hat_t1', name: 'Racoon Skin Hat', type: 'Player Upgrade', sellValue: 12, buyCost: 24, effect: {type:'upgrade', subtype:'damage_negation', max_health: 2, persistent: true}, description: "Classic frontiersman's cap, surprisingly lucky." }, 
    'upgrade_fox_fur_hat_t1': { id: 'upgrade_fox_fur_hat_t1', name: 'Fox Fur Hat', type: 'Player Upgrade', sellValue: 15, buyCost: 30, effect: {type:'upgrade', subtype:'damage_negation', max_health: 3, persistent: true}, description: "Handsome hat of fox fur, turns aside a blow." }, 

    'upgrade_leather_gloves_t1': { id: 'upgrade_leather_gloves_t1', name: 'Leather Gloves', type: 'Player Upgrade', sellValue: 8, buyCost: 16, effect: { type: 'upgrade', subtype: 'max_health', amount: 1, persistent: true }, description: "Sturdy gloves for a sure grip and calloused hands." }, 
    
    'upgrade_worn_out_boots_t1': { id: 'upgrade_worn_out_boots_t1', name: 'Worn Out Boots', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'max_health', amount: 1, persistent: true }, description: "Boots that have seen too many miles, but still serve." }, 
    'upgrade_sturdy_boots_t1': { id: 'upgrade_sturdy_boots_t1', name: 'Sturdy Boots', type: 'Player Upgrade', sellValue: 25, buyCost: 50, effect: {type:'upgrade', subtype:'max_health', amount: 5, persistent: true}, description: "Well-made boots for the long and arduous miles ahead." }, 
    'upgrade_reinforced_boots_t1': { id: 'upgrade_reinforced_boots_t1', name: 'Reinforced Boots', type: 'Player Upgrade', sellValue: 30, buyCost: 60, effect: { type: 'upgrade', subtype: 'max_health', amount: 6, persistent: true }, description: "Tough boots, reinforced for the harshest terrain." }, 

    'upgrade_canvas_satchel_t1': { id: 'upgrade_canvas_satchel_t1', name: 'Canvas Satchel', type: 'Player Upgrade', sellValue: 10, buyCost: 20, effect: {type:'upgrade', subtype:'storage', capacity: 2, persistent: true}, description: "Simple canvas bag for carrying a few extra items." }, 
    'upgrade_leather_satchel_t1': { id: 'upgrade_leather_satchel_t1', name: 'Leather Satchel', type: 'Player Upgrade', sellValue: 15, buyCost: 30, effect: {type:'upgrade', subtype:'storage', capacity: 3, persistent: true}, description: "Sturdy leather bag for carrying more provisions." }, 
    'upgrade_reinforced_satchel_t1': { id: 'upgrade_reinforced_satchel_t1', name: 'Reinforced Satchel', type: 'Player Upgrade', sellValue: 20, buyCost: 40, effect: {type:'upgrade', subtype:'storage', capacity: 4, persistent: true}, description: "A satchel built to carry a heavy load of supplies." }, 
        
    'upgrade_bandolier_t1': { id: 'upgrade_bandolier_t1', name: 'Bandolier', type: 'Player Upgrade', sellValue: 15, buyCost: 30, effect: {type:'upgrade', subtype:'double_fire', persistent: true}, description: "Holds extra ammo, doubling the damage of firearms." }, 
    'upgrade_quiver_t1': { id: 'upgrade_quiver_t1', name: 'Quiver', type: 'Player Upgrade', sellValue: 15, buyCost: 30, effect: {type:'upgrade', subtype:'quiver_boost', persistent: true}, description: "Holds extra arrows, allowing bows to fire twice." },

    'upgrade_canvas_duster_t1': { id: 'upgrade_canvas_duster_t1', name: 'Canvas Duster', type: 'Player Upgrade', sellValue: 15, buyCost: 30, effect: {type:'upgrade', subtype:'max_health', amount: 3, persistent: true}, description: "Lighter duster for dusty trails and some protection." }, 
    'upgrade_duster_coat_t1': { id: 'upgrade_duster_coat_t1', name: 'Duster Coat', type: 'Player Upgrade', sellValue: 25, buyCost: 50, effect: {type:'upgrade', subtype:'max_health', amount: 5, persistent: true}, description: "Long coat for protection from elements and harm." }, 

    'upgrade_waterskin_canteen_t1': { id: 'upgrade_waterskin_canteen_t1', name: 'Waterskin Canteen', type: 'Player Upgrade', sellValue: 12, buyCost: 24, effect: {type:'heal', amount: 2, persistent: true}, description: "Reliable waterskin, offers +2 HP each turn if equipped." }, 

    // Persistent stat upgrades
    'upgrade_lucky_arrowhead': { id: 'upgrade_lucky_arrowhead', name: 'Lucky Arrowhead', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'bow_boost', amount: 1, persistent: true }, description: "This oddly shaped arrowhead guides your bow shots." },
    'upgrade_worn_whetstone': { id: 'upgrade_worn_whetstone', name: 'Worn Whetstone', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'knife_boost', amount: 1, persistent: true }, description: "Keeps your knife's edge razor sharp." },
    'upgrade_lucky_bullet': { id: 'upgrade_lucky_bullet', name: 'Lucky Bullet', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'firearm_boost', amount: 1, persistent: true }, description: "Improves firearm aim. Provides +1 AT to firearms if equipped, or +1 AT if in hand (bonus does not stack if present in both locations)." },
    'upgrade_medical_journal': { id: 'upgrade_medical_journal', name: 'Medical Journal', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'provision_heal_boost', amount: 1, persistent: true }, description: "Well-read notes enhancing your healing provisions." },
    'upgrade_herb_pouch': { id: 'upgrade_herb_pouch', name: 'Herb Pouch', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'herb_boost', amount: 2, persistent: true }, description: "Keeps medicinal herbs fresh and more potent." },
    'upgrade_treasure_map': { id: 'upgrade_treasure_map', name: 'Treasure Map', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'sell_boost', amount: 2, persistent: true }, description: "Hints at riches or simply sharpens your bartering skills." },
    'upgrade_tattered_bible': { id: 'upgrade_tattered_bible', name: 'Tattered Bible', type: 'Player Upgrade', sellValue: 5, buyCost: 10, effect: { type: 'upgrade', subtype: 'damage_reduction', amount: 1, persistent: true }, description: "Words of comfort offering a measure of protection." },
    'upgrade_iron_will': { id: 'upgrade_iron_will', name: 'Iron Will', type: 'Player Upgrade', sellValue: 40, buyCost: 80, effect: {type:'upgrade', subtype:'max_health', amount: 10, persistent: true}, description: "Unflinching resolve bolsters your fortitude significantly." },
    
    // Provisions
    'provision_juniper_t1': { id: 'provision_juniper_t1', name: 'Juniper Berries', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'heal', amount: 1, cures: true}, description: "Aromatic berries, purifying and mildly restorative." }, 

    'provision_basil_t1': { id: 'provision_basil_t1', name: 'Wild Basil', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'heal', amount: 1, cures: true}, description: "Fragrant leaves that fight infection and aid recovery." }, 
    
    'provision_laudanum_t1': { id: 'provision_laudanum_t1', name: 'Laudanum', type: 'Provision', sellValue: 5, buyCost: 10, effect: {type:'heal', amount: 4}, description: "Potent opium tincture for dulling severe pain." }, 
    
    'provision_stamina_tonic_t1': { id: 'provision_stamina_tonic_t1', name: 'Stamina Tonic', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'draw', amount: 2}, description: "Bitter brew quickens senses, draw 2." }, 
    
    'provision_fever_tonic_t1': { id: 'provision_fever_tonic_t1', name: 'Fever Tonic', type: 'Provision', sellValue: 2, buyCost: 4, effect: {type:'heal', amount: 2, cures: true}, description: "Old remedy to break fevers and fight sickness." }, 
    
    'provision_health_tonic_t1': { id: 'provision_health_tonic_t1', name: 'Health Tonic', type: 'Provision', sellValue: 3, buyCost: 6, effect: {type:'heal', amount: 3}, description: "Restorative draught that mends wounds and restores vitality." }, 
    
    'provision_miracle_cure_t1': { id: 'provision_miracle_cure_t1', name: 'Miracle Cure', type: 'Provision', sellValue: 10, buyCost: 20, effect: {type:'heal', amount: 6, cures: true}, description: "Potent, mysterious elixir, its contents unknown." }, 

    'provision_dried_meat': { id: 'provision_dried_meat', name: 'Dried Meat', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'heal', amount: 1}, description: "Tough, preserved meat strips, a trail staple." }, 
    'provision_hardtack': { id: 'provision_hardtack', name: 'Hardtack', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'heal', amount: 2}, description: "Hard, dry biscuit, lasts forever but tough to chew." }, 
    'provision_steak': { id: 'provision_steak', name: 'Steak', type: 'Provision', sellValue: 2, buyCost: 4, effect: {type:'heal', amount: 3}, description: "Hearty slab of fresh meat, a filling meal." }, 
    
    'provision_water_t1': { id: 'provision_water_t1', name: 'Clean Water', type: 'Provision', sellValue: 1, buyCost: 2, effect: {type:'heal', amount: 1}, description: "Clear, precious water, essential for life." }, 
    
    'provision_peppermint_t1': {id: 'provision_peppermint_t1', name: 'Peppermint', type: 'Provision', sellValue: 2, buyCost: 4, effect: {type: 'heal', amount: 2, cures: true}, description: "Refreshing mint leaves, soothes an upset stomach."}, 
    
    'provision_sage_t1': {id: 'provision_sage_t1', name: 'Wild Sage', type: 'Provision', sellValue: 2, buyCost: 4, effect: {type: 'heal', amount: 2, cures: false}, description: "Aromatic sage for cleansing or making a simple tea."}, 
    
    // Legacy/Other
    'item_fire_arrows_legacy': { id: 'item_fire_arrows_legacy', name: 'Fire Arrows', type: 'Item', sellValue: 10, buyCost: 20, effect: { type: 'fire_arrow' }, description: "Arrows tipped with burning pitch." },
    'item_gold_pan': { id: 'item_gold_pan', name: 'Gold Pan', type: 'Item', sellValue: 10, buyCost: 15, effect: { type: 'gold', amount: 1}, description: "Swirl river dirt for a chance at gold flakes." },
    'action_scout_ahead': { id: 'action_scout_ahead', name: 'Scout Ahead', type: 'Action', sellValue: 10, buyCost: 20, effect: { type: 'scout' }, description: "Take a cautious look at what lies on the trail ahead." },
    'action_trick_shot': { id: 'action_trick_shot', name: 'Trick Shot', type: 'Action', sellValue: 12, buyCost: 24, effect: { type: 'conditional_weapon', attack: 3, bonus_attack: 3, condition: 'is_firearm' }, description: "Requires any firearm to play. A daring shot that's extra deadly if you have another firearm ready." },
};

// Make a mutable copy for NG+ modifications
export let CURRENT_CARDS_DATA: { [id: string]: CardData } = JSON.parse(JSON.stringify(ALL_CARDS_DATA_MAP));

export function resetCurrentCardsData() {
    CURRENT_CARDS_DATA = JSON.parse(JSON.stringify(ALL_CARDS_DATA_MAP));
}
export function updateCurrentCardsData(newCardsData: { [id: string]: CardData }) {
    CURRENT_CARDS_DATA = newCardsData;
}