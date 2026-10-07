import assamPincodesData from "../data/assam_pincodes.json";
import defaultFacilities from "../data/facilities.json";
import { calculateHaversineDistanceKm, calculateRoadDistanceKm, isDispensary, isHospital, isEsicHospital, isGovtDistrictHospital, isTieUp } from "./geo.js";

/**
 * Rich Registry of Known Assam Localities, Neighborhoods & Landmarks
 * Specifically tuned for rapid voice/chat recognition of caller locations.
 */
export const ASSAM_LANDMARKS = [
  // Guwahati / Kamrup Metro
  {
    name: "Zoo Road / Tiniali",
    aliases: ["zoo road", "zoo road tiniali", "rg baruah road", "r.g. baruah", "shraddhanjali", "shraddhanjali kanan", "geetanagar", "geeta nagar"],
    lat: 26.1685,
    lng: 91.782,
    pincode: "781024",
    district: "Kamrup Metro",
  },
  {
    name: "Paltan Bazaar, Guwahati",
    aliases: ["paltan bazaar", "paltan bazar", "guwahati railway station", "ghy railway station", "astc paltan bazar", "nepali mandir"],
    lat: 26.1812,
    lng: 91.7516,
    pincode: "781001",
    district: "Kamrup Metro",
  },
  {
    name: "Dispur / Secretariat",
    aliases: ["dispur", "dispur last gate", "assam sachivalaya", "super market", "supermarket dispur", "capital complex", "janata bhawan"],
    lat: 26.1415,
    lng: 91.7905,
    pincode: "781006",
    district: "Kamrup Metro",
  },
  {
    name: "Ganeshguri",
    aliases: ["ganeshguri", "ganesh mandir", "ganeshguri flyover", "walford"],
    lat: 26.1528,
    lng: 91.7865,
    pincode: "781006",
    district: "Kamrup Metro",
  },
  {
    name: "Six Mile / Chachal",
    aliases: ["six mile", "sixmile", "chachal", "vip road six mile", "punjabari road"],
    lat: 26.1305,
    lng: 91.815,
    pincode: "781022",
    district: "Kamrup Metro",
  },
  {
    name: "Beltola / Survey",
    aliases: ["beltola", "beltola tiniali", "beltola bazar", "survey", "bhetapara", "jayanagar beltola"],
    lat: 26.1215,
    lng: 91.808,
    pincode: "781028",
    district: "Kamrup Metro",
  },
  {
    name: "Khanapara",
    aliases: ["khanapara", "veterinary college", "meghalaya gate", "khanapara flyover", "amerigog", "10th mile"],
    lat: 26.115,
    lng: 91.825,
    pincode: "781022",
    district: "Kamrup Metro",
  },
  {
    name: "Panbazar",
    aliases: ["panbazar", "pan bazar", "dighalipukhuri", "cotton college", "cotton university", "guwahati high court", "ghy high court"],
    lat: 26.188,
    lng: 91.745,
    pincode: "781001",
    district: "Kamrup Metro",
  },
  {
    name: "Uzanbazar / Silpukhuri",
    aliases: ["uzanbazar", "uzan bazar", "silpukhuri", "goswami service", "senapati path", "latasil", "guwahati club"],
    lat: 26.184,
    lng: 91.765,
    pincode: "781003",
    district: "Kamrup Metro",
  },
  {
    name: "Chandmari",
    aliases: ["chandmari", "chandmari flyover", "engineering institute", "commerce college", "aei field"],
    lat: 26.186,
    lng: 91.776,
    pincode: "781003",
    district: "Kamrup Metro",
  },
  {
    name: "Bhangagarh / GMCH",
    aliases: ["bhangagarh", "gmch", "guwahati medical college", "narakasur", "gmc hospital road"],
    lat: 26.1596,
    lng: 91.7677,
    pincode: "781032",
    district: "Kamrup Metro",
  },
  {
    name: "Ulubari / Rehabari",
    aliases: ["ulubari", "ulubari flyover", "rehabari", "arya hospital", "nehru stadium", "b. borooah"],
    lat: 26.173,
    lng: 91.764,
    pincode: "781007",
    district: "Kamrup Metro",
  },
  {
    name: "Kalapahar / Cycle Factory",
    aliases: ["kalapahar", "cycle factory", "gopinath nagar", "tb hospital kalapahar", "birubari", "barsapara"],
    lat: 26.1628,
    lng: 91.7463,
    pincode: "781016",
    district: "Kamrup Metro",
  },
  {
    name: "Fatasil Ambari",
    aliases: ["fatasil", "fatasil ambari", "dhirenpara", "ambari"],
    lat: 26.155,
    lng: 91.735,
    pincode: "781025",
    district: "Kamrup Metro",
  },
  {
    name: "Bharalumukh / Santipur",
    aliases: ["bharalumukh", "santipur", "bharaulumukh", "at road"],
    lat: 26.172,
    lng: 91.733,
    pincode: "781009",
    district: "Kamrup Metro",
  },
  {
    name: "Maligaon / Kamakhya",
    aliases: ["maligaon", "nfr headquarters", "maligaon chariali", "kamakhya temple", "kamakhya station", "pandu"],
    lat: 26.152,
    lng: 91.696,
    pincode: "781011",
    district: "Kamrup Metro",
  },
  {
    name: "Jalukbari / Gauhati University",
    aliases: ["jalukbari", "jalukbari rotary", "gauhati university", "gu campus", "ayurvedic college", "sundarbari"],
    lat: 26.145,
    lng: 91.66,
    pincode: "781014",
    district: "Kamrup Metro",
  },
  {
    name: "Amingaon / North Guwahati",
    aliases: ["amingaon", "north guwahati", "iit guwahati", "iitg", "trb civil hospital", "dc office amingaon"],
    lat: 26.189,
    lng: 91.673,
    pincode: "781031",
    district: "Kamrup",
  },
  {
    name: "Noonmati / Refinery",
    aliases: ["noonmati", "noonmati refinery", "mathgharia", "choonsali", "sector 1 noonmati", "bamunimaidam", "bamunimaidan"],
    lat: 26.185,
    lng: 91.795,
    pincode: "781020",
    district: "Kamrup Metro",
  },
  {
    name: "Narengi / Forest Gate",
    aliases: ["narengi", "narangi", "narengi tiniali", "forest gate", "patharquary", "narengi cantt"],
    lat: 26.1717,
    lng: 91.8291,
    pincode: "781071",
    district: "Kamrup Metro",
  },
  {
    name: "Hatigaon",
    aliases: ["hatigaon", "hatigaon chariali", "sijubari", "notboma", "kherbari"],
    lat: 26.131,
    lng: 91.782,
    pincode: "781038",
    district: "Kamrup Metro",
  },
  {
    name: "Kahilipara",
    aliases: ["kahilipara", "kahilipara tiniali", "dakhingaon", "jatia"],
    lat: 26.138,
    lng: 91.765,
    pincode: "781019",
    district: "Kamrup Metro",
  },
  {
    name: "Lokhra / Garchuk",
    aliases: ["lokhra", "lokhra chariali", "garchuk", "paschim boragaon", "sarusajai", "hockey stadium", "isbt guwahati", "isbt"],
    lat: 26.1204,
    lng: 91.691,
    pincode: "781035",
    district: "Kamrup Metro",
  },
  {
    name: "Borjhar / Airport",
    aliases: ["borjhar", "lgbi airport", "guwahati airport", "azara", "mirza", "palasbari", "dharapur"],
    lat: 26.106,
    lng: 91.586,
    pincode: "781015",
    district: "Kamrup Metro",
  },
  {
    name: "Sonapur / Khetri",
    aliases: ["sonapur", "sonapur district hospital", "amara", "khetri", "jagiroad border"],
    lat: 26.1201,
    lng: 91.9691,
    pincode: "782402",
    district: "Kamrup Metro",
  },

  // Major Cities & Districts Across Assam
  {
    name: "Dibrugarh (Paltan Bazar / AMC)",
    aliases: ["dibrugarh", "dibrugarh paltan bazar", "amc road", "amc dibrugarh", "boiragimoth", "graham bazar", "chowkidinghee", "thana chariali dibrugarh", "jalan nagar"],
    lat: 27.4728,
    lng: 94.912,
    pincode: "786001",
    district: "Dibrugarh",
  },
  {
    name: "Tinsukia",
    aliases: ["tinsukia", "tinsukia town", "makum", "digboi", "doomdooma", "esic hospital tinsukia"],
    lat: 27.4922,
    lng: 95.3468,
    pincode: "786125",
    district: "Tinsukia",
  },
  {
    name: "Jorhat",
    aliases: ["jorhat", "jmch", "jorhat medical college", "gar-ali", "na-ali", "cinnamara", "nimati"],
    lat: 26.7509,
    lng: 94.2037,
    pincode: "785001",
    district: "Jorhat",
  },
  {
    name: "Sivasagar",
    aliases: ["sivasagar", "sibsagar", "nazira", "amguri", "demow"],
    lat: 26.9826,
    lng: 94.6425,
    pincode: "785640",
    district: "Sivasagar",
  },
  {
    name: "Nagaon",
    aliases: ["nagaon", "nowgong", "haibargaon", "dhupguri", "samaguri", "kaliabor"],
    lat: 26.3464,
    lng: 92.684,
    pincode: "782001",
    district: "Nagaon",
  },
  {
    name: "Tezpur / Sonitpur",
    aliases: ["tezpur", "sonitpur", "mission chariali", "dekargaon", "tribeni", "tmch", "tezpur medical college"],
    lat: 26.6528,
    lng: 92.7926,
    pincode: "784001",
    district: "Sonitpur",
  },
  {
    name: "Silchar / Cachar",
    aliases: ["silchar", "cachar", "smch", "silchar medical college", "tarapur", "rangirkhari", "ambicapatty"],
    lat: 24.8333,
    lng: 92.7789,
    pincode: "788001",
    district: "Cachar",
  },
  {
    name: "Bongaigaon",
    aliases: ["bongaigaon", "new bongaigaon", "bgr township", "dhaligaon", "chapaguri"],
    lat: 26.5027,
    lng: 90.5532,
    pincode: "783380",
    district: "Bongaigaon",
  },
  {
    name: "Barpeta",
    aliases: ["barpeta", "barpeta road", "fakhruddin ali ahmed medical college", "faamch", "howly"],
    lat: 26.3213,
    lng: 91.0044,
    pincode: "781301",
    district: "Barpeta",
  },
  {
    name: "Nalbari",
    aliases: ["nalbari", "nalbari town", "gohainpara", "hajo road nalbari"],
    lat: 26.4447,
    lng: 91.4424,
    pincode: "781335",
    district: "Nalbari",
  },
  {
    name: "Goalpara",
    aliases: ["goalpara", "goalpara town", "baladmari", "dudhnoi"],
    lat: 26.1719,
    lng: 90.6277,
    pincode: "783101",
    district: "Goalpara",
  },
  {
    name: "Dhubri",
    aliases: ["dhubri", "dhubri town", "gauripur", "bilasipara"],
    lat: 26.0207,
    lng: 89.9742,
    pincode: "783301",
    district: "Dhubri",
  },
  {
    name: "Karimganj",
    aliases: ["karimganj", "badarpur", "ramkrishna nagar"],
    lat: 24.8649,
    lng: 92.3593,
    pincode: "788710",
    district: "Karimganj",
  },
  {
    name: "Hailakandi",
    aliases: ["hailakandi", "lala", "algapur"],
    lat: 24.6836,
    lng: 92.5638,
    pincode: "788151",
    district: "Hailakandi",
  },
  {
    name: "Golaghat",
    aliases: ["golaghat", "bokakhat", "kaziranga", "sarupathar"],
    lat: 26.5167,
    lng: 93.9667,
    pincode: "785621",
    district: "Golaghat",
  },
  {
    name: "Hojai",
    aliases: ["hojai", "lumding", "doboka", "lanka"],
    lat: 26.0022,
    lng: 92.8654,
    pincode: "782435",
    district: "Hojai",
  },
  {
    name: "Morigaon",
    aliases: ["morigaon", "migaon", "jagiroad", "mayong", "bhuragaon"],
    lat: 26.2575,
    lng: 92.3439,
    pincode: "782105",
    district: "Morigaon",
  },
  {
    name: "Mangaldai / Darrang",
    aliases: ["mangaldai", "mangaldai town", "darrang", "sipajhar", "kharupetia"],
    lat: 26.4385,
    lng: 92.0357,
    pincode: "784125",
    district: "Darrang",
  },
  {
    name: "North Lakhimpur",
    aliases: ["north lakhimpur", "lakhimpur", "narayanpur", "bihpuria"],
    lat: 27.2346,
    lng: 94.1037,
    pincode: "787001",
    district: "Lakhimpur",
  },
  {
    name: "Dhemaji",
    aliases: ["dhemaji", "silapathar", "jonai"],
    lat: 27.4815,
    lng: 94.5772,
    pincode: "787057",
    district: "Dhemaji",
  },
  {
    name: "Kokrajhar",
    aliases: ["kokrajhar", "btad", "bodoland", "gossaigaon"],
    lat: 26.4026,
    lng: 90.2721,
    pincode: "783370",
    district: "Kokrajhar",
  },
];

/**
 * Normalizes input text and detects Assam location, landmark, or 6-digit postal PIN code.
 */
export function detectAssamLocationFromText(rawText = "") {
  if (!rawText || typeof rawText !== "string") {
    return { found: false, reason: "Empty input" };
  }

  const text = rawText.toLowerCase().trim();

  // 1. Direct 6-digit Assam Postal PIN Code (78xxxx)
  const pinMatch = text.match(/\b(78\d{4})\b/);
  if (pinMatch) {
    const pin = pinMatch[1];
    if (assamPincodesData && assamPincodesData[pin]) {
      const pinInfo = assamPincodesData[pin];
      return {
        found: true,
        type: "pincode",
        pincode: pin,
        name: pinInfo.office || `Assam PIN ${pin}`,
        district: pinInfo.district || "Assam",
        lat: Number(pinInfo.lat),
        lng: Number(pinInfo.lng),
        matchedString: pin,
      };
    } else {
      return {
        found: true,
        type: "pincode",
        pincode: pin,
        name: `Assam PIN ${pin}`,
        district: "Assam",
        lat: 26.18,
        lng: 91.75,
        matchedString: pin,
      };
    }
  }

  // 2. Check known landmarks & localities
  for (const landmark of ASSAM_LANDMARKS) {
    for (const alias of landmark.aliases) {
      // Word boundary check or substring match for multi-word aliases
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(text)) {
        return {
          found: true,
          type: "landmark",
          name: landmark.name,
          pincode: landmark.pincode,
          district: landmark.district,
          lat: landmark.lat,
          lng: landmark.lng,
          matchedString: alias,
        };
      }
    }
  }

  // 3. Fallback: Generic location indicator words without a known locality
  const isAnsweringLocation =
    /\b(i am (?:in|at|from)|live in|staying in|living in|near|close to|located at|address is|area is|locality|landmark)\b/i.test(text);

  if (isAnsweringLocation) {
    return {
      found: false,
      isAnsweringLocation: true,
      rawText,
      needsPincode: true,
    };
  }

  return { found: false };
}

/**
 * Calculates distance from coordinates to all medical facilities in the directory,
 * ranking by nearest ESIS Dispensary and nearest Hospital (ESIC / Govt District Hospital).
 */
export function findNearestFacilitiesForLocation({
  lat,
  lng,
  pincode,
  district,
  facilities = defaultFacilities,
}) {
  if (lat == null || lng == null) {
    return { nearestDispensary: null, nearestHospital: null, sorted: [] };
  }

  const cleanFacs = facilities
    .filter((f) => f && f.latitude != null && f.longitude != null)
    .map((f) => {
      const straightKm = calculateHaversineDistanceKm(lat, lng, Number(f.latitude), Number(f.longitude));
      const roadKm = straightKm != null ? calculateRoadDistanceKm(lat, lng, Number(f.latitude), Number(f.longitude)) : null;
      return {
        ...f,
        straightKm,
        roadKm: roadKm || straightKm,
      };
    })
    .sort((a, b) => (a.roadKm || 9999) - (b.roadKm || 9999));

  // Find Nearest Dispensary (Primary Care OPD)
  const nearestDispensary = cleanFacs.find((f) => isDispensary(f)) || null;

  // Find Nearest Hospital (ESIC Hospital or Govt District Hospital / Medical College)
  const nearestHospital = cleanFacs.find((f) => isHospital(f)) || null;

  // Find Nearest Tie-Up Facility
  const nearestTieUp = cleanFacs.find((f) => isTieUp(f)) || null;

  return {
    nearestDispensary,
    nearestHospital,
    nearestTieUp,
    allSorted: cleanFacs.slice(0, 5),
  };
}

/**
 * Constructs an empathetic, crystal-clear doctor guidance message
 * presenting the exact nearest facility, distance, address, and OPD timings.
 */
export function buildFacilityRecommendationMessage({
  locationName,
  nearestDispensary,
  nearestHospital,
  conditionLabel = "your symptoms",
  severity = "Moderate",
}) {
  const isHighSeverity = severity === "High";
  const primaryFacility = isHighSeverity && nearestHospital ? nearestHospital : nearestDispensary || nearestHospital;

  if (!primaryFacility) {
    return {
      text: `We have registered your location near ${locationName}. Would you please provide your exact 6-digit PIN code so we can confirm the nearest facility?`,
      facility: null,
    };
  }

  const englishText = `Thank you, we have noted your location (${locationName}). All details regarding your symptoms and health complaint have been recorded for your triage assessment. You can review the recommended healthcare facilities in the Facilities section.`;
  const hinglishText = `Dhanyawaad, humne aapka sthan (${locationName}) note kar liya hai. Aapki takleef aur swasthya ki saari jaankari triage jaanch ke liye darj kar li gayi hai. Kripya sujhayi gayi suvidhaon ke liye Facilities section dekhein.`;

  return {
    text: `Ask the IP: "${englishText}" (Hinglish: "${hinglishText}")`,
    facility: primaryFacility,
    options: [
      "Thank you, noted",
      "Connect me with 104 tele-doctor",
      "Need ambulance / emergency help",
      "View triage summary",
    ],
  };
}
