# TaskFlow

A real-time collaborative task board built to showcase a full modern web stack. Think mini Linear/Trello — create boards, manage tasks across columns, and see every change reflected live across all connected clients without refreshing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Styling | Inline styles (dark theme) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| GraphQL Client | Apollo Client v4 |
| Real-time (client) | graphql-ws + GraphQLWsLink |
| Backend | Node.js + Express |
| GraphQL Server | Apollo Server v5 |
| Real-time (server) | graphql-ws WebSocket server |
| Database | MongoDB via Mongoose |
| Auth | JWT + bcryptjs + Google OAuth (Passport.js) |
| File Storage | Cloudinary |
| Containerization | Docker + Docker Compose |

---

## Features

### Authentication
- Register and login with email + password
- **Google OAuth** — "Continue with Google" button, accounts linked by email
- Passwords hashed with bcryptjs (salt rounds: 12) — never stored in plaintext
- JWT token (7-day expiry), stored in `sessionStorage` for per-tab isolation
- Token sent with every GraphQL request via Authorization header

### Boards
- Create and delete boards
- **Board templates** — start instantly from Sprint, Personal Kanban, or Bug Tracker templates with pre-filled tasks
- Boards list updates in real time across all tabs (WebSocket subscription)

### Collaboration
- **Invite collaborators** by registered email with VIEWER or EDITOR role
- Owners: full control — create, edit, delete tasks, manage collaborators
- Editors: create, edit, delete, and move tasks
- Viewers: read-only — can browse, comment, and view attachments, but cannot modify tasks
- Role enforcement at three layers: backend resolver, drag-and-drop handler, and UI
- Real-time collaborator add/remove — dashboard updates instantly for all affected users

### Task Board
- Three fixed columns: **To Do → In Progress → Done**
- Create tasks in any column
- **Drag and drop** tasks between columns using @dnd-kit — visual drop zone indicator on hover
- Edit task title, description, due date, assignee, priority, and labels via modal
- Delete tasks
- **Task due dates** — optional due date shown as a badge (cyan if upcoming, red if overdue)
- **Task priority** — Low / Medium / High, color-coded badge on each card
- **Task assignee** — assign any board member to a task, shown as an avatar + name
- **Search & filter** — filter tasks by title (search), priority, or label in real time
- All changes broadcast instantly to every connected client via GraphQL Subscriptions over WebSocket

### Labels / Tags
- Create color-coded labels per board (6 preset colors)
- Attach multiple labels to any task via the edit modal
- Labels shown as badges on task cards
- Filter the board by label using the toolbar
- Deleting a label automatically removes it from all tasks
- Real-time: label changes broadcast to all users on the board

### Comments
- Threaded comments per task
- Any board member (including viewers) can post comments
- Authors can delete their own comments
- Real-time: new comments appear instantly for all users viewing the same task

### Activity Log
- Per-board sidebar showing a live feed of actions ("Daniel moved X to Done")
- Logs task creation, moves, edits, deletions, and collaborator changes
- Newest-first, capped at 50 entries
- Real-time: new entries appear instantly via subscription

### File Attachments
- Upload images and PDFs to any task (max 10 MB)
- Images shown as thumbnails with click-to-open
- PDFs open in a new browser tab (inline rendering, no download)
- Files stored on Cloudinary under a `taskflow/` folder
- Only the uploader can delete their own attachment

### In-App Notifications
- Bell icon in the header with unread count badge
- Notifications for:
  - Being assigned to a task
  - Assigned task priority changed
  - Assigned task moved to Done
  - Assignee moves your task (notifies the assigner)
  - Assignee comments on your task (notifies the assigner)
- Real-time: notifications arrive instantly via WebSocket subscription
- Mark all as read by opening the bell dropdown

---

## Architecture

```
TaskFlow/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.ts           — Mongoose schema, bcrypt hashing, googleId field
│   │   │   ├── Board.ts          — Board schema (name, owner, collaborators with roles)
│   │   │   ├── Task.ts           — Task schema (title, description, column, assignee, assignedBy, dueDate, priority, labels, order)
│   │   │   ├── Comment.ts        — Per-task comments (task, board, author, text)
│   │   │   ├── ActivityLog.ts    — Per-board activity entries (board, user, text)
│   │   │   ├── Label.ts          — Per-board labels (board, name, color)
│   │   │   ├── Attachment.ts     — Task file attachments (task, uploader, url, publicId, filename, fileType)
│   │   │   └── Notification.ts   — Per-user notifications (user, text, boardId, read)
│   │   ├── graphql/
│   │   │   ├── typeDefs.ts       — GraphQL schema (types, queries, mutations, subscriptions)
│   │   │   └── resolvers.ts      — All resolver logic + PubSub publish/subscribe
│   │   └── index.ts              — Express + Apollo Server + WebSocket + Passport OAuth + Cloudinary upload route
│   ├── .env                      — Environment variables
│   ├── Dockerfile
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── apollo.ts             — Apollo Client setup (HTTP + WS split link)
│   │   ├── gql.ts                — All GraphQL queries, mutations, subscriptions
│   │   ├── App.tsx               — Root component, auth + routing state
│   │   └── components/
│   │       ├── Auth.tsx          — Login / Register form + Google OAuth button
│   │       ├── Dashboard.tsx     — Boards list with templates and real-time subscriptions
│   │       └── Board.tsx         — Full board: drag & drop, columns, comments, labels, attachments, notifications, activity log
│   └── Dockerfile
├── ROADMAP.md                    — Feature roadmap and implementation notes
└── docker-compose.yml            — frontend + backend + MongoDB (one command setup)
```

---

## GraphQL API

### Queries
| Query | Description |
|---|---|
| `me` | Get current authenticated user |
| `boards` | Get all boards owned by or shared with current user |
| `board(id)` | Get a single board |
| `boardCollaborators(boardId)` | Get all collaborators on a board |
| `tasks(boardId)` | Get all tasks for a board |
| `comments(taskId)` | Get all comments on a task |
| `activityLog(boardId)` | Get last 50 activity entries for a board |
| `boardLabels(boardId)` | Get all labels for a board |
| `taskAttachments(taskId)` | Get all file attachments for a task |
| `myNotifications` | Get last 20 notifications for the current user |

### Mutations
| Mutation | Description |
|---|---|
| `register(email, password, name)` | Create account, returns JWT |
| `login(email, password)` | Login, returns JWT |
| `createBoard(name)` | Create a new blank board |
| `createBoardFromTemplate(name, template)` | Create a board pre-filled from SPRINT / PERSONAL / BUG_TRACKER template |
| `deleteBoard(id)` | Delete a board and all its tasks |
| `inviteCollaborator(boardId, email, role)` | Invite a user as VIEWER or EDITOR |
| `removeCollaborator(boardId, userId)` | Remove a collaborator from a board |
| `createTask(boardId, title, ...)` | Create a task with optional description, column, dueDate, priority, labelIds |
| `moveTask(taskId, column)` | Move task to a different column |
| `updateTask(taskId, ...)` | Edit task title, description, dueDate, assigneeId, priority, labelIds |
| `deleteTask(taskId)` | Delete a task |
| `createLabel(boardId, name, color)` | Create a color-coded label for a board |
| `deleteLabel(labelId)` | Delete a label and remove it from all tasks |
| `addComment(taskId, text)` | Post a comment on a task |
| `deleteComment(commentId)` | Delete your own comment |
| `deleteAttachment(attachmentId)` | Delete your own file attachment (also removes from Cloudinary) |
| `markNotificationsRead` | Mark all unread notifications as read |

### Subscriptions (Real-time)
| Subscription | Trigger |
|---|---|
| `taskCreated(boardId)` | New task added to a board |
| `taskMoved(boardId)` | Task moved between columns |
| `taskUpdated(boardId)` | Task edited |
| `taskDeleted(boardId)` | Task deleted |
| `boardCreated(ownerId)` | New board created |
| `boardDeleted(ownerId)` | Board deleted |
| `collaboratorsChanged(userId)` | User invited to or removed from a board |
| `commentAdded(boardId)` | New comment posted on any task in a board |
| `activityAdded(boardId)` | New activity log entry for a board |
| `labelChanged(boardId)` | Label created or deleted on a board |
| `notificationAdded(userId)` | New notification for the current user |

### REST Endpoints
| Endpoint | Description |
|---|---|
| `POST /upload/:taskId` | Upload a file attachment (multipart/form-data, requires Authorization header) |
| `GET /auth/google` | Initiate Google OAuth flow |
| `GET /auth/google/callback` | Google OAuth callback — issues JWT and redirects to frontend |

---

## Running Locally

### Prerequisites
- Node.js 18+
- Docker Desktop (for MongoDB)
- A Cloudinary account (free tier) and a Google OAuth 2.0 client

### 1. Start MongoDB
```bash
docker run -d --name taskflow-mongo -p 27017:27017 mongo:7
```

### 2. Configure environment variables
Create `backend/.env`:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/taskflow
JWT_SECRET=your_strong_secret_here
CLIENT_URL=http://localhost:3002
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

For Google OAuth, add `http://localhost:4000/auth/google/callback` as an authorized redirect URI in Google Cloud Console.

### 3. Start the backend
```bash
cd backend
npm install
npm run dev
```

### 4. Start the frontend
```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3002` (or whichever port React picks).

### Or run everything with Docker Compose
```bash
docker-compose up
```
