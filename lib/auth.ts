import NextAuth, { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  // PrismaAdapter tells NextAuth to store users in our database
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Email + Password
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string }
        })

        // user doesn't exist
        if (!user || !user.password) return null

        // compare password with stored hash
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) return null

        // return user object — NextAuth stores this in the session
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        }
      }
    })
  ],

  // how sessions work
  session: {
    strategy: "jwt"  // store session in a JWT token, not database
  },

  // customize what goes into the JWT token
  callbacks: {
    async jwt({ token, user }) {
      // when user first signs in, user object exists
      // add their id to the token
      if (user) {
        token.id = user.id
      }
      return token
    },

    async session({ session, token }) {
      // make id available in the session object
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    }
  },

  pages: {
    signIn: "/signin"  // use our custom sign in page
  }
}

export default NextAuth(authOptions)