window.NACONFIG = {
  CLIENTID: 'd1141f25-2729-4ea5-9892-f80db4205ebf',
  TENANTID: '36090fda-8a83-4040-8c58-7cf784511505',
  TENANTSUB: 'birlasoftdentalentra',
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
