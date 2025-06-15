

export interface CardEffect {
  type: string;
  amount?: number;
  damage?: number; // For conditional damage in events
  attack?: number;
  bonus_attack?: number;
  condition?: string;
  cures?: boolean;
  turn_end?: boolean;
  discard_equipped?: boolean;
  size?: 'small' | 'medium' | 'large'; // Added 'medium'
  capacity?: number;
  subtype?: string; // For upgrades: 'max_health', 'bow_boost', 'quiver_boost', etc.
  persistent?: boolean;
  max_health?: number; // For hat specific health bonus
  maxAmount?: number; // For random_gold_steal immediateEffect
}

export interface CardData {
  id: string;
  name: string;
  type: 'Event' | 'Provision' | 'Item' | 'Action' | 'Player Upgrade' | 'Trophy' | 'Bounty Proof';
  subType?: 'animal' | 'human' | 'illness' | 'environmental'; // For Events
  health?: number; // For Threats
  goldValue?: number; // For Threats, or sellValue for items
  effect?: CardEffect;
  description: string;
  sellValue?: number;
  buyCost?: number;
  immediateEffect?: CardEffect; // For on-reveal effects
}

export interface Character {
  id: string;
  name: string;
  health: number;
  gold: number;
  ability: string;
  starterDeck: string[];
  storyDesc: string;
}

export interface PlayerDetails {
  name: string | null;
  character: Character | null;
  health: number;
  maxHealth: number;
  gold: number;
  hand: (CardData | null)[]; // Updated to allow null for empty slots
  equippedItems: CardData[];
  activeTrap: CardData | null;
  isCampfireActive: boolean;
  handSize: number;
  equipSlots: number;
  playerDeck: CardData[];
  playerDiscard: CardData[];
  hasEquippedThisTurn: boolean;
  satchel: CardData[];
  turnEnded: boolean;
  hasTakenActionThisTurn: boolean;
  hasRestockedThisTurn: boolean;
  isUnsortedDraw: boolean; // Flag to skip sorting once after draw
  activeEventForAttack?: CardData | null; // Added for CardComponent attack calculations
  ngPlusLevel: number; // Added for NG+ adjustments
  hatDamageNegationAvailable: boolean; 
  hatDamageNegationUsedThisTurn?: boolean; // True if hat negated damage in current turn/event processing.
}

export interface LogEntry {
  message: string;
  type: 'info' | 'error' | 'action' | 'system' | 'turn' | 'event' | 'gold' | 'debug';
  timestamp: string;
}

export interface ModalState {
  isOpen: boolean;
  title: string;
  text: string;
  confirmCallback?: () => void;
  confirmText?: string;
}

export interface ActiveGameBannerState {
  show: boolean;
  message: string;
  bannerType: 'event_alert' | 'threat_defeated' | 'generic_info';
}

export interface GameState {
  status: 'setup' | 'generating_boss_intro' | 'showing_boss_intro' | 'playing_initial_reveal' | 'playing' | 'finished';
  playerDetails: { [playerId: string]: PlayerDetails }; // Using string index for player ID
  eventDeck: CardData[];
  eventDiscardPile: CardData[];
  activeEvent: CardData | null;
  storeItemDeck: CardData[];
  storeDisplayItems: (CardData | null)[];
  storeItemDiscardPile: CardData[]; // Added for store restock logic
  turn: number;
  storyGenerated: boolean;
  log: LogEntry[];
  selectedCard: { card: CardData; source: string; index: number } | null;
  ngPlusLevel: number;
  winReason?: string;
  endSequenceTriggered?: boolean;
  aiBoss?: CardData; // Stores the generated AI boss
  modals: { message: ModalState, story: ModalState }; // Added for modal management
  goldFlashPlayer?: boolean; 
  laudanumVisualActive?: boolean; 
  showLightningStrikeFlash?: boolean; // Added for global lightning flash
  blockTradeDueToHostileEvent: boolean; 
  activeEventJustAttacked?: boolean; // Tracks if the current active event was attacked this turn
  activeGameBanner: ActiveGameBannerState | null; // New state for general game banners
  pendingPlayerDamageAnimation?: { amount: number; sourceName: string; eventId?: string } | null; // For new damage animation
  bossIntroTitle?: string;
  bossIntroParagraph?: string;
  isLoadingBossIntro?: boolean; // Added to manage loading state for BossIntroStoryComponent
  playerDeckAugmentationPool: CardData[]; // Pool of cards for completing player deck
  activeEventTurnCounter: number; // Tracks how many turns the current event has been active
  scrollAnimationPhase: 'none' | 'fadingOutAndScrollingDown' | 'fadingInAndScrollingUp'; // New state for end-of-day scroll animation
  pendingSkunkSprayAnimation: boolean; // To trigger skunk spray animation on new day
}

export interface AIBossData {
    name: string;
    health: number;
    damage: number;
    description: string;
}

// Enum for card display contexts, useful for styling or logic
export enum CardContext {
  HAND = 'hand',
  EQUIPPED = 'equipped',
  STORE = 'store',
  EVENT = 'event',
  CHARACTER_SELECTION = 'character_selection',
  SCOUTED_PREVIEW = 'scouted_preview'
}