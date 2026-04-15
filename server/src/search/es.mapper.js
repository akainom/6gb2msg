function mapProfile(doc) {
    return {
        user_id: String(doc.user_id),
        username: doc.username ?? '',
        bio: doc.bio ?? '',
        location: doc.location ?? '',
        status: doc.status ?? 'offline',
        isComplete: !!doc.isComplete,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

function mapChat(doc) {
    return {
        type: doc.type,
        title: doc.title ?? '',
        avatar: doc.avatar ?? null,
        participant_ids: (doc.participants ?? []).map(p => String(p.user_id)),
        participants_count: (doc.participants ?? []).length,
        last_message_text: doc.last_message?.text ?? '',
        last_message_sent_at: doc.last_message?.sent_at ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

function mapMessage(doc) {
    return {
        chat_id: String(doc.chat_id),
        sender_id: String(doc.sender_id),
        content: doc.content ?? '',
        attachments_count: (doc.attachments ?? []).length,
        is_edited: !!doc.is_edited,
        is_forwarded: !!doc.is_forwarded,
        forwarded_by: doc.forwarded_by ? String(doc.forwarded_by) : null,
        is_read: !!doc.status?.is_read,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

module.exports = { mapProfile, mapChat, mapMessage };