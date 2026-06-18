import { Router } from 'express';
import * as Teachers from '../data/teachers.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// تنقية قائمة التكليفات المرسلة (إزالة الفارغ والمكرر)
function cleanAssignments(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const a of list) {
    const grade = String(a?.grade || '').trim();
    const section = String(a?.section || '').trim();
    if (!grade || !section) continue;
    const key = grade + '|' + section;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ grade, section });
  }
  return out;
}

// جلب المعلمات فقط (بدون المديرة) — للمديرة
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  res.json(await Teachers.listTeachers());
});

// جلب كل المستخدمين (معلمات + مديرات + مدير النظام) — للمديرة، لإدارة كلمات السر
router.get('/all', requireAuth, requireAdmin, async (_req, res) => {
  const all = await Teachers.getAllTeachers(); // بدون كلمات السر
  res.json(all);
});

// إعادة تعيين كلمة سر أي مستخدم (للمديرة) — لا تتطلب كلمة السر القديمة
router.put('/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' });
  }
  const user = await Teachers.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  // بعد إعادة التعيين، يُطلب من المستخدم تغييرها عند أول دخول
  await Teachers.updateTeacher(req.params.id, { password, mustChangePassword: true });
  res.json({ ok: true });
});

// إضافة معلمة مع تكليفاتها (للمديرة)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, username, password, assignments } = req.body || {};
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'الرجاء ملء الاسم واسم المستخدم وكلمة المرور' });
  }

  const exists = await Teachers.findByUsername(username);
  if (exists) {
    return res.status(409).json({ error: 'اسم المستخدم موجود مسبقاً' });
  }

  const teacher = await Teachers.createTeacher({
    name: name.trim(),
    username: username.trim(),
    password,
    role: 'teacher',
    assignments: cleanAssignments(assignments),
  });
  res.status(201).json(teacher);
});

// تعديل معلمة — الاسم و/أو التكليفات و/أو إعادة تعيين كلمة المرور (للمديرة)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, assignments, password } = req.body || {};
  const teacher = await Teachers.findById(req.params.id);
  if (!teacher || teacher.role === 'admin') {
    return res.status(404).json({ error: 'المعلمة غير موجودة' });
  }

  const patch = {};
  if (name !== undefined) patch.name = name.trim();
  if (assignments !== undefined) patch.assignments = cleanAssignments(assignments);
  if (password) patch.password = password;
  const updated = await Teachers.updateTeacher(req.params.id, patch);
  res.json(updated);
});

// حذف معلمة (للمديرة)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const teacher = await Teachers.findById(req.params.id);
  if (teacher?.role === 'admin') {
    return res.status(400).json({ error: 'لا يمكن حذف حساب المديرة' });
  }
  await Teachers.deleteTeacher(req.params.id);
  res.json({ ok: true });
});

export default router;
