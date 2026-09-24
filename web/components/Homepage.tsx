"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  FileCheck,
  UserCheck,
  Settings,
  ArrowRight,
  Zap,
  Lock,
  Eye,
  Layers,
} from "lucide-react";

export function Homepage() {
  return (
    <main className="flex-1 bg-gray-50" suppressHydrationWarning>
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white py-24 px-6">
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative container mx-auto max-w-5xl text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Phase 3 — EIP-712 Trust Anchor Architecture
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
            BK Credential System
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
            Hệ thống cấp phát và xác minh chứng chỉ số trên nền tảng Blockchain
            — Bảo mật, Minh bạch, Chi phí tối ưu.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/v3/verify">
              <Button
                size="lg"
                className="bg-blue-500 hover:bg-blue-400 text-white font-semibold px-8 h-12 rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-400/30 hover:-translate-y-0.5"
              >
                <FileCheck className="mr-2 h-5 w-5" />
                Xác thực Chứng chỉ
              </Button>
            </Link>
            <Link href="/holder">
              <Button
                size="lg"
                className="bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8 h-12 rounded-xl shadow-lg transition-all hover:shadow-white/20 hover:-translate-y-0.5 border border-white"
              >
                <UserCheck className="mr-2 h-5 w-5 text-blue-600" />
                <span>Cổng Sinh Viên</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ── */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Kiến trúc EIP-712 Off-Chain Signing
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Chữ ký số EIP-712 xử lý hoàn toàn off-chain, Blockchain Ethereum chỉ
              đóng vai trò Trust Anchor bất biến cho Merkle Root và Bitmap Revocation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: "Chi phí Gas giảm 9,800×",
                desc: "10,000 chứng chỉ chỉ tốn ~$9.45 USD (1 giao dịch anchor duy nhất).",
                color: "text-amber-500",
                bg: "bg-amber-50",
              },
              {
                icon: Lock,
                title: "An toàn Mật mã học",
                desc: "Chữ ký ECDSA secp256k1, Merkle Tree double keccak256, muối ngẫu nhiên 256-bit.",
                color: "text-blue-500",
                bg: "bg-blue-50",
              },
              {
                icon: Eye,
                title: "Ẩn danh dữ liệu chọn lọc",
                desc: "Sinh viên tùy chọn ẩn/hiện từng trường thông tin (Selective Disclosure).",
                color: "text-emerald-500",
                bg: "bg-emerald-50",
              },
              {
                icon: Layers,
                title: "Xác minh 10 bước tự động",
                desc: "Pipeline xác thực chứng chỉ toàn diện: Schema → Chữ ký → Merkle → On-chain.",
                color: "text-violet-500",
                bg: "bg-violet-50",
              },
            ].map((f) => (
              <Card
                key={f.title}
                className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1 bg-white"
              >
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${f.bg} mb-4`}
                >
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Cards ── */}
      <section className="py-20 px-6 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Các Cổng Dịch vụ
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Ba cổng giao diện chuyên biệt phục vụ Sinh viên, Bên xác minh và Quản trị viên.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Holder Portal */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
              <div className="p-8 space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50">
                  <UserCheck className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Cổng Sinh Viên
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Xem danh sách chứng chỉ đã được cấp, tùy chỉnh quyền ẩn/hiện
                  thông tin, và chia sẻ bằng cấp cho nhà tuyển dụng.
                </p>
                <Link href="/holder">
                  <Button
                    variant="outline"
                    className="w-full mt-2 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors"
                  >
                    Truy cập
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Verifier Portal */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="p-8 space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50">
                  <FileCheck className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Xác thực Chứng chỉ
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Tải lên file JSON chứng chỉ, xác minh tính hợp lệ qua pipeline
                  10 bước — chữ ký, Merkle proof, on-chain anchor.
                </p>
                <Link href="/v3/verify">
                  <Button
                    variant="outline"
                    className="w-full mt-2 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors"
                  >
                    Xác thực ngay
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Admin Portal */}
            <Card className="group relative overflow-hidden rounded-2xl border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="h-2 bg-gradient-to-r from-violet-500 to-purple-500" />
              <div className="p-8 space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-50">
                  <Settings className="w-7 h-7 text-violet-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Quản trị Hệ thống
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Quản lý Signer key, phát hành văn bằng hàng loạt (Bulk Issuance),
                  thu hồi chứng chỉ, và giám sát trạng thái hệ thống.
                </p>
                <Link href="/admin/v3">
                  <Button
                    variant="outline"
                    className="w-full mt-2 group-hover:bg-violet-50 group-hover:border-violet-200 transition-colors"
                  >
                    Truy cập
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Stats Banner ── */}
      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "~810", label: "Chứng chỉ ký / giây" },
              { value: "5.5ms", label: "Độ trễ xác minh TB" },
              { value: "~$9.45", label: "Chi phí / 10,000 bằng" },
              { value: "133/133", label: "Tests Passed" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl md:text-4xl font-extrabold mb-1">
                  {s.value}
                </div>
                <div className="text-sm text-blue-200">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / Tech Stack ── */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl text-center space-y-6">
          <Shield className="w-12 h-12 mx-auto text-blue-500" />
          <h2 className="text-3xl font-bold text-gray-900">
            Đồ án Tốt nghiệp — HCMUT
          </h2>
          <p className="text-gray-500 leading-relaxed">
            BK Credential System (Phase 3) là đồ án tốt nghiệp tại Trường Đại học Bách Khoa
            — ĐHQG TP.HCM, Khoa Khoa học và Kỹ thuật Máy tính. Hệ thống sử dụng kiến trúc
            EIP-712 Off-Chain Signing kết hợp On-Chain Trust Anchor trên Ethereum Sepolia
            Testnet, tích hợp Merkle Tree Batching, Selective Disclosure 256-bit, và Bitmap
            Revocation để đạt được mức chi phí vận hành thấp nhất đồng thời bảo đảm an toàn
            mật mã học theo chuẩn công nghiệp.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {[
              "Solidity 0.8.24",
              "EIP-712",
              "TypeScript SDK",
              "Next.js 16",
              "Ethereum Sepolia",
              "OpenZeppelin",
              "Prisma ORM",
            ].map((t) => (
              <span
                key={t}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
