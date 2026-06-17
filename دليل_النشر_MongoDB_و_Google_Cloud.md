# 🚀 دليل التحويل إلى MongoDB والنشر على Google Cloud Run

تم تحويل النظام من التخزين في المتصفح (LocalStorage) و Excel إلى **قاعدة بيانات MongoDB سحابية حقيقية** عبر خادم خلفي (API).

## 🧱 كيف أصبحت البنية الآن

```
المتصفح (public/index.html)
        │  نداءات fetch إلى /api/...
        ▼
الخادم الخلفي (server/ — Node.js + Express)
        │  Mongoose
        ▼
قاعدة بيانات MongoDB Atlas (سحابية مجانية)
   ├── جدول students   (الطلاب: اسم، صف، شعبة، تخصص)
   ├── جدول teachers   (المعلمات والمديرة + الصفوف المسندة لكل معلمة)
   └── جدول absences   (الغيابات: غياب لليوم الكامل، لا تكرار للطالب نفسه في نفس اليوم)
```

> **مهم:** المتصفح لا يتصل بـ MongoDB مباشرة. كل البيانات تمرّ عبر الخادم الخلفي، وهذا ما يُنشر على Google Cloud Run.

## 👥 الأدوار والصلاحيات

**المعلمة:**
- ترى وتسجّل غياب طلاب **الصفوف المسندة إليها فقط** (تحدّدها المديرة).
- غياب لليوم الكامل — **لا يمكن تسجيل نفس الطالب غائباً مرتين في اليوم**.
- يمكنها **التراجع** عن غياب سجّلته بالخطأ.
- تطبع كشف غيابها، وتغيّر كلمة مرورها.

**المديرة (الأدمن):**
- تضيف/تعدّل/تحذف الطلاب (الاسم، الصف، الشعبة، التخصص) — بما في ذلك **نقل طالب من صف لآخر**.
- تضيف/تعدّل/تحذف المعلمات و**تسند لكل معلمة صفوفها**، وتعيد ضبط كلمة مرورها.
- تشاهد كل الغيابات مع **فلترة** (حسب المعلمة / الصف / الشعبة / التخصص / التاريخ).
- تطبع كشوفات وتصدّر CSV، وتغيّر كلمة مرورها.

---

## الخطوة 1️⃣ — إنشاء قاعدة بيانات MongoDB Atlas (مجاناً)

1. افتح <https://www.mongodb.com/cloud/atlas/register> وأنشئ حساباً.
2. أنشئ Cluster مجاني (اختر **M0 Free**) — لا يحتاج بطاقة دفع.
3. **Database Access**: أنشئ مستخدماً (Username + Password) واحفظهما.
4. **Network Access**: أضف `0.0.0.0/0` (السماح من أي مكان) — ضروري ليصل خادم Cloud Run.
5. **Connect → Drivers**: انسخ رابط الاتصال، يكون بهذا الشكل:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/school?retryWrites=true&w=majority
   ```
   استبدل `USER` و `PASSWORD` ببياناتك، وأضف اسم القاعدة `school` بعد `.net/`.

---

## الخطوة 2️⃣ — التشغيل المحلي للتجربة (اختياري لكنه مفيد)

```bash
cd server
copy .env.example .env        # على ويندوز (أو cp على ماك/لينكس)
```

افتح ملف `server/.env` واملأ:
```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/school?retryWrites=true&w=majority
JWT_SECRET=اكتب_هنا_نصّاً_عشوائياً_طويلاً
ADMIN_USERNAME=admin
ADMIN_PASSWORD=1234
```

ثم:
```bash
npm install
npm run seed     # تعبئة المديرة + معلمة تجريبية + الطلاب الـ36 (لأول مرة فقط)
npm start
```

افتح المتصفح على <http://localhost:8080>. حسابات التجربة:
- **المديرة:** `admin` / `1234`
- **معلمة تجريبية:** `teacher` / `1234` (مكلّفة بصفّي: العاشر أ، العاشر ب)

---

## الخطوة 3️⃣ — النشر على Google Cloud Run

### تجهيز لمرة واحدة
1. أنشئ حساب Google Cloud (الرابط الذي معك) وفعّل **الفترة المجانية**.
2. ثبّت **gcloud CLI**: <https://cloud.google.com/sdk/docs/install>
3. سجّل الدخول واختر المشروع:
   ```bash
   gcloud auth login
   gcloud config set project معرّف_المشروع
   ```

### النشر (أمر واحد)
نفّذ هذا الأمر **من جذر المشروع** (مجلد SCHOOL، وليس من داخل server) لأن الـ Dockerfile ينسخ كلاً من `server/` و `public/`:

```bash
gcloud run deploy school-attendance \
  --source . \
  --region me-central1 \
  --allow-unauthenticated \
  --set-env-vars MONGODB_URI="رابط_اتصال_Atlas_هنا",JWT_SECRET="نصّ_سرّي_طويل",ADMIN_USERNAME="admin",ADMIN_PASSWORD="1234"
```

> Cloud Run سيبني صورة Docker من `server/Dockerfile` تلقائياً، ويعطيك رابطاً عاماً مثل
> `https://school-attendance-xxxxx.run.app`

### تعبئة البيانات الأولية على السحابة
بعد أول نشر، يجب تعبئة المدير والطلاب مرة واحدة. أسهل طريقة: شغّل seed محلياً مع نفس `MONGODB_URI` (يكتب مباشرة في Atlas):
```bash
cd server
npm run seed
```

افتح الرابط الذي أعطاك إياه Cloud Run، وسجّل الدخول بـ `admin` / `1234`. ✅

---

## 🔐 ملاحظات أمان مهمة

- **غيّر كلمة مرور المدير** فوراً من داخل النظام بعد أول دخول.
- اجعل `JWT_SECRET` نصّاً عشوائياً طويلاً وسرّياً.
- كلمات مرور المعلمين تُخزَّن **مشفّرة (bcrypt)** في قاعدة البيانات — لا تُحفظ كنص صريح.
- ملف `.env` **لا يُرفع إلى Git** (مُستثنى في `.gitignore`).

---

## 📋 مرجع المسارات (API)

| الطريقة | المسار | الصلاحية | الوظيفة |
|--------|--------|----------|---------|
| POST | `/api/auth/login` | الجميع | تسجيل الدخول |
| POST | `/api/auth/change-password` | مسجّل | تغيير كلمة مروره |
| GET | `/api/students` | مسجّل | جلب الطلاب (المعلمة: صفوفها فقط) |
| POST | `/api/students` | مديرة | إضافة طالب |
| PUT | `/api/students/:id` | مديرة | تعديل طالب (نقل صف/شعبة/تخصص) |
| POST | `/api/students/bulk` | مديرة | استيراد دفعة (Excel) |
| DELETE | `/api/students/:id` | مديرة | حذف طالب |
| GET | `/api/teachers` | مديرة | جلب المعلمات |
| POST | `/api/teachers` | مديرة | إضافة معلمة + تكليفاتها |
| PUT | `/api/teachers/:id` | مديرة | تعديل معلمة (اسم/تكليفات/كلمة سر) |
| DELETE | `/api/teachers/:id` | مديرة | حذف معلمة |
| GET | `/api/absences` | مديرة | جلب الغيابات + فلاتر |
| GET | `/api/absences/mine` | مسجّل | غيابات المعلمة الحالية |
| POST | `/api/absences` | مسجّل | تسجيل غياب (مع منع التكرار) |
| DELETE | `/api/absences/:id` | مسجّل | تراجع/حذف غياب (المعلمة: غيابها فقط) |
| GET | `/api/reports/summary` | مديرة | التقرير الشامل الذكي (إحصاءات + تجميعات) |

**فلاتر `/api/absences`** (اختيارية): `teacherId`, `grade`, `section`, `track`, `date`, `from`, `to`.

**فلاتر `/api/reports/summary`** (اختيارية): `teacherId`, `grade`, `section`, `track`, `from`, `to`. يُحسب على الخادم عبر MongoDB Aggregation ويُرجع: المؤشرات (إجمالي/طلاب متغيّبون/نسبة الغياب/متوسط يومي/أكثر يوم)، أكثر الطلاب غياباً، والتجميع حسب الصف/الشعبة/التخصص/المعلمة/اليوم.

---

## ❓ أسئلة شائعة

**أين التقرير الشامل؟**
دخول كمديرة → زر **📊 التقارير** في الأعلى. اختر الفترة (اليوم/الأسبوع/الشهر/الكل أو فترة مخصصة) وفلتر حسب المعلمة/الصف/الشعبة/التخصص. يعرض المؤشرات، أكثر الطلاب غياباً، اتجاه الأيام، والتجميعات — مع طباعة وتصدير CSV.

**كيف أسند صفوفاً لمعلمة؟**
دخول كمديرة → ⚙️ إدارة النظام → تبويب المعلمات → عند الإضافة/التعديل اختر الصفوف من المربعات. الصفوف المتاحة تُشتقّ تلقائياً من طلابك، لذا **أضف الطلاب أولاً**.

**لماذا لا ترى المعلمة أي طلاب؟**
لأنها غير مكلّفة بأي صف بعد، أو لا يوجد طلاب في صفوفها المسندة. أسند لها صفوفاً من لوحة المديرة.

**أين أرفع ملف الطلاب (Excel)؟**
دخول كمديرة → ⚙️ إدارة النظام → تبويب الطلاب → استيراد. الأعمدة المقبولة: **الاسم، الصف، الشعبة، التخصص**. الاستيراد يستبدل القائمة الحالية في قاعدة البيانات.

**هل بيانات الطلاب القدامى (LocalStorage) ستُنقل؟**
لا تُنقل تلقائياً. الطلاب الـ36 الافتراضيون يُضافون عبر `npm run seed`، ويمكنك استيراد قائمتك الحقيقية من Excel.

**هل ما زالت الملفات القديمة (HTML) تعمل؟**
نعم، لم نحذفها، لكنها تستخدم التخزين القديم. النسخة المتصلة بـ MongoDB هي `public/index.html` (+ `public/app.js`).

muhamadt49_db_user
FD2RXPghz9kd1jtP


# Generated by MongoDB Atlas onboarding.
# This file contains sensitive credentials.
# DO NOT commit this file to version control.
# Store it securely (e.g. use a password manager or secrets vault).

MONGODB_USERNAME="muhamadt49_db_user"
MONGODB_PASSWORD="FD2RXPghz9kd1jtP"
MONGODB_URI="mongodb+srv://muhamadt49_db_user:FD2RXPghz9kd1jtP@cluster0.ustvdop.mongodb.net"

mongodb+srv://muhamadt49_db_user:FD2RXPghz9kd1jtP@cluster0.ustvdop.mongodb.net/?appName=Cluster0