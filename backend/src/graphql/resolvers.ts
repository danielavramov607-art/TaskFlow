import * as jwt from "jsonwebtoken";
import { PubSub } from "graphql-subscriptions";
import User from "../models/User";
import Board from "../models/Board";
import Task from "../models/Task";
import Comment from "../models/Comment";
import ActivityLog from "../models/ActivityLog";
import Label from "../models/Label";
import Notification from "../models/Notification";
import Attachment from "../models/Attachment";
import { v2 as cloudinary } from "cloudinary";

const pubsub = new PubSub();
const pubsubAny = pubsub as any;

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production";

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function getUser(token: string | undefined) {
  if (!token) return null;
  try {
    const clean = token.startsWith("Bearer ") ? token.slice(7) : token;
    return jwt.verify(clean, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

const COLUMN_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

async function notify(pubsubInstance: any, userId: string, text: string, boardId: string) {
  const n = await Notification.create({ user: userId, text, boardId });
  const plain = await Notification.findById(n._id).lean();
  pubsubInstance.publish(`NOTIFICATION_${userId}`, { notificationAdded: plain });
}

async function logActivity(pubsubInstance: any, boardId: string, userId: string, text: string) {
  const entry = await ActivityLog.create({ board: boardId, user: userId, text });
  const plain = await ActivityLog.findById(entry._id).lean();
  pubsubInstance.publish(`ACTIVITY_ADDED_${boardId}`, { activityAdded: plain });
}

const TEMPLATES: Record<string, Array<{ title: string; description: string; column: string; priority: string }>> = {
  SPRINT: [
    { title: "Define requirements", description: "Write down acceptance criteria before coding", column: "TODO", priority: "MEDIUM" },
    { title: "Set up CI/CD pipeline", description: "Automate tests and deployment", column: "TODO", priority: "HIGH" },
    { title: "Write unit tests", description: "Aim for 80% coverage on core modules", column: "TODO", priority: "MEDIUM" },
    { title: "Implement login flow", description: "JWT auth, remember me, forgot password", column: "IN_PROGRESS", priority: "HIGH" },
    { title: "Design dashboard UI", description: "Wireframes approved, start implementation", column: "IN_PROGRESS", priority: "MEDIUM" },
    { title: "Project kickoff", description: "Team aligned on goals and timeline", column: "DONE", priority: "LOW" },
    { title: "Set up repository", description: "Monorepo with backend and frontend", column: "DONE", priority: "LOW" },
  ],
  PERSONAL: [
    { title: "Read Clean Code", description: "Work through at least one chapter per week", column: "TODO", priority: "LOW" },
    { title: "Grocery shopping", description: "Milk, eggs, bread, vegetables", column: "TODO", priority: "MEDIUM" },
    { title: "Book dentist appointment", description: "Overdue by 3 months", column: "TODO", priority: "HIGH" },
    { title: "Pay electricity bill", description: "Due end of this month", column: "TODO", priority: "HIGH" },
    { title: "Learn TypeScript", description: "Following the official handbook", column: "IN_PROGRESS", priority: "MEDIUM" },
    { title: "Apartment deep clean", description: "Kitchen and bathroom done, bedroom next", column: "IN_PROGRESS", priority: "LOW" },
    { title: "Cancel unused subscriptions", description: "Saved $40/month", column: "DONE", priority: "LOW" },
  ],
  BUG_TRACKER: [
    { title: "Login page crashes on Safari", description: "Reproducible on iOS 17, affects ~20% of users", column: "TODO", priority: "HIGH" },
    { title: "Password reset email not sent", description: "SMTP config issue in production", column: "TODO", priority: "HIGH" },
    { title: "Dark mode toggle missing", description: "Regression from last deploy", column: "TODO", priority: "MEDIUM" },
    { title: "Typo in onboarding copy", description: "\"Wellcome\" → \"Welcome\" on step 2", column: "TODO", priority: "LOW" },
    { title: "Fix broken image uploads", description: "Files >5MB return 413 in prod but not staging", column: "IN_PROGRESS", priority: "HIGH" },
    { title: "Improve error messages", description: "Generic 500 errors need user-friendly copy", column: "IN_PROGRESS", priority: "MEDIUM" },
    { title: "Fix XSS vulnerability", description: "Sanitize all user inputs — shipped in v1.2", column: "DONE", priority: "HIGH" },
    { title: "Resolve N+1 query on boards", description: "Added .populate() — 10x faster load", column: "DONE", priority: "MEDIUM" },
  ],
};

export const resolvers = {
  Query: {
    me: async (_: unknown, __: unknown, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) return null;
      return User.findById(String(user.userId)).lean();
    },
    boards: async (_: unknown, __: unknown, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Board.find({
        $or: [{ owner: user.userId }, { "collaborators.user": user.userId }],
      }).sort({ createdAt: -1 }).lean();
    },
    board: async (_: unknown, { id }: { id: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(id).lean();
      if (!board) return null;
      const isOwner = String(board.owner) === user.userId;
      const isCollab = board.collaborators?.some((c: any) => String(c.user) === user.userId);
      if (!isOwner && !isCollab) throw new Error("Not authorized");
      return board;
    },
    boardCollaborators: async (_: unknown, { boardId }: { boardId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const isCollab = board.collaborators?.some((c: any) => String(c.user) === user.userId);
      if (!isOwner && !isCollab) throw new Error("Not authorized");
      return board.collaborators || [];
    },
    tasks: async (_: unknown, { boardId }: { boardId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Task.find({ board: boardId }).sort({ order: 1, createdAt: 1 }).lean();
    },

    comments: async (_: unknown, { taskId }: { taskId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Comment.find({ task: taskId }).sort({ createdAt: 1 }).lean();
    },

    activityLog: async (_: unknown, { boardId }: { boardId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return ActivityLog.find({ board: boardId }).sort({ createdAt: -1 }).limit(50).lean();
    },

    boardLabels: async (_: unknown, { boardId }: { boardId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Label.find({ board: boardId }).lean();
    },

    myNotifications: async (_: unknown, __: unknown, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Notification.find({ user: user.userId }).sort({ createdAt: -1 }).limit(20).lean();
    },

    taskAttachments: async (_: unknown, { taskId }: { taskId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      return Attachment.find({ task: taskId }).sort({ createdAt: -1 }).lean();
    },
  },

  Mutation: {
    register: async (_: unknown, { email, password, name }: { email: string; password: string; name: string }) => {
      const existing = await User.findOne({ email }).lean();
      if (existing) throw new Error("Email already in use");
      const user = await User.create({ email, password, name });
      const plain = await User.findById(user._id).lean();
      const token = signToken(String(user._id));
      return { token, user: plain };
    },

    login: async (_: unknown, { email, password }: { email: string; password: string }) => {
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        throw new Error("Invalid credentials");
      }
      const token = signToken(String(user._id));
      const plain = await User.findById(user._id).lean();
      return { token, user: plain };
    },

    createBoard: async (_: unknown, { name }: { name: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.create({ name, owner: user.userId });
      const plain = await Board.findById(board._id).lean();
      pubsub.publish(`BOARD_CREATED_${user.userId}`, { boardCreated: plain });
      return plain;
    },

    createBoardFromTemplate: async (
      _: unknown,
      { name, template }: { name: string; template: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const tasks = TEMPLATES[template];
      if (!tasks) throw new Error("Unknown template");
      const board = await Board.create({ name, owner: user.userId });
      await Task.insertMany(tasks.map((t, i) => ({ ...t, board: board._id, order: i })));
      const plain = await Board.findById(board._id).lean();
      pubsub.publish(`BOARD_CREATED_${user.userId}`, { boardCreated: plain });
      const actor = await User.findById(user.userId).lean();
      const templateLabel = template.charAt(0) + template.slice(1).toLowerCase().replace("_", " ");
      await logActivity(pubsub, String(board._id), user.userId, `${(actor as any).name} created board from ${templateLabel} template`);
      return plain;
    },

    deleteBoard: async (_: unknown, { id }: { id: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      await Board.findOneAndDelete({ _id: id, owner: user.userId });
      await Task.deleteMany({ board: id });
      pubsub.publish(`BOARD_DELETED_${user.userId}`, { boardDeleted: id });
      return true;
    },

    inviteCollaborator: async (
      _: unknown,
      { boardId, email, role }: { boardId: string; email: string; role: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      if (String(board.owner) !== user.userId) throw new Error("Not authorized");
      const target = await User.findOne({ email }).lean();
      if (!target) throw new Error("User not found");
      if (String(target._id) === user.userId) throw new Error("You are already the owner");
      const alreadyCollab = board.collaborators?.some((c: any) => String(c.user) === String(target._id));
      if (alreadyCollab) throw new Error("Already a collaborator");
      const updated = await Board.findByIdAndUpdate(
        boardId,
        { $push: { collaborators: { user: target._id, role } } },
        { returnDocument: "after" }
      ).lean();
      pubsub.publish(`COLLABS_CHANGED_${String(target._id)}`, { collaboratorsChanged: boardId });
      const actor = await User.findById(user.userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} invited ${(target as any).name} as ${role.toLowerCase()}`);
      return updated;
    },

    removeCollaborator: async (
      _: unknown,
      { boardId, userId }: { boardId: string; userId: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      if (String(board.owner) !== user.userId) throw new Error("Not authorized");
      const updated = await Board.findByIdAndUpdate(
        boardId,
        { $pull: { collaborators: { user: userId } } },
        { returnDocument: "after" }
      ).lean();
      pubsub.publish(`COLLABS_CHANGED_${userId}`, { collaboratorsChanged: boardId });
      const actor = await User.findById(user.userId).lean();
      const removed = await User.findById(userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} removed ${(removed as any)?.name || "a collaborator"}`);
      return updated;
    },

    createTask: async (
      _: unknown,
      { boardId, title, description, column, dueDate, priority, labelIds }: { boardId: string; title: string; description?: string; column?: string; dueDate?: string; priority?: string; labelIds?: string[] },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      const count = await Task.countDocuments({ board: boardId });
      const task = await Task.create({
        title,
        description,
        column: column || "TODO",
        board: boardId,
        order: count,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority || "MEDIUM",
        labels: labelIds || [],
      });
      const plain = await Task.findById(task._id).lean();
      pubsub.publish(`TASK_CREATED_${boardId}`, { taskCreated: plain });
      const actor = await User.findById(user.userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} created "${title}"`);
      return plain;
    },

    moveTask: async (
      _: unknown,
      { taskId, column }: { taskId: string; column: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const existingTask = await Task.findById(taskId).lean();
      if (!existingTask) throw new Error("Task not found");
      const board = await Board.findById(String(existingTask.board)).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      const task = await Task.findByIdAndUpdate(taskId, { column }, { returnDocument: "after" }).lean();
      if (!task) throw new Error("Task not found");
      const boardId = String(task.board);
      pubsub.publish(`TASK_MOVED_${boardId}`, { taskMoved: task });
      const actor = await User.findById(user.userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} moved "${(task as any).title}" to ${COLUMN_LABELS[column] || column}`);
      if (column === "DONE" && (task as any).assignee && String((task as any).assignee) !== user.userId) {
        await notify(pubsub, String((task as any).assignee), `"${(task as any).title}" was moved to Done`, boardId);
      }
      if ((existingTask as any).assignedBy && String((existingTask as any).assignee) === user.userId && String((existingTask as any).assignedBy) !== user.userId) {
        await notify(pubsub, String((existingTask as any).assignedBy), `${(actor as any).name} moved "${(task as any).title}" to ${COLUMN_LABELS[column] || column}`, boardId);
      }
      return task;
    },

    updateTask: async (
      _: unknown,
      { taskId, title, description, dueDate, assigneeId, priority, labelIds }: { taskId: string; title?: string; description?: string; dueDate?: string; assigneeId?: string; priority?: string; labelIds?: string[] },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const existingTask = await Task.findById(taskId).lean();
      if (!existingTask) throw new Error("Task not found");
      const board = await Board.findById(String(existingTask.board)).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      const update: Record<string, any> = {};
      if (title) update.title = title;
      if (description !== undefined) update.description = description;
      if (dueDate !== undefined) update.dueDate = dueDate ? new Date(dueDate) : null;
      if (assigneeId !== undefined) {
        update.assignee = assigneeId || null;
        update.assignedBy = assigneeId ? user.userId : null;
      }
      if (priority !== undefined) update.priority = priority;
      if (labelIds !== undefined) update.labels = labelIds;
      const task = await Task.findByIdAndUpdate(taskId, update, { returnDocument: "after" }).lean();
      if (!task) throw new Error("Task not found");
      const boardId = String(task.board);
      pubsub.publish(`TASK_UPDATED_${boardId}`, { taskUpdated: task });
      const actor = await User.findById(user.userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} updated "${(task as any).title}"`);
      if (assigneeId && assigneeId !== user.userId && assigneeId !== String((existingTask as any).assignee)) {
        await notify(pubsub, assigneeId, `${(actor as any).name} assigned you to "${(task as any).title}"`, boardId);
      }
      if (priority && priority !== (existingTask as any).priority && (task as any).assignee && String((task as any).assignee) !== user.userId) {
        await notify(pubsub, String((task as any).assignee), `${(actor as any).name} changed priority of "${(task as any).title}" to ${priority}`, boardId);
      }
      return task;
    },

    deleteTask: async (_: unknown, { taskId }: { taskId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const existingTask = await Task.findById(taskId).lean();
      if (!existingTask) throw new Error("Task not found");
      const board = await Board.findById(String(existingTask.board)).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      const task = await Task.findByIdAndDelete(taskId);
      if (!task) throw new Error("Task not found");
      const boardId = String(task.board);
      pubsub.publish(`TASK_DELETED_${boardId}`, { taskDeleted: taskId });
      const actor = await User.findById(user.userId).lean();
      await logActivity(pubsub, boardId, user.userId, `${(actor as any).name} deleted "${(existingTask as any).title}"`);
      return true;
    },

    addComment: async (
      _: unknown,
      { taskId, text }: { taskId: string; text: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const task = await Task.findById(taskId).lean();
      if (!task) throw new Error("Task not found");
      const boardId = String(task.board);
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const isCollab = board.collaborators?.some((c: any) => String(c.user) === user.userId);
      if (!isOwner && !isCollab) throw new Error("Not authorized");
      const comment = await Comment.create({ task: taskId, board: boardId, author: user.userId, text });
      const plain = await Comment.findById(comment._id).lean();
      pubsub.publish(`COMMENT_ADDED_${boardId}`, { commentAdded: plain });
      const actor = await User.findById(user.userId).lean();
      if ((task as any).assignedBy && String((task as any).assignee) === user.userId && String((task as any).assignedBy) !== user.userId) {
        await notify(pubsub, String((task as any).assignedBy), `${(actor as any).name} commented on "${(task as any).title}"`, boardId);
      }
      return plain;
    },

    deleteComment: async (
      _: unknown,
      { commentId }: { commentId: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const comment = await Comment.findById(commentId).lean();
      if (!comment) throw new Error("Comment not found");
      if (String(comment.author) !== user.userId) throw new Error("Not authorized");
      await Comment.findByIdAndDelete(commentId);
      return true;
    },

    deleteAttachment: async (_: unknown, { attachmentId }: { attachmentId: string }, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const attachment = await Attachment.findById(attachmentId).lean();
      if (!attachment) throw new Error("Attachment not found");
      if (String(attachment.uploader) !== user.userId) throw new Error("Not authorized");
      await cloudinary.uploader.destroy(attachment.publicId);
      await Attachment.findByIdAndDelete(attachmentId);
      return true;
    },

    markNotificationsRead: async (_: unknown, __: unknown, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      await Notification.updateMany({ user: user.userId, read: false }, { $set: { read: true } });
      return true;
    },

    createLabel: async (
      _: unknown,
      { boardId, name, color }: { boardId: string; name: string; color: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const board = await Board.findById(boardId).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      const label = await Label.create({ board: boardId, name, color });
      pubsub.publish(`LABEL_CHANGED_${boardId}`, { labelChanged: boardId });
      return Label.findById(label._id).lean();
    },

    deleteLabel: async (
      _: unknown,
      { labelId }: { labelId: string },
      { token }: { token?: string }
    ) => {
      const user = getUser(token);
      if (!user) throw new Error("Not authenticated");
      const label = await Label.findById(labelId).lean();
      if (!label) throw new Error("Label not found");
      const board = await Board.findById(String(label.board)).lean();
      if (!board) throw new Error("Board not found");
      const isOwner = String(board.owner) === user.userId;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      if (!isOwner && collab?.role !== "EDITOR") throw new Error("Not authorized");
      await Label.findByIdAndDelete(labelId);
      await Task.updateMany({ board: label.board }, { $pull: { labels: label._id } });
      pubsub.publish(`LABEL_CHANGED_${String(label.board)}`, { labelChanged: String(label.board) });
      return true;
    },
  },

  Subscription: {
    taskCreated: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`TASK_CREATED_${boardId}`),
    },
    taskMoved: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`TASK_MOVED_${boardId}`),
    },
    taskDeleted: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`TASK_DELETED_${boardId}`),
    },
    taskUpdated: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`TASK_UPDATED_${boardId}`),
    },
    boardCreated: {
      subscribe: (_: unknown, { ownerId }: { ownerId: string }) =>
        pubsubAny.asyncIterableIterator(`BOARD_CREATED_${ownerId}`),
    },
    boardDeleted: {
      subscribe: (_: unknown, { ownerId }: { ownerId: string }) =>
        pubsubAny.asyncIterableIterator(`BOARD_DELETED_${ownerId}`),
    },
    collaboratorsChanged: {
      subscribe: (_: unknown, { userId }: { userId: string }) =>
        pubsubAny.asyncIterableIterator(`COLLABS_CHANGED_${userId}`),
    },
    commentAdded: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`COMMENT_ADDED_${boardId}`),
    },
    activityAdded: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`ACTIVITY_ADDED_${boardId}`),
    },
    labelChanged: {
      subscribe: (_: unknown, { boardId }: { boardId: string }) =>
        pubsubAny.asyncIterableIterator(`LABEL_CHANGED_${boardId}`),
    },
    notificationAdded: {
      subscribe: (_: unknown, { userId }: { userId: string }) =>
        pubsubAny.asyncIterableIterator(`NOTIFICATION_${userId}`),
    },
  },

  Board: {
    id: (board: any) => String(board._id),
    owner: (board: any) => User.findOne({ _id: String(board.owner) }).lean().exec(),
    collaborators: (board: any) => board.collaborators || [],
    myRole: (board: any, _: any, { token }: { token?: string }) => {
      const user = getUser(token);
      if (!user) return null;
      const collab = board.collaborators?.find((c: any) => String(c.user) === user.userId);
      return collab ? collab.role : null;
    },
    createdAt: (board: any) => new Date(board.createdAt).toISOString(),
  },

  Collaborator: {
    user: (collab: any) => User.findById(String(collab.user)).lean().exec(),
    role: (collab: any) => collab.role,
  },

  Task: {
    id: (task: any) => String(task._id),
    board: (task: any) => Board.findOne({ _id: String(task.board) }).lean().exec(),
    assignee: (task: any) => task.assignee ? User.findOne({ _id: String(task.assignee) }).lean().exec() : null,
    dueDate: (task: any) => (task.dueDate ? new Date(task.dueDate).toISOString() : null),
    priority: (task: any) => task.priority || "MEDIUM",
    labels: (task: any) => task.labels?.length ? Label.find({ _id: { $in: task.labels } }).lean().exec() : [],
    createdAt: (task: any) => new Date(task.createdAt).toISOString(),
  },

  Label: {
    id: (l: any) => String(l._id),
  },

  ActivityEntry: {
    id: (e: any) => String(e._id),
    user: (e: any) => User.findById(String(e.user)).lean().exec(),
    createdAt: (e: any) => new Date(e.createdAt).toISOString(),
  },

  Comment: {
    id: (c: any) => String(c._id),
    task: (c: any) => String(c.task),
    author: (c: any) => User.findById(String(c.author)).lean().exec(),
    createdAt: (c: any) => new Date(c.createdAt).toISOString(),
  },

  Attachment: {
    id: (a: any) => String(a._id),
    task: (a: any) => String(a.task),
    uploader: (a: any) => User.findById(String(a.uploader)).lean().exec(),
    createdAt: (a: any) => new Date(a.createdAt).toISOString(),
  },

  Notification: {
    id: (n: any) => String(n._id),
    createdAt: (n: any) => new Date(n.createdAt).toISOString(),
  },

  User: {
    id: (user: any) => String(user._id),
  },
};
