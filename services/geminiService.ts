
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GameState, LogEntry, CardData, AIBossData, Character } from '../types';
import { CURRENT_CARDS_DATA } from "../constants";

// Initialize GoogleGenAI instance at module scope
// As per guidelines, process.env.API_KEY is assumed to be pre-configured and valid.
let genAIInstance: GoogleGenAI | null = null;

if (process.env.API_KEY) {
    try {
        genAIInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        console.error("Critical error initializing GoogleGenAI in geminiService.ts:", e);
        // genAIInstance remains null, functions will fallback or indicate error
    }
} else {
    console.warn("Gemini API key (process.env.API_KEY) is not defined. AI features will be disabled or limited.");
}

const STORY_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
const BOSS_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
const REMIX_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
const BOSS_INTRO_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';


export async function generateStoryForGame(gameState: GameState): Promise<string> {
  if (!genAIInstance) {
    return "The storyteller is missing... (Gemini API not configured or failed to initialize). Your tale remains untold, but your deeds are remembered.";
  }
  if (gameState.storyGenerated) return gameState.modals?.story.text || "Story already told.";

  try {
    const logSummary = gameState.log
        .filter(entry => entry.type !== 'debug')
        .map(entry => `[${entry.type}] ${entry.message}`)
        .slice(0, 150)
        .reverse()
        .join('\n');

    const player = gameState.playerDetails[Object.keys(gameState.playerDetails)[0]];
    const adventurerName = player.name;
    const character = player.character;
    const characterDescription = character?.storyDesc || "A mysterious figure.";

    const prompt = `You are a master storyteller of the Old West. Your task is to write a vivid and atmospheric tale about a lone adventurer.

    THE CHARACTER:
    Their name is ${adventurerName}. They are a known ${character?.name}, described as: "${characterDescription}". Weave this physical description into the story naturally.

    THE TASK:
    Use the following game log to add specific details and give context to the events. Do not just list the events. Flesh them out with rich sensory details, focusing on a few key moments rather than trying to narrate every single log entry.
    - Describe the **environment**: Is it a sun-baked desert, a muddy, rain-slicked forest, or a freezing mountain pass? Is the air still or windy?
    - Describe the **character's state**: Mention their clothing, gear, weariness, determination, or specific feelings related to events.
    - Describe notable **threats or encounters**: Give them a memorable appearance or behavior.

    Make the reader *feel* the grit, the heat, and the tension of this journey. Conclude the story with their final outcome, as written in the log. Aim for a compelling narrative of around 3-5 paragraphs.

    KEY GAME LOG EVENTS:
    ${logSummary}

    FINAL OUTCOME: ${gameState.winReason || "Their fate remains unknown."}`;

    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
        model: STORY_MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return response.text;

  } catch (error) {
    console.error("Error generating story via Gemini:", error);
    return "The ink ran dry... could not write your story. Your deeds will have to speak for themselves.";
  }
}


export async function generateAIBossForGame(log: (message: string, type?: LogEntry['type']) => void): Promise<CardData> {
  const fallbackBoss: CardData = { id:'default_boss_fallback', name: 'The Nameless Dread', type: 'Event', subType: 'human', health: 25, goldValue: 50, effect: {type:'damage', amount: 15}, description: "A shadowy figure of legend, spoken of only in hushed whispers. It is said this entity feeds on despair, its presence chilling the very air and twisting familiar trails into nightmarish labyrinths. Every victory against its lesser minions only seems to draw its baleful attention closer." };

  if (!genAIInstance) {
    log("Gemini API not configured. Using a default boss.", "system");
    return { ...fallbackBoss, id: 'default_boss' }; // Ensure ID distinguishes this specific fallback
  }

  log("A great evil awakens in the west...", "system");
  try {
    const prompt = `Create a unique, final boss for a pulp/realistic western-themed card game. The boss should be represented as a single entity, which could be:
    1.  A **Dangerous Human Threat**: An infamous historical outlaw (e.g., Billy the Kid archetype), a legendary fictional gunslinger, a ruthless gang leader, or a cunning bounty hunter.
    2.  A **Legendary Animal**: An exceptionally powerful and fearsome version of a North American animal (e.g., Legendary Grizzly Bear, Colossal Boar, Ancient Cougar).
    3.  An **Organized Gang**: A notorious group of outlaws, cattle poachers, or desperate miners, represented as a single formidable "boss" challenge (e.g., "The Red Rock Gang," "Blackwood Cattle Rustlers").
    4.  A **Western Folklore/Pulp Entity**: A spectral gunslinger, a wendigo, a haunted prospector, or a malevolent dust devil (avoid high-fantasy like dragons).

    Provide its name, a one-paragraph atmospheric description of its lore/appearance, its health (integer between 20 and 40), and the damage it deals (integer between 10 and 20).
    Emphasize gritty realism where appropriate, or lean into pulp adventure for folklore entities.
    Respond ONLY with a single, clean JSON object in the format: {"name": "Boss Name", "health": 25, "damage": 15, "description": "lore..."}`;

    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
        model: BOSS_MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    const bossData: AIBossData = JSON.parse(jsonStr);

    log(`${bossData.name} has appeared!`, "event");

    return {
        id: 'ai_boss_' + Date.now(),
        name: bossData.name,
        description: bossData.description,
        type: 'Event',
        subType: 'human', // Defaulting to human; the description will imply animal/gang type
        health: parseInt(String(bossData.health)) || 25,
        goldValue: (parseInt(String(bossData.health)) || 25) * 2, // Ensure goldValue scales
        effect: { type: 'damage', amount: parseInt(String(bossData.damage)) || 15 }
    };

  } catch (error) {
    console.error("Error generating AI boss via Gemini:", error);
    log("Failed to generate a unique threat. A familiar foe appears instead.", "error");
    return fallbackBoss;
  }
}

export async function remixCardsForNGPlusGame(
    log: (message: string, type?: LogEntry['type']) => void,
    baseCardsToRemix: { [id: string]: CardData },
    ngPlusLevel: number
): Promise<{ [id: string]: CardData } | null> {
  if (!genAIInstance) {
    log("Cannot remix cards for NG+: Gemini API not configured. Using standard cards.", "error");
    return null;
  }
  log(`The world feels... different. More dangerous. NG+${ngPlusLevel} Remixing cards...`, "system");
  try {
    const prompt = `You are a game designer. Here is a JSON object representing standard cards in a western-themed game: ${JSON.stringify(baseCardsToRemix)}.
    The player has reached New Game Plus level ${ngPlusLevel}. Your task is to remix these cards to be significantly more challenging and legendary, fitting for this advanced stage of play.
    Follow these rules precisely:
    1. For every single Threat card (type: 'Event'):
       - If its subType is 'animal', change its 'name' to a more dangerous or mythical North American animal (e.g., at NG+10 'Wolf' could be 'Dire Wolf'; at NG+20 it might be 'Shadow Stalker Alpha').
       - If its subType is 'human', change its 'name' to a mythological creature or infamous figure from a 'weird west' theme (e.g., at NG+10 'Outlaw' could be 'Wendigo Stalker'; at NG+20 'Spectral Gunslinger').
       - If its subType is 'environmental' or 'illness', change its 'name' to a more severe or supernatural version (e.g., at NG+10 'Rockslide' to 'Mountain's Wrath Avalanche'; at NG+20 'Whispering Blight').
       - Increase its 'health' (if present) by a factor appropriate to the NG+ level (e.g., for NG+10 by 1.5x-2x; for NG+20 by 2x-2.5x, round to nearest integer).
       - Increase its 'damage' or 'amount' in its effect (if damage related) by an amount appropriate to the NG+ level (e.g., for NG+10 by +2 to +5; for NG+20 by +4 to +8).
    2. For every 'weapon' card (effect.type: 'weapon' or 'conditional_weapon'), add a random integer to its 'attack' value that scales with the NG+ level (e.g., for NG+10 add 1-3; for NG+20 add 2-4).
    3. For all other cards (Items, Provisions, Upgrades, Actions not covered above), give them a new, more epic-sounding 'name' (e.g., 'Small Meat' to 'Sustaining Jerky of the Ancients', 'Hat' to 'Stetson of Unyielding Resilience') and rewrite their 'description' to be one evocative sentence that reflects their enhanced power or rarity, suitable for the given NG+ level.
    Do not change any other keys (like 'id', 'type', 'subType', 'effect.type' unless it's damage amount) or the fundamental effect of the cards beyond numerical adjustments for threats/weapons.
    Return ONLY the modified JSON object, ensure it is valid JSON. The changes should reflect the challenge of NG+ level ${ngPlusLevel}.`;

    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
        model: REMIX_MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const remixedCards: { [id: string]: CardData } = JSON.parse(jsonStr);

    if (typeof remixedCards === 'object' && remixedCards !== null && Object.keys(remixedCards).length > 0) {
        log("The very fabric of the frontier has been reforged by legend!", "system");
        return remixedCards;
    } else {
        log("Card remixing returned invalid data. No AI remix applied.", "error");
        return null;
    }

  } catch (error) {
    console.error("Error remixing cards via Gemini:", error);
    log("The legends remain the same... for now. (Card remix failed). No AI remix applied.", "error");
    return null;
  }
}

export async function generateBossIntroStory(
  playerName: string,
  character: Character,
  aiBoss: CardData,
  log: (message: string, type?: LogEntry['type']) => void
): Promise<{ title: string; paragraph: string } | null> {
  const defaultBossName = "The Nameless Dread";
  const bossName = aiBoss?.name || defaultBossName;
  const bossDescription = aiBoss?.description || "A shadowy figure of legend, spoken of only in hushed whispers. It is said this entity feeds on despair, its presence chilling the very air and twisting familiar trails into nightmarish labyrinths. Every victory against its lesser minions only seems to draw its baleful attention closer.";
  const characterClothingItem = character.storyDesc.match(/duster|hides|boots|coat|shirt/i)?.[0] || "worn gear";

  const fallbackStory = {
    title: "The Weight of the West",
    paragraph: `The grit of the trail clung to ${playerName}'s ${characterClothingItem}, a second skin earned through miles of hard travel. Every creak of leather, every jingle of gear, was a familiar song. But a new, discordant note had begun to weave its way into the silence of the plains – the name of ${bossName}. It was a name spoken in hushed tones around flickering campfires, a name that tasted like ash and stale fear. They said ${bossName} was a blight, a creeping darkness that twisted the land and the hearts of its creatures, its very essence a mockery of the pioneer spirit that drove folks like ${playerName}.

That name, ${bossName}, had become a burr under ${playerName}'s saddle, a festering wound on the soul of the frontier. For a ${character.name} like ${playerName}, who had faced down their share of devils, this was different. This was personal. The wind itself seemed to carry the stench of ${bossName}'s malevolence – a dry, acrid smell like ancient dust and forgotten graves. To turn back now, to let that shadow lengthen, was not an option. A reckoning was due, a final stand against the encroaching dread, and ${playerName} aimed to be the one to deliver it.`
  };

  if (!genAIInstance) {
    log("Gemini API not configured for boss intro. Using fallback story.", "system");
    return fallbackStory;
  }

  log(`Generating intro story for ${playerName} vs ${bossName}...`, "system");
  try {
    const prompt = `
You are a master storyteller of the Old West. Create a short, impactful "chapter title" (3-5 words) and a single, compelling narrative paragraph (around 100-150 words) that sets the stage for a confrontation.

Player Character:
- Name: "${playerName}"
- Profession/Type: "${character.name}"
- Description (use elements of this): "${character.storyDesc}"

Final Boss:
- Name: "${bossName}"
- Backstory/Description (use elements of this): "${bossDescription}"

The paragraph must explain WHY ${playerName} feels compelled to confront ${bossName}. Emphasize the threat ${bossName} poses or a wrong that ${playerName} must right. Use vivid Western themes, sensory details (textures, smells, feelings – e.g., the grit of the trail, the scent of sage and gunpowder, the chill of fear, the heat of determination).

Respond ONLY with a single, clean JSON object in the format:
{"title": "Impactful Chapter Title", "paragraph": "The narrative paragraph..."}
`;

    const response: GenerateContentResponse = await genAIInstance.models.generateContent({
        model: BOSS_INTRO_MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const storyData: { title: string; paragraph: string } = JSON.parse(jsonStr);

    if (storyData.title && storyData.paragraph) {
      log("Boss intro story generated.", "system");
      return storyData;
    } else {
      log("Generated boss intro story data is incomplete. Using fallback.", "error");
      return fallbackStory;
    }

  } catch (error) {
    console.error("Error generating boss intro story via Gemini:", error);
    log("Failed to generate boss intro story. Using fallback.", "error");
    return fallbackStory;
  }
}
