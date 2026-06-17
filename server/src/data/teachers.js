import bcrypt from 'bcryptjs';
import { db, COL, docToObj } from '../firestore.js';

const col = () => db.collection(COL.teachers);

// إزالة كلمة المرور قبل الإرجاع للواجهة
function sanitize(t) {
  if (!t) return t;
  const { password, ...rest } = t;
  return rest;
}

// إيجاد معلمة باسم المستخدم (تُرجع الوثيقة كاملة مع كلمة المرور للتحقق الداخلي)
export async function findByUsername(username) {
  const snap = await col().where('username', '==', String(username).trim()).limit(1).get();
  if (snap.empty) return null;
  return docToObj(snap.docs[0]);
}

export async function findById(id) {
  return docToObj(await col().doc(id).get());
}

// كل المعلمات (دور teacher فقط) — بدون كلمة المرور
export async function listTeachers() {
  const snap = await col().where('role', '==', 'teacher').get();
  return snap.docs.map((d) => sanitize(docToObj(d))).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
}

export async function countTeachers() {
  const snap = await col().where('role', '==', 'teacher').count().get();
  return snap.data().count;
}

// إنشاء معلمة/مديرة (تشفّر كلمة المرور) — تُرجع بدون كلمة المرور
export async function createTeacher({ name, username, password, role = 'teacher', assignments = [] }) {
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const ref = await col().add({
    name, username: String(username).trim(), password: hash, role,
    assignments, createdAt: now, updatedAt: now,
  });
  return sanitize(docToObj(await ref.get()));
}

// تعديل معلمة (الاسم/التكليفات/كلمة المرور اختيارياً)
export async function updateTeacher(id, { name, assignments, password }) {
  const patch = { updatedAt: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (assignments !== undefined) patch.assignments = assignments;
  if (password) patch.password = await bcrypt.hash(password, 10);
  await col().doc(id).update(patch);
  return sanitize(docToObj(await col().doc(id).get()));
}

export async function deleteTeacher(id) {
  await col().doc(id).delete();
}

export async function comparePassword(candidate, hash) {
  return bcrypt.compare(candidate, hash);
}

export { sanitize };
