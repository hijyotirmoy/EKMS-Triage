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
