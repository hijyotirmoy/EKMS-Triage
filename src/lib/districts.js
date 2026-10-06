export const ASSAM_DISTRICTS = [
  "Bajali",
  "Baksa",
  "Barpeta",
  "Biswanath",
  "Bongaigaon",
  "Cachar",
  "Charaideo",
  "Chirang",
  "Darrang",
  "Dhemaji",
  "Dhubri",
  "Dibrugarh",
  "Dima Hasao",
  "Goalpara",
  "Golaghat",
  "Hailakandi",
  "Hojai",
  "Jorhat",
  "Kamrup",
  "Kamrup Metro",
  "Karbi Anglong",
  "Karimganj",
  "Kokrajhar",
  "Lakhimpur",
  "Majuli",
  "Morigaon",
  "Nagaon",
  "Nalbari",
  "Sivasagar",
  "Sonitpur",
  "South Salmara Mankachar",
  "Tamulpur",
  "Tinsukia",
  "Udalguri",
  "West Karbi Anglong",
];

export const normalizeDistrict = (str) => {
  if (!str) return "";
  const cleaned = String(str)
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Alias Kamrup Metro and Kamrup Metropolitan to canonical "kamrup metro"
  if (
    cleaned === "kamrup metro" ||
    cleaned === "kamrup metropolitan" ||
    cleaned === "kamrup (m)" ||
    cleaned === "kamrup m" ||
    cleaned === "kamrup metro."
  ) {
    return "kamrup metro";
  }

  // Alias South Salmara variants
  if (cleaned.includes("salmara")) {
    return "south salmara";
  }

  return cleaned;
};

export const matchDistrict = (candidate, target) => {
  if (!candidate || !target) return false;
  const normCandidate = normalizeDistrict(candidate);
  const normTarget = normalizeDistrict(target);
  if (!normCandidate || !normTarget) return false;
  return normCandidate === normTarget;
};

// Canonical district headquarters coordinates across all 36 Assam districts
export const ASSAM_DISTRICT_COORDINATES = {
  "bajali": { lat: 26.4950, lng: 91.1820, name: "Bajali" },
  "baksa": { lat: 26.5830, lng: 91.4010, name: "Baksa" },
  "barpeta": { lat: 26.3210, lng: 91.0060, name: "Barpeta" },
  "biswanath": { lat: 26.7320, lng: 93.1550, name: "Biswanath" },
  "bongaigaon": { lat: 26.4820, lng: 90.5630, name: "Bongaigaon" },
  "cachar": { lat: 24.8330, lng: 92.7780, name: "Cachar" },
  "charaideo": { lat: 27.0340, lng: 95.0320, name: "Charaideo" },
  "chirang": { lat: 26.5410, lng: 90.5010, name: "Chirang" },
  "darrang": { lat: 26.4480, lng: 92.0320, name: "Darrang" },
  "dhemaji": { lat: 27.4810, lng: 94.5820, name: "Dhemaji" },
  "dhubri": { lat: 26.0220, lng: 89.9830, name: "Dhubri" },
  "dibrugarh": { lat: 27.4720, lng: 94.9120, name: "Dibrugarh" },
  "dima hasao": { lat: 25.1760, lng: 93.0240, name: "Dima Hasao" },
  "goalpara": { lat: 26.1820, lng: 90.6240, name: "Goalpara" },
  "golaghat": { lat: 26.5180, lng: 93.9680, name: "Golaghat" },
  "hailakandi": { lat: 24.6830, lng: 92.5640, name: "Hailakandi" },
  "hojai": { lat: 26.0020, lng: 92.8640, name: "Hojai" },
  "jorhat": { lat: 26.7500, lng: 94.2030, name: "Jorhat" },
  "kamrup": { lat: 26.2020, lng: 91.6840, name: "Kamrup" },
  "kamrup metro": { lat: 26.1445, lng: 91.7362, name: "Kamrup Metro" },
  "karbi anglong": { lat: 25.8420, lng: 93.4320, name: "Karbi Anglong" },
  "karimganj": { lat: 24.8690, lng: 92.3590, name: "Karimganj" },
  "kokrajhar": { lat: 26.4020, lng: 90.2710, name: "Kokrajhar" },
  "lakhimpur": { lat: 27.2360, lng: 94.1040, name: "Lakhimpur" },
  "majuli": { lat: 26.9620, lng: 94.2210, name: "Majuli" },
  "morigaon": { lat: 26.2520, lng: 92.3410, name: "Morigaon" },
  "nagaon": { lat: 26.3480, lng: 92.6840, name: "Nagaon" },
  "nalbari": { lat: 26.4460, lng: 91.4420, name: "Nalbari" },
  "sivasagar": { lat: 26.9820, lng: 94.6310, name: "Sivasagar" },
  "sonitpur": { lat: 26.6520, lng: 92.7930, name: "Sonitpur" },
  "south salmara": { lat: 25.8820, lng: 89.9320, name: "South Salmara" },
  "south salmara mankachar": { lat: 25.8820, lng: 89.9320, name: "South Salmara Mankachar" },
  "tamulpur": { lat: 26.6340, lng: 91.5720, name: "Tamulpur" },
  "tinsukia": { lat: 27.4920, lng: 95.3620, name: "Tinsukia" },
  "udalguri": { lat: 26.7460, lng: 92.0960, name: "Udalguri" },
  "west karbi anglong": { lat: 25.9220, lng: 92.5510, name: "West Karbi Anglong" },
};

export const getDistrictCoordinates = (districtName) => {
  if (!districtName) return null;
  const norm = normalizeDistrict(districtName);
  return ASSAM_DISTRICT_COORDINATES[norm] || null;
};
