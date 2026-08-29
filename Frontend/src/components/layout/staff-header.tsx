"use client";

import Image from "next/image";
import { LogOut, Bell, Search, CircleUserRound } from "lucide-react";
import { useAuthStore } from "@/features/auth/store";
import { useLogout } from "@/features/auth/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function StaffHeader({ showSearch = true }: { showSearch?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  const userInitials =
    user?.profile?.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase() ||
    user?.email?.[0].toUpperCase() ||
    "U";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 sm:h-20 sm:px-6">
      {/* 1. Góc trái: Logo và Tên */}
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Chilling Hospital Logo"
          width={40}
          height={40}
          className="h-9 w-9 sm:h-10 sm:w-10"
        />
        <div className="flex flex-col">
          <span className="text-base font-bold text-sky-900 sm:text-xl">Chilling Hospital</span>
          <span className="hidden text-xs text-sky-600 sm:block">Smart Care, Chill Life</span>
        </div>
      </div>

      {/* 2. Giữa: Thanh tìm kiếm */}
      <div className={showSearch ? "hidden flex-1 px-8 lg:block xl:px-12" : "hidden"}>
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Tìm kiếm bác sĩ, bệnh nhân, phòng khám,..."
            className="w-full rounded-full bg-slate-100 pl-10 pr-4 text-sm focus-visible:ring-sky-500"
          />
        </div>
      </div>

      {/* 3. Góc phải: Thông báo và User Menu */}
      <div className="flex items-center gap-2 sm:gap-5">
        {/* Icon Thông báo */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-sky-600">
            <Bell className="h-6 w-6" />
          </Button>
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            2
          </span>
        </div>

        {/* User Menu Dropdown (Base UI tương thích) */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus:ring-2 focus:ring-sky-500">
            <Avatar className="h-10 w-10 border border-slate-200 cursor-pointer">
              <AvatarFallback className="bg-sky-100 text-sky-700 font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-slate-900">
                  {user?.profile?.fullName ?? user?.email}
                </p>
                <p className="text-xs leading-none text-slate-500">
                  {user?.role === "ADMIN" ? "Admin" : "Doctor"} — {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <CircleUserRound className="mr-2 h-4 w-4" />
              <span>Hồ sơ cá nhân</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{logout.isPending ? "Đang đăng xuất..." : "Đăng xuất"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
