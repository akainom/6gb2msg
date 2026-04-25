const { mapMessage, mapChat, mapProfile } = require('../search/es.mapper');

describe('ES Mapper', () => {
    describe('mapMessage', () => {
        it('should map message document correctly', () => {
            const doc = {
                _id: '123',
                chat_id: 'chat123',
                sender_id: 'user456',
                content: 'Hello world',
                attachments: [{ file: '1' }, { file: '2' }],
                is_edited: true,
                is_forwarded: false,
                forwarded_by: null,
                status: { is_read: true },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
            };

            const result = mapMessage(doc);

            expect(result.chat_id).toBe('chat123');
            expect(result.sender_id).toBe('user456');
            expect(result.content).toBe('Hello world');
            expect(result.attachments_count).toBe(2);
            expect(result.is_edited).toBe(true);
            expect(result.is_forwarded).toBe(false);
            expect(result.forwarded_by).toBeNull();
            expect(result.is_read).toBe(true);
        });

        it('should handle missing optional fields', () => {
            const doc = {
                chat_id: 'chat123',
                sender_id: 'user456',
                content: 'Hello',
            };

            const result = mapMessage(doc);

            expect(result.content).toBe('Hello');
            expect(result.attachments_count).toBe(0);
            expect(result.is_edited).toBe(false);
            expect(result.forwarded_by).toBeNull();
            expect(result.is_read).toBe(false);
        });

        it('should convert sender_id to string', () => {
            const doc = {
                chat_id: 'chat123',
                sender_id: { toString: () => 'userobj' },
                content: 'test',
            };

            const result = mapMessage(doc);

            expect(result.sender_id).toBe('userobj');
        });

        it('should handle missing content', () => {
            const doc = { chat_id: 'chat123', sender_id: 'user456' };
            const result = mapMessage(doc);
            expect(result.content).toBe('');
        });
    });

    describe('mapChat', () => {
        it('should map chat document correctly', () => {
            const doc = {
                type: 'group',
                title: 'Test Group',
                avatar: 'avatar.png',
                participants: [
                    { user_id: 'user1' },
                    { user_id: 'user2' },
                    { user_id: 'user3' },
                ],
                last_message: {
                    text: 'last msg',
                    sent_at: new Date('2024-01-01'),
                },
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
            };

            const result = mapChat(doc);

            expect(result.type).toBe('group');
            expect(result.title).toBe('Test Group');
            expect(result.avatar).toBe('avatar.png');
            expect(result.participant_ids).toEqual(['user1', 'user2', 'user3']);
            expect(result.participants_count).toBe(3);
            expect(result.last_message_text).toBe('last msg');
            expect(result.last_message_sent_at).toEqual(new Date('2024-01-01'));
        });

        it('should handle private chat', () => {
            const doc = {
                type: 'private',
                participants: [{ user_id: 'user1' }, { user_id: 'user2' }],
            };

            const result = mapChat(doc);

            expect(result.type).toBe('private');
            expect(result.title).toBe('');
            expect(result.participants_count).toBe(2);
        });

        it('should handle missing participants', () => {
            const doc = { type: 'group', title: 'Test' };
            const result = mapChat(doc);
            expect(result.participant_ids).toEqual([]);
            expect(result.participants_count).toBe(0);
        });

        it('should handle missing last_message', () => {
            const doc = { type: 'group', title: 'Test' };
            const result = mapChat(doc);
            expect(result.last_message_text).toBe('');
            expect(result.last_message_sent_at).toBeNull();
        });
    });

    describe('mapProfile', () => {
        it('should map profile document correctly', () => {
            const doc = {
                user_id: 'user123',
                username: 'testuser',
                bio: 'Hello',
                location: 'Minsk',
                status: 'online',
                isComplete: true,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
            };

            const result = mapProfile(doc);

            expect(result.user_id).toBe('user123');
            expect(result.username).toBe('testuser');
            expect(result.bio).toBe('Hello');
            expect(result.location).toBe('Minsk');
            expect(result.status).toBe('online');
            expect(result.isComplete).toBe(true);
        });

        it('should handle missing optional fields', () => {
            const doc = { user_id: 'user123', username: 'test' };
            const result = mapProfile(doc);
            expect(result.bio).toBe('');
            expect(result.location).toBe('');
            expect(result.status).toBe('offline');
            expect(result.isComplete).toBe(false);
        });
    });
});