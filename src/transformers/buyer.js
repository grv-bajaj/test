const { formatToIST } = require('../utils/dateUtils');

// Clean/normalize phone numbers to +91... when possible
const cleanPhoneNumber = (phoneNumber) => {
  if (phoneNumber === null || phoneNumber === undefined) return null;
  let s = String(phoneNumber).trim();
  if (s.length === 0) return null;

  const keepPlus = s.startsWith('+');
  s = s.replace(/[^\d+]/g, '');
  s = s.replace(/^0+/, '');

  if (keepPlus && s.startsWith('+')) return s;
  if (s.startsWith('+')) return s;
  return s.length ? `+91${s}` : null;
};

// Convert arrays to comma separated string
const arrayToString = (val) => {
  if (!Array.isArray(val)) return val;
  return val
    .map(v => (v === null || v === undefined) ? '' : String(v).trim())
    .filter(Boolean)
    .join(', ');
};

// Format dates through formatToIST (fallback to original on error)
const formatDateIfPresent = (val) => {
  if (val === null || val === undefined || val === '') return val;
  try {
    return formatToIST(val);
  } catch (e) {
    return val;
  }
};

const toBooleanFlag = (v) => {
  if (v === true) return true;
  if (v === false) return false;
  if (v === null || v === undefined) return v;
  const s = String(v).trim().toLowerCase();
  return (s === 'y' || s === 'yes' || s === 'true' || s === '1');
};

// ---------- visit helpers ----------
const calculatePropertiesVisited = (visits = []) => {
  if (!Array.isArray(visits)) return 0;
  const completedVisits = visits.filter((visit) =>
    visit && (visit.status === 'completed' || visit.status === 'Completed')
  );
  const uniqueProperties = new Set(
    completedVisits.map((visit) => visit.propertyId).filter(Boolean)
  );
  return uniqueProperties.size;
};

const calculateLastVisitedOn = (visits = []) => {
  if (!Array.isArray(visits)) return null;
  const completedVisits = visits.filter((visit) =>
    visit && (visit.status === 'completed' || visit.status === 'Completed')
  );

  if (completedVisits.length === 0) {
    return null;
  }

  const latestVisit = completedVisits.reduce((latest, current) => {
    const currentDate = new Date(current.visitDate || current.from || 0);
    const latestDate = new Date(latest.visitDate || latest.from || 0);
    return currentDate > latestDate ? current : latest;
  }, completedVisits[0]);

  return formatDateIfPresent(latestVisit.visitDate || latestVisit.from);
};

const transformZohoData = (zohoData = {}) => {
  const src = (typeof zohoData === 'string') ? (() => {
    try { return JSON.parse(zohoData); } catch (e) { return {}; }
  })() : (zohoData || {});

  const result = {};

  // Define special-key groups
  const phoneKeys = new Set(['Phone', 'Spouse_Phone', 'CP_Phone']);
  const arrayKeys = new Set(['Preferences', 'Preferred_Area', 'Truva_Micromarket']);
  const dateKeys = new Set(['Created_Time', 'Tag_Expiry_Date']);
  const booleanKeys = new Set(['DND', 'Interested_in_visit']);

  // Transform each incoming key but keep the same key names
  for (const key of Object.keys(src)) {
    const val = src[key];

    // If it's an array OR it's one of the known arrayKeys
    if (Array.isArray(val) || (arrayKeys.has(key) && Array.isArray(val))) {
      result[key] = arrayToString(val);
      continue;
    }

    if (phoneKeys.has(key)) {
      result[key] = cleanPhoneNumber(val);
      continue;
    }

    if (dateKeys.has(key)) {
      result[key] = formatDateIfPresent(val);
      continue;
    }

    if (booleanKeys.has(key)) {
      result[key] = (val === null || val === undefined) ? val : toBooleanFlag(val);
      continue;
    }

    // default: strings trimmed, others preserved
    if (typeof val === 'string') result[key] = val.trim();
    else result[key] = val;
  }

  // Add derived visit metrics (these are new keys)
  const visits = Array.isArray(src.visits) ? src.visits : (src.Visits || src.visitHistory || []);
  result.propertiesVisited = calculatePropertiesVisited(visits);
  result.lastVisitedOn = calculateLastVisitedOn(visits);
  return result;
};

module.exports = {
  transformZohoData
};