import mongoose from 'mongoose';

// جدول الطلاب
const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true }, // الصف
    section: { type: String, required: true, trim: true }, // الشعبة
    track: { type: String, trim: true, default: '' }, // التخصص (علمي/أدبي...)
  },
  { timestamps: true }
);

// عند تحويل الوثيقة إلى JSON: حوّل _id إلى id نصّي حتى تتوافق الواجهة مع المنطق
studentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

export default mongoose.model('Student', studentSchema);
