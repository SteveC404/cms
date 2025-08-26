# CMS (Refactored)

This is a refactor of your Node.js/Express CMS into a modular, maintainable structure with sensible defaults and security middleware.

## Highlights

- **Separation of concerns:** app vs server, routes/controllers/services.
- **Central config:** `src/config` loads `.env` once.
- **DB helper:** connection pool with a small tagged template `query` helper.
- **Security:** `helmet`, rate limiting, CORS, session `httpOnly` and `sameSite`.
- **Error handling:** consistent 404 + error middleware with logging (`winston`).
- **Uploads:** `multer` configured via `UPLOAD_DIR` env var.
- **Static assets:** served from `/public`.
- **Scripts:** `npm run dev` with nodemon.

## Getting Started

```bash
cp .env.example .env
# edit DB_* and SESSION_SECRET

npm install
npm run dev
# open http://localhost:3000
```

### API

- `GET /api/health` – health check
- `POST /api/auth/login` – `{ email, password }`
- `POST /api/auth/logout` – clears session
- `PUT /api/clients/:id` – multipart/form-data with optional `photo` and fields
  - `FirstName, LastName, Comments, Active, Phone, Address, City, State, Zip, Country, DateOfBirth, Gender`
  - Optional `Password` + `Password2` (must match) – hashed with bcrypt

### Notes

- The login controller attempts bcrypt verify first, then falls back to plaintext match to support legacy rows.
- The default session store is memory-only; switch to Redis/SQL for production.
- Update or add more route modules under `src/routes`, their controllers in `src/controllers`.

### Original Artifacts

- Your original `public/` and SQL files are preserved at the project root.