# E-Commerce Backend — Current Feature Documentation

Documentation reflects the **implemented** codebase only.  
**Not implemented:** Orders, Payments/Paymob APIs, Webhooks, Email, rate limiting, CORS, password reset, cart GET/update/remove.

---

## Feature overview

The API is a **modular monolith** that currently supports:

| Domain | Capability |
| --- | --- |
| **Health** | Liveness check |
| **Auth** | Register (customer), login (JWT), current user (`/me`) |
| **Categories** | Public list/detail (active); admin CRUD + soft deactivate |
| **Products** | Public list/detail (active); admin CRUD, archive, Cloudinary image upload/delete |
| **Cart** | Authenticated **add item** (merge quantity); returns cart view with live prices |

Prices are stored and returned as **integer minor units** (e.g. cents/piasters), not decimals.

Default base URL (local):

```text
http://localhost:5000
```

JSON body limit: **100 KB** (`Content-Type: application/json`), except product image upload (`multipart/form-data`).

---

## Architecture

```text
HTTP
  → app.ts (express.json, /health, /api)
    → routes/
      → middlewares (authenticate, requireAdmin, validateBody/Query, upload)
      → controllers (thin)
        → services (business rules)
          → models (Mongoose)
          → integrations/cloudinary (images only)
    → errorHandler
```

| Layer | Responsibility |
| --- | --- |
| `routes/` | Path wiring, auth, validation |
| `controllers/` | HTTP status + response envelope |
| `services/` | Business logic, DB, Cloudinary orchestration |
| `models/` | Schemas, indexes, DTO helpers (`toSafeObject`, `toListItem`, …) |
| `validators/` | Input allowlisting / normalization |
| `middlewares/` | AuthZ, multer, validate runners, errors |
| `config/` | Env validation (fail-fast), DB connect + `syncIndexes` |
| `integrations/cloudinary/` | Upload/delete buffers |

**Roles:** `customer` | `admin`. Registration always creates `customer`. Admin is not assignable via public API.

---

## API endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/health` | No |
| `POST` | `/api/auth/register` | No |
| `POST` | `/api/auth/login` | No |
| `GET` | `/api/auth/me` | Bearer |
| `GET` | `/api/categories` | No |
| `GET` | `/api/categories/:slug` | No |
| `GET` | `/api/admin/categories` | Admin |
| `GET` | `/api/admin/categories/:id` | Admin |
| `POST` | `/api/admin/categories` | Admin |
| `PATCH` | `/api/admin/categories/:id` | Admin |
| `DELETE` | `/api/admin/categories/:id` | Admin |
| `GET` | `/api/v1/products` | No |
| `GET` | `/api/v1/products/:slug` | No |
| `GET` | `/api/admin/products` | Admin |
| `GET` | `/api/admin/products/:id` | Admin |
| `POST` | `/api/admin/products` | Admin |
| `PATCH` | `/api/admin/products/:id` | Admin |
| `DELETE` | `/api/admin/products/:id` | Admin |
| `POST` | `/api/admin/products/:id/images` | Admin |
| `DELETE` | `/api/admin/products/:id/images` | Admin |
| `POST` | `/api/v1/cart/items` | Bearer |

---

## Authentication requirements

### Public
No `Authorization` header.

### Bearer (customer or admin JWT)
```http
Authorization: Bearer <accessToken>
```

Issued by `POST /api/auth/login`. JWT: HS256, claims include `sub` (user id), `role`, `tv` (tokenVersion), plus configured `iss` / `aud` / `exp`.

### Admin
`authenticate` **and** `requireAdmin`:

- Loads user from DB
- Requires `isActive`, matching `tokenVersion`, `role === 'admin'`

Customer JWT on admin routes → `403 Forbidden` (or `401` if inactive/missing).

**Note:** Cart uses `authenticate` only (JWT verify). It does **not** re-check `isActive` / `tokenVersion` against the database on each request.

---

## Response envelope

Success:

```json
{
  "success": true,
  "message": "…",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "…",
  "errors": ["optional field-level details"]
}
```

Unknown route → `404` `"Route not found"`.  
Invalid JSON → `400` `"Invalid JSON payload"`.  
Unhandled → `500` `"Internal server error"` (no stack in body).

---

## Request / response examples

### Health

```bash
curl http://localhost:5000/health
```

```json
{
  "success": true,
  "message": "OK",
  "data": { "status": "healthy" }
}
```

### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Ahmed Ali\",\"email\":\"ahmed@example.com\",\"password\":\"secret12\"}"
```

**201** — `data.user` includes `id`, `name`, `email`, `role` (`customer`), `isActive`, timestamps. **No password.**

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"ahmed@example.com\",\"password\":\"secret12\"}"
```

**200**

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "…",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "role": "customer",
      "isActive": true,
      "createdAt": "…",
      "updatedAt": "…"
    }
  }
}
```

### Me

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### Public products

```bash
curl "http://localhost:5000/api/v1/products?page=1&limit=20&sort=-createdAt"
```

Query (validated): `page`, `limit` (1–100), `search` (≤100 chars), `category` (ObjectId or slug), `minPrice`, `maxPrice`, `sort` ∈ `price|-price|createdAt|-createdAt|name|-name`. Optional `status` only if `active` or omitted.

**200** — `data`: `{ items, page, limit, total, totalPages }`.  
List item fields include `id`, `name`, `slug`, `price`, `compareAtPrice`, `categoryId`, `thumbnail` `{ url, alt? }` or `null`, `inStock` (boolean), `status`, `createdAt`. **No** `publicId`, **no** raw `stock`.

### Product by slug

```bash
curl http://localhost:5000/api/v1/products/my-product-slug
```

Public detail: description, images as `{ url, alt?, sortOrder? }` only, `inStock`, no SKU/`publicId`/raw stock in the public mapper.

### Admin create product

```bash
curl -X POST http://localhost:5000/api/admin/products \
  -H "Authorization: Bearer <adminAccessToken>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Phone\",\"price\":99900,\"sku\":\"PHN-1\",\"categoryId\":\"<activeCategoryId>\",\"stock\":10,\"status\":\"draft\"}"
```

**201** — admin detail includes `sku`, `stock`, `images` with `publicId`.

### Upload product image

```bash
curl -X POST http://localhost:5000/api/admin/products/<productId>/images \
  -H "Authorization: Bearer <adminAccessToken>" \
  -F "image=@./photo.jpg" \
  -F "alt=Front"
```

Field name must be **`image`**. Types: jpeg/png/webp/gif. Max **5 MB**. Max **10** images per product.

### Remove product image

```bash
curl -X DELETE http://localhost:5000/api/admin/products/<productId>/images \
  -H "Authorization: Bearer <adminAccessToken>" \
  -H "Content-Type: application/json" \
  -d "{\"publicId\":\"ecommerce/products/<id>/…\"}"
```

### Add to cart

```bash
curl -X POST http://localhost:5000/api/v1/cart/items \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"<productObjectId>\",\"quantity\":2}"
```

**200**

```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "cart": {
      "id": "…",
      "items": [
        {
          "productId": "…",
          "quantity": 2,
          "unitPrice": 99900,
          "lineTotal": 199800,
          "name": "Phone",
          "slug": "phone",
          "thumbnailUrl": "https://…",
          "stock": 10
        }
      ],
      "itemCount": 2,
      "itemsSubtotal": 199800
    }
  }
}
```

### Categories (public)

```bash
curl http://localhost:5000/api/categories
curl http://localhost:5000/api/categories/electronics
```

Admin category create may include optional `image: { publicId, url, alt? }` in JSON (client-supplied metadata; not uploaded through Cloudinary in this codebase).

---

## Error cases (implemented)

| Status | Typical message / situation |
| --- | --- |
| `400` | Validation failed; invalid body/query; product unavailable / out of stock / insufficient stock; compareAtPrice rules; cannot remove last image of **active** product; Cloudinary mime/size |
| `401` | Missing/invalid Bearer; login `"Invalid email or password"`; inactive user on `/me`; admin tokenVersion mismatch |
| `403` | Authenticated non-admin on admin routes |
| `404` | Route / category / product / cart product / image not on product |
| `409` | Duplicate email, category name/slug, product slug/SKU |
| `502` | Cloudinary upload/delete failure (safe message) |
| `503` | *(Not returned for missing Cloudinary at runtime path anymore — env requires Cloudinary at boot)* |

Login does **not** distinguish unknown email vs bad password.

---

## Business rules (as coded)

### Auth
- Register → `role: customer`, `isActive: true`, `tokenVersion: 0`.
- Password hashed with bcrypt (`BCRYPT_SALT_ROUNDS`, default 12); never returned.
- Password: 8–128 chars, ≤72 UTF-8 bytes, at least one letter and one number.

### Categories
- Public endpoints return **`isActive: true` only**.
- `DELETE` admin → soft deactivate (`isActive: false`), not hard delete.
- Name uniqueness via normalized name; slug unique.

### Products
- Public list/detail: **`status === 'active'`** and category **active**.
- List filter prefers slug when `category` is not a strict 24-hex ObjectId.
- Prices / stock integers ≥ 0; `compareAtPrice` must be **> price** when set.
- Cannot set **`status: active`** without `price > 0` and ≥ 1 image (enforced on create/update/publish path).
- `DELETE` admin → **`status: archived`** (not hard delete).
- Public DTOs: `inStock` boolean; no Cloudinary `publicId` on public list/detail.
- Max 10 images; cannot remove last image if product is `active`.

### Cart
- Requires authentication.
- Product must exist, be `active`, category active, `stock > 0`.
- `quantity` integer 1–99 per request; merged line total ≤ stock and ≤ 99.
- Same `productId` **merges** quantity (no duplicate lines).
- Cart created lazily on first add; one cart per `userId`.
- Totals use **live** `product.price` (`unitPrice × quantity`); inactive lines omitted from returned totals.
- **No** GET/update/remove/clear endpoints implemented.
- Cart does **not** decrement inventory.

### Out of scope (do not assume)
- Checkout, orders, Paymob charges, webhooks, email, coupons, shipping quotes.

---

## Environment variables

Validated at process start (`src/config/env.ts`). Missing/blank required vars → process exits with `EnvValidationError` (variable **names** only, not values).

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | No (default `development`) | `development` \| `production` \| `test` |
| `PORT` | No (default `5000`) | |
| `MONGODB_URI` | **Yes** | Must start with `mongodb://` or `mongodb+srv://` |
| `BCRYPT_SALT_ROUNDS` | No (default `12`) | 10–15 |
| `JWT_SECRET` | **Yes** | Dev min 16 chars; prod min 32; prod rejects placeholders |
| `JWT_ISSUER` | No | Default `ecommerce-api` |
| `JWT_AUDIENCE` | No | Default `ecommerce-client` |
| `JWT_ACCESS_EXPIRES_IN_SEC` | No (default `900`) | Prod max `3600` |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | |
| `CLOUDINARY_API_KEY` | **Yes** | |
| `CLOUDINARY_API_SECRET` | **Yes** | |
| `CLOUDINARY_FOLDER` | No (default `ecommerce`) | Prefix for uploads |
| `PAYMOB_API_KEY` | **Yes** | Required at boot; **no payment code uses it yet** |

Copy from `.env.example`. Never commit `.env`.

---

## External integrations

### MongoDB
- Connected in `connectDatabase()` before listen.
- Indexes synced for User, Category, Product, Cart on startup.

### Cloudinary
- Used only for **product** image upload/delete (`integrations/cloudinary/storage.ts`).
- Upload via multer memory buffer → `upload_stream`; stores `publicId` + `secure_url` on the product.
- On DB save failure after upload, compensating Cloudinary delete is attempted.
- On image remove: DB updated first; Cloudinary delete is best-effort (failure logged; API may still succeed).

### Paymob
- **Not integrated** in application code. Env var is required by config only.

### Email
- **Not implemented.**

---

## Testing instructions

There is **no** automated test suite in the project (`package.json` has no `test` script).

### Prerequisites
1. Node ≥ 18.
2. Copy `.env.example` → `.env` and fill **all required** variables (including Cloudinary and `PAYMOB_API_KEY` placeholders for local boot).
3. Reachable MongoDB matching `MONGODB_URI`.

### Run

```bash
npm install
npx tsc --noEmit
npm run dev
```

Production-style:

```bash
npm run build
npm start
```

### Manual smoke checklist

1. `GET /health` → 200.  
2. `POST /api/auth/register` → 201; password absent in body.  
3. `POST /api/auth/login` → 200 + `accessToken`.  
4. `GET /api/auth/me` with token → 200; without → 401.  
5. As **admin** (user with `role: admin` set in DB): create category → create product (`draft`) → upload image → set `status: active` with price > 0.  
6. `GET /api/v1/products` → product appears; response has `inStock`, not `stock`/`publicId`.  
7. As customer: `POST /api/v1/cart/items` → 200; second add merges quantity.  
8. Customer token on `POST /api/admin/products` → 403.  
9. Add qty above stock → 400 Insufficient stock.  
10. Invalid JSON body → 400 Invalid JSON payload.

### Creating an admin (ops)
No public endpoint promotes admins. Set `role: "admin"` on a user document in MongoDB after registration (or insert manually), then login.

---

## Related files (implementation map)

| Area | Paths |
| --- | --- |
| Entry | `src/server.ts`, `src/app.ts` |
| Env / DB | `src/config/env.ts`, `src/config/db.ts` |
| Auth | `src/routes/auth.routes.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `validators/auth.validator.ts`, `models/User.ts`, `utils/jwt.ts`, `utils/password.ts` |
| Categories | `routes/category.routes.ts`, `services/category.service.ts`, `models/Category.ts` |
| Products | `routes/product.routes.ts`, `services/product.service.ts`, `models/Product.ts`, `middlewares/upload.ts` |
| Cart | `routes/cart.routes.ts`, `services/cart.service.ts`, `models/Cart.ts` |
| Cloudinary | `integrations/cloudinary/storage.ts` |
| Errors | `middlewares/errorHandler.ts`, `utils/ApiError.ts`, `utils/ApiResponse.ts` |

---

*Generated from the repository implementation. If behavior and this document disagree, trust the code.*
