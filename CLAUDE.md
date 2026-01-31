# CLAUDE.md - Project Context for AI Assistants

## Project Overview
**RetroFlow** - A real-time collaborative agile retrospective tool built with React, Node.js, Socket.IO, PostgreSQL, and Redis.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL (persistent data) + Redis (real-time state)
- **ORM**: Prisma
- **Auth**: JWT (access + refresh tokens)
- **Deployment**: Docker Compose behind Nginx Proxy Manager

## Project Structure
```
/root/retrospective/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Board/      # Main board component
│   │   │   ├── PhaseControl.tsx
│   │   │   ├── PhaseTutorial.tsx
│   │   │   └── Timer.tsx
│   │   ├── context/        # React contexts
│   │   │   ├── AuthContext.tsx
│   │   │   ├── RoomContext.tsx
│   │   │   └── SocketContext.tsx
│   │   ├── i18n/           # Translations
│   │   │   ├── en.ts
│   │   │   └── index.ts
│   │   └── pages/          # Page components
│   │       ├── Dashboard.tsx
│   │       ├── Join.tsx
│   │       ├── Login.tsx
│   │       ├── MyRetros.tsx
│   │       └── Register.tsx
│   └── vite.config.ts
├── server/                 # Node.js backend
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── src/
│       ├── middleware/     # Auth middleware
│       ├── routes/         # REST API routes
│       ├── services/       # Business logic
│       ├── socket/         # Socket.IO handlers
│       └── store/          # Redis store
├── shared/                 # Shared types
│   └── types.ts
├── docker-compose.yml
├── client.Dockerfile
└── server.Dockerfile
```

## Key Concepts

### Phases
Retrospectives follow a structured flow:
1. **SETUP** - Preparation
2. **IDEATION** - Add post-its (hidden from others)
3. **DISCUSSION** - Reveal and discuss ideas
4. **GROUPING** - Organize into themes
5. **VOTING** - Vote on priorities (3 votes per person)
6. **ACTIONS** - Define action items
7. **CONCLUSION** - Summary

### Roles
- **FACILITATOR** - Room creator, full control
- **PARTICIPANT** - Can add post-its, vote
- **OBSERVER** - Read-only access

### Data Storage
- **PostgreSQL**: Users, rooms metadata, participants (persistent)
- **Redis**: Room state, post-its, votes, groups (real-time)
- Rooms can be restored from PostgreSQL if Redis data is lost

## Common Commands

```bash
# Development
docker compose up --build -d

# View logs
docker logs retrospective-server-1 -f
docker logs retrospective-client-1 -f

# Prisma migrations
docker exec retrospective-server-1 npx prisma migrate dev

# Test API
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'
```

## Environment Variables
Set in `docker-compose.yml`:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `JWT_REFRESH_SECRET` - Secret for refresh tokens

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh tokens
- `GET /api/auth/me` - Get current user

### Rooms
- `GET /api/rooms` - List user's rooms
- `GET /api/rooms/:id` - Get room details
- `DELETE /api/rooms/:id` - Delete room

## Socket Events

### Client → Server
- `room:create` - Create new room
- `room:join` - Join existing room
- `room:rejoin` - Reconnect to room
- `room:check` - Check room info
- `room:delete` - Delete room
- `room:close` - Close room
- `room:reopen` - Reopen room
- `phase:change` - Change phase
- `postit:create` - Add post-it
- `postit:update` - Edit post-it
- `postit:delete` - Remove post-it
- `postit:vote` - Vote on post-it
- `group:create` - Create theme
- `group:vote` / `group:unvote` - Vote on theme
- `action:create` / `action:update` / `action:delete` - Manage actions
- `timer:start` / `timer:stop` - Timer controls

### Server → Client
- `room:updated` - Room state changed
- `room:deleted` - Room was deleted
- `participant:joined` - New participant
- `participant:status` - Online/offline status
- `postit:created` - New post-it added

## Deployment
Production URL: `https://retro.twibox.fr`
- Nginx Proxy Manager handles SSL and routing
- Vite proxy forwards `/api` and `/socket.io` to server
