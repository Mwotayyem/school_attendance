import { Router } from 'express';
import * as Students from '../data/students.js';
import * as Teachers from '../data/teachers.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// جلب الطلاب:
//  - المديرة: كل الطلاب
//  - المعلمة: طلاب صفوفها المسندة فقط
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.json(await Students.listStudents());
  }
  const teacher = await Teachers.findById(req.user.id);
  res.json(await Students.listStudents(teacher?.assignments || []));
});

// إضافة طالب (للمديرة)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, grade, section, track } = req.body || {};
  if (!name || !grade || !section) {
    return res.status(400).json({ error: 'الرجاء إدخال الاسم والصف والشعبة' });
  }
  const student = await Students.createStudent({ name, grade, section, track: track || '' });
  res.status(201).json(student);
});

// تعديل بيانات طالب — مثل نقله إلى صف/شعبة أخرى (للمديرة)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, grade, section, track } = req.body || {};
  const student = await Students.updateStudent(req.params.id, { name, grade, section, track });
  if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
  res.json(student);
});

// استيراد دفعة طلاب — يستبدل القائمة الحالية (للمديرة)
router.post('/bulk', requireAuth, requireAdmin, async (req, res) => {
  const { students, replace } = req.body || {};
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات صالحة للاستيراد' });
  }
  const docs = students.filter((s) => s && s.name);
  if (replace) await Students.deleteAllStudents();
  const count = await Students.insertStudents(docs);
  res.status(201).json({ count });
});

// حذف طالب (للمديرة)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await Students.deleteStudent(req.params.id);
  res.json({ ok: true });
});

export default router;
