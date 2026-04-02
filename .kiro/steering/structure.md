# Project Structure

This is a monorepo with two separate workspaces: `backend/` and `frontend/`.

## Backend (`d:\DATN\backend`)

```
src/
├── app.js              # Express app setup (middleware, routes, error handlers)
├── server.js           # Entry point — DB connect + server start
├── config/
│   └── index.js        # Centralized config from env vars
├── controllers/        # Route handlers — one file per resource (*.controller.js)
├── middleware/         # errorHandler, rateLimiter, auth middleware
├── models/             # Sequelize models — one file per table
│   └── database.js     # Sequelize instance
├── routes/             # Express routers — one file per resource (*.routes.js)
│   └── index.js        # Mounts all routers under /api
├── seeders/            # DB seed scripts
├── utils/              # logger, errors (AppError), helpers
└── validators/         # express-validator rule sets

database/
├── schema.sql          # Authoritative DB schema (use this, not sequelize.sync)
├── migrations/         # Sequelize CLI migrations
└── *.sql               # Ad-hoc fix scripts
```

### Backend Patterns

- All routes follow: `routes → controller → model`
- Controllers use `asyncErrorHandler` wrapper from `utils/errors.js` — no try/catch boilerplate needed
- All API responses use `{ success: true, data: ... }` or `{ success: false, error: { code, message, statusCode } }`
- Models are named in PascalCase; Vietnamese models use Vietnamese names (e.g. `BenhNhan`, `LichHen`, `DonThuoc`)
- Route files are named `<resource>.routes.js`, controllers `<resource>.controller.js`
- Auth middleware attaches `req.user` with `{ id, role, ... }`

## Frontend (`d:\DATN\frontend`)

```
src/
├── App.jsx             # Root — AuthProvider, routing, role-based layout
├── main.jsx            # Vite entry point
├── components/
│   ├── ui/             # Low-level UI primitives (built on Radix UI)
│   ├── common/         # Shared composite components
│   ├── forms/          # Reusable form components
│   └── *.jsx           # Layout, Login, Register, etc.
├── config/
│   └── permissions.js  # ROLES, PERMISSIONS, MENU_CONFIG constants
├── context/
│   └── AuthContext.jsx # Global auth state (currentUser, isAuthenticated)
├── hooks/              # Custom hooks: useApi, useConfirm, useFilter, usePagination, etc.
├── pages/
│   ├── admin/          # Admin-only pages
│   ├── doctor/         # Doctor pages
│   ├── patient/        # Patient self-service pages
│   ├── pharmacist/     # Pharmacist pages
│   └── reception/      # Receptionist pages
├── services/
│   ├── api.js          # Base fetch wrapper with JWT auto-refresh
│   └── *.service.js    # One service file per resource
├── utils/              # Shared utility functions
└── validators/         # Zod schemas for form validation
```

### Frontend Patterns

- Role-based routing: `ROUTE_CONFIG` in `App.jsx` maps roles to page components; add new routes there
- All API calls go through `api.js` (`api.get/post/put/patch/delete`) — never use raw `fetch` directly
- Services (`*.service.js`) wrap `api.js` calls for each resource domain
- Auth state lives in `AuthContext` — consume via `useAuth()` hook
- Role/permission checks use `ROLES` and `hasPermission()` from `config/permissions.js`
- Pages are lazy-loaded via `React.lazy()` for code splitting
- Toasts use `sonner` — import from `components/ui/toaster`
- Tailwind utility classes are the primary styling mechanism; use `clsx`/`tailwind-merge` for conditional classes
