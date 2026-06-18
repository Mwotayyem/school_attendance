import { db } from '../firestore.js';

// إعدادات النظام تُخزَّن في وثيقة واحدة: settings/app
const ref = () => db.collection('settings').doc('app');

// القيم الافتراضية (تُستخدم إن لم تُضبط بعد)
export const DEFAULT_SETTINGS = {
  // سقف الغياب بدون عذر لكل فصل دراسي (يتجاوزه = إنذار)
  absenceLimit: 20,
  // الفصول الدراسية بالتاريخ — أي غياب يقع ضمن الفترة يتبع ذلك الفصل
  terms: [
    { key: 'first', name: 'الفصل الأول', from: '', to: '' },
    { key: 'second', name: 'الفصل الثاني', from: '', to: '' },
  ],
};

export async function getSettings() {
  const snap = await ref().get();
  if (!snap.exists) return { ...DEFAULT_SETTINGS };
  // دمج مع الافتراضي حتى لا تنقص مفاتيح أضيفت لاحقاً
  return { ...DEFAULT_SETTINGS, ...snap.data() };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current };
  if (patch.absenceLimit !== undefined) {
    const n = Number(patch.absenceLimit);
    if (Number.isFinite(n) && n > 0) next.absenceLimit = Math.round(n);
  }
  if (Array.isArray(patch.terms)) {
    next.terms = patch.terms.map((t) => ({
      key: String(t.key || '').trim() || t.name,
      name: String(t.name || '').trim(),
      from: String(t.from || '').trim(),
      to: String(t.to || '').trim(),
    })).filter((t) => t.name);
  }
  next.updatedAt = new Date().toISOString();
  await ref().set(next, { merge: true });
  return next;
}

// يحدّد الفصل الذي يقع فيه تاريخ معيّن (أو null إن لم يطابق أي فترة)
export function termForDate(settings, date) {
  if (!date) return null;
  for (const t of settings.terms || []) {
    if (t.from && t.to && date >= t.from && date <= t.to) return t;
    if (t.from && !t.to && date >= t.from) return t;
    if (!t.from && t.to && date <= t.to) return t;
  }
  return null;
}
