"use client";

import React from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, User } from "lucide-react";

export default function HolderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, login, logout, user } = usePrivy();

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <ShieldCheck className="h-8 w-8 text-slate-900 dark:text-slate-100" />
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              CertifyChain
            </span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link
              href="/holder"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              Cổng Sinh Viên
            </Link>
            <Link
              href="/v3/verify"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            >
              Xác thực V3
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {authenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[150px] truncate">{user?.email?.address || user?.wallet?.address}</span>
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="flex items-center gap-1">
                  <LogOut className="h-3.5 w-3.5" />
                  Đăng xuất
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={login}>
                Đăng nhập
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 sm:p-8">
        {children}
      </main>
    </div>
  );
}
