type ConstructorName =
  | "alpine"
  | "aston"
  | "ferrari"
  | "haas"
  | "kick"
  | "mclaren"
  | "mercedes"
  | "redbull"
  | "williams"
  | "vcarb"
  | "reserve"
  | "decline"
  | "tentative";
interface Constructor {
  name: ConstructorName;
  emoji: string;
  displayName: string;
}
const Constructors: Record<ConstructorName, Constructor> = {
  alpine: {
    name: "alpine",
    emoji: "<:alpine:1299419733895942255>",
    displayName: "Alpine",
  },
  aston: {
    name: "aston",
    emoji: "<:aston:1299419776233373828>",
    displayName: "Aston Martin",
  },
  ferrari: {
    name: "ferrari",
    emoji: "<:ferrari:1299419871922098299>",
    displayName: "Ferrari",
  },
  haas: {
    name: "haas",
    emoji: "<:haas:1299419901361918126>",
    displayName: "HAAS",
  },
  kick: {
    name: "kick",
    emoji: "<:kick:1299419919246561300>",
    displayName: "Kick Sauber",
  },
  mclaren: {
    name: "mclaren",
    emoji: "<:mclaren:1299419975831916667>",
    displayName: "McLaren",
  },
  mercedes: {
    name: "mercedes",
    emoji: "<:mercedes:1299420016323596339>",
    displayName: "Mercedes",
  },
  redbull: {
    name: "redbull",
    emoji: "<:redbull:1299420037312024689>",
    displayName: "Red Bull",
  },
  williams: {
    name: "williams",
    emoji: "<:williams:1299420064214286386>",
    displayName: "Williams",
  },
  vcarb: {
    name: "vcarb",
    emoji: "<:vcarb:1299420082748784680>",
    displayName: "VCARB",
  },
  reserve: {
    name: "reserve",
    emoji: "🆓",
    displayName: "Reserve",
  },
  decline: {
    name: "decline",
    emoji: "❌",
    displayName: "Decline",
  },
  tentative: {
    name: "tentative",
    emoji: "<:tentative:1299432097194315807>",
    displayName: "Tentative",
  },
};
export { Constructors }; // Exporting the Constructors object for use in other modules.
