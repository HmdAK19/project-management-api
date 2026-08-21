# Project Management API

The companion REST API for the
[Project Management Platform](https://github.com/HmdAK19/project-management).
It supports authentication, private project workspaces, project-scoped roles,
Kanban boards, tasks, sprints, activity history, and project documents.

This repository is intentionally separate from the React frontend. The API can
therefore be reviewed, tested, and deployed independently while the portfolio's
main emphasis remains on frontend engineering.

## Highlights

- Registration, login, short-lived access tokens, and rotating refresh tokens
- Password hashing with bcrypt
- Private projects with automatic owner membership
- Project-scoped RBAC with `OWNER`, `ADMIN`, `MEMBER`, and `VIEWER` roles
- Permission checks enforced at the API boundary
- Member management, self-service project exit, and atomic ownership transfer
- Boards, configurable columns, drag-and-drop task ordering, and favorites
- Sprint and backlog workflows
- Tasks, assignees, priorities, labels, subtasks, comments, and time estimates
- Project activity history and document/wiki endpoints
- Pagination and consistent structured error responses
- Prisma migrations and portfolio seed data
- RBAC integration coverage for every project role and non-members

## Access model

There is no platform-wide administrator role. Authorization is isolated per
project.

| Role | Capabilities |
| --- | --- |
| Owner | Full project control, deletion, role management, and ownership transfer |
| Admin | Project settings, lower-role members, boards, sprints, tasks, and documents |
| Member | Tasks, comments, project documents, and activity access |
| Viewer | Read-only project and activity access |

The frontend hides unavailable actions, while this API independently validates
membership and permissions for protected requests.

## Technology stack

- Node.js and TypeScript
- Express
- Prisma ORM
- SQLite for simple local portfolio setup
- bcryptjs
- Access and refresh token authentication

## Getting started

### Requirements

- Node.js 20 or newer
- npm

### Installation

```bash
git clone https://github.com/HmdAK19/project-management-api.git
cd project-management-api
npm install
```

Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random
value. Never commit `.env` or database files.

```env
PORT=4000
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-secret"
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
CLIENT_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"
```

In production, set `CLIENT_ORIGIN` to the exact frontend URL (for example,
`https://your-frontend.vercel.app`). The frontend must also send auth requests
with credentials enabled so the cross-site refresh-token cookie is included.

Prepare the database and start the API:

```bash
npm run generate
npm run migrate:deploy
npm run seed
npm run dev
```

The API is available at `http://localhost:4000/api`. Its health endpoint is
`GET /api/health`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with file watching |
| `npm run build` | Compile TypeScript |
| `npm run start` | Start the API |
| `npm run generate` | Generate the Prisma client |
| `npm run migrate` | Create and apply a development migration |
| `npm run migrate:deploy` | Apply committed migrations |
| `npm run seed` | Populate portfolio demo data |
| `npm run studio` | Open Prisma Studio |
| `npm run test:rbac` | Run the project-role integration suite |

## API areas

| Area | Base routes |
| --- | --- |
| Authentication | `/api/auth/*` |
| Projects | `/api/projects/*` |
| Project members | `/api/projects/:projectId/members/*` |
| Boards and columns | `/api/boards/*`, `/api/projects/:projectId/boards/*` |
| Tasks | `/api/tasks/*` |
| Sprints | `/api/sprints/*` |
| Activity | `/api/activity/*` |
| Documents | `/api/wiki/*` |

Protected routes require an access token and the appropriate project
membership. The source code remains the authority for request and response
details while the API is under active development.

## Verification

```bash
npm run build
```

For the RBAC integration test, start the API in another terminal and run:

```bash
npm run test:rbac
```

The suite creates isolated users and a temporary project, verifies owner,
admin, member, viewer, and non-member boundaries, transfers ownership, checks
immediate access revocation, and cleans up its temporary records.

## Repository safety

The repository ignores dependencies, compiled output, environment files, and
SQLite database files. Review staged files before every public push and keep
production secrets outside source control.

## Author

**Hamed Akbarzadeh**

- [GitHub](https://github.com/HmdAK19)
- [LinkedIn](https://www.linkedin.com/in/hmd-akbarzadeh/)

## License

This project is currently shared as a portfolio project. No open-source license
has been selected yet.
