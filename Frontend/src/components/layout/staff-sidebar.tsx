"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserSquare2,      // Thay cho Stethoscope
  CalendarDays,     // Thay cho CalendarClock
  ShieldCheck,      // Thay cho Tags (Loại phòng khám)
  LayoutGrid,       // Thay cho DoorOpen (Phòng khám vật lý)
  QrCode,           // Thay cho Smartphone (Thiết bị QR)
  ListChecks,       // Thay cho ClipboardList (Dịch vụ khám)
  UserCog2,         // Thay cho Users (Phân loại BN)
  Users,            // Thay cho Users (Danh sách BN)
  ListOrdered,
  Activity,         // Thay cho History (Nhật ký)
  // Lucide icons bổ sung cho các nhóm
} from "lucide-react";
import { cn } from "@/lib/utils";

// Định nghĩa cấu trúc item mới bao gồm nhóm (section)
const NAV_ITEMS = [
  { section: "TỔNG QUAN", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, built: true },
  ]},
  { section: "QUẢN LÝ BÁC SĨ", items: [
    { href: "/admin/doctors", label: "Bác sĩ", icon: UserSquare2, built: true },
    { href: "/admin/doctor-assignments", label: "Lịch trình & ca trực", icon: CalendarDays, built: true },
  ]},
  { section: "CƠ SỞ VẬT CHẤT", items: [
    { href: "/admin/room-types", label: "Loại phòng khám", icon: ShieldCheck, built: true },
    { href: "/admin/rooms", label: "Phòng khám vật lý", icon: LayoutGrid, built: true },
    { href: "/admin/devices", label: "Thiết bị QR", icon: QrCode, built: true },
  ]},
  { section: "DỊCH VỤ", items: [
    { href: "/admin/services", label: "Dịch vụ khám", icon: ListChecks, built: true },
  ]},
  { section: "QUẢN LÝ BỆNH NHÂN", items: [
    { href: "/admin/patient-types", label: "Phân loại bệnh nhân", icon: UserCog2, built: true },
    { href: "/admin/patients", label: "Danh sách bệnh nhân", icon: Users, built: true },
  ]},
  { section: "HỆ THỐNG", items: [
    { href: "/admin/queue", label: "Giám sát hàng đợi", icon: ListOrdered, built: true },
    { href: "/admin/activity-logs", label: "Nhật ký hoạt động", icon: Activity, built: true },
  ]},
] as const;

export function StaffSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <nav className="flex-1 space-y-6 p-4">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section} className="space-y-1.5">
            {/* Tiêu đề nhóm */}
            <h3 className="px-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              {section}
            </h3>
            
            {/* Các item trong nhóm */}
            {items.map(({ href, label, icon: Icon, built }) => {
              // Kiểm tra active chính xác hoặc là path con
              const isActive = href === "/admin" 
                ? pathname === "/admin" 
                : pathname === href || pathname.startsWith(`${href}/`);
              
              return (
                <Link
                  key={href}
                  href={built ? href : "#"}
                  aria-disabled={!built}
                  title={built ? undefined : "Sẽ có ở phase sau"}
                  className={cn(
                    "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                    // Style Active mới: nền xanh nhạt, chữ xanh đậm
                    isActive 
                      ? "bg-sky-100 text-sky-900" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    // Style cho item chưa built
                    !built && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-600",
                  )}
                  onClick={(e) => {
                    if (!built) e.preventDefault();
                  }}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-sky-700" : "text-slate-500")} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
