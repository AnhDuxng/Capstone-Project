"use client";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-gray-400 py-10" suppressHydrationWarning>
      <div className="container mx-auto px-6 text-center space-y-3" suppressHydrationWarning>
        <p className="text-sm">
          BK Credential System — Đồ án Tốt nghiệp HCMUT
        </p>
        <p className="text-xs" suppressHydrationWarning>
          © {new Date().getFullYear()} Trường Đại học Bách Khoa — ĐHQG TP.HCM.
          Khoa Khoa học và Kỹ thuật Máy tính.
        </p>
      </div>
    </footer>
  );
}
