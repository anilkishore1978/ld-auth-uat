/**
 * ld-native-auth.js
 * Liberty Dental UAT — Core Entra External ID Native Authentication API Module
 *
 * Implements direct REST calls to the Native Authentication API endpoints.
 * No MSAL redirect flows. No browser redirects to Microsoft pages.
 * All authentication is API-driven from Liberty Dental's own HTML pages.
 *
 * Dependency: ld-config.js must be loaded before this script.
 */

/* ════════════════════════════════════════════════════════════════════════════
   TOKEN STORAGE HELPERS  (sessionStorage — acceptable for UAT)
   For production: migrate refresh_token to HttpOnly cookie via a BFF server.
   ════════════════════════════════════════════════════════════════════════════ */
const LDToken = {
  keys: {
    access:  'ld_access_token',
    id:      'ld_id_token',
    refresh: 'ld_refresh_token',
    expiry:  'ld_token_expiry',
    user:    'ld_user_display',
  },

  store(tokens) {
    sessionStorage.setItem(this.keys.access,  tokens.access_token  || '');
    sessionStorage.setItem(this.keys.id,      tokens.id_token      || '');
    sessionStorage.setItem(this.keys.refresh, tokens.refresh_token || '');
    sessionStorage.setItem(this.keys.expiry,
      String(Date.now() + (parseInt(tokens.expires_in || '3600', 10) * 1000))
    );
    // Parse display name from id_token payload
    try {
      const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
      sessionStorage.setItem(this.keys.user,
        payload.name || payload.preferred_username || payload.email || '');
    } catch (_) { /* ignore decode errors */ }
  },

  getAccess()  { return sessionStorage.getItem(this.keys.access)  || null; },
  getRefresh() { return sessionStorage.getItem(this.keys.refresh) || null; },
  getUser()    { return sessionStorage.getItem(this.keys.user)    || ''; },

  isExpired() {
    const exp = parseInt(sessionStorage.getItem(this.keys.expiry) || '0', 10);
    return Date.now() >= exp - 60000; // refresh 60s before expiry
  },

  isAuthenticated() {
    return !!(this.getAccess() && !this.isExpired());
  },

  clear() {
    Object.values(this.keys).forEach(k => sessionStorage.removeItem(k));
  },
};

/* ════════════════════════════════════════════════════════════════════════════
   NATIVE AUTHENTICATION API  (direct fetch — no SDK dependency)
   ════════════════════════════════════════════════════════════════════════════ */
const LDAuth = (() => {
  const BASE       = LD_CONFIG.apiBase;
  const CLIENT_ID  = LD_CONFIG.clientId;
  const SCOPES     = LD_CONFIG.scopes;
  const CHALLENGES = LD_CONFIG.challengeTypes;

  /* ── Core POST helper ────────────────────────────────────────────────────── */
  async function _post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ client_id: CLIENT_ID, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Normalise error shape — Entra External ID always returns error + suberror
      throw {
        status:           res.status,
        error:            data.error            || 'unknown_error',
        suberror:         data.suberror         || '',
        error_description: data.error_description || 'An unexpected error occurred.',
        error_codes:      data.error_codes      || [],
      };
    }
    return data;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SIGN IN FLOW
     Step 1 → /initiate  →  Step 2 → /challenge  →  Step 3 → /continuation
     → Step 4 → /token
     ══════════════════════════════════════════════════════════════════════════ */

  /** Step 1: Initiate sign-in with username (email) */
  async function signInInitiate(username) {
    return _post('/oauth2/v2.0/initiate', {
      username,
      challenge_type: CHALLENGES,
    });
  }

  /** Step 2: Request password challenge */
  async function signInChallenge(continuationToken) {
    return _post('/oauth2/v2.0/challenge', {
      challenge_type:     'password',
      continuation_token: continuationToken,
    });
  }

  /** Step 3: Submit password credential */
  async function signInWithPassword(continuationToken, password) {
    return _post('/oauth2/v2.0/continuation', {
      grant_type:         'password',
      continuation_token: continuationToken,
      password,
    });
  }

  /** Step 4: Exchange continuation token for final tokens */
  async function getTokens(continuationToken) {
    return _post('/oauth2/v2.0/token', {
      grant_type:         'continuation_token',
      continuation_token: continuationToken,
      scope:              SCOPES,
    });
  }

  /** MFA: Submit OTP code during sign-in (challenge_type === 'oob') */
  async function signInSubmitMfaOtp(continuationToken, otp) {
    return _post('/oauth2/v2.0/continuation', {
      grant_type:         'oob',
      continuation_token: continuationToken,
      oob:                otp,
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SIGN UP FLOW  (Member identity verification — DOB check via API connector)
     Entra External ID supports API connectors in the sign-up user flow.
     The memberDateOfBirth attribute is collected and sent to a validation API.
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Sign-Up Initiate: Start the sign-up flow.
   * username = email address of the member
   * attributes = custom attributes (memberDateOfBirth)
   */
  async function signUpInitiate(username, password, attributes) {
    const attrParams = {};
    // Flatten attributes for the API — format: attributes.<name>=<value>
    Object.entries(attributes).forEach(([k, v]) => {
      attrParams[`attributes.${k}`] = v;
    });
    return _post('/signup/v1.0/start', {
      username,
      password,
      challenge_type: CHALLENGES,
      ...attrParams,
    });
  }

  /** Sign-Up: Submit email OTP for account verification */
  async function signUpSubmitOtp(continuationToken, otp) {
    return _post('/signup/v1.0/continue', {
      continuation_token: continuationToken,
      grant_type:         'oob',
      oob:                otp,
    });
  }

  /** Sign-Up: Submit remaining attributes (e.g., after OTP verified) */
  async function signUpSubmitAttributes(continuationToken, attributes) {
    const attrParams = {};
    Object.entries(attributes).forEach(([k, v]) => {
      attrParams[`attributes.${k}`] = v;
    });
    return _post('/signup/v1.0/continue', {
      continuation_token: continuationToken,
      grant_type:         'attributes',
      ...attrParams,
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     PASSWORD RESET FLOW
     Step 1 → /resetpassword/v1.0/start  (submit username = email)
     Step 2 → /resetpassword/v1.0/continue  (submit OTP)
     Step 3 → /resetpassword/v1.0/submit  (submit new password)
     ══════════════════════════════════════════════════════════════════════════ */

  /** Step 1: Initiate password reset — send OTP to user's registered email */
  async function resetPasswordStart(username) {
    return _post('/resetpassword/v1.0/start', {
      username,
      challenge_type: 'oob',
    });
  }

  /** Step 2: Submit OTP received by email */
  async function resetPasswordSubmitOtp(continuationToken, otp) {
    return _post('/resetpassword/v1.0/continue', {
      continuation_token: continuationToken,
      grant_type:         'oob',
      oob:                otp,
    });
  }

  /** Step 3: Submit new password */
  async function resetPasswordSubmitNew(continuationToken, newPassword) {
    return _post('/resetpassword/v1.0/submit', {
      continuation_token: continuationToken,
      new_password:       newPassword,
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     TOKEN REFRESH
     ══════════════════════════════════════════════════════════════════════════ */
  async function refreshTokens(refreshToken) {
    return _post('/oauth2/v2.0/token', {
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      scope:         SCOPES,
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ERROR MAPPING
     Maps Entra External ID API error codes to Liberty Dental's existing
     user-facing message strings (matching current B2C CONTENT strings).
     ══════════════════════════════════════════════════════════════════════════ */
  function mapError(err) {
    const sub = (err.suberror || '').toLowerCase();
    const top = (err.error   || '').toLowerCase();

    const map = {
      // Sign-in errors
      'invalid_password':          'We are having trouble signing you in. Please try again later.',
      'user_not_found':            'We are having trouble signing you in. Please try again later.',
      'invalid_grant':             'We are having trouble signing you in. Please try again later.',
      'user_locked':               'Your account has been locked. Please contact Member Services.',
      'account_disabled':          'Your account is currently disabled. Please contact Member Services.',

      // OTP errors
      'invalid_oob_value':         'That code is incorrect. Please try again.',
      'oob_expired':               'That code is expired. Please request a new code.',
      'invalid_oob_value_no_retry':'You\'ve made too many incorrect attempts. Please try again later.',

      // Rate limit / throttle
      'too_many_requests':         'There have been too many requests. Please wait a while, then try again.',

      // Password policy
      'password_too_short':        'Password does not meet the minimum length requirement.',
      'password_too_weak':         'Password does not meet the complexity requirements.',
      'password_recently_used':    'You cannot reuse a recent password. Please choose a different password.',

      // Sign-up errors
      'user_already_exists':       'An account with this email address already exists.',

      // Network errors
      'network_error':             'We are having trouble connecting. Please check your connection and try again.',
    };

    return map[sub] || map[top] || err.error_description ||
      'We are having trouble with your request. Please try again later.';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     SESSION MANAGEMENT
     ══════════════════════════════════════════════════════════════════════════ */
  async function getValidToken() {
    if (LDToken.isAuthenticated()) return LDToken.getAccess();
    const rt = LDToken.getRefresh();
    if (!rt) return null;
    try {
      const tokens = await refreshTokens(rt);
      LDToken.store(tokens);
      return LDToken.getAccess();
    } catch (_) {
      LDToken.clear();
      return null;
    }
  }

  function signOut() {
    LDToken.clear();
    window.location.href = LD_CONFIG.pages.signin;
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  return {
    signInInitiate,
    signInChallenge,
    signInWithPassword,
    signInSubmitMfaOtp,
    getTokens,
    signUpInitiate,
    signUpSubmitOtp,
    signUpSubmitAttributes,
    resetPasswordStart,
    resetPasswordSubmitOtp,
    resetPasswordSubmitNew,
    refreshTokens,
    getValidToken,
    signOut,
    mapError,
  };
})();
