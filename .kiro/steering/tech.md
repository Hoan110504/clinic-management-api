# Tech Stack

## Backend

- **Runtime**: Node.js >= 18, ES Modules (`"type": "module"`)
- **Framework**: Express 4
- **ORM**: Sequelize 6 with `tedious` driver
- **Database**: Microsoft SQL Server (MSSQL), port 1433
- **Auth**: JWT (access + refresh tokens), bcryptjs for password hashing
- **Validation**: express-validator
- **Security**: helmet, express-rate-limit, CORS
- **Logging**: winston + morgan
- **Testing**: Jest

## Frontend

- **Framework**: React 18 with Vite 5
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS 3 + PostCSS
- **UI Primitives**: Radix UI (`@radix-ui/*`)
- **Icons**: lucide-react
- **Charts**: Recharts
- **Notifications**: Sonner (toasts)
- **Validation**: Zod
- **Utilities**: clsx, tailwind-merge, class-variance-authority

## Common Commands

### Backend (`d:\DATN\backend`)

```bash
npm run dev          # Start dev server with nodemon (port 5000)
npm start            # Start production server
npm test             # Run Jest tests with coverage
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix

# Database
npm run db:migrate        # Run Sequelize migrations
npm run db:migrate:undo   # Undo last migration
npm run db:seed           # Run all seeders
npm run db:reset          # Full reset: undo all → migrate → seed
npm run seed:vn           # Seed Vietnamese sample data
```

### Frontend (`d:\DATN\frontend`)

```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run lint     # ESLint check
```

## Environment Variables

### Backend (`.env`)
Key vars: `PORT`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_TRUSTED_CONNECTION`, `DB_TRUST_SERVER_CERT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGIN`

### Frontend (`.env`)
Key vars: `VITE_API_URL` (defaults to `http://localhost:5000/api`)

## Database Notes

- Schema is defined in `backend/database/schema.sql` — tables are created via SQL script, not `sequelize.sync()`
- Migrations live in `backend/database/migrations/`
- Ad-hoc SQL fix scripts are in `backend/database/`
