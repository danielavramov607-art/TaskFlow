# TaskFlow — Improvement Roadmap

A prioritized plan to expand the project from a solid portfolio piece into a more complete product. Items are ordered by complexity within each tier.

---

## Tier 1 — Quick Wins (1-2 days each)

These fill obvious gaps and are easy interview talking points.

- [x] **Drag & drop tasks** — replace ← → arrows with actual drag-and-drop using `dnd-kit`. Immediately visible UX improvement, shows frontend skill.
- [x] **Task due dates** — add a date field to tasks, highlight overdue tasks in red on the board.
- [x] **Task priority** — Low / Medium / High enum, color-coded badge on each task card.
- [x] **Search & filter** — filter tasks by title or priority within a board.
- [x] **Basic tests** — Jest unit tests on GraphQL resolvers (auth, createTask, moveTask). Shows professionalism.

---

## Tier 2 — Medium Features (3-5 days each)

These meaningfully expand the app's scope and make it feel like a real product.

- [x] **Board sharing / collaborators** — invite users by email, assign viewer or editor roles. Activates the real-time infra for actual multi-user use.
- [x] **Task comments** — threaded comments per task stored in MongoDB, broadcast in real-time via subscriptions.
- [x] **Activity log** — per-board log of actions ("Daniel moved X to Done"), stored and displayed in a sidebar.
- [x] **Labels / tags** — color-tagged categories on tasks, filterable per board.

---

## Tier 3 — Bigger Features (1+ week each)

These would significantly differentiate the project and demonstrate senior-adjacent thinking.

- [x] **In-app notifications** — bell icon, notify assignees when a task is assigned or moved to Done.
- [x] **File attachments** — upload images or files to tasks via Cloudinary or S3.
- [x] **OAuth login** — Google sign-in via Passport.js or Auth0 alongside existing email/password.
- [x] **Board templates** — starter boards (Sprint, Personal, Bug Tracker) with pre-filled columns and example tasks.

---

## Implementation Order

| # | Feature | Tier | Status |
|---|---|---|---|
| 1 | Drag & drop tasks | Quick Win | ✅ done |
| 2 | Task due dates | Quick Win | ✅ done |
| 3 | Task priority | Quick Win | ✅ done |
| 4 | Search & filter | Quick Win | ✅ done |
| 5 | Basic tests | Quick Win | ✅ done |
| 6 | Board collaborators | Medium | ✅ done |
| 7 | Task comments | Medium | ✅ done |
| 8 | Activity log | Medium | ✅ done |
| 9 | Labels / tags | Medium | ✅ done |
| 10 | Notifications | Big | ✅ done |
| 11 | File attachments | Big | ✅ done |
| 12 | OAuth login | Big | ✅ done |
| 13 | Board templates | Big | ✅ done |

---

## Progress Notes

### Activity log (done)
- Separate `ActivityLog` collection with pre-formatted `text` string — simpler than storing structured action/target fields and formatting on the frontend.
- `logActivity()` helper centralizes creation + pubsub publish to avoid repetition across mutations.
- Capped at 50 entries per query (newest-first) to keep the sidebar fast.
- `activityAdded(boardId)` subscription means all users on a board see actions in real time.
- Collapsible sidebar with sticky positioning — stays visible while scrolling the task columns.

### Task comments (done)
- Separate `Comment` collection referencing both task and board — board ref avoids an extra lookup when publishing the subscription.
- Any board member (owner, editor, viewer) can read and post comments — read-only mode only blocks task edits, not discussion.
- Only the comment author can delete their own comment (checked server-side).
- `commentAdded(boardId)` subscription fires for all users on the same board, so comments appear live in any open modal.
- Enter key submits (Shift+Enter for newline), same UX pattern as most chat tools.

### Board templates (done)
- Templates hardcoded in backend resolver as a constant — no DB collection needed, templates are static config not user data.
- `createBoardFromTemplate` mutation creates the board + batch-inserts all tasks via `Task.insertMany()` in one operation.
- Three templates: Sprint Board (dev team workflow), Personal Kanban (everyday tasks), Bug Tracker (QA/dev focused with priority mix).
- Each task has title, description, column, and priority — no due dates or assignees since those would be meaningless on a fresh board.
- Frontend: "▸ Or start from a template" toggle below the create form shows 3 cards. Board name is pre-filled but editable before creating.
- Created boards behave identically to manually created boards — all features work normally.

### OAuth / Google login (done)
- Passport.js with `passport-google-oauth20` strategy — industry standard, well-understood in interviews.
- User model: `password` made optional, `googleId` field added. Existing email/password users are unaffected.
- Account linking: if a Google email matches an existing account, `googleId` is attached to it — no duplicate users.
- Flow: "Continue with Google" → `GET /auth/google` → Google → `GET /auth/google/callback` → JWT signed → redirect to frontend with `?token=...` → `useEffect` picks it up and logs in.
- No session needed — stays stateless JWT, same as email/password auth.
- Frontend: Google button added below the login/register form with the official Google SVG logo.

### File attachments (done)
- Separate `Attachment` collection storing Cloudinary URL, publicId (needed for deletion), filename, fileType, uploader, and task reference.
- Upload goes through a dedicated REST endpoint (`POST /upload/:taskId`) using `multer` + `multer-storage-cloudinary` — GraphQL doesn't handle multipart well.
- Delete removes from both Cloudinary (via `cloudinary.uploader.destroy`) and MongoDB atomically.
- Only the uploader can delete their own attachment (checked server-side).
- Frontend: 📎 button on each task card opens an attachment panel (same pattern as comments modal). Images show as thumbnails with click-to-open, other files as download links.
- Max file size: 10 MB. Allowed formats: jpg, png, gif, webp, pdf, doc, docx, txt.
- Files stored in the `taskflow` Cloudinary folder for easy management.

### In-app notifications (done)
- Separate `Notification` collection per user — not per-board, since notifications are personal.
- Two triggers: assigning a task to someone (in `updateTask`), and moving a task to Done when it has an assignee (in `moveTask`). Both skip self-notification.
- `markNotificationsRead` bulk-marks all unread on open — simpler than per-item read state.
- Bell shows red badge with unread count; count clears immediately when dropdown is opened.
- Real-time: `notificationAdded(userId)` subscription fires instantly when another user triggers a notification for you.
- Dropdown is absolute-positioned below the bell (not a modal) — stays accessible while the board is visible.

### Labels / tags (done)
- Labels stored in a separate `Label` collection scoped to board — allows per-board customization without interference between boards.
- Tasks store an array of label ObjectIds; field resolver populates full label objects for the GraphQL response.
- Label creation and deletion live inside the edit task modal — accessible to owners and editors, hidden for viewers.
- Deleting a label automatically removes it from all tasks on the board via `Task.updateMany({ $pull: { labels: labelId } })`.
- Color-coded filter bar in the toolbar (only shown when labels exist) — filters tasks in real time, stacked below the priority row.
- Label badges render on task cards as thin colored-border chips, keeping the card compact.

### Board collaborators (done)
- Chose "invite by registered email only" — no invite tokens or email sending needed, keeps it simple.
- Added `collaborators: [{ user, role }]` array directly on the Board model (no separate collection).
- `myRole` is a GraphQL field resolver that reads the token from context — returns `null` for owners, `VIEWER`/`EDITOR` for collaborators.
- Viewers are blocked at three layers: backend resolver throws "Not authorized", drag-and-drop silently cancelled in `handleDragEnd`, and all write UI is hidden.
- Switched from `localStorage` to `sessionStorage` so two browser tabs can be logged in as different users simultaneously — useful for testing real-time features.
- Real-time removal: added `collaboratorsChanged(userId)` subscription so User B's dashboard updates instantly when they are invited or removed.
