'use client'

import { Zap, Layers, Lock, Share2 } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Crystal-clear video with minimal latency. Experience real-time conversations like never before.'
  },
  {
    icon: Layers,
    title: 'Effortless Setup',
    description: 'No complex configurations. Create a room or join with a code in seconds. That\'s it.'
  },
  {
    icon: Lock,
    title: 'Your Privacy Matters',
    description: 'End-to-end encrypted by default. Your conversations stay between you and your participants.'
  },
  {
    icon: Share2,
    title: 'Easy Sharing',
    description: 'Share room codes with anyone. Host controls who joins and maintains session security.'
  }
]

export default function FeaturesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Why Choose Syncora?
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Built for simplicity and performance. Everything you need for exceptional video communication.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="group relative p-6 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 hover:border-blue-500/50 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-purple-600/0 group-hover:from-blue-600/5 group-hover:to-purple-600/5 transition-all duration-300 pointer-events-none"></div>

                {/* Content */}
                <div className="relative z-10">
                  <div className="mb-4 inline-block p-3 bg-blue-600/20 rounded-lg group-hover:bg-blue-600/30 transition-colors duration-300">
                    <Icon className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 text-sm group-hover:text-zinc-300 transition-colors duration-300">
                    {feature.description}
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