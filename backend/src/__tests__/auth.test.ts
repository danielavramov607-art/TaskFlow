import { resolvers } from "../graphql/resolvers";
import { connect, clearDB, disconnect } from "./setup";

const mut = resolvers.Mutation as any;
const register = (args: any) => mut.register({}, args, { token: undefined });
const login = (args: any) => mut.login({}, args, { token: undefined });

beforeAll(async () => await connect());
afterEach(async () => await clearDB());
afterAll(async () => await disconnect());

// ─── REGISTER ────────────────────────────────────────────────────────────────

describe("register", () => {
  it("creates a user and returns a token", async () => {
    const result = await register({ email: "daniel@test.com", password: "password123", name: "Daniel" });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect((result.user as any).name).toBe("Daniel");
    expect((result.user as any).email).toBe("daniel@test.com");
  });

  it("hashes the password — never stores plaintext", async () => {
    const result = await register({ email: "daniel@test.com", password: "password123", name: "Daniel" });

    // The stored password must be a bcrypt hash, not the original plaintext
    expect((result.user as any).password).not.toBe("password123");
    expect((result.user as any).password).toMatch(/^\$2b\$/);
  });

  it("throws if email is already registered", async () => {
    await register({ email: "daniel@test.com", password: "password123", name: "Daniel" });

    await expect(
      register({ email: "daniel@test.com", password: "other123", name: "Other" })
    ).rejects.toThrow("Email already in use");
  });
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────

describe("login", () => {
  beforeEach(async () => {
    await register({ email: "daniel@test.com", password: "password123", name: "Daniel" });
  });

  it("returns a token with correct credentials", async () => {
    const result = await login({ email: "daniel@test.com", password: "password123" });

    expect(result.token).toBeDefined();
    expect((result.user as any).email).toBe("daniel@test.com");
  });

  it("throws with wrong password", async () => {
    await expect(
      login({ email: "daniel@test.com", password: "wrongpassword" })
    ).rejects.toThrow("Invalid credentials");
  });

  it("throws with non-existent email", async () => {
    await expect(
      login({ email: "nobody@test.com", password: "password123" })
    ).rejects.toThrow("Invalid credentials");
  });
});
