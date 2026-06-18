import { Firestore, FieldValue } from '@google-cloud/firestore';

// عميل Firestore واحد لكل العملية.
// المصادقة (بالأولوية):
//   1) متغيّر FIREBASE_SERVICE_ACCOUNT يحوي محتوى مفتاح الخدمة JSON كنصّ
//      (الطريقة المعتمدة للنشر على Render / أي استضافة لا ترفع ملفات سرّية).
//   2) متغيّر GOOGLE_APPLICATION_CREDENTIALS يشير لملف مفتاح خدمة (محلياً).
//   3) ADC: gcloud auth application-default login، أو حساب الخدمة المرفق على Cloud Run.
// المشروع يُؤخذ من GOOGLE_CLOUD_PROJECT أو من المفتاح/ADC.
// المحاكي (للاختبار): يُفعّل تلقائياً عند ضبط FIRESTORE_EMULATOR_HOST.
const settings = { ignoreUndefinedProperties: true };
if (process.env.GOOGLE_CLOUD_PROJECT) settings.projectId = process.env.GOOGLE_CLOUD_PROJECT;

// إن وُجد المفتاح كنصّ في متغيّر البيئة (Render)، نمرّره مباشرة للعميل.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  let creds;
  try {
    creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ليس JSON صالحاً — تأكّد من لصق محتوى الملف كاملاً.');
  }
  // بعض المنصّات تحوّل \n في المفتاح إلى نصّ حرفي؛ نعيدها أسطراً حقيقية.
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  settings.credentials = { client_email: creds.client_email, private_key: creds.private_key };
  if (!settings.projectId && creds.project_id) settings.projectId = creds.project_id;
}

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
