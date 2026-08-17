"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CameraForm, type CameraFormValues } from "./camera-form";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { Camera, CameraSourceType } from "@/modules/camera/types";
import { usePermissions } from "@/hooks/use-permissions";

const statusConfig: Record<string, { label: string; className: string }> = {
  ONLINE: { label: "آنلاین", className: "bg-green-100 text-green-700" },
  OFFLINE: { label: "آفلاین", className: "bg-red-100 text-red-700" },
  UNKNOWN: { label: "نامشخص", className: "bg-gray-100 text-gray-500" },
};

type VideoSelection = { sourceType: CameraSourceType; file: File | null };

function locationLabel(camera: Camera): string {
  if (camera.booth) return `غرفه ${camera.booth.number}`;
  if (camera.market) return camera.market.name;
  if (camera.field) return camera.field.name;
  return "—";
}

async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch("/api/cameras");
  if (!res.ok) throw new Error("خطا در دریافت دوربین‌ها");
  const json = await res.json();
  return json.data;
}

async function createCamera(
  data: CameraFormValues,
  sourceType: CameraSourceType,
): Promise<Camera> {
  const payload = {
    ...data,
    // A VIDEO_FILE camera's streamUrl is set by uploadCameraVideo() below,
    // once the video-analytics service reports where it republished the file.
    streamUrl: sourceType === "RTSP" ? data.streamUrl || undefined : undefined,
    fieldId: data.fieldId || undefined,
    marketId: data.marketId || undefined,
    boothId: data.boothId || undefined,
  };
  const res = await fetch("/api/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("خطا در ایجاد دوربین");
  const json = await res.json();
  return json.data;
}

async function updateCamera(
  id: string,
  data: CameraFormValues,
  sourceType: CameraSourceType,
): Promise<Camera> {
  const payload: Record<string, unknown> = {
    name: data.name,
    status: data.status,
    fieldId: data.fieldId || null,
    marketId: data.marketId || null,
    boothId: data.boothId || null,
  };
  // Only include streamUrl when the RTSP form is actually submitted — the API
  // treats its presence as "the user wants RTSP mode" and stops/detaches any
  // video-file publisher. Omitting it here on a plain VIDEO_FILE edit (name,
  // location, ...) keeps the existing virtual camera running untouched.
  if (sourceType === "RTSP") {
    payload.streamUrl = data.streamUrl || null;
  }
  const res = await fetch(`/api/cameras/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("خطا در ویرایش دوربین");
  const json = await res.json();
  return json.data;
}

async function uploadCameraVideo(id: string, file: File): Promise<Camera> {
  const formData = new FormData();
  formData.append("video", file);
  const res = await fetch(`/api/cameras/${id}/video`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string" ? body.error : "خطا در بارگذاری ویدیو",
    );
  }
  const json = await res.json();
  return json.data;
}

async function deleteCamera(id: string): Promise<void> {
  const res = await fetch(`/api/cameras/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("خطا در حذف دوربین");
}

export function CamerasClient() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Camera | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const { can } = usePermissions();
  const canCreate = can("camera", "create");
  const canEdit = can("camera", "update");
  const canDelete = can("camera", "delete");

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: fetchCameras,
  });

  const createMutation = useMutation({
    mutationFn: async ({
      data,
      video,
    }: {
      data: CameraFormValues;
      video: VideoSelection;
    }) => {
      const camera = await createCamera(data, video.sourceType);
      if (video.sourceType === "VIDEO_FILE" && video.file) {
        return uploadCameraVideo(camera.id, video.file);
      }
      return camera;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
      setCreateOpen(false);
      setMutationError(null);
    },
    onError: (e: Error) => setMutationError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      video,
    }: {
      id: string;
      data: CameraFormValues;
      video: VideoSelection;
    }) => {
      const camera = await updateCamera(id, data, video.sourceType);
      if (video.sourceType === "VIDEO_FILE" && video.file) {
        return uploadCameraVideo(id, video.file);
      }
      return camera;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
      setEditTarget(null);
      setMutationError(null);
    },
    onError: (e: Error) => setMutationError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCamera,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cameras"] });
      toast.success("دوربین با موفقیت حذف شد");
    },
    onError: () => toast.error("خطا در حذف دوربین"),
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">دوربین‌ها</h1>
        {canCreate && (
          <Button
            onClick={() => {
              setCreateOpen(true);
              setMutationError(null);
            }}
          >
            + افزودن دوربین
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : cameras.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ دوربینی ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>مکان</TableHead>
              <TableHead>آدرس استریم</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-36">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.map((camera) => {
              const status =
                statusConfig[camera.status] ?? statusConfig.UNKNOWN;
              return (
                <TableRow key={camera.id}>
                  <TableCell className="font-medium">{camera.name}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell>{locationLabel(camera)}</TableCell>
                  <TableCell className="max-w-50 truncate text-xs text-gray-500">
                    {camera.sourceType === "VIDEO_FILE" ? (
                      <span dir="rtl">ویدیو آپلودی: {camera.videoFileName ?? "—"}</span>
                    ) : (
                      <span dir="ltr">{camera.streamUrl ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(camera.createdAt).toLocaleDateString("fa-IR")}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <div className="flex gap-2">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditTarget(camera);
                              setMutationError(null);
                            }}
                          >
                            ویرایش
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleteTarget(camera)}
                          >
                            حذف
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        description="آیا از حذف این دوربین مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />

      {/* Create dialog */}
      {canCreate && (
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setMutationError(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن دوربین جدید</DialogTitle>
            </DialogHeader>
            {mutationError && createOpen && (
              <p className="text-sm text-red-500">{mutationError}</p>
            )}
            <CameraForm
              onSubmit={(data, video) => createMutation.mutate({ data, video })}
              onCancel={() => setCreateOpen(false)}
              isPending={createMutation.isPending}
              submitLabel="ایجاد"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      {canEdit && (
        <Dialog
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
              setMutationError(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ویرایش دوربین</DialogTitle>
            </DialogHeader>
            {mutationError && !!editTarget && (
              <p className="text-sm text-red-500">{mutationError}</p>
            )}
            {editTarget && (
              <CameraForm
                defaultValues={{
                  name: editTarget.name,
                  streamUrl: editTarget.sourceType === "RTSP" ? editTarget.streamUrl ?? "" : "",
                  status: editTarget.status,
                  fieldId: editTarget.fieldId ?? "",
                  marketId: editTarget.marketId ?? "",
                  boothId: editTarget.boothId ?? "",
                }}
                defaultSourceType={editTarget.sourceType}
                currentVideoFileName={editTarget.videoFileName}
                currentVideoUploadedAt={editTarget.videoUploadedAt}
                onSubmit={(data, video) =>
                  updateMutation.mutate({ id: editTarget.id, data, video })
                }
                onCancel={() => setEditTarget(null)}
                isPending={updateMutation.isPending}
                submitLabel="ذخیره تغییرات"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
