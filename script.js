// ══════════════════════════════════════════
//  CONFIGURACIÓN
// ══════════════════════════════════════════
const ADMIN_PASSWORD = 'profe2024';

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC0SvgyEweWQP1dJmF6Uf545iH3dNu75dU",
  authDomain:        "prof-roberto.firebaseapp.com",
  projectId:         "prof-roberto",
  storageBucket:     "prof-roberto.firebasestorage.app",
  messagingSenderId: "757055557614",
  appId:             "1:757055557614:web:c207cb21f552cce34e48ff"
};

const USE_FIREBASE = true;

const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

const ALL_HOURS = [
  '07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00',
  '19:00','20:00','21:00'
];

const DEFAULT_DATA = {
  schedule: [],
  priceOnline: '0',
  priceHome: '0',
  subjects: [
    { id: 'mat1', label: 'Inglés',      color: 'ing', topics: ['Gramática','Conversación','Comprensión lectora','Preparación para exámenes'] },
    { id: 'mat2', label: 'Matemáticas', color: 'mat', topics: ['Aritmética','Geometría','Cálculo básico','Resolución de problemas'] },
    { id: 'mat3', label: 'Álgebra',     color: 'alg', topics: ['Ecuaciones','Funciones','Factorización','Álgebra lineal básica'] }
  ],
  desc: {
    p1: 'Soy profesor particular con pasión por la enseñanza. Mi objetivo es ayudarte a comprender los temas de forma clara, práctica y efectiva.',
    p2: 'Diseño cada clase según tus necesidades, utilizando ejemplos prácticos y ejercicios que te ayudarán a ganar confianza y mejorar tu desempeño académico.'
  },
  photo: '',
  bookedSlots: {},      // { "Lunes_09:00": { name, phone, subject, bookedAt } }
  lastReset: null       // fecha ISO del último reinicio
};

let appData     = loadLocal();
let selectedDay  = null;
let selectedHour = null;
let adminKeySeq  = 0;
let db           = null;

// ══════════════════════════════════════════
//  LOCAL STORAGE
// ══════════════════════════════════════════
function loadLocal() {
  try {
    const saved = localStorage.getItem('re_appdata');
    return saved ? { ...DEFAULT_DATA, ...JSON.parse(saved) } : JSON.parse(JSON.stringify(DEFAULT_DATA));
  } catch { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}
function saveLocal(data) { localStorage.setItem('re_appdata', JSON.stringify(data)); }

// ══════════════════════════════════════════
//  FIREBASE
// ══════════════════════════════════════════
async function initFirebase() {
  if (!USE_FIREBASE) return;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    const ref = doc(db, 'site', 'data');
    onSnapshot(ref, snap => {
      if (snap.exists()) {
        appData = { ...DEFAULT_DATA, ...snap.data() };
        if (!appData.bookedSlots) appData.bookedSlots = {};
        saveLocal(appData);
        checkWeeklyReset();
        applyAll();
      }
    });
  } catch(e) {
    console.warn('Firebase no disponible:', e);
    checkWeeklyReset();
  }
}

async function saveToFirebase(data) {
  if (!USE_FIREBASE || !db) { saveLocal(data); return; }
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(doc(db, 'site', 'data'), data);
    saveLocal(data);
  } catch(e) {
    console.warn('Error guardando:', e);
    saveLocal(data);
  }
}

async function saveBookingToFirebase(slotKey, bookingData) {
  if (!USE_FIREBASE || !db) return;
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    // Guarda en colección separada de citas para historial completo
    const bookingRef = doc(db, 'bookings', `${slotKey}_${Date.now()}`);
    await setDoc(bookingRef, bookingData);
  } catch(e) {
    console.warn('Error guardando cita:', e);
  }
}

// ══════════════════════════════════════════
//  REINICIO SEMANAL (cada lunes)
// ══════════════════════════════════════════
function checkWeeklyReset() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Lun
  const todayStr  = now.toISOString().split('T')[0];

  // Si es lunes y no se ha reiniciado hoy
  if (dayOfWeek === 1 && appData.lastReset !== todayStr) {
    appData.bookedSlots = {};
    appData.lastReset   = todayStr;
    saveToFirebase(appData);
    console.log('✅ Horarios reiniciados automáticamente (lunes)');
  }
}

// ══════════════════════════════════════════
//  INICIALIZACIÓN
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  applyAll();
  scrollReveal();
  initSecretAdminKey();
  renderSubjectCards();
  renderSubjectDropdown();
});

function applyAll() {
  applyPrices();
  applySubjects();
  applyDescription();
  applyPhoto();
}

// ══════════════════════════════════════════
//  ACCESO ADMIN SECRETO (tecla A × 3)
// ══════════════════════════════════════════
function initSecretAdminKey() {
  document.addEventListener('keydown', e => {
    if (e.key === 'a' || e.key === 'A') {
      adminKeySeq++;
      if (adminKeySeq >= 3) { adminKeySeq = 0; openAdminLogin(); }
      clearTimeout(window._adminTimer);
      window._adminTimer = setTimeout(() => adminKeySeq = 0, 1500);
    } else {
      adminKeySeq = 0;
    }
  });
}

// ══════════════════════════════════════════
//  MODALES
// ══════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); document.body.style.overflow='hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow=''; }
function closeOnOverlay(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }

// ══════════════════════════════════════════
//  RESERVAR CLASE + CALENDARIO
// ══════════════════════════════════════════
let calYear  = null;
let calMonth = null;
let selectedCalDate = null;

const JS_DAY_TO_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function openBookingModal() {
  selectedDay = null; selectedHour = null; selectedCalDate = null;
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  showStep('step-day');
  renderCalendar();
  openModal('booking-modal');
}

function showStep(id) {
  ['step-day','step-hour','step-form'].forEach(s => {
    document.getElementById(s).style.display = s === id ? 'block' : 'none';
  });
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('cal-title');
  const grid    = document.getElementById('cal-grid');
  const msg     = document.getElementById('no-days-msg');
  if (!titleEl || !grid) return;

  titleEl.textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
  grid.innerHTML = '';

  if (!appData.schedule || !appData.schedule.length) {
    msg.style.display = 'block';
    return;
  }
  msg.style.display = 'none';

  const today       = new Date();
  today.setHours(0,0,0,0);
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(calYear, calMonth, d);
    const dayName = JS_DAY_TO_ES[date.getDay()];
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast  = date < today;
    const schedIdx = (appData.schedule || []).findIndex(s => s.day === dayName);
    const hasConfig = schedIdx !== -1;

    let available = 0;
    if (hasConfig) {
      available = appData.schedule[schedIdx].hours.filter(h => {
        return !appData.bookedSlots[`${dateStr}_${h}`];
      }).length;
    }

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.textContent = d;
    cell.className = 'cal-cell';

    if (isPast || !hasConfig || available === 0) {
      cell.classList.add((!hasConfig || isPast) ? 'cal-unavailable' : 'cal-full');
      cell.disabled = true;
    } else {
      cell.classList.add('cal-available');
      cell.title = `${available} horario${available!==1?'s':''} disponible${available!==1?'s':''}`;
      cell.onclick = () => selectCalDate(dateStr, dayName, schedIdx, cell);
    }

    if (date.toDateString() === today.toDateString()) cell.classList.add('cal-today');
    if (selectedCalDate && selectedCalDate.dateStr === dateStr) cell.classList.add('cal-selected');

    grid.appendChild(cell);
  }
}

function selectCalDate(dateStr, dayName, schedIdx, cell) {
  document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('cal-selected'));
  cell.classList.add('cal-selected');
  selectedCalDate = { dateStr, dayName, schedIdx };
  selectedDay = schedIdx;

  const [y, m, d] = dateStr.split('-');
  const label = `${dayName} ${parseInt(d)} de ${MONTH_NAMES[parseInt(m)-1]} ${y}`;
  document.getElementById('selected-day-label').textContent = label;

  setTimeout(() => {
    renderHoursForDate(dateStr, schedIdx);
    showStep('step-hour');
  }, 180);
}

function renderHoursForDate(dateStr, index) {
  const grid = document.getElementById('hours-grid');
  grid.innerHTML = '';
  (appData.schedule[index].hours || []).forEach(h => {
    const slotKey  = `${dateStr}_${h}`;
    const isBooked = !!appData.bookedSlots[slotKey];
    const btn = document.createElement('button');
    btn.className = 'hour-btn' + (isBooked ? ' hour-booked' : '');
    btn.disabled  = isBooked;
    btn.innerHTML = isBooked ? `${h}<span class="booked-label">Agendado</span>` : h;
    if (!isBooked) btn.onclick = () => selectHour(h, btn);
    grid.appendChild(btn);
  });
}

function renderHours(index) {
  if (selectedCalDate) renderHoursForDate(selectedCalDate.dateStr, index);
}

function renderDays() {} // compatibilidad

function selectDay(index, btn) {} // compatibilidad

function selectHour(hour, btn) {
  document.querySelectorAll('.hour-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedHour = hour;
  setTimeout(() => {
    const label = document.getElementById('selected-day-label').textContent;
    document.getElementById('summary-text').textContent = `${label} a las ${selectedHour}`;
    showStep('step-form');
  }, 180);
}

function goBack()      { showStep('step-day'); setTimeout(renderCalendar, 50); }
function goBackToDay() { showStep('step-hour'); }

// ── Validación de inputs ──
function initInputValidation() {
  const nameInput  = document.getElementById('student-name');
  const phoneInput = document.getElementById('student-phone');
  if (!nameInput || !phoneInput) return;

  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s,\.]/g, '');
  });
  nameInput.addEventListener('keydown', e => {
    const allowed = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s,\.]$/;
    if (!allowed.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) e.preventDefault();
  });
  phoneInput.addEventListener('input', () => {
    // Solo dígitos, máximo 10
    let digits = phoneInput.value.replace(/[^0-9]/g, '').slice(0, 10);
    // Formatea como 000-0000-000
    let formatted = digits;
    if (digits.length > 3 && digits.length <= 7) {
      formatted = digits.slice(0,3) + '-' + digits.slice(3);
    } else if (digits.length > 7) {
      formatted = digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7);
    }
    phoneInput.value = formatted;
  });
  phoneInput.addEventListener('keydown', e => {
    const allowed = /^[0-9]$/;
    if (!allowed.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) e.preventDefault();
  });
}

async function sendBookingWA() {
  const name    = document.getElementById('student-name').value.trim();
  const phone   = document.getElementById('student-phone').value.trim();
  const subject = document.getElementById('student-subject').value;
  if (!name || !phone || !subject) { alert('Por favor llena todos los campos.'); return; }

  const dateStr = selectedCalDate ? selectedCalDate.dateStr : null;
  const dayName = selectedCalDate ? selectedCalDate.dayName : appData.schedule[selectedDay].day;
  const slotKey = `${dateStr || dayName}_${selectedHour}`;

  if (!appData.bookedSlots) appData.bookedSlots = {};
  const bookingData = {
    name, phone, subject,
    day:      dayName,
    date:     dateStr || '',
    hour:     selectedHour,
    bookedAt: new Date().toISOString()
  };
  appData.bookedSlots[slotKey] = bookingData;

  await saveToFirebase(appData);
  await saveBookingToFirebase(slotKey, bookingData);

  const dateLabel = document.getElementById('selected-day-label').textContent;
  const msg = encodeURIComponent(
    `Hola Prof., me llamo *${name}*.\n` +
    `Quisiera reservar una clase de *${subject}*.\n` +
    `Fecha y hora: *${dateLabel} a las ${selectedHour}*.\n` +
    `Mi número: ${phone}`
  );
  window.open(`https://wa.me/524425590171?text=${msg}`, '_blank');
  closeModal('booking-modal');
  showToast('¡Cita agendada correctamente!');
}

// ══════════════════════════════════════════
//  ADMIN: LOGIN
// ══════════════════════════════════════════
function openAdminLogin() { openModal('admin-login-modal'); }

function checkAdminLogin() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    closeModal('admin-login-modal');
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    openAdminPanel();
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

// ══════════════════════════════════════════
//  ADMIN: PANEL
// ══════════════════════════════════════════
function openAdminPanel() {
  document.getElementById('admin-price-online').value = appData.priceOnline;
  document.getElementById('admin-price-home').value   = appData.priceHome;
  document.getElementById('admin-desc-p1').value      = appData.desc.p1;
  document.getElementById('admin-desc-p2').value      = appData.desc.p2;
  loadAdminSubjects();
  renderScheduleEditor();
  syncPhotoPreview();
  renderBookingsTable();
  switchTab('tab-schedule');
  document.getElementById('admin-save-msg').style.display = 'none';
  openModal('admin-panel-modal');
  enablePublicPhotoEdit();
}

function switchTab(tabId) {
  const ids = ['tab-schedule','tab-prices','tab-subjects','tab-desc','tab-photo','tab-bookings'];
  document.querySelectorAll('.admin-tab').forEach((t, i) => t.classList.toggle('active', ids[i] === tabId));
  document.querySelectorAll('.admin-tab-content').forEach(c => { c.style.display = c.id === tabId ? 'block' : 'none'; });
  if (tabId === 'tab-bookings') renderBookingsTable();
}

// ══════════════════════════════════════════
//  CITAS AGENDADAS
// ══════════════════════════════════════════
function renderBookingsTable() {
  const container = document.getElementById('bookings-container');
  if (!container) return;
  const slots = appData.bookedSlots || {};
  const keys  = Object.keys(slots);

  if (!keys.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:20px 0">No hay citas agendadas esta semana.</p>';
    return;
  }

  // Ordena por día de la semana
  keys.sort((a, b) => {
    const dayA = DAYS_ES.indexOf(slots[a].day);
    const dayB = DAYS_ES.indexOf(slots[b].day);
    return dayA !== dayB ? dayA - dayB : slots[a].hour.localeCompare(slots[b].hour);
  });

  const formatDate = (dateStr, dayName) => {
    if (!dateStr) return dayName || '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${dayName} ${parseInt(d)}/${months[parseInt(m)-1]}`;
  };

  container.innerHTML = `
    <table class="bookings-table">
      <thead>
        <tr>
          <th>Fecha</th><th>Hora</th><th>Nombre</th><th>Teléfono</th><th>Materia</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${keys.map(k => `
          <tr>
            <td>${formatDate(slots[k].date, slots[k].day)}</td>
            <td>${slots[k].hour}</td>
            <td>${slots[k].name}</td>
            <td>${slots[k].phone}</td>
            <td>${slots[k].subject}</td>
            <td><button class="cancel-btn" onclick="cancelBooking('${k}')">✕</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function cancelBooking(slotKey) {
  if (!confirm('¿Cancelar esta cita y liberar el horario?')) return;
  delete appData.bookedSlots[slotKey];
  await saveToFirebase(appData);
  renderBookingsTable();
  showSaveMsg();
}

// ── Exportar a Excel (.xlsx) ──
function exportToExcel() {
  const slots = appData.bookedSlots || {};
  const keys  = Object.keys(slots);
  if (!keys.length) { alert('No hay citas para exportar.'); return; }

  keys.sort((a, b) => {
    const dayA = DAYS_ES.indexOf(slots[a].day);
    const dayB = DAYS_ES.indexOf(slots[b].day);
    return dayA !== dayB ? dayA - dayB : slots[a].hour.localeCompare(slots[b].hour);
  });

  // Construye CSV con BOM para que Excel lo abra con tildes
  const BOM = '\uFEFF';
  const headers = ['Día','Hora','Nombre','Teléfono','Materia','Fecha de reserva'];
  const rows = keys.map(k => {
    const b = slots[k];
    const fecha = b.bookedAt ? new Date(b.bookedAt).toLocaleString('es-MX') : '';
    return [b.day, b.hour, b.name, b.phone, b.subject, fecha]
      .map(v => `"${String(v).replace(/"/g,'""')}"`)
      .join(',');
  });

  const csv  = BOM + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const week = new Date().toISOString().split('T')[0];
  a.href     = url;
  a.download = `citas_semana_${week}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo descargado — ábrelo con Excel');
}

// ── Reinicio manual de citas ──
async function resetBookingsManual() {
  if (!confirm('¿Reiniciar todas las citas de esta semana? Esta acción no se puede deshacer.')) return;
  appData.bookedSlots = {};
  appData.lastReset   = new Date().toISOString().split('T')[0];
  await saveToFirebase(appData);
  renderBookingsTable();
  showSaveMsg();
}

// ══════════════════════════════════════════
//  HORARIOS
// ══════════════════════════════════════════
function renderScheduleEditor() {
  const editor = document.getElementById('schedule-editor');
  editor.innerHTML = '';
  appData.schedule.forEach((item, i) => addScheduleRow(editor, item.day, item.hours, i));
}

function addScheduleDay() {
  const usedDays = Array.from(document.querySelectorAll('.schedule-row select')).map(s => s.value);
  const available = DAYS_ES.find(d => !usedDays.includes(d)) || 'Lunes';
  const editor = document.getElementById('schedule-editor');
  addScheduleRow(editor, available, [], editor.children.length);
}

function addScheduleRow(editor, day, selectedHours, index) {
  const row = document.createElement('div');
  row.className = 'schedule-row';

  const sel = document.createElement('select');
  sel.className = 'day-select';
  DAYS_ES.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    if (d === day) opt.selected = true;
    sel.appendChild(opt);
  });

  const hoursWrap = document.createElement('div');
  hoursWrap.className = 'hours-chips-editor';
  const hoursLabel = document.createElement('p');
  hoursLabel.className = 'hours-label';
  hoursLabel.textContent = 'Selecciona los horarios disponibles:';
  hoursWrap.appendChild(hoursLabel);

  const chipsGrid = document.createElement('div');
  chipsGrid.className = 'chips-grid';
  ALL_HOURS.forEach(h => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'hour-chip' + (selectedHours.includes(h) ? ' active' : '');
    chip.textContent = h;
    chip.onclick = () => chip.classList.toggle('active');
    chipsGrid.appendChild(chip);
  });
  hoursWrap.appendChild(chipsGrid);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'remove-day-btn';
  rm.title = 'Eliminar día';
  rm.innerHTML = '×';
  rm.onclick = () => row.remove();

  row.appendChild(sel);
  row.appendChild(hoursWrap);
  row.appendChild(rm);
  editor.appendChild(row);
}

function saveSchedule() {
  const newSchedule = [];
  document.querySelectorAll('.schedule-row').forEach(row => {
    const day   = row.querySelector('select').value;
    const hours = Array.from(row.querySelectorAll('.hour-chip.active')).map(c => c.textContent);
    if (hours.length > 0) newSchedule.push({ day, hours });
  });
  appData.schedule = newSchedule;
  saveToFirebase(appData);
  showSaveMsg();
}

// ══════════════════════════════════════════
//  PRECIOS
// ══════════════════════════════════════════
function savePrices() {
  appData.priceOnline = document.getElementById('admin-price-online').value || '0';
  appData.priceHome   = document.getElementById('admin-price-home').value   || '0';
  saveToFirebase(appData);
  applyPrices();
  showSaveMsg();
}

function applyPrices() {
  document.getElementById('price-online').textContent = appData.priceOnline;
  document.getElementById('price-home').textContent   = appData.priceHome;
}

// ══════════════════════════════════════════
//  MATERIAS
// ══════════════════════════════════════════
function loadAdminSubjects() {
  const container = document.getElementById('admin-subjects-container');
  container.innerHTML = '';
  appData.subjects.forEach((subj, i) => {
    const card = document.createElement('div');
    card.className = 'admin-subject-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="admin-subject-header">
        <div class="form-group" style="flex:1;margin:0">
          <label>Nombre de la materia</label>
          <input type="text" class="subj-name" value="${subj.label}" placeholder="Ej. Física" />
        </div>
        <div class="form-group" style="width:130px;margin:0">
          <label>Color</label>
          <select class="subj-color">
            <option value="ing" ${subj.color==='ing'?'selected':''}>Azul marino</option>
            <option value="mat" ${subj.color==='mat'?'selected':''}>Verde</option>
            <option value="alg" ${subj.color==='alg'?'selected':''}>Morado</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:10px">
        <label>Temas (uno por línea)</label>
        <textarea class="subj-topics" rows="4">${subj.topics.join('\n')}</textarea>
      </div>
    `;
    container.appendChild(card);
  });
}

function saveSubjects() {
  const newSubjects = [];
  document.querySelectorAll('.admin-subject-card').forEach((card, i) => {
    const label  = card.querySelector('.subj-name').value.trim() || `Materia ${i+1}`;
    const color  = card.querySelector('.subj-color').value;
    const topics = card.querySelector('.subj-topics').value.split('\n').map(t=>t.trim()).filter(Boolean);
    const id     = appData.subjects[i] ? appData.subjects[i].id : `mat${Date.now()}${i}`;
    newSubjects.push({ id, label, color, topics });
  });
  appData.subjects = newSubjects;
  saveToFirebase(appData);
  applySubjects();
  renderSubjectDropdown();
  showSaveMsg();
}

function applySubjects() { renderSubjectCards(); renderSubjectDropdown(); }

function renderSubjectCards() {
  const grid = document.getElementById('subjects-grid-public');
  if (!grid) return;
  const iconMap = {
    ing: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    mat: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    alg: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
  };
  grid.innerHTML = appData.subjects.map(s => `
    <div class="subject-card">
      <div class="subject-icon ${s.color}">${iconMap[s.color] || iconMap['ing']}</div>
      <h3 class="${s.color}">${s.label}</h3>
      <ul>${s.topics.map(t=>`<li>${t}</li>`).join('')}</ul>
    </div>
  `).join('');
  scrollReveal();
  updateHeroTitle();
}

function updateHeroTitle() {
  const hero = document.getElementById('hero-subjects');
  if (!hero || !appData.subjects.length) return;
  const colors = ['subject-1','subject-2','subject-3'];
  const parts  = appData.subjects.map((s, i) => `<span class="${colors[i] || colors[2]}">${s.label}</span>`);
  let html = parts.length === 1 ? parts[0]
           : parts.length === 2 ? parts[0] + ' y ' + parts[1]
           : parts.slice(0,-1).join(', ') + '<br>y&nbsp;' + parts[parts.length-1];
  hero.innerHTML = html;
}

function renderSubjectDropdown() {
  const sel = document.getElementById('student-subject');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecciona...</option>' +
    appData.subjects.map(s => `<option value="${s.label}" ${s.label===current?'selected':''}>${s.label}</option>`).join('');
}

// ══════════════════════════════════════════
//  DESCRIPCIÓN
// ══════════════════════════════════════════
function saveDescription() {
  appData.desc.p1 = document.getElementById('admin-desc-p1').value.trim();
  appData.desc.p2 = document.getElementById('admin-desc-p2').value.trim();
  saveToFirebase(appData);
  applyDescription();
  showSaveMsg();
}

function applyDescription() {
  const p1 = document.getElementById('about-p1');
  const p2 = document.getElementById('about-p2');
  if (p1) p1.textContent = appData.desc.p1;
  if (p2) p2.textContent = appData.desc.p2;
}

// ══════════════════════════════════════════
//  FOTO
// ══════════════════════════════════════════
function syncPhotoPreview() {
  const pi      = document.getElementById('admin-avatar-preview-img');
  const svgIcon = document.getElementById('admin-avatar-svg');
  if (appData.photo) {
    pi.src = appData.photo; pi.style.display = 'block';
    if (svgIcon) svgIcon.style.display = 'none';
    document.getElementById('btn-delete-photo').style.display = 'inline-flex';
  } else {
    pi.style.display = 'none';
    if (svgIcon) svgIcon.style.display = 'block';
    document.getElementById('btn-delete-photo').style.display = 'none';
  }
}

function adminPreviewAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { appData.photo = e.target.result; syncPhotoPreview(); };
  reader.readAsDataURL(file);
}

function saveAdminPhoto() {
  if (!appData.photo) { alert('Por favor selecciona una foto primero.'); return; }
  saveToFirebase(appData);
  applyPhoto();
  showSaveMsg();
}

function deleteAdminPhoto() {
  if (!confirm('¿Eliminar la foto de perfil?')) return;
  appData.photo = '';
  saveToFirebase(appData);
  applyPhoto();
  syncPhotoPreview();
  document.getElementById('admin-avatar-input').value = '';
  showSaveMsg();
}

function applyPhoto() {
  const img     = document.getElementById('avatar-img');
  const svgMain = document.getElementById('avatar-svg-main');
  if (appData.photo) {
    img.src = appData.photo; img.style.display = 'block';
    if (svgMain) svgMain.style.display = 'none';
  } else {
    img.style.display = 'none';
    if (svgMain) svgMain.style.display = 'block';
  }
}

function enablePublicPhotoEdit() {
  const avatar = document.getElementById('avatar-display');
  avatar.classList.add('clickable');
  avatar.onclick = () => document.getElementById('admin-avatar-input').click();
  document.getElementById('avatar-hint').style.display = 'block';
}

// ══════════════════════════════════════════
//  NOTIFICACIONES
// ══════════════════════════════════════════
function showSaveMsg() {
  const msg = document.getElementById('admin-save-msg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display='none', 2500);
  showToast('¡Cambios guardados correctamente!');
}

function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span>${message}</span>`;
  toast.classList.remove('toast-hide');
  toast.classList.add('toast-show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
  }, 3000);
}

// ══════════════════════════════════════════
//  SCROLL REVEAL
// ══════════════════════════════════════════
function scrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.subject-card, .price-card, .mode-card, .level-chip, .perk-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    observer.observe(el);
  });
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior:'smooth', block:'start' }); }
  });
});

const _origOpen = window.openBookingModal;
window.openBookingModal = function() {
  _origOpen ? _origOpen() : null;
  setTimeout(initInputValidation, 100);
};
['step-day','step-hour','step-form'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { const obs = new MutationObserver(() => initInputValidation()); obs.observe(el, { attributes:true, attributeFilter:['style'] }); }
});