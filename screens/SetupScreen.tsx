
import React, { useState, useEffect, useRef } from 'react';
import { Character, CardContext, PlayerDetails } from '../types';
import { CHARACTERS_LIST, CURRENT_CARDS_DATA, INITIAL_PLAYER_STATE_TEMPLATE } from '../constants';
import CardComponent from '../components/CardComponent';

interface SetupScreenProps {
  characters?: Character[];
  selectedCharacter: Character | null;
  onSelectCharacter: (character: Character) => void;
  onConfirmName: (name: string) => void;
  onStartGame: (name: string, character: Character) => void; // Modified signature
  ngPlusLevel: number;
  characterName: string;
  isLoadingBossIntro: boolean;
}

const SetupScreen: React.FC<SetupScreenProps> = ({
  selectedCharacter,
  onSelectCharacter,
  onConfirmName,
  onStartGame,
  ngPlusLevel,
  characterName: initialCharacterName,
  isLoadingBossIntro,
}) => {
  const [nameInput, setNameInput] = useState(initialCharacterName);

  useEffect(() => {
    if (selectedCharacter) {
      if (initialCharacterName && nameInput !== initialCharacterName) {
        setNameInput(initialCharacterName);
      }
    }
    else if (selectedCharacter && !nameInput && initialCharacterName) {
        setNameInput(initialCharacterName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter, initialCharacterName]);

  useEffect(() => {
    if (!selectedCharacter || (selectedCharacter && nameInput !== initialCharacterName)) {
        setNameInput(initialCharacterName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCharacterName]);


  const handleStartGameClick = () => {
    if (isLoadingBossIntro) return; 
    if (nameInput.trim() && selectedCharacter) {
      onConfirmName(nameInput.trim()); // Still call to update state for other potential listeners
      onStartGame(nameInput.trim(), selectedCharacter); // Pass fresh data directly
    } else if (!nameInput.trim()) {
      alert("Please enter a name for your character.");
    } else if (!selectedCharacter) {
      alert("Please select a character.");
    }
  };

  const getCharacterDescription = (character: Character | null) => {
    if (!character) return '';

    let charHealth = character.health - ngPlusLevel > 0 ? character.health - ngPlusLevel : 1;
    let desc = `<p class="font-bold text-lg text-[var(--ink-main)]">${character.name}</p>`;
    desc += `<p class="text-sm italic text-[var(--ink-secondary)] mb-2">Health: ${charHealth}, Gold: ${character.gold}</p>`;
    desc += `<p>${character.ability}</p>`;

    const starterDeckNames = character.starterDeck
        .map(id => CURRENT_CARDS_DATA[id]?.name || 'Unknown Card')
        .join(', ');
    desc += `<p class="mt-2 font-semibold">Starts with:</p><p class="text-xs">${starterDeckNames}</p>`;
    return desc;
  };

  const sortedCharacters = [...CHARACTERS_LIST].sort((a,b) => b.health - a.health);

  return (
    <div id="setupScreenContainer" className="flex flex-col items-center">
      <h2 className="text-2xl font-western text-center text-stone-200 mb-6">Choose Your Legend</h2>

      <div
        id="characterCardGrid"
        className="grid grid-cols-2 sm:grid-cols-4 justify-items-center mb-6 w-full
                   gap-2 max-w-[15rem] /* For 2x 7rem cards + gap */
                   sm:gap-2 sm:max-w-lg
                   md:gap-2.5 md:max-w-xl
                   lg:gap-2.5 lg:max-w-2xl
                   xl:gap-3 xl:max-w-3xl"
      >
        {sortedCharacters.map(char => (
            <CardComponent
              key={char.id}
              card={{...char, type: 'Player Upgrade', description: char.ability } as any}
              context={CardContext.CHARACTER_SELECTION}
              onClick={() => onSelectCharacter(char)}
              isSelected={selectedCharacter?.id === char.id}
              playerDetails={{ ...INITIAL_PLAYER_STATE_TEMPLATE, character: char, ngPlusLevel: ngPlusLevel } as PlayerDetails}
            />
        ))}
      </div>

      {selectedCharacter && (
          <div
            id="characterInteractivePanel"
            className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-xl mx-auto flex flex-col gap-4 p-4 bg-[rgba(244,241,234,0.15)] rounded-lg shadow-lg mt-2"
          >
            {ngPlusLevel > 0 && (
              <p className="text-center text-yellow-300 font-western text-2xl">
                NG+{ngPlusLevel}
              </p>
            )}
            <div
              id="characterDescription"
              className="p-3 bg-[rgba(244,241,234,0.9)] rounded shadow-inner min-h-[4rem] text-sm text-stone-800 max-h-72 overflow-y-auto"
              aria-live="polite"
              dangerouslySetInnerHTML={{ __html: getCharacterDescription(selectedCharacter) }}
            />

            <div id="namePromptAndStart" className="mt-auto pt-4 border-t border-[var(--border-color)] flex flex-col items-center gap-3">
              <input
                type="text"
                id="characterNameInput"
                placeholder="Enter your character's name"
                aria-label="Character's Name"
                className="p-2 border border-[#8c6b4f] rounded text-lg text-stone-800 bg-white w-full max-w-xs"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button
                id="startGameButton"
                className="text-lg px-4 py-2 rounded-sm shadow-md transition-all duration-150 ease-out font-['Special_Elite'] uppercase tracking-wider bg-[var(--paper-bg)] text-[var(--ink-main)] border border-[var(--ink-main)] hover:bg-stone-300 hover:border-[var(--ink-main)] focus:ring-2 focus:ring-[var(--ink-main)] focus:ring-offset-1 focus:ring-offset-[var(--paper-bg)] disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-400 disabled:cursor-not-allowed w-full max-w-xs"
                onClick={handleStartGameClick}
                disabled={!nameInput.trim() || !selectedCharacter || isLoadingBossIntro}
              >
                {isLoadingBossIntro ? "Loading..." : "Start Game"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

export default SetupScreen;
