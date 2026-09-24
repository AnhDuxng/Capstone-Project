"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { checkUserRole, UserRole } from "@/lib/roles";
import { checkUserRoleV3, UserRoleV3 } from "@/lib/v3/roles";
import {
  LayoutDashboard,
  FileInput,
  ClipboardList,
  HelpCircle,
  ChevronDown,
  FileText,
  Shield,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  requiresAdmin?: boolean; // Only show for admin users
  requiresIssuer?: boolean; // Only show for issuer users
  children?: {
    title: string;
    href: string;
  }[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Phân quyền phát hành",
    href: "/admin/batches",
    icon: Shield,
    requiresAdmin: true, // Only admins can manage roles
  },
  {
    title: "Nhập văn bằng",
    icon: FileInput,
    requiresIssuer: true, // Issuers can create certificates
    children: [
      {
        title: "Thêm mới một văn bằng",
        href: "/admin/certificates/add",
      },
      {
        title: "Thêm mới nhiều văn bằng từ file Excel",
        href: "/admin/certificates/import",
      },
      {
        title: "Tra cứu văn bằng từ file Excel",
        href: "/admin/certificates/search-excel",
      },
    ],
  },
  {
    title: "Quản lý & Thu hồi",
    href: "/admin/certificates/status",
    icon: ClipboardList,
    requiresIssuer: true, // Issuers can manage/revoke their certificates
  },
  {
    title: "Hướng dẫn / Mẫu Excel",
    href: "/admin/guide",
    icon: HelpCircle,
  },
];

const navItemsV3: NavItem[] = [
  {
    title: "Dashboard V3",
    href: "/admin/v3",
    icon: LayoutDashboard,
  },
  {
    title: "Quản lý Signers V3",
    href: "/admin/v3/signers",
    icon: Shield,
    requiresAdmin: true,
  },
  {
    title: "Nhập & Phát hành V3",
    icon: FileInput,
    requiresIssuer: true,
    children: [
      {
        title: "Phát hành Batch mới",
        href: "/admin/v3/issue",
      },
      {
        title: "Lịch sử Batches",
        href: "/admin/v3/batches",
      },
    ],
  },
  {
    title: "Quản lý & Thu hồi V3",
    href: "/admin/v3/revoke",
    icon: ClipboardList,
    requiresIssuer: true,
  },
  {
    title: "Quay lại Phase 2",
    href: "/admin",
    icon: HelpCircle,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isV3 = pathname.startsWith("/admin/v3");
  const currentNavItems = isV3 ? navItemsV3 : navItems;

  const [expandedItems, setExpandedItems] = useState<string[]>(
    isV3 ? ["Nhập & Phát hành V3"] : ["Nhập văn bằng"]
  );
  const [userRole, setUserRole] = useState<UserRole | UserRoleV3 | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  // Check user role on mount and when wallet changes
  useEffect(() => {
    async function fetchRole() {
      if (!authenticated || !wallets || wallets.length === 0) {
        setUserRole(null);
        setLoadingRole(false);
        return;
      }

      setLoadingRole(true);
      try {
        const activeWallet = wallets[0];
        const role = isV3 
          ? await checkUserRoleV3(activeWallet as { getEthereumProvider: () => Promise<unknown> })
          : await checkUserRole(activeWallet as { getEthereumProvider: () => Promise<unknown> });
        setUserRole(role);
      } catch (error) {
        console.error("Error checking role:", error);
        setUserRole(null);
      } finally {
        setLoadingRole(false);
      }
    }

    fetchRole();
  }, [authenticated, wallets, isV3]);

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return false;
  };

  // Filter nav items based on user role
  const filteredNavItems = currentNavItems.filter((item) => {
    // If requires admin and user is not admin, hide
    if (item.requiresAdmin && !userRole?.isAdmin) {
      return false;
    }
    // If requires issuer and user is not issuer, hide
    if (item.requiresIssuer && !userRole?.isIssuer) {
      return false;
    }
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">CertifyChain</span>
          <span className="text-xs text-muted-foreground">Admin Dashboard</span>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-3 py-3 border-b border-sidebar-border">
        {loadingRole ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Đang kiểm tra quyền...</span>
          </div>
        ) : userRole ? (
          <div className="space-y-1">
            {userRole.isAdmin && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Admin</span>
              </div>
            )}
            {userRole.isIssuer && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10">
                <Shield className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">Issuer</span>
              </div>
            )}
            {!userRole.isAdmin && !userRole.isIssuer && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                <span className="text-xs text-muted-foreground">Không có quyền</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <span className="text-xs text-muted-foreground">Chưa kết nối ví</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => (
            <li key={item.title}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleExpand(item.title)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isParentActive(item)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-hover"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        expandedItems.includes(item.title) && "rotate-180"
                      )}
                    />
                  </button>
                  {expandedItems.includes(item.title) && (
                    <ul className="mt-1 space-y-1 pl-4">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-sidebar-hover"
                            )}
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                            <span className="line-clamp-1">{child.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href!}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href!)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-hover"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Wallet Address */}
      {userRole?.walletAddress && (
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="px-3 py-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Ví đang kết nối</p>
            <p className="text-xs font-mono text-foreground">
              {userRole.walletAddress.slice(0, 8)}...{userRole.walletAddress.slice(-6)}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
