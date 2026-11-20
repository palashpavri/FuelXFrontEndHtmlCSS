/* FuelX front end — all interactivity (JavaScript) */

const PRICES = { Petrol: 106.5, Diesel: 92.8 };
const FEE = 40;
let fuel = 'Petrol';
let user = { lat: 22.7196, lng: 75.8577 }; // Indore (default)
let map, userMarker, radius, riderMarker, line, timer, requestNo = 1001;

/* ---------- helpers ---------- */
function toast(msg, type = 'info') {
  const colors = { info: 'border-sky-400', success: 'border-emerald-400', error: 'border-rose-400' };
  const el = document.createElement('div');
  el.className = `glass border-l-4 ${colors[type]} rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl transition-all duration-300`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, 3200);
}
function toggleMenu() { document.getElementById('mobile-menu').classList.toggle('hidden'); }
function distanceM(a, b, c, d) {
  const R = 6371e3, r = Math.PI / 180;
  const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

/* ---------- price calculator ---------- */
function setFuel(type) {
  fuel = type;
  ['Petrol', 'Diesel'].forEach(f => {
    const on = f === type;
    document.getElementById('fuel-' + f).className =
      'rounded-2xl border-2 p-3.5 text-left transition ' +
      (on ? 'border-flame-500 bg-flame-500/10' : 'border-white/10 hover:border-white/30');
  });
  updatePrice();
}
function updatePrice() {
  const l = +document.getElementById('litres').value;
  const cost = PRICES[fuel] * l;
  document.getElementById('litres-label').textContent = l + ' L';
  document.getElementById('bill-label').textContent = `${fuel} × ${l} L`;
  document.getElementById('bill-fuel').textContent = '₹' + cost.toFixed(2);
  document.getElementById('bill-total').textContent = '₹' + (cost + FEE).toFixed(2);
}

/* ---------- map ---------- */
function icon(html) {
  return L.divIcon({ className: '', html, iconSize: [36, 36], iconAnchor: [18, 18] });
}
function initMap() {
  if (typeof L === 'undefined') return toast('Map could not load. Check internet.', 'error');
  map = L.map('map', { zoomControl: false }).setView([user.lat, user.lng], 15);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19
  }).addTo(map);

  userMarker = L.marker([user.lat, user.lng], {
    draggable: true,
    icon: icon('<div class="relative w-9 h-9 flex items-center justify-center"><span class="pulse-dot absolute inset-0 rounded-full bg-orange-500/50"></span><span class="w-5 h-5 rounded-full bg-orange-500 border-[3px] border-white shadow-lg"></span></div>')
  }).addTo(map).bindPopup('You are here — drag to adjust');

  radius = L.circle([user.lat, user.lng], { radius: 1000, color: '#f97316', weight: 1.5, fillOpacity: .08, dashArray: '6 6' }).addTo(map);

  userMarker.on('drag', e => setLocation(e.target.getLatLng().lat, e.target.getLatLng().lng, false));
  setLocation(user.lat, user.lng, false);
}
function setLocation(lat, lng, move = true) {
  user = { lat: +lat.toFixed(5), lng: +lng.toFixed(5) };
  document.getElementById('coords').textContent = `${user.lat}, ${user.lng}`;
  if (!map) return;
  radius.setLatLng([lat, lng]);
  if (move) { userMarker.setLatLng([lat, lng]); map.flyTo([lat, lng], 16, { duration: 1.2 }); }
}
function locateMe() {
  if (!navigator.geolocation) return toast('GPS not supported on this device.', 'error');
  toast('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    p => { setLocation(p.coords.latitude, p.coords.longitude); toast('Location locked!', 'success'); },
    () => toast('Location blocked. Drag the pin instead.', 'error')
  );
}

/* ---------- SOS flow (simulated rider) ---------- */
function stepUI(n) {
  for (let i = 1; i <= 4; i++) {
    const li = document.getElementById('s' + i);
    const dot = li.querySelector('.step-dot');
    li.className = 'flex items-center gap-3 ' + (i <= n ? 'text-white' : 'text-slate-400');
    dot.className = 'step-dot w-6 h-6 rounded-full border-2 text-[11px] font-bold flex items-center justify-center ' +
      (i < n ? 'step-done' : i === n ? 'step-now' : 'border-white/20');
    dot.textContent = i < n ? '✓' : i;
  }
  document.getElementById('progress').style.width = (n * 25 - (n === 4 ? 0 : 10)) + '%';
}

function sendSOS(e) {
  e.preventDefault();
  const l = +document.getElementById('litres').value;
  const total = (PRICES[fuel] * l + FEE).toFixed(2);

  document.getElementById('sos-form').classList.add('hidden');
  const card = document.getElementById('track-card');
  card.classList.remove('hidden');
  document.getElementById('track-id').textContent = '#FX-' + requestNo++;
  document.getElementById('track-sub').textContent = `${l} L ${fuel} • ₹${total}`;
  document.getElementById('track-title').textContent = 'Finding a rider…';
  document.getElementById('eta').textContent = '--';
  document.getElementById('dist').textContent = '--';
  stepUI(1);
  toast('SOS sent to nearby riders!', 'success');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // rider starts ~900 m away
  const start = { lat: user.lat + 0.0062, lng: user.lng - 0.0045 };
  const total_m = distanceM(start.lat, start.lng, user.lat, user.lng);
  const TRIP_MS = 20000, t0 = Date.now() + 3000;

  setTimeout(() => {
    if (card.classList.contains('hidden')) return;
    document.getElementById('track-title').textContent = 'Rider assigned';
    stepUI(2);
    riderMarker = L.marker([start.lat, start.lng], { icon: icon('<div class="w-9 h-9 rounded-full bg-white text-xl flex items-center justify-center shadow-lg border-2 border-orange-500">🛵</div>') }).addTo(map);
    line = L.polyline([[start.lat, start.lng], [user.lat, user.lng]], { color: '#f97316', weight: 3, dashArray: '8 8' }).addTo(map);
    map.fitBounds([[start.lat, start.lng], [user.lat, user.lng]], { padding: [60, 60] });
    toast('A rider accepted your request', 'success');
  }, 1800);

  timer = setInterval(() => {
    const t = Math.min(Math.max((Date.now() - t0) / TRIP_MS, 0), 1);
    if (t > 0 && riderMarker) {
      const lat = start.lat + (user.lat - start.lat) * t;
      const lng = start.lng + (user.lng - start.lng) * t;
      riderMarker.setLatLng([lat, lng]);
      line.setLatLngs([[lat, lng], [user.lat, user.lng]]);
      const left = Math.round(total_m * (1 - t));
      document.getElementById('dist').textContent = left + ' m';
      document.getElementById('eta').textContent = Math.max(1, Math.ceil(left / 150)) + ' min';
      document.getElementById('track-title').textContent = 'Rider is on the way';
      stepUI(3);
    }
    if (t >= 1) finishSOS();
  }, 400);
}

function finishSOS() {
  clearInterval(timer);
  stepUI(4);
  document.getElementById('progress').style.width = '100%';
  document.getElementById('track-title').textContent = 'Fuel delivered 🎉';
  document.getElementById('eta').textContent = 'Done';
  document.getElementById('dist').textContent = '0 m';
  toast('Fuel delivered. Drive safe!', 'success');
  setTimeout(resetSOS, 4500);
}
function cancelSOS() { resetSOS(); toast('Request cancelled', 'info'); }
function resetSOS() {
  clearInterval(timer);
  [riderMarker, line].forEach(x => x && map.removeLayer(x));
  riderMarker = line = null;
  document.getElementById('track-card').classList.add('hidden');
  document.getElementById('sos-form').classList.remove('hidden');
  map.flyTo([user.lat, user.lng], 15);
}

/* ---------- scroll-reveal animation ---------- */
function initReveal() {
  const io = new IntersectionObserver(items => items.forEach(i => {
    if (i.isIntersecting) { i.target.classList.add('show'); io.unobserve(i.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* ---------- login state on the main page ---------- */
function initAuthUI() {
  let session = null;
  try { session = JSON.parse(localStorage.getItem('fuelx_session')); } catch {}
  const loggedIn = !!session;
  document.getElementById('auth-buttons').classList.toggle('sm:flex', !loggedIn);
  document.getElementById('auth-buttons').classList.toggle('hidden', loggedIn);
  document.getElementById('mobile-auth').classList.toggle('hidden', loggedIn);
  const chip = document.getElementById('user-chip');
  chip.classList.toggle('hidden', !loggedIn);
  chip.classList.toggle('flex', loggedIn);
  if (loggedIn) {
    document.getElementById('user-chip-name').textContent = session.name.split(' ')[0];
    document.getElementById('user-chip-role').textContent = session.role;
    const nameInput = document.getElementById('name'), phoneInput = document.getElementById('phone');
    if (nameInput && !nameInput.value) nameInput.value = session.name;
    if (phoneInput && !phoneInput.value) phoneInput.value = session.phone;
  }
}
function logoutUser() {
  localStorage.removeItem('fuelx_session');
  initAuthUI();
  toast('Logged out successfully.', 'info');
}

/* ---------- start ---------- */
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  updatePrice();
  initReveal();
  initAuthUI();
  if (window.lucide) lucide.createIcons();
});
