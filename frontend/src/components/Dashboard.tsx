import React, { useState } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import { GET_BOARDS, CREATE_BOARD, CREATE_BOARD_FROM_TEMPLATE, DELETE_BOARD, BOARD_CREATED_SUB, BOARD_DELETED_SUB, COLLABS_CHANGED_SUB } from "../gql";

interface Props {
  userId?: string;
  userName?: string;
  onSelectBoard: (id: string, isOwner: boolean, myRole: "VIEWER" | "EDITOR" | null) => void;
  onLogout: () => void;
}

const ROLE_BADGE: Record<string, React.CSSProperties> = {
  EDITOR: { color: "#22d3ee", background: "#0e3a3a", border: "1px solid #22d3ee" },
  VIEWER: { color: "#888", background: "#1a1a1a", border: "1px solid #444" },
};

const TEMPLATES = [
  { id: "SPRINT", emoji: "🏃", label: "Sprint Board", description: "For dev teams — backlog, active work, done" },
  { id: "PERSONAL", emoji: "👤", label: "Personal Kanban", description: "Everyday tasks and personal goals" },
  { id: "BUG_TRACKER", emoji: "🐛", label: "Bug Tracker", description: "Track, prioritize and fix issues" },
];

export default function Dashboard({ userId, userName, onSelectBoard, onLogout }: Props) {
  const [newName, setNewName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateNames, setTemplateNames] = useState<Record<string, string>>({
    SPRINT: "Sprint Board",
    PERSONAL: "Personal Kanban",
    BUG_TRACKER: "Bug Tracker",
  });

  const { data, refetch } = useQuery(GET_BOARDS, { fetchPolicy: "network-only" });
  const [createBoard] = useMutation(CREATE_BOARD);
  const [createBoardFromTemplate] = useMutation(CREATE_BOARD_FROM_TEMPLATE);
  const [deleteBoard] = useMutation(DELETE_BOARD);

  useSubscription(BOARD_CREATED_SUB, { variables: { ownerId: userId }, skip: !userId, onData: () => refetch() });
  useSubscription(BOARD_DELETED_SUB, { variables: { ownerId: userId }, skip: !userId, onData: () => refetch() });
  useSubscription(COLLABS_CHANGED_SUB, { variables: { userId }, skip: !userId, onData: () => refetch() });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createBoard({ variables: { name: newName.trim() } });
    setNewName("");
    refetch();
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    const name = templateNames[templateId]?.trim();
    if (!name) return;
    await createBoardFromTemplate({ variables: { name, template: templateId } });
    setShowTemplates(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteBoard({ variables: { id } });
    refetch();
  };

  const boards: any[] = (data as any)?.boards || [];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>TaskFlow</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {userName && (
            <div style={styles.userBadge}>
              <span style={styles.userAvatar}>{userName.charAt(0).toUpperCase()}</span>
              <span style={styles.userName}>{userName}</span>
            </div>
          )}
          <button style={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        <h2 style={styles.title}>My Boards</h2>

        <form onSubmit={handleCreate} style={styles.createForm}>
          <input
            style={styles.input}
            placeholder="New board name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button style={styles.createBtn} type="submit">+ Create</button>
        </form>

        <button
          style={styles.templateToggle}
          onClick={() => setShowTemplates(v => !v)}
        >
          {showTemplates ? "▾ Hide templates" : "▸ Or start from a template"}
        </button>

        {showTemplates && (
          <div style={styles.templateGrid}>
            {TEMPLATES.map(t => (
              <div key={t.id} style={styles.templateCard}>
                <div style={styles.templateEmoji}>{t.emoji}</div>
                <div style={styles.templateLabel}>{t.label}</div>
                <div style={styles.templateDesc}>{t.description}</div>
                <input
                  style={styles.templateInput}
                  value={templateNames[t.id]}
                  onChange={e => setTemplateNames(prev => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="Board name..."
                />
                <button
                  style={styles.templateCreateBtn}
                  onClick={() => handleCreateFromTemplate(t.id)}
                >
                  Create →
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...styles.grid, marginTop: showTemplates ? 32 : 0 }}>
          {boards.map((board: any) => {
            const isOwner = board.owner?.id === userId;
            const myRole: "VIEWER" | "EDITOR" | null = isOwner ? null : board.myRole;
            return (
              <div key={board.id} style={styles.boardCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={styles.boardName} onClick={() => onSelectBoard(board.id, isOwner, myRole)}>
                    {board.name}
                  </div>
                  {myRole && (
                    <span style={{ ...styles.roleBadge, ...ROLE_BADGE[myRole] }}>
                      {myRole === "EDITOR" ? "Editor" : "Viewer"}
                    </span>
                  )}
                </div>
                <div style={styles.boardFooter}>
                  <span style={styles.muted}>{new Date(board.createdAt).toLocaleDateString()}</span>
                  {isOwner && (
                    <button style={styles.deleteBtn} onClick={() => handleDelete(board.id)}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
          {boards.length === 0 && (
            <p style={styles.muted}>No boards yet. Create one above.</p>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", color: "#eee" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid #1a1a1a" },
  logo: { color: "#22d3ee", fontWeight: 700, fontSize: 20 },
  logoutBtn: { background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  main: { maxWidth: 900, margin: "0 auto", padding: "40px 24px" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 24 },
  createForm: { display: "flex", gap: 10, marginBottom: 12 },
  input: { flex: 1, padding: "10px 14px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 14, outline: "none" },
  createBtn: { padding: "10px 20px", background: "#22d3ee", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer" },
  templateToggle: { background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 13, padding: "4px 0", marginBottom: 20 },
  templateGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 8 },
  templateCard: { background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 },
  templateEmoji: { fontSize: 28 },
  templateLabel: { fontSize: 15, fontWeight: 700, color: "#eee" },
  templateDesc: { fontSize: 12, color: "#555", lineHeight: 1.4 },
  templateInput: { padding: "8px 12px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 13, outline: "none" },
  templateCreateBtn: { padding: "8px 0", background: "#22d3ee", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },
  boardCard: { background: "#111", border: "1px solid #222", borderRadius: 12, padding: 20 },
  boardName: { fontSize: 16, fontWeight: 600, cursor: "pointer", color: "#eee" },
  boardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  muted: { color: "#555", fontSize: 13 },
  deleteBtn: { background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 12 },
  roleBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, flexShrink: 0 },
  userBadge: { display: "flex", alignItems: "center", gap: 8 },
  userAvatar: { width: 28, height: 28, borderRadius: "50%", background: "#22d3ee", color: "#000", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 14, color: "#aaa" },
};
