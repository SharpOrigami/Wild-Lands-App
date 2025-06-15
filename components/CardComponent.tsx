
import React from 'react';
import { CardData, CardContext, PlayerDetails } from '../types';
import { getCardValues, calculateAttackPower, getFormattedEffectText } from '../utils/cardUtils'; // Assuming utils file
import { PLAYER_ID, INITIAL_PLAYER_STATE_TEMPLATE } from '../constants';


interface CardComponentProps {
  card: CardData | null; // Allow null for empty slots
  context: CardContext;
  onClick?: () => void;
  isSelected?: boolean;
  indexInSource?: number; // For unique key and actions
  playerDetails?: PlayerDetails; // Needed for conditional rendering like attack power
  onAction?: (actionType: string, payload?: any) => void; // For action buttons
  isPlayable?: boolean; // Generic flag for enabling/disabling play/use buttons
  isEquipable?: boolean; // For items
  isEquipablePlayerUpgrade?: boolean; // Specifically for Player Upgrades
  isStorable?: boolean;
  isSellable?: boolean;
  canAfford?: boolean;
  blockTradeDueToHostileEvent?: boolean;
  isDisabled?: boolean; // General disable for card interactions
  className?: string; // Allow passing additional classes for overrides
  showBack?: boolean; // New prop to show card back
}

const CardComponent: React.FC<CardComponentProps> = ({
  card: cardFromProps, // Renamed prop
  context,
  onClick,
  isSelected,
  indexInSource,
  playerDetails,
  onAction,
  isPlayable = true,
  isEquipable = false,
  isEquipablePlayerUpgrade = false, // Default to false
  isStorable = false,
  isSellable = false,
  canAfford = true,
  blockTradeDueToHostileEvent = false,
  isDisabled = false,
  className = '',
  showBack = false,
}) => {

  const cardResponsiveDimensions = `
    w-[7rem] h-[9.8rem] text-[0.7rem] p-1.5
    sm:w-[7rem] sm:h-[9.8rem] sm:text-[0.7rem] sm:p-1.5
    md:w-[7rem] md:h-[9.8rem] md:text-[0.7rem] md:p-1.5
    lg:w-[7.5rem] lg:h-[10.5rem] lg:text-[0.65rem] lg:p-1.5
    xl:w-[8rem] xl:h-[11.2rem] xl:text-[0.7rem] xl:p-2
  `;

  const cardBaseStructure = `rounded m-1 text-center transition-all duration-200 ease-out flex flex-col justify-between relative flex-shrink-0`;


  if (showBack) {
    return (
      <div
        className={`${cardBaseStructure} ${cardResponsiveDimensions} card-back ${className}`}
        data-testid={`card-back-${cardFromProps?.id}-${indexInSource ?? ''}`}
      >
      </div>
    );
  }

  if (!cardFromProps) {
     if (context === CardContext.STORE || context === CardContext.EQUIPPED || context === CardContext.HAND) { // Added HAND context
      return (
        <div className={`flex items-center justify-center text-center
                         ${cardResponsiveDimensions}
                         flex-shrink-0
                         border-2 border-dashed border-[var(--border-color)] rounded text-[var(--border-color)]
                         bg-[rgba(0,0,0,0.03)] ${className}`}>
          {context === CardContext.STORE ? 'Sold Out' : context === CardContext.EQUIPPED ? 'Equip Slot' : 'Empty Slot'}
        </div>
      );
    }
    return null;
  }

  // Explicitly type 'card' after the null check for cardFromProps
  const card: CardData = cardFromProps;

  const { damage: displayDamage, gold: displayGold } = getCardValues(card, context, playerDetails);

  let tintClass = '';
  if (context !== CardContext.CHARACTER_SELECTION && context !== CardContext.SCOUTED_PREVIEW) {
    if (card.type === 'Event') {
        tintClass = 'bg-[rgba(138,3,3,0.07)]';
    } else if (card.type === 'Provision') {
        if (card.effect?.type === 'heal') {
            tintClass = 'bg-[rgba(85,107,47,0.08)]';
        } else if (card.effect?.type === 'draw') {
             tintClass = 'bg-[rgba(70,100,160,0.07)]';
        } else {
            tintClass = 'bg-[rgba(120,120,120,0.05)]';
        }
    } else if (card.type === 'Item') {
        if (card.effect?.type === 'weapon' || card.effect?.type === 'conditional_weapon') {
            tintClass = 'bg-[rgba(74,107,138,0.08)]';
        } else if (card.id.startsWith('item_gold_nugget') || card.id.startsWith('item_jewelry') || card.effect?.type === 'gold' || card.id === 'item_gold_pan') {
             tintClass = 'bg-[rgba(200,164,21,0.07)]';
        } else if (card.effect?.type === 'trap') {
            tintClass = 'bg-[rgba(160,100,70,0.07)]';
        } else if (card.effect?.type === 'campfire') {
            tintClass = 'bg-[rgba(200,100,50,0.07)]';
        } else {
             tintClass = 'bg-[rgba(130,130,130,0.06)]';
        }
    } else if (card.type === 'Player Upgrade') {
        tintClass = 'bg-[rgba(200,164,21,0.07)]';
    } else if (card.type === 'Action') {
        if (card.id === 'action_scout_ahead') {
            tintClass = 'bg-[rgba(100,160,100,0.07)]';
        } else {
            tintClass = 'bg-[rgba(74,107,138,0.08)]';
        }
    } else { // Handles remaining types: Trophy, Bounty Proof
        if (card.type === 'Trophy' || card.type === 'Bounty Proof') {
            tintClass = 'bg-[rgba(160,140,100,0.08)]'; // Tarnished/parchment tint for trophies
        }
    }
  }


  const cardFaceStyle = `border-2 border-[var(--ink-main)] text-[var(--ink-main)] shadow-[3px_3px_8px_rgba(0,0,0,0.2)] bg-[var(--paper-bg)]`;

  const hoverStyle = context !== CardContext.EVENT && context !== CardContext.SCOUTED_PREVIEW && !isDisabled ? 'hover:translate-y-[-4px] hover:rotate-[-1deg] hover:shadow-[4px_4px_12px_rgba(0,0,0,0.25)] cursor-pointer' : '';
  const selectedStyle = isSelected ? 'border-3 border-[var(--tarnished-gold)] shadow-[0_0_15px_rgba(200,164,21,0.5)] translate-y-[-2px]' : '';

  const nameStyle = "font-['Special_Elite'] font-bold leading-snug break-words w-full text-[var(--ink-main)] uppercase " +
                    "text-[0.9em] sm:text-[0.9em] md:text-[0.9em] lg:text-[0.85em] xl:text-[0.9em]";
  const typeStyle = "font-['Merriweather'] italic text-[var(--ink-secondary)] leading-tight " +
                    "text-[0.8em] sm:text-[0.8em] md:text-[0.8em] lg:text-[0.75em] xl:text-[0.8em] mt-0.5";
  const bottomTextStyle = "font-['Special_Elite'] font-bold mt-auto " +
                           "text-[0.95em] sm:text-[0.95em] md:text-[0.95em] lg:text-[0.9em] xl:text-[0.95em]";


  const isCharacterCard = context === CardContext.CHARACTER_SELECTION;
  const cardTextContentWrapperMargin = isCharacterCard ? 'mt-0' : `mt-[1.5rem] sm:mt-[1.5rem] md:mt-[1.5rem] lg:mt-[1.5rem] xl:mt-[1.6rem]`;


  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick && !isDisabled) {
      onClick();
    }
  };

  const isFirearmCardId = (id: string) => {
    return id.startsWith('item_sawed_off') || id.startsWith('item_rifle') || id.startsWith('item_six_shooter');
  };

  const createActionBtn = (text: string, action: string, btnDisabled: boolean = false, payload?: any) => (
    <button
      key={action}
      className={`py-0.5 w-[85%] rounded-sm bg-[var(--ink-main)] text-[var(--paper-bg)] border border-[var(--paper-bg)]
                  transition-colors duration-150 font-['Special_Elite'] uppercase
                  text-[0.75em] sm:text-[0.75em] md:text-[0.75em] lg:text-[0.7em] xl:text-[0.75em]
                  ${btnDisabled ? 'bg-[#9e9e9e] cursor-not-allowed' : 'hover:bg-[var(--blood-red)]'}`}
      disabled={btnDisabled}
      onClick={(e) => {
        e.stopPropagation();
        if (onAction) onAction(action, { card, source: context, index: indexInSource, ...(payload || {}) });
      }}
    >
      {text}
    </button>
  );

  let actionButtons: React.ReactNode[] = [];
  if (isSelected && onAction && playerDetails && !isCharacterCard && !isDisabled) {
    const turnEnded = playerDetails.turnEnded;
    const cardType = card.type as CardData['type']; // This assertion is fine, card.type is now from the typed 'card'

    if (context === CardContext.HAND) {
      if (cardType === 'Trophy' || cardType === 'Bounty Proof' || card.id.startsWith('item_gold_nugget') || card.id.startsWith('item_jewelry')) {
        actionButtons.push(createActionBtn(`Sell ${card.sellValue}G`, 'SELL_FROM_HAND', blockTradeDueToHostileEvent || turnEnded));
      } else {
        const usableEffects = ['heal', 'weapon', 'conditional_weapon', 'campfire', 'gold', 'draw', 'trap', 'escape', 'upgrade', 'fire_arrow', 'discard_gold', 'scout'];
        if (card.effect && usableEffects.includes(card.effect.type) && card.id !== 'upgrade_satchel') {
          let useDisabled = turnEnded || !isPlayable; // Simplified: no longer checks hasTakenActionThisTurn for hand cards
           if (card.effect.type === 'weapon' || card.effect.type === 'conditional_weapon' || card.effect.type === 'fire_arrow') {
             if (!playerDetails.activeEventForAttack || playerDetails.activeEventForAttack.health <= 0 || playerDetails.activeEventForAttack.type !== 'Event') {
                 useDisabled = true;
             }
           }
           if(card.effect.type === 'fire_arrow') {
              const hasBow = playerDetails.hand.some(c => c?.id.startsWith('item_bow')) || playerDetails.equippedItems.some(c => c.id.startsWith('item_bow'));
              if (!hasBow) useDisabled = true;
           }
           // Removed: 'scout' specific check against hasTakenActionThisTurn
           if (card.id === 'action_trick_shot') {
              const hasAnyFirearm = playerDetails.hand.some(c => c && isFirearmCardId(c.id)) || playerDetails.equippedItems.some(c => isFirearmCardId(c.id));
              if (!hasAnyFirearm) {
                  useDisabled = true;
              }
           }
          actionButtons.push(createActionBtn('Play', 'USE_ITEM', useDisabled));
        }

        if (cardType === 'Player Upgrade') {
            actionButtons.push(createActionBtn('Equip', 'EQUIP_ITEM', !isEquipablePlayerUpgrade || turnEnded));
        } else if (cardType === 'Item' && card.effect && card.effect.type !== 'trap') { // Regular items
            actionButtons.push(createActionBtn('Equip', 'EQUIP_ITEM', !isEquipable || turnEnded));
        }

        if (cardType === 'Provision') {
           const satchel = playerDetails.equippedItems.find(item => item.effect?.subtype === 'storage');
            if (satchel) {
              actionButtons.push(createActionBtn('Store', 'STORE_PROVISION', !isStorable || turnEnded));
            }
        }
        if (isSellable && card.sellValue && card.sellValue > 0 && card.type !== 'Trophy' && card.type !== 'Bounty Proof' && !card.id.startsWith('item_gold_nugget') && !card.id.startsWith('item_jewelry')) {
          actionButtons.push(createActionBtn(`Sell ${card.sellValue}G`, 'SELL_FROM_HAND', blockTradeDueToHostileEvent || turnEnded));
        }
      }
    } else if (context === CardContext.EQUIPPED) {
       if (turnEnded) { /* No actions if turn ended - parent CardComponent isDisabled handles this */ }
       else if (card.effect?.subtype === 'storage') {
         // USE_FROM_SATCHEL is disabled if satchel empty OR if hasTakenActionThisTurn. This specific action might still be limited.
         actionButtons.push(createActionBtn('Use from Satchel', 'USE_FROM_SATCHEL', (playerDetails.satchel?.length || 0) === 0 || playerDetails.hasTakenActionThisTurn));
       } else if (card.effect && ['heal', 'weapon', 'conditional_weapon', 'campfire', 'gold', 'draw', 'fire_arrow'].includes(card.effect.type)) {
          let useEquippedDisabled = !isPlayable; // Simplified: no longer checks hasTakenActionThisTurn for equipped cards play
           if (card.effect.type === 'weapon' || card.effect.type === 'conditional_weapon' || card.effect.type === 'fire_arrow') {
              if (!playerDetails.activeEventForAttack || playerDetails.activeEventForAttack.health <= 0 || playerDetails.activeEventForAttack.type !== 'Event') {
                  useEquippedDisabled = true;
              }
           }
         actionButtons.push(createActionBtn('Play', 'USE_ITEM', useEquippedDisabled));
       }

       if (card.sellValue && card.sellValue > 0) {
           actionButtons.push(createActionBtn(`Sell ${card.sellValue}G`, 'SELL_EQUIPPED', blockTradeDueToHostileEvent || turnEnded));
       }

       if (cardType === 'Player Upgrade') {
         actionButtons.push(createActionBtn('Discard', 'DISCARD_UPGRADE', turnEnded));
       } else if (cardType === 'Item'){
          actionButtons.push(createActionBtn('Discard', 'DISCARD_EQUIPPED_ITEM', turnEnded));
       }
    } else if (context === CardContext.STORE) {
      actionButtons.push(createActionBtn(`Buy ${card.buyCost * 2}G`, 'BUY_ITEM', !canAfford || blockTradeDueToHostileEvent || turnEnded));
    } else if (context === CardContext.EVENT && card.type !== 'Event') { // This is for items/provisions found in event slot
        // TAKE_EVENT_ITEM is disabled if hasTakenActionThisTurn. This specific action is still limited.
        actionButtons.push(createActionBtn('Take', 'TAKE_EVENT_ITEM', playerDetails.turnEnded || playerDetails.hasTakenActionThisTurn));
    }
  }


  return (
    <div
      className={`${cardBaseStructure} ${cardResponsiveDimensions} ${cardFaceStyle} ${tintClass} ${hoverStyle} ${selectedStyle} ${isDisabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      onClick={handleCardClick}
      data-testid={`card-${card.id}-${indexInSource ?? ''}`}
    >
      {isCharacterCard && isSelected && (
        <div className="absolute top-1 right-1 bg-green-700 text-white text-xs px-1.5 py-0.5 rounded-full font-['Special_Elite'] transform rotate-12">✓</div>
      )}
      {displayGold && <div className={`absolute top-1 left-1 text-[var(--tarnished-gold)] border border-[var(--tarnished-gold)] rounded-sm bg-[rgba(255,255,255,0.6)] font-['Special_Elite']
                                       text-[0.7em] px-1 py-0.5
                                       sm:text-[0.7em] sm:px-1 sm:py-0.5
                                       md:text-[0.75em] md:px-1 md:py-0.5
                                       lg:text-[0.7em] lg:px-1 lg:py-0.5
                                       xl:text-[0.75em] xl:px-1 xl:py-0.5`}>{displayGold}</div>}
      {displayDamage && <div className={`absolute top-1 right-1 text-[var(--blood-red)] border border-[var(--blood-red)] rounded-sm bg-[rgba(255,255,255,0.6)] font-['Special_Elite']
                                         text-[0.7em] px-1 py-0.5
                                         sm:text-[0.7em] sm:px-1 sm:py-0.5
                                         md:text-[0.75em] md:px-1 md:py-0.5
                                         lg:text-[0.7em] lg:px-1 lg:py-0.5
                                         xl:text-[0.75em] xl:px-1 xl:py-0.5`}>{displayDamage}</div>}


      <div className={`overflow-hidden ${cardTextContentWrapperMargin} ${isSelected && actionButtons.length > 0 ? 'opacity-20' : ''}`}>
        <div className={nameStyle}>{card.name}</div>
        <div className={typeStyle}>{card.type} {card.subType ? `- ${card.subType}` : ''}</div>
      </div>

      {!isCharacterCard && card.health !== undefined && card.type === 'Event' && (
        <div className={`${bottomTextStyle} text-[var(--blood-red)] ${isSelected && actionButtons.length > 0 ? 'opacity-20' : ''}`}>Health: {card.health}</div>
      )}
      {isCharacterCard && card.health !== undefined && (
        <div className={`${bottomTextStyle} text-[var(--blood-red)]`}>HP: {playerDetails?.ngPlusLevel ? Math.max(1, card.health - playerDetails.ngPlusLevel) : card.health}</div>
      )}
      {context === CardContext.STORE && card.buyCost !== undefined && (
         <div className={`${bottomTextStyle} text-[var(--faded-blue)] ${isSelected && actionButtons.length > 0 ? 'opacity-20' : ''}`}>Cost: {card.buyCost * 2}G</div>
      )}
       {(card.type === 'Trophy' || card.type === 'Bounty Proof') && card.sellValue !== undefined && context !== CardContext.STORE && (
         <div className={`${bottomTextStyle} text-[var(--tarnished-gold)] ${isSelected && actionButtons.length > 0 ? 'opacity-20' : ''}`}>Sell: {card.sellValue}G</div>
      )}


      {isSelected && actionButtons.length > 0 && !isCharacterCard && (
        <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-full flex flex-col items-center gap-0.5 opacity-100 pointer-events-auto z-10">
          {actionButtons}
        </div>
      )}
      {context === CardContext.EVENT && card.type !== 'Event' && !isSelected && onAction && playerDetails && (
        <div className="absolute bottom-1.5 left-0 right-0">
          {createActionBtn('Take', 'TAKE_EVENT_ITEM', playerDetails.turnEnded || playerDetails.hasTakenActionThisTurn)}
        </div>
      )}
    </div>
  );
};

export default CardComponent;
