import { StaffSidebar } from "./staff-sidebar";
import { StaffHeader } from "./staff-header";

export function StaffShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* 1. Header nằm trên cùng, kéo dài 100% chiều ngang */}
      <StaffHeader />

      {/* 2. Phần thân gồm Sidebar và Main Content nằm bên dưới */}
      <div className="flex flex-1">
        <StaffSidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}