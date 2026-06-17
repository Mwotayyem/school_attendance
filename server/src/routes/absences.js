import { Router } from 'express';
import * as Absences from '../data/absences.js';
import * as Students from '../data/students.js';
import * as Teachers from '../data/teachers.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// جلب الغيابات مع فلاتر اختيارية (للمديرة):
//   ?teacherId= &grade= &section= &track= &date= &from= &to=
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const { teacherId, grade, section, track, date, from, to } = req.query;
  res.json(await Absences.listAbsences({ teacherId, grade, section, track, date, from, to }));
});

// غيابات المعلمة الحالية (التي سجّلتها هي) — اختياري ?date=
router.get('/mine', requireAuth, async (req, res) => {
  res.json(await Absences.listAbsences({ teacherId: req.user.id, date: req.query.date }));
});

// التحقق من أن المعلمة مكلّفة بصف/شعبة الطالب
function isAssigned(teacher, grade, section) {
  return (teacher.assignments || []).some((a) => a.grade === grade && a.section === section);
}

// تسجيل غياب (المعلمة لطلاب صفوفها، أو المديرة لأي طالب)
router.post('/', requireAuth, async (req, res) => {
  const { studentId, notes } = req.body || {};
  if (!studentId) return res.status(400).json({ error: 'لم يُحدّد الطالب' });

  const student = await Students.findById(studentId);
  if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

  // قيد المعلمة: فقط طلاب صفوفها المسندة
  if (req.user.role !== 'admin') {
    const teacher = await Teachers.findById(req.user.id);
    if (!teacher || !isAssigned(teacher, student.grade, student.section)) {
      return res.status(403).json({ error: 'هذا الطالب ليس ضمن صفوفك المسندة' });
    }
  }

  const date = new Date().toISOString().split('T')[0];

  try {
    const absence = await Absences.createAbsence({
      studentId: String(student.id),
      studentName: student.name,
      grade: student.grade,
      section: student.section,
      track: student.track || '',
      date,
      teacherId: req.user.id,
      teacher: req.user.name,
      teacherUsername: req.user.username,
      notes: notes || '',
    });
    res.status(201).json(absence);
  } catch (err) {
    if (err instanceof Absences.DuplicateAbsenceError) {
      return res.status(409).json({ error: 'الطالب مُسجّل غائباً اليوم بالفعل' });
    }
    throw err;
  }
});

// التراجع/حذف سجل غياب:
//   - المديرة: أي سجل
//   - المعلمة: فقط السجلات التي سجّلتها هي
router.delete('/:id', requireAuth, async (req, res) => {
  const absence = await Absences.findById(req.params.id);
  if (!absence) return res.status(404).json({ error: 'السجل غير موجود' });

  if (req.user.role !== 'admin' && String(absence.teacherId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'لا يمكنك حذف غياب سجّلته معلمة أخرى' });
  }

  await Absences.deleteAbsence(req.params.id);
  res.json({ ok: true });
});

export default router;
