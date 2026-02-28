"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Eye,
  MapPin,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Municipality, Issue, ISSUE_TYPES, INDIAN_STATES, MUNICIPALITY_TYPES } from "./types";

// ===========================================
// CREATE MUNICIPALITY DIALOG
// ===========================================
interface CreateMunicipalityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    name: string;
    type: string;
    state: string;
    district: string;
    north: string;
    south: string;
    east: string;
    west: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    name: string;
    type: string;
    state: string;
    district: string;
    north: string;
    south: string;
    east: string;
    west: string;
  }>>;
  onSubmit: () => void;
}

export function CreateMunicipalityDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: CreateMunicipalityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg">Create Municipality</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add a new municipality to the platform
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Municipality Name</Label>
            <Input
              placeholder="e.g., Municipal Corporation of Delhi"
              className="text-sm h-9"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUNICIPALITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">State</Label>
              <Select
                value={form.state}
                onValueChange={(value) => setForm((prev) => ({ ...prev, state: value }))}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state} className="text-sm">
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">District</Label>
            <Input
              placeholder="Enter district"
              className="text-sm h-9"
              value={form.district}
              onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Bounds (Coordinates)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="North"
                className="text-xs sm:text-sm h-8 sm:h-9"
                value={form.north}
                onChange={(e) => setForm((prev) => ({ ...prev, north: e.target.value }))}
              />
              <Input
                placeholder="South"
                className="text-xs sm:text-sm h-8 sm:h-9"
                value={form.south}
                onChange={(e) => setForm((prev) => ({ ...prev, south: e.target.value }))}
              />
              <Input
                placeholder="East"
                className="text-xs sm:text-sm h-8 sm:h-9"
                value={form.east}
                onChange={(e) => setForm((prev) => ({ ...prev, east: e.target.value }))}
              />
              <Input
                placeholder="West"
                className="text-xs sm:text-sm h-8 sm:h-9"
                value={form.west}
                onChange={(e) => setForm((prev) => ({ ...prev, west: e.target.value }))}
              />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Rectangular boundary for jurisdiction
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} className="w-full sm:w-auto text-xs sm:text-sm">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// EDIT MUNICIPALITY DIALOG
// ===========================================
interface EditMunicipalityDialogProps {
  open: boolean;
  municipality: Municipality | null;
  onOpenChange: (open: boolean) => void;
  form: {
    name: string;
    type: string;
    state: string;
    district: string;
    north: string;
    south: string;
    east: string;
    west: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    name: string;
    type: string;
    state: string;
    district: string;
    north: string;
    south: string;
    east: string;
    west: string;
  }>>;
  onSubmit: () => void;
}

export function EditMunicipalityDialog({
  open,
  municipality,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: EditMunicipalityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit Municipality</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Update municipality information</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 sm:space-y-4 py-2 sm:py-4">
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Municipality Name</Label>
            <Input
              className="h-9"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUNICIPALITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-xs sm:text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">State</Label>
              <Select
                value={form.state}
                onValueChange={(value) => setForm((prev) => ({ ...prev, state: value }))}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state} className="text-xs sm:text-sm">
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">District</Label>
            <Input
              className="h-9"
              value={form.district}
              onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
            />
          </div>
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Jurisdiction Bounds</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <Input
                className="h-8 sm:h-9 text-xs sm:text-sm"
                placeholder="North"
                value={form.north}
                onChange={(e) => setForm((prev) => ({ ...prev, north: e.target.value }))}
              />
              <Input
                className="h-8 sm:h-9 text-xs sm:text-sm"
                placeholder="South"
                value={form.south}
                onChange={(e) => setForm((prev) => ({ ...prev, south: e.target.value }))}
              />
              <Input
                className="h-8 sm:h-9 text-xs sm:text-sm"
                placeholder="East"
                value={form.east}
                onChange={(e) => setForm((prev) => ({ ...prev, east: e.target.value }))}
              />
              <Input
                className="h-8 sm:h-9 text-xs sm:text-sm"
                placeholder="West"
                value={form.west}
                onChange={(e) => setForm((prev) => ({ ...prev, west: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} className="w-full sm:w-auto text-xs sm:text-sm">
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// DELETE MUNICIPALITY DIALOG
// ===========================================
interface DeleteMunicipalityDialogProps {
  open: boolean;
  municipality: Municipality | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMunicipalityDialog({
  open,
  municipality,
  onOpenChange,
  onConfirm,
}: DeleteMunicipalityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            Delete Municipality
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Are you sure you want to delete <strong>{municipality?.name}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm} className="w-full sm:w-auto text-xs sm:text-sm">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// VIEW ISSUE DIALOG
// ===========================================
interface ViewIssueDialogProps {
  open: boolean;
  issue: Issue | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export function ViewIssueDialog({
  open,
  issue,
  onOpenChange,
  onEdit,
}: ViewIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
            Issue Details
          </DialogTitle>
        </DialogHeader>
        {issue && (
          <div className="space-y-3 sm:space-y-4">
            {/* Issue Image */}
            {issue.imageUrls && issue.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {issue.imageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Issue image ${i + 1}`}
                    className="w-full h-20 sm:h-32 md:h-48 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}

            {/* Issue Info */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div>
                <Label className="text-muted-foreground text-[10px] sm:text-xs">Type</Label>
                <p className="font-medium text-xs sm:text-sm">{issue.type?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-[10px] sm:text-xs">Status</Label>
                <Badge
                  variant={issue.status === "OPEN" ? "destructive" : "secondary"}
                  className="mt-0.5 text-[10px] sm:text-xs"
                >
                  {issue.status}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground text-[10px] sm:text-xs">Reported On</Label>
                <p className="font-medium text-xs sm:text-sm">
                  {issue.createdAt
                    ? new Date(issue.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Unknown"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-[10px] sm:text-xs">Reported By</Label>
                <p className="font-medium text-xs sm:text-sm truncate">{issue.reportedBy || "Anonymous"}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-[10px] sm:text-xs">Description</Label>
              <p className="mt-0.5 text-xs sm:text-sm">{issue.description}</p>
            </div>

            {issue.location && (
              <div>
                <Label className="text-muted-foreground text-[10px] sm:text-xs">Location</Label>
                <p className="flex items-center gap-1 mt-0.5 text-xs sm:text-sm">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{issue.location.address ||
                    `${issue.location.latitude}, ${issue.location.longitude}`}</span>
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Close
          </Button>
          <Button size="sm" onClick={onEdit} className="w-full sm:w-auto text-xs sm:text-sm">
            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// EDIT ISSUE DIALOG
// ===========================================
interface EditIssueDialogProps {
  open: boolean;
  issue: Issue | null;
  onOpenChange: (open: boolean) => void;
  form: {
    description: string;
    status: string;
    type: string;
    address: string;
    latitude: string;
    longitude: string;
    imageUrls: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<{
    description: string;
    status: string;
    type: string;
    address: string;
    latitude: string;
    longitude: string;
    imageUrls: string[];
  }>>;
  onSubmit: () => void;
}

export function EditIssueDialog({
  open,
  issue,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: EditIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
            Edit Issue
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update issue details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 sm:space-y-4 py-2 sm:py-4">
          {/* Status and Type Row */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN" className="text-xs sm:text-sm">Open</SelectItem>
                  <SelectItem value="CLOSED" className="text-xs sm:text-sm">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs sm:text-sm">
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm">Description</Label>
            <Textarea
              className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Location Section */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-semibold">Location</Label>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-[10px] sm:text-xs text-muted-foreground">Address</Label>
              <Input
                className="h-8 sm:h-9 text-xs sm:text-sm"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Address"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">Latitude</Label>
                <Input
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                  placeholder="Lat"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] sm:text-xs text-muted-foreground">Longitude</Label>
                <Input
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                  placeholder="Lng"
                />
              </div>
            </div>
          </div>

          {/* Images Section */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-semibold">Images</Label>
            {form.imageUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {form.imageUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Issue image ${index + 1}`}
                      className="w-full h-14 sm:h-20 object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-0.5 right-0.5 h-5 w-5 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          imageUrls: prev.imageUrls.filter((_, i) => i !== index),
                        }));
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-sm text-muted-foreground">No images</p>
            )}
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                id="newImageUrl"
                placeholder="Image URL"
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => {
                  const input = document.getElementById("newImageUrl") as HTMLInputElement;
                  if (input?.value?.trim()) {
                    setForm((prev) => ({
                      ...prev,
                      imageUrls: [...prev.imageUrls, input.value.trim()],
                    }));
                    input.value = "";
                  }
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} className="w-full sm:w-auto text-xs sm:text-sm">
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// DELETE ISSUE DIALOG
// ===========================================
interface DeleteIssueDialogProps {
  open: boolean;
  issue: Issue | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteIssueDialog({
  open,
  issue,
  onOpenChange,
  onConfirm,
}: DeleteIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            Delete Issue
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Are you sure? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {issue && (
          <div className="py-2 sm:py-4">
            <div className="bg-muted/50 p-2 sm:p-4 rounded-lg space-y-1 sm:space-y-2">
              <p className="text-xs sm:text-sm">
                <strong>Type:</strong> {issue.type?.replace(/_/g, " ")}
              </p>
              <p className="text-xs sm:text-sm">
                <strong>Status:</strong> {issue.status}
              </p>
              <p className="text-[10px] sm:text-sm text-muted-foreground line-clamp-2">
                {issue.description}
              </p>
            </div>
          </div>
        )}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm} className="w-full sm:w-auto text-xs sm:text-sm">
            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// REJECT REGISTRATION DIALOG
// ===========================================
interface RejectRegistrationDialogProps {
  open: boolean;
  reason: string;
  onOpenChange: (open: boolean) => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export function RejectRegistrationDialog({
  open,
  reason,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: RejectRegistrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Reject Registration</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Please provide a reason for rejecting
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 sm:py-4">
          <Textarea
            className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]"
            placeholder="Rejection reason..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm} className="w-full sm:w-auto text-xs sm:text-sm">
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
