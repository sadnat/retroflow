# RetroFlow

A real-time collaborative agile retrospective tool for teams.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Real-time Collaboration** - See changes instantly with Socket.IO
- **Structured Workflow** - Guide your team through 7 phases: Setup, Ideation, Discussion, Grouping, Voting, Actions, Conclusion
- **Phase Tutorials** - Built-in tips and guidance for each phase
- **Anonymous Ideation** - Post-its are hidden until the reveal phase
- **Theme Grouping** - Drag and drop ideas into themes
- **Democratic Voting** - 3 votes per participant to prioritize
- **Action Items** - Assign owners and track commitments
- **User Authentication** - Secure JWT-based auth with refresh tokens
- **Room Management** - Password protection, participant roles, room history
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, Socket.IO
- **Database**: PostgreSQL (persistent) + Redis (real-time)
- **ORM**: Prisma
- **Deployment**: Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Running with Docker

1. Clone the repository:
```bash
git clone https://github.com/sadnat/retroflow.git
cd retroflow
```

2. Start the services:
```bash
docker compose up --build -d
```

3. Access the application at `http://localhost:5173`

### Environment Variables

The following environment variables are configured in `docker-compose.yml`:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://retroflow:retroflow@postgres:5432/retroflow` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | Secret for access tokens | (set your own) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | (set your own) |

## Usage

### Creating a Retrospective

1. Register or login to your account
2. Click "Create" and fill in:
   - Room name (e.g., "Sprint 42 Retro")
   - Your name
   - Template (Classic or Starfish)
   - Optional: Password and post-it limit
3. Share the room link with your team

### Retrospective Phases

| Phase | Description |
|-------|-------------|
| **Setup** | Welcome participants, explain the session |
| **Ideation** | Everyone adds post-its (hidden from others) |
| **Discussion** | Reveal and discuss all ideas |
| **Grouping** | Organize ideas into themes |
| **Voting** | Vote on most important themes (3 votes each) |
| **Actions** | Define action items with owners |
| **Conclusion** | Review summary and next steps |

### Roles

- **Facilitator** - Full control over phases, can manage participants
- **Participant** - Can add post-its, vote, and view
- **Observer** - Read-only access

## Project Structure

```
retroflow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── context/        # React contexts (Auth, Room, Socket)
│   │   ├── i18n/           # Translations
│   │   └── pages/          # Page components
│   └── vite.config.ts
├── server/                 # Node.js backend
│   ├── prisma/             # Database schema & migrations
│   └── src/
│       ├── middleware/     # Auth middleware
│       ├── routes/         # REST API routes
│       ├── services/       # Business logic
│       ├── socket/         # Socket.IO handlers
│       └── store/          # Redis store
├── shared/                 # Shared TypeScript types
├── docker-compose.yml
└── README.md
```

## API Documentation

### REST Endpoints

#### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh tokens

#### Rooms
- `GET /api/rooms` - List user's rooms
- `GET /api/rooms/:id` - Get room details
- `DELETE /api/rooms/:id` - Delete room

### Socket Events

See [CLAUDE.md](./CLAUDE.md) for complete Socket.IO event documentation.

## Development

### Local Setup

1. Install dependencies:
```bash
cd client && npm install
cd ../server && npm install
```

2. Start PostgreSQL and Redis (via Docker or locally)

3. Run database migrations:
```bash
cd server && npx prisma migrate dev
```

4. Start the development servers:
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

### Running Tests

```bash
# Backend tests
cd server && npm test

# Frontend tests
cd client && npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by tools like EasyRetro, Retrium, and Miro
- Built with modern web technologies for real-time collaboration
