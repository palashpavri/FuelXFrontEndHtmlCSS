/* FuelX — login & register logic.
   Accounts are kept in localStorage (demo "database"). */

const USERS_KEY = 'fuelx_users';
const SESSION_KEY = 'fuelx_session';
let role = 'user'; // 'user' | 'driver'

/* ---------- storage ---------- */
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* Hash the password before saving (SHA-256; simple fallback if unavailable) */
async function hashPw(pw) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fuelx:' + pw));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (const c of 'fuelx:' + pw) h = (h * 31 + c.charCodeAt(0)) | 0;
    return 'x' + Math.abs(h).toString(16);
  }
}

/* ---------- UI helpers ---------- */
function toast(msg, type = 'info') {
  const colors = { info: 'border-sky-400', success: 'border-emerald-400', error: 'border-rose-400' };
  const el = document.createElement('div');
  el.className = `glass border-l-4 ${colors[type]} rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl transition-all duration-300`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, 3200);
}
function showError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearError() { document.getElementById('form-error').classList.add('hidden'); }

function setRole(r) {
  role = r;
  const on = 'py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition bg-gradient-to-r from-flame-500 to-rose-500 text-white shadow-lg';
  const off = 'py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition text-slate-400 hover:text-white';
  document.getElementById('role-user').className = r === 'user' ? on : off;
  document.getElementById('role-driver').className = r === 'driver' ? on : off;
  const df = document.getElementById('driver-fields');
  if (df) df.classList.toggle('hidden', r !== 'driver');
  clearError();
}

function togglePw(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function checkStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    ['w-0', 'bg-slate-500', 'Use letters, numbers and symbols'],
    ['w-1/5', 'bg-rose-500', 'Very weak'], ['w-2/5', 'bg-orange-500', 'Weak'],
    ['w-3/5', 'bg-yellow-400', 'Okay'], ['w-4/5', 'bg-lime-400', 'Strong'],
    ['w-full', 'bg-emerald-400', 'Very strong']
  ];
  const [w, c, t] = levels[pw ? Math.max(score, 1) : 0];
  document.getElementById('strength-bar').className = `h-full transition-all duration-300 ${w} ${c}`;
  document.getElementById('strength-text').textContent = t;
}

function setLoading(on, text) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = on;
  btn.classList.toggle('opacity-70', on);
  document.getElementById('submit-text').textContent = on ? 'Please wait…' : text;
}

function goHome() { setTimeout(() => (location.href = 'index.html'), 900); }

/* ---------- login ---------- */
async function handleLogin(e) {
  e.preventDefault();
  clearError();
  const phone = document.getElementById('l-phone').value.trim();
  const pass = document.getElementById('l-pass').value;

  if (!/^\d{10}$/.test(phone)) return showError('Enter a valid 10 digit phone number.');
  if (!pass) return showError('Please enter your password.');

  setLoading(true, 'Log in');
  const hash = await hashPw(pass);
  const acc = read(USERS_KEY, []).find(u => u.phone === phone && u.role === role);

  setTimeout(() => {
    if (!acc) { setLoading(false, 'Log in'); return showError(`No ${role} account found for this number. Please register first.`); }
    if (acc.hash !== hash) { setLoading(false, 'Log in'); return showError('Wrong password. Try again.'); }
    write(SESSION_KEY, { name: acc.name, phone: acc.phone, role: acc.role });
    toast(`Welcome back, ${acc.name}!`, 'success');
    goHome();
  }, 600);
}

/* ---------- register ---------- */
async function handleRegister(e) {
  e.preventDefault();
  clearError();
  const name = document.getElementById('r-name').value.trim();
  const phone = document.getElementById('r-phone').value.trim();
  const pass = document.getElementById('r-pass').value;
  const pass2 = document.getElementById('r-pass2').value;

  if (name.length < 3) return showError('Please enter your full name.');
  if (!/^\d{10}$/.test(phone)) return showError('Enter a valid 10 digit phone number.');
  if (role === 'driver' && document.getElementById('r-vno').value.trim().length < 6)
    return showError('Please enter your vehicle number.');
  if (pass.length < 6) return showError('Password must be at least 6 characters.');
  if (pass !== pass2) return showError('Passwords do not match.');

  const users = read(USERS_KEY, []);
  if (users.some(u => u.phone === phone && u.role === role))
    return showError(`This number is already registered as a ${role}. Please log in.`);

  setLoading(true, 'Create account');
  const account = { name, phone, role, hash: await hashPw(pass), created: new Date().toISOString() };
  if (role === 'driver') {
    account.vehicleType = document.getElementById('r-vtype').value;
    account.vehicleNo = document.getElementById('r-vno').value.trim().toUpperCase();
  }
  users.push(account);
  write(USERS_KEY, users);

  setTimeout(() => {
    write(SESSION_KEY, { name, phone, role });
    toast('Account created! Taking you to FuelX…', 'success');
    goHome();
  }, 600);
}

/* ---------- start ---------- */
window.addEventListener('DOMContentLoaded', () => {
  setRole('user');
  if (window.lucide) lucide.createIcons();
});
