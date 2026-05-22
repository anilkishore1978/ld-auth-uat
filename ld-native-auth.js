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
    throw { code:'network_error', desc: PROXY ? 'Network error. Check proxy-server.js and PROXY setting.' : 'Native Auth API requires a proxy due to CORS.' };
  }
  let json = {};
  try { json = await res.json(); } catch(e){}
  if (!res.ok || (json.error && !['attributes_required','credential_required'].includes(json.error))) {
    throw { code: json.error || 'request_failed', desc: (json.error_description || 'Request failed').split('.')[0], suberror: json.suberror || '', raw: json };
  }
  return json;
}
function jwtDecode(token){ try { return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); } catch(e){ return {}; } }
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
    const map = {
      network_error:'Unable to reach the authentication service.',
      user_already_exists:'An account already exists for this email address.',
      invalid_oob_value:'The verification code is incorrect.',
      password_too_weak:'Password does not meet complexity requirements.',
      password_too_short:'Password must be at least 8 characters.'
    };
    return map[err && err.code] || err?.desc || 'An unexpected error occurred.';
  },
  jwtDecode,
  pickUsername(claims){ return claims?.username || claims?.preferred_username || claims?.email || null; }
};
window.LDAuth = api;
window.LDToken = LDToken;
})();
