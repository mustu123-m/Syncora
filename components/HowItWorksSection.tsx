'use client'

import { Plus, Users, Play } from 'lucide-react'

const steps = [
  {
    icon: Plus,
    number: '01',
    title: 'Create or Join',
    description: 'Enter your name and either create a new meeting or join an existing one with a room code.'
  },
  {
    icon: Users,
    number: '02',
    title: 'Share the Code',
    description: 'Invite others by sharing your unique room code. They can join instantly without any downloads.'
  },
  {
    icon: Play,
    number: '03',
    title: 'Start Talking',
    description: 'Once everyone is in, enjoy high-quality, encrypted video communication with minimal lag.'
  }
]

export default function HowItWorksSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-950">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-zinc-400 text-lg">
            Three simple steps to start your video call
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={index} className="relative">
                {/* Connector line (hidden on mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-20 left-[60%] w-[40%] h-0.5 bg-gradient-to-r from-blue-600/50 to-transparent"></div>
                )}

                {/* Step card */}
                <div className="relative bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
                  {/* Step number circle */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/50">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="mb-6 inline-block p-4 bg-blue-600/20 rounded-lg">
                    <Icon className="w-8 h-8 text-blue-400" />
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}