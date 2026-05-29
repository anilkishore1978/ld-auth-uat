window.NACONFIG = {
  CLIENTID: 'a69ee540-cf8e-48fa-ac11-7e42c2d35bc1',
  TENANTID: 'e5075929-5790-466e-9182-c9f4d44f36fe',
  TENANTSUB: 'anilkishore1978',
  PROXY: 'http://localhost:3002/proxy',
  SCOPES: 'openid profile email',
  CHALTYPES: 'oob password redirect',
  pages: {
    signin:          'signin.html',
    register:        'registration.html',
    forgotPassword:  'forgot-password.html',
    forgotUsername:  'forgot-username.html',
    callback:        'callback.html',
    home:            'dashboard.html'   // ← was 'dashbaord.html' (typo) and pointed nowhere
  }
};
window.LDCONFIG = window.NACONFIG;
