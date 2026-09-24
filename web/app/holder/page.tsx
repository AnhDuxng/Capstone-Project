"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Award,
  Calendar,
  Shield,
  ArrowRight,
  Loader2,
  RefreshCw,
  HelpCircle,
  Inbox,
} from "lucide-react";
import toast from "react-hot-toast";

interface Credential {
  id: string;
  credId: string;
  batchId: string;
  batchIndex: number;
  vct: string;
  degreeTitle: string;
  graduationDate: string;
  honors: string;
  isRevoked: boolean;
  issuedAt: string;
}

export default function HolderDashboardPage() {
  const { ready, authenticated, login, user } = usePrivy();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const fetchCredentials = useCallback(async () => {
    const email = user?.email?.address;
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/v3/holder/credentials?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load credentials");
      setCredentials(data.credentials);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Lỗi tải danh sách chứng chỉ");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authenticated && user?.email?.address) {
      const timer = setTimeout(() => {
        fetchCredentials();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [authenticated, user, fetchCredentials]);

  if (!ready) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 1. Not logged in state
  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
          <Award className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">Cổng Nhận Chứng Chỉ Sinh Viên</h1>
          <p className="text-sm text-muted-foreground">
            Đăng nhập bằng Email sinh viên được trường cấp để xem, cấu hình hiển thị và tải về các chứng chỉ số EIP-712 của bạn.
          </p>
        </div>
        <Button onClick={login} size="lg" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-6 rounded-xl">
          Đăng nhập ngay
        </Button>
      </div>
    );
  }

  // 2. Logged in but email is not verified or available
  if (!user?.email?.address) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
          <HelpCircle className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Yêu cầu xác thực Email</h1>
          <p className="text-sm text-muted-foreground">
            Tài khoản hiện tại của bạn chưa liên kết Email. Vui lòng liên kết email sinh viên của bạn để chúng tôi truy vấn chứng chỉ của bạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Văn bằng của tôi
          </h1>
          <p className="text-muted-foreground mt-1">
            Danh sách chứng chỉ số được cấp cho sinh viên tốt nghiệp.
          </p>
        </div>
        <Button
          onClick={fetchCredentials}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </Button>
      </div>

      {loading && credentials.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : credentials.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-12 text-center space-y-4">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Chưa có chứng chỉ nào</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Không tìm thấy chứng chỉ nào được liên kết với email sinh viên <strong className="text-foreground">{user.email.address}</strong>. Vui lòng liên hệ văn phòng khoa nếu bạn đã tốt nghiệp.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {credentials.map((cred) => (
            <Card
              key={cred.id}
              className={`border transition-all hover:shadow-md ${
                cred.isRevoked
                  ? "border-rose-100 dark:border-rose-950 bg-rose-50/10 dark:bg-rose-950/5"
                  : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5" />
                  </div>
                  {cred.isRevoked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50">
                      Đã thu hồi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/50">
                      Hợp lệ
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-md font-bold text-foreground leading-snug line-clamp-2">
                    {cred.degreeTitle}
                  </h3>
                  <p className="text-xs text-muted-foreground">Mã đợt: {cred.batchId}</p>
                </div>

                <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Tốt nghiệp: {new Date(cred.graduationDate).toLocaleDateString("vi-VN")}</span>
                  </div>
                  {cred.honors && (
                    <div className="flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-blue-500" />
                      <span>Xếp loại: {cred.honors}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <Link href={`/holder/${cred.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-1">
                      Chi tiết & Trình bày
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
