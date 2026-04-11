'use client'

export default function HomepageHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-zinc-950 to-purple-900/20 opacity-60"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Main heading with gradient */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-8 duration-700">
            Syncora
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-xl sm:text-2xl text-zinc-300 mb-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          Crystal-clear video calls, zero complexity
        </p>

        {/* Description */}
        <p className="text-base sm:text-lg text-zinc-400 mb-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          Start instant video meetings with anyone. No accounts needed. No downloads. Just pure, simple video communication.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50">
            Start Meeting
          </button>
          <button className="px-8 py-4 border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold rounded-lg transition-all duration-300 hover:bg-zinc-900/50">
            How It Works
          </button>
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-zinc-500 animate-in fade-in duration-700 delay-500">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>No Registration</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Always Free</span>
          </div>
        </div>
      </div>
    </section>
  )
}
