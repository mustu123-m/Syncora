import JoinForm from "@/components/JoinForm"
import HomepageHero from "@/components/HomepageHero"
import FeaturesSection from "@/components/FeaturesSection"
import HowItWorksSection from "@/components/HowItWorksSection"
import BenefitsSection from "@/components/BenefitsSection"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function Home() {
  const session = await getServerSession(authOptions);
  return (
    <main className="bg-zinc-950 text-white overflow-hidden">
      <HomepageHero />
      <FeaturesSection />
      <HowItWorksSection />
      
      {/* Join Form Section - WITH ID */}
      <section id="join-form" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <JoinForm defaultName={session?.user?.name || ""}/>
        </div>
      </section>

      <BenefitsSection />
    </main>
  )
}