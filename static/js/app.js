/* ── State ── */
let currentPatients = [];
let editingId       = null;
let deletingId      = null;

/* ── Navigation ── */
function showView(name, forceReset = false) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === name);
  });

  const titles  = { dashboard: 'Dashboard', patients: 'Patients', add: 'Add Patient' };
  document.getElementById('view-title').textContent = titles[name] || name;

  const searchWrap = document.getElementById('search-wrap');
  searchWrap.style.display = name === 'patients' ? 'flex' : 'none';

  if (name === 'dashboard') { loadStats(); loadRecentPatients(); }
  if (name === 'patients')  { loadPatients(); }
  if (name === 'add' && (forceReset || !editingId)) {
    editingId = null;
    resetForm();
  }
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view, btn.dataset.view === 'add'));
});

/* ── API helpers ── */
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Dashboard ── */
async function loadStats() {
  try {
    const s = await api('/api/stats');
    document.getElementById('stat-total').textContent   = s.total;
    document.getElementById('stat-glucose').textContent = s.high_glucose;
    document.getElementById('stat-chol').textContent    = s.high_cholesterol;
    document.getElementById('stat-hb').textContent      = s.low_haemoglobin;
  } catch (e) { console.error(e); }
}

async function loadRecentPatients() {
  try {
    const patients = await api('/api/patients');
    const recent   = patients.slice(0, 5);
    const wrap     = document.getElementById('dashboard-recent');
    if (!recent.length) {
      wrap.innerHTML = '<div class="empty-state"><p>No patients yet. <a href="#" onclick="showView(\'add\', true)">Add the first one</a>.</p></div>';
      return;
    }
    wrap.innerHTML = renderTable(recent, true);
  } catch (e) { console.error(e); }
}

/* ── Patients List ── */
async function loadPatients(q = '') {
  try {
    const url      = q ? `/api/patients?q=${encodeURIComponent(q)}` : '/api/patients';
    currentPatients = await api(url);
    const tbody    = document.getElementById('patients-tbody');
    const noMsg    = document.getElementById('no-patients');
    const tableWrap = document.getElementById('patients-table-wrap');

    if (!currentPatients.length) {
      tbody.innerHTML = '';
      noMsg.style.display    = 'flex';
      tableWrap.querySelector('.data-table').style.display = 'none';
    } else {
      noMsg.style.display = 'none';
      tableWrap.querySelector('.data-table').style.display = '';
      tbody.innerHTML = currentPatients.map(row).join('');
    }
  } catch (e) { console.error(e); }
}

function row(p) {
  const glucBadge = glucoseBadge(p.glucose);
  const cholBadge = cholBadge2(p.cholesterol);
  const hbBadge   = hbBadge2(p.haemoglobin);
  return `<tr>
    <td>${p.id}</td>
    <td><div class="cell-name">${esc(p.full_name)}</div></td>
    <td>${fmtDate(p.dob)}</td>
    <td>${esc(p.email)}</td>
    <td>${glucBadge}</td>
    <td>${hbBadge}</td>
    <td>${cholBadge}</td>
    <td><div class="cell-remarks">${esc(p.remarks)}</div></td>
    <td>
      <button class="btn-icon" title="View" onclick="viewPatient(${p.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="btn-icon" title="Edit" onclick="startEdit(${p.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon del" title="Delete" onclick="confirmDelete(${p.id}, '${esc(p.full_name)}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </td>
  </tr>`;
}

function renderTable(patients, compact = false) {
  if (!patients.length) return '';
  return `<table class="data-table">
    <thead><tr>
      <th>#</th><th>Name</th><th>DOB</th><th>Email</th>
      <th>Glucose</th><th>Hb</th><th>Cholesterol</th><th>Remarks</th>
      ${compact ? '' : '<th>Actions</th>'}
    </tr></thead>
    <tbody>${patients.map(p => compact ? rowCompact(p) : row(p)).join('')}</tbody>
  </table>`;
}

function rowCompact(p) {
  return `<tr>
    <td>${p.id}</td>
    <td><div class="cell-name">${esc(p.full_name)}</div></td>
    <td>${fmtDate(p.dob)}</td>
    <td>${esc(p.email)}</td>
    <td>${glucoseBadge(p.glucose)}</td>
    <td>${hbBadge2(p.haemoglobin)}</td>
    <td>${cholBadge2(p.cholesterol)}</td>
    <td><div class="cell-remarks">${esc(p.remarks)}</div></td>
  </tr>`;
}

/* ── Search ── */
document.getElementById('search-input').addEventListener('input', e => {
  loadPatients(e.target.value.trim());
});

/* ── Form ── */
function resetForm() {
  editingId = null;
  document.getElementById('form-title').textContent    = 'New Patient Record';
  document.getElementById('f-name').value    = '';
  document.getElementById('f-dob').value     = '';
  document.getElementById('f-email').value   = '';
  document.getElementById('f-glucose').value = '';
  document.getElementById('f-hb').value      = '';
  document.getElementById('f-chol').value    = '';
  document.getElementById('f-remarks').textContent = '';
  document.getElementById('remarks-section').style.display = 'none';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('save-label').textContent = 'Save & Predict';
  document.querySelectorAll('.field input').forEach(i => i.classList.remove('err'));
  clearFieldErrors();
}

function clearFieldErrors() {
  ['full_name', 'dob', 'email', 'glucose', 'haemoglobin', 'cholesterol'].forEach(name => {
    const errorEl = document.getElementById(`error-${name}`);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  });
  document.querySelectorAll('.field input').forEach(i => i.classList.remove('err'));
}

function setFieldError(fieldName, message) {
  const errorEl = document.getElementById(`error-${fieldName}`);
  const inputId = fieldName === 'haemoglobin' ? 'hb'
    : fieldName === 'full_name' ? 'name'
    : fieldName === 'cholesterol' ? 'chol'
    : fieldName;
  const inputEl = document.getElementById(`f-${inputId}`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  if (inputEl) {
    inputEl.classList.add('err');
  }
}

function startEdit(id) {
  const p = currentPatients.find(x => x.id === id);
  if (!p) return;
  editingId = id;

  document.getElementById('form-title').textContent = 'Edit Patient Record';
  document.getElementById('f-name').value    = p.full_name;
  document.getElementById('f-dob').value     = p.dob;
  document.getElementById('f-email').value   = p.email;
  document.getElementById('f-glucose').value = p.glucose;
  document.getElementById('f-hb').value      = p.haemoglobin;
  document.getElementById('f-chol').value    = p.cholesterol;

  if (p.remarks) {
    document.getElementById('f-remarks').textContent    = p.remarks;
    document.getElementById('remarks-section').style.display = 'block';
  }
  document.getElementById('save-label').textContent = 'Update & Re-predict';
  document.getElementById('form-error').style.display = 'none';
  clearFieldErrors();

  showView('add');
}

function parseApiValidationErrors(errorText) {
  const errors = errorText.split(/;|\n/).map(s => s.trim()).filter(Boolean);
  const mapping = {
    email: ['email', 'invalid email'],
    dob: ['date of birth', 'future date', 'today', 'dob', 'invalid date', 'calendar date'],
    glucose: ['glucose', 'blood sugar', 'sugar'],
    haemoglobin: ['haemoglobin', 'hemoglobin', 'hb'],
    cholesterol: ['cholesterol'],
  };

  let matched = false;
  errors.forEach(error => {
    const lower = error.toLowerCase();
    Object.entries(mapping).forEach(([field, keywords]) => {
      if (keywords.some(keyword => lower.includes(keyword))) {
        setFieldError(field, error);
        matched = true;
      }
    });
  });
  return matched;
}

async function savePatient() {
  const payload = {
    full_name:   document.getElementById('f-name').value.trim(),
    dob:         document.getElementById('f-dob').value,
    email:       document.getElementById('f-email').value.trim(),
    glucose:     document.getElementById('f-glucose').value,
    haemoglobin: document.getElementById('f-hb').value,
    cholesterol: document.getElementById('f-chol').value,
  };

  // Client-side quick check
  const errBox = document.getElementById('form-error');
  errBox.style.display = 'none';
  clearFieldErrors();
  const missing = Object.entries(payload).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) {
    missing.forEach(field => setFieldError(field, 'This field is required.'));
    errBox.textContent   = 'Please fix the highlighted fields.';
    errBox.style.display = 'block';
    return;
  }

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  let invalid = false;
  if (!EMAIL_RE.test(payload.email)) {
    setFieldError('email', 'Please enter a valid email address.');
    invalid = true;
  }
  if (payload.dob) {
    const dobStr = payload.dob.trim();
    const today = new Date();
    today.setHours(0,0,0,0);

    let year, month, day;
    let matched = false;
    const isoMatch = dobStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const usMatch = dobStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
      matched = true;
    } else if (usMatch) {
      month = parseInt(usMatch[1], 10);
      day = parseInt(usMatch[2], 10);
      year = parseInt(usMatch[3], 10);
      matched = true;
    } else {
      const parsed = new Date(dobStr);
      if (!Number.isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
        matched = true;
      }
    }

    if (!matched) {
      setFieldError('dob', 'Invalid date format.');
      invalid = true;
    } else {
      const dobDate = new Date(year, month - 1, day);
      // Check calendar validity (e.g., Feb 30 -> rolls into Mar 2)
      if (dobDate.getFullYear() !== year || (dobDate.getMonth() + 1) !== month || dobDate.getDate() !== day) {
        const daysInMonth = new Date(year, month, 0).getDate();
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        setFieldError('dob', `Invalid date: ${months[month-1]} has only ${daysInMonth} days`);
        invalid = true;
      } else if (dobDate >= today) {
        setFieldError('dob', 'Date of birth cannot be today or in the future.');
        invalid = true;
      }
    }
  }
  ['glucose', 'haemoglobin', 'cholesterol'].forEach(field => {
    const value = payload[field];
    const number = parseFloat(value);
    if (Number.isNaN(number)) {
      setFieldError(field, 'Must be a numeric value.');
      invalid = true;
    } else if (number < 0) {
      setFieldError(field, 'Value cannot be negative.');
      invalid = true;
    }
  });
  if (invalid) {
    errBox.textContent   = 'Please fix the highlighted fields.';
    errBox.style.display = 'block';
    return;
  }

  setSaving(true);
  try {
    const isNew = !editingId;
    let result;
    if (editingId) {
      result = await api(`/api/patients/${editingId}`, 'PUT', payload);
    } else {
      result = await api('/api/patients', 'POST', payload);
    }

    document.getElementById('f-remarks').textContent    = result.remarks;
    document.getElementById('remarks-section').style.display = 'block';
    loadStats();
    loadPatients();

    if (isNew) {
      editingId = result.id;
      document.getElementById('form-title').textContent = 'Patient Saved';
      document.getElementById('save-label').textContent = 'Update & Re-predict';
    } else {
      editingId = result.id;
      document.getElementById('save-label').textContent = 'Update & Re-predict';
    }
  } catch (e) {
    clearFieldErrors();
    const msg = e.message || 'Request failed';
    const matched = parseApiValidationErrors(msg);
    // Always show backend error message in the visible error box, and
    // still highlight specific fields when we can map the message.
    errBox.textContent = msg;
    errBox.style.display = 'block';
  } finally {
    setSaving(false);
  }
}

function setSaving(on) {
  document.getElementById('save-btn').disabled        = on;
  document.getElementById('save-spinner').style.display = on ? 'inline-block' : 'none';
  document.getElementById('save-label').style.display  = on ? 'none' : 'inline';
}

/* ── View Patient Modal ── */
async function viewPatient(id) {
  try {
    const p = await api(`/api/patients/${id}`);
    document.getElementById('modal-avatar').textContent  = p.full_name[0].toUpperCase();
    document.getElementById('modal-name').textContent    = p.full_name;
    document.getElementById('modal-email').textContent   = p.email;
    document.getElementById('modal-dob').textContent     = fmtDate(p.dob);
    document.getElementById('modal-glucose').textContent = p.glucose + ' mg/dL';
    document.getElementById('modal-hb').textContent      = p.haemoglobin + ' g/dL';
    document.getElementById('modal-chol').textContent    = p.cholesterol + ' mg/dL';
    document.getElementById('modal-remarks').textContent = p.remarks || '—';

    document.getElementById('modal-edit-btn').onclick = () => { closeModal(); startEdit(id); };
    document.getElementById('modal-overlay').style.display = 'flex';
  } catch (e) { alert('Could not load patient: ' + e.message); }
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
}

/* ── Delete ── */
function confirmDelete(id, name) {
  deletingId = id;
  document.getElementById('delete-name').textContent = `"${name}" will be permanently removed.`;
  document.getElementById('delete-overlay').style.display = 'flex';
  document.getElementById('confirm-delete-btn').onclick = doDelete;
}

function closeDelete(e) {
  if (e && e.target !== document.getElementById('delete-overlay')) return;
  document.getElementById('delete-overlay').style.display = 'none';
}

async function doDelete() {
  if (!deletingId) return;
  try {
    await api(`/api/patients/${deletingId}`, 'DELETE');
    closeDelete();
    loadPatients();
    loadStats();
  } catch (e) { alert('Delete failed: ' + e.message); }
}

/* ── Utilities ── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

function glucoseBadge(v) {
  if (v > 126)       return `<span class="badge badge-danger">${v} ↑</span>`;
  if (v > 100)       return `<span class="badge badge-warn">${v} ~</span>`;
  return                    `<span class="badge badge-ok">${v}</span>`;
}
function cholBadge2(v) {
  if (v > 240)       return `<span class="badge badge-danger">${v} ↑</span>`;
  if (v > 200)       return `<span class="badge badge-warn">${v} ~</span>`;
  return                    `<span class="badge badge-ok">${v}</span>`;
}
function hbBadge2(v) {
  if (v < 12)        return `<span class="badge badge-danger">${v} ↓</span>`;
  if (v > 17.5)      return `<span class="badge badge-warn">${v} ↑</span>`;
  return                    `<span class="badge badge-ok">${v}</span>`;
}

/* ── Init ── */
showView('dashboard');