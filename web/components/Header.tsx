"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Trang chủ" },
    { href: "/holder", label: "Cổng Sinh Viên" },
    { href: "/v3/verify", label: "Xác thực V3" },
    { href: "/admin/v3", label: "Quản trị V3" },
  ];

  return (
    <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50" suppressHydrationWarning>
      <div className="container mx-auto px-6 py-4" suppressHydrationWarning>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <ShieldCheck className="h-8 w-8 text-blue-600 group-hover:text-blue-500 transition-colors" />
            <span className="text-xl font-semibold text-gray-900">
              BK Credential
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
