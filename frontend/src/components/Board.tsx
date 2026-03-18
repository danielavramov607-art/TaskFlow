import React, { useState } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GET_TASKS,
  CREATE_TASK,
  MOVE_TASK,
  DELETE_TASK,
  UPDATE_TASK,
  TASK_CREATED_SUB,
  TASK_MOVED_SUB,
  TASK_DELETED_SUB,
  TASK_UPDATED_SUB,
  ME,
  GET_BOARD_COLLABORATORS,
  INVITE_COLLABORATOR,
  REMOVE_COLLABORATOR,
  GET_COMMENTS,
  ADD_COMMENT,
  DELETE_COMMENT,
  COMMENT_ADDED_SUB,
  GET_ACTIVITY_LOG,
  ACTIVITY_ADDED_SUB,
  GET_BOARD_LABELS,
  CREATE_LABEL,
  DELETE_LABEL,
  LABEL_CHANGED_SUB,
  GET_ATTACHMENTS,
  DELETE_ATTACHMENT,
  GET_NOTIFICATIONS,
  MARK_NOTIFICATIONS_READ,
  NOTIFICATION_ADDED_SUB,
} from "../gql";

type Column = "TODO" | "IN_PROGRESS" | "DONE";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE", label: "Done" },
];

interface Assignee {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

const LABEL_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#fb923c"];

type Priority = "LOW" | "MEDIUM" | "HIGH";

const PRIORITY_COLORS: Record<Priority, { color: string; background: string }> = {
  LOW:    { color: "#888",    background: "#1a1a1a" },
  MEDIUM: { color: "#fbbf24", background: "#2a2000" },
  HIGH:   { color: "#f87171", background: "#2a0000" },
};

interface Task {
  id: string;
  title: string;
  description?: string;
  column: Column;
  order: number;
  dueDate?: string;
  priority: Priority;
  assignee?: Assignee;
  labels?: Label[];
  createdAt: string;
}

interface Props {
  boardId: string;
  onBack: () => void;
  onLogout: () => void;
  userName?: string;
  isOwner?: boolean;
  viewerRole?: "VIEWER" | "EDITOR" | null;
}

function formatDueDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(iso: string) {
  return new Date(iso) < new Date(new Date().toDateString());
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Sortable Task Card ---
function TaskCard({
  task,
  onEdit,
  onDelete,
  onComment,
  onAttach,
  isDragging,
  isReadOnly,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComment: (task: Task) => void;
  onAttach: (task: Task) => void;
  isDragging?: boolean;
  isReadOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={styles.taskCard}>
        {/* Drag handle */}
        <div {...attributes} {...listeners} style={styles.dragHandle} title="Drag to move">
          ⠿
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <p style={styles.taskTitle}>{task.title}</p>
            <span style={{ ...styles.priorityBadge, color: PRIORITY_COLORS[task.priority].color, background: PRIORITY_COLORS[task.priority].background }}>
              {task.priority}
            </span>
            {task.labels?.map(l => (
              <span key={l.id} style={{ ...styles.labelBadge, color: l.color, borderColor: l.color }}>{l.name}</span>
            ))}
          </div>
          {task.description && <p style={styles.taskDesc}>{task.description}</p>}
          {task.dueDate && (
            <p style={{ ...styles.dueDateBadge, ...(isOverdue(task.dueDate) ? styles.dueDateOverdue : styles.dueDateOk) }}>
              📅 {formatDueDate(task.dueDate)}{isOverdue(task.dueDate) ? " — Overdue" : ""}
            </p>
          )}
          {task.assignee && (
            <div style={styles.assigneeBadge}>
              <span style={styles.assigneeAvatar}>{task.assignee.name.charAt(0).toUpperCase()}</span>
              <span style={styles.assigneeName}>{task.assignee.name}</span>
            </div>
          )}
        </div>
        <div style={styles.taskActions}>
          <button style={styles.actionBtn} onClick={() => onComment(task)}>💬</button>
          <button style={styles.actionBtn} onClick={() => onAttach(task)}>📎</button>
          {!isReadOnly && (
            <>
              <button style={styles.actionBtn} onClick={() => onEdit(task)}>Edit</button>
              <button style={styles.deleteBtn} onClick={() => onDelete(task.id)}>✕</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Droppable Column ---
function BoardColumn({
  col,
  tasks,
  onEdit,
  onDelete,
  onComment,
  onAttach,
  activeId,
  activeColumn,
  overColumn,
  newTaskCol,
  setNewTaskCol,
  newTitle,
  setNewTitle,
  onCreateSubmit,
  isReadOnly,
}: {
  col: { key: Column; label: string };
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComment: (task: Task) => void;
  onAttach: (task: Task) => void;
  activeId: string | null;
  activeColumn: Column | null;
  overColumn: Column | null;
  newTaskCol: Column | null;
  setNewTaskCol: (c: Column | null) => void;
  newTitle: string;
  setNewTitle: (v: string) => void;
  onCreateSubmit: (e: React.FormEvent, column: Column) => void;
  isReadOnly?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.key });
  const showDropZone = overColumn === col.key && activeColumn !== col.key;

  return (
    <div style={styles.column}>
      <div style={styles.colHeader}>
        <span style={styles.colTitle}>{col.label}</span>
        <span style={styles.colCount}>{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={styles.taskList}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onComment={onComment}
              onAttach={onAttach}
              isDragging={activeId === task.id}
              isReadOnly={isReadOnly}
            />
          ))}
          {showDropZone && <div style={styles.dropZone} />}
        </div>
      </SortableContext>

      {!isReadOnly && (
        newTaskCol === col.key ? (
          <form onSubmit={(e) => onCreateSubmit(e, col.key)} style={styles.addForm}>
            <input
              style={styles.addInput}
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button style={styles.addBtn} type="submit">Add</button>
              <button style={styles.cancelBtn} type="button" onClick={() => setNewTaskCol(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            style={styles.addTaskBtn}
            onClick={() => { setNewTaskCol(col.key); setNewTitle(""); }}
          >
            + Add task
          </button>
        )
      )}
    </div>
  );
}

// --- Main Board ---
export default function Board({ boardId, onBack, onLogout, userName, isOwner = true, viewerRole = null }: Props) {
  const [newTaskCol, setNewTaskCol] = useState<Column | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", dueDate: "", assigneeId: "", priority: "MEDIUM" as Priority, labelIds: [] as string[] });
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [filterLabel, setFilterLabel] = useState<string | "ALL">("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Column | null>(null);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<Priority | "ALL">("ALL");
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("EDITOR");
  const [inviteError, setInviteError] = useState("");
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const [attachTask, setAttachTask] = useState<Task | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isReadOnly = viewerRole === "VIEWER";

  const { data: meData } = useQuery(ME);
  const me = (meData as any)?.me as Assignee | undefined;

  const { data, refetch } = useQuery(GET_TASKS, {
    variables: { boardId },
    fetchPolicy: "network-only",
  });

  const [createTask] = useMutation(CREATE_TASK);
  const [moveTask] = useMutation(MOVE_TASK);
  const [deleteTask] = useMutation(DELETE_TASK);
  const [updateTask] = useMutation(UPDATE_TASK);
  const [inviteCollaborator] = useMutation(INVITE_COLLABORATOR);
  const [removeCollaborator] = useMutation(REMOVE_COLLABORATOR);

  const { data: collabData, refetch: refetchCollabs } = useQuery(GET_BOARD_COLLABORATORS, {
    variables: { boardId },
    fetchPolicy: "network-only",
  });
  const collaborators: any[] = (collabData as any)?.boardCollaborators || [];

  // All board members available for assignment (me + collaborators)
  const boardMembers: Assignee[] = me
    ? [me, ...collaborators.map((c: any) => c.user).filter((u: any) => u.id !== me.id)]
    : collaborators.map((c: any) => c.user);

  const { data: commentsData, refetch: refetchComments } = useQuery(GET_COMMENTS, {
    variables: { taskId: commentTask?.id },
    skip: !commentTask,
    fetchPolicy: "network-only",
  });
  const comments: any[] = (commentsData as any)?.comments || [];
  const [addComment] = useMutation(ADD_COMMENT);
  const [deleteComment] = useMutation(DELETE_COMMENT);

  useSubscription(COMMENT_ADDED_SUB, {
    variables: { boardId },
    onData: () => { if (commentTask) refetchComments(); },
  });

  const { data: logData, refetch: refetchLog } = useQuery(GET_ACTIVITY_LOG, {
    variables: { boardId },
    skip: !logOpen,
    fetchPolicy: "network-only",
  });
  const activityEntries: any[] = (logData as any)?.activityLog || [];

  useSubscription(ACTIVITY_ADDED_SUB, {
    variables: { boardId },
    onData: () => { if (logOpen) refetchLog(); },
  });

  const { data: attachData, refetch: refetchAttachments } = useQuery(GET_ATTACHMENTS, {
    variables: { taskId: attachTask?.id },
    skip: !attachTask,
    fetchPolicy: "network-only",
  });
  const attachments: any[] = (attachData as any)?.taskAttachments || [];
  const [deleteAttachment] = useMutation(DELETE_ATTACHMENT);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !attachTask) return;
    const file = e.target.files[0];
    const token = sessionStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL || "http://localhost:4000"}/upload/${attachTask.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      refetchAttachments();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachment({ variables: { attachmentId } });
    refetchAttachments();
  };

  const { data: labelsData, refetch: refetchLabels } = useQuery(GET_BOARD_LABELS, {
    variables: { boardId },
    fetchPolicy: "network-only",
  });
  const boardLabels: Label[] = (labelsData as any)?.boardLabels || [];
  const [createLabel] = useMutation(CREATE_LABEL);
  const [deleteLabel] = useMutation(DELETE_LABEL);

  useSubscription(LABEL_CHANGED_SUB, { variables: { boardId }, onData: () => refetchLabels() });

  const { data: notifData, refetch: refetchNotifs } = useQuery(GET_NOTIFICATIONS, { fetchPolicy: "network-only" });
  const notifications: any[] = (notifData as any)?.myNotifications || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const [markNotificationsRead] = useMutation(MARK_NOTIFICATIONS_READ);

  useSubscription(NOTIFICATION_ADDED_SUB, {
    variables: { userId: me?.id },
    skip: !me?.id,
    onData: () => refetchNotifs(),
  });

  useSubscription(TASK_CREATED_SUB, { variables: { boardId }, onData: () => refetch() });
  useSubscription(TASK_MOVED_SUB, { variables: { boardId }, onData: () => refetch() });
  useSubscription(TASK_DELETED_SUB, { variables: { boardId }, onData: () => refetch() });
  useSubscription(TASK_UPDATED_SUB, { variables: { boardId }, onData: () => refetch() });

  const allTasks: Task[] = (data as any)?.tasks || [];
  const tasks = allTasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = filterPriority === "ALL" || t.priority === filterPriority;
    const matchesLabel = filterLabel === "ALL" || t.labels?.some(l => l.id === filterLabel);
    return matchesSearch && matchesPriority && matchesLabel;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getColumn = (taskId: string): Column | null =>
    tasks.find((t) => t.id === taskId)?.column ?? null;

  const resolveColumn = (id: string): Column | null => {
    if (COLUMNS.some((c) => c.key === id)) return id as Column;
    return getColumn(id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverColumn(over ? resolveColumn(over.id as string) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;
    const activeCol = getColumn(activeTaskId);
    const targetColumn = resolveColumn(overId);

    if (!targetColumn || activeCol === targetColumn) return;
    if (isReadOnly) return;

    await moveTask({ variables: { taskId: activeTaskId, column: targetColumn } });
    refetch();
  };

  const handleCreate = async (e: React.FormEvent, column: Column) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createTask({ variables: { boardId, title: newTitle.trim(), column } });
    setNewTitle("");
    setNewTaskCol(null);
    refetch();
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask({ variables: { taskId } });
    refetch();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    await updateTask({
      variables: {
        taskId: editingTask.id,
        title: editForm.title,
        description: editForm.description,
        dueDate: editForm.dueDate || null,
        assigneeId: editForm.assigneeId || null,
        priority: editForm.priority,
        labelIds: editForm.labelIds,
      },
    });
    setEditingTask(null);
    refetch();
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
      assigneeId: task.assignee?.id || "",
      priority: task.priority || "MEDIUM",
      labelIds: task.labels?.map(l => l.id) || [],
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentTask) return;
    await addComment({ variables: { taskId: commentTask.id, text: commentText.trim() } });
    setCommentText("");
    refetchComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment({ variables: { commentId } });
    refetchComments();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    try {
      await inviteCollaborator({ variables: { boardId, email: inviteEmail.trim(), role: inviteRole } });
      setInviteEmail("");
      refetchCollabs();
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite");
    }
  };

  const handleRemoveCollab = async (userId: string) => {
    await removeCollaborator({ variables: { boardId, userId } });
    refetchCollabs();
  };

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={styles.backBtn} onClick={onBack}>← Boards</button>
          <span style={styles.logo}>TaskFlow</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {userName && (
            <div style={styles.userBadge}>
              <span style={styles.userAvatar}>{userName.charAt(0).toUpperCase()}</span>
              <span style={styles.userName}>{userName}</span>
            </div>
          )}
          <button style={logOpen ? styles.logBtnActive : styles.logBtn} onClick={() => setLogOpen(v => !v)}>Activity</button>
          {isOwner && (
            <button style={styles.shareBtn} onClick={() => setShareOpen(true)}>Share</button>
          )}
          <div style={{ position: "relative" }}>
            <button
              style={styles.notifBtn}
              onClick={() => {
                const opening = !notifOpen;
                setNotifOpen(opening);
                if (opening && unreadCount > 0) {
                  markNotificationsRead().then(() => refetchNotifs());
                }
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={styles.notifBadge}>{unreadCount}</span>
              )}
            </button>
            {notifOpen && (
              <div style={styles.notifDropdown}>
                <p style={styles.notifTitle}>Notifications</p>
                {notifications.length === 0 && (
                  <p style={styles.notifEmpty}>No notifications yet.</p>
                )}
                {notifications.map((n: any) => (
                  <div key={n.id} style={{ ...styles.notifItem, ...(n.read ? {} : styles.notifUnread) }}>
                    <p style={styles.notifText}>{n.text}</p>
                    <p style={styles.notifTime}>{formatRelativeTime(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.toolbar}>
          <input
            style={styles.searchInput}
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={styles.filterGroup}>
            {(["ALL", "LOW", "MEDIUM", "HIGH"] as const).map(p => (
              <button
                key={p}
                style={{
                  ...styles.filterBtn,
                  ...(filterPriority === p ? styles.filterBtnActive : {}),
                  ...(p !== "ALL" ? { color: PRIORITY_COLORS[p as Priority].color } : {}),
                }}
                onClick={() => setFilterPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {boardLabels.length > 0 && (
            <div style={styles.filterGroup}>
              <button
                style={{ ...styles.filterBtn, ...(filterLabel === "ALL" ? styles.filterBtnActive : {}) }}
                onClick={() => setFilterLabel("ALL")}
              >
                All labels
              </button>
              {boardLabels.map(l => (
                <button
                  key={l.id}
                  style={{
                    ...styles.filterBtn,
                    ...(filterLabel === l.id ? styles.filterBtnActive : {}),
                    color: l.color,
                    borderColor: filterLabel === l.id ? l.color : "#333",
                  }}
                  onClick={() => setFilterLabel(l.id)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div style={styles.board}>
            {COLUMNS.map((col) => {
              const colTasks = tasks
                .filter((t) => t.column === col.key)
                .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
              return (
                <BoardColumn
                  key={col.key}
                  col={col}
                  tasks={colTasks}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onComment={setCommentTask}
                  onAttach={setAttachTask}
                  activeId={activeId}
                  activeColumn={activeId ? getColumn(activeId) : null}
                  overColumn={overColumn}
                  newTaskCol={newTaskCol}
                  setNewTaskCol={setNewTaskCol}
                  newTitle={newTitle}
                  setNewTitle={setNewTitle}
                  onCreateSubmit={handleCreate}
                  isReadOnly={isReadOnly}
                />
              );
            })}
          </div>

          {/* Drag overlay — floating card while dragging */}
          <DragOverlay>
            {activeTask ? (
              <div style={{ ...styles.taskCard, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", opacity: 0.95 }}>
                <div style={styles.dragHandle}>⠿</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <p style={styles.taskTitle}>{activeTask.title}</p>
                    <span style={{ ...styles.priorityBadge, color: PRIORITY_COLORS[activeTask.priority].color, background: PRIORITY_COLORS[activeTask.priority].background }}>
                      {activeTask.priority}
                    </span>
                  </div>
                  {activeTask.description && <p style={styles.taskDesc}>{activeTask.description}</p>}
                  {activeTask.dueDate && (
                    <p style={{ ...styles.dueDateBadge, ...(isOverdue(activeTask.dueDate) ? styles.dueDateOverdue : styles.dueDateOk) }}>
                      📅 {formatDueDate(activeTask.dueDate)}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        </div>
        {logOpen && (
          <div style={styles.activitySidebar}>
            <h4 style={styles.activityTitle}>Activity</h4>
            <div style={styles.activityList}>
              {activityEntries.length === 0 && <p style={styles.activityEmpty}>No activity yet.</p>}
              {activityEntries.map((e: any) => (
                <div key={e.id} style={styles.activityItem}>
                  <span style={styles.activityAvatar}>{e.user.name.charAt(0).toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <p style={styles.activityText}>{e.text}</p>
                    <p style={styles.activityTime}>{formatRelativeTime(e.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Comments Modal */}
      {commentTask && (
        <div style={styles.overlay} onClick={() => { setCommentTask(null); setCommentText(""); }}>
          <div style={styles.commentModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>💬 {commentTask.title}</h3>

            <div style={styles.commentList}>
              {comments.length === 0 && (
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>No comments yet. Be the first!</p>
              )}
              {comments.map((c: any) => (
                <div key={c.id} style={styles.commentItem}>
                  <div style={styles.commentMeta}>
                    <span style={styles.commentAvatar}>{c.author.name.charAt(0).toUpperCase()}</span>
                    <span style={styles.commentAuthor}>{c.author.name}</span>
                    <span style={styles.commentTime}>
                      {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                      {new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {c.author.id === me?.id && (
                      <button style={styles.commentDeleteBtn} onClick={() => handleDeleteComment(c.id)}>✕</button>
                    )}
                  </div>
                  <p style={styles.commentText}>{c.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <textarea
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(e as any); } }}
              />
              <button style={styles.postBtn} type="submit">Post</button>
            </form>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {attachTask && (
        <div style={styles.overlay} onClick={() => setAttachTask(null)}>
          <div style={styles.commentModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>📎 {attachTask.title}</h3>

            <div style={styles.commentList}>
              {attachments.length === 0 && (
                <p style={{ color: "#555", fontSize: 13, margin: 0 }}>No attachments yet.</p>
              )}
              {attachments.map((a: any) => {
                const isImage = a.fileType.startsWith("image/");
                return (
                  <div key={a.id} style={styles.attachItem}>
                    {isImage ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        <img src={a.url} alt={a.filename} style={styles.attachThumb} />
                      </a>
                    ) : (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.attachFileLink}
                      >
                        📄 {a.filename}
                      </a>
                    )}
                    <div style={styles.attachMeta}>
                      <span style={styles.attachName}>{isImage ? a.filename : ""}</span>
                      <span style={styles.attachTime}>{a.uploader.name} · {formatRelativeTime(a.createdAt)}</span>
                    </div>
                    {a.uploader.id === me?.id && (
                      <button style={styles.commentDeleteBtn} onClick={() => handleDeleteAttachment(a.id)}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <label style={styles.uploadBtn}>
                {uploading ? "Uploading..." : "Upload file"}
                <input type="file" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
              </label>
              <span style={{ fontSize: 12, color: "#555" }}>Max 10 MB · images, PDF, doc, txt</span>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareOpen && (
        <div style={styles.overlay} onClick={() => setShareOpen(false)}>
          <div style={{ ...styles.modal, width: 460 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Share Board</h3>

            {/* Current collaborators */}
            {collaborators.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...styles.modalLabel, marginBottom: 8 }}>Collaborators</p>
                {collaborators.map((c: any) => (
                  <div key={c.user.id} style={styles.collabRow}>
                    <div>
                      <span style={styles.collabName}>{c.user.name}</span>
                      <span style={styles.collabEmail}>{c.user.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        ...styles.rolePill,
                        ...(c.role === "EDITOR"
                          ? { color: "#22d3ee", background: "#0e3a3a", border: "1px solid #22d3ee" }
                          : { color: "#888", background: "#1a1a1a", border: "1px solid #444" })
                      }}>
                        {c.role === "EDITOR" ? "Editor" : "Viewer"}
                      </span>
                      <button style={styles.removeBtn} onClick={() => handleRemoveCollab(c.user.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Invite form */}
            <form onSubmit={handleInvite} style={styles.modalForm}>
              <p style={styles.modalLabel}>Invite by email</p>
              <input
                style={styles.modalInput}
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
                required
              />
              <div>
                <label style={styles.modalLabel}>Role</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["EDITOR", "VIEWER"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1px solid ${r === "EDITOR" ? "#22d3ee" : "#666"}`,
                        color: inviteRole === r ? "#000" : (r === "EDITOR" ? "#22d3ee" : "#888"),
                        background: inviteRole === r ? (r === "EDITOR" ? "#22d3ee" : "#888") : "transparent",
                      }}
                    >
                      {r === "EDITOR" ? "Editor" : "Viewer"}
                    </button>
                  ))}
                </div>
              </div>
              {inviteError && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{inviteError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.saveBtn} type="submit">Invite</button>
                <button style={styles.cancelBtn} type="button" onClick={() => { setShareOpen(false); setInviteEmail(""); setInviteError(""); }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div style={styles.overlay} onClick={() => setEditingTask(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Edit Task</h3>
            <form onSubmit={handleEdit} style={styles.modalForm}>
              <input
                style={styles.modalInput}
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Title"
                required
              />
              <textarea
                style={{ ...styles.modalInput, height: 80, resize: "vertical" }}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Description (optional)"
              />
              <div>
                <label style={styles.modalLabel}>Priority</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["LOW", "MEDIUM", "HIGH"] as Priority[]).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, priority: p })}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1px solid ${PRIORITY_COLORS[p].color}`,
                        color: editForm.priority === p ? "#000" : PRIORITY_COLORS[p].color,
                        background: editForm.priority === p ? PRIORITY_COLORS[p].color : "transparent",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={styles.modalLabel}>Assignee</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {boardMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      style={editForm.assigneeId === member.id ? styles.assigneeActive : styles.assigneeOption}
                      onClick={() => setEditForm({ ...editForm, assigneeId: editForm.assigneeId === member.id ? "" : member.id })}
                    >
                      {editForm.assigneeId === member.id ? "✓ " : ""}{member.name}
                    </button>
                  ))}
                  {editForm.assigneeId && (
                    <button
                      type="button"
                      style={styles.assigneeClear}
                      onClick={() => setEditForm({ ...editForm, assigneeId: "" })}
                    >
                      Unassign
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label style={styles.modalLabel}>Labels</label>
                {boardLabels.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {boardLabels.map(l => {
                      const selected = editForm.labelIds.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setEditForm({
                            ...editForm,
                            labelIds: selected
                              ? editForm.labelIds.filter(id => id !== l.id)
                              : [...editForm.labelIds, l.id],
                          })}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${l.color}`,
                            color: selected ? "#000" : l.color,
                            background: selected ? l.color : "transparent",
                          }}
                        >
                          {l.name}
                          {!isReadOnly && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLabel({ variables: { labelId: l.id } }).then(() => refetchLabels());
                              }}
                              style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400 }}
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!isReadOnly && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      style={{ ...styles.modalInput, flex: 1, padding: "6px 10px", fontSize: 12 }}
                      placeholder="Label name..."
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 4 }}>
                      {LABEL_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewLabelColor(c)}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: c,
                            border: newLabelColor === c ? "2px solid #fff" : "2px solid transparent",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      style={{ ...styles.addBtn, padding: "6px 12px", flex: "none", fontSize: 12 }}
                      onClick={() => {
                        if (!newLabelName.trim()) return;
                        createLabel({ variables: { boardId, name: newLabelName.trim(), color: newLabelColor } })
                          .then(() => { refetchLabels(); setNewLabelName(""); });
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label style={styles.modalLabel}>Due date (optional)</label>
                <input
                  type="date"
                  style={styles.modalInput}
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.saveBtn} type="submit">Save</button>
                <button style={styles.cancelBtn} type="button" onClick={() => setEditingTask(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", color: "#eee" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid #1a1a1a" },
  logo: { color: "#22d3ee", fontWeight: 700, fontSize: 20 },
  backBtn: { background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 14 },
  logoutBtn: { background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  main: { padding: "24px 24px 32px", overflowX: "auto" },
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
  searchInput: { flex: 1, maxWidth: 280, padding: "8px 12px", background: "#111", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 13, outline: "none" },
  filterGroup: { display: "flex", gap: 6 },
  filterBtn: { padding: "6px 12px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#666", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  filterBtnActive: { background: "#222", borderColor: "#555", color: "#eee" },
  board: { display: "flex", gap: 20, minWidth: 720, alignItems: "flex-start" },
  column: { flex: 1, background: "#111", borderRadius: 12, padding: 16, minHeight: 400 },
  colHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  colTitle: { fontWeight: 600, fontSize: 15 },
  colCount: { background: "#222", color: "#888", borderRadius: 20, padding: "2px 8px", fontSize: 12 },
  taskList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 12, minHeight: 40 },
  dropZone: { height: 40, borderRadius: 8, border: "1px dashed #22d3ee", background: "#1a2a2a" },
  taskCard: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 12, display: "flex", alignItems: "flex-start", gap: 8 },
  dragHandle: { color: "#444", cursor: "grab", fontSize: 16, paddingTop: 2, userSelect: "none", flexShrink: 0 },
  taskTitle: { margin: 0, fontSize: 14, fontWeight: 500, wordBreak: "break-word" },
  priorityBadge: { fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, flexShrink: 0 },
  taskDesc: { margin: 0, fontSize: 12, color: "#666", marginBottom: 8, wordBreak: "break-word" },
  taskActions: { display: "flex", gap: 6, flexShrink: 0 },
  actionBtn: { background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 },
  deleteBtn: { background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 12 },
  addTaskBtn: { width: "100%", background: "transparent", border: "1px dashed #333", color: "#555", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13 },
  addForm: { display: "flex", flexDirection: "column", gap: 8 },
  addInput: { padding: "8px 10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 13, outline: "none" },
  addBtn: { flex: 1, padding: "6px 0", background: "#22d3ee", border: "none", borderRadius: 6, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  cancelBtn: { padding: "6px 12px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 13 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#111", border: "1px solid #222", borderRadius: 16, padding: 28, width: 400 },
  modalTitle: { margin: "0 0 20px", fontSize: 18, fontWeight: 600 },
  modalForm: { display: "flex", flexDirection: "column", gap: 12 },
  modalInput: { padding: "10px 14px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 14, outline: "none" },
  saveBtn: { flex: 1, padding: "10px 0", background: "#22d3ee", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer" },
  modalLabel: { display: "block", fontSize: 12, color: "#888", marginBottom: 6 },
  dueDateBadge: { margin: 0, fontSize: 11, marginTop: 6 },
  dueDateOk: { color: "#22d3ee" },
  dueDateOverdue: { color: "#f87171" },
  assigneeBadge: { display: "flex", alignItems: "center", gap: 5, marginTop: 8 },
  assigneeAvatar: { width: 18, height: 18, borderRadius: "50%", background: "#22d3ee", color: "#000", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  assigneeName: { fontSize: 11, color: "#aaa" },
  assigneeOption: { padding: "4px 10px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: "#888", cursor: "pointer", fontSize: 13 },
  assigneeActive: { padding: "4px 10px", background: "#0e3a3a", border: "1px solid #22d3ee", borderRadius: 6, color: "#22d3ee", cursor: "pointer", fontSize: 13 },
  assigneeClear: { padding: "4px 10px", background: "transparent", border: "1px solid #444", borderRadius: 6, color: "#555", cursor: "pointer", fontSize: 13 },
  userBadge: { display: "flex", alignItems: "center", gap: 8 },
  userAvatar: { width: 28, height: 28, borderRadius: "50%", background: "#22d3ee", color: "#000", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 14, color: "#aaa" },
  logBtn: { padding: "6px 14px", background: "transparent", border: "1px solid #333", color: "#888", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  logBtnActive: { padding: "6px 14px", background: "transparent", border: "1px solid #22d3ee", color: "#22d3ee", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  activitySidebar: { width: 280, flexShrink: 0, background: "#111", borderRadius: 12, padding: 16, maxHeight: "calc(100vh - 120px)", overflowY: "auto", position: "sticky", top: 24 },
  activityTitle: { fontSize: 11, fontWeight: 700, color: "#555", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 1 },
  activityList: { display: "flex", flexDirection: "column" },
  activityItem: { display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" },
  activityAvatar: { width: 24, height: 24, borderRadius: "50%", background: "#22d3ee", color: "#000", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  activityText: { fontSize: 12, color: "#ccc", margin: 0, lineHeight: 1.4, wordBreak: "break-word" },
  activityTime: { fontSize: 11, color: "#555", margin: "3px 0 0" },
  activityEmpty: { fontSize: 12, color: "#555", margin: 0 },
  shareBtn: { padding: "6px 14px", background: "transparent", border: "1px solid #22d3ee", color: "#22d3ee", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  commentModal: { background: "#111", border: "1px solid #222", borderRadius: 16, padding: 28, width: 500, maxHeight: "80vh", display: "flex", flexDirection: "column" },
  commentList: { flex: 1, overflowY: "auto", maxHeight: 320, display: "flex", flexDirection: "column", gap: 0, marginBottom: 4 },
  commentItem: { padding: "10px 0", borderBottom: "1px solid #1a1a1a" },
  commentMeta: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  commentAvatar: { width: 22, height: 22, borderRadius: "50%", background: "#22d3ee", color: "#000", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  commentAuthor: { fontSize: 13, fontWeight: 600, color: "#eee" },
  commentTime: { fontSize: 11, color: "#555", marginLeft: 2 },
  commentDeleteBtn: { marginLeft: "auto", background: "transparent", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: "0 2px" },
  commentText: { margin: 0, fontSize: 13, color: "#ccc", lineHeight: 1.5, paddingLeft: 30, wordBreak: "break-word" },
  commentInput: { flex: 1, padding: "8px 12px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, color: "#eee", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" },
  postBtn: { padding: "8px 16px", background: "#22d3ee", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", alignSelf: "flex-end" },
  collabRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a" },
  collabName: { fontSize: 13, color: "#eee", marginRight: 8 },
  collabEmail: { fontSize: 11, color: "#555" },
  rolePill: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 },
  removeBtn: { background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 13, padding: "0 4px" },
  labelBadge: { fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, border: "1px solid", background: "transparent" },
  attachItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" },
  attachThumb: { width: 56, height: 56, objectFit: "cover" as const, borderRadius: 6, flexShrink: 0, border: "1px solid #333" },
  attachFileLink: { color: "#22d3ee", fontSize: 13, textDecoration: "none", flexShrink: 0 },
  attachMeta: { flex: 1, minWidth: 0 },
  attachName: { display: "block", fontSize: 12, color: "#ccc", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  attachTime: { display: "block", fontSize: 11, color: "#555", marginTop: 2 },
  uploadBtn: { display: "inline-block", padding: "8px 16px", background: "#22d3ee", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  notifBtn: { position: "relative", background: "transparent", border: "1px solid #333", color: "#eee", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16 },
  notifBadge: { position: "absolute", top: -6, right: -6, background: "#f87171", color: "#000", borderRadius: "50%", fontSize: 10, fontWeight: 700, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  notifDropdown: { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, background: "#111", border: "1px solid #222", borderRadius: 12, padding: 12, zIndex: 200, maxHeight: 360, overflowY: "auto" },
  notifTitle: { fontSize: 11, fontWeight: 700, color: "#555", margin: "0 0 10px", textTransform: "uppercase" as const, letterSpacing: 1 },
  notifEmpty: { fontSize: 13, color: "#555", margin: 0 },
  notifItem: { padding: "8px 0", borderBottom: "1px solid #1a1a1a" },
  notifUnread: { borderLeft: "2px solid #22d3ee", paddingLeft: 8 },
  notifText: { fontSize: 13, color: "#ccc", margin: 0, lineHeight: 1.4 },
  notifTime: { fontSize: 11, color: "#555", margin: "3px 0 0" },
};
