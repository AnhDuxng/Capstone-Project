"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Papa from "papaparse";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPrivyClients } from "@/lib/privy";
import { CREDENTIAL_REGISTRY_V3_ADDRESS, credentialRegistryV3Abi } from "@/lib/v3/contracts";
import {
  Upload,
  Download,
  CheckCircle,
  Clock,
  Loader2,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Database,
  Link as LinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";

// Schema for row validation
const CSVRowSchema = z.object({
  studentId: z.string().min(1, "MSSV không được để trống"),
  fullName: z.string().min(1, "Họ và tên không được để trống"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải đúng định dạng YYYY-MM-DD"),
  degreeTitle: z.string().min(1, "Tên bằng không được để trống"),
  graduationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày tốt nghiệp phải đúng định dạng YYYY-MM-DD"),
  honors: z.string().optional().default(""),
  holderEmail: z.string().email("Email không đúng định dạng").optional().or(z.literal("")),
});

type CSVRow = z.infer<typeof CSVRowSchema>;

interface RowError {
  row: number;
  errors: Record<string, string>;
}

export default function BatchIssuerPage() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets?.[0];

  // Steps: 1 - Upload & Verify, 2 - Generating Signatures, 3 - On-chain Anchor, 4 - Success
  const [step, setStep] = useState(1);
  const [batchId, setBatchId] = useState("");
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [fileName, setFileName] = useState("");
  
  // Progress states
  const [loading, setLoading] = useState(false);
  const [merkleRoot, setMerkleRoot] = useState("");
  const [ipfsCid, setIpfsCid] = useState("");
  const [size, setSize] = useState(0);
  const [txHash, setTxHash] = useState("");

  // SSE progress streaming states (Week 5 Day 3)
  const [jobId, setJobId] = useState("");
  const [jobStage, setJobStage] = useState<string>("queued");
  const [jobPercent, setJobPercent] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [throughput, setThroughput] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusLogs, setStatusLogs] = useState<string[]>([]);

  const downloadTemplate = () => {
    const csvContent = "studentId,fullName,dob,degreeTitle,graduationDate,honors,holderEmail\n2012345,Nguyen Van A,2002-05-15,Bachelor of Computer Science,2026-06-25,Xuất sắc,studentA@hcmut.edu.vn\n2012346,Tran Thi B,2002-08-20,Bachelor of Computer Science,2026-06-25,Giỏi,studentB@hcmut.edu.vn";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bkcred_template_v3.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setErrors([]);
    setCsvData([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows: CSVRow[] = [];
        const validationErrors: RowError[] = [];

        results.data.forEach((rawRow: unknown, index: number) => {
          const row = rawRow as Record<string, string | undefined>;
          const studentId = row.studentId?.trim() || "";
          // Normalize properties (trim whitespace)
          const normalizedRow = {
            studentId,
            fullName: row.fullName?.trim() || "",
            dob: row.dob?.trim() || "",
            degreeTitle: row.degreeTitle?.trim() || "",
            graduationDate: row.graduationDate?.trim() || "",
            honors: row.honors?.trim() || "",
            holderEmail: row.holderEmail?.trim() || (studentId ? `${studentId}@hcmut.edu.vn` : ""),
          };

          const result = CSVRowSchema.safeParse(normalizedRow);
          if (result.success) {
            parsedRows.push(result.data);
          } else {
            const fieldErrors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
              const path = issue.path[0] as string;
              fieldErrors[path] = issue.message;
            });
            validationErrors.push({
              row: index + 2, // 1-based, accounts for header row
              errors: fieldErrors,
            });
          }
        });

        setLoading(false);
        setCsvData(parsedRows);
        setErrors(validationErrors);
        
        if (validationErrors.length > 0) {
          toast.error(`Phát hiện ${validationErrors.length} dòng lỗi trong file CSV`);
        } else {
          toast.success(`Đã kiểm tra ${parsedRows.length} dòng hợp lệ`);
          // Set automatic batch ID if empty
          if (!batchId) {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            setBatchId(`BATCH-${today}-${Math.floor(100 + Math.random() * 900)}`);
          }
        }
      },
      error: (err) => {
        setLoading(false);
        toast.error(`Lỗi đọc file: ${err.message}`);
      }
    });
  };

  const handleIssueBatch = async () => {
    if (!batchId.trim()) {
      toast.error("Vui lòng nhập Mã đợt phát hành");
      return;
    }
    if (csvData.length === 0) {
      toast.error("Vui lòng upload file CSV chứa dữ liệu");
      return;
    }
    if (errors.length > 0) {
      toast.error("Vui lòng sửa các lỗi dữ liệu trong file CSV trước khi phát hành");
      return;
    }
    if (!activeWallet) {
      toast.error("Vui lòng kết nối ví để ký Neo blockchain");
      return;
    }

    setStep(2);
    setLoading(true);
    setJobPercent(0);
    setCurrentProgress(0);
    setTotalCount(csvData.length);
    setStatusLogs([`Bắt đầu tiến trình phát hành ${csvData.length} chứng chỉ...`]);

    try {
      const chainId = activeWallet.chainId ? Number(activeWallet.chainId.split(":")[1]) : 31337;
      
      // Step 2: Trigger asynchronous bulk pipeline with background worker
      const res = await fetch("/api/v3/issuer/issue-batch/async", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchId.trim(),
          credentials: csvData,
          chainId: Number(chainId) || 31337,
          chunkSize: 500,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Khởi chạy tiến trình thất bại");

      setJobId(data.jobId);
      setTotalCount(data.total);
      setTotalChunks(data.totalChunks);

      // Connect to Server-Sent Events (SSE) real-time streaming endpoint
      const eventSource = new EventSource(`/api/v3/issuer/jobs/${data.jobId}/stream`);

      // Polling fallback to ensure progress & completion are detected reliably
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/v3/issuer/jobs/${data.jobId}`);
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();
          if (!pollData.ok || !pollData.job) return;

          const job = pollData.job;
          if (job.stage) setJobStage(job.stage);
          if (typeof job.percent === "number") setJobPercent(job.percent);
          if (typeof job.current === "number") setCurrentProgress(job.current);
          if (typeof job.chunkIndex === "number") setChunkIndex(job.chunkIndex);
          if (job.message) setStatusMessage(job.message);

          if (job.status === "completed") {
            clearInterval(pollInterval);
            eventSource.close();
            setMerkleRoot(job.merkleRoot);
            setIpfsCid(job.ipfsCid || "");
            setSize(job.size || job.total);
            setStep(3);
            toast.success("Tạo chữ ký EIP-712 và cây Merkle thành công!");
          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            eventSource.close();
            setJobStage("failed");
            toast.error(job.error || job.message || "Lỗi xử lý trong worker");
          }
        } catch {
          // Ignore transient fetch errors
        }
      }, 1000);

      eventSource.addEventListener("progress", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.stage) setJobStage(payload.stage);
          if (typeof payload.percent === "number") setJobPercent(payload.percent);
          if (typeof payload.current === "number") setCurrentProgress(payload.current);
          if (typeof payload.total === "number") setTotalCount(payload.total);
          if (typeof payload.chunkIndex === "number") setChunkIndex(payload.chunkIndex);
          if (typeof payload.totalChunks === "number") setTotalChunks(payload.totalChunks);
          if (typeof payload.throughputOpsPerSec === "number") {
            setThroughput(payload.throughputOpsPerSec);
          }
          if (payload.message) {
            setStatusMessage(payload.message);
            setStatusLogs((prev) => [...prev.slice(-6), payload.message]);
          }

          if (payload.status === "completed") {
            clearInterval(pollInterval);
            setMerkleRoot(payload.merkleRoot);
            setIpfsCid(payload.ipfsCid || "");
            setSize(payload.size || payload.total);
            eventSource.close();
            setStep(3);
            toast.success("Tạo chữ ký EIP-712 và cây Merkle thành công!");
          } else if (payload.status === "failed") {
            clearInterval(pollInterval);
            eventSource.close();
            setJobStage("failed");
            toast.error(payload.error || payload.message || "Lỗi xử lý trong worker");
          }
        } catch (err) {
          console.error("Error processing SSE message:", err);
        }
      });

      eventSource.addEventListener("init", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.stage) setJobStage(payload.stage);
          if (typeof payload.percent === "number") setJobPercent(payload.percent);
        } catch (err) {
          console.error("Error processing SSE init:", err);
        }
      });

      eventSource.onerror = (err) => {
        console.warn("SSE connection error or closed:", err);
      };
    } catch (e) {
      const err = e as Error;
      setStep(1);
      toast.error(err.message || "Lỗi phát hành chứng chỉ");
    } finally {
      setLoading(false);
    }
  };

  const handleAnchorOnChain = async () => {
    if (!activeWallet) {
      toast.error("Không tìm thấy ví hoạt động");
      return;
    }
    setLoading(true);

    try {
      const { walletClient, publicClient, account } = await getPrivyClients(activeWallet);

      toast.loading("Vui lòng ký giao dịch trên ví...", { id: "anchor-tx" });

      const tx = await walletClient.writeContract({
        address: CREDENTIAL_REGISTRY_V3_ADDRESS,
        abi: credentialRegistryV3Abi,
        functionName: "anchorBatch",
        args: [merkleRoot as `0x${string}`, size, ipfsCid],
        account,
      });

      toast.loading("Đang chờ xác nhận giao dịch...", { id: "anchor-tx" });

      await publicClient.waitForTransactionReceipt({ hash: tx });
      setTxHash(tx);

      // Call API confirmation to update db anchored status
      const confirmRes = await fetch("/api/v3/issuer/anchor-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          txHash: tx,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.ok) {
        console.error("Failed to confirm anchor transaction in database:", confirmData);
      }

      toast.success("Neo đợt phát hành thành công!", { id: "anchor-tx" });
      setStep(4);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Giao dịch thất bại", { id: "anchor-tx" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          Phát hành Batch mới (Phase 3)
        </h1>
        <p className="text-muted-foreground mt-1">
          Cấp phát chứng chỉ số ký EIP-712 và lưu mỏ neo Merkle Root on-chain.
        </p>
      </div>

      {/* Progress Steps Header */}
      <div className="flex justify-between items-center bg-muted/30 rounded-xl p-4 border border-border">
        {[
          { label: "Upload & Xác thực", icon: Upload },
          { label: "Tạo chữ ký & IPFS", icon: Database },
          { label: "Neo Blockchain", icon: LinkIcon },
          { label: "Hoàn tất", icon: CheckCircle },
        ].map((item, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border transition-all ${
                  isActive
                    ? "bg-primary border-primary text-primary-foreground scale-110 shadow-sm"
                    : isDone
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={`text-xs font-semibold hidden md:inline ${
                  isActive
                    ? "text-foreground font-black"
                    : isDone
                    ? "text-emerald-600"
                    : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
              {idx < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30 hidden md:block" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload & Verify CSV */}
      {step === 1 && (
        <div className="grid gap-8">
          <Card className="border border-border">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-foreground block">
                    1. Nhập mã đợt cấp phát (Batch ID)
                  </label>
                  <Input
                    placeholder="Ví dụ: GRAD-2026-CS"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Tải mẫu Excel CSV
                </Button>
              </div>

              <hr className="border-border" />

              <div className="space-y-4">
                <label className="text-sm font-bold text-foreground block">
                  2. Tải lên dữ liệu CSV sinh viên tốt nghiệp
                </label>
                <div className="border-2 border-dashed border-muted hover:border-primary/50 transition-all rounded-xl p-8 text-center bg-muted/10 relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  {loading ? (
                    <div className="space-y-2">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground font-medium">Đang đọc file dữ liệu...</p>
                    </div>
                  ) : fileName ? (
                    <div className="space-y-2">
                      <FileSpreadsheet className="h-10 w-10 mx-auto text-emerald-600" />
                      <p className="text-sm font-bold text-foreground">{fileName}</p>
                      <p className="text-xs text-muted-foreground">Kéo thả hoặc click để thay đổi file khác</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
                      <p className="text-sm text-foreground font-semibold">Chọn file CSV hoặc kéo thả vào đây</p>
                      <p className="text-xs text-muted-foreground">Định dạng file yêu cầu: UTF-8 CSV</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Results / Errors Preview */}
          {(csvData.length > 0 || errors.length > 0) && (
            <Card className="border border-border">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Kết quả đọc file ({csvData.length + errors.length} dòng)
                  </h3>
                  <div className="flex gap-4 text-xs font-semibold">
                    <span className="text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">
                      Hợp lệ: {csvData.length}
                    </span>
                    {errors.length > 0 && (
                      <span className="text-rose-600 bg-rose-500/10 px-2 py-1 rounded">
                        Lỗi: {errors.length}
                      </span>
                    )}
                  </div>
                </div>

                {errors.length > 0 ? (
                  <div className="space-y-3">
                    <div className="bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 p-4 rounded-xl flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-bold text-rose-800 dark:text-rose-400 text-sm">
                          Dữ liệu không đáp ứng tiêu chuẩn
                        </p>
                        <p className="text-rose-700 dark:text-rose-400/80 text-xs mt-0.5">
                          Vui lòng sửa toàn bộ các lỗi định dạng dưới đây trong file CSV và tải lên lại.
                        </p>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto border border-rose-200/50 dark:border-rose-900/30 rounded-xl divide-y divide-border">
                      {errors.map((err) => (
                        <div key={err.row} className="p-3 text-xs bg-rose-50/20 dark:bg-rose-950/10 flex items-start gap-4">
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            Dòng {err.row}:
                          </span>
                          <div className="space-y-1">
                            {Object.entries(err.errors).map(([field, msg]) => (
                              <p key={field} className="text-muted-foreground">
                                <strong className="text-rose-700 dark:text-rose-400 uppercase font-mono mr-1">{field}</strong>: {msg}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-64 overflow-y-auto border border-border rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold sticky top-0">
                            <th className="p-2.5">MSSV</th>
                            <th className="p-2.5">Họ và tên (Private)</th>
                            <th className="p-2.5">Ngày sinh (Private)</th>
                            <th className="p-2.5">Tên bằng</th>
                            <th className="p-2.5">Xếp loại</th>
                            <th className="p-2.5">Email nhận</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {csvData.slice(0, 50).map((row, idx) => (
                            <tr key={idx} className="hover:bg-muted/10">
                              <td className="p-2.5 font-mono font-bold">{row.studentId}</td>
                              <td className="p-2.5 font-medium">{row.fullName}</td>
                              <td className="p-2.5 text-muted-foreground">{row.dob}</td>
                              <td className="p-2.5">{row.degreeTitle}</td>
                              <td className="p-2.5">{row.honors || "—"}</td>
                              <td className="p-2.5 text-muted-foreground">{row.holderEmail}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Hiển thị preview 50 dòng đầu tiên...
                      </p>
                    )}

                    <div className="flex justify-end pt-4">
                      {authenticated ? (
                        <Button
                          onClick={handleIssueBatch}
                          className="flex items-center gap-2"
                          size="lg"
                        >
                          Phát hành Batch
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={login}
                          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
                          size="lg"
                        >
                          Kết nối ví để phát hành
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Off-chain signatures and commitments with Real-Time SSE Progress Streaming */}
      {step === 2 && (
        <Card className="border border-border shadow-lg">
          <CardContent className="p-8 space-y-8">
            <div className="text-center space-y-2">
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${jobStage === "failed" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"} mb-2 shadow-inner`}>
                {jobStage === "failed" ? (
                  <ShieldAlert className="h-8 w-8 text-destructive" />
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin" />
                )}
              </div>
              <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
                {jobStage === "failed" ? "Tiến trình gặp sự cố" : "Tiến trình xử lý đợt cấp phát lớn (SSE Streaming)"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {jobStage === "failed"
                  ? "Đã xảy ra lỗi trong quá trình thực thi đợt cấp phát. Bạn có thể nhấn nút bên dưới để thử lại."
                  : "Hệ thống đang thực thi pipeline xử lý theo từng chunk (20 × 500) kết hợp luồng sự kiện thời gian thực Server-Sent Events."}
              </p>
            </div>

            {/* Pipeline Stage Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {[
                { id: "disclosures", label: "1. Cam kết Salt", desc: "Sinh 3 salted hashes" },
                { id: "merkle_tree", label: "2. Cây Merkle", desc: "O(n) Merkle Tree" },
                { id: "signing", label: "3. Ký EIP-712", desc: "Off-chain signatures" },
                { id: "db_insert", label: "4. Lưu CSDL", desc: "Chunked createMany" },
              ].map((st) => {
                const stageOrder = ["queued", "disclosures", "merkle_tree", "signing", "db_insert", "completed"];
                const currentIdx = stageOrder.indexOf(jobStage);
                const itemIdx = stageOrder.indexOf(st.id);
                const isStActive = jobStage === st.id;
                const isStDone = currentIdx > itemIdx;

                return (
                  <div
                    key={st.id}
                    className={`p-3.5 rounded-xl border transition-all text-left ${
                      isStActive
                        ? "border-primary bg-primary/5 shadow-sm scale-102"
                        : isStDone
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{st.label}</span>
                      {isStDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : isStActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{st.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Live Progress Bar */}
            <div className="max-w-3xl mx-auto space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-foreground">
                  Tiến độ hoàn thành ({currentProgress.toLocaleString()} / {totalCount.toLocaleString()} chứng chỉ)
                </span>
                <span className="text-primary font-mono">{jobPercent}%</span>
              </div>
              <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden border border-border/50">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(jobPercent, 2)}%` }}
                />
              </div>
              {statusMessage && (
                <p className={`text-xs italic text-center pt-1 font-medium ${jobStage === "failed" ? "text-destructive font-semibold" : "text-muted-foreground truncate"}`}>
                  {statusMessage}
                </p>
              )}
              {jobStage === "failed" && (
                <div className="text-center pt-3">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setStep(1);
                      setJobStage("queued");
                      setStatusMessage("");
                    }}
                    className="font-bold shadow-md"
                  >
                    Quay lại & Thử lại phát hành
                  </Button>
                </div>
              )}
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-center">
              <div className="p-3 bg-muted/20 rounded-xl border border-border">
                <p className="text-[11px] text-muted-foreground font-semibold">Mã đợt / Job ID</p>
                <p className="text-sm font-bold text-foreground font-mono truncate" title={jobId || batchId}>
                  {batchId}
                </p>
                {jobId && (
                  <p className="text-[10px] text-muted-foreground/80 font-mono truncate">{jobId}</p>
                )}
              </div>
              <div className="p-3 bg-muted/20 rounded-xl border border-border">
                <p className="text-[11px] text-muted-foreground font-semibold">Chunk xử lý</p>
                <p className="text-sm font-bold text-foreground font-mono">
                  {chunkIndex > 0 ? `${chunkIndex}/${totalChunks || 20}` : "Đang khởi tạo"}
                </p>
              </div>
              <div className="p-3 bg-muted/20 rounded-xl border border-border">
                <p className="text-[11px] text-muted-foreground font-semibold">Tốc độ tức thời</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {throughput > 0 ? `~${throughput.toLocaleString()} ops/s` : "Đang đo..."}
                </p>
              </div>
              <div className="p-3 bg-muted/20 rounded-xl border border-border">
                <p className="text-[11px] text-muted-foreground font-semibold">Trạng thái SSE</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 capitalize">
                  {jobStage.replace("_", " ")}
                </p>
              </div>
            </div>

            {/* Live Terminal Log Stream */}
            <div className="max-w-3xl mx-auto bg-black/90 dark:bg-black/95 text-emerald-400 rounded-xl p-4 font-mono text-xs border border-border/80 shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-neutral-400 text-[10px] uppercase font-bold tracking-wider">
                <span>Trực tiếp sự kiện máy chủ (SSE Event Stream)</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live
                </span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {statusLogs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed">
                    <span className="text-neutral-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Write to smart contract */}
      {step === 3 && (
        <Card className="border border-border">
          <CardContent className="p-8 text-center space-y-6">
            <Clock className="h-16 w-16 mx-auto text-amber-500 animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-foreground">
                Mỏ neo niềm tin sẵn sàng (Trust Anchor)
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Toàn bộ chữ ký đã được tạo thành công off-chain. Bây giờ bạn cần thực hiện 01 giao dịch duy nhất trên Blockchain để lưu mỏ neo Merkle Root. Điều này xác thực toàn bộ đợt cấp phát.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-muted/20 border border-border rounded-xl p-4 text-left divide-y divide-border text-sm">
              <div className="py-2 flex justify-between">
                <span className="text-muted-foreground font-semibold">Mã đợt (Batch ID):</span>
                <span className="font-bold text-foreground">{batchId}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-muted-foreground font-semibold">Tổng chứng chỉ:</span>
                <span className="font-bold text-foreground">{size}</span>
              </div>
              <div className="py-2 flex flex-col gap-1 items-start">
                <span className="text-muted-foreground font-semibold">Merkle Root:</span>
                <span className="font-mono text-xs text-foreground bg-background p-1.5 rounded border border-border w-full block truncate">
                  {merkleRoot}
                </span>
              </div>
              {ipfsCid && (
                <div className="py-2 flex flex-col gap-1 items-start">
                  <span className="text-muted-foreground font-semibold">IPFS Metadata CID:</span>
                  <span className="font-mono text-xs text-foreground bg-background p-1.5 rounded border border-border w-full block truncate">
                    {ipfsCid}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                disabled={loading}
              >
                Hủy đợt này
              </Button>
              <Button
                onClick={handleAnchorOnChain}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Xác nhận Neo Blockchain (anchorBatch)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success confirmation */}
      {step === 4 && (
        <Card className="border-2 border-emerald-500/20 dark:border-emerald-500/10 shadow-lg">
          <CardContent className="p-8 text-center space-y-6 bg-gradient-to-b from-emerald-500/5 to-transparent">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle className="h-10 w-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground">
                Cấp phát Batch tốt nghiệp thành công!
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Chứng chỉ số đợt <strong className="text-foreground">{batchId}</strong> đã được lưu trữ bảo mật trong cơ sở dữ liệu. Mỏ neo niềm tin (Merkle Root) đã được công khai trên blockchain Sepolia.
              </p>
            </div>

            <div className="max-w-md mx-auto bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 text-left divide-y divide-emerald-100/50 dark:divide-emerald-900/30 text-sm">
              <div className="py-2 flex justify-between">
                <span className="text-muted-foreground">Mã đợt (Batch ID):</span>
                <span className="font-bold text-foreground">{batchId}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-muted-foreground">Tổng chứng chỉ:</span>
                <span className="font-bold text-foreground">{size}</span>
              </div>
              <div className="py-2 flex flex-col gap-1 items-start">
                <span className="text-muted-foreground">Giao dịch Hash (txHash):</span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-background p-1.5 rounded border border-border w-full flex items-center justify-between hover:underline"
                >
                  <span className="truncate block mr-2">{txHash}</span>
                  <Download className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>

            <div className="flex justify-center pt-4 gap-4">
              <Link href="/admin/v3">
                <Button variant="outline">Quay lại Dashboard</Button>
              </Link>
              <Button
                onClick={() => {
                  setStep(1);
                  setBatchId("");
                  setCsvData([]);
                  setErrors([]);
                  setFileName("");
                  setMerkleRoot("");
                  setIpfsCid("");
                  setSize(0);
                  setTxHash("");
                }}
              >
                Tiếp tục cấp Batch mới
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
