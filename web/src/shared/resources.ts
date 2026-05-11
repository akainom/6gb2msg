import { apiRequest } from './api';
import { config } from './config';
import type { AppStats, Chat, Id, Message, Profile, Report, ReportReason } from './types';

const params = (values: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const profilesApi = {
  search: async (q: string, limit = 20, skip = 0) => {
    const result = await apiRequest<{ total: number; profiles: Profile[] }>(`/profiles/search${params({ q, limit, skip })}`);
    return result.profiles ?? [];
  },
  get: (profileId: Id) => apiRequest<Profile>(`/profiles/${profileId}`),
  getByUser: (userId: Id) => apiRequest<Profile>(`/profiles/by-user/${userId}`),
  updateMe: (body: Partial<Pick<Profile, 'username' | 'displayName' | 'bio' | 'location' | 'avatar' | 'status'>>) =>
    apiRequest<Profile>('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMe: (password: string) =>
    apiRequest<void>('/profiles/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};

export const chatsApi = {
  list: (limit = 50, skip = 0) => apiRequest<Chat[]>(`/chats${params({ limit, skip })}`),
  search: (q: string, limit = 20, skip = 0) => apiRequest<Chat[]>(`/chats/search${params({ q, limit, skip })}`),
  get: (chatId: Id) => apiRequest<Chat>(`/chats/${chatId}`),
  createPrivate: (peerId: Id) =>
    apiRequest<Chat>('/chats/private', {
      method: 'POST',
      body: JSON.stringify({ peerId }),
    }),
  createGroup: (body: { title: string; memberIds: Id[]; avatar?: string | null }) =>
    apiRequest<Chat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateGroup: (chatId: Id, body: { title?: string; avatar?: string | null }) =>
    apiRequest<Chat>(`/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (chatId: Id) => apiRequest<void>(`/chats/${chatId}`, { method: 'DELETE' }),
  addMember: (chatId: Id, userId: Id) =>
    apiRequest<Chat>(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  removeMember: (chatId: Id, userId: Id) =>
    apiRequest<Chat>(`/chats/${chatId}/members/${userId}`, { method: 'DELETE' }),
};

export const messagesApi = {
  list: (chatId: Id, limit = 50, skip = 0) =>
    apiRequest<Message[]>(`/chats/${chatId}/messages${params({ limit, skip })}`),
  search: (chatId: Id, q: string, limit = 20, skip = 0) =>
    apiRequest<Message[]>(`/chats/${chatId}/messages/search${params({ q, limit, skip })}`),
  send: (chatId: Id, body: { content?: string; attachments?: unknown[] }) =>
    apiRequest<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  edit: (chatId: Id, messageId: Id, content: string) =>
    apiRequest<Message>(`/chats/${chatId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),
  delete: (chatId: Id, messageId: Id) =>
    apiRequest<Message>(`/chats/${chatId}/messages/${messageId}`, { method: 'DELETE' }),
  forward: (chatId: Id, messageId: Id, targetChatId: Id) =>
    apiRequest<Message>(`/chats/${chatId}/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetChatId }),
    }),
  forwardBatch: (chatId: Id, messageIds: Id[], targetChatId: Id) =>
    apiRequest<Message[]>(`/chats/${chatId}/messages/forward-batch`, {
      method: 'POST',
      body: JSON.stringify({ messageIds, targetChatId }),
    }),
  markRead: (chatId: Id) => apiRequest<{ marked: number }>(`/chats/${chatId}/messages/read`, { method: 'POST' }),
  unread: (chatId: Id) => apiRequest<{ unread: number }>(`/chats/${chatId}/messages/unread`),
};

export const filesApi = {
  avatarUrl: (profileId: Id) => `${config.apiBaseUrl}/files/avatar/${profileId}`,
  chatAvatarUrl: (chatId: Id) => `${config.apiBaseUrl}/files/chat-avatar/${chatId}`,
  attachmentUrl: (chatId: Id, filePath: string, originalName?: string) => {
    let url = `${config.apiBaseUrl}/files/attachment/${chatId}/${encodeURIComponent(filePath)}`;
    if (originalName) url += `?name=${encodeURIComponent(originalName)}`;
    return url;
  },
  uploadAvatar: (file: File) => {
    const body = new FormData();
    body.set('avatar', file);
    return apiRequest<{ avatar: string }>('/files/avatar', { method: 'POST', body });
  },
  uploadChatAvatar: (chatId: Id, file: File) => {
    const body = new FormData();
    body.set('avatar', file);
    return apiRequest<{ avatar: string }>(`/files/chat-avatar/${chatId}`, { method: 'POST', body });
  },
  uploadAttachments: (chatId: Id, files: File[], content = '') => {
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    body.set('content', content);
    return apiRequest<{ message: Message }>(`/files/attachment/${chatId}`, { method: 'POST', body });
  },
};

export const reportsApi = {
  create: (body: { reported_id: Id; reason: ReportReason; description?: string; message_ids?: Id[] }) =>
    apiRequest<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listMine: (limit = 20, skip = 0) => apiRequest<Report[]>(`/reports${params({ limit, skip })}`),
  delete: (reportId: Id) => apiRequest<void>(`/reports/${reportId}`, { method: 'DELETE' }),
  pending: (limit = 20, skip = 0) => apiRequest<Report[]>(`/reports/pending${params({ limit, skip })}`),
  dismiss: (reportId: Id) => apiRequest<Report>(`/reports/${reportId}/dismiss`, { method: 'PATCH' }),
  ban: (body: { user_id: Id; report_id?: Id; reason?: string; unbanDate?: string }) =>
    apiRequest<unknown>('/reports/ban', { method: 'POST', body: JSON.stringify(body) }),
  unban: (user_id: Id) => apiRequest<unknown>('/reports/unban', { method: 'POST', body: JSON.stringify({ user_id }) }),
};

export const statsApi = {
  get: () => apiRequest<AppStats>('/stats'),
};
