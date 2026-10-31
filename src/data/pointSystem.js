// ---------------------------------------------------------------------------
// The MCR point system, for the "Show point system" screen.
// Source: https://playmahjong.io/chinese-official-rules (Chinese Official Mahjong
// scoring rules as published there). Rule names, points, descriptions and
// "does not combine with" lists are taken from that page; Chinese names come from
// this app's scorer (src/engine/mcr/fanRules.js).
// ---------------------------------------------------------------------------

// { name, cn, points, description, notCombine: [names], notes: [text] }
export const SCORING_RULES = [
  {
    "name": "Pure Double Chow",
    "cn": "一般高",
    "points": 1,
    "description": "Two identical Chows in the same suit.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Mixed Double Chow",
    "cn": "喜相逢",
    "points": 1,
    "description": "Two Chows of the same numbers in different suits.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Short Straight",
    "cn": "连六",
    "points": 1,
    "description": "Two Chows that form a 6-tile straight.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Two Terminal Chows",
    "cn": "老少副",
    "points": 1,
    "description": "A Chow of 1,2,3 and a Chow of 7,8,9 in the same suit.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Pung of Terminals or Honors",
    "cn": "幺九刻",
    "points": 1,
    "description": "A Pung or Kong of 1's, 9's, or Winds that are not your Seat Wind or Prevalent Wind.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Melded Kong",
    "cn": "明杠",
    "points": 1,
    "description": "A Melded Kong.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "One Voided Suit",
    "cn": "缺一门",
    "points": 1,
    "description": "The hand has no tiles from a specific suit.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "No Honor Tiles",
    "cn": "无字",
    "points": 1,
    "description": "The hand has no Honor tiles.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Self Drawn",
    "cn": "自摸",
    "points": 1,
    "description": "The player wins by drawing the winning tile.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Flowers",
    "cn": "花牌",
    "points": 1,
    "description": "Each flower gives 1 point. These do not contribute to the requirement of 8 points.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Edge Wait",
    "cn": "边张",
    "points": 1,
    "description": "Winning on a 3 to form a Chow of 1,2,3 or a 7 to form a Chow of 7,8,9.",
    "notCombine": [],
    "notes": [
      "Only counts if you could win on just one type of tile (e.g. only on 1-Bamboo)."
    ]
  },
  {
    "name": "Closed Wait",
    "cn": "坎张",
    "points": 1,
    "description": "Winning on the middle tile of a Chow. For instance a 3 to form a Chow of 2,3,4.",
    "notCombine": [],
    "notes": [
      "Only counts if you could win on just one type of tile (e.g. only on 1-Bamboo)."
    ]
  },
  {
    "name": "Pair Wait",
    "cn": "单钓将",
    "points": 1,
    "description": "Winning on a tile to form a Pair.",
    "notCombine": [],
    "notes": [
      "Only counts if you could win on just one type of tile (e.g. only on 1-Bamboo)."
    ]
  },
  {
    "name": "Dragon Pung",
    "cn": "箭刻",
    "points": 2,
    "description": "A Pung or Kong of Dragons.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Prevalent Wind",
    "cn": "圈风刻",
    "points": 2,
    "description": "A Pung or Kong of the prevalent Wind.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Seat Wind",
    "cn": "门风刻",
    "points": 2,
    "description": "A Pung or Kong of the player's seat Wind.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Concealed Hand",
    "cn": "门前清",
    "points": 2,
    "description": "The hand has no melded sets and is won by discard.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "All Chows",
    "cn": "平和",
    "points": 2,
    "description": "The hand has four Chows and no Honors.",
    "notCombine": [
      "No Honor Tiles"
    ],
    "notes": []
  },
  {
    "name": "Tile Hog",
    "cn": "四归一",
    "points": 2,
    "description": "The player uses all 4 copies of a tile without using them as a Kong.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Double Pung",
    "cn": "双同刻",
    "points": 2,
    "description": "Two Pungs (or Kongs) of the same number but in different suits.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Two Concealed Pungs",
    "cn": "双暗刻",
    "points": 2,
    "description": "Two concealed Pungs or Kongs.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Concealed Kong",
    "cn": "暗杠",
    "points": 2,
    "description": "A concealed Kong.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "All Simples",
    "cn": "断幺",
    "points": 2,
    "description": "The hand is composed of only Simples (tiles that aren't Honors or 1's and 9's).",
    "notCombine": [
      "No Honor Tiles"
    ],
    "notes": []
  },
  {
    "name": "Outside Hand",
    "cn": "全带幺",
    "points": 4,
    "description": "Each group (triples and pair) includes a Terminal (1 or 9) or Honor tile.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Fully Concealed Hand",
    "cn": "不求人",
    "points": 4,
    "description": "The hand has four concealed groups and is won by self-draw.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Two Melded Kongs",
    "cn": "双明杠",
    "points": 4,
    "description": "Two Kongs. Note that this can combine with Concealed Kong for a total of 6 points.",
    "notCombine": [
      "Melded Kong"
    ],
    "notes": []
  },
  {
    "name": "Last of its Kind",
    "cn": "和绝张",
    "points": 4,
    "description": "Winning on the publicly last tile of its kind. This tile must be the last tile based on the visible discards and melds.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "All Pungs",
    "cn": "碰碰和",
    "points": 6,
    "description": "Four Pungs or Kongs and a pair.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Half Flush",
    "cn": "混一色",
    "points": 6,
    "description": "The hand is composed entirely of honors and a single suit.",
    "notCombine": [
      "One Voided Suit"
    ],
    "notes": []
  },
  {
    "name": "Mixed Shifted Chows",
    "cn": "三色三步高",
    "points": 6,
    "description": "Three chows in the 3 different suits, shifted up by 1.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "All Types",
    "cn": "五门齐",
    "points": 6,
    "description": "The player's hand contains a Bamboo tile, a Character tile, a Circle tile, a Dragon tile and a Wind tile.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Melded Hand",
    "cn": "全求人",
    "points": 6,
    "description": "Four melded groups and is won by discard.",
    "notCombine": [
      "Pair Wait"
    ],
    "notes": []
  },
  {
    "name": "Two Dragon Pungs",
    "cn": "双箭刻",
    "points": 6,
    "description": "Two Pungs or Kongs of Dragons",
    "notCombine": [
      "Dragon Pung"
    ],
    "notes": []
  },
  {
    "name": "Mixed Straight",
    "cn": "花龙",
    "points": 8,
    "description": "A Chow of 1,2,3, a Chow of 4,5,6 and a Chow of 7,8,9 in three different suits.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Reversible Tiles",
    "cn": "推不倒",
    "points": 8,
    "description": "The hand is composed of only Reversible (1,2,3,4,5,8,9 Circle; 2,4,5,6,8,9 Bamboo; White Dragon) tiles.",
    "notCombine": [
      "One Voided Suit"
    ],
    "notes": []
  },
  {
    "name": "Mixed Triple Chow",
    "cn": "三色三同顺",
    "points": 8,
    "description": "Three Chows of the same numbers in the 3 different suits.",
    "notCombine": [
      "Mixed Double Chow"
    ],
    "notes": []
  },
  {
    "name": "Mixed Shifted Pungs",
    "cn": "三色三节高",
    "points": 8,
    "description": "Three Pungs or Kongs in the three different suits, shifted up by one.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Two Concealed Kongs",
    "cn": "双暗杠",
    "points": 8,
    "description": "Two concealed Kongs.",
    "notCombine": [
      "Two Concealed Pungs",
      "Concealed Kong"
    ],
    "notes": []
  },
  {
    "name": "Last Tile Draw",
    "cn": "妙手回春",
    "points": 8,
    "description": "Winning by draw on the last tile of the wall.",
    "notCombine": [
      "Self Drawn"
    ],
    "notes": []
  },
  {
    "name": "Last Tile Claim",
    "cn": "海底捞月",
    "points": 8,
    "description": "Winning by discard after the last tile of the wall is drawn.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Out with Replacement Tile",
    "cn": "岭上开花",
    "points": 8,
    "description": "Winning on the replacement tile from declaring a Kong.",
    "notCombine": [
      "Self Drawn"
    ],
    "notes": []
  },
  {
    "name": "Robbing the Kong",
    "cn": "抢杠和",
    "points": 8,
    "description": "Winning off the tile that another player attempts to use to promote a Pung to a Kong.",
    "notCombine": [
      "Last of its Kind"
    ],
    "notes": []
  },
  {
    "name": "Chicken Hand",
    "cn": "无番和",
    "points": 8,
    "description": "Winning with a hand that would otherwise be worth 0 points other than flowers.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Lesser Honors and Knitted Tiles",
    "cn": "全不靠",
    "points": 12,
    "description": "The hand is entirely composed of single (unpaired) honors and single tiles from different knitted sequences. If this rule is satisfied, the player can win without the standard 4 triples and a pair.",
    "notCombine": [
      "Concealed Hand",
      "All Types"
    ],
    "notes": [
      "Knitted sequences are singles of 1,4,7 in one suit, 2,5,8 in a second suit and 3,6,9 in the third suit."
    ]
  },
  {
    "name": "Knitted Straight",
    "cn": "组合龙",
    "points": 12,
    "description": "Winning with a hand that has 1,4,7 in one suit, 2,5,8 in a second suit and 3,6,9 in the third suit. This knitted straight is considered to be 3 Chows for the requirement of 4 triples and a pair.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Upper Four",
    "cn": "大于五",
    "points": 12,
    "description": "The hand is composed of only suit tiles with numerical values of 6 or greater.",
    "notCombine": [
      "No Honor Tiles"
    ],
    "notes": []
  },
  {
    "name": "Lower Four",
    "cn": "小于五",
    "points": 12,
    "description": "The hand is composed of only suit tiles with numerical values of 4 or less.",
    "notCombine": [
      "No Honor Tiles"
    ],
    "notes": []
  },
  {
    "name": "Big Three Winds",
    "cn": "三风刻",
    "points": 12,
    "description": "Three Pungs or Kongs of Winds.",
    "notCombine": [
      "Pung of Terminals or Honors (Unless you have an additional non-wind Pung)"
    ],
    "notes": []
  },
  {
    "name": "Pure Straight",
    "cn": "清龙",
    "points": 16,
    "description": "A Chow of 1,2,3, Chow of 4,5,6 and Chow of 7,8,9 in the same suit.",
    "notCombine": [
      "Short Straight (Unless you have another copy of one of the Chows)",
      "Two Terminal Chows (Unless you have another copy of Chow 1,2,3 or Chow 7,8,9)"
    ],
    "notes": []
  },
  {
    "name": "Three-Suited Terminal Chows",
    "cn": "三色双龙会",
    "points": 16,
    "description": "A Chow of 1,2,3 and Chow of 7,8,9 in one suit, a Chow of 1,2,3 and Chow of 7,8,9 in another suit, and a Pair of 5's in the last suit.",
    "notCombine": [
      "Mixed Double Chow",
      "Two Terminal Chows",
      "No Honor Tiles",
      "All Chows"
    ],
    "notes": []
  },
  {
    "name": "Pure Shifted Chows",
    "cn": "一色三步高",
    "points": 16,
    "description": "Three Chows in a suit, each shifted up by one or two but not a combination of both.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "All Fives",
    "cn": "全带五",
    "points": 16,
    "description": "Each group (triples and pair) has a 5.",
    "notCombine": [
      "No Honor Tiles",
      "All Simples"
    ],
    "notes": []
  },
  {
    "name": "Triple Pung",
    "cn": "三色三同刻",
    "points": 16,
    "description": "Three pungs (or Kongs) of the same number but in the three different suits.",
    "notCombine": [
      "Double Pung"
    ],
    "notes": []
  },
  {
    "name": "Three Concealed Pungs",
    "cn": "三暗刻",
    "points": 16,
    "description": "Three concealed Pungs or Kongs.",
    "notCombine": [
      "Two Concealed Pungs"
    ],
    "notes": []
  },
  {
    "name": "Seven Pairs",
    "cn": "七对",
    "points": 24,
    "description": "Seven pairs. If this rule is satisfied, the player can win without the standard 4 triples and a pair.",
    "notCombine": [
      "Pair Wait",
      "Concealed Hand"
    ],
    "notes": []
  },
  {
    "name": "Greater Honors and Knitted Tiles",
    "cn": "七星不靠",
    "points": 24,
    "description": "The hand is composed of one of each honor and single tiles from different knitted sequences. If this rule is satisfied, the player can win without the standard 4 triples and a pair.",
    "notCombine": [
      "Concealed Hand",
      "All Types",
      "Lesser Honors and Knitted Tiles"
    ],
    "notes": []
  },
  {
    "name": "All Even Pungs",
    "cn": "全双刻",
    "points": 24,
    "description": "Four Pungs or Kongs and a pair of even suit tiles.",
    "notCombine": [
      "No Honor Tiles",
      "All Simples",
      "All Pungs"
    ],
    "notes": []
  },
  {
    "name": "Full Flush",
    "cn": "清一色",
    "points": 24,
    "description": "The hand is composed entirely of a single suit.",
    "notCombine": [
      "One Voided Suit",
      "No Honor Tiles",
      "Half Flush"
    ],
    "notes": []
  },
  {
    "name": "Pure Triple Chow",
    "cn": "一色三同顺",
    "points": 24,
    "description": "Three identical Chows in the same suit.",
    "notCombine": [
      "Pure Double Chow"
    ],
    "notes": []
  },
  {
    "name": "Pure Shifted Pungs",
    "cn": "一色三节高",
    "points": 24,
    "description": "Three Pungs or Kongs in the same suit, shifted up by one.",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Upper Tiles",
    "cn": "全大",
    "points": 24,
    "description": "The hand is composed of only suit tiles with numerical values of 7 or greater.",
    "notCombine": [
      "No Honor Tiles",
      "Upper Four"
    ],
    "notes": []
  },
  {
    "name": "Middle Tiles",
    "cn": "全中",
    "points": 24,
    "description": "The hand is composed of only suit tiles with numerical values of 4, 5, 6.",
    "notCombine": [
      "No Honor Tiles",
      "All Simples"
    ],
    "notes": []
  },
  {
    "name": "Lower Tiles",
    "cn": "全小",
    "points": 24,
    "description": "The hand is composed of only suit tiles with numerical values of 3 or less.",
    "notCombine": [
      "No Honor Tiles",
      "Lower Four"
    ],
    "notes": []
  },
  {
    "name": "Four Shifted Chows",
    "cn": "一色四步高",
    "points": 32,
    "description": "Four Chows in a suit, each shifted up by one or two but not a combination of both.",
    "notCombine": [
      "Short Straight",
      "Pure Shifted Chows"
    ],
    "notes": []
  },
  {
    "name": "Three Kongs",
    "cn": "三杠",
    "points": 32,
    "description": "Three Kongs (either melded or concealed).",
    "notCombine": [
      "Melded Kong",
      "Two Melded Kongs"
    ],
    "notes": []
  },
  {
    "name": "All Terminals and Honors",
    "cn": "混幺九",
    "points": 32,
    "description": "The hand is composed entirely of Terminal (1 or 9) and Honor tiles.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "Outside Hand",
      "All Pungs"
    ],
    "notes": []
  },
  {
    "name": "Quadruple Chow",
    "cn": "一色四同顺",
    "points": 48,
    "description": "Four identical Chows in the same suit.",
    "notCombine": [
      "Pure Double Chow",
      "Tile Hog",
      "Pure Triple Chow"
    ],
    "notes": []
  },
  {
    "name": "Four Pure Shifted Pungs",
    "cn": "一色四节高",
    "points": 48,
    "description": "Four Pungs or Kongs in the same suit, shifted up by one.",
    "notCombine": [
      "All Pungs",
      "Pure Shifted Pungs"
    ],
    "notes": []
  },
  {
    "name": "All Terminals",
    "cn": "清幺九",
    "points": 64,
    "description": "The hand is composed entirely of Terminal (1 or 9) tiles.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "No Honor Tiles",
      "Outside Hand",
      "All Pungs",
      "All Terminals and Honors"
    ],
    "notes": []
  },
  {
    "name": "All Honors",
    "cn": "字一色",
    "points": 64,
    "description": "The hand is composed entirely of Honor tiles.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "One Voided Suit",
      "Outside Hand",
      "All Pungs",
      "All Terminals and Honors"
    ],
    "notes": []
  },
  {
    "name": "Little Four Winds",
    "cn": "小四喜",
    "points": 64,
    "description": "Three Pungs or Kongs of Winds and a pair of the last Wind.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "Big Three Winds"
    ],
    "notes": []
  },
  {
    "name": "Little Three Dragons",
    "cn": "小三元",
    "points": 64,
    "description": "Two Pungs or Kongs of Dragons and a pair of the last Dragon.",
    "notCombine": [
      "Dragon Pung",
      "Two Dragon Pungs"
    ],
    "notes": []
  },
  {
    "name": "Four Concealed Pungs",
    "cn": "四暗刻",
    "points": 64,
    "description": "Four concealed Pungs or Kongs",
    "notCombine": [
      "Concealed Hand",
      "Two Concealed Pungs",
      "All Pungs",
      "Three Concealed Pungs"
    ],
    "notes": []
  },
  {
    "name": "Pure Terminal Chows",
    "cn": "一色双龙会",
    "points": 64,
    "description": "Two Chows of 1,2,3, two Chows of 7,8,9 and a pair of 5's in one suit.",
    "notCombine": [
      "Pure Double Chow",
      "Two Terminal Chows",
      "One Voided Suit",
      "All Chows",
      "Half Flush",
      "Full Flush"
    ],
    "notes": []
  },
  {
    "name": "Big Four Winds",
    "cn": "大四喜",
    "points": 88,
    "description": "Four Pungs or Kongs of Winds.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "Prevalent Wind",
      "Seat Wind",
      "All Pungs",
      "Big Three Winds"
    ],
    "notes": []
  },
  {
    "name": "Big Three Dragons",
    "cn": "大三元",
    "points": 88,
    "description": "Three Pungs or Kongs of Dragons.",
    "notCombine": [
      "Dragon Pung",
      "Two Dragon Pungs"
    ],
    "notes": []
  },
  {
    "name": "All Green",
    "cn": "绿一色",
    "points": 88,
    "description": "The hand is composed entirely of green tiles (2,3,4,6,8 Bamboo; Green Dragon).",
    "notCombine": [],
    "notes": []
  },
  {
    "name": "Nine Gates",
    "cn": "九莲宝灯",
    "points": 88,
    "description": "The hand is concealed and has 1,1,1,2,3,4,5,6,7,8,9,9,9 in one suit and a 14th tile in the suit.",
    "notCombine": [
      "Pung of Terminals or Honors",
      "One Voided Suit",
      "Concealed Hand",
      "Half Flush",
      "Full Flush"
    ],
    "notes": []
  },
  {
    "name": "Four Kongs",
    "cn": "四杠",
    "points": 88,
    "description": "Four Kongs (either melded or concealed).",
    "notCombine": [
      "Melded Kong",
      "Pair Wait",
      "Two Melded Kongs",
      "All Pungs",
      "Three Kongs"
    ],
    "notes": []
  },
  {
    "name": "Seven Shifted Pairs",
    "cn": "连七对",
    "points": 88,
    "description": "Seven pairs in one suit, shifted up by one.",
    "notCombine": [
      "One Voided Suit",
      "No Honor Tiles",
      "Pair Wait",
      "Concealed Hand",
      "Half Flush",
      "Seven Pairs",
      "Full Flush"
    ],
    "notes": []
  },
  {
    "name": "Thirteen Orphans",
    "cn": "十三幺",
    "points": 88,
    "description": "One of each Honor and Terminal (1 or 9) tile, and a second copy of any Honor or Terminal tile.",
    "notCombine": [
      "Concealed Hand",
      "Outside Hand",
      "All Types",
      "All Terminals and Honors"
    ],
    "notes": []
  }
];

// How a hand is scored and paid.
export const SCORING_GUIDE = {
  basics: [
    'A winning hand is 4 sets (pungs, kongs or chows) and a pair, or one of the special hands (Seven Pairs, Seven Shifted Pairs, Thirteen Orphans, Lesser or Greater Honors and Knitted Tiles). No particular sets are required.',
    'It must be worth at least 8 points to win. Points from flowers do not count toward the 8.',
    'Add up every scoring rule the hand meets, following the principles below. The winner always gets the arrangement that scores the most.',
  ],
  payments: {
    rule: 'When someone wins, every other player pays the winner 8 points. On top of that, the hand\'s value is paid by the player who threw the winning tile (win off a discard), or by every other player (self-drawn win).',
    examples: [
      { title: 'A 12-point hand won off Player 2\'s discard', lines: ['Player 1 gains 8×3 + 12 = 36', 'Player 2 loses 8 + 12 = 20', 'Player 3 loses 8', 'Player 4 loses 8'] },
      { title: 'A 12-point hand won by self-draw', lines: ['Player 1 gains 8×3 + 12×3 = 60', 'Players 2, 3 and 4 each lose 8 + 12 = 20'] },
    ],
  },
  principles: [
    { name: 'Non-Repeat', text: 'A rule that is implied by another rule is not scored again.', example: 'All Even Pungs scores its points, but not All Pungs on top.' },
    { name: 'Non-Separation', text: 'Once tiles are grouped to score a rule, they can\'t be regrouped to score a different rule.', example: 'Three copies of 1-2-3 Bamboo count as three chows (Pure Triple Chow) or three pungs (Pure Shifted Pungs), not both.' },
    { name: 'Non-Identical', text: 'One set can\'t be used to score the same rule twice.', example: '1-2-3, 4-5-6 and two 7-8-9 chows in Circles score Pure Straight once, not twice.' },
    { name: 'Freedom to Choose', text: 'You choose how the tiles are grouped to get the most points.', example: 'The app always picks the highest-scoring arrangement.' },
    { name: 'Exclusionary Rule', text: 'Sets can be used for more than one rule, but each set at most twice. Rules like All Honors, All Pungs or All Chows describe the whole hand and don\'t use up sets.', example: 'Mixed Shifted Chows with a repeated chow scores 6, plus 1 for Pure Double Chow. This principle rarely changes a score.' },
  ],
};
