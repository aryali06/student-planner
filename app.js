/* =========================================================
   coursework — student planner app logic
   Local-only: everything persists to localStorage.
   ========================================================= */

const STORAGE_KEY = 'coursework_planner_v1';

const SUBJECT_COLORS = ['#f0aac6', '#b5a8f7', '#8fe0c4', '#f6c497', '#ea8fa4', '#8fc2f0', '#f7e08a', '#c9a9f7'];

const ROOM_QUOTES = [
  'One task at a time.',
  'Small steps, still forward.',
  'Future you says thanks.',
  'Progress, not perfection.',
  'Quiet room, clear head.',
  'Just start — momentum follows.'
];

function defaultState(){
  return { subjects: [], tasks: [], exams: [], grades: [], sessions: [] };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  }catch(e){
    console.error('coursework: failed to load saved data', e);
    return defaultState();
  }
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    console.error('coursework: failed to save', e);
    toast('Could not save — your browser storage may be full');
  }
}

let state = loadState();

/* ---------------------------- utilities ---------------------------- */

function uid(prefix){
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
}

function todayStr(){
  return toDateStr(new Date());
}

function toDateStr(dt){
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const d = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function addDaysStr(str, days){
  const [y,m,d] = str.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate()+days);
  return toDateStr(dt);
}

function daysBetween(a, b){
  const [ay,am,ad] = a.split('-').map(Number);
  const [by,bm,bd] = b.split('-').map(Number);
  const da = new Date(ay, am-1, ad), db = new Date(by, bm-1, bd);
  return Math.round((db-da)/86400000);
}

function formatDateNice(str){
  if(!str) return 'no date';
  const [y,m,d] = str.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { month:'short', day:'numeric' });
}

function countdownTag(dateStr){
  const diff = daysBetween(todayStr(), dateStr);
  if(diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'tag-red' };
  if(diff === 0) return { label: 'today', cls: 'tag-peach' };
  if(diff === 1) return { label: 'tomorrow', cls: 'tag-peach' };
  if(diff <= 7) return { label: `in ${diff}d`, cls: 'tag-pink' };
  return { label: `in ${diff}d`, cls: 'tag' };
}

function formatDuration(ms){
  const totalSec = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
}

function formatHM(totalSeconds){
  const h = Math.floor(totalSeconds/3600);
  const m = Math.floor((totalSeconds%3600)/60);
  return `${h}h ${m}m`;
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function subjectById(id){
  return state.subjects.find(s => s.id === id);
}

function subjectLabel(id){
  const s = subjectById(id);
  return s ? s.name : 'No subject';
}

function subjectDotHtml(id){
  const s = subjectById(id);
  const color = s ? s.color : '#726d92';
  return `<span class="subject-dot" style="background:${color}"></span>`;
}

let toastTimer = null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

/* ---------------------------- navigation ---------------------------- */

function showView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
  document.getElementById(`view-${name}`).classList.add('is-active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  if(name === 'dashboard') renderDashboard();
  if(name === 'subjects') renderSubjects();
  if(name === 'tasks') renderTasks();
  if(name === 'exams') renderExams();
  if(name === 'grades') renderGrades();
  if(name === 'studyroom') renderRoom();
}

function initNav(){
  document.getElementById('nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if(!btn) return;
    showView(btn.dataset.view);
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.goto));
  });
}

/* ---------------------------- modal system ---------------------------- */

function openModal(title, bodyHtml, onSubmit){
  document.getElementById('modalTitle').textContent = title;
  const body = document.getElementById('modalBody');
  body.innerHTML = bodyHtml;
  const form = document.getElementById('modalForm');
  if(form){
    form.onsubmit = (e) => {
      e.preventDefault();
      onSubmit(new FormData(form), form);
    };
  }
  wireColorPicker(body);
  document.getElementById('modalOverlay').classList.add('is-open');
  const firstInput = body.querySelector('input, select, textarea');
  if(firstInput) setTimeout(() => firstInput.focus(), 30);
}

function closeModal(){
  document.getElementById('modalOverlay').classList.remove('is-open');
}

function initModal(){
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if(e.target.id === 'modalOverlay') closeModal();
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeModal();
  });
  // delegated: every modal form uses a button#modalCancel
  document.getElementById('modalBody').addEventListener('click', e => {
    if(e.target.id === 'modalCancel') closeModal();
  });
}

function wireColorPicker(scope){
  const picker = scope.querySelector('.color-picker');
  if(!picker) return;
  const hidden = scope.querySelector('input[name="color"]');
  picker.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
      sw.classList.add('is-selected');
      hidden.value = sw.dataset.color;
    });
  });
}

function colorPickerHtml(selected){
  const chosen = selected || SUBJECT_COLORS[0];
  const swatches = SUBJECT_COLORS.map(c => `<button type="button" class="color-swatch${c===chosen?' is-selected':''}" data-color="${c}" style="background:${c}"></button>`).join('');
  return `
    <div class="form-row">
      <label>Colour</label>
      <div class="color-picker">${swatches}</div>
      <input type="hidden" name="color" value="${chosen}">
    </div>`;
}

function subjectOptionsHtml(selectedId, includeAll){
  let out = includeAll ? `<option value="all">All subjects</option>` : `<option value="">Pick a subject…</option>`;
  out += state.subjects.map(s => `<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
  return out;
}

/* ---------------------------- subject selects (shared) ---------------------------- */

function populateSubjectSelects(){
  document.getElementById('taskFilterSubject').innerHTML = subjectOptionsHtml('all', true);
  document.getElementById('swSubjectSelect').innerHTML = `<option value="">No subject</option>` + state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('roomSubjectSelect').innerHTML = `<option value="">Pick a subject…</option>` + state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

/* ============================================================
   SUBJECTS
   ============================================================ */

function subjectFormHtml(existing){
  return `
    <form id="modalForm">
      <div class="form-row">
        <label for="f-name">Subject name</label>
        <input class="input" id="f-name" name="name" type="text" placeholder="e.g. Network Security" value="${existing ? escapeHtml(existing.name) : ''}" required>
      </div>
      <div class="form-row">
        <label for="f-code">Code (optional)</label>
        <input class="input" id="f-code" name="code" type="text" placeholder="e.g. 32548" value="${existing ? escapeHtml(existing.code||'') : ''}">
      </div>
      ${colorPickerHtml(existing ? existing.color : SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length])}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add subject'}</button>
      </div>
    </form>`;
}

function openSubjectModal(existing){
  openModal(existing ? 'Edit subject' : 'Add subject', subjectFormHtml(existing), (fd) => {
    const name = fd.get('name').trim();
    if(!name) return;
    if(existing){
      existing.name = name;
      existing.code = fd.get('code').trim();
      existing.color = fd.get('color');
    } else {
      state.subjects.push({ id: uid('subj'), name, code: fd.get('code').trim(), color: fd.get('color') });
    }
    saveState();
    populateSubjectSelects();
    renderSubjects();
    renderDashboard();
    closeModal();
    toast(existing ? 'Subject updated' : 'Subject added');
  });
}

function deleteSubject(id){
  const s = subjectById(id);
  if(!s) return;
  const count = state.tasks.filter(t=>t.subjectId===id).length + state.exams.filter(x=>x.subjectId===id).length + state.grades.filter(g=>g.subjectId===id).length;
  const msg = count > 0
    ? `Delete "${s.name}"? This also removes ${count} linked task${count===1?'':'s'}/exam${count===1?'':'s'}/grade${count===1?'':'s'}.`
    : `Delete "${s.name}"?`;
  if(!confirm(msg)) return;
  state.subjects = state.subjects.filter(x => x.id !== id);
  state.tasks = state.tasks.filter(t => t.subjectId !== id);
  state.exams = state.exams.filter(x => x.subjectId !== id);
  state.grades = state.grades.filter(g => g.subjectId !== id);
  state.sessions.forEach(sess => { if(sess.subjectId === id) sess.subjectId = ''; });
  saveState();
  populateSubjectSelects();
  renderSubjects();
  renderDashboard();
  toast('Subject deleted');
}

function subjectStats(id){
  const openTasks = state.tasks.filter(t => t.subjectId===id && t.status!=='done').length;
  const grades = state.grades.filter(g => g.subjectId===id);
  const avg = weightedAverage(grades);
  return { openTasks, avg };
}

function weightedAverage(grades){
  if(grades.length === 0) return null;
  let wSum = 0, total = 0;
  grades.forEach(g => {
    const pct = (g.score / g.total) * 100;
    const w = Number(g.weight) > 0 ? Number(g.weight) : 1;
    total += pct * w;
    wSum += w;
  });
  return wSum > 0 ? total / wSum : null;
}

function renderSubjects(){
  const grid = document.getElementById('subjectsGrid');
  if(state.subjects.length === 0){
    grid.innerHTML = `<p class="empty">No subjects yet. Add your first one to start tracking tasks, exams and grades.</p>`;
    return;
  }
  grid.innerHTML = state.subjects.map(s => {
    const { openTasks, avg } = subjectStats(s.id);
    return `
      <div class="card subject-card">
        <div class="subject-card-top">
          <div class="subject-swatch" style="background:${s.color}"></div>
          <div>
            <div class="subject-card-name">${escapeHtml(s.name)}</div>
            ${s.code ? `<div class="subject-card-code">${escapeHtml(s.code)}</div>` : ''}
          </div>
        </div>
        <div class="subject-card-stats">
          <span>${openTasks} open task${openTasks===1?'':'s'}</span>
          <span>${avg===null ? 'no grades' : `${avg.toFixed(1)}% avg`}</span>
        </div>
        <div class="subject-card-actions">
          <button class="btn-icon" data-edit-subject="${s.id}" title="Edit">✎</button>
          <button class="btn-icon" data-delete-subject="${s.id}" title="Delete">🗑</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-edit-subject]').forEach(b => b.addEventListener('click', () => openSubjectModal(subjectById(b.dataset.editSubject))));
  grid.querySelectorAll('[data-delete-subject]').forEach(b => b.addEventListener('click', () => deleteSubject(b.dataset.deleteSubject)));
}

/* ============================================================
   TASKS
   ============================================================ */

let taskGroupMode = 'date';

function taskFormHtml(existing){
  return `
    <form id="modalForm">
      <div class="form-row">
        <label for="t-title">Task</label>
        <input class="input" id="t-title" name="title" type="text" placeholder="e.g. Read chapter 4" value="${existing?escapeHtml(existing.title):''}" required>
      </div>
      <div class="form-2col">
        <div class="form-row">
          <label for="t-subject">Subject</label>
          <select class="select" id="t-subject" name="subjectId">${subjectOptionsHtml(existing?existing.subjectId:'')}</select>
        </div>
        <div class="form-row">
          <label for="t-due">Due date</label>
          <input class="input" id="t-due" name="dueDate" type="date" value="${existing?existing.dueDate||'':''}">
        </div>
      </div>
      <div class="form-row">
        <label for="t-priority">Priority</label>
        <select class="select" id="t-priority" name="priority">
          <option value="low" ${existing&&existing.priority==='low'?'selected':''}>Low</option>
          <option value="medium" ${!existing||existing.priority==='medium'?'selected':''}>Medium</option>
          <option value="high" ${existing&&existing.priority==='high'?'selected':''}>High</option>
        </select>
      </div>
      <div class="form-row">
        <label for="t-notes">Notes (optional)</label>
        <input class="input" id="t-notes" name="notes" type="text" value="${existing?escapeHtml(existing.notes||''):''}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing?'Save changes':'Add task'}</button>
      </div>
    </form>`;
}

function openTaskModal(existing){
  if(state.subjects.length === 0){ toast('Add a subject first'); return; }
  openModal(existing?'Edit task':'Add task', taskFormHtml(existing), (fd) => {
    const title = fd.get('title').trim();
    if(!title) return;
    const data = {
      title,
      subjectId: fd.get('subjectId') || '',
      dueDate: fd.get('dueDate') || '',
      priority: fd.get('priority'),
      notes: fd.get('notes').trim()
    };
    if(existing){
      Object.assign(existing, data);
    } else {
      state.tasks.push({ id: uid('task'), status:'todo', ...data });
    }
    saveState();
    renderTasks();
    renderDashboard();
    renderRoom();
    closeModal();
    toast(existing?'Task updated':'Task added');
  });
}

function toggleTask(id){
  const t = state.tasks.find(x=>x.id===id);
  if(!t) return;
  t.status = t.status==='done' ? 'todo' : 'done';
  saveState();
  renderTasks();
  renderDashboard();
  renderRoom();
}

function deleteTask(id){
  state.tasks = state.tasks.filter(t=>t.id!==id);
  saveState();
  renderTasks();
  renderDashboard();
  renderRoom();
  toast('Task deleted');
}

function taskRowHtml(t){
  const overdue = t.dueDate && t.dueDate < todayStr() && t.status !== 'done';
  const dueTag = t.dueDate ? countdownTag(t.dueDate) : null;
  return `
    <li class="row-item ${t.status==='done'?'is-done':''} ${overdue?'is-overdue':''}">
      <button class="row-check ${t.status==='done'?'is-checked':''}" data-toggle-task="${t.id}">${t.status==='done'?'✓':''}</button>
      <div class="row-main">
        <div class="row-title ${t.status==='done'?'is-strike':''}">${escapeHtml(t.title)}</div>
        <div class="row-meta">
          ${t.subjectId ? `<span class="tag">${subjectDotHtml(t.subjectId)} ${escapeHtml(subjectLabel(t.subjectId))}</span>` : ''}
          ${dueTag ? `<span class="tag ${dueTag.cls}">${dueTag.label}</span>` : ''}
          ${t.priority==='high' ? `<span class="tag tag-red">high priority</span>` : ''}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn-icon" data-edit-task="${t.id}" title="Edit">✎</button>
        <button class="btn-icon" data-delete-task="${t.id}" title="Delete">🗑</button>
      </div>
    </li>`;
}

function renderTasks(){
  const container = document.getElementById('tasksContainer');
  const subjFilter = document.getElementById('taskFilterSubject').value;
  const statusFilter = document.getElementById('taskFilterStatus').value;

  let tasks = state.tasks.filter(t => {
    if(subjFilter !== 'all' && t.subjectId !== subjFilter) return false;
    if(statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  if(tasks.length === 0){
    container.innerHTML = `<p class="empty">No tasks match. Try adding one, or clear your filters.</p>`;
    wireTaskButtons(container);
    return;
  }

  let groups = [];
  if(taskGroupMode === 'subject'){
    const bySubj = {};
    tasks.forEach(t => { (bySubj[t.subjectId||'none'] ||= []).push(t); });
    groups = Object.keys(bySubj).map(key => ({
      title: key==='none' ? 'No subject' : subjectLabel(key),
      dot: key==='none' ? '#726d92' : (subjectById(key)?.color || '#726d92'),
      items: bySubj[key].sort((a,b)=> (a.dueDate||'9999').localeCompare(b.dueDate||'9999'))
    }));
  } else {
    const today = todayStr();
    const buckets = { overdue:[], today:[], week:[], later:[], none:[] };
    tasks.forEach(t => {
      if(!t.dueDate) buckets.none.push(t);
      else if(t.dueDate < today && t.status!=='done') buckets.overdue.push(t);
      else if(t.dueDate === today) buckets.today.push(t);
      else if(daysBetween(today, t.dueDate) <= 7) buckets.week.push(t);
      else buckets.later.push(t);
    });
    const labels = { overdue:['Overdue','#ea8fa4'], today:['Today','#f6c497'], week:['This week','#f0aac6'], later:['Later','#b5a8f7'], none:['No due date','#726d92'] };
    groups = Object.keys(buckets).filter(k=>buckets[k].length).map(k => ({
      title: labels[k][0], dot: labels[k][1],
      items: buckets[k].sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''))
    }));
  }

  container.innerHTML = groups.map(g => `
    <div class="card group-card">
      <div class="group-head">
        <span class="group-dot" style="background:${g.dot}"></span>
        <span class="group-title">${escapeHtml(g.title)}</span>
        <span class="group-sub">${g.items.length}</span>
      </div>
      <ul class="list">${g.items.map(taskRowHtml).join('')}</ul>
    </div>`).join('');

  wireTaskButtons(container);
}

function wireTaskButtons(container){
  container.querySelectorAll('[data-toggle-task]').forEach(b => b.addEventListener('click', () => toggleTask(b.dataset.toggleTask)));
  container.querySelectorAll('[data-edit-task]').forEach(b => b.addEventListener('click', () => openTaskModal(state.tasks.find(t=>t.id===b.dataset.editTask))));
  container.querySelectorAll('[data-delete-task]').forEach(b => b.addEventListener('click', () => { if(confirm('Delete this task?')) deleteTask(b.dataset.deleteTask); }));
}

function initTasksView(){
  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal(null));
  document.getElementById('taskGroupSeg').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if(!btn) return;
    taskGroupMode = btn.dataset.group;
    document.querySelectorAll('#taskGroupSeg .seg-btn').forEach(b=>b.classList.toggle('is-active', b===btn));
    renderTasks();
  });
  document.getElementById('taskFilterSubject').addEventListener('change', renderTasks);
  document.getElementById('taskFilterStatus').addEventListener('change', renderTasks);
}

/* ============================================================
   EXAMS & ASSIGNMENTS (grouped by subject)
   ============================================================ */

function examFormHtml(existing){
  return `
    <form id="modalForm">
      <div class="form-row">
        <label for="e-title">Title</label>
        <input class="input" id="e-title" name="title" type="text" placeholder="e.g. Midterm exam" value="${existing?escapeHtml(existing.title):''}" required>
      </div>
      <div class="form-2col">
        <div class="form-row">
          <label for="e-subject">Subject</label>
          <select class="select" id="e-subject" name="subjectId" required>${subjectOptionsHtml(existing?existing.subjectId:'')}</select>
        </div>
        <div class="form-row">
          <label for="e-type">Type</label>
          <select class="select" id="e-type" name="type">
            <option value="exam" ${existing&&existing.type==='exam'?'selected':''}>Exam</option>
            <option value="assignment" ${!existing||existing.type==='assignment'?'selected':''}>Assignment</option>
          </select>
        </div>
      </div>
      <div class="form-2col">
        <div class="form-row">
          <label for="e-date">Date</label>
          <input class="input" id="e-date" name="date" type="date" value="${existing?existing.date||'':''}" required>
        </div>
        <div class="form-row">
          <label for="e-weight">Weight % (optional)</label>
          <input class="input" id="e-weight" name="weight" type="number" min="0" max="100" step="0.1" value="${existing?existing.weight||'':''}">
        </div>
      </div>
      <div class="form-row">
        <label for="e-notes">Notes (optional)</label>
        <input class="input" id="e-notes" name="notes" type="text" value="${existing?escapeHtml(existing.notes||''):''}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing?'Save changes':'Add'}</button>
      </div>
    </form>`;
}

function openExamModal(existing){
  if(state.subjects.length === 0){ toast('Add a subject first'); return; }
  openModal(existing?'Edit entry':'Add exam / assignment', examFormHtml(existing), (fd) => {
    const title = fd.get('title').trim();
    const subjectId = fd.get('subjectId');
    const date = fd.get('date');
    if(!title || !subjectId || !date) return;
    const data = {
      title, subjectId, date,
      type: fd.get('type'),
      weight: fd.get('weight') ? Number(fd.get('weight')) : null,
      notes: fd.get('notes').trim()
    };
    if(existing){
      Object.assign(existing, data);
    } else {
      state.exams.push({ id: uid('exam'), status:'upcoming', ...data });
    }
    saveState();
    renderExams();
    renderDashboard();
    closeModal();
    toast(existing?'Updated':'Added');
  });
}

function deleteExam(id){
  state.exams = state.exams.filter(x=>x.id!==id);
  saveState();
  renderExams();
  renderDashboard();
  toast('Deleted');
}

function toggleExamDone(id){
  const x = state.exams.find(e=>e.id===id);
  if(!x) return;
  x.status = x.status==='done' ? 'upcoming' : 'done';
  saveState();
  renderExams();
  renderDashboard();
}

function examRowHtml(x){
  const tag = countdownTag(x.date);
  return `
    <li class="row-item ${x.status==='done'?'is-done':''}">
      <button class="row-check ${x.status==='done'?'is-checked':''}" data-toggle-exam="${x.id}" title="Mark ${x.type==='exam'?'sat':'submitted'}">${x.status==='done'?'✓':''}</button>
      <div class="row-main">
        <div class="row-title ${x.status==='done'?'is-strike':''}">${escapeHtml(x.title)}</div>
        <div class="row-meta">
          <span class="tag ${x.type==='exam'?'tag-red':'tag-mint'}">${x.type}</span>
          <span class="tag">${formatDateNice(x.date)}</span>
          <span class="tag ${tag.cls}">${tag.label}</span>
          ${x.weight ? `<span class="tag">${x.weight}%</span>` : ''}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn-icon" data-edit-exam="${x.id}" title="Edit">✎</button>
        <button class="btn-icon" data-delete-exam="${x.id}" title="Delete">🗑</button>
      </div>
    </li>`;
}

function renderExams(){
  const container = document.getElementById('examsContainer');
  if(state.exams.length === 0){
    container.innerHTML = `<p class="empty">Nothing scheduled yet. Add an exam or assignment to a subject.</p>`;
    return;
  }
  const bySubj = {};
  state.exams.forEach(x => { (bySubj[x.subjectId] ||= []).push(x); });

  const groups = state.subjects
    .filter(s => bySubj[s.id])
    .map(s => ({ subject: s, items: bySubj[s.id].sort((a,b)=>a.date.localeCompare(b.date)) }));

  container.innerHTML = groups.map(g => `
    <div class="card group-card">
      <div class="group-head">
        <span class="group-dot" style="background:${g.subject.color}"></span>
        <span class="group-title">${escapeHtml(g.subject.name)}</span>
        <span class="group-sub">${g.items.length}</span>
      </div>
      <ul class="list">${g.items.map(examRowHtml).join('')}</ul>
    </div>`).join('');

  container.querySelectorAll('[data-toggle-exam]').forEach(b => b.addEventListener('click', () => toggleExamDone(b.dataset.toggleExam)));
  container.querySelectorAll('[data-edit-exam]').forEach(b => b.addEventListener('click', () => openExamModal(state.exams.find(x=>x.id===b.dataset.editExam))));
  container.querySelectorAll('[data-delete-exam]').forEach(b => b.addEventListener('click', () => { if(confirm('Delete this entry?')) deleteExam(b.dataset.deleteExam); }));
}

/* ============================================================
   GRADES (grouped by subject, weighted average)
   ============================================================ */

function gradeFormHtml(existing){
  return `
    <form id="modalForm">
      <div class="form-row">
        <label for="g-subject">Subject</label>
        <select class="select" id="g-subject" name="subjectId" required>${subjectOptionsHtml(existing?existing.subjectId:'')}</select>
      </div>
      <div class="form-row">
        <label for="g-name">Assessment name</label>
        <input class="input" id="g-name" name="name" type="text" placeholder="e.g. Assignment 2" value="${existing?escapeHtml(existing.name):''}" required>
      </div>
      <div class="form-2col">
        <div class="form-row">
          <label for="g-score">Score</label>
          <input class="input" id="g-score" name="score" type="number" step="0.01" value="${existing?existing.score:''}" required>
        </div>
        <div class="form-row">
          <label for="g-total">Out of</label>
          <input class="input" id="g-total" name="total" type="number" step="0.01" value="${existing?existing.total:''}" required>
        </div>
      </div>
      <div class="form-row">
        <label for="g-weight">Weight in final grade % (optional)</label>
        <input class="input" id="g-weight" name="weight" type="number" min="0" max="100" step="0.1" value="${existing?existing.weight||'':''}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing?'Save changes':'Add grade'}</button>
      </div>
    </form>`;
}

function openGradeModal(existing){
  if(state.subjects.length === 0){ toast('Add a subject first'); return; }
  openModal(existing?'Edit grade':'Add grade', gradeFormHtml(existing), (fd) => {
    const name = fd.get('name').trim();
    const subjectId = fd.get('subjectId');
    const score = Number(fd.get('score'));
    const total = Number(fd.get('total'));
    if(!name || !subjectId || !total) return;
    const data = { name, subjectId, score, total, weight: fd.get('weight') ? Number(fd.get('weight')) : 1 };
    if(existing){
      Object.assign(existing, data);
    } else {
      state.grades.push({ id: uid('grade'), ...data });
    }
    saveState();
    renderGrades();
    renderSubjects();
    closeModal();
    toast(existing?'Updated':'Grade added');
  });
}

function deleteGrade(id){
  state.grades = state.grades.filter(g=>g.id!==id);
  saveState();
  renderGrades();
  renderSubjects();
  toast('Grade deleted');
}

function gradeRowHtml(g){
  const pct = (g.score/g.total)*100;
  const cls = pct>=80?'tag-mint':pct>=60?'tag-peach':'tag-red';
  return `
    <li class="row-item">
      <div class="row-main">
        <div class="row-title">${escapeHtml(g.name)}</div>
        <div class="row-meta">
          <span class="tag">${g.score}/${g.total}</span>
          <span class="tag ${cls}">${pct.toFixed(1)}%</span>
          ${g.weight ? `<span class="tag">weight ${g.weight}</span>` : ''}
        </div>
      </div>
      <div class="row-actions">
        <button class="btn-icon" data-edit-grade="${g.id}" title="Edit">✎</button>
        <button class="btn-icon" data-delete-grade="${g.id}" title="Delete">🗑</button>
      </div>
    </li>`;
}

function renderGrades(){
  const container = document.getElementById('gradesContainer');
  const overallEl = document.getElementById('overallAverage');

  if(state.grades.length === 0){
    container.innerHTML = `<p class="empty">No grades recorded yet.</p>`;
    overallEl.textContent = '—';
    return;
  }

  const bySubj = {};
  state.grades.forEach(g => { (bySubj[g.subjectId] ||= []).push(g); });

  const subjectAverages = [];
  const groups = state.subjects.filter(s => bySubj[s.id]).map(s => {
    const items = bySubj[s.id];
    const avg = weightedAverage(items);
    if(avg !== null) subjectAverages.push(avg);
    return { subject:s, items, avg };
  });

  const overall = subjectAverages.length ? subjectAverages.reduce((a,b)=>a+b,0)/subjectAverages.length : null;
  overallEl.textContent = overall===null ? '—' : `${overall.toFixed(1)}%`;

  container.innerHTML = groups.map(g => `
    <div class="card group-card">
      <div class="group-head">
        <span class="group-dot" style="background:${g.subject.color}"></span>
        <span class="group-title">${escapeHtml(g.subject.name)}</span>
        <span class="group-sub grade-avg">${g.avg===null?'—':g.avg.toFixed(1)+'%'}</span>
      </div>
      <ul class="list">${g.items.map(gradeRowHtml).join('')}</ul>
    </div>`).join('');

  container.querySelectorAll('[data-edit-grade]').forEach(b => b.addEventListener('click', () => openGradeModal(state.grades.find(g=>g.id===b.dataset.editGrade))));
  container.querySelectorAll('[data-delete-grade]').forEach(b => b.addEventListener('click', () => { if(confirm('Delete this grade?')) deleteGrade(b.dataset.deleteGrade); }));
}

/* ============================================================
   STOPWATCH (single shared timer engine — mini widget, page, room)
   ============================================================ */

const timer = { running:false, startTs:0, elapsed:0 };
let timerInterval = null;
let laps = [];

function timerElapsedMs(){
  return timer.elapsed + (timer.running ? Date.now()-timer.startTs : 0);
}

function timerToggle(){
  if(timer.running){
    timer.elapsed = timerElapsedMs();
    timer.running = false;
    clearInterval(timerInterval);
  } else {
    timer.startTs = Date.now();
    timer.running = true;
    timerInterval = setInterval(updateTimerDisplays, 250);
  }
  updateTimerDisplays();
}

function timerReset(){
  timer.running = false;
  timer.elapsed = 0;
  timer.startTs = 0;
  clearInterval(timerInterval);
  laps = [];
  renderLaps();
  updateTimerDisplays();
}

function updateTimerDisplays(){
  const str = formatDuration(timerElapsedMs());
  const mini = document.getElementById('miniWatchTime');
  const sw = document.getElementById('stopwatchDisplay');
  const room = document.getElementById('roomTimer');
  if(mini) mini.textContent = str;
  if(sw) sw.textContent = str;
  if(room) room.textContent = str;

  const running = timer.running;
  const miniBtn = document.getElementById('miniWatchToggle');
  const swBtn = document.getElementById('swToggle');
  const roomBtn = document.getElementById('roomToggle');
  if(miniBtn) miniBtn.textContent = running ? '❚❚' : '▶';
  if(swBtn) swBtn.textContent = running ? 'Pause' : 'Start';
  if(roomBtn) roomBtn.textContent = running ? 'Pause' : 'Start focusing';
}

function renderLaps(){
  const el = document.getElementById('swLaps');
  if(!el) return;
  el.innerHTML = laps.map((ms,i) => `<li><span>Lap ${i+1}</span><span>${formatDuration(ms)}</span></li>`).join('');
}

function saveSession(subjectId, note){
  const ms = timerElapsedMs();
  const seconds = Math.round(ms/1000);
  if(seconds < 1){ toast('Start the timer first'); return; }
  state.sessions.push({ id: uid('sess'), subjectId: subjectId||'', note: (note||'').trim(), duration: seconds, date: todayStr() });
  saveState();
  renderSessionHistory();
  renderDashboard();
  timerReset();
  toast('Session saved');
}

function renderSessionHistory(){
  const el = document.getElementById('sessionHistory');
  if(!el) return;
  if(state.sessions.length === 0){
    el.innerHTML = `<li class="empty">No sessions logged yet.</li>`;
    return;
  }
  const recent = [...state.sessions].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,15);
  el.innerHTML = recent.map(s => `
    <li class="row-item">
      <div class="row-main">
        <div class="row-title">${s.subjectId ? escapeHtml(subjectLabel(s.subjectId)) : 'General study'}${s.note ? ' — '+escapeHtml(s.note) : ''}</div>
        <div class="row-meta">
          <span class="tag">${formatDateNice(s.date)}</span>
          <span class="tag tag-mint">${formatHM(s.duration)}</span>
        </div>
      </div>
    </li>`).join('');
}

function initStopwatch(){
  document.getElementById('miniWatchToggle').addEventListener('click', timerToggle);
  document.getElementById('miniWatchReset').addEventListener('click', () => { if(confirm('Reset the timer?')) timerReset(); });
  document.getElementById('swToggle').addEventListener('click', timerToggle);
  document.getElementById('swReset').addEventListener('click', () => { if(confirm('Reset the timer?')) timerReset(); });
  document.getElementById('swLap').addEventListener('click', () => { laps.push(timerElapsedMs()); renderLaps(); });
  document.getElementById('swSave').addEventListener('click', () => {
    saveSession(document.getElementById('swSubjectSelect').value, document.getElementById('swNote').value);
    document.getElementById('swNote').value = '';
  });
}

/* ============================================================
   STUDY ROOM
   ============================================================ */

function renderRoom(){
  document.getElementById('roomQuote').textContent = ROOM_QUOTES[Math.floor(Math.random()*ROOM_QUOTES.length)];
  updateTimerDisplays();

  const list = document.getElementById('roomChecklist');
  const today = todayStr();
  const dueToday = state.tasks.filter(t => t.dueDate === today && t.status !== 'done');
  if(dueToday.length === 0){
    list.innerHTML = `<li class="empty">No tasks due today. Enjoy the quiet.</li>`;
  } else {
    list.innerHTML = dueToday.map(t => `
      <li class="row-item">
        <button class="row-check" data-toggle-task="${t.id}">${''}</button>
        <div class="row-main">
          <div class="row-title">${escapeHtml(t.title)}</div>
          <div class="row-meta">${t.subjectId ? `<span class="tag">${escapeHtml(subjectLabel(t.subjectId))}</span>` : ''}</div>
        </div>
      </li>`).join('');
    list.querySelectorAll('[data-toggle-task]').forEach(b => b.addEventListener('click', () => toggleTask(b.dataset.toggleTask)));
  }
}

function initRoom(){
  document.getElementById('roomToggle').addEventListener('click', timerToggle);
  document.getElementById('roomReset').addEventListener('click', () => { if(confirm('Reset the timer?')) timerReset(); });
  document.getElementById('roomExit').addEventListener('click', () => showView('dashboard'));
  document.getElementById('roomMoods').addEventListener('click', e => {
    const dot = e.target.closest('.mood-dot');
    if(!dot) return;
    document.getElementById('room').dataset.mood = dot.dataset.mood;
    document.querySelectorAll('.mood-dot').forEach(d => d.classList.toggle('is-selected', d===dot));
  });
  document.querySelector('.mood-dot[data-mood="dusk"]').classList.add('is-selected');
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function renderDashboard(){
  const dateEl = document.getElementById('todayDate');
  dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });

  const today = todayStr();
  const weekEnd = addDaysStr(today, 7);

  const dueToday = state.tasks.filter(t => t.dueDate===today && t.status!=='done').length;
  const dueWeek = state.tasks.filter(t => t.dueDate && t.dueDate>=today && t.dueDate<=weekEnd && t.status!=='done').length;
  const examsSoon = state.exams.filter(x => x.date>=today && x.date<=weekEnd).length;
  const weekAgo = addDaysStr(today, -7);
  const studySeconds = state.sessions.filter(s => s.date>=weekAgo && s.date<=today).reduce((a,s)=>a+s.duration,0);

  document.getElementById('statDueToday').textContent = dueToday;
  document.getElementById('statDueWeek').textContent = dueWeek;
  document.getElementById('statUpcomingExams').textContent = examsSoon;
  document.getElementById('statStudyWeek').textContent = formatHM(studySeconds);

  const taskList = document.getElementById('dashTaskList');
  const relevant = state.tasks
    .filter(t => t.status!=='done' && t.dueDate && t.dueDate<=today)
    .sort((a,b)=>a.dueDate.localeCompare(b.dueDate))
    .slice(0,6);
  taskList.innerHTML = relevant.length
    ? relevant.map(taskRowHtml).join('')
    : `<li class="empty">Nothing overdue or due today — nice.</li>`;
  wireTaskButtons(taskList);

  const examList = document.getElementById('dashExamList');
  const upcomingExams = state.exams
    .filter(x => x.date>=today)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(0,6);
  examList.innerHTML = upcomingExams.length
    ? upcomingExams.map(x => {
        const tag = countdownTag(x.date);
        return `<li class="row-item">
          <div class="row-main">
            <div class="row-title">${escapeHtml(x.title)}</div>
            <div class="row-meta">
              ${subjectDotHtml(x.subjectId)}<span>${escapeHtml(subjectLabel(x.subjectId))}</span>
              <span class="tag ${x.type==='exam'?'tag-red':'tag-mint'}">${x.type}</span>
              <span class="tag ${tag.cls}">${tag.label}</span>
            </div>
          </div>
        </li>`;
      }).join('')
    : `<li class="empty">No exams or assignments scheduled.</li>`;

  const strip = document.getElementById('dashSubjectStrip');
  strip.innerHTML = state.subjects.length
    ? state.subjects.map(s => `<div class="subject-chip"><span class="subject-dot" style="background:${s.color}"></span>${escapeHtml(s.name)}</div>`).join('')
    : `<p class="empty">No subjects yet — add one to get started.</p>`;
}

/* ============================================================
   INIT
   ============================================================ */

function initGlobalButtons(){
  document.getElementById('addSubjectBtn').addEventListener('click', () => openSubjectModal(null));
  document.getElementById('addExamBtn').addEventListener('click', () => openExamModal(null));
  document.getElementById('addGradeBtn').addEventListener('click', () => openGradeModal(null));
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initModal();
  initTasksView();
  initStopwatch();
  initRoom();
  initGlobalButtons();
  populateSubjectSelects();
  updateTimerDisplays();
  renderDashboard();
  renderSubjects();
  renderTasks();
  renderExams();
  renderGrades();
  renderSessionHistory();
});
