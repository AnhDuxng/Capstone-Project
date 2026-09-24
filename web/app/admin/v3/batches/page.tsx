"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Plus,
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

export default function BatchesHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v3/admin/batches");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load batches");
      setBatches(data.batches);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi tải danh sách đợt phát hành");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBatches();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchBatches]);

  const filteredBatches = batches.filter((batch) =>
    batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.merkleRoot.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/v3">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
              Lịch sử đợt phát hành (Phase 3)
            </h1>
            <p className="text-muted-foreground mt-1">
              Xem toàn bộ các đợt phát hành chứng chỉ số đã neo on-chain hoặc đang chờ.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/v3/issue">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Tạo Batch mới
            </Button>
          </Link>
          <Button
            onClick={fetchBatches}
            disabled={loading}
            variant="outline"
            size="icon"
            className="h-9 w-9"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="border border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
            <input
              placeholder="Tìm theo Batch ID hoặc Merkle Root..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Tổng số đợt tìm thấy: {filteredBatches.length}
          </div>
        </CardContent>
      </Card>

      {/* Table Content */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-16">
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
              <p className="text-muted-foreground font-semibold">Không tìm thấy đợt phát hành nào</p>
              <p className="text-xs text-muted-foreground mt-1">Hãy thử tìm kiếm với từ khóa khác.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="p-4">Mã đợt (Batch ID)</th>
                    <th className="p-4">Merkle Root</th>
                    <th className="p-4">Quy mô (Size)</th>
                    <th className="p-4">Trạng thái neo</th>
                    <th className="p-4">Giao dịch Hash</th>
                    <th className="p-4">Ngày tạo</th>
                    <th className="p-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-muted/5 transition-colors">
                      <td className="p-4 font-bold text-foreground">{batch.batchId}</td>
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {batch.merkleRoot.slice(0, 12)}...{batch.merkleRoot.slice(-10)}
                      </td>
                      <td className="p-4 font-medium text-foreground">{batch.size} chứng chỉ</td>
                      <td className="p-4">
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
                      <td className="p-4 font-mono text-xs">
                        {batch.txHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${batch.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1"
                          >
                            {batch.txHash.slice(0, 8)}...{batch.txHash.slice(-6)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {formatRelativeTime(new Date(batch.createdAt))}
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/admin/v3/batches/${batch.id}`}>
                          <Button size="sm" variant="outline" className="flex items-center gap-1">
                            Chi tiết
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
