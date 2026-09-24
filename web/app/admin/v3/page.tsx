"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  FileText,
  Clock,
  XCircle,
  Plus,
  List,
  CheckCircle,
  Shield,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import toast from "react-hot-toast";

interface Batch {
  id: string;
  batchId: string;
  merkleRoot: string;
  size: number;
  txHash: string | null;
  createdAt: string;
  anchoredAt: string | null;
}

interface Stats {
  totalBatches: number;
  totalCredentials: number;
  totalRevoked: number;
}

export default function DashboardV3Page() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBatches, setRecentBatches] = useState<Batch[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v3/admin/stats");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load stats");
      
      setStats(data.stats);
      setRecentBatches(data.recentBatches);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi tải thống kê");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchStats]);

  const cardStyle = (color: string) => {
    const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
      blue: {
        bg: "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50",
        text: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
      },
      green: {
        bg: "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50",
        text: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400",
      },
      amber: {
        bg: "bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50",
        text: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
      },
      red: {
        bg: "bg-rose-50/50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50",
        text: "text-rose-600 dark:text-rose-400",
        iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-400",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            EIP-712 Trust Anchor
          </h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan hệ thống cấp phát chứng chỉ số off-chain (Phase 3)
          </p>
        </div>
        <Button
          onClick={fetchStats}
          disabled={loading}
          variant="outline"
          className="w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      {loading && !stats ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className={`border ${cardStyle("blue").bg} shadow-sm transition-all hover:shadow-md`}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tổng số đợt (Batches)
                  </p>
                  <p className="text-3xl font-black text-foreground mt-2">
                    {stats?.totalBatches || 0}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${cardStyle("blue").iconBg}`}>
                  <FolderKanban className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border ${cardStyle("green").bg} shadow-sm transition-all hover:shadow-md`}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tổng chứng chỉ đã ký
                  </p>
                  <p className="text-3xl font-black text-foreground mt-2">
                    {stats?.totalCredentials || 0}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${cardStyle("green").iconBg}`}>
                  <FileText className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border ${cardStyle("amber").bg} shadow-sm transition-all hover:shadow-md`}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Trạng thái Trust Anchor
                  </p>
                  <p className="text-lg font-bold text-foreground mt-2 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="h-5 w-5" />
                    Online
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${cardStyle("amber").iconBg}`}>
                  <Clock className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className={`border ${cardStyle("red").bg} shadow-sm transition-all hover:shadow-md`}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Chứng chỉ bị thu hồi
                  </p>
                  <p className="text-3xl font-black text-foreground mt-2">
                    {stats?.totalRevoked || 0}
                  </p>
                </div>
                <div className={`rounded-xl p-3 ${cardStyle("red").iconBg}`}>
                  <XCircle className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Thao tác nhanh Phase 3</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Link href="/admin/v3/issue">
                  <Button className="h-auto w-full flex-col gap-2.5 py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-sm transition-all hover:scale-[1.01]">
                    <Plus className="h-6 w-6" />
                    <span className="font-semibold text-sm">Phát hành Batch mới</span>
                  </Button>
                </Link>
                <Link href="/admin/v3/batches">
                  <Button className="h-auto w-full flex-col gap-2.5 py-6 bg-slate-900 hover:bg-slate-800 text-white border-0 shadow-sm transition-all hover:scale-[1.01]">
                    <List className="h-6 w-6" />
                    <span className="font-semibold text-sm">Lịch sử đợt cấp (Batches)</span>
                  </Button>
                </Link>
                <Link href="/admin/v3/signers">
                  <Button className="h-auto w-full flex-col gap-2.5 py-6 bg-teal-700 hover:bg-teal-600 text-white border-0 shadow-sm transition-all hover:scale-[1.01]">
                    <Shield className="h-6 w-6" />
                    <span className="font-semibold text-sm">Quản lý Signers</span>
                  </Button>
                </Link>
                <Link href="/admin/v3/revoke">
                  <Button className="h-auto w-full flex-col gap-2.5 py-6 bg-rose-700 hover:bg-rose-600 text-white border-0 shadow-sm transition-all hover:scale-[1.01]">
                    <XCircle className="h-6 w-6" />
                    <span className="font-semibold text-sm">Quản lý & Thu hồi</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Recent Batches */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Đợt phát hành gần đây (Phase 3)</h2>
                <Link href="/admin/v3/batches" className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
                  Xem tất cả
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              
              {recentBatches.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-muted rounded-xl">
                  <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground opacity-50 mb-2" />
                  <p className="text-muted-foreground text-sm">Chưa có đợt phát hành nào.</p>
                  <Link href="/admin/v3/issue" className="mt-3 inline-block">
                    <Button size="sm">Tạo ngay</Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                        <th className="p-3">Mã đợt (Batch ID)</th>
                        <th className="p-3">Merkle Root</th>
                        <th className="p-3">Số lượng</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3 text-right">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentBatches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-semibold text-foreground">
                            <Link href={`/admin/v3/batches/${batch.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                              {batch.batchId}
                            </Link>
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {batch.merkleRoot.slice(0, 10)}...{batch.merkleRoot.slice(-8)}
                          </td>
                          <td className="p-3 font-medium text-foreground">{batch.size} sinh viên</td>
                          <td className="p-3">
                            {batch.txHash ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Đã Neo (Anchored)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Chờ neo (Pending)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right text-muted-foreground text-xs">
                            {formatRelativeTime(new Date(batch.createdAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
