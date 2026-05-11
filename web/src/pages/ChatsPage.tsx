import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { useSocket } from '../features/socket/SocketProvider';
import { chatsApi, filesApi, messagesApi, profilesApi, reportsApi } from '../shared/resources';
import type { Chat, Id, Message, Profile } from '../shared/types';
import { Card, EmptyState, PageHeader, submitForm } from '../shared/ui';
import { downloadFile } from '../shared/api';
import { DropdownMenu } from '../components/Menu';
import { ProfileCard } from '../components/ProfileCard';
import { AudioPlayer } from '../components/AudioPlayer';

type Ack<T> = { ok?: boolean; message?: T; error?: string };

export function ChatsPage() {
  const auth = useAuth();
  const { socket } = useSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<Id | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [createMode, setCreateMode] = useState<'private' | 'group'>('private');
  const [selectedProfiles, setSelectedProfiles] = useState<Profile[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [profileModal, setProfileModal] = useState<Profile | null>(null);
  const [editingMsg, setEditingMsg] = useState<Id | null>(null);
  const [editContent, setEditContent] = useState('');
  const [selected, setSelected] = useState<Set<Id>>(new Set());
  const [forwardTarget, setForwardTarget] = useState<Id | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardBatchMode, setForwardBatchMode] = useState(false);
  const [msgSearch, setMsgSearch] = useState('');
  const [chatFilter, setChatFilter] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<Id, number>>({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [groupEditTitle, setGroupEditTitle] = useState('');
  const [groupAvatarKey, setGroupAvatarKey] = useState(0);
  const [groupAddSearch, setGroupAddSearch] = useState('');
  const [groupAddResults, setGroupAddResults] = useState<Profile[]>([]);
  const [groupAddSearching, setGroupAddSearching] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<Id, string>>({});
  const [senderProfileIds, setSenderProfileIds] = useState<Record<Id, string>>({});
  const msgEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<Id | null>(null);
  selectedChatRef.current = selectedChatId;

  const lookupSender = useCallback(async (userId: Id) => {
    if (userId === auth.userId) return auth.profile?.displayName || auth.profile?.username || 'Вы';
    if (senderNames[userId]) return senderNames[userId];
    try {
      const p = await profilesApi.getByUser(userId);
      const name = p.displayName || p.username || userId.slice(-6);
      setSenderNames((c) => ({ ...c, [userId]: name }));
      if (p._id) setSenderProfileIds((c) => ({ ...c, [userId]: p._id }));
      return name;
    } catch { return userId.slice(-6); }
  }, [auth.userId, auth.profile, senderNames]);

  useEffect(() => {
    if (messages.length === 0) return;
    const unknown = new Set<Id>();
    for (const m of messages) {
      if (m.sender_id !== auth.userId && !senderNames[m.sender_id] && !unknown.has(m.sender_id)) {
        unknown.add(m.sender_id);
      }
    }
    if (unknown.size === 0) return;
    unknown.forEach((uid) => { void lookupSender(uid); });
  }, [messages, auth.userId]);

  const filteredChats = chatFilter.length >= 2
    ? chats.filter((c) => (c.title || '').toLowerCase().includes(chatFilter.toLowerCase()))
    : chats;

  const displayedMessages = msgSearch.length >= 2
    ? messages.filter((m) => (m.content ?? '').toLowerCase().includes(msgSearch.toLowerCase()))
    : messages;

  const sortChats = (list: Chat[]) =>
    [...list].sort((a, b) =>
      new Date(b.last_message?.sent_at ?? b.createdAt ?? '').getTime() -
      new Date(a.last_message?.sent_at ?? a.createdAt ?? '').getTime(),
    );

  const selectedChat = useMemo(() => chats.find((c) => c._id === selectedChatId) ?? null, [chats, selectedChatId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Id;
      void chatsApi.list().then((items) => { setChats(items); void loadUnreads(items); setSelectedChatId(detail); });
    };
    document.addEventListener('chat:select', handler);
    return () => document.removeEventListener('chat:select', handler);
  }, []);

  const selectedMessages = useMemo(
    () => messages.filter((m) => selected.has(m._id)),
    [messages, selected],
  );

  const ownSelected = selectedMessages.every((m) => m.sender_id === auth.userId);

  const loadUnreads = useCallback(async (items: Chat[]) => {
    if (items.length === 0) return;
    const res = await Promise.allSettled(items.map((c) => messagesApi.unread(c._id)));
    const map: Record<Id, number> = {};
    items.forEach((c, i) => { map[c._id] = res[i].status === 'fulfilled' ? res[i].value.unread : 0; });
    setUnreadCounts(map);
  }, []);

  useEffect(() => {
    setLoadingChats(true);
    void chatsApi.list().then((items) => { setChats(items); void loadUnreads(items); setSelectedChatId((c) => c ?? items[0]?._id ?? null); }).catch((e) => { setPageError('Ошибка загрузки чатов: ' + (e?.code || e?.message || 'неизвестно')); }).finally(() => setLoadingChats(false));
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    setSelected(new Set());
    setEditingMsg(null);
    setLoadingMessages(true);
    void messagesApi.list(selectedChatId).then(setMessages).finally(() => setLoadingMessages(false));
    socket?.emit('chat:join', { chatId: selectedChatId });
    setUnreadCounts((c) => ({ ...c, [selectedChatId]: 0 }));
    void messagesApi.markRead(selectedChatId).catch(() => {});
  }, [selectedChatId, socket]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const onNew = ({ message }: { message: Message }) => {
      setMessages((c) => (c.some((m) => m._id === message._id) ? c : [...c, message]));
      setChats((c) =>
        sortChats(
          c.map((chat) =>
            chat._id === message.chat_id
              ? { ...chat, last_message: { message_id: message._id, text: message.content ?? '[attachment]', sent_at: message.createdAt ?? new Date().toISOString() } }
              : chat,
          ),
        ),
      );
      if (message.sender_id !== auth.userId) {
        if (message.chat_id === selectedChatRef.current) {
          void messagesApi.markRead(message.chat_id).catch(() => {});
        } else {
          setUnreadCounts((c) => ({ ...c, [message.chat_id]: (c[message.chat_id] ?? 0) + 1 }));
        }
      }
    };
    const onEdited = ({ message }: { message: Message }) => setMessages((c) => c.map((m) => (m._id === message._id ? message : m)));
    const onDeleted = ({ messageId }: { messageId: Id }) => { setMessages((c) => c.filter((m) => m._id !== messageId)); setSelected((s) => { const next = new Set(s); next.delete(messageId); return next; }); };
    const onTypingStart = ({ userId }: { userId: string }) => setTypingUsers((c) => c.includes(userId) ? c : [...c, userId]);
    const onTypingStop = ({ userId }: { userId: string }) => setTypingUsers((c) => c.filter((id) => id !== userId));
    const onMessageRead = ({ chatId, userId }: { chatId: Id; userId: string }) => {
      if (userId !== auth.userId) {
        setMessages((c) => c.map((m) => (m.chat_id === chatId && m.sender_id === auth.userId ? { ...m, status: { is_read: true, read_at: new Date().toISOString() } } : m)));
      }
    };

    socket.on('message:new', onNew);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('message:read', onMessageRead);

    socket.on('user:online', ({ userId, status }: { userId: string; status?: string }) => {
      setChats((c) => c.map((chat) =>
        chat.type === 'private' && chat.peer && String(chat.peer.user_id) === userId
          ? { ...chat, peer: { ...chat.peer, status: status || 'online' } }
          : chat,
      ));
    });
    socket.on('user:offline', ({ userId, last_online }: { userId: string; last_online?: string }) => {
      setChats((c) => c.map((chat) =>
        chat.type === 'private' && chat.peer && String(chat.peer.user_id) === userId
          ? { ...chat, peer: { ...chat.peer, status: 'offline', last_online } }
          : chat,
      ));
    });
    socket.on('user:status', ({ userId, status }: { userId: string; status: string }) => {
      setChats((c) => c.map((chat) =>
        chat.type === 'private' && chat.peer && String(chat.peer.user_id) === userId
          ? { ...chat, peer: { ...chat.peer, status } }
          : chat,
      ));
    });

    socket.on('chat:new', ({ chat }: { chat: Chat }) => {
      setChats((c) => sortChats(c.some((x) => x._id === chat._id) ? c : [chat, ...c]));
      setUnreadCounts((c) => ({ ...c, [chat._id]: 0 }));
    });

    return () => {
      socket.off('message:new', onNew);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('message:read', onMessageRead);
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('user:status');
      socket.off('chat:new');
    };
  }, [socket]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try { const res = await profilesApi.search(q); setSearchResults(res.filter((p) => p.user_id !== auth.userId)); } catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const startPrivateChat = async (peerId: Id) => {
    try {
      const [chat, profile] = await Promise.all([
        chatsApi.createPrivate(peerId),
        profilesApi.getByUser(peerId),
      ]);
      if (profile) {
        chat.peer = {
          user_id: peerId,
          profile_id: profile._id,
          username: profile.username,
          displayName: profile.displayName,
          status: profile.status,
          last_online: profile.last_online,
        };
      }
      setChats((c) => sortChats([chat, ...c]));
      setSelectedChatId(chat._id);
      closeNewChat();
    } catch (e: any) {
      if (e?.code === 'ERR_CHAT_EX') {
        const existing = chats.find((c) =>
          c.type === 'private' && c.participants?.some((p) => String((p.user_id as any)?._id ?? p.user_id) === String(peerId)),
        );
        if (existing) {
          setSelectedChatId(existing._id);
          closeNewChat();
          return;
        }
        const items = await chatsApi.list();
        void loadUnreads(items);
        setChats(items);
        const found = items.find((c) =>
          c.type === 'private' && c.participants?.some((p) => String((p.user_id as any)?._id ?? p.user_id) === String(peerId)),
        );
        if (found) setSelectedChatId(found._id);
        closeNewChat();
      } else {
        console.error(e);
      }
    }
  };

  const startGroupChat = async () => {
    if (!groupTitle.trim() || selectedProfiles.length === 0) return;
    try { const chat = await chatsApi.createGroup({ title: groupTitle.trim(), memberIds: selectedProfiles.map((p) => p.user_id) }); setChats((c) => sortChats([chat, ...c])); setSelectedChatId(chat._id); closeNewChat(); } catch (e) { console.error(e); }
  };

  const closeNewChat = () => { setShowNewChat(false); setSearchQuery(''); setSearchResults([]); setCreateMode('private'); setSelectedProfiles([]); setGroupTitle(''); };

  const handleDeleteChat = async (chatId: Id) => {
    if (!confirm('Вы уверены, что хотите удалить этот чат?')) return;
    try {
      await chatsApi.delete(chatId);
      setChats((c) => c.filter((x) => x._id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    } catch (e) { setPageError('Ошибка удаления чата'); console.error(e); }
  };

  const handleLeaveGroup = async (chatId: Id) => {
    if (!auth.userId) return;
    if (!confirm('Вы уверены, что хотите покинуть группу?')) return;
    try {
      await chatsApi.removeMember(chatId, auth.userId);
      setChats((c) => c.filter((x) => x._id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    } catch (e) { setPageError('Ошибка выхода из группы'); console.error(e); }
  };

  const openGroupModal = () => {
    if (!selectedChat) return;
    setGroupEditTitle(selectedChat.title || '');
    setGroupAddSearch('');
    setGroupAddResults([]);
    setGroupModal(true);
    (selectedChat.participants ?? []).forEach((p) => {
      const pId = String((p.user_id as any)?._id ?? p.user_id);
      if (pId !== auth.userId && !senderNames[pId]) void lookupSender(pId);
    });
  };

  const saveGroupMeta = async () => {
    if (!selectedChat || !groupEditTitle.trim()) return;
    try {
      const updated = await chatsApi.updateGroup(selectedChat._id, { title: groupEditTitle.trim() });
      setChats((c) => c.map((x) => (x._id === updated._id ? { ...x, title: updated.title } : x)));
    } catch (e) { setPageError('Ошибка сохранения'); console.error(e); }
  };

  const handleUploadChatAvatar = async (file: File) => {
    if (!selectedChat) return;
    try {
      await filesApi.uploadChatAvatar(selectedChat._id, file);
      setGroupAvatarKey((k) => k + 1);
      void chatsApi.list().then((items) => setChats(items));
    } catch (e) { setPageError('Ошибка загрузки аватара'); console.error(e); }
  };

  const addGroupMember = async (userId: Id) => {
    if (!selectedChat) return;
    try {
      await chatsApi.addMember(selectedChat._id, userId);
      void chatsApi.list().then((items) => setChats(items));
      setGroupAddSearch('');
      setGroupAddResults([]);
    } catch (e) { setPageError('Ошибка добавления участника'); console.error(e); }
  };

  const removeGroupMember = async (userId: Id) => {
    if (!selectedChat) return;
    try {
      await chatsApi.removeMember(selectedChat._id, userId);
      void chatsApi.list().then((items) => setChats(items));
    } catch (e) { setPageError('Ошибка удаления участника'); console.error(e); }
  };

  const handleGroupAddSearch = async (q: string) => {
    setGroupAddSearch(q);
    if (q.length < 2) { setGroupAddResults([]); return; }
    setGroupAddSearching(true);
    try {
      const res = await profilesApi.search(q);
      const existingIds = new Set((selectedChat?.participants ?? []).map((p) => String((p.user_id as any)?._id ?? p.user_id)));
      setGroupAddResults(res.filter((p) => !existingIds.has(p.user_id) && p.user_id !== auth.userId));
    } catch { setGroupAddResults([]); } finally { setGroupAddSearching(false); }
  };

  const chatHeaderMenuItems = useMemo(() => {
    if (!selectedChat) return [];
    const items: { label: string; danger?: boolean; action: () => void }[] = [];
    if (selectedChat.type === 'private') {
      items.push({ label: 'Удалить чат', danger: true, action: () => handleDeleteChat(selectedChat._id) });
    } else {
      const myRole = selectedChat.participants?.find((p) => String(p.user_id) === String(auth.userId))?.role;
      if (myRole === 'owner') {
        items.push({ label: 'Редактировать группу', action: openGroupModal });
        items.push({ label: 'Удалить группу', danger: true, action: () => handleDeleteChat(selectedChat._id) });
      } else {
        items.push({ label: 'Покинуть группу', danger: true, action: () => handleLeaveGroup(selectedChat._id) });
      }
    }
    return items;
  }, [selectedChat, auth.userId]);

  const handleEdit = async () => {
    if (!editingMsg || !selectedChatId || !editContent.trim()) return;
    try {
      await messagesApi.edit(selectedChatId, editingMsg, editContent);
      setMessages((c) => c.map((m) => (m._id === editingMsg ? { ...m, content: editContent } : m)));
      setEditingMsg(null); setEditContent('');
    } catch (e) { setPageError('Ошибка редактирования'); console.error(e); }
  };

  const showProfile = useCallback(async (userId: Id) => {
    if (userId === auth.userId) { window.location.href = '/profile'; return; }
    try { const p = await profilesApi.getByUser(userId); setProfileModal(p); } catch { /* ignore */ }
  }, [auth.userId]);

  const forwardMsg = async (_chatId: Id, msgId: Id) => {
    setForwardTarget(msgId);
    setForwardBatchMode(false);
    setShowForwardPicker(true);
  };

  const doForwardSingle = async (targetChatId: Id) => {
    if (!forwardTarget || !selectedChatId) return;
    try {
      await messagesApi.forward(selectedChatId, forwardTarget, targetChatId);
      setShowForwardPicker(false);
      setForwardTarget(null);
    } catch (e) { setPageError('Ошибка пересылки'); console.error(e); }
  };

  const doForwardBatch = async (targetChatId: Id) => {
    if (!selectedChatId) return;
    try {
      await messagesApi.forwardBatch(selectedChatId, [...selected], targetChatId);
      clearSelection();
      setShowForwardPicker(false);
      setForwardTarget(null);
      setForwardBatchMode(false);
    } catch (e) { setPageError('Ошибка пересылки'); console.error(e); }
  };

  const forwardSelected = () => {
    if (!selectedChatId) return;
    setShowForwardPicker(true);
    setForwardBatchMode(true);
  };

  const toggleSelect = (id: Id, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.message-menu-btn, .username, a, button, .attachment-link')) return;
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!selectedChatId || !confirm(`Удалить ${selected.size} сообщений?`)) return;
    for (const id of selected) {
      await messagesApi.delete(selectedChatId, id).catch(() => {});
    }
    setMessages((c) => c.filter((m) => !selected.has(m._id)));
    clearSelection();
  };

  const reportSelected = () => {
    const reason = prompt('Причина (spam/harassment/inappropriate/other)');
    if (!reason || !selectedChatId) return;
    const bySender = new Map<string, Id[]>();
    for (const msg of messages) {
      if (selected.has(msg._id)) {
        const key = msg.sender_id;
        if (!bySender.has(key)) bySender.set(key, []);
        bySender.get(key)!.push(msg._id);
      }
    }
    for (const [senderId, msgIds] of bySender) {
      if (senderId !== auth.userId) {
        void reportsApi.create({ reported_id: senderId, reason: reason as any, message_ids: msgIds });
      }
    }
    clearSelection();
  };

  const singleMsgItems = (msg: Message): { label: string; danger?: boolean; action: () => void }[] => {
    const items: { label: string; danger?: boolean; action: () => void }[] = [];
    if (msg.sender_id === auth.userId) {
      items.push({ label: 'Редактировать', action: () => { setEditingMsg(msg._id); setEditContent(msg.content ?? ''); } });
      items.push({ label: 'Удалить', danger: true, action: () => { if (confirm('Удалить сообщение?')) void messagesApi.delete(selectedChat!._id, msg._id).then(() => setMessages((c) => c.filter((m) => m._id !== msg._id))); } });
      items.push({ label: 'Forward', action: () => void forwardMsg(selectedChat!._id, msg._id) });
    } else {
      items.push({ label: 'Forward', action: () => void forwardMsg(selectedChat!._id, msg._id) });
    }
    items.push({ label: 'Пожаловаться', danger: true, action: () => {
      const reason = prompt('Причина (spam/harassment/inappropriate/other)');
      if (reason) void reportsApi.create({ reported_id: msg.sender_id, reason: reason as any, message_ids: [msg._id] });
    }});
    return items;
  };

  return (
    <>
      <PageHeader title="Чаты" description={selectedChat?.title || 'Private/group chats'} />

      <div className="messenger">
        <Card className="chat-list">
          <div className="chat-list-header">
            <h3>Диалоги</h3>
            <button type="button" onClick={() => setShowNewChat(true)}>+ Новый</button>
          </div>
          {pageError && <p className="error" style={{ marginBottom: '.25rem', fontSize: '.82rem' }}>{pageError} <button type="button" className="btn-ghost" style={{ fontSize: '.75rem', padding: 0 }} onClick={() => setPageError(null)}>✕</button></p>}
          <input placeholder="Поиск чатов..." value={chatFilter} onChange={(e) => setChatFilter(e.target.value)} style={{ marginBottom: '.25rem', fontSize: '.85rem' }} />

          {showNewChat && (
            <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeNewChat(); }}>
              <div className="modal-content">
                <div className="modal-header"><h3>Новый чат</h3><button type="button" className="btn-ghost" onClick={closeNewChat}>✕</button></div>
                <div className="modal-tabs">
                  <button className={createMode === 'private' ? 'tab active' : 'tab'} onClick={() => { setCreateMode('private'); setSelectedProfiles([]); }}>Private</button>
                  <button className={createMode === 'group' ? 'tab active' : 'tab'} onClick={() => setCreateMode('group')}>Group</button>
                </div>
                {createMode === 'private' ? (
                  <>
                    <input placeholder="Поиск по username..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} autoFocus />
                    {searching && <p className="muted">Поиск...</p>}
                    <div className="search-results">
                      {searchResults.map((p) => (
                        <button key={p._id} type="button" className="list-item" onClick={() => startPrivateChat(p.user_id)}>
                          <span className="title">{p.displayName || p.username}</span>
                          <span className="secondary">@{p.username}</span>
                        </button>
                      ))}
                    </div>
                    {!searching && searchQuery.length >= 2 && !searchResults.length && <EmptyState title="Ничего не найдено" />}
                  </>
                ) : (
                  <>
                    <input placeholder="Название группы" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} autoFocus />
                    <input placeholder="Поиск участников..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
                    {selectedProfiles.length > 0 && (
                      <div className="selected-tags">{selectedProfiles.map((p) => <span key={p._id} className="tag">{p.username}<button onClick={() => setSelectedProfiles((c) => c.filter((x) => x._id !== p._id))}>✕</button></span>)}</div>
                    )}
                    <div className="search-results">
                      {searchResults.map((p) => (
                        <button key={p._id} type="button" className={`list-item ${selectedProfiles.some((x) => x._id === p._id) ? 'active' : ''}`}
                          onClick={() => setSelectedProfiles((c) => c.some((x) => x._id === p._id) ? c.filter((x) => x._id !== p._id) : [...c, p])}>
                          <span className="title">{selectedProfiles.some((x) => x._id === p._id) ? '✓ ' : ''}{p.displayName || p.username}</span>
                          <span className="secondary">@{p.username}</span>
                        </button>
                      ))}
                    </div>
                    <button disabled={!groupTitle.trim() || selectedProfiles.length === 0} onClick={startGroupChat}>Создать ({selectedProfiles.length})</button>
                  </>
                )}
              </div>
            </div>
          )}

           <div className="list">
            {filteredChats.map((chat) => {
              const displayTitle = chat.type === 'private' && chat.peer
                ? (chat.peer.displayName || chat.peer.username)
                : (chat.title || `${chat.type} chat`);
              const unread = unreadCounts[chat._id] ?? 0;
              const peerStatus = chat.type === 'private' && chat.peer ? (chat.peer.status || 'offline') : null;
              const hasAvatar = Boolean(
                (chat.type === 'private' && chat.peer?.profile_id) ||
                chat.type === 'group',
              );
              const showLetter = !hasAvatar && chat.type === 'private';
              return (
              <button key={chat._id} type="button" className={`list-item ${chat._id === selectedChatId ? 'active' : ''}${unread > 0 ? ' unread' : ''}`} onClick={() => setSelectedChatId(chat._id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  {showLetter && (
                    <div style={{ position: 'relative' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '.68rem', display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{(displayTitle || '?')[0].toUpperCase()}</div>
                      {peerStatus && <span className={`online-dot${peerStatus === 'offline' ? ' offline' : ''}${peerStatus === 'away' ? ' away' : ''}${peerStatus === 'do not disturb' ? ' dnd' : ''}`} />}
                    </div>
                  )}
                  {hasAvatar ? (
                    <div style={{ position: 'relative' }}>
                      {chat.type === 'group' && <div className="avatar" style={{ width: 32, height: 32, fontSize: '.68rem', position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{(displayTitle || '?')[0].toUpperCase()}</div>}
                      <img className="avatar" src={
                        chat.type === 'private' && chat.peer?.profile_id
                          ? filesApi.avatarUrl(chat.peer.profile_id)
                          : filesApi.chatAvatarUrl(chat._id)
                      } alt="" style={{ width: 32, height: 32, objectFit: 'cover', position: 'relative', zIndex: 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      {peerStatus === 'online' && <span className="online-dot" />}
                      {peerStatus === 'away' && <span className="online-dot away" />}
                      {peerStatus === 'do not disturb' && <span className="online-dot dnd" />}
                      {peerStatus === 'offline' && <span className="online-dot offline" />}
                    </div>
                  ) : null}
                  <div style={{ minWidth: 0, display: 'grid', gap: '.2rem', flex: 1 }}>
                    <span className="title">{displayTitle}</span>
                    <span className="secondary">{chat.last_message?.text || ''}</span>
                  </div>
                  {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
                </div>
              </button>
              );
            })}
            {!filteredChats.length && !loadingChats && <EmptyState title={chatFilter ? 'Ничего не найдено' : 'Нет чатов'} text={chatFilter ? '' : 'Нажмите "+ Новый"'} />}
            {loadingChats && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Загрузка...</p>}
          </div>
        </Card>

        <Card className="chat-panel">
          {selectedChat ? (
            <>
               <div className="chat-header">
                 <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                   {selectedChat.type === 'private' && selectedChat.peer?.profile_id ? (
                     <img className="avatar" src={filesApi.avatarUrl(selectedChat.peer.profile_id)} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                   ) : selectedChat.type === 'group' ? (
                     <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: '.68rem', position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{(selectedChat.title || 'G')[0].toUpperCase()}</div>
                       <img className="avatar" src={`${filesApi.chatAvatarUrl(selectedChat._id)}?v=${groupAvatarKey}`} alt="" style={{ width: 32, height: 32, objectFit: 'cover', position: 'relative', zIndex: 1 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                     </div>
                   ) : null}
                   <h3>{(selectedChat.type === 'private' && selectedChat.peer) ? (selectedChat.peer.displayName || selectedChat.peer.username) : (selectedChat.title || `${selectedChat.type} chat`)}</h3>
                 </div>
                 {typingUsers.length > 0 && <span className="typing-indicator">печатает...</span>}
                 {selected.size > 0 && (
                   <span className="badge">{selected.size} выбрано</span>
                 )}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                   <DropdownMenu direction="down" trigger={<span className="message-menu-btn" style={{ opacity: 1 }}>⋮</span>} items={chatHeaderMenuItems} />
                 </div>
               </div>
               <input
                 placeholder="Поиск в чате..."
                 value={msgSearch}
                 onChange={(e) => setMsgSearch(e.target.value)}
                 style={{ fontSize: '.85rem' }}
               />
              <div className="messages">
                 {displayedMessages.map((msg) => {
                   const senderDisplay = msg.sender_id === auth.userId ? 'Вы' : (senderNames[msg.sender_id] || msg.sender_id.slice(-6));
                   return (
                   <article
                     key={msg._id}
                     className={`message ${msg.sender_id === auth.userId ? 'own' : ''} ${selected.has(msg._id) ? 'selected' : ''}`}
                     onClick={(e) => toggleSelect(msg._id, e)}
                   >
                      <div className="message-header">
                        <div className="select-check" onClick={(e) => { e.stopPropagation(); toggleSelect(msg._id, e as any); }}>
                          {selected.has(msg._id) ? '☑' : '☐'}
                        </div>
                        {msg.sender_id === auth.userId ? (
                          auth.profile?._id && <img className="avatar" src={filesApi.avatarUrl(auth.profile._id)} alt="" style={{ width: 20, height: 20, objectFit: 'cover', flexShrink: 0 }} />
                        ) : senderProfileIds[msg.sender_id] ? (
                          <img className="avatar" src={filesApi.avatarUrl(senderProfileIds[msg.sender_id])} alt="" style={{ width: 20, height: 20, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div className="avatar" style={{ width: 20, height: 20, fontSize: '.55rem', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}>{senderDisplay[0].toUpperCase()}</div>
                        )}
                        <span className="username" onClick={() => showProfile(msg.sender_id)} title="Открыть профиль">
                          {senderDisplay}
                        </span>
                        <span className="message-meta">
                          {msg.is_forwarded && <span className="forwarded-badge">↪ переслано</span>}
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}{msg.is_edited ? ' (изм.)' : ''}
                          {msg.sender_id === auth.userId && (
                            msg.status?.is_read ? <DoubleCheckIcon /> : <SingleCheckIcon />
                          )}
                        </span>
                       <div className="spacer" />
                       <DropdownMenu direction="up" trigger={<span className="message-menu-btn">⋮</span>} items={singleMsgItems(msg)} />
                     </div>

                     {editingMsg === msg._id ? (
                       <div className="inline-edit">
                         <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} autoFocus />
                         <div className="actions">
                           <button type="button" className="btn-secondary" onClick={() => { setEditingMsg(null); setEditContent(''); }}>Отмена</button>
                           <button type="button" onClick={handleEdit}>Сохранить</button>
                         </div>
                       </div>
                      ) : (
                        <div className="message-text">{msg.content || ''}</div>
                      )}

                      {msg.attachments?.map((att) => {
                        const url = filesApi.attachmentUrl(selectedChat._id!, att.file_path, att.original_name);
                        const isImage = att.mime_type?.startsWith('image/');
                        const isAudio = att.mime_type?.startsWith('audio/')
                          || att.original_name?.toLowerCase().endsWith('.ogg')
                          || att.original_name?.toLowerCase().endsWith('.webm')
                          || att.original_name?.toLowerCase().endsWith('.mp3')
                          || att.original_name?.toLowerCase().endsWith('.wav')
                          || att.mime_type === 'application/ogg';
                        if (isImage) {
                          return (
                            <div key={att.file_path} className="attachment-image" style={{ marginTop: '.4rem' }}>
                              <img src={url} alt={att.original_name} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 'var(--radius)', cursor: 'pointer' }}
                                onClick={() => { const w = window.open('', '_blank'); if (w) w.document.write(`<img src="${url}" style="max-width:100%"/>`); }} />
                            </div>
                          );
                        }
                        if (isAudio) {
                          return (
                            <div key={att.file_path} style={{ marginTop: '.35rem' }}>
                              <AudioPlayer src={url} />
                            </div>
                          );
                        }
                       return (
                         <button key={att.file_path} type="button" className="attachment-link"
                           onClick={() => { void downloadFile(url, att.original_name); }}>
                           📎 {att.original_name}
                         </button>
                       );
                     })}
                   </article>
                   );
                 })}
                {!displayedMessages.length && !loadingMessages && <EmptyState title={msgSearch ? 'Ничего не найдено' : 'Сообщений пока нет'} text={msgSearch ? '' : 'Отправьте первое сообщение.'} />}
                {loadingMessages && <p className="muted" style={{ textAlign: 'center', padding: '1rem' }}>Загрузка...</p>}
                <div ref={msgEndRef} />
              </div>

              {selected.size > 0 ? (
                <div className="selection-bar">
                  <span>Выбрано: {selected.size}</span>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    {ownSelected && <button type="button" className="btn-danger" onClick={deleteSelected}>Удалить</button>}
                    <button type="button" onClick={forwardSelected}>Переслать</button>
                    {!ownSelected && <button type="button" className="btn-danger" onClick={reportSelected}>Пожаловаться</button>}
                    <button type="button" className="btn-secondary" onClick={clearSelection}>Отмена</button>
                  </div>
                </div>
              ) : (
                <MessageComposer
                  chatId={selectedChat._id}
                  onTyping={() => socket?.emit('typing:start', { chatId: selectedChat._id })}
                  onStopTyping={() => socket?.emit('typing:stop', { chatId: selectedChat._id })}
                  onSent={(message) => setMessages((c) => [...c, message])}
                  sendViaSocket={(content) =>
                    new Promise((resolve) => {
                      socket?.emit('message:send', { chatId: selectedChat._id, content }, (ack: Ack<Message>) => {
                        if (ack.ok && ack.message) resolve(ack.message);
                        else resolve(null);
                      });
                    })
                  }
                />
              )}
            </>
          ) : (
            <EmptyState title="Выберите чат" text='Создайте чат или выберите из списка' />
          )}
        </Card>
      </div>

      {profileModal && (
        <ProfileCard
          profile={profileModal}
          isOwn={false}
          onClose={() => setProfileModal(null)}
          onStartChat={() => { startPrivateChat(profileModal.user_id); setProfileModal(null); }}
          onReport={() => {
            const reason = prompt('Причина (spam/harassment/inappropriate/other)');
            if (reason) { void reportsApi.create({ reported_id: profileModal.user_id, reason: reason as any }); setProfileModal(null); }
          }}
        />
      )}

      {showForwardPicker && (
        <ForwardChatPicker
          chats={chats}
          currentChatId={selectedChatId}
          onPick={(targetId) => {
            if (forwardBatchMode) {
              void doForwardBatch(targetId);
            } else {
              void doForwardSingle(targetId);
            }
          }}
          onClose={() => { setShowForwardPicker(false); setForwardTarget(null); setForwardBatchMode(false); }}
        />
      )}

      {groupModal && selectedChat && (
        <GroupSettingsModal
          chat={selectedChat}
          currentUserId={auth.userId!}
          senderNames={senderNames}
          editTitle={groupEditTitle}
          onTitleChange={setGroupEditTitle}
          avatarUrl={filesApi.chatAvatarUrl(selectedChat._id) + '?v=' + groupAvatarKey}
          onUploadAvatar={handleUploadChatAvatar}
          onSaveTitle={saveGroupMeta}
          addSearch={groupAddSearch}
          onAddSearchChange={handleGroupAddSearch}
          addResults={groupAddResults}
          addSearching={groupAddSearching}
          onAddMember={addGroupMember}
          onRemoveMember={removeGroupMember}
          onClose={() => setGroupModal(false)}
        />
      )}
    </>
  );
}

function ForwardChatPicker({ chats, currentChatId, onPick, onClose }: { chats: Chat[]; currentChatId: Id | null; onPick: (id: Id) => void; onClose: () => void }) {
  const targets = chats.filter((c) => c._id !== currentChatId);
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header"><h3>Куда переслать?</h3><button type="button" className="btn-ghost" onClick={onClose}>✕</button></div>
        {targets.length === 0 ? (
          <p className="text-secondary">Нет других чатов. Создайте новый.</p>
        ) : (
          <div className="search-results">
            {targets.map((c) => {
              const displayTitle = c.type === 'private' && c.peer
                ? (c.peer.displayName || c.peer.username)
                : (c.title || `${c.type} chat`);
              return (
              <button key={c._id} type="button" className="list-item" onClick={() => onPick(c._id)} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                {c.type === 'private' && c.peer?.profile_id ? (
                  <img className="avatar" src={filesApi.avatarUrl(c.peer.profile_id)} alt="" style={{ width: 28, height: 28, objectFit: 'cover' }} />
                ) : c.type === 'group' ? (
                  <img className="avatar" src={filesApi.chatAvatarUrl(c._id)} alt="" style={{ width: 28, height: 28, objectFit: 'cover' }} />
                ) : null}
                <span className="title">{displayTitle}</span>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupSettingsModal({ chat, currentUserId, senderNames, editTitle, onTitleChange, avatarUrl, onUploadAvatar, onSaveTitle, addSearch, onAddSearchChange, addResults, addSearching, onAddMember, onRemoveMember, onClose }: {
  chat: Chat;
  currentUserId: string;
  senderNames: Record<Id, string>;
  editTitle: string;
  onTitleChange: (v: string) => void;
  avatarUrl: string;
  onUploadAvatar: (file: File) => void;
  onSaveTitle: () => void;
  addSearch: string;
  onAddSearchChange: (q: string) => void;
  addResults: Profile[];
  addSearching: boolean;
  onAddMember: (userId: Id) => void;
  onRemoveMember: (userId: Id) => void;
  onClose: () => void;
}) {
  const isOwner = chat.participants?.find((p) => String(p.user_id) === String(currentUserId))?.role === 'owner';
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Настройки группы</h3>
          <button type="button" className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        {isOwner ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img className="avatar" src={avatarUrl}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '50%' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <form style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flex: 1 }}
                onSubmit={submitForm(async (form) => {
                  const file = form.get('avatar');
                  if (file instanceof File && file.size) onUploadAvatar(file);
                })}>
                <input name="avatar" type="file" accept="image/*" style={{ fontSize: '.82rem' }} />
                <button>Сменить</button>
              </form>
            </div>
            <div style={{ display: 'grid', gap: '.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--text-secondary)' }}>Название</label>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <input value={editTitle} onChange={(e) => onTitleChange(e.target.value)} />
                <button onClick={onSaveTitle} disabled={!editTitle.trim()}>Сохранить</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {chat.avatar && <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />}
            <p className="text-secondary">Название: {chat.title}</p>
          </>
        )}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '.35rem' }}>Участники ({chat.participants?.length ?? 0})</label>
          <div className="list">
            {chat.participants?.map((p) => {
              const pId = String((p.user_id as any)?._id ?? p.user_id);
              const isCurrent = pId === currentUserId;
              const pName = isCurrent ? 'Вы' : (senderNames[pId] || '...');
              return (
                <div key={pId} className="list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="title">{pName}</span>
                  <span className="secondary">{p.role}</span>
                  {isOwner && !isCurrent && (
                    <button type="button" className="btn-danger" style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                      onClick={() => onRemoveMember(pId)}>Удалить</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {isOwner && (
          <div style={{ display: 'grid', gap: '.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--text-secondary)' }}>Добавить участника</label>
            <input value={addSearch} onChange={(e) => onAddSearchChange(e.target.value)} placeholder="Поиск по username..." />
            {addSearching && <p className="muted">Поиск...</p>}
            {addResults.length > 0 && (
              <div className="search-results">
                {addResults.map((p) => (
                  <button key={p._id} type="button" className="list-item" onClick={() => onAddMember(p.user_id)}>
                    <span className="title">{p.displayName || p.username}</span>
                    <span className="secondary">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageComposer({ chatId, onTyping, onStopTyping, onSent, sendViaSocket }: { chatId: Id; onTyping: () => void; onStopTyping: () => void; onSent: (m: Message) => void; sendViaSocket: (c: string) => Promise<Message | null> }) {
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : 'audio/ogg;codecs=opus';
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes('webm') ? 'webm' : 'ogg';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
        try {
          const r = await filesApi.uploadAttachments(chatId, [file], '');
          onSent(r.message);
        } catch { /* ignore */ }
      };

      recorder.start();
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
    } catch { /* permission denied or no mic */ }
  }, [chatId, onSent]);

  const handleAttach = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    fileInputRef.current?.click();
  }, []);

  const handleAttachChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    try {
      const r = await filesApi.uploadAttachments(chatId, files, composerText);
      onSent(r.message);
      setComposerText('');
      onStopTyping();
    } catch { /* ignore */ }
    e.target.value = '';
  }, [chatId, composerText, onSent, onStopTyping]);

  const handleSend = useCallback(async () => {
    const content = composerText.trim();
    if (!content) return;
    try {
      const via = await sendViaSocket(content);
      if (!via) {
        const h = await messagesApi.send(chatId, { content });
        onSent(h);
      }
      setComposerText('');
      onStopTyping();
    } catch { /* ignore */ }
  }, [composerText, chatId, onSent, onStopTyping, sendViaSocket]);

  const insertEmoji = useCallback((e: string) => {
    setComposerText((t) => t + e);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const hasText = composerText.trim().length > 0;

  return (
    <div className="composer-wrapper">
      {emojiOpen && (
        <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
      )}
      <form ref={formRef} style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: '.5rem', marginTop: '.5rem' }}
        onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
        {recording ? (
          <div className="recording-bar">
            <span className="recording-dot" />
            <span className="recording-timer">{fmtTimer(recordTime)}</span>
            <button type="button" className="btn-secondary" style={{ fontSize: '.8rem', padding: '.3rem .7rem' }} onClick={cancelRecording}>Отменить</button>
            <button type="button" className="btn-danger" style={{ fontSize: '.8rem', padding: '.3rem .7rem' }} onClick={stopRecording}>⏹ Отправить</button>
          </div>
        ) : (
          <>
            <button type="button" className="composer-btn" onClick={handleAttach} title="Прикрепить">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleAttachChange} />
            <div className="composer-input-wrap">
              <input
                name="content"
                placeholder="Сообщение..."
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onFocus={onTyping}
                onBlur={onStopTyping}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </div>
            <button type="button" className="composer-btn" onClick={() => setEmojiOpen(!emojiOpen)} title="Эмодзи">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            {hasText ? (
              <button type="submit" className="composer-btn send-btn" title="Отправить">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            ) : (
              <button type="button" className="composer-btn mic-btn" onClick={startRecording} title="Запись голосового">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Смайлы', emojis: ['😀','😂','😊','😍','🤔','😎','😢','😡','🥺','😴','🤩','😇','🤗','😜','😤','😱'] },
  { label: 'Жесты', emojis: ['👍','👎','👏','🙌','🤝','💪','👋','🤞','✌️','👌','🤙','🖐️','🙏','💅','🤳','👀'] },
  { label: 'Сердца', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','💕','💖','💗','💝','💘','💌'] },
  { label: 'Животные', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐤'] },
  { label: 'Еда', emojis: ['🍕','🍔','🍟','🌭','🍿','🥨','🍩','🍪','🎂','🍰','🍫','🍦','🍉','🍇','🍌','🍎'] },
  { label: 'Предметы', emojis: ['🎁','🎈','🎉','🎊','💡','📌','🔑','🔨','💊','📱','💻','⌚️','📷','🎮','🕹️','🎧'] },
  { label: 'Символы', emojis: ['✅','❌','⚠️','💯','🔥','⭐️','🌈','⚡️','💧','🎵','🔞','🛑','💤','♻️','ℹ️','🔰'] },
];

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-categories">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button key={c.label} type="button" className={`emoji-cat-btn ${i === cat ? 'active' : ''}`}
            onClick={() => setCat(i)} title={c.label}>{c.emojis[0]}</button>
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJI_CATEGORIES[cat].emojis.map((e) => (
          <button key={e} type="button" className="emoji-item" onClick={() => onPick(e)}>{e}</button>
        ))}
      </div>
    </div>
  );
}

function SingleCheckIcon() {
  return (
    <span className="read-receipt">
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

function DoubleCheckIcon() {
  const maskId = useId();
  return (
    <span className="read-receipt read">
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <defs>
          <mask id={maskId}>
            <rect width="16" height="11" fill="white"/>
            <path d="M1 5.5L4.5 10L9 3" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </mask>
        </defs>
        <path d="M1 5.5L4.5 10L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5.5L8 10L13.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" mask={`url(#${maskId})`}/>
      </svg>
    </span>
  );
}
