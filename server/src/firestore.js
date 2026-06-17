import { Firestore, FieldValue } from '@google-cloud/firestore';

// عميل Firestore واحد لكل العملية.
// المصادقة:
//   - محلياً: gcloud auth application-default login  (ADC)
//   - أو متغيّر GOOGLE_APPLICATION_CREDENTIALS يشير لملف مفتاح خدمة
//   - على Cloud Run: حساب الخدمة المرفق تلقائياً
// المشروع يُؤخذ من GOOGLE_CLOUD_PROJECT أو من ADC.
// المحاكي (للاختبار): يُفعّل تلقائياً عند ضبط FIRESTORE_EMULATOR_HOST.
const settings = { ignoreUndefinedProperties: true };
if (process.env.GOOGLE_CLOUD_PROJECT) settings.projectId = process.env.GOOGLE_CLOUD_PROJECT;

export const db = new Firestore(settings);
export { FieldValue };

// أسماء المجموعات (collections)
export const COL = {
  students: 'students',
  teachers: 'teachers',
  absences: 'absences',
};

// تحويل وثيقة Firestore إلى كائن مع id نصّي (يطابق ما كانت تُرجعه Mongoose)
export function docToObj(snap) {
  if (!snap || !snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

// فحص اتصال بسيط
export async function pingFirestore() {
  await db.collection('health_check').limit(1).get();
}
