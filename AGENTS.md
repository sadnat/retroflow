# AGENTS.md - AI Coding Agent Guidelines

## Project Overview
**RetroFlow** - Real-time collaborative agile retrospective tool.
- **Frontend**: React 18 + TypeScript + Vite (port 5173)
- **Backend**: Node.js + Express + Socket.IO (port 3001)
- **Database**: PostgreSQL (persistent) + Redis (real-time state)
- **ORM**: Prisma
- **Auth**: JWT (access + refresh tokens)
- **Production**: https://retro.twibox.fr

## Build & Development Commands

```bash
# Start all services (dev mode with hot reload)
docker compose up --build -d

# Rebuild specific service
docker compose up --build -d server
docker compose up --build -d client

# View logs
docker logs retrospective-server-1 -f
docker logs retrospective-client-1 -f

# Full rebuild (clean)
docker compose down && docker compose up --build -d

# Client: npm run dev | build | lint | preview
# Server: npm run dev | build | start

# Prisma
docker exec retrospective-server-1 npx prisma migrate dev    # Create migration
docker exec retrospective-server-1 npx prisma generate       # Generate client
docker exec retrospective-server-1 npx prisma db push        # Push schema changes
```

## Project Structure

```
/root/retrospective/
├── client/src/
│   ├── components/         # UI (Board/, PhaseControl, Timer, PhaseTutorial)
│   ├── context/            # React contexts (Auth, Room, Socket)
│   ├── i18n/               # Translations (en.ts)
│   ├── pages/              # Page components
│   ├── App.tsx             # Main app + routing
│   └── index.css           # Global styles + CSS variables
├── server/src/
│   ├── middleware/         # Auth middleware
│   ├── routes/             # REST API (auth.ts, rooms.ts)
│   ├── services/           # Business logic
│   ├── socket/handlers.ts  # Socket.IO event handlers
│   └── store/roomStore.ts  # Redis store operations
├── shared/types.ts         # Shared TypeScript types
└── docker-compose.yml
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled** - No implicit any, unused vars, or parameters
- Use explicit types for function parameters and return values
- Prefer interfaces for object shapes, `type` for unions/intersections

### Imports Order
1. External packages (react, socket.io, express)
2. Internal imports (from shared/)
3. Relative imports (../, ./)

### React Components
- Functional components with hooks only
- Define interfaces for props
- **Inline styles via `<style>{\`\`}</style>` pattern** (project convention)
- Contexts: useAuth, useRoom, useSocket

```typescript
interface Props { roomId: string; onClose: () => void; }

export const MyComponent: React.FC<Props> = ({ roomId, onClose }) => {
  const { room } = useRoom();
  return (
    <>
      <div className="my-component">...</div>
      <style>{`.my-component { ... }`}</style>
    </>
  );
};
```

### Naming Conventions
- **Files**: PascalCase for components, camelCase for utils
- **Variables/Functions**: camelCase (`handleSubmit`, `userId`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`)
- **Types/Interfaces**: PascalCase (`Room`, `Participant`)
- **CSS classes**: kebab-case (`topic-card`, `btn-primary`)

### Error Handling
- Use try/catch for async operations
- Return `{ success: boolean, error?: string }` from socket callbacks
- Log errors with context: `console.error('Error in X:', error)`

### Socket Events Pattern
- Client → Server: `entity:action` (e.g., `room:create`, `postit:vote`)
- Server → Client: `entity:event` (e.g., `room:updated`)
- Always include `roomId` and `odlUserId` for authorization

```typescript
socket.on('room:create', async (data, callback) => {
  try {
    const room = await roomStore.createRoom(data);
    callback({ success: true, room });
  } catch (error) {
    console.error('Error creating room:', error);
    callback({ success: false, error: 'Failed to create room' });
  }
});
```

### CSS Variables (index.css)
```css
--bg-color: #0d1117;
--panel-bg: rgba(22, 27, 34, 0.8);
--border-color: #30363d;
--text-primary: #e6edf3;
--text-secondary: #8b949e;
--accent-color: #2f81f7;
--retro-green: #3fb950;
--retro-red: #f85149;
```

## Key Patterns

### Phase Flow
SETUP → IDEATION → DISCUSSION → GROUPING → VOTING → ACTIONS → CONCLUSION

### Room State
- Redis: real-time state (post-its, votes, groups)
- PostgreSQL: metadata (users, rooms, participants)
- Rooms restored from PostgreSQL if Redis data lost

### Authentication
- JWT access token (short-lived) + refresh token (long-lived)
- Socket auth via `socketAuthMiddleware`
- Guest users allowed for joining rooms

## Common Pitfalls
- Use `odlUserId` (not `userId`) from RoomContext for participant ID
- Check `isFacilitator` before allowing admin actions
- Use `socket?.emit()` with null check
- Translations: use `t.section.key` from i18n
- After modifying `shared/types.ts`, rebuild both client and server

## Testing API
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'

curl http://localhost:3001/health
```
