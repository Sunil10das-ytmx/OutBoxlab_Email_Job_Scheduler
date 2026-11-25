import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database.js";

export interface GoogleUserPayload {
  googleId: string;
  email: string;
  name: string;
  avatar: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUserPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === "your_google_client_id") {
    throw new Error(
      "GOOGLE_CLIENT_ID is not configured in environment variables. Please provide a valid client ID."
    );
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google account: sub or email missing from payload");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? "",
    avatar: payload.picture ?? "",
  };
}


export async function loginWithGoogle(idToken: string) {
  const googleUser = await verifyGoogleToken(idToken);

  const user = await prisma.user.upsert({
    where: { googleId: googleUser.googleId },
    update: {
      name: googleUser.name,
      avatar: googleUser.avatar,
    },
    create: {
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.avatar,
    },
  });

  const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret";
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: "7d" }
  );

  return {
    user: {
      id: user.id,
      googleId: user.googleId,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    token,
  };
}
