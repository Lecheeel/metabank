export function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

export function setUser(user, token) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
}

export function logout() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}
