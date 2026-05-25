window.NACONFIG = {
  CLIENTID: 'e753b436-8925-4578-a5ad-eedc0f614ce7',
  TENANTID: '5b1ad472-26a6-4a51-b81d-833eb428e9a7',
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
