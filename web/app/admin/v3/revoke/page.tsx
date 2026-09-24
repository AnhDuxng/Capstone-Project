"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPrivyClients } from "@/lib/privy";
import { CREDENTIAL_REGISTRY_V3_ADDRESS, credentialRegistryV3Abi } from "@/lib/v3/contracts";
import {
  XCircle,
  Search,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Award,
  Calendar,
  Mail,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

interface SearchResult {
  id: string;
  credId: string;
  batchIndex: number;
  studentId: string;
  degreeTitle: string;
  graduationDate: string;
  honors: string;
  holderEmail: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
  batch: {
    merkleRoot: string;
    batchId: string;
  };
}

export default function RevocationPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets?.[0];

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Vui lòng nhập MSSV hoặc Credential ID");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/v3/admin/search-credential?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Search failed");
      setResults(data.credentials);
    } catch (e) {
      const err = e as Error;
      toast.error("Tìm kiếm thất bại: " + err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (cred: SearchResult) => {
    if (!activeWallet) {
      toast.error("Vui lòng kết nối ví để ký giao dịch thu hồi");
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi chứng chỉ của sinh viên MSSV ${cred.studentId}?`)) {
      return;
    }

    setRevokingId(cred.id);
    toast.loading("Đang khởi tạo giao dịch thu hồi...", { id: "revoke" });

    try {
      const { walletClient, publicClient, account } = await getPrivyClients(activeWallet);

      toast.loading("Vui lòng ký giao dịch trên ví...", { id: "revoke" });

      // Call CredentialRegistryV3.revoke(merkleRoot, index)
      const tx = await walletClient.writeContract({
        address: CREDENTIAL_REGISTRY_V3_ADDRESS,
        abi: credentialRegistryV3Abi,
        // Single revocation on-chain function
        functionName: "revoke",
        args: [cred.batch.merkleRoot as `0x${string}`, cred.batchIndex],
        account,
      });

      toast.loading("Đang chờ xác nhận giao dịch...", { id: "revoke" });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Sync state with DB
      const syncRes = await fetch("/api/v3/admin/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialId: cred.id,
          txHash: tx,
          revokedBy: account,
        }),
      });

      const syncData = await syncRes.json();
      if (!syncRes.ok || !syncData.ok) {
        throw new Error(syncData?.message || "Database sync failed");
      }

      toast.success("Thu hồi chứng chỉ thành công!", { id: "revoke" });
      
      // Update local state search results
      setResults((prev) =>
        prev.map((item) =>
          item.id === cred.id
            ? { ...item, isRevoked: true, revokedAt: new Date().toISOString() }
            : item
        )
      );
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Giao dịch thất bại", { id: "revoke" });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/v3">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Quản lý Thu hồi (Phase 3)
          </h1>
          <p className="text-muted-foreground mt-1">
            Tra cứu thông tin và vô hiệu hóa các chứng chỉ số đã phát hành on-chain.
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <Card className="border border-border">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
              <input
                placeholder="Nhập MSSV (ví dụ: 2012345) hoặc Credential URN ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-all font-mono"
              />
            </div>
            <Button type="submit" disabled={loading} className="px-6 flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Tìm kiếm
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results view */}
      {loading && results.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : hasSearched && results.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 opacity-60 mb-2" />
            <p className="font-semibold text-foreground">Không tìm thấy chứng chỉ tương thích</p>
            <p className="text-xs mt-1">Hãy kiểm tra lại chính xác MSSV hoặc Credential ID.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {results.map((cred) => (
            <Card
              key={cred.id}
              className={`border transition-all ${
                cred.isRevoked
                  ? "border-rose-200 bg-rose-50/5 dark:bg-rose-950/5"
                  : "border-border bg-white dark:bg-slate-900"
              }`}
            >
              <CardContent className="p-6 space-y-6">
                {/* Header details */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-foreground leading-snug">
                        {cred.degreeTitle}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{cred.credId}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {cred.isRevoked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50">
                        Đã thu hồi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                        Hợp lệ
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Table */}
                <div className="grid gap-4 sm:grid-cols-2 text-xs border-t border-border pt-4">
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider block">Họ tên & MSSV</span>
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Dữ liệu được ẩn (MSSV: {cred.studentId})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider block">Ngày tốt nghiệp</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(cred.graduationDate).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider block">Mã đợt (Batch ID)</span>
                    <span className="font-semibold text-foreground text-sm">
                      {cred.batch.batchId}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wider block">Email sinh viên</span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {cred.holderEmail || "—"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">
                    Index in Batch: <span className="font-mono font-bold">{cred.batchIndex}</span>
                  </div>

                  <div className="flex gap-2">
                    {cred.isRevoked ? (
                      <span className="text-xs text-muted-foreground italic">
                        Thu hồi lúc {new Date(cred.revokedAt!).toLocaleDateString("vi-VN")}
                      </span>
                    ) : (
                      authenticated ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revokingId !== null}
                          onClick={() => handleRevoke(cred)}
                          className="flex items-center gap-1"
                        >
                          {revokingId === cred.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Thu hồi chứng chỉ này
                        </Button>
                      ) : (
                        <Button size="sm" onClick={login}>
                          Đăng nhập ví để thu hồi
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
