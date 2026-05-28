import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

// Curated emoji sets by category — lightweight, zero-dependency
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔',
      '🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨',
      '🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢',
      '🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎',
      '🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺',
      '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
      '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈',
      '👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾',
      '🹀','🤖','😺','😸','😹','😻','😼','😽','🙀','😿',
      '😾','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎',
      '💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟',
    ],
  },
  {
    name: 'People',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞',
      '🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝',
      '🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂',
      '🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅',
      '👄','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩',
      '🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🧍','🧎',
      '🏃','🧑‍🤝‍🧑','👭','👫','👬','💏','💑','👨‍👩‍👧','👨‍👩‍👧‍👦','👨‍👦‍👦',
      '👩‍👧‍👧','👩‍👧','👩‍👦','👩‍👦‍👦','👩‍👩‍👧','👨‍👨‍👧','👩‍👩‍👧‍👦','👨‍👨‍👧‍👦','👨‍👩‍👦','👩‍🎓',
      '👨‍🎓','👩‍🎤','👨‍🎤','👩‍🎨','👨‍🎨','👩‍🏫','👨‍🏫','👩‍🏭','👨‍🏭','👩‍⚕️',
      '👨‍⚕️','👩‍🌾','👨‍🌾','👩‍🍳','👨‍🍳','👩‍🔧','👨‍🔧','👩‍🔬','👨‍🔬','👩‍🔭',
      '👨‍🔭','👩‍💻','👨‍💻','👩‍💼','👨‍💼','👩‍🚀','👨‍🚀','👩‍🚒','👨‍🚒','👮',
      '🕵️','💂','🥷','👷','🫅','🤴','👸','👳','👲','🧕',
      '🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙',
      '🧚','🧛','🧜','🧝','🧞','🧟','🧌','💆','💇','🚶',
      '🧘','🏄','🧗','🤸','⛹️','🤼','🤽','🤾','🤺','⛳',
    ],
  },
  {
    name: 'Animals',
    icon: '🐾',
    emojis: [
      '🐵','🐒','🦍','🦧','🐶','🐕','🦮','🐕‍🦺','🐩','🐺',
      '🦊','🦝','🐱','🐈','🐈‍⬛','🦁','🐯','🐅','🐆','🐴',
      '🐎','🦄','🦓','🦌','🦬','🐮','🐂','🐃','🐄','🐷',
      '🐖','🐗','🐽','🐏','🐑','🐐','🐪','🐫','🦙','🦒',
      '🐘','🦣','🦏','🦛','🐭','🐁','🐀','🐹','🐰','🐇',
      '🐿️','🦫','🦔','🦇','🐻','🐻‍❄️','🐨','🐼','🦥','🦦',
      '🦨','🦘','🦡','🐾','🦃','🐔','🐓','🐣','🐤','🐥',
      '🐦','🐧','🕊️','🦅','🦆','🦢','🦉','🦤','🪶','🦩',
      '🦚','🦜','🐸','🐊','🐢','🦎','🐍','🐲','🐉','🦕',
      '🦖','🐳','🐋','🐬','🦭','🐟','🐠','🐡','🦈','🐙',
      '🐚','🐌','🦋','🐛','🐜','🐝','🪲','🐞','🐜','🦗',
      '🪳','🕷️','🦂','🦟','🪰','🪱','🦠','💐','🌸','💮',
      '🏵️','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🪴','🌲',
      '🌳','🌴','🌵','🎋','🎍','🍀','🍁','🍂','🍃','🪹',
    ],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: [
      '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏',
      '🍐','🍑','🍒','🍓','🫐','🥝','🍅','🍆','🥑','🥦',
      '🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔',
      '🍠','🫘','🥐','🥖','🍞','🥨','🥯','🧀','🥚','🍳',
      '🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟',
      '🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘',
      '🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪',
      '🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧',
      '🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫',
      '🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','🫖','☕',
      '🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃',
      '🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥣','🥡',
    ],
  },
  {
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳',
      '🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷',
      '⛸️','🥌','🎿','🎪','🎭','🎨','🎬','🎤','🎧','🎼',
      '🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻','🎲',
      '♟️','🎯','🎳','🎮','🕹️','🎰','🧩','🪀','🪁','🎳',
    ],
  },
  {
    name: 'Travel',
    icon: '✈️',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐',
      '🛻','🚚','🚛','🚜','🛵','🏍️','🛺','🚲','🛴','🚨',
      '🚔','🚍','🚘','🚖','🛞','🚡','🚠','🚟','🚃','🚋',
      '🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉',
      '✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁','🛶',
      '⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','⛽','🚧','🚦',
      '🚥','🚏','🗿','🗽','🏰','🏯','🏟️','🎡','🎢','🎠',
      '⛲','⛱️','🏖️','🏝️','🏜️','🌋','🗻','⛰️','🏔️','🏕️',
      '🏠','🏡','🏘️','🏚️','🏗️','🏢','🏬','🏣','🏤','🏥',
      '🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍',
    ],
  },
  {
    name: 'Objects',
    icon: '💡',
    emojis: [
      '💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷',
      '🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨',
      '⚒️','🛠️','🗡️','⚔️','🔫','🪃','🏹','🛡️','🪚','🔪',
      '🗜️','🔩','⚙️','🗝️','🔑','🧲','🔒','🔓','🔏','🔐',
      '💻','🖥️','🖨️','⌨️','🖱️','🖲️','💽','💾','💿','📀',
      '📱','📲','☎️','📞','📟','📠','📺','📷','📸','📹',
      '🎥','📼','🔍','🔎','🕯️','💬','💭','🗯️','💤','👁️‍🗨️',
      '🏷️','🔖','📰','📓','📔','📒','📕','📗','📘','📙',
      '📚','📖','🔗','📎','🖇️','📐','📏','🧮','📌','📍',
      '✂️','🗃️','🗳️','🗄️','📆','📅','🗑️','📇','📈','📉',
    ],
  },
  {
    name: 'Symbols',
    icon: '✨',
    emojis: [
      '✨','💫','⭐','🌟','⚡','🔥','💥','❄️','🌈','☀️',
      '🌤️','⛅','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','🌬️','💨',
      '🌪️','🌫️','🌊','💧','💦','☔','☂️','🌂','🌀','♠️',
      '♥️','♦️','♣️','🃏','🀄','🎴','🔇','🔈','🔉','🔊',
      '📢','📣','📯','🔔','🔕','🎵','🎶','💎','❤️‍🔥','❤️‍🩹',
      '➰','➿','〽️','✳️','✴️','❇️','©️','®️','™️','#️⃣','*️⃣',
      '0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣',
      '🔟','🔠','🔡','🔢','🔣','🔤','🅰️','🆎','🅱️','🆑',
      '🆒','🆓','ℹ️','🆔','Ⓜ️','🆕','🆖','🅾️','🆗','🅿️',
      '🆘','🆙','🆚','🈁','🈂️','🈷️','🈶','🈯','🉐','🈹',
      '🈚','🈲','🉑','🈸','🈴','🈳','㊗️','㊙️','🈺','🈵',
      '✅','☑️','✔️','❌','❎','➖','➕','➗','➰','➿',
      '〰️','➰','❓','❔','❕','❗','⁉️','💯','🔴','🟠',
      '🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸',
      '🔹','🔺','🔻','💠','🔘','🔳','🔲','▪️','▫️','◾',
      '◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛',
      '⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢',
    ],
  },
  {
    name: 'Flags',
    icon: '🏁',
    emojis: [
      '🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
      '🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇪🇸','🇮🇹','🇯🇵','🇰🇷',
      '🇨🇳','🇧🇷','🇮🇳','🇲🇽','🇷🇺','🇿🇦','🇳🇬','🇪🇬','🇰🇪','🇦🇷',
      '🇨🇴','🇨🇱','🇵🇪','🇻🇪','🇵🇹','🇳🇱','🇧🇪','🇨🇭','🇸🇪','🇳🇴',
      '🇩🇰','🇫🇮','🇵🇱','🇦🇹','🇨🇿','🇷🇴','🇬🇷','🇹🇷','🇸🇦','🇦🇪',
      '🇮🇱','🇮🇷','🇹🇭','🇻🇳','🇮🇩','🇲🇾','🇸🇬','🇵🇭','🇳🇿','🇮🇪',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export function EmojiPicker({ onSelect, onClose, anchorRect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Small delay to avoid closing on the click that opens it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const category = EMOJI_CATEGORIES[activeCategory];

  const filteredEmojis = search.trim()
    ? category.emojis.filter((e) => e.includes(search.trim()))
    : category.emojis;

  // Position the picker below the toolbar button
  const pickerStyle: React.CSSProperties = anchorRect
    ? { position: 'fixed', top: anchorRect.bottom + 4, left: anchorRect.left, zIndex: 9999 }
    : { position: 'absolute', top: '100%', left: 0, zIndex: 9999 };

  return (
    <div ref={pickerRef} style={{ ...pickerStyle, backgroundColor: '#1a1a1a' }} className="emoji-picker">
      {/* Search */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
        <Search size={12} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emojis..."
          className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-0 px-1 py-1 border-b border-border overflow-x-auto emoji-picker-tabs">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => { setActiveCategory(i); setSearch(''); }}
            className={`px-1.5 py-0.5 text-sm rounded transition-colors shrink-0 ${
              i === activeCategory
                ? 'bg-accent'
                : 'hover:bg-accent/50 opacity-60 hover:opacity-100'
            }`}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="emoji-picker-grid p-1.5">
        {filteredEmojis.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-4">No emojis found</div>
        ) : (
          filteredEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="emoji-picker-item"
              title={emoji}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}