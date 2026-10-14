"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  MoreHorizontal,
  Move,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CloudinaryUploadButton,
  type CloudinaryUploadResult,
} from "@/components/cloudinary-upload-button";
import { useAuth } from "@/lib/auth-context";
import {
  createWeddingFile,
  createWeddingFolder,
  deleteWeddingFile,
  deleteWeddingFolder,
  updateWeddingFile,
  updateWeddingFolder,
  useAllWeddingFolders,
  useWeddingFiles,
  useWeddingFolders,
} from "@/lib/collections/wedding-files";
import type { WeddingFile, WeddingFolder } from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt,image/*";
const FILE_CATEGORY_OPTIONS = [
  "Venue",
  "Makeup",
  "Wedding Organizer",
  "Bride Dress",
  "Decoration",
  "Food & Catering",
  "Groom Suit",
  "Invitations",
  "Music/DJ",
  "Photography & Video",
  "Transportation",
  "Wedding Cake",
  "Guest Documents",
  "Contracts",
  "Inspiration",
  "Other",
];

function formatFileSize(bytes: number) {
  if (!bytes) return "Size unavailable";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return "Just uploaded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function getFolderLabel(folder: WeddingFolder, folders: WeddingFolder[]) {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const parts = [folder.name];
  let parentId = folder.parentId;
  const seen = new Set<string>();

  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentId;
  }

  return parts.join(" / ");
}

function FileTypeIcon({ file }: { file: WeddingFile }) {
  const type = file.fileType.toLowerCase();
  const name = file.name.toLowerCase();
  const Icon = type.startsWith("image/")
    ? FileImage
    : type.includes("spreadsheet") || /\.(csv|xls|xlsx)$/.test(name)
      ? FileSpreadsheet
      : type.includes("zip") || /\.(zip|rar|7z)$/.test(name)
        ? FileArchive
        : FileText;

  return <Icon className="size-5 shrink-0 text-primary" />;
}

function FolderActions({
  folder,
  onRename,
  onDelete,
}: {
  folder: WeddingFolder;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${folder.name}`} />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileActions({
  file,
  onEdit,
  onMove,
  onDelete,
}: {
  file: WeddingFile;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${file.name}`} />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove}>
          <Move className="size-3.5" />
          Move
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function FilesPage() {
  const { user } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<WeddingFolder[]>([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderTarget, setFolderTarget] = useState<WeddingFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<WeddingFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileCategory, setFileCategory] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingFile, setMovingFile] = useState<WeddingFile | null>(null);
  const [moveFolderId, setMoveFolderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ filename: string; progress: number } | null>(null);

  const {
    data: folders,
    loading: foldersLoading,
    error: foldersError,
  } = useWeddingFolders(currentFolderId);
  const {
    data: files,
    loading: filesLoading,
    error: filesError,
  } = useWeddingFiles(currentFolderId);
  const { data: allFolders, error: allFoldersError } = useAllWeddingFolders();

  const currentFolder = breadcrumbs.at(-1) ?? null;
  const breadcrumbFolders = useMemo(
    () => breadcrumbs.map((folder) => allFolders.find((item) => item.id === folder.id) ?? folder),
    [allFolders, breadcrumbs],
  );
  const loading = foldersLoading || filesLoading;
  const dataError = foldersError ?? filesError ?? allFoldersError;

  const openFolder = useCallback((folder: WeddingFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((current) => [...current, folder]);
    setActionError(null);
  }, []);

  const goToBreadcrumb = useCallback((index: number) => {
    if (index < 0) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const next = breadcrumbFolders.slice(0, index + 1);
      setCurrentFolderId(next.at(-1)?.id ?? null);
      setBreadcrumbs(next);
    }
    setActionError(null);
  }, [breadcrumbFolders]);

  const openCreateFolder = useCallback(() => {
    setFolderTarget(null);
    setFolderName("");
    setFolderDialogOpen(true);
  }, []);

  const openRenameFolder = useCallback((folder: WeddingFolder) => {
    setFolderTarget(folder);
    setFolderName(folder.name);
    setFolderDialogOpen(true);
  }, []);

  const saveFolder = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;

    setActionError(null);
    try {
      if (folderTarget) {
        await updateWeddingFolder(folderTarget.id, name);
        setBreadcrumbs((current) => current.map((folder) => (
          folder.id === folderTarget.id ? { ...folder, name } : folder
        )));
      } else {
        await createWeddingFolder(name, currentFolderId, user?.email ?? user?.uid ?? null);
      }
      setFolderDialogOpen(false);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Could not save the folder.");
    }
  }, [currentFolderId, folderName, folderTarget, user]);

  const handleDeleteFolder = useCallback(async (folder: WeddingFolder) => {
    if (!window.confirm(`Delete “${folder.name}”? Empty folders only can be deleted.`)) return;
    setActionError(null);
    try {
      await deleteWeddingFolder(folder.id);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Could not delete the folder.");
    }
  }, []);

  const openEditFile = useCallback((file: WeddingFile) => {
    setEditingFile(file);
    setFileName(file.name);
    setFileCategory(file.category);
    setFileDescription(file.description);
    setFileDialogOpen(true);
  }, []);

  const handleUpload = useCallback(async (
    url: string,
    filename?: string,
    result?: CloudinaryUploadResult,
  ) => {
    setActionError(null);
    try {
      const name = filename || result?.originalFilename || "Uploaded file";
      const created = await createWeddingFile({
        name,
        category: "",
        folderId: currentFolderId,
        url,
        publicId: result?.publicId,
        resourceType: result?.resourceType,
        originalFilename: result?.originalFilename ?? name,
        fileType: result?.mimeType,
        fileSize: result?.bytes,
        uploadedBy: user?.email ?? user?.uid ?? null,
      });
      setEditingFile({
        id: created.id,
        name,
        category: "",
        description: "",
        folderId: currentFolderId,
        url,
        publicId: result?.publicId ?? "",
        resourceType: result?.resourceType ?? "auto",
        originalFilename: result?.originalFilename ?? name,
        fileType: result?.mimeType ?? "",
        fileSize: result?.bytes ?? 0,
        uploadedBy: user?.email ?? user?.uid ?? null,
        createdAt: null,
        updatedAt: null,
      });
      setFileName(name);
      setFileCategory("");
      setFileDescription("");
      setFileDialogOpen(true);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "The upload succeeded but its details could not be saved.");
    }
  }, [currentFolderId, user]);

  const saveFileDetails = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFile) return;
    const name = fileName.trim();
    if (!name) return;

    setActionError(null);
    try {
      await updateWeddingFile(editingFile.id, {
        name,
        category: fileCategory,
        description: fileDescription,
      });
      setFileDialogOpen(false);
      setEditingFile(null);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Could not save file details.");
    }
  }, [editingFile, fileCategory, fileDescription, fileName]);

  const handleDeleteFile = useCallback(async (file: WeddingFile) => {
    if (!window.confirm(`Delete “${file.name}” from the file list?`)) return;
    setActionError(null);
    try {
      await deleteWeddingFile(file.id);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Could not delete the file.");
    }
  }, []);

  const openMoveFile = useCallback((file: WeddingFile) => {
    setMovingFile(file);
    setMoveFolderId(file.folderId);
    setMoveDialogOpen(true);
  }, []);

  const saveMove = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!movingFile) return;
    setActionError(null);
    try {
      await updateWeddingFile(movingFile.id, { folderId: moveFolderId });
      setMoveDialogOpen(false);
      setMovingFile(null);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Could not move the file.");
    }
  }, [moveFolderId, movingFile]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Wedding Files</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep contracts, inspiration, guest documents, and other wedding files organized in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CloudinaryUploadButton
            label="Upload files"
            accept={ACCEPTED_FILE_TYPES}
            maxFileBytes={MAX_FILE_BYTES}
            onUpload={handleUpload}
            onUploadProgress={(progress, filename) => {
              setUploadProgress(progress < 100 ? { filename, progress } : null);
            }}
          />
          <Button variant="outline" onClick={openCreateFolder} className="gap-1.5">
            <FolderPlus className="size-4" />
            New folder
          </Button>
        </div>
      </div>

      {(dataError || actionError) && (
        <p className="text-sm text-destructive">{dataError ?? actionError}</p>
      )}

      {uploadProgress && (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Upload className="size-4 shrink-0 text-primary" />
              <span className="truncate">Uploading {uploadProgress.filename}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{uploadProgress.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${uploadProgress.progress}%` }} />
          </div>
        </div>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <nav className="flex items-center gap-1 overflow-x-auto text-sm" aria-label="File location">
            <Button
              variant={currentFolderId === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => goToBreadcrumb(-1)}
              className="shrink-0 gap-1.5"
            >
              <Home className="size-3.5" />
              All files
            </Button>
            {breadcrumbFolders.map((folder, index) => (
              <span key={folder.id} className="flex shrink-0 items-center gap-1">
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <Button
                  variant={index === breadcrumbFolders.length - 1 ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => goToBreadcrumb(index)}
                  className="max-w-48 truncate"
                >
                  {folder.name}
                </Button>
              </span>
            ))}
          </nav>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="size-4 text-primary" />
                Folders
                <span className="ml-auto text-xs font-normal text-muted-foreground">{folders.length}</span>
              </CardTitle>
              <CardDescription>
                {currentFolder ? `Folders inside ${currentFolder.name}` : "Create folders for each part of your wedding."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {folders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Folder className="size-8 text-primary/70" />
                  <p className="text-sm font-medium">No folders here yet</p>
                  <p className="text-xs text-muted-foreground">Create one to start organizing your files.</p>
                  <Button variant="outline" size="sm" onClick={openCreateFolder} className="mt-1 gap-1.5">
                    <FolderPlus className="size-3.5" />
                    New folder
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {folders.map((folder) => (
                    <div key={folder.id} className="group flex min-w-0 items-center gap-2 rounded-xl border border-border/70 p-2.5 transition-colors hover:bg-accent/40">
                      <button type="button" onClick={() => openFolder(folder)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <Folder className="size-5 shrink-0 text-primary" />
                        <span className="min-w-0 truncate text-sm font-medium">{folder.name}</span>
                      </button>
                      <FolderActions
                        folder={folder}
                        onRename={() => openRenameFolder(folder)}
                        onDelete={() => void handleDeleteFolder(folder)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Files
                <span className="ml-auto text-xs font-normal text-muted-foreground">{files.length}</span>
              </CardTitle>
              <CardDescription>
                {currentFolder ? `Files inside ${currentFolder.name}` : "Files not assigned to a folder appear here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {files.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FileText className="size-8 text-primary/70" />
                  <p className="text-sm font-medium">No files here yet</p>
                  <p className="text-xs text-muted-foreground">Upload a file and add its name, category, and description when prompted.</p>
                  <CloudinaryUploadButton
                    label="Upload a file"
                    size="sm"
                    variant="outline"
                    accept={ACCEPTED_FILE_TYPES}
                    maxFileBytes={MAX_FILE_BYTES}
                    onUpload={handleUpload}
                    onUploadProgress={(progress, filename) => {
                      setUploadProgress(progress < 100 ? { filename, progress } : null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/60">
                  {files.map((file) => (
                    <div key={file.id} className="flex min-w-0 items-start gap-3 py-3 first:pt-1 last:pb-1">
                      <FileTypeIcon file={file} />
                      <div className="min-w-0 flex-1">
                        <a href={file.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-foreground hover:underline" title={file.name}>
                          {file.name}
                        </a>
                        {file.category && (
                          <Badge variant="secondary" className="mt-1 max-w-full truncate">
                            {file.category}
                          </Badge>
                        )}
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {file.description || "No description yet"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          {formatFileSize(file.fileSize)} · {formatDate(file.updatedAt ?? file.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button variant="ghost" size="icon-sm" render={<a href={file.url} target="_blank" rel="noreferrer" />} aria-label={`Open ${file.name}`}>
                          <Download className="size-4" />
                        </Button>
                        <FileActions
                          file={file}
                          onEdit={() => openEditFile(file)}
                          onMove={() => openMoveFile(file)}
                          onDelete={() => void handleDeleteFile(file)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderTarget ? "Rename folder" : "New folder"}</DialogTitle>
            <DialogDescription>
              {folderTarget ? "Choose a clearer name for this folder." : "Create a folder for a wedding-related category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveFolder(event)} className="flex flex-col gap-4">
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="e.g. Venue contracts"
              aria-label="Folder name"
              autoFocus
              maxLength={120}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!folderName.trim()}>Save folder</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File details</DialogTitle>
            <DialogDescription>
              Add a clear name, category, and short note so you know what this file is later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveFileDetails(event)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="file-name" className="text-xs font-medium">Name</label>
              <Input id="file-name" value={fileName} onChange={(event) => setFileName(event.target.value)} maxLength={160} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="file-category" className="text-xs font-medium">Category <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                id="file-category"
                list="file-category-options"
                value={fileCategory}
                onChange={(event) => setFileCategory(event.target.value)}
                placeholder="e.g. Makeup or Wedding Organizer"
                maxLength={80}
              />
              <datalist id="file-category-options">
                {FILE_CATEGORY_OPTIONS.map((category) => <option key={category} value={category} />)}
              </datalist>
              <p className="text-[11px] text-muted-foreground">Choose a suggestion or type your own category.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="file-description" className="text-xs font-medium">Description</label>
              <Textarea
                id="file-description"
                value={fileDescription}
                onChange={(event) => setFileDescription(event.target.value)}
                placeholder="e.g. Final catering proposal with the vegetarian menu"
                maxLength={500}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFileDialogOpen(false)}>Skip for now</Button>
              <Button type="submit" disabled={!fileName.trim()}>Save details</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>
              Choose where “{movingFile?.name}” should be stored.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveMove(event)} className="flex flex-col gap-4">
            <select
              value={moveFolderId ?? ""}
              onChange={(event) => setMoveFolderId(event.target.value || null)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Destination folder"
            >
              <option value="">All files (root)</option>
              {allFolders
                .filter((folder) => folder.id !== movingFile?.id)
                .map((folder) => (
                  <option key={folder.id} value={folder.id}>{getFolderLabel(folder, allFolders)}</option>
                ))}
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Move file</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
