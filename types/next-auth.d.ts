import { DefaultSession } from "next-auth"

// this extends NextAuth's built in types
// telling TypeScript that session.user also has an id field
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]  // keep the existing fields (name, email, image)
  }
}