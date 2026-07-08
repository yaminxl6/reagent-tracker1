# Reagent Log — دليل الإعداد من الصفر (النسخة الكاملة والنهائية)

## 1) Supabase (مشروع جديد)
1. supabase.com/dashboard/new → أنشئ مشروع جديد باسم مختلف تمامًا عن أي مشروع سابق
2. انتظر لين تصير حالته **Healthy**
3. SQL Editor → New query → افتح ملف `supabase_schema.sql` من هذا المجلد → انسخ **الكل** والصقه → Run
   - المفروض يطلع **Success. No rows returned** بدون أي أخطاء (لأنه مشروع فاضي جديد)
4. Project Settings → Data API → انسخ **API URL** (بدون `/rest/v1/` بالآخر)
5. Project Settings → API Keys → انسخ **Publishable key**

## 2) GitHub (مستودع جديد)
1. github.com/new → اسم جديد → Public → Create repository
2. "uploading an existing file" → اسحب **كل الملفات** بهذا المجلد (12 ملف):
   App.jsx, BarcodeScanner.jsx, Login.jsx, ReceiveWizard.jsx, Settings.jsx,
   index.html, main.jsx, supabaseClient.js, package.json, vite.config.js, .env.example
3. Commit changes

## 3) Vercel (مشروع جديد)
1. vercel.com → Add New → Project → استورد نفس المستودع
2. Environment Variables:
   - `VITE_SUPABASE_URL` = رابط الـ API من خطوة 1
   - `VITE_SUPABASE_ANON_KEY` = الـ Publishable key من خطوة 1
3. Deploy

## 4) أول دخول (3 مستويات صلاحيات)
- **الفريق (staff)**: `lab` / `lab` — يقدر يستقبل، يسجل استهلاك، ويعدّل لو غلط
- **باسل (admin)**: `basil` / `admin123` — نفس صلاحيات الفريق + يقدر يحذف + يشوف Settings
- **محمود (super)**: `mahmoud` / `123456` — كل الصلاحيات + صفحة Activity (سجل كامل لكل تعديل وحذف) + يقدر يمسح نهائيًا + يقدر يسوي حسابات موظفين

⚠️ **غيّر كلمات المرور الافتراضية فورًا** من صفحة Settings (تحتاج تسجل دخول admin أو super).

## 5) قبل ما يستخدمه الفريق
من Settings (بحساب admin أو super):
- أضف قائمة أسماء الريجنت الجاهزة (Presets) اللي يختار منها الفريق وقت الاستقبال
- أضف أي أقسام إضافية غير الافتراضية (Chemistry, Hematology, Blood Bank, Microbiology)
- (اختياري) محمود يقدر يضيف حساب خاص لكل موظف من قسم "Employee accounts"

## الميزات الكاملة بهذي النسخة
- استقبال بـ3 خطوات: التفاصيل (مع خيار Reagent/QC/Cal) → الفحص (Inspection) → ملاحظات
- تسجيل استهلاك يومي مع QC testing وقت الاستخدام + مسح باركود/QR
- Dashboard بالألوان (حرج/تحذير/مستقر) مقسّم حسب القسم
- تعديل متاح للكل، حذف (إخفاء) لباسل ومحمود بس، مسح نهائي لمحمود بس
- صفحة Activity: سجل كامل زمني لكل تعديل/حذف/مسح نهائي + زر مسح السجل كامل
- Reports: بحث برقم اللوت، فلترة بالقسم، فترة زمنية، تفاصيل كاملة (استقبال+فحص+QC+من استخدم)، تصدير Excel
- إعدادات: أقسام قابلة للتعديل، قائمة ريجنت جاهزة، حسابات موظفين، حد التنبيه الافتراضي

## دومين خاص (اختياري)
Vercel → Project → Settings → Domains → أضف الدومين اللي تملكه.
