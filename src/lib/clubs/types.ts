import type { BookSearchResult } from '@/lib/books/openLibrary';

export interface ClubMember {
  id: string;
  name: string;
  /** Avatar color. */
  color: string;
}

/** One stretch of the reading schedule, e.g. "pp. 1–104", due by a date. */
export interface Checkpoint {
  id: string;
  label: string;
  /** "YYYY-MM-DD": the day this stretch should be finished. */
  dueDate: string;
}

export interface ClubBook {
  book: BookSearchResult;
  startDate: string;
  checkpoints: Checkpoint[];
}

export interface Club {
  id: string;
  name: string;
  /** Invite code, e.g. "SNV-42K". */
  code: string;
  ownerId: string;
  memberIds: string[];
  current: ClubBook | null;
  createdAt: string;
}

export interface ClubPost {
  id: string;
  clubId: string;
  checkpointId: string;
  authorId: string;
  body: string;
  createdAt: string;
  /** Member ids who liked it. */
  likes: string[];
  /** Set for replies. */
  parentId: string | null;
}

export type MeetingPlace = { kind: 'video'; url: string } | { kind: 'place'; name: string };
export type Rsvp = 'going' | 'maybe' | 'no';

export interface Meeting {
  id: string;
  clubId: string;
  /** ISO timestamps. */
  startsAt: string;
  endsAt: string;
  place: MeetingPlace;
  checkpointId: string | null;
  rsvps: Record<string, Rsvp>;
}

export interface ClubDetail {
  club: Club;
  members: ClubMember[];
  /** Index of the furthest checkpoint the reader has unlocked (0 = first). */
  reached: number;
  posts: ClubPost[];
  meetings: Meeting[];
}

export interface ClubSummary {
  club: Club;
  members: ClubMember[];
  reached: number;
  nextMeeting: Meeting | null;
  /** Posts by others in unlocked checkpoints since the reader last opened the club. */
  newPosts: number;
}

export interface NewClubInput {
  name: string;
  book: BookSearchResult;
  weeks: number;
  startDate: string;
}

export interface NewMeetingInput {
  clubId: string;
  startsAt: string;
  endsAt: string;
  place: MeetingPlace;
  checkpointId: string | null;
}

/** Where club data lives. Demo mode only for now; a Supabase version comes with real accounts. */
export interface ClubBackend {
  listClubs(): Promise<ClubSummary[]>;
  getClub(clubId: string): Promise<ClubDetail | null>;
  /** Mark the club as seen, so its posts stop counting as new. */
  markSeen(clubId: string): Promise<void>;
  createClub(input: NewClubInput): Promise<Club>;
  /** Join by invite code; throws with a friendly message for unknown codes. */
  joinClub(code: string): Promise<Club>;
  leaveClub(clubId: string): Promise<void>;
  setReached(clubId: string, index: number): Promise<void>;
  createPost(clubId: string, checkpointId: string, body: string, parentId: string | null): Promise<ClubPost>;
  toggleLike(postId: string): Promise<void>;
  deletePost(postId: string): Promise<void>;
  scheduleMeeting(input: NewMeetingInput): Promise<Meeting>;
  rsvp(meetingId: string, response: Rsvp): Promise<void>;
  cancelMeeting(meetingId: string): Promise<void>;
}
