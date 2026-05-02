import { AnimatePresence } from 'framer-motion'
import { useApp } from './context/AppContext'
import LandingPage from './components/LandingPage'
import CarnotCycleModule from './components/CarnotCycleModule'
import EngineModule from './components/EngineModule'
import MathModule from './components/MathModule'

export default function App() {
  const { currentModule } = useApp()

  return (
    <AnimatePresence mode="wait">
      {currentModule === 'landing' && <LandingPage key="landing" />}
      {currentModule === 'carnot' && <CarnotCycleModule key="carnot" />}
      {currentModule === 'engine' && <EngineModule key="engine" />}
      {currentModule === 'math' && <MathModule key="math" />}
    </AnimatePresence>
  )
}
