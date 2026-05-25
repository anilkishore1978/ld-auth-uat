(function(){
'use strict';
const cfg = window.NACONFIG || {};
const { CLIENTID, TENANTID, TENANTSUB, PROXY, SCOPES, CHALTYPES } = cfg;
const BASE = `https://${TENANTSUB}.ciamlogin.com/${TENANTID}`;

async function naPost(path, params){
  const url = PROXY ? (PROXY + path) : (BASE + path);
  const body = new URLSearchParams({ client_id: CLIENTID, ...params });
  let res;
  try {
    res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
  } catch (e) {
    throw { code:'network_error', desc: PROXY
      ? 'Network error — make sure proxy-server.js is running (node proxy-server.js).'
      : 'Native Auth API requires a proxy due to CORS.' };
  }
  let json = {};
  try { json = await res.json(); } catch(e){}

  // Poll-completion special handling:
  // • HTTP 200 with any status → return as-is (caller checks status field)
  // • HTTP 404 → Entra CIAM consumes the token on success, 404 = "done"
  //              Return synthetic succeeded response so the caller shows success.
  const isPollPath = path.includes('pollcompletion');
  if (isPollPath) {
    if (res.ok)           return json;
    if (res.status === 404) return { status: 'succeeded' };
  }

  if (!res.ok || (json.error && !['attributes_required','credential_required'].includes(json.error))) {
    throw {
      code    : json.error      || 'request_failed',
      desc    : json.error_description
                  ? json.error_description.split('.')[0]
                  : `Request failed (HTTP ${res.status})`,
      suberror: json.suberror   || '',
      status  : res.status,
      raw     : json
    };
  }
  return json;
}

function jwtDecode(token){
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
  catch(e){ return {}; }
}

const LDToken = {
  store(tokens){ sessionStorage.setItem('ld_tokens', JSON.stringify(tokens)); },
  get(){ try { return JSON.parse(sessionStorage.getItem('ld_tokens') || 'null'); } catch(e){ return null; } },
  clear(){ sessionStorage.removeItem('ld_tokens'); },
  isAuthenticated(){ const t=this.get(); return !!(t && t.idToken); }
};

const api = {
  async signInInitiate(username){ return naPost('/oauth2/v2.0/initiate', { username, challenge_type: CHALTYPES }); },
  async signInChallenge(continuation_token){ return naPost('/oauth2/v2.0/challenge', { continuation_token, challenge_type: CHALTYPES }); },
  async signInWithPassword(continuation_token, password){ return naPost('/oauth2/v2.0/token', { continuation_token, password, grant_type:'password', scope: SCOPES }); },
  async signInSubmitMfaOtp(continuation_token, oob){ return naPost('/oauth2/v2.0/token', { continuation_token, oob, grant_type:'urn:ietf:params:oauth:grant-type:oob', scope: SCOPES }); },
  async signUpStart(username, password, attrs){ return naPost('/signup/v1.0/start', { username, challenge_type: CHALTYPES, ...(password ? { password } : {}), ...(attrs && Object.keys(attrs).length ? { attributes: JSON.stringify(attrs) } : {}) }); },
  async signUpChallenge(continuation_token){ return naPost('/signup/v1.0/challenge', { continuation_token, challenge_type: CHALTYPES }); },
  async signUpContinueOtp(continuation_token, oob){ return naPost('/signup/v1.0/continue', { continuation_token, oob, grant_type:'oob' }); },
  async signUpToken(continuation_token){ return naPost('/oauth2/v2.0/token', { continuation_token, grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', scope: SCOPES }); },
  async resetPasswordStart(username){ return naPost('/resetpassword/v1.0/start', { username, challenge_type: CHALTYPES }); },
  async resetPasswordChallenge(continuation_token){ return naPost('/resetpassword/v1.0/challenge', { continuation_token, challenge_type: CHALTYPES }); },
  async resetPasswordSubmitOtp(continuation_token, oob){ return naPost('/resetpassword/v1.0/continue', { continuation_token, oob, grant_type:'oob' }); },
  async resetPasswordSubmitNew(continuation_token, new_password){ return naPost('/resetpassword/v1.0/submit', { continuation_token, new_password }); },
  async resetPasswordPoll(continuation_token){ return naPost('/resetpassword/v1.0/pollcompletion', { continuation_token }); },

  mapError(err){
    if (!err) return 'An unexpected error occurred.';
    const map = {
      // Network
      network_error              : 'Unable to reach the authentication service. Check that proxy-server.js is running.',
      // Sign-in
      unauthorized_client        : 'This application is not authorized. Check Client ID in ld-config.js.',
      invalid_client             : 'Invalid client configuration. Contact support.',
      user_not_found             : 'No account found with that email or username.',
      invalid_grant              : 'Incorrect username or password.',
      // OTP / OOB
      invalid_oob_value          : 'The verification code is incorrect. Please try again.',
      oob_code_expired           : 'The verification code has expired. Please request a new one.',
      // Password reset
      password_too_weak          : 'Password does not meet complexity requirements (use uppercase, lowercase, number, and symbol).',
      password_too_short         : 'Password must be at least 8 characters.',
      password_recently_used     : 'You cannot reuse a recent password. Please choose a different one.',
      password_banned            : 'This password is not allowed. Please choose a different one.',
      password_does_not_meet_requirements: 'Password does not meet the complexity requirements.',
      // Token / session
      expired_token              : 'Your session has expired. Please start over.',
      invalid_continuation_token : 'Your session is no longer valid. Please start the process again.',
      access_denied              : 'Access was denied. Your session may have expired — please start over.',
      // Registration
      user_already_exists        : 'An account already exists for this email address.',
      // Generic
      invalid_request            : 'The request was invalid. Please try again or contact support.',
      unsupported_challenge_type : 'This sign-in method is not supported for your account.',
    };

    if (map[err.code]) return map[err.code];

    // Suberror takes priority for password issues
    if (err.suberror && map[err.suberror]) return map[err.suberror];

    // Show the actual API description if available, with error code for debugging
    if (err.desc && err.desc !== 'Request failed') return err.desc;

    // Last resort — include the error code so developers can diagnose
    const code = err.code || 'unknown';
    const httpStatus = err.status ? ` (HTTP ${err.status})` : '';
    return `Authentication error: ${code}${httpStatus}. Please try again or contact support.`;
  },

  jwtDecode,
  pickUsername(claims){ return claims?.username || claims?.preferred_username || claims?.email || null; }
};

window.LDAuth = api;
window.LDToken = LDToken;
})();
