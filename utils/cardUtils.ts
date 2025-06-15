

import { CardData, CardContext, PlayerDetails } from '../types';

export function shuffleArray<T,>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function pickRandomDistinctFromPool<T>(pool: T[], count: number): { picked: T[]; remainingPool: T[] } {
  const shuffled = shuffleArray([...pool]);
  const picked = shuffled.slice(0, count);
  const remainingPool = shuffled.slice(count);
  return { picked, remainingPool };
}

export function getCardValues(card: CardData, context: CardContext, playerDetails?: PlayerDetails) {
    let damageDisplayValue: string | null = null;
    let goldDisplayValue: string | null = null;

    // Weapon Attack Power Display
    if (card.effect?.type === 'weapon' || card.effect?.type === 'conditional_weapon') {
        const effectiveAttackForDisplay = playerDetails
            ? calculateAttackPower(card, playerDetails, context, null)
            : (card.effect?.attack || 0); // card.effect is guaranteed non-null here by outer if

        if (effectiveAttackForDisplay > 0) damageDisplayValue = `${effectiveAttackForDisplay} AT`;
    }

    // Gold Value Display Logic
    if (card.type === 'Trophy' || card.type === 'Bounty Proof') {
        if (card.sellValue) goldDisplayValue = `${card.sellValue}G`;
    } else if (context === CardContext.STORE) {
        if (card.id.startsWith('item_gold_nugget') || card.id.startsWith('item_jewelry')) {
             if (card.sellValue) goldDisplayValue = `${card.sellValue}G`;
        }
    } else if (card.id.startsWith('item_gold_nugget') || card.id.startsWith('item_jewelry')) {
        if (card.sellValue) goldDisplayValue = `${card.sellValue}G`;
    } else if (card.effect?.type === 'gold' && !card.id.startsWith('item_gold_nugget') && !card.id.startsWith('item_jewelry')) {
         if (card.effect.amount) goldDisplayValue = `${card.effect.amount}G`;
    } else if (card.sellValue && card.sellValue > 0 && context === CardContext.HAND && !card.id.startsWith('item_gold_nugget') && !card.id.startsWith('item_jewelry')) {
        goldDisplayValue = `${card.sellValue}G`;
    } else if (context === CardContext.EVENT && card.type === 'Event' && card.goldValue) {
        goldDisplayValue = `${card.goldValue}G`;
    }


    // Damage Display Logic for Events
    if (context === CardContext.EVENT && card.type === 'Event') {
        if (card.effect?.type === 'damage_percent' && card.effect.amount && card.effect.amount > 0) {
            damageDisplayValue = `${Math.round(card.effect.amount * 100)}%`;
        } else if (card.effect?.type === 'damage' && (card.effect.amount || 0) > 0) {
            damageDisplayValue = `${card.effect.amount} AT`;
        } else if (card.effect?.type === 'poison' && (card.effect.damage || 0) > 0) {
            damageDisplayValue = `${card.effect.damage} AT`;
        } else if (card.effect?.type === 'conditional_damage' && (card.effect.damage || 0) > 0) {
             damageDisplayValue = `${card.effect.damage} AT`;
        } else if ((card.effect?.type === 'damage' || card.effect?.type === 'poison' || card.effect?.type === 'conditional_damage') && ((card.effect.damage || 0) === 0 && (card.effect.amount || 0) === 0)){
             damageDisplayValue = `0 AT`;
        }
    }

    return {
        damage: damageDisplayValue,
        gold: goldDisplayValue
    };
}

export function calculateAttackPower(card: CardData, playerDetails: PlayerDetails, source: CardContext, activeEvent: CardData | null): number {
    // Diagnostic Log
    console.log('[DEBUG] calculateAttackPower called. Weapon:', card.id, 'Source:', source);
    console.log('[DEBUG] Equipped Items for calc:', playerDetails.equippedItems.map(c => c.id));
    console.log('[DEBUG] Hand Items for calc:', playerDetails.hand.filter(c => c !== null).map(c => c!.id));


    if (!card.effect || (card.effect.type !== 'weapon' && card.effect.type !== 'conditional_weapon')) return 0;

    let attackPower = card.effect.attack || 0;
    const equippedUpgrades = playerDetails.equippedItems;
    const isFirearm = card.id.startsWith('item_sawed_off') || card.id.startsWith('item_rifle') || card.id.startsWith('item_six_shooter');
    const isBow = card.id.startsWith('item_bow');
    const isKnife = card.id.startsWith('item_knife');

    if (card.effect.type === 'conditional_weapon') {
        if (card.effect.condition === 'is_firearm') {
            const otherFirearmsInHandOrEquipped =
                playerDetails.hand.some(c => c && c.id !== card.id && (c.id.startsWith('item_sawed_off') || c.id.startsWith('item_rifle') || c.id.startsWith('item_six_shooter'))) ||
                playerDetails.equippedItems.some(c => c.id !== card.id && (c.id.startsWith('item_sawed_off') || c.id.startsWith('item_rifle') || c.id.startsWith('item_six_shooter')));
            if (otherFirearmsInHandOrEquipped) {
                attackPower += card.effect.bonus_attack || 0;
            }
        }
    }

    if (source === CardContext.EQUIPPED) {
        attackPower += 1;
    }

    if (playerDetails.character) {
        const characterUpgrades = equippedUpgrades.filter(item => item.effect?.type === 'upgrade' && item.effect.persistent);
        characterUpgrades.forEach(upgrade => { // upgrade.effect is guaranteed non-null here
            if (upgrade.id === 'upgrade_lucky_arrowhead' && isBow && upgrade.effect.subtype === 'bow_boost') {
                attackPower += upgrade.effect.amount || 0;
            }
            if (upgrade.id === 'upgrade_worn_whetstone' && isKnife && upgrade.effect.subtype === 'knife_boost') {
                 attackPower += upgrade.effect.amount || 0;
            }
        });
    }

    let hasLuckyBulletBonusApplied = false;
    if (isFirearm) {
        const firearmBoostUpgrade = equippedUpgrades.find(item => item.id === 'upgrade_lucky_bullet' && item.effect?.subtype === 'firearm_boost');
        if (firearmBoostUpgrade) { // firearmBoostUpgrade is CardData | undefined. If CardData, effect is present due to find condition.
            attackPower += firearmBoostUpgrade.effect?.amount || 0;
            hasLuckyBulletBonusApplied = true;
        }
        if (!hasLuckyBulletBonusApplied) {
            const firearmBoostInHand = playerDetails.hand.find(item => item && item.id === 'upgrade_lucky_bullet' && item.effect?.subtype === 'firearm_boost');
            if (firearmBoostInHand) { // firearmBoostInHand is (CardData | null) | undefined. If CardData, effect is present.
                 attackPower += firearmBoostInHand.effect?.amount || 0;
            }
        }
    }

    if (playerDetails.equippedItems.some(item => item.id.startsWith('upgrade_bandolier') && item.effect?.subtype === 'double_fire') && isFirearm) {
        attackPower *= 2;
    }
    
    if (playerDetails.equippedItems.some(item => item.id.startsWith('upgrade_quiver') && item.effect?.subtype === 'quiver_boost') && isBow) {
        attackPower *= 2;
    }

    console.log('[DEBUG] Calculated Attack Power for', card.id, ':', attackPower);
    return attackPower;
}

export function calculateHealAmount(card: CardData, playerDetails: PlayerDetails): number {
    if (!card.effect || card.effect.type !== 'heal') return 0;

    let healAmount = card.effect.amount || 0;

    // Check if the card itself is the Waterskin Canteen for its specific turn-based healing amount
    if (card.id === 'upgrade_waterskin_canteen_t1' && card.effect.persistent) {
        // The turn-based heal from waterskin is handled in endTurnLogic.
        // For direct use (if it were possible, it's not), it would use its base amount.
        // This function is for calculating healing when a provision is *played*.
        // So, we don't modify waterskin's listed amount here unless it's a provision.
    }


    const equippedUpgrades = playerDetails.equippedItems.filter(item => item.effect?.type === 'upgrade' && item.effect.persistent);

    equippedUpgrades.forEach(upgrade => { // upgrade.effect is guaranteed non-null here
        if (upgrade.effect.subtype === 'provision_heal_boost') {
            healAmount += upgrade.effect.amount || 0;
        }
        if (upgrade.effect.subtype === 'herb_boost' && (card.id.startsWith('provision_juniper') || card.id.startsWith('provision_basil') || card.id.startsWith('provision_peppermint') || card.id.startsWith('provision_sage'))) {
            healAmount += upgrade.effect.amount || 0;
        }
    });

    return healAmount;
}

export function getFormattedEffectText(card: CardData, source: CardContext, playerDetails?: PlayerDetails): string | null {
    if (!card || !card.effect) return null;

    const effect = card.effect;
    switch (effect.type) {
        case 'heal':
            if (card.id === 'upgrade_waterskin_canteen_t1' && effect.persistent) {
                 return `If equipped, heals ${effect.amount || 0} HP each turn.`;
            }
            let healAmount = effect.amount || 0;
            if (playerDetails) healAmount = calculateHealAmount(card, playerDetails);
            return `Heals ${healAmount} HP${effect.cures ? ' & Cures Illness' : ''}.`;
        case 'damage':
             if (effect.amount && effect.amount > 0) return `Deals ${effect.amount} damage.`;
             if ((effect.amount || 0) === 0) return `Deals 0 damage.`;
             return null;
        case 'weapon':
            let attack = effect.attack || 0;
            if (playerDetails) attack = calculateAttackPower(card, playerDetails, source, null);
            return `Attack Power: ${attack}.`;
        case 'conditional_weapon':
            let condAttackBase = effect.attack || 0;
            let condAttackBonus = effect.bonus_attack || 0;
            let totalCondAttack = condAttackBase;
            if (playerDetails) {
                totalCondAttack = calculateAttackPower(card, playerDetails, source, null);
                 return `Attack: ${totalCondAttack} (Base ${condAttackBase}${effect.condition === 'is_firearm' ? `, +${condAttackBonus} if another firearm ready` : ''}). Modifiers applied.`;
            }
            return `Attack: ${condAttackBase} (+${condAttackBonus} if ${effect.condition === 'is_firearm' ? 'another firearm ready' : 'condition met'}).`;
        case 'conditional_damage':
            if ((effect.damage || 0) > 0) return `Deals ${effect.damage} damage if player has ${effect.condition}.`;
            return `Deals 0 damage unless condition (player has ${effect.condition}) is met.`;
        case 'draw':
            return `Draw ${effect.amount || 2} card${(effect.amount || 2) > 1 ? 's' : ''}.`; // Default to 2 for Stamina Tonic
        case 'trap':
            let trapEffectiveness = '';
            if (effect.size === 'small') trapEffectiveness = 'up to 4 HP';
            else if (effect.size === 'medium') trapEffectiveness = 'up to 6 HP';
            else if (effect.size === 'large') trapEffectiveness = 'up to 8 HP';
            let breakDamageText = '';
            if (effect.breakDamage && effect.breakDamage > 0) {
                breakDamageText = ` Deals ${effect.breakDamage} if broken by larger target.`;
            }
            return `Sets a ${effect.size} trap. Catches animals ${trapEffectiveness}.${breakDamageText}`;
        case 'campfire':
            return `Builds a campfire. Prevents new events and animal attacks for one night.`;
        case 'gold':
            if (!card.id.startsWith('item_gold_nugget') && !card.id.startsWith('item_jewelry') && card.type !== 'Trophy' && card.type !== 'Bounty Proof') {
               return `Gain ${effect.amount} Gold.`;
            }
            return null;
        case 'scout':
            return `Reveals the next event from the deck.`;
        case 'fire_arrow':
            return `Requires a Bow. Deals 2 fire damage.`;
        case 'upgrade':
            if (effect.subtype === 'max_health') return `Increases Max HP by ${effect.amount}.`;
            if (effect.subtype === 'bow_boost') return `Bow Attacks +${effect.amount}.`;
            if (effect.subtype === 'quiver_boost') return `Bows fire twice.`;
            if (effect.subtype === 'knife_boost') return `Knife Attacks +${effect.amount}.`;
            if (effect.subtype === 'firearm_boost') return `Firearm Attacks +${effect.amount}.`;
            if (effect.subtype === 'provision_heal_boost') return `Healing Provisions +${effect.amount}.`;
            if (effect.subtype === 'herb_boost') return `Herbal Provisions +${effect.amount}.`;
            if (effect.subtype === 'sell_boost') return `Sell Value of items by ${effect.amount}G.`;
            if (effect.subtype === 'damage_reduction') return `Reduces incoming damage by ${effect.amount}.`;
            if (effect.subtype === 'storage') return `Satchel: Stores up to ${effect.capacity} provisions.`;
            if (effect.subtype === 'double_fire') return `Doubles firearm damage.`;
            if (effect.subtype === 'damage_negation') return `Negates one hit, +${effect.max_health || 0} Max HP. Discarded after use.`;
            return `Provides a persistent upgrade.`;
        case 'random_gold_steal':
             return `Steals up to ${effect.maxAmount} Gold on reveal.`;
        case 'lose_gold':
            return `Steals ${effect.amount} Gold.`;
        case 'damage_percent':
            return `Deals ${Math.round((effect.amount || 0) * 100)}% of current HP as damage.`;
        case 'discard_equipped':
            return `Forces discard of equipped items.`;
        default:
            return null;
    }
}

export function isEventConsideredHostile(eventCard: CardData | null): boolean {
    if (!eventCard || eventCard.type !== 'Event') {
        return false;
    }

    // NEW: Allow trade if it's a small animal with 4 or less health
    if (eventCard.subType === 'animal' && (eventCard.health || 0) <= 4) {
        return false;
    }

    // Specific non-hostile on reveal even if they meet other criteria
    const nonHostileOnRevealIds = ['threat_skunk_t1', 'threat_skunk_t2', 'threat_rabbit_t1', 'threat_rabbit_t2', 'threat_rabbit_t3', 'threat_squirrel_t1', 'threat_squirrel_t2', 'threat_squirrel_t3'];
    if (nonHostileOnRevealIds.includes(eventCard.id)) {
        return false;
    }

    if (eventCard.subType === 'illness') { // All illnesses are non-trade-blocking
        return false;
    }
    if (eventCard.subType === 'environmental' && !(eventCard.effect?.type === 'damage' || eventCard.effect?.type === 'damage_percent' || eventCard.effect?.discard_equipped)) {
        return false; // Only environmental that do direct damage or discard equipped are hostile for trade
    }


    const effect = eventCard.effect;
    if (effect) {
        if (effect.type === 'damage' && (effect.amount || 0) > 0) return true;
        if (effect.type === 'poison' && (effect.damage || 0) > 0) return true; // Poison is hostile
        if (effect.type === 'conditional_damage' && (effect.damage || 0) > 0) return true;
        if (effect.type === 'damage_percent' && (effect.amount || 0) > 0) return true;
        if (effect.discard_equipped) return true; // Rockslide
    }
    const immediateEffect = eventCard.immediateEffect;
    if (immediateEffect) {
        if (immediateEffect.type === 'random_gold_steal' && (immediateEffect.maxAmount || 0) > 0) return true;
    }

    // If it has health and isn't one of the explicitly non-hostile small animals, assume it's hostile.
    // This check is now after the <=4HP animal check.
    if (eventCard.health && eventCard.health > 0) return true;


    return false;
}

export const getCardCategory = (card: CardData | null): number => {
    if (!card) return 6;
    if (card.type === 'Player Upgrade') return 1;
    if (card.effect?.type === 'weapon' || card.effect?.type === 'conditional_weapon') return 2;
    if (card.type === 'Provision') return 3;
    if (card.type === 'Action') return 4;
    if (card.type === 'Trophy' || card.type === 'Bounty Proof') return 5;
    return 6;
};

export function createTrophyOrBountyCard(originalThreat: CardData): CardData {
  let trophyName: string;
  let trophyType: 'Trophy' | 'Bounty Proof';
  let description: string;

  if (originalThreat.subType === 'animal') {
    trophyName = `${originalThreat.name} Pelt`;
    trophyType = 'Trophy';
    description = `The pelt of a defeated ${originalThreat.name}. A testament to your hunting prowess.`;
  } else if (originalThreat.subType === 'human') {
    trophyName = `${originalThreat.name} Bounty`;
    trophyType = 'Bounty Proof';
    description = `Proof of bounty for dealing with the notorious ${originalThreat.name}.`;
  } else { // For environmental or un-subtyped events if they somehow get here
    trophyName = `${originalThreat.name} Remnants`;
    trophyType = 'Trophy';
    description = `A strange token from the vanquished ${originalThreat.name}.`;
  }

  return {
    id: `trophy_${originalThreat.id}_${Date.now()}`,
    name: trophyName,
    type: trophyType,
    sellValue: originalThreat.goldValue || 0,
    description: description,
  };
}