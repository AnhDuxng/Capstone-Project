"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyCredential, VerifyResult } from "@/lib/sdk/verifier";
import { CredentialFile, Disclosure } from "@/lib/sdk/domain";
import { CREDENTIAL_REGISTRY_V3_ADDRESS, ISSUER_REGISTRY_ADDRESS } from "@/lib/v3/contracts";
import {
  ShieldCheck,
  Search,
  Loader2,
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  FileCheck,
  FileX,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";

// Explanations for each verification step
const STEP_DESCRIPTIONS: Record<number, { title: string; desc: string }> = {
  1: { title: "Kiểm tra định dạng JSON", desc: "Xác thực cấu trúc file đối chiếu với Zod Schema chuẩn." },
  2: { title: "Tái tạo mã băm công khai", desc: "Tính toán lại mã băm (publicClaimsHash) từ dữ liệu công khai." },
  3: { title: "Kiểm tra tiết lộ thông tin", desc: "Đối chiếu các mã muối (salts) của thông tin cá nhân với mã cam kết." },
  4: { title: "Tính toán Merkle Leaf", desc: "Recompute mã băm lá Merkle Leaf từ claims công khai và bí mật." },
  5: { title: "Xác thực Merkle Proof", desc: "Chứng minh lá Merkle Leaf thuộc về gốc Merkle Root của Batch phát hành." },
  6: { title: "Khôi phục chữ ký EIP-712", desc: "Xác minh chữ ký số được ký bởi ví người cấp phát (Issuer)." },
  7: { title: "Kiểm tra quyền Issuer", desc: "Truy vấn on-chain ví ký có quyền Signer trong IssuerRegistry." },
  8: { title: "Kiểm tra mỏ neo Batch", desc: "Truy vấn on-chain mỏ neo Merkle Root có tồn tại trong CredentialRegistry." },
  9: { title: "Kiểm tra trạng thái thu hồi", desc: "Quét vị trí bit trong Bitmap on-chain xem chứng chỉ có bị thu hồi." },
  10: { title: "Kiểm tra hạn dùng (Expiry)", desc: "Xác thực mốc thời gian hiện tại không vượt quá hạn dùng của bằng." },
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const urlCredId = searchParams.get("credId");

  const [credIdInput, setCredIdInput] = useState(urlCredId || "");
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyResult | null>(null);
  const [credentialData, setCredentialData] = useState<CredentialFile | null>(null);
  const [showSteps, setShowSteps] = useState(true);

  async function runPipeline(json: CredentialFile) {
    setCredentialData(json);
    try {
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 31337;
      const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "http://localhost:8545";

      const res = await verifyCredential(json, {
        verifyingContract: CREDENTIAL_REGISTRY_V3_ADDRESS,
        issuerRegistry: ISSUER_REGISTRY_ADDRESS,
        chainId,
        rpcUrl,
        skipOnlineChecks: false,
      });

      setVerificationResult(res);
      if (res.isValid) {
        toast.success("Chứng chỉ hợp lệ!", { id: "verify" });
      } else {
        toast.error(`Xác thực thất bại: ${res.error?.message}`, { id: "verify", duration: 5000 });
      }
    } catch (err) {
      const error = err as Error;
      console.error(error);
      toast.error("Lỗi hệ thống xác thực: " + error.message, { id: "verify" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyByCredId(credId: string) {
    setLoading(true);
    setVerificationResult(null);
    setCredentialData(null);
    toast.loading("Đang truy vấn chứng chỉ từ cơ sở dữ liệu...", { id: "verify" });

    try {
      const res = await fetch(`/api/v3/credentials/${encodeURIComponent(credId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to fetch credential file");

      toast.loading("Đang tiến hành xác thực 10 bước...", { id: "verify" });
      await runPipeline(data.credentialFile);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Không tìm thấy chứng chỉ", { id: "verify" });
      setLoading(false);
    }
  }

  // Auto-verify if credId is in URL
  useEffect(() => {
    if (urlCredId) {
      const timer = setTimeout(() => {
        handleVerifyByCredId(urlCredId);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCredId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setVerificationResult(null);
    setCredentialData(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        toast.loading("Đang tiến hành xác thực 10 bước...", { id: "verify" });
        await runPipeline(json);
      } catch (err) {
        const error = err as Error;
        toast.error("File JSON không hợp lệ: " + error.message, { id: "verify" });
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            Cổng Xác Thực V3 (EIP-712)
          </h1>
          <p className="text-muted-foreground mt-1">
            Xác minh tính chính chủ, chữ ký điện tử và trạng thái thu hồi của chứng chỉ số.
          </p>
        </div>
      </div>

      {/* Grid: Search and Upload */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Search by URN ID */}
        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Tra cứu theo mã Credential ID (URN)
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-60" />
              <input
                placeholder="urn:uuid:xxxx-xxxx-xxxx..."
                value={credIdInput}
                onChange={(e) => setCredIdInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-all font-mono"
              />
            </div>
            <Button
              onClick={() => handleVerifyByCredId(credIdInput.trim())}
              disabled={loading || !credIdInput.trim()}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Tra cứu & Xác thực
            </Button>
          </CardContent>
        </Card>

        {/* Upload JSON Presentation File */}
        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Tải lên file bản trình bày JSON
            </h3>
            <div className="border border-dashed border-muted hover:border-primary/50 transition-all rounded-lg p-6 text-center bg-muted/5 relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={loading}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
              <p className="text-xs font-semibold text-foreground">Click hoặc kéo thả file JSON trình bày</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Pipeline Results */}
      {loading && !verificationResult && (
        <Card className="border border-border">
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Đang thực thi các bước kiểm định mật mã...</p>
          </CardContent>
        </Card>
      )}

      {verificationResult && (
        <div className="space-y-6">
          {/* Main Status Banner */}
          <Card
            className={`border-2 shadow-md ${
              verificationResult.isValid
                ? "border-emerald-500/20 dark:border-emerald-500/10 bg-emerald-500/5"
                : "border-rose-500/20 dark:border-rose-500/10 bg-rose-500/5"
            }`}
          >
            <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {verificationResult.isValid ? (
                <>
                  <FileCheck className="h-16 w-16 text-emerald-600 shrink-0" />
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-foreground">CHỨNG CHỈ HỢP LỆ</h2>
                    <p className="text-sm text-muted-foreground">
                      Bản trình bày đáp ứng đầy đủ tiêu chí xác thực 10 bước mật mã học. Toàn bộ chữ ký và mỏ neo Merkle Root trùng khớp.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <FileX className="h-16 w-16 text-rose-600 shrink-0" />
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-foreground">CHỨNG CHỈ KHÔNG HỢP LỆ</h2>
                    <p className="text-sm text-rose-600 font-medium">
                      Mã lỗi: <span className="font-mono bg-rose-500/10 px-1.5 py-0.5 rounded">{verificationResult.error?.code}</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {verificationResult.error?.message}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Credential Data Preview (If Valid/Exists) */}
          {credentialData && (
            <Card className="border border-border shadow-sm">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-md font-bold text-foreground">Thông tin chứng chỉ số đã giải mã</h3>
                
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Tên bằng (Degree Title)</span>
                    <p className="font-bold text-foreground">{credentialData.publicClaims?.degreeTitle}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Đơn vị cấp phát (Issuer)</span>
                    <p className="font-bold text-foreground">{credentialData.issuer?.name}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Ngày cấp bằng</span>
                    <p className="font-semibold text-foreground">
                      {new Date(credentialData.publicClaims?.graduationDate).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-xs font-semibold uppercase">Xếp loại</span>
                    <p className="font-semibold text-foreground">{credentialData.publicClaims?.honors || "—"}</p>
                  </div>
                </div>

                {/* Disclosed private claims */}
                {credentialData.disclosures && credentialData.disclosures.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <span className="text-muted-foreground text-xs font-semibold uppercase block">
                      Thông tin cá nhân được sinh viên tiết lộ
                    </span>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {credentialData.disclosures.map((disc: Disclosure) => (
                        <div key={disc.key} className="bg-blue-500/5 border border-blue-200/40 dark:bg-blue-950/10 dark:border-blue-900/30 p-3 rounded-lg">
                          <span className="text-xs text-muted-foreground font-semibold uppercase block">
                            {disc.key === "fullName" ? "Họ và tên" : disc.key === "dob" ? "Ngày sinh" : "MSSV"}
                          </span>
                          <span className="font-bold text-foreground text-sm mt-1 block">{disc.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 10-Step Verification Log */}
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between font-bold text-foreground text-md"
              >
                <span>Nhật ký kiểm định chi tiết (10 bước)</span>
                {showSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showSteps && (
                <div className="space-y-4 mt-2">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const stepNum = idx + 1;
                    const isVerified = verificationResult.verifiedSteps.includes(stepNum);
                    const isFailedStep = !verificationResult.isValid && 
                                         verificationResult.verifiedSteps.length === idx;
                    
                    let statusIcon = <div className="h-5 w-5 rounded-full border border-muted bg-background shrink-0" />;
                    if (isVerified) {
                      statusIcon = <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />;
                    } else if (isFailedStep) {
                      statusIcon = <XCircle className="h-5 w-5 text-rose-600 shrink-0" />;
                    }

                    return (
                      <div
                        key={stepNum}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          isVerified
                            ? "bg-emerald-500/5 border-emerald-100/50 dark:border-emerald-950/20"
                            : isFailedStep
                            ? "bg-rose-500/5 border-rose-100/50 dark:border-rose-950/20"
                            : "bg-background border-border"
                        }`}
                      >
                        {statusIcon}
                        <div className="space-y-0.5">
                          <span className="text-sm font-bold text-foreground">
                            Bước {stepNum}: {STEP_DESCRIPTIONS[stepNum].title}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {STEP_DESCRIPTIONS[stepNum].desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function VerifyV3Page() {
  return (
    <Suspense fallback={
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
