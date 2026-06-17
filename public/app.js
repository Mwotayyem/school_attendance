// ============================================================
//  نظام الحضور والغياب — منطق الواجهة (متصل بـ API/MongoDB)
// ============================================================

// إن استُضيفت الواجهة على نفس الخادم اتركه فارغاً. وإلا ضع رابط Cloud Run.
const API_BASE = '';

// الحالة في الذاكرة
let authToken = null;
let currentUser = null;
let myStudents = [];      // طلاب المعلمة المسندة
let myTodayAbsentIds = new Set(); // معرّفات طلاب غائبين اليوم (للمعلمة)
let myAbsenceByStudent = new Map(); // studentId -> absence (لتراجع المعلمة)
let adminStudents = [];   // كل الطلاب (للمديرة)
let adminTeachers = [];   // كل المعلمات
let adminAbsences = [];   // الغيابات المفلترة

const todayStr = () => new Date().toISOString().split('T')[0];

// ---------- طبقة الـ API ----------
async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/api${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* لا جسم */ }
    if (!res.ok) throw new Error(data?.error || 'حدث خطأ في الاتصال بالخادم');
    return data;
}

function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

// ---------- تسجيل الدخول ----------
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return toast('الرجاء إدخال اسم المستخدم وكلمة المرور', 'error');

    try {
        const { token, user } = await api('/auth/login', { method: 'POST', body: { username, password } });
        authToken = token; currentUser = user;
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        await enterApp();
        toast('تم تسجيل الدخول بنجاح');
    } catch (e) { toast(e.message, 'error'); }
}

async function enterApp() {
    if (currentUser.role === 'admin') {
        showPage('adminPage');
        await initAdmin();
    } else {
        document.getElementById('teacherName').textContent = currentUser.name;
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        showPage('teacherPage');
        await initTeacher();
    }
}

function logout() {
    authToken = null; currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showPage('loginPage');
}

// ============================================================
//  لوحة المعلمة
// ============================================================
let selectedClass = null; // { grade, section } الصف المختار حالياً

async function initTeacher() {
    try {
        myStudents = await api('/students');
        await refreshMyAbsences();
    } catch (e) { return toast(e.message, 'error'); }
    selectedClass = null;
    backToClasses();
}

async function refreshMyAbsences() {
    const todays = await api(`/absences/mine?date=${todayStr()}`);
    myTodayAbsentIds = new Set(todays.map(a => String(a.studentId)));
    myAbsenceByStudent = new Map(todays.map(a => [String(a.studentId), a]));
}

// قائمة صفوف المعلمة المسندة (المشتقّة من طلابها)
function myClasses() {
    const map = new Map();
    myStudents.forEach(s => {
        const key = `${s.grade}|${s.section}`;
        if (!map.has(key)) map.set(key, { grade: s.grade, section: s.section, count: 0 });
        map.get(key).count++;
    });
    return [...map.values()].sort((a, b) => (a.grade + a.section).localeCompare(b.grade + b.section, 'ar'));
}

// عرض شبكة بطاقات الصفوف (مع بحث)
function renderClassCards() {
    const term = (document.getElementById('classSearch').value || '').toLowerCase();
    const classes = myClasses().filter(c =>
        !term || `${c.grade} ${c.section}`.toLowerCase().includes(term));

    const box = document.getElementById('classCards');
    if (myClasses().length === 0) {
        box.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);padding:20px;text-align:center;">لا توجد صفوف مسندة إليك. تواصلي مع المديرة.</div>';
        return;
    }
    if (classes.length === 0) {
        box.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);padding:20px;text-align:center;">لا يوجد صف مطابق للبحث</div>';
        return;
    }
    box.innerHTML = classes.map(c => {
        const absentCount = myStudents.filter(s =>
            s.grade === c.grade && s.section === c.section && myTodayAbsentIds.has(String(s.id))).length;
        return `
        <div class="class-card" onclick="selectClass('${esc(c.grade)}','${esc(c.section)}')">
            <div class="cls-icon">🏫</div>
            <div class="cls-name">${esc(c.grade)} - ${esc(c.section)}</div>
            <div class="cls-count">${c.count} طالب</div>
            ${absentCount ? `<span class="cls-absent">🔴 ${absentCount} غائب اليوم</span>` : ''}
        </div>`;
    }).join('');
}

function selectClass(grade, section) {
    selectedClass = { grade, section };
    document.getElementById('classPicker').style.display = 'none';
    document.getElementById('classStudents').style.display = 'block';
    document.getElementById('selectedClassTitle').textContent = `${grade} - ${section}`;
    document.getElementById('tSearch').value = '';
    renderTeacherStudents();
}

function backToClasses() {
    selectedClass = null;
    document.getElementById('classStudents').style.display = 'none';
    document.getElementById('classPicker').style.display = 'block';
    document.getElementById('classSearch').value = '';
    renderClassCards();
}

// عرض طلاب الصف المختار مع زر تبديل (غياب/تراجع)
function renderTeacherStudents() {
    if (!selectedClass) return;
    const term = (document.getElementById('tSearch').value || '').toLowerCase();
    const list = myStudents.filter(st =>
        st.grade === selectedClass.grade && st.section === selectedClass.section &&
        (!term || st.name.toLowerCase().includes(term)));

    const box = document.getElementById('teacherStudents');
    if (list.length === 0) {
        box.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:24px;">لا يوجد طلاب مطابقون</div>';
        return;
    }
    box.innerHTML = list.map(st => {
        const absent = myTodayAbsentIds.has(String(st.id));
        return `
        <div class="student-card ${absent ? 'absent' : ''}">
            <div>
                <div class="name">${esc(st.name)}</div>
                <div class="meta">${esc(st.grade)} • شعبة ${esc(st.section)}${st.track ? ' • ' + esc(st.track) : ''}${absent ? ' • <span style="color:var(--danger);font-weight:700;">غائب اليوم</span>' : ''}</div>
            </div>
            <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: space-between; align-items: center; width: 100%;">
                <button class="btn btn-info btn-sm" onclick="showStudentDetails('${st.id}')">ℹ️ تفاصيل</button>
                ${absent
                    ? `<button class="btn btn-ghost btn-sm" onclick="undoAbsence('${st.id}')">↩ تراجع عن الغياب</button>`
                    : `<button class="btn btn-danger btn-sm" onclick="markAbsent('${st.id}')">🔴 تسجيل غياب</button>`}
            </div>
        </div>`;
    }).join('');
}

window.showStudentDetails = (id) => {
    const st = myStudents.find(s => s.id === id) || adminStudents.find(s => s.id === id);
    if (!st) return;
    document.getElementById('sdName').textContent = st.name || '-';
    document.getElementById('sdNationalId').textContent = st.nationalId || '-';
    document.getElementById('sdDob').textContent = st.dob || '-';
    document.getElementById('sdPhone').textContent = st.phone || '-';
    document.getElementById('sdParentPhone').textContent = st.parentPhone || '-';
    document.getElementById('sdNationality').textContent = st.nationality || '-';
    document.getElementById('sdGender').textContent = st.gender || '-';
    document.getElementById('sdGrade').textContent = st.grade || '-';
    document.getElementById('sdSection').textContent = st.section || '-';
    document.getElementById('sdTrack').textContent = st.track || '-';
    document.getElementById('studentDetailsModal').classList.add('show');
};

async function markAbsent(studentId) {
    const student = myStudents.find(s => s.id === studentId);
    if (!student) return;
    const notes = prompt(`تسجيل غياب: ${student.name}\nملاحظة (اختياري):`);
    if (notes === null) return; // ألغى
    try {
        const a = await api('/absences', { method: 'POST', body: { studentId, notes } });
        myTodayAbsentIds.add(String(studentId));
        myAbsenceByStudent.set(String(studentId), a);
        renderTeacherStudents();
        toast(`تم تسجيل غياب: ${student.name}`);
    } catch (e) { toast(e.message, 'error'); }
}

async function undoAbsence(studentId) {
    const a = myAbsenceByStudent.get(String(studentId));
    if (!a) return;
    try {
        await api(`/absences/${a.id}`, { method: 'DELETE' });
        myTodayAbsentIds.delete(String(studentId));
        myAbsenceByStudent.delete(String(studentId));
        renderTeacherStudents();
        toast('تم التراجع عن الغياب');
    } catch (e) { toast(e.message, 'error'); }
}

function printTeacherSheet() {
    const rows = [...myAbsenceByStudent.values()];
    if (rows.length === 0) return toast('لا يوجد غياب مسجّل اليوم لطباعته', 'error');
    printSheet('كشف غياب اليوم', rows, false);
}

// ============================================================
//  لوحة المديرة
// ============================================================
async function initAdmin() {
    try {
        [adminStudents, adminTeachers] = await Promise.all([api('/students'), api('/teachers')]);
    } catch (e) { return toast(e.message, 'error'); }

    document.getElementById('statStudents').textContent = adminStudents.length;
    document.getElementById('statTeachers').textContent = adminTeachers.length;

    populateAdminFilters();
    populateReportFilters();
    showAdminView('records');
    await loadAbsences();
}

// التبديل بين عرض السجل وعرض التقارير
function showAdminView(view) {
    const isReports = view === 'reports';
    document.getElementById('adminRecords').style.display = isReports ? 'none' : 'block';
    document.getElementById('adminReports').style.display = isReports ? 'block' : 'none';
    document.getElementById('navRecords').className = 'btn btn-sm ' + (isReports ? 'btn-ghost' : 'btn-primary');
    document.getElementById('navReports').className = 'btn btn-sm ' + (isReports ? 'btn-primary' : 'btn-ghost');
    document.getElementById('navRecords').style.width = isReports ? '' : 'auto';
    document.getElementById('navReports').style.width = isReports ? 'auto' : '';
    if (isReports && !reportData) setRange('month'); // تحميل أولي
}

function populateAdminFilters() {
    const grades = [...new Set(adminStudents.map(s => s.grade))].sort();
    const sections = [...new Set(adminStudents.map(s => s.section))].sort();
    const tracks = [...new Set(adminStudents.map(s => s.track).filter(Boolean))].sort();

    document.getElementById('fTeacher').innerHTML =
        '<option value="">كل المعلمات</option>' + adminTeachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    document.getElementById('fGrade').innerHTML =
        '<option value="">كل الصفوف</option>' + grades.map(g => `<option>${g}</option>`).join('');
    document.getElementById('fSection').innerHTML =
        '<option value="">كل الشعب</option>' + sections.map(s => `<option>${s}</option>`).join('');
    document.getElementById('fTrack').innerHTML =
        '<option value="">كل التخصصات</option>' + tracks.map(t => `<option>${t}</option>`).join('');
}

// تجلب الغيابات من الخادم حسب فلاتر القوائم المنسدلة، ثم تعرضها
async function loadAbsences() {
    const params = new URLSearchParams();
    const t = document.getElementById('fTeacher').value;
    const g = document.getElementById('fGrade').value;
    const s = document.getElementById('fSection').value;
    const tr = document.getElementById('fTrack').value;
    const d = document.getElementById('fDate').value;
    if (t) params.set('teacherId', t);
    if (g) params.set('grade', g);
    if (s) params.set('section', s);
    if (tr) params.set('track', tr);
    if (d) params.set('date', d);

    try {
        adminAbsences = await api('/absences?' + params.toString());
    } catch (e) { return toast(e.message, 'error'); }
    renderAbsences();
}

// تعرض الغيابات المحمّلة مع تطبيق بحث الاسم محلياً
function renderAbsences() {
    const term = (document.getElementById('fSearch').value || '').toLowerCase();
    const rows = adminAbsences.filter(a => !term || a.studentName.toLowerCase().includes(term));

    document.getElementById('statAbsences').textContent = rows.length;
    const body = document.getElementById('absencesBody');
    if (rows.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="9">لا توجد غيابات مطابقة</td></tr>';
        return;
    }
    body.innerHTML = rows.map((a, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(a.studentName)}</strong></td>
            <td>${esc(a.grade)}</td>
            <td>${esc(a.section)}</td>
            <td>${a.track ? `<span class="chip">${esc(a.track)}</span>` : '-'}</td>
            <td>${a.date}</td>
            <td>${esc(a.teacher)}</td>
            <td>${esc(a.notes) || '-'}</td>
            <td><button class="btn btn-danger btn-sm" onclick="adminDeleteAbsence('${a.id}')">حذف</button></td>
        </tr>`).join('');
}

function resetFilters() {
    ['fTeacher', 'fGrade', 'fSection', 'fTrack', 'fDate', 'fSearch'].forEach(id => document.getElementById(id).value = '');
    loadAbsences();
}

async function adminDeleteAbsence(id) {
    if (!confirm('حذف سجل الغياب هذا؟')) return;
    try {
        await api(`/absences/${id}`, { method: 'DELETE' });
        toast('تم الحذف');
        await loadAbsences();
    } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  التقارير الذكية (للمديرة)
// ============================================================
let reportData = null;

function populateReportFilters() {
    const grades = [...new Set(adminStudents.map(s => s.grade))].sort();
    const sections = [...new Set(adminStudents.map(s => s.section))].sort();
    const tracks = [...new Set(adminStudents.map(s => s.track).filter(Boolean))].sort();
    document.getElementById('rTeacher').innerHTML =
        '<option value="">كل المعلمات</option>' + adminTeachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    document.getElementById('rGrade').innerHTML =
        '<option value="">كل الصفوف</option>' + grades.map(g => `<option>${g}</option>`).join('');
    document.getElementById('rSection').innerHTML =
        '<option value="">كل الشعب</option>' + sections.map(s => `<option>${s}</option>`).join('');
    document.getElementById('rTrack').innerHTML =
        '<option value="">كل التخصصات</option>' + tracks.map(t => `<option>${t}</option>`).join('');
}

// ضبط الفترة الزمنية عبر الأزرار السريعة
function setRange(kind) {
    const now = new Date();
    const fmt = d => d.toISOString().split('T')[0];
    let from = '', to = '';
    if (kind === 'today') { from = to = fmt(now); }
    else if (kind === 'week') {
        const d = new Date(now); d.setDate(now.getDate() - 6); // آخر 7 أيام
        from = fmt(d); to = fmt(now);
    } else if (kind === 'month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        from = fmt(d); to = fmt(now);
    } else { from = ''; to = ''; } // الكل
    document.getElementById('rFrom').value = from;
    document.getElementById('rTo').value = to;
    loadReport();
}

function reportParams() {
    const p = new URLSearchParams();
    const map = { from: 'rFrom', to: 'rTo', teacherId: 'rTeacher', grade: 'rGrade', section: 'rSection', track: 'rTrack' };
    for (const [key, id] of Object.entries(map)) {
        const v = document.getElementById(id).value;
        if (v) p.set(key, v);
    }
    return p;
}

async function loadReport() {
    try {
        reportData = await api('/reports/summary?' + reportParams().toString());
    } catch (e) { return toast(e.message, 'error'); }
    renderReport();
}

function resetReportFilters() {
    ['rFrom', 'rTo', 'rTeacher', 'rGrade', 'rSection', 'rTrack'].forEach(id => document.getElementById(id).value = '');
    loadReport();
}

// رسم شريط نسبي لقائمة { label, count }
function renderBars(containerId, list) {
    const box = document.getElementById(containerId);
    if (!list || list.length === 0) { box.innerHTML = '<div class="report-empty">لا توجد بيانات</div>'; return; }
    const max = Math.max(...list.map(x => x.count), 1);
    box.innerHTML = list.map(x => `
        <div class="bar-row">
            <div class="bar-label" title="${esc(x.label)}">${esc(x.label)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(x.count / max * 100).toFixed(0)}%"></div></div>
            <div class="bar-val">${x.count}</div>
        </div>`).join('');
}

function renderReport() {
    const d = reportData;
    if (!d) return;
    const t = d.totals;

    // المؤشرات الذكية
    const peak = t.peakDay ? `${t.peakDay.date} (${t.peakDay.count})` : '—';
    document.getElementById('reportKPIs').innerHTML = `
        ${kpiCard('#f093fb,#f5576c', '📋', 'إجمالي الغيابات', t.totalAbsences, '')}
        ${kpiCard('#4facfe,#00f2fe', '🧑‍🎓', 'طلاب متغيّبون', t.uniqueStudents, `من ${t.studentCount} طالب`)}
        ${kpiCard('#43e97b,#38f9d7', '📊', 'نسبة الغياب', t.absentRate + '%', 'من الطلاب')}
        ${kpiCard('#fa709a,#fee140', '📅', 'متوسط يومي', t.avgPerDay, `على ${t.uniqueDays} يوم`)}
        ${kpiCard('#ee9ca7,#ffdde1', '🔺', 'أكثر يوم غياباً', peak, '')}
    `;

    // أكثر الطلاب غياباً
    const tb = document.getElementById('topStudentsBody');
    if (d.topStudents.length === 0) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="7">لا توجد بيانات</td></tr>';
    } else {
        tb.innerHTML = d.topStudents.map((s, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${esc(s.studentName)}</strong></td>
                <td>${esc(s.grade)}</td>
                <td>${esc(s.section)}</td>
                <td>${s.track ? `<span class="chip">${esc(s.track)}</span>` : '-'}</td>
                <td><strong style="color:var(--danger)">${s.count}</strong></td>
                <td>${s.lastDate}</td>
            </tr>`).join('');
    }

    // الرسم البياني للاتجاه
    renderTrend(d.byDate);

    // التجميعات
    renderBars('byGrade', d.byGrade);
    renderBars('bySection', d.bySection);
    renderBars('byTrack', d.byTrack);
    renderBars('byTeacher', d.byTeacher);
}

function kpiCard(grad, icon, label, value, sub) {
    return `<div class="stat">
        <div class="icon" style="background:linear-gradient(135deg,${grad})">${icon}</div>
        <div>
            <div class="label">${label}</div>
            <div class="value" style="font-size:24px;">${esc(String(value))}</div>
            ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
        </div>
    </div>`;
}

function renderTrend(byDate) {
    const box = document.getElementById('trendChart');
    if (!byDate || byDate.length === 0) { box.innerHTML = '<div class="report-empty">لا توجد بيانات</div>'; return; }
    const max = Math.max(...byDate.map(x => x.count), 1);
    box.innerHTML = byDate.map(x => `
        <div class="trend-bar" title="${x.label}: ${x.count}">
            <div class="t-count">${x.count}</div>
            <div class="t-fill" style="height:${(x.count / max * 120).toFixed(0)}px"></div>
            <div class="t-date">${x.label.slice(5)}</div>
        </div>`).join('');
}

// تصدير التقرير CSV (ملخص + أكثر الطلاب غياباً)
function exportReportCSV() {
    if (!reportData) return toast('لا يوجد تقرير', 'error');
    const d = reportData, t = d.totals;
    let csv = '﻿تقرير الغياب\n';
    csv += `إجمالي الغيابات,${t.totalAbsences}\n`;
    csv += `طلاب متغيّبون,${t.uniqueStudents} من ${t.studentCount}\n`;
    csv += `نسبة الغياب,${t.absentRate}%\n`;
    csv += `متوسط يومي,${t.avgPerDay}\n\n`;
    csv += 'أكثر الطلاب غياباً\nالطالب,الصف,الشعبة,التخصص,عدد الغيابات,آخر غياب\n';
    d.topStudents.forEach(s => { csv += `"${s.studentName}","${s.grade}","${s.section}","${s.track}",${s.count},${s.lastDate}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_الغياب_${todayStr()}.csv`;
    link.click();
    toast('تم التصدير');
}

// ---------- نافذة الإدارة ----------
function openManagement() { openModal('managementModal'); switchTab('students'); }

function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(name + 'Tab').classList.add('active');
    if (name === 'students') loadStudentsManage();
    else loadTeachersManage();
}

// ===== إدارة الطلاب =====
let editingStudentId = null;

async function loadStudentsManage() {
    try { adminStudents = await api('/students'); } catch (e) { return toast(e.message, 'error'); }
    document.getElementById('statStudents').textContent = adminStudents.length;
    document.getElementById('studentsCount').textContent = adminStudents.length;
    populateAdminFilters();
    renderStudentsManage();
}

function renderStudentsManage() {
    const term = (document.getElementById('sSearch').value || '').toLowerCase();
    const rows = adminStudents.filter(s =>
        !term || [s.name, s.grade, s.section, s.track].some(v => (v || '').toLowerCase().includes(term)));
    const body = document.getElementById('studentsManageBody');
    if (rows.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="5">لا يوجد طالب مطابق</td></tr>';
        return;
    }
    body.innerHTML = rows.map(s => `
        <tr>
            <td>${esc(s.name)}</td><td>${esc(s.grade)}</td><td>${esc(s.section)}</td><td>${esc(s.track) || '-'}</td>
            <td>
                <button class="btn btn-info btn-sm" onclick="showStudentDetails('${s.id}')">تفاصيل</button>
                <button class="btn btn-edit btn-sm" onclick='startEditStudent(${JSON.stringify(s).replace(/'/g, "&#39;")})'>تعديل</button>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">حذف</button>
            </td>
        </tr>`).join('');
}

function startEditStudent(s) {
    editingStudentId = s.id;
    document.getElementById('sName').value = s.name;
    document.getElementById('sGrade').value = s.grade;
    document.getElementById('sSection').value = s.section;
    document.getElementById('sTrack').value = s.track || '';
    document.getElementById('sBtnText').textContent = '💾 حفظ التعديل';
    document.getElementById('sCancelBtn').style.display = 'inline-flex';
    document.getElementById('sName').focus();
}

function resetStudentForm() {
    editingStudentId = null;
    ['sName', 'sGrade', 'sSection', 'sTrack'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('sBtnText').textContent = '➕ إضافة طالب';
    document.getElementById('sCancelBtn').style.display = 'none';
}

async function saveStudent() {
    const body = {
        name: document.getElementById('sName').value.trim(),
        grade: document.getElementById('sGrade').value.trim(),
        section: document.getElementById('sSection').value.trim(),
        track: document.getElementById('sTrack').value.trim(),
    };
    if (!body.name || !body.grade || !body.section) return toast('الاسم والصف والشعبة مطلوبة', 'error');
    try {
        if (editingStudentId) {
            await api(`/students/${editingStudentId}`, { method: 'PUT', body });
            toast('تم تعديل الطالب');
        } else {
            await api('/students', { method: 'POST', body });
            toast('تم إضافة الطالب');
        }
        resetStudentForm();
        await loadStudentsManage();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteStudent(id) {
    if (!confirm('حذف هذا الطالب؟')) return;
    try { await api(`/students/${id}`, { method: 'DELETE' }); toast('تم الحذف'); await loadStudentsManage(); }
    catch (e) { toast(e.message, 'error'); }
}

function importStudents(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', codepage: 65001 });
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            const students = rows.map(r => {
                const name = r['الاسم'] || r['Name'] || r['name'] || r['اسم الطالب'] || '';
                if (!name) return null;
                return {
                    name: String(name).trim(),
                    grade: String(r['الصف'] || r['Grade'] || r['grade'] || '').trim(),
                    section: String(r['الشعبة'] || r['Section'] || r['section'] || '').trim(),
                    track: String(r['التخصص'] || r['Track'] || r['track'] || '').trim(),
                };
            }).filter(Boolean);
            if (students.length === 0) return toast('لا توجد بيانات صالحة في الملف', 'error');
            const res = await api('/students/bulk', { method: 'POST', body: { students, replace: true } });
            await loadStudentsManage();
            toast(`تم استيراد ${res.count} طالب`);
        } catch (err) { console.error(err); toast(err.message || 'خطأ في قراءة الملف', 'error'); }
        finally { event.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
}

// ===== إدارة المعلمات =====
let editingTeacherId = null;

// قائمة الصفوف/الشعب المتاحة (مشتقّة من الطلاب) لاختيار التكليفات
function classOptions() {
    const set = new Map();
    adminStudents.forEach(s => set.set(`${s.grade}|${s.section}`, { grade: s.grade, section: s.section }));
    return [...set.values()].sort((a, b) => (a.grade + a.section).localeCompare(b.grade + b.section, 'ar'));
}

function renderAssignGrid(selected = []) {
    const sel = new Set(selected.map(a => `${a.grade}|${a.section}`));
    const opts = classOptions();
    const grid = document.getElementById('assignGrid');
    if (opts.length === 0) {
        grid.innerHTML = '<div style="color:var(--muted);font-size:13px;">أضف طلاباً أولاً لتظهر الصفوف.</div>';
        return;
    }
    grid.innerHTML = opts.map(o => {
        const key = `${o.grade}|${o.section}`;
        const checked = sel.has(key);
        return `<label class="assign-item ${checked ? 'checked' : ''}">
            <input type="checkbox" value="${esc(o.grade)}__${esc(o.section)}" ${checked ? 'checked' : ''}
                onchange="this.closest('.assign-item').classList.toggle('checked', this.checked)">
            ${esc(o.grade)} - ${esc(o.section)}
        </label>`;
    }).join('');
}

function collectAssignments() {
    return [...document.querySelectorAll('#assignGrid input:checked')].map(cb => {
        const [grade, section] = cb.value.split('__');
        return { grade, section };
    });
}

async function loadTeachersManage() {
    try { adminTeachers = await api('/teachers'); } catch (e) { return toast(e.message, 'error'); }
    document.getElementById('statTeachers').textContent = adminTeachers.length;
    document.getElementById('teachersCount').textContent = adminTeachers.length;
    if (!editingTeacherId) renderAssignGrid([]);
    renderTeachersManage();
}

function renderTeachersManage() {
    const term = (document.getElementById('tSearchManage').value || '').toLowerCase();
    const rows = adminTeachers.filter(t =>
        !term || [t.name, t.username].some(v => (v || '').toLowerCase().includes(term)));
    const body = document.getElementById('teachersManageBody');
    if (rows.length === 0) {
        body.innerHTML = '<tr class="empty-row"><td colspan="4">لا توجد معلمة مطابقة</td></tr>';
        return;
    }
    body.innerHTML = rows.map(t => {
        const cls = (t.assignments || []).map(a => `${a.grade}-${a.section}`).join('، ') || '<span style="color:var(--muted)">لا يوجد</span>';
        return `<tr>
            <td>${esc(t.name)}</td><td>${esc(t.username)}</td><td style="font-size:13px;">${cls}</td>
            <td>
                <button class="btn btn-edit btn-sm" onclick='startEditTeacher(${JSON.stringify(t).replace(/'/g, "&#39;")})'>تعديل</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTeacher('${t.id}')">حذف</button>
            </td>
        </tr>`;
    }).join('');
}

function startEditTeacher(t) {
    editingTeacherId = t.id;
    document.getElementById('tName').value = t.name;
    document.getElementById('tUsername').value = t.username;
    document.getElementById('tUsername').disabled = true;
    document.getElementById('tPassword').value = '';
    document.getElementById('tPassword').placeholder = 'اتركها فارغة للإبقاء عليها';
    document.getElementById('tPassLabel').textContent = 'كلمة مرور جديدة (اختياري)';
    document.getElementById('tBtnText').textContent = '💾 حفظ التعديل';
    document.getElementById('tCancelBtn').style.display = 'inline-flex';
    renderAssignGrid(t.assignments || []);
    document.getElementById('tName').focus();
}

function resetTeacherForm() {
    editingTeacherId = null;
    ['tName', 'tUsername', 'tPassword'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('tUsername').disabled = false;
    document.getElementById('tPassword').placeholder = 'كلمة المرور';
    document.getElementById('tPassLabel').textContent = 'كلمة المرور';
    document.getElementById('tBtnText').textContent = '➕ إضافة معلمة';
    document.getElementById('tCancelBtn').style.display = 'none';
    renderAssignGrid([]);
}

async function saveTeacher() {
    const name = document.getElementById('tName').value.trim();
    const username = document.getElementById('tUsername').value.trim();
    const password = document.getElementById('tPassword').value;
    const assignments = collectAssignments();

    try {
        if (editingTeacherId) {
            if (!name) return toast('الاسم مطلوب', 'error');
            const body = { name, assignments };
            if (password) body.password = password;
            await api(`/teachers/${editingTeacherId}`, { method: 'PUT', body });
            toast('تم تعديل المعلمة');
        } else {
            if (!name || !username || !password) return toast('الاسم واسم المستخدم وكلمة المرور مطلوبة', 'error');
            await api('/teachers', { method: 'POST', body: { name, username, password, assignments } });
            toast('تم إضافة المعلمة');
        }
        resetTeacherForm();
        await loadTeachersManage();
    } catch (e) { toast(e.message, 'error'); }
}

async function deleteTeacher(id) {
    if (!confirm('حذف هذه المعلمة؟')) return;
    try { await api(`/teachers/${id}`, { method: 'DELETE' }); toast('تم الحذف'); await loadTeachersManage(); }
    catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  تغيير كلمة المرور
// ============================================================
function openChangePassword() { openModal('passwordModal'); }

async function changePassword() {
    const cur = document.getElementById('curPass').value;
    const nw = document.getElementById('newPass').value;
    const cf = document.getElementById('confPass').value;
    if (nw !== cf) return toast('كلمة المرور الجديدة غير متطابقة', 'error');
    if (nw.length < 4) return toast('كلمة المرور 4 أحرف على الأقل', 'error');
    try {
        await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: nw } });
        ['curPass', 'newPass', 'confPass'].forEach(id => document.getElementById(id).value = '');
        closeModal('passwordModal');
        toast('تم تغيير كلمة المرور');
    } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
//  التصدير والطباعة
// ============================================================
// يطبّق نفس بحث الاسم على الصفوف المعروضة للمديرة
function visibleAbsences() {
    const term = (document.getElementById('fSearch')?.value || '').toLowerCase();
    return adminAbsences.filter(a => !term || a.studentName.toLowerCase().includes(term));
}

function exportCSV() {
    const rows = visibleAbsences();
    if (rows.length === 0) return toast('لا توجد بيانات للتصدير', 'error');
    let csv = '﻿اسم الطالب,الصف,الشعبة,التخصص,التاريخ,المعلمة,ملاحظات\n';
    rows.forEach(a => {
        csv += `"${a.studentName}","${a.grade}","${a.section}","${a.track || ''}","${a.date}","${a.teacher}","${a.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `غيابات_${todayStr()}.csv`;
    link.click();
    toast('تم التصدير');
}

function printAdminSheet() {
    const rows = visibleAbsences();
    if (rows.length === 0) return toast('لا توجد بيانات للطباعة', 'error');
    printSheet('كشف الغيابات المدرسية', rows, true);
}

function printSheet(title, rows, withTeacher) {
    const now = new Date();
    const today = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const printedBy = `${currentUser.name} (${currentUser.username})`; // الاسم + اسم المستخدم

    const head = `<tr style="background:#667eea;color:white;">
        <th style="padding:11px;border:1px solid #ccc;">#</th>
        <th style="padding:11px;border:1px solid #ccc;">الطالب</th>
        <th style="padding:11px;border:1px solid #ccc;">الصف</th>
        <th style="padding:11px;border:1px solid #ccc;">الشعبة</th>
        <th style="padding:11px;border:1px solid #ccc;">التخصص</th>
        <th style="padding:11px;border:1px solid #ccc;">التاريخ</th>
        ${withTeacher ? '<th style="padding:11px;border:1px solid #ccc;">المعلمة</th>' : ''}
        <th style="padding:11px;border:1px solid #ccc;">ملاحظات</th></tr>`;
    const trs = rows.map((a, i) => `<tr>
        <td style="padding:9px;border:1px solid #ccc;text-align:center;">${i + 1}</td>
        <td style="padding:9px;border:1px solid #ccc;"><strong>${esc(a.studentName)}</strong></td>
        <td style="padding:9px;border:1px solid #ccc;">${esc(a.grade)}</td>
        <td style="padding:9px;border:1px solid #ccc;">${esc(a.section)}</td>
        <td style="padding:9px;border:1px solid #ccc;">${esc(a.track) || '-'}</td>
        <td style="padding:9px;border:1px solid #ccc;">${a.date}</td>
        ${withTeacher ? `<td style="padding:9px;border:1px solid #ccc;">${esc(a.teacher)}</td>` : ''}
        <td style="padding:9px;border:1px solid #ccc;">${esc(a.notes) || '-'}</td></tr>`).join('');

    const area = document.getElementById('printArea');
    area.innerHTML = `<div style="padding:36px;font-family:'Cairo',sans-serif;color:#1a202c;" dir="rtl">
        <!-- الترويسة -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #667eea;padding-bottom:16px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;">🏫</div>
                <div>
                    <div style="font-size:20px;font-weight:900;color:#1a202c;">مدرسة سحاب الثانوية للبنات</div>
                    <div style="font-size:14px;font-weight:700;color:#444;">نظام الحضور والغياب المدرسي</div>
                    <div style="font-size:13px;color:#667eea;font-weight:700;">${esc(title)}</div>
                </div>
            </div>
            <div style="text-align:left;font-size:13px;color:#555;line-height:1.9;">
                <div>📅 ${today}</div>
                <div>🕐 ${time}</div>
            </div>
        </div>
        <div style="font-size:13px;color:#555;margin-bottom:22px;">إجمالي السجلات: <strong>${rows.length}</strong></div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;"><thead>${head}</thead><tbody>${trs}</tbody></table>

        <!-- التذييل -->
        <div style="margin-top:34px;padding-top:14px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:13px;color:#555;">
            <div>طُبع بواسطة: <strong>${esc(printedBy)}</strong></div>
            <div>التوقيع: ............................</div>
        </div>
    </div>`;
    area.style.display = 'block';
    window.print();
    area.style.display = 'none';
}

// طباعة التقرير الذكي الكامل بترويسة
function printReport() {
    if (!reportData) return toast('لا يوجد تقرير للطباعة', 'error');
    const d = reportData, t = d.totals;
    const now = new Date();
    const today = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const printedBy = `${currentUser.name} (${currentUser.username})`;
    const from = document.getElementById('rFrom').value;
    const to = document.getElementById('rTo').value;
    const period = (from || to) ? `${from || '...'} ← ${to || '...'}` : 'كل الفترات';

    const kpi = (label, val) => `<div style="border:1px solid #ddd;border-radius:8px;padding:10px 14px;min-width:120px;">
        <div style="font-size:12px;color:#666;">${label}</div><div style="font-size:20px;font-weight:800;">${esc(String(val))}</div></div>`;

    const tableRows = (rows, cols) => rows.length
        ? rows.map((r, i) => `<tr>${cols(r, i)}</tr>`).join('')
        : `<tr><td colspan="9" style="padding:10px;text-align:center;color:#888;">لا توجد بيانات</td></tr>`;

    const groupTable = (title, list) => `
        <h3 style="margin:18px 0 8px;font-size:15px;">${title}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
            ${tableRows(list, x => `<td style="padding:7px;border:1px solid #ddd;">${esc(x.label)}</td><td style="padding:7px;border:1px solid #ddd;text-align:center;width:70px;">${x.count}</td>`)}
        </table>`;

    const area = document.getElementById('printArea');
    area.innerHTML = `<div style="padding:34px;font-family:'Cairo',sans-serif;color:#1a202c;" dir="rtl">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #667eea;padding-bottom:16px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:24px;">📊</div>
                <div>
                    <div style="font-size:20px;font-weight:900;color:#1a202c;">مدرسة سحاب الثانوية للبنات</div>
                    <div style="font-size:14px;font-weight:700;color:#444;">نظام الحضور والغياب المدرسي</div>
                    <div style="font-size:13px;color:#667eea;font-weight:700;">التقرير الشامل — الفترة: ${esc(period)}</div>
                </div>
            </div>
            <div style="text-align:left;font-size:13px;color:#555;line-height:1.9;"><div>📅 ${today}</div><div>🕐 ${time}</div></div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
            ${kpi('إجمالي الغيابات', t.totalAbsences)}
            ${kpi('طلاب متغيّبون', `${t.uniqueStudents}/${t.studentCount}`)}
            ${kpi('نسبة الغياب', t.absentRate + '%')}
            ${kpi('متوسط يومي', t.avgPerDay)}
            ${kpi('أكثر يوم', t.peakDay ? `${t.peakDay.date} (${t.peakDay.count})` : '—')}
        </div>

        <h3 style="margin:8px 0;font-size:15px;">🔝 أكثر الطلاب غياباً</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="background:#667eea;color:white;">
                <th style="padding:8px;border:1px solid #ccc;">#</th><th style="padding:8px;border:1px solid #ccc;">الطالب</th>
                <th style="padding:8px;border:1px solid #ccc;">الصف</th><th style="padding:8px;border:1px solid #ccc;">الشعبة</th>
                <th style="padding:8px;border:1px solid #ccc;">التخصص</th><th style="padding:8px;border:1px solid #ccc;">الغيابات</th>
                <th style="padding:8px;border:1px solid #ccc;">آخر غياب</th></tr></thead>
            <tbody>${tableRows(d.topStudents, (s, i) => `
                <td style="padding:7px;border:1px solid #ddd;text-align:center;">${i + 1}</td>
                <td style="padding:7px;border:1px solid #ddd;"><strong>${esc(s.studentName)}</strong></td>
                <td style="padding:7px;border:1px solid #ddd;">${esc(s.grade)}</td>
                <td style="padding:7px;border:1px solid #ddd;">${esc(s.section)}</td>
                <td style="padding:7px;border:1px solid #ddd;">${esc(s.track) || '-'}</td>
                <td style="padding:7px;border:1px solid #ddd;text-align:center;"><strong>${s.count}</strong></td>
                <td style="padding:7px;border:1px solid #ddd;">${s.lastDate}</td>`)}</tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px;">
            <div>${groupTable('حسب الصف', d.byGrade)}${groupTable('حسب التخصص', d.byTrack)}</div>
            <div>${groupTable('حسب الصف والشعبة', d.bySection)}${groupTable('حسب المعلمة', d.byTeacher)}</div>
        </div>

        <div style="margin-top:26px;padding-top:14px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:13px;color:#555;">
            <div>طُبع بواسطة: <strong>${esc(printedBy)}</strong></div>
            <div>التوقيع: ............................</div>
        </div>
    </div>`;
    area.style.display = 'block';
    window.print();
    area.style.display = 'none';
}

// ---------- أدوات ----------
function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- دخول تلقائي + Enter ----------
window.addEventListener('load', async () => {
    const t = localStorage.getItem('authToken');
    const u = localStorage.getItem('currentUser');
    if (t && u) {
        authToken = t; currentUser = JSON.parse(u);
        try { await enterApp(); } catch { logout(); }
    } else {
        showPage('loginPage');
    }
});
document.addEventListener('keypress', e => {
    if (e.key === 'Enter' && document.getElementById('loginPage').classList.contains('active')) login();
});
