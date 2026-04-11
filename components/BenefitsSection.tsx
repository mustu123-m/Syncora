'use client'

const benefits = [
  { label: 'Zero Setup', value: 'No servers to configure' },
  { label: 'No Accounts', value: 'Just use your name' },
  { label: 'Ultra-Low Latency', value: 'Real-time communication' },
  { label: 'Encrypted', value: 'End-to-end security' },
  { label: 'Open Source', value: 'Transparent & secure' },
  { label: 'Free Forever', value: 'No hidden costs' }
]

export default function BenefitsSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Everything You Need
          </h2>
          <p className="text-zinc-400 text-lg">
            All the features of expensive platforms. None of the complexity.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="group p-6 bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 border border-zinc-700/50 hover:border-cyan-500/50 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-2 flex-shrink-0 group-hover:w-3 group-hover:h-3 transition-all duration-300"></div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors duration-300">
                    {benefit.label}
                  </h3>
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors duration-300">
                    {benefit.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}