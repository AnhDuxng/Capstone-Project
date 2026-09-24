"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { getPrivyClients } from "@/lib/privy";
import { checkUserRoleV3 } from "@/lib/v3/roles";
import { ISSUER_REGISTRY_ADDRESS, issuerRegistryAbi } from "@/lib/v3/contracts";
import { hexToString, stringToHex, isAddress, type Address } from "viem";
import {
  ShieldAlert,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Plus,
  UserCheck,
  UserX,
  PlusCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface SignerInfo {
  address: string;
  isActive: boolean;
  didLabel: string;
}

export default function SignersManagementPage() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets?.[0];

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signers, setSigners] = useState<SignerInfo[]>([]);

  // Add signer form states
  const [newSignerAddr, setNewSignerAddr] = useState("");
  const [newDidLabel, setNewDidLabel] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSigners = useCallback(async () => {
    if (!activeWallet) return;
    setLoading(true);

    try {
      const { publicClient } = await getPrivyClients(activeWallet);

      // Check role
      const roles = await checkUserRoleV3(activeWallet);
      setIsAdmin(roles.isAdmin);

      // Read signers list
      const signerAddresses = (await publicClient.readContract({
        address: ISSUER_REGISTRY_ADDRESS,
        abi: issuerRegistryAbi,
        functionName: "getAllSigners",
      })) as Address[];

      const signerDetails: SignerInfo[] = [];

      for (const addr of signerAddresses) {
        const isActive = (await publicClient.readContract({
          address: ISSUER_REGISTRY_ADDRESS,
          abi: issuerRegistryAbi,
          functionName: "isSigner",
          args: [addr],
        })) as boolean;

        const didBytes = (await publicClient.readContract({
          address: ISSUER_REGISTRY_ADDRESS,
          abi: issuerRegistryAbi,
          functionName: "did",
          args: [addr],
        })) as `0x${string}`;

        let didLabel = "";
        try {
          if (didBytes && didBytes !== "0x") {
            didLabel = hexToString(didBytes);
          }
        } catch {
          didLabel = "Invalid DID label format";
        }

        signerDetails.push({
          address: addr,
          isActive,
          didLabel,
        });
      }

      setSigners(signerDetails);
    } catch (e) {
      const err = e as Error;
      toast.error("Lỗi đọc danh sách Signers: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeWallet]);

  useEffect(() => {
    if (authenticated && activeWallet) {
      const timer = setTimeout(() => {
        fetchSigners();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authenticated, activeWallet, fetchSigners]);

  const handleAddSigner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    if (!isAddress(newSignerAddr)) {
      toast.error("Địa chỉ ví ví không hợp lệ");
      return;
    }
    if (!newDidLabel.trim()) {
      toast.error("Vui lòng nhập nhãn định danh DID");
      return;
    }

    setActionLoading(true);
    toast.loading("Đang gửi giao dịch thêm Signer...", { id: "action-tx" });

    try {
      const { walletClient, publicClient, account } = await getPrivyClients(activeWallet);

      const didHex = stringToHex(newDidLabel.trim());

      const tx = await walletClient.writeContract({
        address: ISSUER_REGISTRY_ADDRESS,
        abi: issuerRegistryAbi,
        functionName: "addSigner",
        args: [newSignerAddr as Address, didHex],
        account,
      });

      toast.loading("Đang chờ xác nhận giao dịch...", { id: "action-tx" });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      toast.success("Thêm Signer thành công!", { id: "action-tx" });
      setNewSignerAddr("");
      setNewDidLabel("");
      fetchSigners();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Giao dịch thất bại", { id: "action-tx" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSigner = async (signerAddr: string) => {
    if (!activeWallet) return;
    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi quyền ký của ví ${signerAddr}?`)) {
      return;
    }

    setActionLoading(true);
    toast.loading("Đang gửi giao dịch thu hồi Signer...", { id: "action-tx" });

    try {
      const { walletClient, publicClient, account } = await getPrivyClients(activeWallet);

      const tx = await walletClient.writeContract({
        address: ISSUER_REGISTRY_ADDRESS,
        abi: issuerRegistryAbi,
        functionName: "revokeSigner",
        args: [signerAddr as Address],
        account,
      });

      toast.loading("Đang chờ xác nhận giao dịch...", { id: "action-tx" });
      await publicClient.waitForTransactionReceipt({ hash: tx });

      toast.success("Thu hồi Signer thành công!", { id: "action-tx" });
      fetchSigners();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Giao dịch thất bại", { id: "action-tx" });
    } finally {
      setActionLoading(false);
    }
  };

  if (!ready || (loading && signers.length === 0)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6">
        <ShieldAlert className="h-16 w-16 mx-auto text-amber-500" />
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Quản lý Signer Yêu Cầu Kết Nối</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng đăng nhập ví quản trị của Đại học để truy cập tính năng quản lý danh sách signer phát hành.
          </p>
        </div>
        <Button onClick={login}>Đăng nhập ví</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
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
              Quản lý Signers (Phase 3)
            </h1>
            <p className="text-muted-foreground mt-1">
              Phân quyền và thu hồi quyền ký chữ ký số điện tử của các phòng đào tạo.
            </p>
          </div>
        </div>
        <Button
          onClick={fetchSigners}
          disabled={loading || actionLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      {/* Admin Panel Warning if not owner */}
      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-500/5 text-amber-800 dark:border-amber-950 dark:text-amber-400">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Quyền hạn hạn chế</p>
              <p className="opacity-80 mt-0.5">
                Ví của bạn hiện không phải Owner của hợp đồng `IssuerRegistry`. Bạn chỉ có quyền xem danh sách và không thể thêm/thu hồi signers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left: Add Signer Form (Only shown to Admin) */}
        {isAdmin && (
          <Card className="lg:col-span-4 border border-border shadow-sm">
            <CardContent className="p-6 space-y-6">
              <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-blue-600" />
                Cấp quyền ví ký mới
              </h3>

              <form onSubmit={handleAddSigner} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Địa chỉ ví (0x...)</label>
                  <Input
                    placeholder="0x..."
                    value={newSignerAddr}
                    onChange={(e) => setNewSignerAddr(e.target.value)}
                    disabled={actionLoading}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Nhãn định danh DID</label>
                  <Input
                    placeholder="Ví dụ: did:ethr:sepolia:signer1"
                    value={newDidLabel}
                    onChange={(e) => setNewDidLabel(e.target.value)}
                    disabled={actionLoading}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={actionLoading || !newSignerAddr || !newDidLabel}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Xác nhận thêm Signer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Right: Signers List */}
        <Card className={`border border-border shadow-sm ${isAdmin ? "lg:col-span-8" : "lg:col-span-12"}`}>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-md font-bold text-foreground">Danh sách Signer đã đăng ký</h3>

            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="p-3">Địa chỉ Signer</th>
                    <th className="p-3">DID Label</th>
                    <th className="p-3">Trạng thái</th>
                    {isAdmin && <th className="p-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {signers.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className="text-center p-6 text-muted-foreground text-sm">
                        Chưa có Signer nào được đăng ký.
                      </td>
                    </tr>
                  ) : (
                    signers.map((signer) => (
                      <tr key={signer.address} className="hover:bg-muted/5 transition-colors">
                        <td className="p-3 font-mono font-bold text-foreground">
                          {signer.address}
                        </td>
                        <td className="p-3 font-medium text-muted-foreground text-xs">
                          {signer.didLabel || "—"}
                        </td>
                        <td className="p-3">
                          {signer.isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                              <UserCheck className="h-3.5 w-3.5" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50">
                              <UserX className="h-3.5 w-3.5" />
                              Đã thu hồi
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-right">
                            {signer.isActive ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading}
                                onClick={() => handleRevokeSigner(signer.address)}
                              >
                                Thu hồi quyền
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Revoked</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
