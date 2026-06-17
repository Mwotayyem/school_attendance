import { db, COL, docToObj } from '../firestore.js';

const col = () => db.collection(COL.absences);

// معرّف وثيقة حتمي لمنع تسجيل نفس الطالب غائباً مرتين في نفس اليوم
// (بديل الفهرس الفريد في MongoDB)
const dayId = (studentId, date) => `${studentId}_${date}`;

// خطأ يُرمى عند محاولة تسجيل غياب مكرّر
export class DuplicateAbsenceError extends Error {}

// تطبيق الفلاتر في الكود (Firestore يحدّ من تركيب الاستعلامات)
function applyFilters(list, { teacherId, grade, section, track, date, from, to }) {
  return list.filter((a) => {
    if (teacherId && String(a.teacherId) !== String(teacherId)) return false;
    if (grade && a.grade !== grade) return false;
    if (section && a.section !== section) return false;
    if (track && a.track !== track) return false;
    if (date && a.date !== date) return false;
    if (from && a.date < from) return false;
    if (to && a.date > to) return false;
    return true;
  });
}

// جلب الغيابات: نستعلم بالحقل الأكثر انتقائية إن أمكن، ثم نفلتر الباقي بالكود
export async function listAbsences(filters = {}) {
  let q = col();
  // استخدم فلتر مفهرس واحد لتقليل القراءات عند توفّره
  if (filters.teacherId) q = q.where('teacherId', '==', filters.teacherId);
  else if (filters.date) q = q.where('date', '==', filters.date);
  else if (filters.grade) q = q.where('grade', '==', filters.grade);

  const snap = await q.get();
  const all = snap.docs.map(docToObj);
  const filtered = applyFilters(all, filters);
  // ترتيب تنازلي بالتاريخ ثم وقت الإنشاء (يطابق سلوك MongoDB السابق)
  return filtered.sort((a, b) =>
    b.date === a.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date));
}

export async function findById(id) {
  return docToObj(await col().doc(id).get());
}

// تسجيل غياب — يرمي DuplicateAbsenceError إن كان مسجّلاً اليوم مسبقاً
export async function createAbsence(data) {
  const id = dayId(data.studentId, data.date);
  const ref = col().doc(id);
  try {
    await ref.create({ ...data, createdAt: new Date().toISOString() }); // create يفشل إن وُجد المستند
  } catch (err) {
    if (err.code === 6 /* ALREADY_EXISTS */) throw new DuplicateAbsenceError();
    throw err;
  }
  return docToObj(await ref.get());
}

export async function deleteAbsence(id) {
  await col().doc(id).delete();
}
