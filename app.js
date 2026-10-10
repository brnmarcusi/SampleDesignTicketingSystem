/* IT Help Desk Ticketing System — CRUD on a JSON dataset (data.json seeds localStorage) */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = 'itHelpDeskDB', PR = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const ST = ['Pending', 'In Progress', 'Resolved', 'Closed'], DONE = ['Resolved', 'Closed'];
let DB, editing, lastMsg = '';

/* ---------- helpers ---------- */
const now = () => new Date().toISOString();
const fmt = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const save = () => localStorage.setItem(KEY, JSON.stringify(DB));
const find = id => DB.tickets.find(t => t.id === id);
const log = (id, action, by) => DB.audit.push({ at: now(), id, by: by || DB.user.name, action });
const opts = (a, v, blank) => (blank ? `<option value="">${blank}</option>` : '') + a.map(x => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
const pill = v => `<span class="pill ${v.replace(/\s/g, '')}">${esc(v)}</span>`;
const localDay = t => new Date(t.created).toLocaleDateString('sv');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- load JSON data ---------- */
async function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (DB) return;
  try { DB = await (await fetch('data.json')).json(); }
  catch (e) {
    DB = { categories: ['Hardware', 'Software', 'Network', 'Account & Access', 'Email', 'Printer', 'Security', 'Other'], technicians: [], knowledgeBase: [], tickets: [] };
    setTimeout(() => toast('data.json not loaded — open the folder with a local server to get the sample data'), 600);
  }
  DB.audit = []; DB.user = DB.user || { name: 'Tech Username', role: 'Support Agent' };
  DB.tickets.forEach(t => {
    const c = Date.now() - (t.hoursAgo || 0) * 36e5;
    t.created = t.updated = new Date(c).toISOString();
    t.firstResponse = t.respondedAfterH != null ? new Date(c + t.respondedAfterH * 36e5).toISOString() : null;
    delete t.hoursAgo; delete t.respondedAfterH; t.notes = [];
    DB.audit.push({ at: t.created, id: t.id, by: t.name, action: 'Ticket created' });
  });
  DB.nextId = 1001 + DB.tickets.length; save();
}

/* ---------- 9. validation ---------- */
function validate(f, ignoreId) {
  const e = [];
  if (!f.name.trim()) e.push('Name is required.');
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.push('A valid email is required.');
  if (!f.type) e.push('Select an issue type.');
  if (!f.priority) e.push('Select a priority.');
  if (f.subject.trim().length < 5) e.push('Subject must be at least 5 characters.');
  if (f.description.trim().length < 15) e.push('Description must be at least 15 characters.');
  const dup = DB.tickets.find(t => t.id !== ignoreId && !DONE.includes(t.status) && t.email.toLowerCase() === f.email.trim().toLowerCase()
    && t.type === f.type && t.subject.trim().toLowerCase() === f.subject.trim().toLowerCase());
  if (dup) e.push(`Duplicate: active ticket ${dup.id} already has this subject and issue type.`);
  return e;
}

/* ---------- navigation ---------- */
function go(v) {
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'profile') { $('#f-prof').pname.value = DB.user.name; $('#f-prof').prole.value = DB.user.role; }
  render();
}

/* ---------- 2/5. list, sort, filter ---------- */
function filtered() {
  const q = $('#q').value.toLowerCase().trim(), s = $('#fs').value, p = $('#fp').value, a = $('#fa').value, d1 = $('#fd1').value, d2 = $('#fd2').value, k = $('#sort').value;
  const r = DB.tickets.filter(t =>
    (!q || [t.id, t.subject, t.description, t.name, t.email, t.type, t.assigned].join(' ').toLowerCase().includes(q)) &&
    (!s || t.status === s) && (!p || t.priority === p) &&
    (!a || (a === '_' ? !t.assigned : t.assigned === a)) &&
    (!d1 || localDay(t) >= d1) && (!d2 || localDay(t) <= d2));
  return r.sort((x, y) => k === 'priority' ? PR[y.priority] - PR[x.priority] : k === 'status' ? ST.indexOf(x.status) - ST.indexOf(y.status)
    : k === 'old' ? x.created.localeCompare(y.created) : y.created.localeCompare(x.created));
}
const head = '<thead><tr><th>Ticket ID</th><th>Subject</th><th>Requester</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Date Created</th><th></th></tr></thead>';
const row = (t, full) => `<tr><td>#${t.id}</td><td>${esc(t.subject)}</td><td>${esc(t.name)}</td><td>${pill(t.priority)}</td><td>${pill(t.status)}</td>
  <td>${esc(t.assigned) || '<i>Unassigned</i>'}</td><td>${fmt(t.created)}</td>
  <td class="act"><button data-open="${t.id}">View / Edit</button>${full ? `<button class="danger" data-del="${t.id}">Delete</button>` : ''}</td></tr>`;
const table = (l, full) => l.length ? `<table>${head}<tbody>${l.map(t => row(t, full)).join('')}</tbody></table>` : '<p class="empty">No tickets match. Submit a ticket or clear the filters.</p>';
function list() { const r = filtered(); $('#count').textContent = `Showing ${r.length} of ${DB.tickets.length} tickets`; $('#tlist').innerHTML = table(r, true); }

/* ---------- dashboard ---------- */
function wk(f) {
  const n = Date.now(), w = 6048e5, c = DB.tickets.filter(f), age = t => n - new Date(t.created);
  const a = c.filter(t => age(t) < w).length, b = c.filter(t => age(t) >= w && age(t) < 2 * w).length;
  return b ? Math.round((a - b) / b * 100) : null;
}
function dash() {
  const h = new Date().getHours(), T = DB.tickets;
  $('#greet').textContent = `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${DB.user.name.split(' ')[0]}!`;
  const C = [['total', '🎫', 'Total Tickets', () => true], ['pending', '⏳', 'Pending Tickets', t => t.status === 'Pending'],
    ['resolved', '✅', 'Resolved Tickets', t => DONE.includes(t.status)], ['prog', '🔄', 'In Progress', t => t.status === 'In Progress']];
  $('#cards').innerHTML = C.map(([c, i, l, f]) => { const p = wk(f);
    return `<div class="card ${c}"><span class="ic">${i}</span><div><h4>${l}</h4><b>${T.filter(f).length}</b></div>
    <small class="${p < 0 ? 'dn' : 'up'}">${p === null ? 'no prior week' : (p < 0 ? '↓' : '↑') + Math.abs(p) + '% vs. last week'}</small></div>`; }).join('');
  $('#recent').innerHTML = table([...T].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 5), false);
}

/* ---------- 7. reports ---------- */
function reports() {
  const T = DB.tickets, d = T.filter(t => DONE.includes(t.status)).length, r = T.filter(t => t.firstResponse);
  const avg = r.length ? r.reduce((s, t) => s + (new Date(t.firstResponse) - new Date(t.created)), 0) / r.length / 6e4 : null;
  const cnt = {}; T.forEach(t => cnt[t.type] = (cnt[t.type] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]), mx = top.length ? top[0][1] : 1;
  const S = [['Total tickets', T.length], ['Pending', T.filter(t => t.status === 'Pending').length], ['In progress', T.filter(t => t.status === 'In Progress').length],
    ['Resolved / closed', d], ['Resolution rate', T.length ? Math.round(d / T.length * 100) + '%' : '0%'],
    ['Avg. response time', avg == null ? 'N/A' : avg >= 60 ? (avg / 60).toFixed(1) + ' h' : Math.round(avg) + ' min']];
  $('#rstats').innerHTML = S.map(([l, v]) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`).join('');
  $('#rtop').innerHTML = top.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${v / mx * 100}%"></i><em>${v}</em></div>`).join('') || '<p class="empty">No tickets yet.</p>';
  $('#raudit').innerHTML = [...DB.audit].reverse().slice(0, 15).map(a => `<li><b>${a.id}</b> ${esc(a.action)} <small>${esc(a.by)} · ${fmt(a.at)}</small></li>`).join('');
}

/* ---------- settings ---------- */
function settings() {
  $('#techs').innerHTML = DB.technicians.map(t => `<li><b>${esc(t.name)}</b><small>${esc(t.skills.join(', '))} · ${DB.tickets.filter(x => x.assigned === t.name && !DONE.includes(x.status)).length} active</small>
    <button class="danger" data-rmtech="${t.id}">Remove</button></li>`).join('') || '<p class="empty">No technicians yet.</p>';
  $('#skills').innerHTML = DB.categories.map(c => `<label class="chk"><input type="checkbox" value="${esc(c)}">${esc(c)}</label>`).join('');
}
function selects() {
  const ty = $('#type'), fa = $('#fa'), tv = ty.value, av = fa.value;
  ty.innerHTML = opts(DB.categories, tv, 'Select issue type…');
  fa.innerHTML = '<option value="">All assignees</option><option value="_">Unassigned</option>' + opts(DB.technicians.map(t => t.name), av); fa.value = av;
}
function render() {
  selects(); dash(); list(); reports(); settings();
  $('#uname').textContent = DB.user.name; $('#urole').textContent = DB.user.role;
}

/* ---------- 3. assignment ---------- */
function suggest(type) {
  const c = DB.technicians.filter(t => t.skills.includes(type)), pool = [...(c.length ? c : DB.technicians)];
  const loadOf = n => DB.tickets.filter(t => t.assigned === n && !DONE.includes(t.status)).length;
  return pool.sort((a, b) => loadOf(a.name) - loadOf(b.name))[0]?.name || '';
}

/* ---------- 1. create ---------- */
$('#f-new').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), er = validate(f);
  $('#e-new').innerHTML = er.map(x => '• ' + esc(x)).join('<br>');
  if (er.length) return;
  const t = { id: 'HD-' + DB.nextId++, ...f, name: f.name.trim(), email: f.email.trim(), subject: f.subject.trim(), description: f.description.trim(),
    status: 'Pending', assigned: '', resolution: '', created: now(), updated: now(), firstResponse: null, notes: [] };
  DB.tickets.push(t); log(t.id, 'Ticket created', t.name); save(); e.target.reset(); render(); toast(`Ticket ${t.id} submitted`); go('tickets');
};

/* ---------- 6/4/10. view, edit, notes, status, history ---------- */
function openTicket(id) {
  const t = find(id); if (!t) return; editing = id;
  const hist = DB.audit.filter(a => a.id === id).reverse();
  $('#mbody').innerHTML = `<h3>#${t.id} <small>${esc(t.name)} · ${esc(t.email)} ${esc(t.phone || '')}</small></h3>
  <form id="f-edit" novalidate><div class="g2">
    <label>Issue type<select name="type">${opts(DB.categories, t.type)}</select></label>
    <label>Priority<select name="priority">${opts(Object.keys(PR), t.priority)}</select></label>
    <label>Status<select name="status">${opts(ST, t.status)}</select></label>
    <label>Assigned technician<select name="assigned">${opts(DB.technicians.map(x => x.name), t.assigned, 'Unassigned')}</select></label></div>
    <button type="button" id="auto" class="mini">⚡ Auto-assign by issue type</button>
    <label style="margin-top:12px">Subject<input name="subject" value="${esc(t.subject)}"></label>
    <label>Description<textarea name="description" rows="3">${esc(t.description)}</textarea></label>
    <label>Resolution<textarea name="resolution" rows="2" placeholder="Required when status is Resolved or Closed">${esc(t.resolution)}</textarea></label>
    <div class="err" id="e-edit"></div>
    <button class="primary">Save changes</button> <button type="button" class="mini danger" data-del="${t.id}">Delete ticket</button></form>
  <h4>Notes &amp; replies</h4>${t.notes.map(n => `<div class="note">${esc(n.text)}<br><small>${esc(n.by)} · ${fmt(n.at)}</small></div>`).join('') || '<p class="hint">No notes yet.</p>'}
  <div class="row"><input id="note" placeholder="Add a note or reply…"><button id="addnote" class="primary">Add</button></div>
  <h4>History</h4><ul class="hist">${hist.map(a => `<li>${esc(a.action)} <small>${esc(a.by)} · ${fmt(a.at)}</small></li>`).join('')}</ul>`;
  $('#modal').classList.add('show');
}
$('#mbody').addEventListener('submit', e => {
  if (e.target.id !== 'f-edit') return; e.preventDefault();
  const t = find(editing), f = Object.fromEntries(new FormData(e.target));
  const er = validate({ ...t, ...f }, t.id);
  if (DONE.includes(f.status) && f.resolution.trim().length < 5) er.push('Add a resolution (5+ characters) before resolving or closing.');
  $('#e-edit').innerHTML = er.map(x => '• ' + esc(x)).join('<br>'); if (er.length) return;
  ['type', 'priority', 'status', 'assigned', 'subject', 'description', 'resolution'].forEach(k => {
    if (t[k] === f[k]) return;
    log(t.id, k === 'status' ? `Status changed: ${t.status} → ${f.status}` : k === 'assigned' ? `Assigned to ${f.assigned || 'nobody'} (was ${t.assigned || 'unassigned'})`
      : k === 'resolution' ? 'Resolution updated: ' + f.resolution.slice(0, 60) : `${k[0].toUpperCase() + k.slice(1)} updated`);
    if (!t.firstResponse && (k === 'status' || (k === 'assigned' && f.assigned))) t.firstResponse = now();
    t[k] = f[k];
  });
  t.updated = now(); save(); render(); openTicket(t.id); toast('Ticket updated');
});
$('#mbody').addEventListener('click', e => {
  const t = find(editing);
  if (e.target.id === 'auto') { const f = $('#f-edit'); f.assigned.value = suggest(f.type.value); }
  if (e.target.id === 'addnote') {
    const x = $('#note').value.trim(); if (!x) return toast('Write a note first');
    t.notes.push({ by: DB.user.name, text: x, at: now() }); log(t.id, 'Note added: ' + x.slice(0, 60));
    if (!t.firstResponse) t.firstResponse = now(); t.updated = now(); save(); render(); openTicket(t.id);
  }
});
const closeModal = () => $('#modal').classList.remove('show');
$('#mclose').onclick = closeModal; $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

/* ---------- global click handling (navigation, delete) ---------- */
document.addEventListener('click', e => {
  const d = e.target.closest('button')?.dataset || {};
  if (d.v) go(d.v);
  if (d.open) openTicket(d.open);
  if (d.del && confirm(`Delete ticket ${d.del}? This cannot be undone.`)) {
    DB.tickets = DB.tickets.filter(t => t.id !== d.del); log(d.del, 'Ticket deleted'); save(); closeModal(); render(); toast('Ticket deleted');
  }
  if (d.rmtech && confirm('Remove this technician?')) { DB.technicians = DB.technicians.filter(t => t.id !== d.rmtech); save(); render(); }
  if (d.ticket) { $('#type').value = d.ticket; $('#desc').value = lastMsg; go('submit'); $('#chat').classList.remove('show'); }
});

/* ---------- filters & search ---------- */
$$('#filters input,#filters select').forEach(x => x.oninput = list);
$('#clr').onclick = () => { $$('#filters input,#filters select').forEach(x => x.value = x.id === 'sort' ? 'date' : ''); $('#gs').value = ''; list(); };
$('#gs').oninput = e => { $('#q').value = e.target.value; go('tickets'); };

/* ---------- settings / profile / data ---------- */
$('#f-tech').onsubmit = e => {
  e.preventDefault(); const n = e.target.tname.value.trim(), s = $$('#skills input:checked').map(x => x.value);
  if (!n || !s.length) return toast('Enter a name and choose at least one skill');
  if (DB.technicians.some(t => t.name.toLowerCase() === n.toLowerCase())) return toast('That technician already exists');
  DB.technicians.push({ id: 'T' + Date.now(), name: n, skills: s }); save(); e.target.reset(); render(); toast('Technician added');
};
$('#f-prof').onsubmit = e => {
  e.preventDefault(); DB.user = { name: e.target.pname.value.trim() || 'Tech Username', role: e.target.prole.value.trim() || 'Support Agent' };
  save(); render(); toast('Profile saved');
};
$('#export').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' }));
  a.download = 'helpdesk-data.json'; a.click();
};
$('#reset').onclick = () => { if (confirm('Reset everything to the sample data?')) { localStorage.removeItem(KEY); location.reload(); } };

/* ---------- 8. chatbot assistant ---------- */
function reply(msg) {
  const id = (msg.match(/HD-\d+/i) || [])[0];
  if (id) { const t = find(id.toUpperCase()); return t ? `Ticket <b>${t.id}</b> is <b>${t.status}</b> (${t.priority} priority), assigned to ${esc(t.assigned) || 'no one yet'}.` : `I couldn't find ${esc(id)}.`; }
  const w = msg.toLowerCase(); let best, sc = 0;
  DB.knowledgeBase.forEach(k => { const s = k.keywords.filter(x => w.includes(x)).length; if (s > sc) { sc = s; best = k; } });
  if (!best) return /^(hi|hello|hey)\b/i.test(msg) ? 'Hi! Describe your problem (for example "printer not printing") and I\'ll suggest fixes and the right ticket category.'
    : 'I couldn\'t match that. Try words like <i>wifi, printer, password, slow, email, install</i>, or type a ticket number like HD-1001 to check its status.';
  return `<b>${esc(best.title)}</b><br>Suggested category: <b>${esc(best.category)}</b><ol>${best.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    Still not fixed? <button class="mini" data-ticket="${esc(best.category)}">Create a ${esc(best.category)} ticket</button>`;
}
function say(h, c) { const b = $('#cmsgs'); b.insertAdjacentHTML('beforeend', `<div class="msg ${c}">${h}</div>`); b.scrollTop = b.scrollHeight; }
$('#f-chat').onsubmit = e => {
  e.preventDefault(); const m = $('#cin').value.trim(); if (!m) return;
  $('#cin').value = ''; lastMsg = m; say(esc(m), 'me'); setTimeout(() => say(reply(m), 'bot'), 250);
};
$('#bot-btn').onclick = () => $('#chat').classList.toggle('show');
$('#help').onclick = () => $('#chat').classList.add('show');

/* ---------- start ---------- */
load().then(() => {
  say('Hi, I\'m the IT assistant. Tell me what\'s wrong and I\'ll suggest troubleshooting steps and the right ticket category.', 'bot');
  go('dashboard');
});
