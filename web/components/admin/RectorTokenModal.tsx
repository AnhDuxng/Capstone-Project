"use client";

import React, { useRef, useState } from "react";
import { Wallet } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Usb, KeyRound, Loader2, ShieldCheck, X, FileKey } from "lucide-react";
import { buildRectorApprovalMessage } from "@/lib/v3/rectorApproval";
import toast from "react-hot-toast";

export interface RectorApproval {
  rectorAddress: string;
  approvedAt: number;
  signature: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApproved: (approval: RectorApproval) => void;
  batchId: string;
  merkleRoot: string;
  size: number;
  chainId: number;
}

const RECTOR_NAME = process.env.NEXT_PUBLIC_RECTOR_NAME || "Hiệu trưởng";
const RECTOR_ADDRESS = process.env.NEXT_PUBLIC_RECTOR_ADDRESS || "";

/**
 * Rector USB Token modal.
 * Reads the encrypted keystore from the USB drive (user picks the file),
 * decrypts it locally with the PIN, signs the batch approval, then wipes the key.
 * The private key is never sent to the server.
 */
export default function RectorTokenModal({ open, onClose, onApproved, batchId, merkleRoot, size, chainId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [keystore, setKeystore] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  if (!open) return null;

  const reset = () => {
    setKeystore("");
    setFileName("");
    setPin("");
    setStage("");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!parsed.crypto && !parsed.Crypto) throw new Error("not keystore");
      setKeystore(text);
      setFileName(f.name);
    } catch {
      toast.error("Tệp không phải keystore hợp lệ của USB Token");
    }
  };

  const handleSign = async () => {
    if (!keystore || !pin) return;
    setBusy(true);
    let wallet: Wallet | null = null;
    try {
      setStage("Đang giải mã khóa bằng PIN (scrypt)...");
      const w = await Wallet.fromEncryptedJson(keystore, pin);
      wallet = w as Wallet;

      if (RECTOR_ADDRESS && wallet.address.toLowerCase() !== RECTOR_ADDRESS.toLowerCase()) {
        throw new Error("USB Token không thuộc về Hiệu trưởng đã đăng ký");
      }

      setStage("Đang ký phê duyệt đợt cấp phát...");
      const approvedAt = Math.floor(Date.now() / 1000);
      const message = buildRectorApprovalMessage({ batchId, merkleRoot, size, chainId, approvedAt });
      const signature = await wallet.signMessage(message);

      setStage("Máy chủ đang xác minh chữ ký...");
      const res = await fetch("/api/v3/rector/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, merkleRoot, size, chainId, approvedAt, signature }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Máy chủ từ chối phê duyệt");

      toast.success("Xác thực thẩm quyền Hiệu trưởng thành công");
      onApproved({ rectorAddress: data.rectorAddress, approvedAt, signature });
      reset();
    } catch (e) {
      const err = e as Error;
      const msg = /invalid password|incorrect password/i.test(err.message) ? "Sai mã PIN" : err.message;
      toast.error(msg);
      setStage("");
    } finally {
      wallet = null; // drop reference to decrypted key
      setPin("");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 text-left">
        <button
          onClick={() => { reset(); onClose(); }}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          disabled={busy}
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-red-600 p-3 text-white shadow">
            <Usb className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-foreground">Xác thực USB Token Hiệu trưởng</h3>
            <p className="text-xs text-muted-foreground">{RECTOR_NAME}</p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Đợt:</span><span className="font-bold">{batchId}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Số chứng chỉ:</span><span className="font-bold">{size}</span></div>
          <div className="flex flex-col"><span className="text-muted-foreground">Merkle Root:</span><span className="font-mono truncate">{merkleRoot}</span></div>
        </div>

        {/* Step 1: pick keystore on USB */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">1. Cắm USB và chọn tệp khóa</label>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          <Button
            id="rector-pick-keystore"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <FileKey className="h-4 w-4" />
            {fileName ? <span className="truncate">{fileName}</span> : "Chọn rector.keystore.json trên USB..."}
          </Button>
          {fileName && <p className="text-xs text-emerald-600 font-semibold">✓ Đã đọc USB Token</p>}
        </div>

        {/* Step 2: PIN */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground">2. Nhập mã PIN</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="rector-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSign()}
              placeholder="••••••"
              className="pl-9 tracking-widest"
              disabled={!keystore || busy}
              autoComplete="off"
            />
          </div>
        </div>

        {stage && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {stage}
          </p>
        )}

        <Button
          id="rector-sign-approval"
          onClick={handleSign}
          disabled={!keystore || !pin || busy}
          className="w-full bg-gradient-to-r from-amber-600 to-red-600 text-white font-bold gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Ký số phê duyệt
        </Button>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Khóa ký chỉ được giải mã trong trình duyệt và bị hủy ngay sau khi ký; máy chủ chỉ nhận chữ ký.
        </p>
      </div>
    </div>
  );
}
