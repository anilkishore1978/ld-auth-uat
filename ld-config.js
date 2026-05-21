/**
 * ld-config.js
 * Liberty Dental UAT — Entra External ID Native Authentication Configuration
 *
 * SAFE FOR PUBLIC REPOSITORY — Client ID is a public client identifier.
 * NEVER add client secrets here. Native Auth SPA flows do not require one.
 *
 * Tenant:    36090fda-8a83-4040-8c58-7cf784511505
 * Client:    d1141f25-2729-4ea5-9892-f80db4205ebf
 * Domain:    anilkishore1978.in  (custom domain for GitHub Pages)
 */

const LD_CONFIG = {

  // ── Entra External ID App Registration ─────────────────────────────────────
  clientId:  'd1141f25-2729-4ea5-9892-f80db4205ebf',
  tenantId:  '36090fda-8a83-4040-8c58-7cf784511505',

  // ── Native Auth API Base URL ────────────────────────────────────────────────
  // Format for Entra External ID (CIAM) tenant:
  //   https://<tenant-subdomain>.ciamlogin.com/<tenantId>
  // OR for a workforce tenant with External ID configured:
  //   https://login.microsoftonline.com/<tenantId>
  //
  // TODO: Replace [TENANT-SUBDOMAIN] with your Entra External ID tenant subdomain
  // Example: if your tenant is "ldpuat.onmicrosoft.com", subdomain is "ldpuat"
  //
  apiBase: 'https://[TENANT-SUBDOMAIN].ciamlogin.com/36090fda-8a83-4040-8c58-7cf784511505',

  // ── Redirect URIs (GitHub Pages with custom domain) ─────────────────────────
  redirectUri:           'https://anilkishore1978.in/callback.html',
  postLogoutRedirectUri: 'https://anilkishore1978.in/signin.html',

  // ── Scopes ──────────────────────────────────────────────────────────────────
  scopes: 'openid profile email offline_access',

  // ── Challenge types supported by the user flow ──────────────────────────────
  challengeTypes: 'password oob',

  // ── Page URLs (for inter-page navigation) ───────────────────────────────────
  pages: {
    signin:          'signin.html',
    registration:    'registration.html',
    forgotPassword:  'forgot-password.html',
    forgotUsername:  'forgot-username.html',
    callback:        'callback.html',
  },

  // ── Application post-login URL ───────────────────────────────────────────────
  // This is the Liberty Dental application page the user lands on after auth.
  // For UAT, point to a test dashboard or a confirmation page.
  postAuthUrl: 'https://memberportal.libertydentalplan.com/',

  // ── Environment ─────────────────────────────────────────────────────────────
  environment: 'UAT',

  // ── Username mode ────────────────────────────────────────────────────────────
  // IMPORTANT: The existing B2C pages use "Username" as the login identifier
  // (operatingMode: "Username" in B2C config). Entra External ID Native Auth
  // uses email as the primary identifier. The Entra External ID user flow
  // MUST be configured with "Email" as the sign-in identifier. UAT users
  // should register with their email address, and that email becomes the username.
  // The field label remains "Username" on screen for visual parity.
  signinIdentifierLabel: 'Username',
};
