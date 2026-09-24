"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { filterDisclosures } from "@/lib/sdk/disclosure";
import {
  Award,
  ArrowLeft,
  Loader2,
  Download,
  Eye,
  EyeOff,
  User,
  Calendar,
  Lock,
  CheckCircle,
  FileCode,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

interface Disclosure {
  salt: string;
  key: string;
  value: string;
}

interface CredentialDetail {
  id: string;
  credId: string;
  batchId: string;
  batchIndex: number;
  vct: string;
  degreeTitle: string;
  graduationDate: string;
  honors: string;
  holderEmail: string | null;
  signature: string;
  merkleLeaf: string;
  merkleProof: string[];
  privateClaims: string[];
  credentialJson: string;
  isRevoked: boolean;
  revokedAt: string | null;
  disclosures: Disclosure[];
}

export default function CredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { ready, authenticated } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [cred, setCred] = useState<CredentialDetail | null>(null);
  
  // Track which disclosures are selected (disclosed)
  // By default, let's select all disclosures (disclose everything)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v3/holder/credentials/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load credential");
      setCred(data.credential);
      // Initialize selected keys with all available keys
      const keys = data.credential.disclosures.map((d: Disclosure) => d.key);
      setSelectedKeys(keys);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi tải chi tiết chứng chỉ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authenticated && id) {
      const timer = setTimeout(() => {
        fetchDetail();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authenticated, id, fetchDetail]);

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleDownloadPresentation = () => {
    if (!cred) return;

    try {
      // 1. Parse full credential JSON
      const fullCred = JSON.parse(cred.credentialJson);

      // 2. Filter disclosures using SDK utility
      const filteredDiscs = filterDisclosures(cred.disclosures, selectedKeys);

      // 3. Attach filtered disclosures to credential
      const presentationCred = {
        ...fullCred,
        disclosures: filteredDiscs,
      };

      // 4. Trigger download
      const jsonContent = JSON.stringify(presentationCred, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const studentIdDisc = cred.disclosures.find((d) => d.key === "studentId");
      const fileSuffix = studentIdDisc ? studentIdDisc.value : cred.credId.slice(-6);

      link.setAttribute("href", url);
      link.setAttribute("download", `bkcred_presentation_${fileSuffix}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Đã tải về chứng chỉ trình bày!");
    } catch (err) {
      const error = err as Error;
      toast.error("Lỗi tạo bản trình bày: " + error.message);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="text-center py-16">
        <Lock className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
        <p className="text-muted-foreground font-semibold">Vui lòng đăng nhập để xem thông tin</p>
        <button onClick={() => router.push("/holder")} className="mt-4 text-blue-600 hover:underline">
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  if (!cred) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
        <p className="text-muted-foreground font-semibold">Không tìm thấy thông tin chứng chỉ</p>
        <Link href="/holder" className="mt-4 inline-block">
          <Button>Quay lại Cổng Sinh Viên</Button>
        </Link>
      </div>
    );
  }

  // Find disclosure values safely
  const getDiscValue = (key: string) => {
    const disc = cred.disclosures.find((d) => d.key === key);
    return disc ? disc.value : "";
  };

  const isDisclosed = (key: string) => selectedKeys.includes(key);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/holder">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Cấu hình công bố thông tin (Selective Disclosure)
          </h1>
          <p className="text-muted-foreground mt-1">
            Chọn các thông tin cá nhân bạn muốn chia sẻ với bên xác thực.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left column: Selective disclosure configuration */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-border shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Lock className="h-5 w-5 text-blue-600" />
                <h3 className="text-md font-bold text-slate-800 dark:text-slate-100">
                  Cài đặt trường ẩn danh
                </h3>
              </div>

              <div className="space-y-4">
                {[
                  { key: "fullName", label: "Họ và tên", icon: User },
                  { key: "dob", label: "Ngày sinh (YYYY-MM-DD)", icon: Calendar },
                  { key: "studentId", label: "Mã số sinh viên (MSSV)", icon: Lock },
                ].map((item) => {
                  const disclosed = isDisclosed(item.key);
                  const val = getDiscValue(item.key);
                  return (
                    <div
                      key={item.key}
                      className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                        disclosed
                          ? "bg-blue-500/5 border-blue-200/60 dark:bg-blue-950/10 dark:border-blue-900/50"
                          : "bg-slate-50 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 pr-4">
                        <span className="text-xs text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
                          <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {item.label}
                        </span>
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          {disclosed ? (
                            <span className="text-slate-800 dark:text-slate-200">{val}</span>
                          ) : (
                            <span className="text-muted-foreground font-mono italic opacity-60">
                              [Đang bị ẩn - Salted Hash]
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant={disclosed ? "default" : "outline"}
                        onClick={() => toggleKey(item.key)}
                        className="h-9 w-9 shrink-0"
                      >
                        {disclosed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <hr className="border-border" />

              <div className="space-y-3">
                <Button
                  onClick={handleDownloadPresentation}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Download className="h-5 w-5" />
                  Tải bản trình bày JSON
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Bản trình bày sẽ chỉ chứa chữ ký EIP-712 và các trường thông tin bạn đã chọn công khai.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Certificate Visual Preview (Interactive Card) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative overflow-hidden bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8 aspect-[1.586] flex flex-col justify-between">
            {/* Background pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent pointer-events-none" />

            {/* Top row */}
            <div className="flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur text-white border border-white/10">
                  <Award className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                    Bằng Tốt Nghiệp
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Đại học Quốc gia TP.HCM</p>
                </div>
              </div>
              
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400">Mã đợt:</span>
                <p className="text-xs font-mono font-bold">{cred.batchId}</p>
              </div>
            </div>

            {/* Middle: Degree title */}
            <div className="z-10 space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white line-clamp-2">
                {cred.degreeTitle}
              </h2>
              <p className="text-sm text-yellow-400/90 font-semibold tracking-wide flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-yellow-400" />
                Ký số EIP-712 bảo mật
              </p>
            </div>

            {/* Bottom: student info */}
            <div className="z-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Họ và tên</span>
                <span className="font-bold text-white text-sm block">
                  {isDisclosed("fullName") ? getDiscValue("fullName") : "••••••••••••"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Ngày sinh</span>
                <span className="font-mono font-semibold text-white block">
                  {isDisclosed("dob") ? getDiscValue("dob") : "••••-••-••"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">MSSV</span>
                <span className="font-mono font-bold text-white block">
                  {isDisclosed("studentId") ? getDiscValue("studentId") : "•••••••"}
                </span>
              </div>
            </div>
          </div>

          {/* Certificate Tech details */}
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              <h4 className="font-bold text-foreground flex items-center gap-2">
                <FileCode className="h-5 w-5 text-blue-600" />
                Thông số kỹ thuật chứng chỉ
              </h4>
              <div className="grid gap-3 text-xs divide-y divide-border">
                <div className="pt-2 flex justify-between">
                  <span className="text-muted-foreground font-semibold">Mã chứng chỉ (URN):</span>
                  <span className="font-mono font-bold text-foreground">{cred.credId}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-muted-foreground font-semibold">Chữ ký điện tử (EIP-712):</span>
                  <span className="font-mono text-muted-foreground truncate max-w-[250px]">
                    {cred.signature}
                  </span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-muted-foreground font-semibold">Trạng thái:</span>
                  <span className="font-bold text-foreground">
                    {cred.isRevoked ? (
                      <span className="text-rose-600">Đã thu hồi</span>
                    ) : (
                      <span className="text-emerald-600">Hợp lệ (Hoạt động)</span>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
