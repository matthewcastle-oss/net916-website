// auth.js — include this in every intranet page
// Redirects to login if the user is not authenticated

(function () {
  if (sessionStorage.getItem('f2p_auth') !== 'true') {
    window.location.replace('/intranet/login.html');
  }
})();

function logout() {
  sessionStorage.removeItem('f2p_auth');
  sessionStorage.removeItem('f2p_user');
  window.location.replace('/intranet/login.html');
}
