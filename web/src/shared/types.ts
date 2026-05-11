export type Id = string;

export type ApiEnvelope<T> = {
  status?: 'ok' | string;
  data?: T;
  code?: string;
  message?: string;
  action?: string;
};

export type ApiErrorPayload = {
  code?: string;
  message?: string;
  action?: string;
  details?: unknown;
};

export type Profile = {
  _id: Id;
  user_id: Id;
  username: string;
  displayName?: string;
  avatar?: string | null;
  bio?: string;
  location?: string;
  status?: 'online' | 'offline' | 'do not disturb' | 'away' | string;
  last_online?: string;
  isComplete?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type User = {
  _id: Id;
  role?: 'Admin' | 'User' | string;
  authProvider?: string;
  createdAt?: string;
};

export type AuthPayload = {
  accessToken: string;
  user_id?: Id;
  user?: User;
  profile?: Profile;
};

export type ChatParticipant = {
  user_id: Id | User;
  role?: 'owner' | 'member';
  joined_at?: string;
};

export type Chat = {
  _id: Id;
  type: 'private' | 'group';
  title?: string;
  avatar?: string | null;
  participants?: ChatParticipant[];
  last_message?: {
    message_id?: Id | null;
    text?: string | null;
    sent_at?: string | null;
  };
  peer?: {
    user_id: Id;
    profile_id: Id;
    username: string;
    displayName?: string;
    status?: string;
    last_online?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Attachment = {
  file_path: string;
  mime_type: string;
  original_name: string;
  size: number;
};

export type Message = {
  _id: Id;
  chat_id: Id;
  sender_id: Id;
  content?: string;
  attachments?: Attachment[];
  is_edited?: boolean;
  is_forwarded?: boolean;
  status?: {
    is_read?: boolean;
    read_at?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'other';

export type Report = {
  _id: Id;
  reporter_id: Id;
  reported_id: Id;
  reason: ReportReason;
  description?: string;
  message_ids?: Id[];
  status?: 'pending' | 'resolved' | 'dismissed';
  createdAt?: string;
  updatedAt?: string;
};

export type AppStats = {
  _key?: string;
  users: { total: number; active_today: number; active_week: number };
  chats: { total: number; private: number; group: number };
  messages: { total: number; last_24h: number; last_week: number };
  computed_at?: string;
};
