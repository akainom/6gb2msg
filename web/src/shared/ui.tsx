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
  ERR_PASSWD_INC: 'Неверный пароль',
  ERR_CRED_INC: 'Неверный логин или пароль',
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
  ERR_MSG_EMPTY: 'Сообщение не может быть пустым',
  ERR_MSG_NF: 'Сообщение не найдено',
  ERR_MSG_FORB: 'Нельзя редактировать чужое сообщение',
  ERR_REASON: 'Укажите причину жалобы',
  ERR_NO_FILE: 'Файл не прикреплён',
  ERR_AVA_INV: 'Неподдерживаемый формат изображения',
  ERR_REPORT_NF: 'Жалоба не найдена',
  ERR_ADMIN: 'Только для администраторов',
  ERR_AUTH_REQUIRED: 'Требуется авторизация',
  ERR_TOKEN_INVALID: 'Сессия истекла, войдите заново',
  ERR_USER_BANNED: 'Аккаунт заблокирован',
  ERR_PROFILE_INCOMPLETE: 'Завершите регистрацию профиля',
};

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  let message: string;
  const code = (error as { code?: string }).code;
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
