import { resolvers } from "../graphql/resolvers";
import { connect, clearDB, disconnect } from "./setup";

const mut = resolvers.Mutation as any;
const qry = resolvers.Query as any;

async function setupUserAndBoard() {
  const result = await mut.register({}, { email: "daniel@test.com", password: "password123", name: "Daniel" }, { token: undefined });
  const ctx = { token: `Bearer ${result.token}` };
  const board = await mut.createBoard({}, { name: "Test Board" }, ctx) as any;
  return { ctx, boardId: String(board._id) };
}

beforeAll(async () => await connect());
afterEach(async () => await clearDB());
afterAll(async () => await disconnect());

// ─── CREATE TASK ──────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("creates a task with correct fields", async () => {
    const { ctx, boardId } = await setupUserAndBoard();

    const task = await mut.createTask({}, { boardId, title: "Fix login bug", column: "TODO" }, ctx) as any;

    expect(task.title).toBe("Fix login bug");
    expect(task.column).toBe("TODO");
    expect(task.priority).toBe("MEDIUM");
  });

  it("creates a task with custom priority", async () => {
    const { ctx, boardId } = await setupUserAndBoard();

    const task = await mut.createTask({}, { boardId, title: "Critical bug", column: "TODO", priority: "HIGH" }, ctx) as any;

    expect(task.priority).toBe("HIGH");
  });

  it("throws if not authenticated", async () => {
    const { boardId } = await setupUserAndBoard();

    await expect(
      mut.createTask({}, { boardId, title: "Task", column: "TODO" }, { token: undefined })
    ).rejects.toThrow("Not authenticated");
  });

  it("assigns incremental order to tasks", async () => {
    const { ctx, boardId } = await setupUserAndBoard();

    const first = await mut.createTask({}, { boardId, title: "First", column: "TODO" }, ctx) as any;
    const second = await mut.createTask({}, { boardId, title: "Second", column: "TODO" }, ctx) as any;

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });
});

// ─── MOVE TASK ────────────────────────────────────────────────────────────────

describe("moveTask", () => {
  it("moves a task to a different column", async () => {
    const { ctx, boardId } = await setupUserAndBoard();
    const task = await mut.createTask({}, { boardId, title: "Task", column: "TODO" }, ctx) as any;

    const moved = await mut.moveTask({}, { taskId: String(task._id), column: "IN_PROGRESS" }, ctx) as any;

    expect(moved.column).toBe("IN_PROGRESS");
  });
});

// ─── UPDATE TASK ──────────────────────────────────────────────────────────────

describe("updateTask", () => {
  it("updates title and description", async () => {
    const { ctx, boardId } = await setupUserAndBoard();
    const task = await mut.createTask({}, { boardId, title: "Old Title", column: "TODO" }, ctx) as any;

    const updated = await mut.updateTask({}, { taskId: String(task._id), title: "New Title", description: "Some details" }, ctx) as any;

    expect(updated.title).toBe("New Title");
    expect(updated.description).toBe("Some details");
  });

  it("updates priority", async () => {
    const { ctx, boardId } = await setupUserAndBoard();
    const task = await mut.createTask({}, { boardId, title: "Task", column: "TODO" }, ctx) as any;

    const updated = await mut.updateTask({}, { taskId: String(task._id), title: "Task", priority: "HIGH" }, ctx) as any;

    expect(updated.priority).toBe("HIGH");
  });
});

// ─── DELETE TASK ──────────────────────────────────────────────────────────────

describe("deleteTask", () => {
  it("deletes a task and returns true", async () => {
    const { ctx, boardId } = await setupUserAndBoard();
    const task = await mut.createTask({}, { boardId, title: "To Delete", column: "TODO" }, ctx) as any;

    const result = await mut.deleteTask({}, { taskId: String(task._id) }, ctx);

    expect(result).toBe(true);
  });

  it("task no longer appears in the board after deletion", async () => {
    const { ctx, boardId } = await setupUserAndBoard();
    const task = await mut.createTask({}, { boardId, title: "Gone", column: "TODO" }, ctx) as any;

    await mut.deleteTask({}, { taskId: String(task._id) }, ctx);

    const tasks = await qry.tasks({}, { boardId }, ctx) as any[];
    expect(tasks.find((t: any) => String(t._id) === String(task._id))).toBeUndefined();
  });
});
