import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// تكليف معلمة بصف/شعبة محددة
const assignmentSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true }, // الصف
    section: { type: String, required: true, trim: true }, // الشعبة
  },
  { _id: false }
);

// جدول المعلمات والمديرة
const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, // مخزّنة مشفّرة (hash)
    role: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
    // الصفوف/الشعب المسندة للمعلمة (للمديرة لا تُستخدم)
    assignments: { type: [assignmentSchema], default: [] },
  },
  { timestamps: true }
);

// تشفير كلمة المرور تلقائياً قبل الحفظ إذا تغيّرت
teacherSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// دالة للتحقق من كلمة المرور
teacherSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// لا نُرجع كلمة المرور أبداً في الـ JSON
teacherSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.password;
  },
});

export default mongoose.model('Teacher', teacherSchema);
