import { db, COL, docToObj } from '../firestore.js';

const col = () => db.collection(COL.students);

// جلب الطلاب مع فلتر اختياري لقائمة (grade, section) — لتقييد المعلمة بصفوفها.
// Firestore لا يدعم OR على حقول مختلفة بكفاءة، لذا نستعلم لكل تكليف ونجمع.
export async function listStudents(assignments) {
  if (assignments === undefined) {
    const snap = await col().get();
    return sortStudents(snap.docs.map(docToObj));
  }
  if (!assignments || assignments.length === 0) return [];

  // استعلام متوازٍ لكل (صف، شعبة) ثم دمج وإزالة التكرار
  const results = await Promise.all(
    assignments.map((a) =>
      col().where('grade', '==', a.grade).where('section', '==', a.section).get()
    )
  );
  const map = new Map();
  results.forEach((snap) => snap.docs.forEach((d) => map.set(d.id, docToObj(d))));
  return sortStudents([...map.values()]);
}

function sortStudents(arr) {
  return arr.sort((a, b) =>
    (`${a.grade}${a.section}${a.name}`).localeCompare(`${b.grade}${b.section}${b.name}`, 'ar'));
}

export async function findById(id) {
  return docToObj(await col().doc(id).get());
}

export async function countStudents({ grade, section, track } = {}) {
  let q = col();
  if (grade) q = q.where('grade', '==', grade);
  if (section) q = q.where('section', '==', section);
  if (track) q = q.where('track', '==', track);
  const snap = await q.count().get();
  return snap.data().count;
}

export async function createStudent({ name, grade, section, track = '', nationalId = '', dob = '', phone = '', parentPhone = '', gender = '', nationality = '' }) {
  const now = new Date().toISOString();
  const ref = await col().add({ name, grade, section, track, nationalId, dob, phone, parentPhone, gender, nationality, createdAt: now, updatedAt: now });
  return docToObj(await ref.get());
}

export async function updateStudent(id, patch) {
  const clean = { updatedAt: new Date().toISOString() };
  for (const k of ['name', 'grade', 'section', 'track', 'nationalId', 'dob', 'phone', 'parentPhone', 'gender', 'nationality']) if (patch[k] !== undefined) clean[k] = patch[k];
  const ref = col().doc(id);
  const before = await ref.get();
  if (!before.exists) return null;
  await ref.update(clean);
  return docToObj(await ref.get());
}

export async function deleteStudent(id) {
  await col().doc(id).delete();
}

// حذف كل الطلاب (للاستيراد بالاستبدال) — على دفعات
export async function deleteAllStudents() {
  const snap = await col().get();
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
}

// إدخال دفعة طلاب
export async function insertStudents(students) {
  const now = new Date().toISOString();
  let batch = db.batch();
  let n = 0, count = 0;
  for (const s of students) {
    const ref = col().doc();
    batch.set(ref, {
      name: String(s.name || '').trim(),
      grade: String(s.grade || '').trim(),
      section: String(s.section || '').trim(),
      track: String(s.track || '').trim(),
      nationalId: String(s.nationalId || '').trim(),
      dob: String(s.dob || '').trim(),
      phone: String(s.phone || '').trim(),
      parentPhone: String(s.parentPhone || '').trim(),
      gender: String(s.gender || '').trim(),
      nationality: String(s.nationality || '').trim(),
      createdAt: now, updatedAt: now,
    });
    count++;
    if (++n === 450) { await batch.commit(); batch = db.batch(); n = 0; }
  }
  if (n > 0) await batch.commit();
  return count;
}
