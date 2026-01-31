export type Phase =
  | 'SETUP'
  | 'IDEATION'
  | 'DISCUSSION'
  | 'GROUPING'
  | 'VOTING'
  | 'BRAINSTORM'
  | 'ACTIONS'
  | 'CONCLUSION';

export type Template = 'CLASSIC' | 'STARFISH' | 'CUSTOM';

export type RoomStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED';

export type ParticipantRole = 'FACILITATOR' | 'PARTICIPANT' | 'OBSERVER';

export interface Column {
  id: string;
  title: string;
  color: string;
}

// User type for authenticated users
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: number;
  lastLoginAt?: number;
}

// Auth response from login/register
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// JWT payload
export interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Participant in a room (can be authenticated user or guest)
export interface Participant {
  id: string;
  name: string;
  odlIsFacilitator?: boolean; // deprecated, use role
  role: ParticipantRole;
  avatar?: string;
  isOnline?: boolean;
  isGuest?: boolean;
  userId?: string; // Reference to User if authenticated
}

// Legacy support - keeping isFacilitator as computed
export interface LegacyParticipant extends Participant {
  isFacilitator: boolean;
}

export interface PostIt {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  votes: string[]; // User IDs
  groupId: string | null;
  columnId: string;
  color: string;
  position: { x: number; y: number };
}

export interface ActionItem {
  id: string;
  content: string;
  ownerId?: string;
  ownerName?: string;
  groupId?: string;
  status: 'TODO' | 'DONE';
}

export interface Group {
  id: string;
  title: string;
  color: string;
  votes: string[]; // User IDs (multiple entries allowed for multi-voting)
}

export interface Room {
  id: string;
  name: string;
  template: Template;
  columns: Column[];
  groups: Group[];
  phase: Phase;
  facilitatorId: string;
  status: RoomStatus;
  hasPassword?: boolean; // Don't expose actual password
  maxPostitsPerUser?: number;
  ownerId?: string; // Reference to User who created the room
  timer: {
    duration: number; // in seconds
    remaining: number;
    isRunning: boolean;
    startedAt?: number;
    intervalId?: any;
  } | null;
  participants: Participant[];
  postits: PostIt[];
  focusedPostItId: string | null;
  actionItems: ActionItem[];
  createdAt: number;
  closedAt?: number;
}

// Room summary for "My Retros" list
export interface RoomSummary {
  id: string;
  name: string;
  template: Template;
  status: RoomStatus;
  phase: Phase;
  participantCount: number;
  postitCount: number;
  createdAt: number;
  closedAt?: number;
}

// Request/Response types for API
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateRoomRequest {
  name: string;
  template: Template;
  password?: string;
  maxPostitsPerUser?: number;
}

export interface JoinRoomRequest {
  roomId: string;
  password?: string;
  guestName?: string; // For unauthenticated users
}
