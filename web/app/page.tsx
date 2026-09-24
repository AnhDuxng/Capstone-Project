"use client";

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Homepage } from '@/components/Homepage';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }} suppressHydrationWarning>
      <Header />
      <Homepage />
      <Footer />
    </div>
  );
}
