import mongoose from 'mongoose';

// الاتصال بقاعدة بيانات MongoDB Atlas
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('متغيّر البيئة MONGODB_URI غير موجود. ضع رابط اتصال MongoDB في ملف .env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log('✅ تم الاتصال بقاعدة بيانات MongoDB');
}
