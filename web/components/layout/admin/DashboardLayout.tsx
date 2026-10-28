"use client";

import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AdminAuthGuard from "./AdminAuthGuard";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-64 flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}

