# API Routes

توثيق كل الـ routes المتاحة في الـ backend، وشكل الطلب والاستجابة، وقواعد التحقق.

## التشغيل

```bash
npm run dev
```

العنوان الافتراضي:

```text
http://localhost:5000
```

المنفذ يأتي من `PORT` في `.env`، والقيمة الافتراضية `5000`.

كل الطلبات التي فيها body لازم تكون JSON (ما عدا رفع الصور `multipart/form-data`):

```http
Content-Type: application/json
```

حجم الـ body الأقصى: **100 KB**.

Admin routes تتطلب:

```http
Authorization: Bearer <accessToken>
```

والدور `admin` مع إعادة تحقق من DB (`requireAdmin`).

## شكل الاستجابة

نجاح:

```json
{
  "success": true,
  "message": "وصف النتيجة",
  "data": {}
}
```

خطأ:

```json
{
  "success": false,
  "message": "وصف الخطأ",
  "errors": ["تفاصيل اختيارية"]
}
```

## ملخص الـ routes

| Method | Path | Auth | الوصف |
| --- | --- | --- | --- |
| `GET` | `/health` | لا | فحص أن السيرفر شغال |
| `POST` | `/api/auth/register` | لا | تسجيل حساب عميل جديد |
| `POST` | `/api/auth/login` | لا | تسجيل الدخول وإصدار JWT |
| `GET` | `/api/auth/me` | Bearer | المستخدم الحالي |
| `POST` | `/api/v1/cart/items` | Bearer | إضافة منتج للسلة (أو دمج الكمية) |
| `GET` | `/api/v1/products` | لا | قائمة منتجات نشطة |
| `GET` | `/api/v1/products/:slug` | لا | تفاصيل منتج نشط |
| `GET` | `/api/admin/products` | Admin | قائمة منتجات (كل الحالات) |
| `GET` | `/api/admin/products/:id` | Admin | منتج بالمعرّف |
| `POST` | `/api/admin/products` | Admin | إنشاء منتج |
| `PATCH` | `/api/admin/products/:id` | Admin | تحديث منتج |
| `DELETE` | `/api/admin/products/:id` | Admin | أرشفة منتج |
| `POST` | `/api/admin/products/:id/images` | Admin | رفع صورة (Cloudinary) |
| `DELETE` | `/api/admin/products/:id/images` | Admin | حذف صورة |
| `GET` | `/api/categories` | لا | تصنيفات نشطة |
| `GET` | `/api/categories/:slug` | لا | تفاصيل تصنيف نشط |
| `GET` | `/api/admin/categories` | Admin | كل التصنيفات |
| `GET` | `/api/admin/categories/:id` | Admin | تصنيف بالمعرّف |
| `POST` | `/api/admin/categories` | Admin | إنشاء تصنيف |
| `PATCH` | `/api/admin/categories/:id` | Admin | تحديث تصنيف |
| `DELETE` | `/api/admin/categories/:id` | Admin | تعطيل تصنيف (soft delete) |

---

## Auth

### POST `/api/auth/register`

ينشئ حساب `customer` فقط. كلمة المرور تُخزَّن كـ hash.

| الحقل | القواعد |
| --- | --- |
| `name` | 2–100 |
| `email` | إيميل صالح، lowercase |
| `password` | 8–128، حرف + رقم |

### POST `/api/auth/login`

| الحقل | القواعد |
| --- | --- |
| `email` | مطلوب |
| `password` | مطلوب |

استجابة `200`:

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "...", "name": "...", "email": "...", "role": "customer", "isActive": true }
  }
}
```

Claims داخل JWT: `sub`, `role`, `tv` (tokenVersion), `iss`, `aud`, `exp`.

### GET `/api/auth/me`

يتطلب Bearer. يرجع المستخدم الحالي إن كان نشطاً.

---

## Cart

### POST `/api/v1/cart/items`

يتطلب `Authorization: Bearer <accessToken>`.

| الحقل | القواعد |
| --- | --- |
| `productId` | مطلوب، ObjectId صالح |
| `quantity` | مطلوب، integer من 1 إلى 99 |

القواعد:
- المنتج يجب أن يكون `active` وتصنيفه نشط و`stock > 0`
- الكمية الإجمالية للسطر ≤ `stock` و≤ 99
- إن وُجد المنتج في السلة تُدمَج الكميات بدل تكرار السطر
- السلة تُنشأ تلقائياً عند أول إضافة

مثال:

```bash
curl -X POST http://localhost:5000/api/v1/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"66f0c1a2b3d4e5f678901234\",\"quantity\":2}"
```

---

## Products (public)

### GET `/api/v1/products`

منتجات `active` فقط، وضمن تصنيفات نشطة فقط. الـ DTO العام يعرض `inStock` دون `stock` ودون `publicId`.

| Query | افتراضي | قواعد |
| --- | --- | --- |
| `page` | `1` | ≥ 1 |
| `limit` | `20` | 1–100 |
| `search` | — | حتى 100 حرف |
| `category` | — | ObjectId صارم أو slug لتصنيف نشط |
| `minPrice` / `maxPrice` | — | ≥ 0 (minor units) |
| `sort` | `-createdAt` | `price`, `-price`, `createdAt`, `-createdAt`, `name`, `-name` |

### GET `/api/v1/products/:slug`

تفاصيل عامة: صور بـ `url` فقط، و`inStock` بدل `stock`.

---

## Products (admin)

### POST `/api/admin/products`

| الحقل | مطلوب | ملاحظات |
| --- | --- | --- |
| `name` | نعم | 2–200 |
| `slug` | لا | يُولَّد من الاسم |
| `description` | لا | |
| `price` | نعم | integer ≥ 0 (minor units) |
| `compareAtPrice` | لا | أكبر من `price` إن وُجد |
| `sku` | نعم | فريد |
| `categoryId` | نعم | تصنيف نشط |
| `stock` | لا | افتراضي 0 |
| `status` | لا | `draft` \| `active` \| `archived` — لا يمكن `active` بدون صورة |

### PATCH `/api/admin/products/:id`

تحديث جزئي. تفعيل `active` يتطلب سعر > 0 وصورة واحدة على الأقل.

### DELETE `/api/admin/products/:id`

يضع `status: archived`.

### POST `/api/admin/products/:id/images`

`multipart/form-data`:

- field `image` (jpeg/png/webp/gif، حتى 5 MB)
- field اختياري `alt`

يتطلب إعداد `CLOUDINARY_*` في `.env`.

### DELETE `/api/admin/products/:id/images`

```json
{ "publicId": "ecommerce/products/.../..." }
```

لا يمكن حذف آخر صورة لمنتج `active`.

---

## Categories

### GET `/api/categories` / `GET /api/categories/:slug`

تصنيفات نشطة فقط.

### Admin categories

نفس حماية Admin + soft delete عبر `isActive: false`.

---

## ملاحظات

- التسجيل ينشئ `customer` فقط؛ حسابات `admin` تُنشأ يدوياً في DB.
- أسعار المنتجات أعداد صحيحة (minor units)، وليست decimals.
- Mongo يخزن `publicId` + `url` فقط للصور؛ لا ملفات ثنائية.
