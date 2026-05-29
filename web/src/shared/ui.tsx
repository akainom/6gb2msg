/* eslint-disable react-refresh/only-export-components */
import type { FormEvent, ReactNode } from 'react';

export function PageHeader({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">MVP</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside}
    </header>
  );
}

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`card ${className}`} style={style}>{children}</section>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

const errorMessages: Record<string, string> = {
  ERR_USR_NF: 'Пользователь не найден',
  ERR_USER_NOT_FOUND: 'Пользователь не найден',
  ERR_PASSWD_INC: 'Неверный пароль',
  ERR_CRED_INC: 'Неверный логин или пароль',
  ERR_CREDS_MISSING: 'Отсутствуют учётные данные',
  ERR_EMAIL_EX: 'Email уже используется',
  ERR_UNAME_EX: 'Имя пользователя занято',
  ERR_FIELDS_MISSING: 'Заполните все обязательные поля',
  ERR_FIELDS_INV: 'Некорректные данные',
  ERR_CHAT_EX: 'Чат уже существует',
  ERR_CHAT_NF: 'Чат не найден',
  ERR_CHAT_FORB: 'Нет доступа к чату',
  ERR_CHAT_ROLE: 'Недостаточно прав',
  ERR_CHAT_SELF: 'Нельзя создать чат с собой',
  ERR_CHAT_OWNER_LEAVE: 'Владелец не может покинуть группу',
  ERR_CHAT_TITLE: 'Укажите название группы',
  ERR_CHAT_TYPE: 'Неверный тип чата',
  ERR_CHAT_MEMBER_EX: 'Пользователь уже в чате',
  ERR_CHAT_MEMBERS: 'Некорректный список участников',
  ERR_CHAT_DEL: 'Не удалось удалить чат',
  ERR_CHAT_JOIN: 'Не удалось войти в чат',
  ERR_CHAT_LEAVE: 'Не удалось покинуть чат',
  ERR_MSG_EMPTY: 'Сообщение не может быть пустым',
  ERR_MSG_NF: 'Сообщение не найдено',
  ERR_MSG_FORB: 'Нельзя редактировать чужое сообщение',
  ERR_MSG_SEND: 'Не удалось отправить сообщение',
  ERR_MSG_EDIT: 'Не удалось изменить сообщение',
  ERR_MSG_DEL: 'Не удалось удалить сообщение',
  ERR_MSG_FORW: 'Не удалось переслать сообщение',
  ERR_MSG_READ: 'Не удалось отметить как прочитанное',
  ERR_REASON: 'Укажите причину жалобы',
  ERR_RPT_FORB: 'Нельзя пожаловаться на себя',
  ERR_RPT_NF: 'Жалоба не найдена',
  ERR_STATUS: 'Неверный статус жалобы',
  ERR_NO_FILE: 'Файл не прикреплён',
  ERR_NO_FILES: 'Файлы не прикреплены',
  ERR_AVA_INV: 'Неподдерживаемый формат изображения',
  ERR_ADMIN: 'Только для администраторов',
  ERR_ADMIN_ONLY: 'Только для администраторов',
  ERR_SEARCH_Q_EMPTY: 'Введите поисковый запрос',
  ERR_GRP_CRT: 'Не удалось создать группу',
  ERR_GROUP_META: 'Не удалось обновить группу',
  ERR_ADDMB_FAIL: 'Не удалось добавить участника',
  ERR_MEM_RMV: 'Не удалось удалить участника',
  ERR_USR_BAN: 'Не удалось забанить пользователя',
  ERR_UNB_WRG: 'Не удалось разбанить пользователя',
  ERR_DUPLICATE: 'Дубликат записи',
  ERR_INTERNAL: 'Внутренняя ошибка сервера',
  ERR_NO_TOKEN: 'Токен не предоставлен',
  ERR_TKN_INV: 'Неверный токен',
  ERR_REFR_INV: 'Требуется повторный вход',
  ERR_REFR_INC: 'Неверный refresh-токен',
  ERR_REFR_ALL_FAIL: 'Не удалось завершить все сессии',
  ERR_UID_MISSING: 'Не указан ID пользователя',
  ERR_SELF: 'Нельзя выполнить это действие с собой',
  ERR_DB_INTEGRITY: 'Нарушение целостности данных',
  ERR_AUTH_FAILED: 'Ошибка авторизации',
  ERR_JWT_ACC: 'Ошибка токена доступа',
  ERR_JWT_VER: 'Ошибка проверки токена',
  ERR_FPRINT_INV: 'Неверный отпечаток',
  ERR_FPRINT_MISMATCH: 'Несовпадение отпечатка',
};

const silentCodes = new Set([
  'ERR_AUTH_REQUIRED',
  'ERR_TOKEN_INVALID',
  'ERR_TOKEN_MISSING',
  'ERR_USER_BANNED',
  'ERR_PROFILE_INCOMPLETE',
  'ERR_NO_TOKEN',
]);

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  const code = (error as { code?: string }).code;
  if (code && silentCodes.has(code)) return null;
  let message: string;
  if (code && errorMessages[code]) {
    message = errorMessages[code];
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  return <p className="error">{message}</p>;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
    </div>
  );
}

export function submitForm<T extends HTMLFormElement>(
  handler: (form: FormData, event: FormEvent<T>) => Promise<void>,
) {
  return (event: FormEvent<T>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void handler(new FormData(form), event).then(() => {
      try { form.reset(); } catch {}
    });
  };
}
