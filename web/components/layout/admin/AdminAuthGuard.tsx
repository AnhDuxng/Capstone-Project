"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";
import { checkUserRoleV3, UserRoleV3 } from "@/lib/v3/roles";
import { checkUserRole, UserRole } from "@/lib/roles";
import {
  ShieldCheck,
  Wallet,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const pathname = usePathname();

  const isV3 = pathname.startsWith("/admin/v3");

  const [roleState, setRoleState] = useState<{
    loading: boolean;
    role: UserRole | UserRoleV3 | null;
    error: string | null;
  }>({
    loading: !!(authenticated && wallets && wallets.length > 0),
    role: null,
    error: null,
  });

  const checkRole = useCallback(async () => {
    if (!wallets || wallets.length === 0) return;

    setRoleState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const activeWallet = wallets[0];
      const role = isV3
        ? await checkUserRoleV3(activeWallet as { getEthereumProvider: () => Promise<unknown> })
        : await checkUserRole(activeWallet as { getEthereumProvider: () => Promise<unknown> });
      setRoleState({ loading: false, role, error: null });
    } catch (error) {
      console.error("Error checking admin role:", error);
      setRoleState({
        loading: false,
        role: null,
        error: "Không thể xác minh quyền truy cập. Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
    }
  }, [wallets, isV3]);

  // Trigger role check when authenticated and wallet is available
  useEffect(() => {
    if (!authenticated || !wallets || wallets.length === 0) return;

    let cancelled = false;
    const activeWallet = wallets[0];

    const fetchRole = isV3
      ? checkUserRoleV3(activeWallet as { getEthereumProvider: () => Promise<unknown> })
      : checkUserRole(activeWallet as { getEthereumProvider: () => Promise<unknown> });

    fetchRole
      .then((role) => {
        if (!cancelled) setRoleState({ loading: false, role, error: null });
      })
      .catch((error) => {
        console.error("Error checking admin role:", error);
        if (!cancelled)
          setRoleState({
            loading: false,
            role: null,
            error: "Không thể xác minh quyền truy cập. Vui lòng kiểm tra kết nối mạng và thử lại.",
          });
      });

    return () => { cancelled = true; };
  }, [authenticated, wallets, isV3]);

  // ─── State 1: Privy SDK loading ───
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Đang khởi tạo...</p>
        </div>
      </div>
    );
  }

  // ─── State 2: Not authenticated → Show login gate ───
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-4">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative w-full max-w-md">
          <div className="bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl" />
                <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4">
                  <ShieldCheck className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Đăng nhập Quản trị
            </h1>
            <p className="text-sm text-blue-200/70 text-center mb-8 leading-relaxed">
              Vui lòng kết nối ví Ethereum để xác minh quyền quản trị viên trước khi truy cập dashboard.
            </p>

            {/* Login Button */}
            <Button
              onClick={login}
              className="w-full h-13 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-400/30 hover:-translate-y-0.5 text-base"
            >
              <Wallet className="mr-2.5 h-5 w-5" />
              Kết nối Ví & Đăng nhập
            </Button>

            {/* Separator */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30 font-medium">hoặc</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Back to Home */}
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full text-blue-200/60 hover:text-white hover:bg-white/5 rounded-xl"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại Trang chủ
              </Button>
            </Link>
          </div>

          {/* Hint text */}
          <p className="text-xs text-blue-200/30 text-center mt-6">
            Chỉ những địa chỉ ví đã được phân quyền Admin hoặc Issuer trên smart contract mới có thể truy cập.
          </p>
        </div>
      </div>
    );
  }

  // ─── State 3: Authenticated but wallet not yet ready ───
  if (!wallets || wallets.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 font-medium">
            Đang kết nối ví...
          </p>
        </div>
      </div>
    );
  }

  // ─── State 4: Verifying role on-chain ───
  if (roleState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-sm w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-blue-50 rounded-xl p-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Đang xác minh quyền</h2>
          <p className="text-sm text-slate-500">
            Kiểm tra vai trò Admin/Issuer trên smart contract...
          </p>
        </div>
      </div>
    );
  }

  // ─── State 5: Error during role check ───
  if (roleState.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="bg-white rounded-2xl border border-red-100 shadow-lg p-10 max-w-md w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="bg-red-50 rounded-xl p-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Lỗi xác minh</h2>
          <p className="text-sm text-slate-500">{roleState.error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={checkRole} variant="outline" className="rounded-xl">
              Thử lại
            </Button>
            <Link href="/">
              <Button variant="ghost" className="rounded-xl text-slate-500">
                Về trang chủ
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 6: Authenticated but no admin/issuer role ───
  if (roleState.role && !roleState.role.isAdmin && !roleState.role.isIssuer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="bg-white rounded-2xl border border-amber-100 shadow-lg p-10 max-w-md w-full text-center space-y-5">
          <div className="flex justify-center">
            <div className="bg-amber-50 rounded-xl p-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Địa chỉ ví{" "}
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              {roleState.role.walletAddress
                ? `${roleState.role.walletAddress.slice(0, 6)}...${roleState.role.walletAddress.slice(-4)}`
                : "N/A"}
            </span>{" "}
            không có quyền Admin hoặc Issuer trên hệ thống.
          </p>
          <p className="text-xs text-slate-400">
            Liên hệ quản trị viên để được cấp quyền truy cập.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button onClick={checkRole} variant="outline" className="rounded-xl">
              Kiểm tra lại
            </Button>
            <Link href="/">
              <Button variant="ghost" className="rounded-xl text-slate-500">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Về trang chủ
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── State 7: Role not yet loaded (initial state) ───
  if (!roleState.role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 font-medium">
            Đang xác minh quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  // ─── State 8: All checks passed → Render dashboard ───
  return <>{children}</>;
}
