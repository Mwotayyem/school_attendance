import mongoose from 'mongoose';

// جدول الغيابات (غياب لليوم الكامل)
const absenceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    grade: { type: String, required: true }, // الصف
    section: { type: String, required: true }, // الشعبة
    track: { type: String, default: '' }, // التخصص (لحظة التسجيل)
    date: { type: String, required: true }, // التاريخ YYYY-MM-DD
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    teacher: { type: String, required: true }, // اسم المعلمة
    teacherUsername: { type: String },
    notes: { type: String, default: '' }, // ملاحظات
  },
  { timestamps: true }
);

// منع تسجيل نفس الطالب غائباً مرتين في نفس اليوم
absenceSchema.index({ studentId: 1, date: 1 }, { unique: true });

absenceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

export default mongoose.model('Absence', absenceSchema);
