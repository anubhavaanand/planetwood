// Quest & dialogue data reverse-engineered from messenger.abeto.co bundle.
// Each quest is an ordered chain of steps. A step belongs to an NPC id and
// carries the dialogue texts plus optional delivery/receive data.
export const QUESTS = [
  {
    id: 'quest-employee',
    description: 'Falling off the corporate ladder',
    color: '#c25959',
    icon: 'ui/quests/house.icon',
    steps: [
      {
        id: 'office-worker-2',
        npc: 'office-worker',
        ordered: true,
        texts: [
          "Thank god you're here! I sent a letter to my boss earlier, but I need to get it back before he sees it...",
          "He lives at the red cliff house. Do you think he's read it yet?",
        ],
        extraData: {
          uiTitle: 'Next Up',
          uiText: "Find the red cliff house and get the letter back",
          uiColor: '#c25959',
        },
      },
      {
        id: 'boss',
        npc: 'boss',
        ordered: true,
        texts: [
          "One of my employees wrote this? I can't believe it... this... is...",
          "...hilarious. Wow, he's really roasting me. Maybe he's manager material after all...",
          "Can you take this note back to him? He works in the main square.",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the boss's note to the office worker in the main square",
          uiColor: '#c25959',
          receiveModel: 'deliveries/note.drc',
        },
      },
      {
        id: 'office-worker-2',
        npc: 'office-worker',
        ordered: true,
        texts: [
          "I'm getting... promoted?",
          "Wow, who would have known that acting on my lowest instincts would help me advance in the corporate world.",
        ],
        extraData: {
          uiTitle: 'Completed',
          uiText: 'Congrats! Another successful delivery completed.',
          uiColor: '#c25959',
        },
      },
    ],
  },
  {
    id: 'quest-caveman',
    description: "A man who's hiding from something",
    color: '#f3c258',
    icon: 'ui/quests/flowerlady.icon',
    steps: [
      {
        id: 'caveman',
        npc: 'caveman',
        ordered: true,
        texts: [
          "Hey there! Can you please take this postcard to my wife? She sells flowers in the main square.",
          "I'd give it to her myself but I... uh... have a bad knee at the moment...",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the cave man's postcard to the woman in the main square",
          uiColor: '#f3c258',
          receiveModel: 'deliveries/postcard.drc',
        },
      },
      {
        id: 'flower-lady',
        npc: 'young-lady',
        ordered: true,
        texts: [
          "Oh, a postcard from my husband!",
          "He's on an overseas business trip at the moment, visiting all kinds of exotic places!",
          "Look, between you and me, I know he's living in a cave in the forest... I hope his midlife crisis passes soon...",
          "Would you mind bringing him these clean clothes? Don't say they're from me. Just tell him he won a prize.",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the clean clothes to the man in the cave",
          uiColor: '#f3c258',
          receiveModel: 'deliveries/clothes.drc',
        },
      },
      {
        id: 'caveman',
        npc: 'caveman',
        ordered: true,
        texts: [
          "Wow, another prize?",
          "Just in time, too. I'm down to my last pair of underwear.",
        ],
        extraData: {
          uiTitle: 'Completed',
          uiText: 'Congrats! Another successful delivery completed.',
          uiColor: '#f3c258',
        },
      },
    ],
  },
  {
    id: 'quest-scientists',
    description: 'Scientists and mixed-up deliveries',
    color: '#66BDE6',
    icon: 'ui/quests/frieb.icon',
    steps: [
      {
        id: 'factory-worker-a',
        npc: 'factory-worker-a',
        ordered: true,
        texts: [
          "Hey, can you help me with something? We're short on staff lately and, well, some of our mail went to the wrong address by mistake...",
          "Go find Doctor Frieb and see if he's received any packages lately. He lives at the base of the mountain temple.",
        ],
        extraData: {
          uiTitle: 'Next Up',
          uiText: "Find Doctor Frieb at the base of the mountain temple",
          uiColor: '#66BDE6',
        },
      },
      {
        id: 'male-scientist',
        npc: 'male-scientist',
        ordered: true,
        texts: [
          'Hello! Yes, I opened some mail by mistake earlier. A "planet gravity data analysis", or something...',
          "They probably mixed me up with Doctor Frebi at Capital Corp...",
          "...wait, does that mean MY ORDER went to Dr Frebi? Oh no!!!",
          "I... uh... ordered the wrong thing anyway... Tell her I don't need it anymore...",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the gravity data analysis to Doctor Frebi at Capital Corp",
          uiColor: '#66BDE6',
          receiveModel: 'deliveries/samplebox.drc',
        },
      },
      {
        id: 'female-scientist',
        npc: 'female-scientist',
        ordered: true,
        texts: [
          "Oh hey, you work for the delivery company? I've been meaning to talk to you guys...",
          "Do you know why I received 63 packets of instant noodles? Was that meant to go to the grocery store or something?",
          "You don't know anything about that? Oh well. Thanks for the package.",
        ],
        extraData: {
          uiTitle: 'Completed',
          uiText: 'Congrats! Another successful delivery completed.',
          uiColor: '#66BDE6',
        },
      },
    ],
  },
  {
    id: 'quest-temple',
    description: 'An offering to the mountain temple',
    color: '#8cc48c',
    icon: 'ui/quests/temple.icon',
    steps: [
      {
        id: 'oldwoman',
        npc: 'oldwoman',
        ordered: true,
        texts: [
          "Excuse me, could you please take this offering up to the mountain temple for me?",
          "I have trouble making it up the slope by myself these days.",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the old woman's offering to the mountain temple",
          uiColor: '#8cc48c',
          receiveModel: 'deliveries/offering.drc',
        },
      },
      {
        id: 'mountainman',
        npc: 'mountainman',
        ordered: true,
        texts: [
          "Oh, pastries and sake?",
          "My favourite.",
        ],
        extraData: {
          uiTitle: 'Completed',
          uiText: 'Congrats! Another successful delivery completed.',
          uiColor: '#8cc48c',
        },
      },
    ],
  },
  {
    id: 'quest-musician',
    description: 'A note lost at sea',
    color: '#de794e',
    icon: 'ui/quests/musician.icon',
    steps: [
      {
        id: 'diver',
        npc: 'diver',
        ordered: true,
        texts: [
          "Check this out! I was diving for oysters earlier and found these old lock boxes buried in the sand.",
          "One of them had a letter inside. It's a bit wet, but I can make out the name Dave at the top.",
          "Pretty crazy huh? I know a guy called Dave. Do you think it could be the same one?",
          "He's probably down at smelly falls, if you want to take it to him.",
        ],
        extraData: {
          uiTitle: 'Package Received',
          uiText: "Take the mystery letter to Dave at Smelly Falls",
          uiColor: '#de794e',
          receiveModel: 'deliveries/letterwet.drc',
        },
      },
      {
        id: 'musician',
        npc: 'musician',
        ordered: true,
        texts: [
          "A letter for me? From under the sea? The one who wrote it... is me!",
          "Let's see what I wrote to myself all those years ago...",
          '"Dear Future Dave..."',
          '"Keep practicing every day..."',
          '"Get plenty of sunshine..."',
          '"Take care of your hair. Let it grow wild and free. Your hair is your soul and the most defining feature of your personality."',
          'Well...',
          '...two out of three ain\'t bad.',
        ],
        extraData: {
          uiTitle: 'Completed',
          uiText: 'Congrats! Another successful delivery completed.',
          uiColor: '#de794e',
        },
      },
    ],
  },
];

// Display names used in the messenger checklist header line for each quest.
export const QUEST_LABELS = {
  'quest-employee': 'Falling off the corporate ladder (0/3)',
  'quest-caveman': "A man who's hiding from something (0/3)",
  'quest-scientists': 'Scientists and mixed-up deliveries (0/3)',
  'quest-temple': "An offering to the mountain temple (0/2)",
  'quest-musician': "A note lost at sea (0/2)",
};

// NPC -> npcType mapping used by NPCSystem._extractNPCData, so quests can find
// the matching in-world NPC entity.
export const QUEST_NPC_TYPES = {
  'office-worker-2': 'office-worker',
  'boss': 'boss',
  'caveman': 'caveman',
  'flower-lady': 'young-lady',
  'factory-worker-a': 'factory-worker-a',
  'male-scientist': 'male-scientist',
  'female-scientist': 'female-scientist',
  'oldwoman': 'oldwoman',
  'mountainman': 'mountainman',
  'diver': 'diver',
  'musician': 'musician',
};
