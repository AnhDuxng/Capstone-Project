"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallets } from "@privy-io/react-auth";
import { getPrivyClients } from "@/lib/privy";
import { CREDENTIAL_REGISTRY_V3_ADDRESS, credentialRegistryV3Abi } from "@/lib/v3/contracts";
import {
  FolderKanban,
  XCircle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Batch {
  id: string;
  batchId: string;
  merkleRoot: string;
  size: number;
  ipfsCid: string | null;
  issuerAddr: string;
  txHash: string | null;
  createdAt: string;
  anchoredAt: string | null;
}

interface Credential {
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
}

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);

  const { wallets } = useWallets();
  const activeWallet = wallets?.[0];

  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v3/admin/batches/${batchId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load batch details");
      setBatch(data.batch);
      setCredentials(data.credentials);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi tải chi tiết đợt phát hành");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDetails();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDetails]);

  const handleRevokeCredential = async (cred: Credential) => {
    if (!activeWallet) {
      toast.error("Vui lòng kết nối ví để ký thu hồi");
      return;
    }
    if (!batch) return;

    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi chứng chỉ của sinh viên MSSV ${cred.studentId}? Giao dịch này không thể hoàn tác.`)) {
      return;
    }

    setRevokingId(cred.id);
    toast.loading("Đang chuẩn bị giao dịch thu hồi...", { id: "revoke-tx" });

    try {
      const { walletClient, publicClient, account } = await getPrivyClients(activeWallet);

      toast.loading("Vui lòng ký giao dịch trên ví...", { id: "revoke-tx" });

      // Call CredentialRegistryV3.revoke(merkleRoot, index)
      const tx = await walletClient.writeContract({
        address: CREDENTIAL_REGISTRY_V3_ADDRESS,
        abi: credentialRegistryV3Abi,
        functionName: "revoke",
        args: [batch.merkleRoot as `0x${string}`, cred.batchIndex],
        account,
      });

      toast.loading("Đang chờ xác nhận giao dịch...", { id: "revoke-tx" });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      // Call API to sync state with DB
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
        throw new Error(syncData?.message || "DB Sync failed");
      }

      toast.success("Thu hồi chứng chỉ thành công!", { id: "revoke-tx" });
      fetchDetails(); // Reload page state
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi thu hồi giao dịch", { id: "revoke-tx" });
    } finally {
      setRevokingId(null);
    }
  };

  if (loading && !batch) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-16">
        <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
        <p className="text-muted-foreground font-semibold">Không tìm thấy thông tin đợt phát hành</p>
        <Link href="/admin/v3/batches" className="mt-4 inline-block">
          <Button>Quay lại danh sách</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/v3/batches">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
              Chi tiết đợt: {batch.batchId}
            </h1>
            <p className="text-muted-foreground mt-1">
              Quản lý danh sách chứng chỉ và thu hồi của đợt tốt nghiệp.
            </p>
          </div>
        </div>
        <Button
          onClick={fetchDetails}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      {/* Batch Meta Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border border-border md:col-span-2">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-md font-bold text-foreground">Thông tin mỏ neo niềm tin</h3>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold block uppercase">Merkle Root</span>
                <span className="font-mono text-xs text-foreground bg-muted/40 p-2 rounded border border-border/50 block truncate">
                  {batch.merkleRoot}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold block uppercase">IPFS CID</span>
                {batch.ipfsCid ? (
                  <span className="font-mono text-xs text-foreground bg-muted/40 p-2 rounded border border-border/50 block truncate">
                    {batch.ipfsCid}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic p-2 block">—</span>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold block uppercase">Giao dịch Anchor</span>
                {batch.txHash ? (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${batch.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400 bg-blue-500/5 p-2 rounded border border-blue-200/30 w-full flex items-center justify-between"
                  >
                    <span className="truncate block mr-2">{batch.txHash}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold p-2 block flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Chưa được neo on-chain
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs font-semibold block uppercase">Địa chỉ Signer phát hành</span>
                <span className="font-mono text-xs text-foreground bg-muted/40 p-2 rounded border border-border/50 block truncate">
                  {batch.issuerAddr}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-md font-bold text-foreground">Trạng thái</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                <span className="text-muted-foreground">Quy mô:</span>
                <span className="font-bold text-foreground">{batch.size} sinh viên</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                <span className="text-muted-foreground">Ngày tạo đợt:</span>
                <span className="font-semibold text-foreground">
                  {new Date(batch.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Blockchain:</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {batch.txHash ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                      Đã xác nhận
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                      Chờ neo
                    </span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Table */}
      <Card className="border border-border">
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Danh sách chứng chỉ ({credentials.length})</h2>
          
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <th className="p-3">Index</th>
                  <th className="p-3">MSSV</th>
                  <th className="p-3">Tên bằng</th>
                  <th className="p-3">Xếp loại</th>
                  <th className="p-3">Email nhận</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-3 font-mono font-semibold text-muted-foreground">{cred.batchIndex}</td>
                    <td className="p-3 font-mono font-bold text-foreground">{cred.studentId}</td>
                    <td className="p-3 font-medium">{cred.degreeTitle}</td>
                    <td className="p-3">
                      {cred.honors ? (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                          {cred.honors}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{cred.holderEmail || "—"}</td>
                    <td className="p-3">
                      {cred.isRevoked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50">
                          Đã thu hồi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                          Đang hoạt động
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {cred.isRevoked ? (
                        <span className="text-xs text-muted-foreground italic">
                          Thu hồi lúc {new Date(cred.revokedAt!).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revokingId !== null || !batch.txHash}
                          onClick={() => handleRevokeCredential(cred)}
                          className="flex items-center justify-center gap-1 ml-auto"
                        >
                          {revokingId === cred.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Thu hồi
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
