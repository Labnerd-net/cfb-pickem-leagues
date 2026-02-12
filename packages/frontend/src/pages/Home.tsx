import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import HeroSection from '../components/home/HeroSection';
import StatsBar from '../components/home/StatsBar';
import FeaturesSection from '../components/home/FeaturesSection';
import FinalCTA from '../components/home/FinalCTA';
import '../components/home/Home.css';

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', pb: 8 }}>
      <HeroSection isVisible={isVisible} />
      <StatsBar isVisible={isVisible} />
      <FeaturesSection />
      <FinalCTA />
    </Box>
  );
}
