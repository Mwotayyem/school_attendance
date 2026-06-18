import { Router } from 'express';
import * as Absences from '../data/absences.js';
import * as Students from '../data/students.js';
import * as Settings from '../data/settings.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// تجميع عدّاد حسب مفتاح من قائمة، وإرجاعه مرتّباً تنازلياً
function groupCount(list, keyFn) {
  const m = new Map();
  for (const a of list) {
    const k = keyFn(a);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((x, y) => y.count - x.count);
}

// تقرير شامل ذكي — Firestore لا يدعم Aggregation، فنحسب في الكود.
//   الفلاتر: ?teacherId= &grade= &section= &track= &from= &to=
router.get('/summary', requireAuth, requireAdmin, async (req, res) => {
  const { teacherId, grade, section, track, from, to } = req.query;

  // كل الغيابات المطابقة للفلتر
  const absences = await Absences.listAbsences({ teacherId, grade, section, track, from, to });

  // عدد الطلاب ضمن نفس فلتر الصف/الشعبة/التخصص (لنسبة الغياب)
  const studentCount = await Students.countStudents({ grade, section, track });

  // الإجماليات
  const total = absences.length;
  const uniqueStudents = new Set(absences.map((a) => String(a.studentId))).size;
  const days = new Set(absences.map((a) => a.date));
  const uniqueDays = days.size;

  // اتجاه الأيام (تصاعدي بالتاريخ)
  const byDate = groupCount(absences, (a) => a.date).sort((x, y) => x.label.localeCompare(y.label));

  // أكثر يوم غياباً
  let peakDay = null;
  for (const d of byDate) if (!peakDay || d.count > peakDay.count) peakDay = { date: d.label, count: d.count };

  const avgPerDay = uniqueDays ? +(total / uniqueDays).toFixed(1) : 0;
  const absentRate = studentCount ? +((uniqueStudents / studentCount) * 100).toFixed(1) : 0;

  // أكثر الطلاب غياباً (أعلى 10)
  const byStudent = new Map();
  for (const a of absences) {
    const k = String(a.studentId);
    if (!byStudent.has(k)) {
      byStudent.set(k, { studentId: k, studentName: a.studentName, grade: a.grade, section: a.section, track: a.track || '', count: 0, lastDate: a.date });
    }
    const e = byStudent.get(k);
    e.count++;
    if (a.date > e.lastDate) e.lastDate = a.date;
  }
  const topStudents = [...byStudent.values()]
    .sort((x, y) => (y.count - x.count) || x.studentName.localeCompare(y.studentName, 'ar'))
    .slice(0, 10);

  res.json({
    totals: {
      totalAbsences: total,
      uniqueStudents,
      uniqueDays,
      studentCount,
      avgPerDay,
      absentRate,
      peakDay,
    },
    topStudents,
    byGrade: groupCount(absences, (a) => a.grade),
    bySection: groupCount(absences, (a) => `${a.grade} - ${a.section}`),
    byTrack: groupCount(absences, (a) => a.track || 'غير محدد'),
    byTeacher: groupCount(absences, (a) => a.teacher),
    byDate,
  });
});

// تقرير غياب الطالبات: صفّ لكل طالبة لها غياب ضمن الفلتر.
//   الفلاتر: ?from= &to= &grade= &section= &track= &name= (بحث بالاسم) &onlyOver= (المتجاوزات فقط)
// لكل طالبة: إجمالي الغياب، بعذر، بدون عذر، نسبة الحضور (إن وُجدت أيام دوام)، وهل تجاوزت السقف.
router.get('/students', requireAuth, requireAdmin, async (req, res) => {
  const { from, to, grade, section, track, name, onlyOver } = req.query;
  const settings = await Settings.getSettings();
  const limit = settings.absenceLimit || 20;

  const absences = await Absences.listAbsences({ grade, section, track, from, to });

  // عدد أيام الدوام التقريبي = عدد الأيام التي سُجّل فيها أي غياب (ضمن نفس الفلتر)
  const schoolDays = new Set(absences.map((a) => a.date)).size;

  const term = (q) => q || ''; // أداة مساعدة
  const byStudent = new Map();
  for (const a of absences) {
    const k = String(a.studentId);
    if (!byStudent.has(k)) {
      byStudent.set(k, {
        studentId: k, studentName: a.studentName, grade: a.grade, section: a.section,
        track: a.track || '', total: 0, excused: 0, unexcused: 0, lastDate: a.date,
      });
    }
    const e = byStudent.get(k);
    e.total++;
    if (a.excused) e.excused++; else e.unexcused++;
    if (a.date > e.lastDate) e.lastDate = a.date;
  }

  let rows = [...byStudent.values()].map((e) => {
    // نسبة الحضور = (أيام الدوام − غيابات الطالبة) ÷ أيام الدوام
    const attendanceRate = schoolDays ? Math.max(0, +(((schoolDays - e.total) / schoolDays) * 100).toFixed(1)) : null;
    return { ...e, attendanceRate, over: e.unexcused >= limit };
  });

  // بحث بالاسم (يصل لأي طالبة لها غياب ضمن الفلتر، بلا حاجة لإظهارها مسبقاً)
  const q = (name || '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.studentName.toLowerCase().includes(q));
  if (onlyOver === 'true' || onlyOver === '1') rows = rows.filter((r) => r.over);

  // الأكثر غياباً (بدون عذر) أولاً
  rows.sort((x, y) => (y.unexcused - x.unexcused) || (y.total - x.total) || x.studentName.localeCompare(y.studentName, 'ar'));

  res.json({
    limit,
    schoolDays,
    terms: settings.terms || [],
    totals: {
      students: rows.length,
      over: rows.filter((r) => r.over).length,
      totalAbsences: rows.reduce((s, r) => s + r.total, 0),
      excused: rows.reduce((s, r) => s + r.excused, 0),
      unexcused: rows.reduce((s, r) => s + r.unexcused, 0),
    },
    rows,
  });
});

export default router;
