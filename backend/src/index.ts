import "dotenv/config";
import { createServer } from "http";
import { ApolloServer, HeaderMap } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useServer } = require("graphql-ws/use/ws");
import { WebSocketServer } from "ws";
import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { json } from "body-parser";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import * as jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Attachment from "./models/Attachment";
import User from "./models/User";
import { typeDefs } from "./graphql/typeDefs";
import { resolvers } from "./graphql/resolvers";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CALLBACK_URL = `${process.env.BACKEND_URL || "http://localhost:4000"}/auth/google/callback`;
console.log("OAuth callbackURL:", CALLBACK_URL);

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: CALLBACK_URL,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("No email from Google"));
      let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
      if (user) {
        if (!user.googleId) { user.googleId = profile.id; await user.save(); }
      } else {
        user = await User.create({ email, name: profile.displayName, googleId: profile.id });
      }
      return done(null, user);
    } catch (err) {
      return done(err as Error);
    }
  }
));

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "taskflow",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "pdf"],
  } as any,
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/taskflow";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", process.env.CLIENT_URL || ""].filter(Boolean),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  }));
  app.use(json());
  app.use(passport.initialize());

  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

  app.get("/auth/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL || "http://localhost:3002"}/login?error=oauth_failed` }),
    (req: Request, res: Response) => {
      const user = req.user as any;
      const token = jwt.sign({ userId: String(user._id) }, JWT_SECRET, { expiresIn: "7d" });
      res.redirect(`${process.env.CLIENT_URL || "http://localhost:3002"}?token=${token}`);
    }
  );

  const httpServer = createServer(app);

  const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
  const serverCleanup = useServer({ schema }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  const handleGraphQL = async (req: Request, res: Response) => {
    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const result = await apolloServer.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: req.method.toUpperCase(),
        headers,
        search: new URLSearchParams(req.query as Record<string, string>).toString(),
        body: req.body,
      },
      context: async () => ({ token: req.headers.authorization }),
    });

    for (const [key, value] of result.headers) {
      res.setHeader(key, value);
    }
    res.status(result.status ?? 200);
    if (result.body.kind === "complete") {
      res.send(result.body.string);
    }
  };

  app.get("/graphql", handleGraphQL);
  app.post("/graphql", handleGraphQL);

  // File upload endpoint
  app.post("/upload/:taskId", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) { res.status(401).json({ error: "Not authenticated" }); return; }
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      let userId: string;
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch {
        res.status(401).json({ error: "Invalid token" }); return;
      }
      if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
      const file = req.file as any;
      const attachment = await Attachment.create({
        task: new mongoose.Types.ObjectId(req.params.taskId as string),
        uploader: new mongoose.Types.ObjectId(userId as string),
        url: file.path,
        publicId: file.filename,
        filename: file.originalname,
        fileType: file.mimetype,
      });
      const plain = await Attachment.findById((attachment as any)._id).lean();
      res.json(plain);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/graphql`);
    console.log(`WebSocket at ws://localhost:${PORT}/graphql`);
  });
}

main().catch(console.error);
