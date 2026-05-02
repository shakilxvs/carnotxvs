import { motion } from 'framer-motion'
import { Activity, Cpu, Calculator, Moon, Sun } from 'lucide-react'
import { useApp } from '../context/AppContext'

const cards = [
  {
    id: 'carnot',
    title: 'Carnot Cycle',
    description: 'Animated PV diagram with live cylinder',
    icon: Activity,
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    accent: '#fed7aa',
  },
  {
    id: 'engine',
    title: 'Carnot Engine',
    description: 'Schematic energy flow visualisation',
    icon: Cpu,
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)',
    accent: '#bfdbfe',
  },
  {
    id: 'math',
    title: 'Math Module',
    description: 'Solve any unknown in the cycle',
    icon: Calculator,
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0369a1 100%)',
    accent: '#99f6e4',
  },
]

export default function LandingPage() {
  const { setCurrentModule, darkMode, setDarkMode } = useApp()

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0f172a] flex flex-col transition-colors duration-300">
      {/* Dark mode toggle */}
      <div className="absolute top-5 right-6 z-10">
        <motion.button
          onClick={() => setDarkMode(!darkMode)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1e293b] shadow-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center pt-20 pb-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-center"
        >
          <h1 className="font-serif text-6xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
            Carnot Universe
          </h1>
          <p className="mt-4 font-sans text-lg text-gray-500 dark:text-gray-400 tracking-wide">
            Thermodynamics, visualised.
          </p>
        </motion.div>
      </div>

      {/* Cards */}
      <div className="flex-1 flex items-start justify-center px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.button
                key={card.id}
                onClick={() => setCurrentModule(card.id)}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative rounded-3xl overflow-hidden text-left cursor-pointer focus:outline-none"
                style={{
                  background: card.gradient,
                  minHeight: '320px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                }}
              >
                {/* Background texture */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)',
                  }}
                />

                <div className="relative z-10 flex flex-col h-full p-8" style={{ minHeight: '320px' }}>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-auto"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    <Icon size={28} color="white" />
                  </div>

                  <div className="mt-16">
                    <h2 className="font-serif text-3xl font-bold text-white leading-tight">
                      {card.title}
                    </h2>
                    <p className="mt-2 font-sans text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {card.description}
                    </p>
                  </div>
                </div>

                {/* Hover overlay */}
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                />
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Creator branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col items-center gap-3 pb-10"
      >
        <img
          src="https://res.cloudinary.com/dot2ulzin/image/upload/v1774562968/portfolio/media/cajqdnkwotxlmaqqn0uz.jpg"
          alt="Shakil Ahmed"
          className="w-14 h-14 rounded-full object-cover shadow-md"
          style={{ border: '2px solid #f59e0b' }}
        />
        <p className="font-sans text-sm font-medium text-gray-700 dark:text-gray-300">Shakil Ahmed</p>
        <a
          href="https://shakilxvs.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#f59e0b',
            color: '#1a1a1a',
            borderRadius: '999px',
            padding: '4px 14px',
            fontWeight: 600,
            fontSize: '13px',
            textDecoration: 'none',
            display: 'inline-block',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => (e.target.style.background = '#d97706')}
          onMouseLeave={e => (e.target.style.background = '#f59e0b')}
        >
          @shakilxvs
        </a>
      </motion.div>
    </div>
  )
}
