import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export default async function middleware(req: NextRequest) {
  // getToken reads the JWT from the cookie — returns null if not logged in
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET,secureCookie: true});

  const isLoggedIn = !!token

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/signin") ||
    req.nextUrl.pathname.startsWith("/signup")

  const isApiRoute = req.nextUrl.pathname.startsWith("/api")

  // 🔒 If NOT logged in → block protected pages
  if (!isLoggedIn && !isAuthPage && !isApiRoute) {
    const signInUrl = new URL("/signin", req.nextUrl.origin)
    return NextResponse.redirect(signInUrl)
  }

  // 🚫 If logged in → prevent access to auth pages
  if (isLoggedIn && isAuthPage) {
    const homeUrl = new URL("/", req.nextUrl.origin)
    return NextResponse.redirect(homeUrl)
  }

  // ✅ Always return something
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}