type TrackName =
    | "abu_dhabi"
    | "australia"
    | "austria"
    | "azerbaijan"
    | "bahrain"
    | "belgium"
    | "brazil"
    | "canada"
    | "cota"
    | "china"
    | "great_britain"
    | "hungary"
    | "imola"
    | "japan"
    | "las_vegas"
    | "mexico"
    | "miami"
    | "monaco"
    | "monza"
    | "netherlands"
    | "portugal"
    | "qatar"
    | "saudi_arabia"
    | "singapore"
    | "spain";

interface TrackInfo {
    name: TrackName;
    displayName: string;
    length: number; // in kilometers
    image: string; // URL to the image of the track
}

const Tracks: Record<TrackName, TrackInfo> = {
    abu_dhabi: {
        name: "abu_dhabi",
        displayName: "Abu Dhabi 🇦🇪",
        length: 5.554,
        image: "Abu_Dhabi_Circuit.png",
    },
    australia: {
        name: "australia",
        displayName: "Australia 🇦🇺",
        length: 5.278,
        image: "Australia_Circuit.png",
    },
    austria: {
        name: "austria",
        displayName: "Austria 🇦🇹",
        length: 4.318,
        image: "Austria_Circuit.png",
    },
    azerbaijan: {
        name: "azerbaijan",
        displayName: "Azerbaijan 🇦🇿",
        length: 6.003,
        image: "Baku_Circuit.png",
    },
    bahrain: {
        name: "bahrain",
        displayName: "Bahrain 🇧🇭",
        length: 5.412,
        image: "Bahrain_Circuit.png",
    },
    belgium: {
        name: "belgium",
        displayName: "Belgium 🇧🇪",
        length: 7.004,
        image: "Belgium_Circuit.png",
    },
    brazil: {
        name: "brazil",
        displayName: "Brazil 🇧🇷",
        length: 4.309,
        image: "Brazil_Circuit.png",
    },
    canada: {
        name: "canada",
        displayName: "Canada 🇨🇦",
        length: 4.361,
        image: "Canada_Circuit.png",
    },
    cota: {
        name: "cota",
        displayName: "C.O.T.A. 🇺🇸",
        length: 5.513,
        image: "USA_Circuit.png",
    },
    china: {
        name: "china",
        displayName: "China 🇨🇳",
        length: 5.451,
        image: "China_Circuit.png",
    },
    great_britain: {
        name: "great_britain",
        displayName: "Great Britain 🇬🇧",
        length: 5.891,
        image: "Great_Britain_Circuit.png",
    },
    hungary: {
        name: "hungary",
        displayName: "Hungary 🇭🇺",
        length: 4.381,
        image: "Hungary_Circuit.png",
    },
    imola: {
        name: "imola",
        displayName: "Imola 🇸🇲",
        length: 4.909,
        image: "Emilia_Romagna_Circuit.png",
    },
    japan: {
        name: "japan",
        displayName: "Japan 🇯🇵",
        length: 5.807,
        image: "Japan_Circuit.png",
    },
    las_vegas: {
        name: "las_vegas",
        displayName: "Las Vegas 🇺🇸",
        length: 6.201,
        image: "Las_Vegas_Circuit.png",
    },
    mexico: {
        name: "mexico",
        displayName: "Mexico 🇲🇽",
        length: 4.304,
        image: "Mexico_Circuit.png",
    },
    miami: {
        name: "miami",
        displayName: "Miami 🇺🇸",
        length: 5.412,
        image: "Miami_Circuit.png",
    },
    monaco: {
        name: "monaco",
        displayName: "Monaco 🇲🇨",
        length: 3.337,
        image: "Monaco_Circuit.png",
    },
    monza: {
        name: "monza",
        displayName: "Monza 🇮🇹",
        length: 5.793,
        image: "Italy_Circuit.png",
    },
    netherlands: {
        name: "netherlands",
        displayName: "Netherlands 🇳🇱",
        length: 4.259,
        image: "Netherlands_Circuit.png",
    },
    portugal: {
        name: "portugal",
        displayName: "Portugal 🇵🇹",
        length: 4.684,
        image: "Portugal_Circuit.png",
    },
    qatar: {
        name: "qatar",
        displayName: "Qatar 🇶🇦",
        length: 5.403,
        image: "Qatar_Circuit.png",
    },
    saudi_arabia: {
        name: "saudi_arabia",
        displayName: "Saudi Arabia 🇸🇦",
        length: 6.174,
        image: "Saudi_Arabia_Circuit.png",
    },
    singapore: {
        name: "singapore",
        displayName: "Singapore 🇸🇬",
        length: 5.063,
        image: "Singapore_Circuit.png",
    },
    spain: {
        name: "spain",
        displayName: "Spain 🇪🇸",
        length: 4.655,
        image: "Spain_Circuit.png",
    },
};
export { Tracks };
export type { TrackInfo, TrackName }; // Exporting the types for use in other files
