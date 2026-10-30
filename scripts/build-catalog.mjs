import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The seed is intentionally editorial data, not scraped or live availability.
const destinations = [
  {
    id: "bali",
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    region: "Asia",
    tagline: "A little closer to paradise.",
    description:
      "Beyond the familiar coastline, Bali moves to its own rhythm. Follow the morning mist through rice terraces, share a meal in a family compound, and find a quieter kind of beautiful along the island’s eastern shore.",
    heroImage: "/images/bali.jpg",
    lat: -8.5069,
    lng: 115.2625,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    tags: ["Nature", "Wellness", "Culture"],
    embedText:
      "Ubud is a base for rice terraces and Balinese art. Tegallalang terraces are north of Ubud. Campuhan Ridge is an easy sunrise walk. Tirta Empul is a sacred water temple with dress requirements. Dry season is generally April to October. Allow road transfer buffers; traffic is slow. Ask before photographing ceremonies.",
    color: "#81977b",
    startingPrice: 890,
    reading: "The island of a thousand beginnings",
    bestSeason: "April – October",
    timezone: "Asia/Makassar",
  },
  {
    id: "kyoto",
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    region: "Asia",
    tagline: "Find beauty in the in-between.",
    description:
      "A lantern-lit lane. The quiet of a moss garden. Tea poured with intention. Kyoto rewards the traveler who slows down, following the seasons from hillside shrines to its small neighborhood kitchens.",
    heroImage: "/images/kyoto.jpg",
    lat: 35.0116,
    lng: 135.7681,
    bestMonths: [3, 4, 5, 10, 11],
    tags: ["Culture", "Food", "Slow travel"],
    embedText:
      "Fushimi Inari is a shrine with torii gates; visit early and respect worshippers. Arashiyama bamboo grove is in western Kyoto. Nishiki Market offers food stalls; eat at designated areas. Spring and autumn are popular. Use public transport and allow cross-city travel time. Do not enter private lanes in Gion.",
    color: "#b68075",
    startingPrice: 1450,
    reading: "A thousand quiet moments",
    bestSeason: "March – May · October – November",
    timezone: "Asia/Tokyo",
  },
  {
    id: "amalfi",
    slug: "amalfi-coast",
    name: "Amalfi Coast",
    country: "Italy",
    region: "Europe",
    tagline: "Take the scenic way home.",
    description:
      "Lemon groves spill down to a blue that hardly seems real. Between cliffside villages and long lunches, discover a coast best enjoyed at the speed of an afternoon espresso.",
    heroImage: "/images/amalfi.jpg",
    lat: 40.634,
    lng: 14.6027,
    bestMonths: [4, 5, 6, 9, 10],
    tags: ["Coast", "Food", "Romance"],
    embedText:
      "Positano is a steep hillside coastal town. Ravello has gardens and views; verify Villa Rufolo tickets. Path of the Gods starts near Bomerano and is exposed and uneven; avoid heat and check trail conditions. Ferries are seasonal and weather dependent. May, June, September and October are generally pleasant.",
    color: "#8ea8ac",
    startingPrice: 1690,
    reading: "The art of doing very little",
    bestSeason: "April – June · September – October",
    timezone: "Europe/Rome",
  },
  {
    id: "ella",
    slug: "sri-lanka",
    name: "Sri Lanka",
    country: "Sri Lanka",
    region: "Asia",
    tagline: "Wild at heart. Warm by nature.",
    description:
      "Take the slow train into tea country, watch the hills turn gold, and make time for a conversation over a cup of freshly brewed Ceylon tea. A small island with an extraordinary sense of possibility.",
    heroImage: "/images/srilanka.jpg",
    lat: 6.8667,
    lng: 81.0466,
    bestMonths: [1, 2, 3, 4, 7, 8],
    tags: ["Adventure", "Nature", "Slow travel"],
    embedText:
      "Ella is a hill-country base. Nine Arch Bridge is an active railway bridge; observe from safe public viewpoints and stay off tracks. Little Adams Peak is a hill walk with stairs. Ravana Falls is a roadside waterfall; avoid unsafe swimming. Hill weather varies. Reserve rail seats ahead and verify train schedules.",
    color: "#71876c",
    startingPrice: 690,
    reading: "Let the island surprise you",
    bestSeason: "January – April · July – August",
    timezone: "Asia/Colombo",
  },
  {
    id: "algarve",
    slug: "algarve",
    name: "The Algarve",
    country: "Portugal",
    region: "Europe",
    tagline: "Stay a little longer.",
    description:
      "Sea-carved cliffs, salt in the air, and fishing villages with nothing to prove. Find your own stretch of Atlantic coast, from a morning walk to a table set with the day’s catch.",
    heroImage: "/images/algarve.jpg",
    lat: 37.1028,
    lng: -8.673,
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    tags: ["Coast", "Adventure", "Slow travel"],
    embedText:
      "Ponta da Piedade has coastal viewpoints near Lagos; remain on marked paths. Praia Dona Ana is a beach below cliffs; observe tides and cliff warnings. Lagos old town has walkable streets and local restaurants. Ocean activities depend on wind and sea conditions. Cave access may be restricted; verify with local operators.",
    color: "#c2a579",
    startingPrice: 1090,
    reading: "An Atlantic state of mind",
    bestSeason: "April – October",
    timezone: "Europe/Lisbon",
  },
  {
    id: "iceland",
    slug: "iceland",
    name: "Iceland",
    country: "Iceland",
    region: "Europe",
    tagline: "Go where you feel small.",
    description:
      "Waterfalls tumble from ancient cliffs. Black sand meets the North Atlantic. Out here, the landscape writes the itinerary—and every turn reminds you how much of the world is still wonderfully wild.",
    heroImage: "/images/iceland.jpg",
    lat: 63.5321,
    lng: -19.5114,
    bestMonths: [6, 7, 8, 9],
    tags: ["Adventure", "Nature", "Road trip"],
    embedText:
      "Skogafoss is a waterfall near the Ring Road. Seljalandsfoss access behind the waterfall can close due to ice. Reynisfjara is a black sand beach with dangerous sneaker waves; stay well back and follow warning lights. June to September generally allows easier driving. Check road.is and vedur.is before travel.",
    color: "#738d91",
    startingPrice: 1890,
    reading: "A world of its own",
    bestSeason: "June – September",
    timezone: "Atlantic/Reykjavik",
  },
];
const places = {
  bali: [
    [
      "Tegallalang Rice Terraces",
      "Nature",
      -8.434,
      115.279,
      "Walk the terraced hills with a local guide. Ask permission before entering working fields.",
    ],
    [
      "Campuhan Ridge",
      "Hike",
      -8.499,
      115.253,
      "An easy ridge walk, best enjoyed in the cooler early morning.",
    ],
    [
      "Tirta Empul Temple",
      "Culture",
      -8.415,
      115.316,
      "A sacred water temple. Wear appropriate clothing and follow local guidance.",
    ],
  ],
  kyoto: [
    [
      "Fushimi Inari Shrine",
      "Culture",
      34.9671,
      135.7727,
      "Follow the torii-lined paths, respecting worshippers and photography signs.",
    ],
    [
      "Arashiyama Bamboo Grove",
      "Nature",
      35.0094,
      135.6668,
      "A bamboo-lined path in western Kyoto. Visit early for a quieter experience.",
    ],
    [
      "Nishiki Market",
      "Food",
      35.005,
      135.7649,
      "Explore Kyoto’s pantry and eat at the designated stalls.",
    ],
  ],
  amalfi: [
    [
      "Positano",
      "Coast",
      40.6281,
      14.4845,
      "Explore winding lanes and seaside viewpoints. Expect plenty of stairs.",
    ],
    [
      "Ravello",
      "Culture",
      40.6493,
      14.6117,
      "A hilltop village of gardens and far-reaching coastal views.",
    ],
    [
      "Path of the Gods",
      "Hike",
      40.6296,
      14.5395,
      "An exposed coastal trail from Bomerano. Check conditions and carry water.",
    ],
  ],
  ella: [
    [
      "Nine Arch Bridge viewpoint",
      "Culture",
      6.8769,
      81.0608,
      "Enjoy the bridge from safe public viewpoints. Stay off active tracks.",
    ],
    [
      "Little Adam’s Peak",
      "Hike",
      6.8652,
      81.063,
      "A hill walk through tea country with stairs and wide views.",
    ],
    [
      "Ravana Falls",
      "Nature",
      6.8409,
      81.0545,
      "Use the viewing area and follow safety signs. Avoid unsafe swimming.",
    ],
  ],
  algarve: [
    [
      "Ponta da Piedade",
      "Nature",
      37.0813,
      -8.6693,
      "Follow marked boardwalks above sculpted sandstone cliffs.",
    ],
    [
      "Praia Dona Ana",
      "Coast",
      37.0911,
      -8.6699,
      "A beach below tall cliffs. Check tides and cliff warnings.",
    ],
    [
      "Lagos Old Town",
      "Food",
      37.1018,
      -8.6742,
      "Whitewashed lanes, tiled facades, and small seafood restaurants.",
    ],
  ],
  iceland: [
    [
      "Skógafoss",
      "Nature",
      63.5321,
      -19.5114,
      "A powerful waterfall with a marked viewing area and steps.",
    ],
    [
      "Seljalandsfoss",
      "Nature",
      63.6156,
      -19.9886,
      "Seasonal footpath access. Check ice closures.",
    ],
    [
      "Reynisfjara",
      "Coast",
      63.4044,
      -19.0446,
      "A black-sand beach. Stay well away from the water and obey wave warnings.",
    ],
  ],
};
const pois = destinations.flatMap((d) =>
  places[d.id].map(([name, kind, lat, lng, description], i) => ({
    id: `${d.id}-p${i + 1}`,
    destinationId: d.id,
    name,
    kind,
    lat,
    lng,
    description,
  })),
);
const activities = [
  [
    "ubud-rice-and-roots",
    "Rice fields & Balinese roots",
    "A morning walk with a local host and a hands-on introduction to Balinese cooking.",
    4,
    65,
    "Easy",
  ],
  [
    "kyoto-tea-and-tradition",
    "The quiet art of tea",
    "Discover the rituals behind a cup of matcha in an intimate, host-led tea session.",
    2,
    85,
    "Easy",
  ],
  [
    "amalfi-lemon-table",
    "At the lemon farmer’s table",
    "Wander a family lemon grove and prepare a seasonal lunch overlooking the sea.",
    3.5,
    110,
    "Easy",
  ],
  [
    "ella-tea-trails",
    "Tea trails & hilltop stories",
    "Walk through tea country with a local guide and discover the island’s tea traditions.",
    4,
    45,
    "Moderate",
  ],
  [
    "algarve-coastal-walk",
    "Along the Atlantic edge",
    "A guided walk on marked coastal trails with a picnic of local flavors.",
    3,
    55,
    "Moderate",
  ],
  [
    "iceland-waterfall-trail",
    "Chasing waterfalls",
    "Explore the south coast with a driver-guide, with time to linger at each stop.",
    8,
    195,
    "Moderate",
  ],
];
const experiences = destinations.map((d, i) => {
  const [slug, title, summary, durationHours, priceFrom, difficulty] =
    activities[i];
  return {
    id: `${d.id}-e1`,
    destinationId: d.id,
    slug,
    title,
    summary,
    durationHours,
    priceFrom,
    difficulty,
    imageUrl: d.heroImage,
  };
});
const journeys = [
  [
    "bali-beyond-the-ordinary",
    "Bali, beyond the ordinary",
    7,
    "THE SLOW ESCAPE",
  ],
  ["kyoto-in-good-time", "Kyoto, in good time", 5, "CULTURAL IMMERSION"],
  ["the-amalfi-state-of-mind", "The Amalfi state of mind", 6, "COASTAL LIVING"],
  ["sri-lanka-the-slow-way", "Sri Lanka, the slow way", 5, "INTO THE GREEN"],
  ["algarve-at-your-own-pace", "Algarve, at your own pace", 5, "ATLANTIC DAYS"],
  [
    "iceland-a-wilder-perspective",
    "Iceland, a wilder perspective",
    5,
    "WILD OPEN SPACES",
  ],
];
const packages = destinations.map((d, i) => {
  const [slug, title, days, label] = journeys[i];
  const local = pois.filter((p) => p.destinationId === d.id);
  return {
    id: `${d.id}-t1`,
    destinationId: d.id,
    slug,
    title,
    days,
    priceFrom: d.startingPrice,
    heroImage: d.heroImage,
    label,
    itineraryJson: Array.from({ length: days }, (_, n) => ({
      day: n + 1,
      theme:
        n === 0
          ? "Arrive & exhale"
          : n === days - 1
            ? "Until next time"
            : n === days - 2
              ? "A day, your way"
              : local[(n - 1) % 3].name,
      description:
        n === 0
          ? `Arrive in ${d.name}, settle into a locally hosted stay, and enjoy a welcome meal.`
          : n === days - 1
            ? "Breakfast and an onward transfer. Leave with a new perspective."
            : n === days - 2
              ? "An unhurried day to revisit a favorite place or arrange an optional local experience."
              : `${local[(n - 1) % 3].description} Time for a local lunch and a relaxed afternoon. Transfers and visits are subject to local conditions.`,
    })),
  };
});
const journal = [
  {
    id: "j1",
    slug: "the-art-of-slow-travel",
    title: "The beautiful art of going a little slower",
    excerpt:
      "Fewer places. Deeper connections. Why the best journeys leave room for the unexpected.",
    category: "A WAY OF TRAVELING",
    coverImage: "/images/srilanka.jpg",
    readMinutes: 5,
    publishedAt: "2026-09-18T00:00:00.000Z",
    body: "There is a moment on every journey when the itinerary stops mattering. Maybe it happens over a second cup of tea, or halfway through a conversation with someone whose language you barely speak. You stop thinking about what comes next. You are simply there.\n\nSlow travel begins with a small decision: choose one place and give it time. Instead of three cities in five days, stay in one neighborhood. Learn the walk to the bakery. Recognize the person who makes your coffee. Let a place become a little familiar.\n\nLeave a morning unplanned. Take a local bus. Ask your host where they go on a free afternoon. These are small things, but they change the texture of a trip. A destination becomes a collection of people and moments, rather than a checklist.\n\nA family-run stay, a local guide, a meal made with seasonal produce: your choices help keep the character of a place alive. Ask questions, follow local guidance, and remember that someone else calls your destination home.\n\nYou may come back with fewer photographs. But you will probably have more stories.",
  },
  {
    id: "j2",
    slug: "a-quieter-side-of-bali",
    title: "Finding the Bali between the postcards",
    excerpt: "Early mornings, family kitchens, and quieter paths around Ubud.",
    category: "FIELD NOTES",
    coverImage: "/images/bali.jpg",
    readMinutes: 4,
    publishedAt: "2026-09-26T00:00:00.000Z",
    body: "Ubud wakes gently. Before the scooters fill the roads, offerings appear on doorsteps and the air still holds the night’s cool. This is a good time to walk.\n\nOn Campuhan Ridge, the path rolls through open green hills. Arrive early, carry water, and let the walk take as long as it needs. Back in town, breakfast can become a conversation about what is in season and who grew it.\n\nTo the north, Tegallalang is a working landscape as much as a beautiful one. Go with a local guide, ask before entering fields, and pay locally requested access fees. The terraces are the result of generations of knowledge.\n\nAt Tirta Empul, dress appropriately, respect people who have come to worship, and ask before taking photographs. Participation in a ritual is a personal choice.\n\nThe Bali you remember may be a quiet moment in a busy place. Give yourself time to find it.",
  },
  {
    id: "j3",
    slug: "packing-for-possibility",
    title: "Pack less. Make room for more.",
    excerpt:
      "A thoughtful packing list for days that don’t quite go to plan—in the best way.",
    category: "TRAVEL WELL",
    coverImage: "/images/algarve.jpg",
    readMinutes: 3,
    publishedAt: "2026-10-02T00:00:00.000Z",
    body: "A lighter bag makes a flexible journey easier. Start with comfortable shoes, layers you can wear together, and a small day bag. Choose clothes that work for a morning walk and a relaxed evening meal.\n\nCarry a refillable water bottle, sun protection, prescription medicines, and copies of important documents. A compact rain layer earns its place almost everywhere. Check entry requirements and health guidance before leaving.\n\nFor sacred sites, bring clothing that covers shoulders and knees. For coastal and mountain destinations, check local conditions rather than relying on a season’s reputation.\n\nKeep some space in your bag. Not just for the thing you find in a small workshop, but for the freedom of having less to carry.",
  },
];
const dir = fileURLToPath(new URL("../data/", import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(
  `${dir}/catalog.json`,
  JSON.stringify(
    { destinations, pois, experiences, packages, journal },
    null,
    2,
  ) + "\n",
);
console.log(
  "Seeded 6 destinations, 18 places, 6 experiences, 6 trips and 3 journal stories.",
);
