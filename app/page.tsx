import JoinForm from "@/components/JoinForm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions);
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold text-white">VideoApp</h1>
        <p className="text-zinc-400 text-sm">Fast, simple video calls</p>
      </div>
      <JoinForm defaultName={session?.user?.name || ""}/>
    </main>
  )
}