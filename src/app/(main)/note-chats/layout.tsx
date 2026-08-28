import styles from "./note-chats-scroll.module.css";

export default function NoteChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={styles.scope}>{children}</div>;
}
