import { resolvers } from "../graphql/resolvers";
import { connect, clearDB, disconnect } from "./setup";

const mut = resolvers.Mutation as any;
const qry = resolvers.Query as any;

async function registerAndGetCtx() {
  const result = await mut.register({}, { email: "daniel@test.com", password: "password123", name: "Daniel" }, { token: undefined });
  return { token: `Bearer ${result.token}` };
}

beforeAll(async () => await connect());
afterEach(async () => await clearDB());
afterAll(async () => await disconnect());

// ─── CREATE BOARD ─────────────────────────────────────────────────────────────

describe("createBoard", () => {
  it("creates a board and returns it", async () => {
    const ctx = await registerAndGetCtx();
    const board = await mut.createBoard({}, { name: "My Sprint" }, ctx) as any;

    expect(board).toBeDefined();
    expect(board.name).toBe("My Sprint");
  });

  it("throws if not authenticated", async () => {
    await expect(
      mut.createBoard({}, { name: "My Sprint" }, { token: undefined })
    ).rejects.toThrow("Not authenticated");
  });
});

// ─── DELETE BOARD ─────────────────────────────────────────────────────────────

describe("deleteBoard", () => {
  it("deletes the board and returns true", async () => {
    const ctx = await registerAndGetCtx();
    const board = await mut.createBoard({}, { name: "To Delete" }, ctx) as any;

    const result = await mut.deleteBoard({}, { id: String(board._id) }, ctx);

    expect(result).toBe(true);
  });

  it("also deletes all tasks belonging to that board", async () => {
    const ctx = await registerAndGetCtx();
    const board = await mut.createBoard({}, { name: "Board With Tasks" }, ctx) as any;
    const boardId = String(board._id);

    await mut.createTask({}, { boardId, title: "Task 1", column: "TODO" }, ctx);
    await mut.createTask({}, { boardId, title: "Task 2", column: "TODO" }, ctx);

    await mut.deleteBoard({}, { id: boardId }, ctx);

    const tasks = await qry.tasks({}, { boardId }, ctx) as any[];
    expect(tasks.length).toBe(0);
  });
});
