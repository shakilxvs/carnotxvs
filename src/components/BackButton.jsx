import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function BackButton() {
  const { setCurrentModule } = useApp()
  return (
    <motion.button
      onClick={() => setCurrentModule('landing')}
      whileHover={{ x: -3 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
    >
      <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
      <span className="font-sans text-sm font-medium">Back</span>
    </motion.button>
  )
}
