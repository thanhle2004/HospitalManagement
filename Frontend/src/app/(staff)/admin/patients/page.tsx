"use client";

import { FormEvent, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Eye, Search, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePatientTypes } from "@/features/patient-types/hooks";
import { PatientDetailDialog } from "@/features/patients/components/patient-detail-dialog";
import { usePatients } from "@/features/patients/hooks";

const PAGE_SIZE = 20;

const GENDER_LABEL = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PatientsPage() {
  const patientTypes = usePatientTypes();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [patientTypeId, setPatientTypeId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const patients = usePatients({
    search: search || undefined,
    patientTypeId: patientTypeId ? Number(patientTypeId) : undefined,
    page,
    limit: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil((patients.data?.total ?? 0) / PAGE_SIZE));
  const hasFilters = !!search || !!patientTypeId;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setPatientTypeId("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Danh sách bệnh nhân</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tra cứu hồ sơ và quản lý phân loại bệnh nhân.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-100 p-3">
              <UsersRound className="h-6 w-6 text-sky-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">
                {hasFilters ? "Kết quả phù hợp" : "Tổng hồ sơ bệnh nhân"}
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {patients.isLoading ? "…" : patients.data?.total ?? 0}
              </p>
            </div>
          </div>
          <p className="max-w-md text-xs leading-5 text-slate-500">
            Thông tin định danh chỉ được dùng cho mục đích vận hành và không xuất hiện ngoài khu vực quản trị.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <form
          onSubmit={submitSearch}
          className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(280px,1fr)_260px_auto]"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, số điện thoại, email hoặc số giấy tờ..."
              aria-label="Tìm bệnh nhân"
              className="pl-9"
            />
          </div>
          <Select
            value={patientTypeId}
            aria-label="Lọc theo phân loại bệnh nhân"
            onChange={(event) => {
              setPatientTypeId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả phân loại</option>
            {patientTypes.data?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 lg:flex-none">
              Tìm kiếm
            </Button>
            {hasFilters && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Xoá lọc
              </Button>
            )}
          </div>
        </form>

        {patients.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-600" />
            <p className="text-sm font-medium text-slate-900">Không tải được danh sách bệnh nhân</p>
            <Button variant="outline" size="sm" onClick={() => patients.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bệnh nhân</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Giới tính</TableHead>
                <TableHead>Phân loại</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-24 text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    Đang tải bệnh nhân...
                  </TableCell>
                </TableRow>
              )}
              {!patients.isLoading && patients.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-slate-500">
                    {hasFilters ? "Không có bệnh nhân phù hợp bộ lọc" : "Chưa có hồ sơ bệnh nhân"}
                  </TableCell>
                </TableRow>
              )}
              {patients.data?.items.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{patient.fullName}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      #{patient.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p>{patient.phone}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{patient.email || "Chưa có email"}</p>
                  </TableCell>
                  <TableCell>
                    {patient.gender ? GENDER_LABEL[patient.gender] : "Chưa cập nhật"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={patient.patientType.code === "STANDARD" ? "default" : "info"}>
                      {patient.patientType.name}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(patient.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Xem hồ sơ ${patient.fullName}`}
                        title={`Xem hồ sơ ${patient.fullName}`}
                        onClick={() => setSelectedPatientId(patient.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!patients.isError && (patients.data?.total ?? 0) > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              Trang {page}/{totalPages} · {patients.data?.total ?? 0} hồ sơ
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || patients.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || patients.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Trang sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <PatientDetailDialog
        patientId={selectedPatientId}
        open={!!selectedPatientId}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedPatientId(null)}
      />
    </div>
  );
}
