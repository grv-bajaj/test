const axios = require('axios');

function tryParseJson(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

const onlyDigits = (v) => {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\D/g, '');
};

const last10Digits = (v) => {
  const d = onlyDigits(v || '');
  if (!d) return '';
  return d.length > 10 ? d.slice(-10) : d;
};

const toYesNo = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  const s = String(v).trim().toLowerCase();
  if (['y','yes','true','1'].includes(s)) return 'yes';
  if (['n','no','false','0'].includes(s)) return 'no';
  return s; // fallback
};

const toTrueFalseString = (v) => {
  if (v === null || v === undefined) return 'false';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v).trim().toLowerCase();
  return (s === 'y' || s === 'yes' || s === 'true' || s === '1') ? 'true' : 'false';
};

const toInteger = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

const toYYYYMMDD = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch (e) {}
  const m = String(v).match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return String(v);
};

function mapZohoToNetcore(src = {}) {
  // sample incoming keys from your transformed payload:
  // Lead_Id, Email, Phone, Lead_Source, Lead_Name, Lead_Status, Duplicate_Status,
  // Lead_Owner, Listing_Platform, Campaign, Ad_set, Ad_Name, No_Of_attempts, propertiesVisited,
  // Created_Time, Tag_Expiry_Date, lastVisitedOn, Project_name, Form_ID, Truva_Micromarket,
  // Interested_in_visit, Preferences, Preferred_Area, Current_Stay, Budget, Preferred_time_of_Visit,
  // Not_Qualified_Reason, Closing_Timelines, CP_Name, CP_Phone, Referred_by, Spouse_Name, Spouse_Phone

  const mobileDigits = last10Digits(src.Phone || src.MOBILE || '');
  const mapped = {
    USER_ID: src.Lead_Id || src.USER_ID || '',
    EMAIL: src.Email || '',
    MOBILE: mobileDigits || '',
    USER_SOURCE: src.Lead_Source || '',
    FULL_NAME: src.Lead_Name || `${(src.First_Name || '')} ${(src.Last_Name || '')}`.trim() || '',
    USER_STATUS: src.Lead_Status || '',

    DUPLICATE: toTrueFalseString(src.Duplicate_Status), // 'true' / 'false' string
    TRUVA_RM: src.Lead_Owner || '',
    '3P_LISTING_PLATFORM': src.Listing_Platform || '',
    CAMPAIGN_NAME: src.Campaign || '',
    NUMBER_OF_ATTEMPTS: toInteger(src.No_Of_attempts) || 0,

    USER_CREATED_TIME: toYYYYMMDD(src.Created_Time) || '',
    CP_TAG_EXPIRY_DATE: toYYYYMMDD(src.Tag_Expiry_Date) || '',
    NO_OF_PROPERTIES_VISITED: toInteger(src.propertiesVisited) || 0,
    LAST_VISITED_ON: toYYYYMMDD(src.lastVisitedOn || src.Last_Visited_On) || '',
    '3P_SOCIETY_NAME': src.Project_name || src.Form_Name || '',

    CAMPAIGN_ID: src.Form_ID || '',
    AD_SET_ID: src.Ad_set || '',
    AD_SET_NAME: src.Ad_set || '',
    AD_ID: src.Ad_ID || src.Form_ID || '',
    AD_NAME: src.Ad_Name || '',

    INTERESTED_IN_VISIT: toYesNo(src.Interested_in_visit),
    PREFERENCES: src.Preferences || '',
    USE_CASE: src.Use_Case || '',
    PREFERRED_AREA: src.Preferred_Area || '',
    CURRENT_STAY: src.Current_Stay || '',
    BUDGET: src.Budget || '',
    PREFERRED_TIME_OF_VISIT: src.Preferred_time_of_Visit || '',
    NOT_QUALIFIED_REASON: src.Not_Qualified_Reason || '',
    CLOSING_TIMELINES: src.Closing_Timelines || '',

    TAGGED_CHANNEL_PARTNER_NAME: src.CP_Name || src.CP_Contact_Name || '',
    TAGGED_CHANNEL_PARTNER_PHONE: last10Digits(src.CP_Phone || ''),

    TRUVA_MICROMARKET: src.Truva_Micromarket || '',
    DND: toYesNo(src.DND),
    REFERRED_BY: src.Referred_by || '',
    SPOUSE_NAME: src.Spouse_Name || '',
    SPOUSE_PHONE: last10Digits(src.Spouse_Phone || ''),
    _original_payload: src
  };

  return mapped;
}

async function addNetcoreContact(contactData, baseUrl, apiKey, listId) {
  let requestUrl;
  try {
    const urlObj = new URL(baseUrl);
    // Ensure our required params are set (overwrites duplicates safely)
    urlObj.searchParams.set('type', 'contact');
    urlObj.searchParams.set('activity', 'addsync');
    urlObj.searchParams.set('apikey', apiKey);
    requestUrl = urlObj.toString();
  } catch (e) {
    const base = baseUrl.split('?')[0];
    const q = new URLSearchParams({ type: 'contact', activity: 'addsync', apikey: apiKey });
    const sep = base.includes('?') ? '&' : '?';
    requestUrl = `${base}${sep}${q.toString()}`;
  }

  // Remove debug/original payload to keep request small and avoid unexpected fields
  const payloadToSend = { ...contactData };
  if (payloadToSend._original_payload) delete payloadToSend._original_payload;

  const contactJsonString = JSON.stringify(payloadToSend);
  const bodyParams = new URLSearchParams();
  bodyParams.append('data', contactJsonString);
  if (listId) bodyParams.append('listid', listId);

  const axiosConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  };

  try {
    const resp = await axios.post(requestUrl, bodyParams, axiosConfig);
    return resp.data;
  } catch (err) {
    // If Netcore returned structured error, check for duplicate-case and treat as success
    const respData = err?.response?.data;
    if (respData && (respData.error_code === 302 ||
        (typeof respData.details === 'string' && respData.details.toLowerCase().includes('duplicate')))) {
      console.warn('Netcore reported duplicate entry — treating as success:', respData);
      return respData;
    }
    throw err;
  }
}

async function sendToNetcore(transformedContact) {
  const { NETCORE_BASE_URL, NETCORE_API_KEY, NETCORE_LIST_ID } = process.env;
  if (!NETCORE_BASE_URL || !NETCORE_API_KEY) {
    throw new Error('Missing NETCORE_BASE_URL or NETCORE_API_KEY in environment');
  }

  // Map fields
  const payload = mapZohoToNetcore(transformedContact);

  // Call Netcore - addNetcoreContact will return resp or a duplicate object (but won't throw for duplicate)
  const resp = await addNetcoreContact(payload, NETCORE_BASE_URL, NETCORE_API_KEY, NETCORE_LIST_ID);
  return resp;
}

module.exports = {
  sendToNetcore,
  mapZohoToNetcore,
};