"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { AdminOnly } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Building2,
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Plus,
  MapPin,
  Shield,
  RefreshCw,
  Trash2,
  Edit,
  Eye,
  Image,
  ArrowRight,
  List,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Timer,
  Server,
  Brain,
  Target,
  Award,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  AdminStats,
  Municipality,
  Issue,
  Registration,
  User,
  ISSUE_TYPES,
  INDIAN_STATES,
  MUNICIPALITY_TYPES,
  CreateMunicipalityDialog,
  EditMunicipalityDialog,
  DeleteMunicipalityDialog,
  ViewIssueDialog,
  EditIssueDialog,
  DeleteIssueDialog,
  RejectRegistrationDialog,
} from "@/components/admin";

function AdminDashboardContent() {
  const { getToken, userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [initialParamsProcessed, setInitialParamsProcessed] = useState(false);

  // Pagination for municipalities
  const [muniPage, setMuniPage] = useState(1);
  const [muniTotalPages, setMuniTotalPages] = useState(1);
  const [muniTotal, setMuniTotal] = useState(0);
  const MUNI_PAGE_SIZE = 20;

  // Pagination for users
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const USER_PAGE_SIZE = 20;

  // User filters
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // Form state for creating municipality
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    type: "MUNICIPALITY",
    state: "",
    district: "",
    north: "",
    south: "",
    east: "",
    west: "",
  });

  // Rejection dialog state
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    registrationId: string;
    reason: string;
  }>({
    open: false,
    registrationId: "",
    reason: "",
  });

  // Delete municipality dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    municipality: Municipality | null;
  }>({
    open: false,
    municipality: null,
  });

  // Edit municipality dialog
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    municipality: Municipality | null;
  }>({
    open: false,
    municipality: null,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    type: "",
    state: "",
    district: "",
    north: "",
    south: "",
    east: "",
    west: "",
  });

  // Municipality detail view (with issues)
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [municipalityIssues, setMunicipalityIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  // All Issues state
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [allIssuesLoading, setAllIssuesLoading] = useState(false);
  const [allIssuesPage, setAllIssuesPage] = useState(1);
  const [allIssuesTotalPages, setAllIssuesTotalPages] = useState(1);
  const [allIssuesTotal, setAllIssuesTotal] = useState(0);
  const ALL_ISSUES_PAGE_SIZE = 20;
  const [issueSearchQuery, setIssueSearchQuery] = useState("");
  const [issueStatusFilter, setIssueStatusFilter] = useState<string>("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>("all");
  const [issueMunicipalityFilter, setIssueMunicipalityFilter] = useState<string>("all");
  
  // All municipalities for filter (separate from paginated list)
  const [allMunicipalitiesForFilter, setAllMunicipalitiesForFilter] = useState<Municipality[]>([]);
  const [muniFilterSearch, setMuniFilterSearch] = useState("");

  // Edit Issue dialog
  const [editIssueDialog, setEditIssueDialog] = useState<{
    open: boolean;
    issue: Issue | null;
  }>({
    open: false,
    issue: null,
  });
  const [editIssueForm, setEditIssueForm] = useState({
    description: "",
    status: "",
    type: "",
    address: "",
    latitude: "",
    longitude: "",
    imageUrls: [] as string[],
  });

  // Delete Issue dialog
  const [deleteIssueDialog, setDeleteIssueDialog] = useState<{
    open: boolean;
    issue: Issue | null;
  }>({
    open: false,
    issue: null,
  });

  // View Issue dialog
  const [viewIssueDialog, setViewIssueDialog] = useState<{
    open: boolean;
    issue: Issue | null;
  }>({
    open: false,
    issue: null,
  });

  // ML Models state
  const [mlModels, setMlModels] = useState<{
    models: {
      classifier: { name: string; status: string; classes: string[]; num_classes: number };
      severity: { name: string; status: string; metrics: { mae: number; mse: number; training_samples: number; validation_samples: number } | null };
      risk: { name: string; status: string };
      clustering: { name: string; status: string; algorithm: string; default_params: { eps_meters: number; min_samples: number } };
    };
    capabilities: string[];
  } | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [severityDemo, setSeverityDemo] = useState<{ issueType: string; result: { score: number; level: string } | null }>({ issueType: "POTHOLE", result: null });
  const [severityLoading, setSeverityLoading] = useState(false);

  const fetchMLModels = async () => {
    setMlLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ml/models`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setMlModels(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch ML models:", error);
    } finally {
      setMlLoading(false);
    }
  };

  const runSeverityDemo = async (issueType: string) => {
    setSeverityLoading(true);
    setSeverityDemo({ issueType, result: null });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ml/predict-severity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSeverityDemo({ issueType, result: { score: data.data.score, level: data.data.level } });
        }
      }
    } catch (error) {
      console.error("Severity demo failed:", error);
    } finally {
      setSeverityLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch stats
      const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
        headers,
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.data);
      }

      // Fetch municipalities with pagination
      await fetchMunicipalities(token, 1);
      
      // Fetch ALL municipalities for filter dropdown (up to 500)
      await fetchAllMunicipalitiesForFilter(token);

      // Fetch pending registrations
      const regRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/registrations?status=PENDING`,
        { headers }
      );
      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.success) setRegistrations(regData.data.items || []);
      }

      // Fetch users with pagination
      await fetchUsers(token, 1);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch municipalities with pagination and search
  const fetchMunicipalities = async (token: string | null, page: number, search?: string) => {
    try {
      const tkn = token || await getToken();
      const searchParam = search !== undefined ? search : searchQuery;
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/admin/municipalities`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("pageSize", MUNI_PAGE_SIZE.toString());
      if (searchParam) {
        url.searchParams.set("search", searchParam);
      }

      const muniRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${tkn}`,
          "Content-Type": "application/json",
        },
      });
      if (muniRes.ok) {
        const muniData = await muniRes.json();
        if (muniData.success) {
          setMunicipalities(muniData.data.items || []);
          setMuniTotal(muniData.data.total || 0);
          setMuniTotalPages(Math.ceil((muniData.data.total || 0) / MUNI_PAGE_SIZE));
          setMuniPage(page);
        }
      }
    } catch (error) {
      console.error("Error fetching municipalities:", error);
    }
  };

  // Fetch ALL municipalities for filter dropdown (no pagination)
  const fetchAllMunicipalitiesForFilter = async (token: string | null) => {
    try {
      const tkn = token || await getToken();
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/admin/municipalities`);
      url.searchParams.set("page", "1");
      url.searchParams.set("pageSize", "500"); // Get all municipalities

      const muniRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${tkn}`,
          "Content-Type": "application/json",
        },
      });
      if (muniRes.ok) {
        const muniData = await muniRes.json();
        if (muniData.success) {
          setAllMunicipalitiesForFilter(muniData.data.items || []);
        }
      }
    } catch (error) {
      console.error("Error fetching all municipalities for filter:", error);
    }
  };

  // Get filtered municipalities for dropdown
  const filteredMunicipalitiesForDropdown = allMunicipalitiesForFilter.filter((muni) =>
    muniFilterSearch.trim() === "" || 
    muni.name.toLowerCase().includes(muniFilterSearch.toLowerCase()) ||
    muni.state?.toLowerCase().includes(muniFilterSearch.toLowerCase()) ||
    muni.district?.toLowerCase().includes(muniFilterSearch.toLowerCase())
  );

  // Fetch users with pagination and filters
  const fetchUsers = async (token: string | null, page: number, search?: string, role?: string) => {
    try {
      const tkn = token || await getToken();
      const searchParam = search !== undefined ? search : userSearchQuery;
      const roleParam = role !== undefined ? role : userRoleFilter;
      
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("pageSize", USER_PAGE_SIZE.toString());
      if (searchParam) {
        url.searchParams.set("search", searchParam);
      }
      if (roleParam && roleParam !== "all") {
        url.searchParams.set("role", roleParam);
      }

      const usersRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${tkn}`,
          "Content-Type": "application/json",
        },
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success) {
          setUsers(usersData.data.items || []);
          setUserTotal(usersData.data.total || 0);
          setUserTotalPages(Math.ceil((usersData.data.total || 0) / USER_PAGE_SIZE));
          setUserPage(page);
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Handle municipality search
  const handleMuniSearch = (query: string) => {
    setSearchQuery(query);
    fetchMunicipalities(null, 1, query);
  };

  // Handle user search and filters
  const handleUserSearch = (query: string) => {
    setUserSearchQuery(query);
    fetchUsers(null, 1, query, userRoleFilter);
  };

  const handleUserRoleFilter = (role: string) => {
    setUserRoleFilter(role);
    fetchUsers(null, 1, userSearchQuery, role);
  };

  // Fetch all issues with filters
  const fetchAllIssues = async (
    page: number = 1,
    search?: string,
    status?: string,
    type?: string,
    municipalityId?: string
  ) => {
    setAllIssuesLoading(true);
    try {
      const token = await getToken();
      const searchParam = search !== undefined ? search : issueSearchQuery;
      const statusParam = status !== undefined ? status : issueStatusFilter;
      const typeParam = type !== undefined ? type : issueTypeFilter;
      const muniParam = municipalityId !== undefined ? municipalityId : issueMunicipalityFilter;
      
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/issues`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("pageSize", ALL_ISSUES_PAGE_SIZE.toString());
      
      if (searchParam && searchParam.trim()) {
        url.searchParams.set("search", searchParam.trim());
      }
      if (statusParam && statusParam !== "all") {
        url.searchParams.set("status", statusParam);
      }
      if (typeParam && typeParam !== "all") {
        url.searchParams.set("type", typeParam);
      }
      if (muniParam && muniParam !== "all") {
        url.searchParams.set("municipalityId", muniParam);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.success) {
        setAllIssues(data.data?.items || []);
        setAllIssuesTotal(data.data?.total || 0);
        setAllIssuesTotalPages(Math.ceil((data.data?.total || 0) / ALL_ISSUES_PAGE_SIZE));
        setAllIssuesPage(page);
      }
    } catch (error) {
      console.error("Error fetching all issues:", error);
      toast.error("Failed to fetch issues");
    } finally {
      setAllIssuesLoading(false);
    }
  };

  // Handle issue search
  const handleIssueSearch = (query: string) => {
    setIssueSearchQuery(query);
    fetchAllIssues(1, query);
  };

  // Handle issue status filter
  const handleIssueStatusFilter = (status: string) => {
    setIssueStatusFilter(status);
    fetchAllIssues(1, issueSearchQuery, status);
  };

  // Handle issue type filter
  const handleIssueTypeFilter = (type: string) => {
    setIssueTypeFilter(type);
    fetchAllIssues(1, issueSearchQuery, issueStatusFilter, type);
  };

  // Handle issue municipality filter
  const handleIssueMunicipalityFilter = (municipalityId: string) => {
    setIssueMunicipalityFilter(municipalityId);
    fetchAllIssues(1, issueSearchQuery, issueStatusFilter, issueTypeFilter, municipalityId);
  };

  // Open edit issue dialog
  const openEditIssueDialog = (issue: Issue) => {
    setEditIssueForm({
      description: issue.description,
      status: issue.status,
      type: issue.type,
      address: issue.location?.address || "",
      latitude: issue.location?.latitude?.toString() || "",
      longitude: issue.location?.longitude?.toString() || "",
      imageUrls: issue.imageUrls || [],
    });
    setEditIssueDialog({ open: true, issue });
  };

  // Handle edit issue
  const handleEditIssue = async () => {
    if (!editIssueDialog.issue) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/issues/${editIssueDialog.issue.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: editIssueForm.description,
            status: editIssueForm.status,
            type: editIssueForm.type,
            location: {
              address: editIssueForm.address,
              latitude: parseFloat(editIssueForm.latitude) || 0,
              longitude: parseFloat(editIssueForm.longitude) || 0,
            },
            imageUrls: editIssueForm.imageUrls,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Issue updated successfully");
        setEditIssueDialog({ open: false, issue: null });
        fetchAllIssues(allIssuesPage);
        fetchData();
      } else {
        toast.error(data.error || "Failed to update issue");
      }
    } catch (error) {
      console.error("Error updating issue:", error);
      toast.error("Failed to update issue");
    }
  };

  // Handle delete issue from all issues tab
  const handleDeleteIssueFromAll = async () => {
    if (!deleteIssueDialog.issue) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/issues/${deleteIssueDialog.issue.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Issue deleted successfully");
        setDeleteIssueDialog({ open: false, issue: null });
        fetchAllIssues(allIssuesPage);
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete issue");
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
      toast.error("Failed to delete issue");
    }
  };

  // Issue types constant - using imported ISSUE_TYPES
  const issueTypes = [...ISSUE_TYPES];

  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL query params for deep linking
  useEffect(() => {
    if (!loading && !initialParamsProcessed) {
      const tab = searchParams.get("tab");
      const municipality = searchParams.get("municipality");
      
      if (tab === "issues") {
        setActiveTab("issues");
        if (municipality) {
          setIssueMunicipalityFilter(municipality);
          fetchAllIssues(1, "", "all", "all", municipality);
        } else {
          fetchAllIssues(1);
        }
      }
      setInitialParamsProcessed(true);
    }
  }, [loading, initialParamsProcessed, searchParams]);

  const handleCreateMunicipality = async () => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/municipalities`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: createForm.name,
            type: createForm.type,
            state: createForm.state,
            district: createForm.district,
            bounds: {
              north: parseFloat(createForm.north) || 0,
              south: parseFloat(createForm.south) || 0,
              east: parseFloat(createForm.east) || 0,
              west: parseFloat(createForm.west) || 0,
            },
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Municipality created successfully");
        setShowCreateDialog(false);
        setCreateForm({
          name: "",
          type: "MUNICIPALITY",
          state: "",
          district: "",
          north: "",
          south: "",
          east: "",
          west: "",
        });
        fetchData();
      } else {
        toast.error(data.error || "Failed to create municipality");
      }
    } catch (error) {
      console.error("Error creating municipality:", error);
      toast.error("Failed to create municipality");
    }
  };

  const handleApproveRegistration = async (registrationId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/registrations/${registrationId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Registration approved");
        fetchData();
      } else {
        toast.error(data.error || "Failed to approve registration");
      }
    } catch (error) {
      console.error("Error approving registration:", error);
      toast.error("Failed to approve registration");
    }
  };

  const handleRejectRegistration = async () => {
    if (!rejectDialog.reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/registrations/${rejectDialog.registrationId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: rejectDialog.reason }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Registration rejected");
        setRejectDialog({ open: false, registrationId: "", reason: "" });
        fetchData();
      } else {
        toast.error(data.error || "Failed to reject registration");
      }
    } catch (error) {
      console.error("Error rejecting registration:", error);
      toast.error("Failed to reject registration");
    }
  };

  const handleUpdateUserRole = async (
    userId: string,
    role: string,
    municipalityId?: string
  ) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/users/${userId}/role`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role, municipalityId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("User role updated");
        fetchData();
      } else {
        toast.error(data.error || "Failed to update user role");
      }
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user role");
    }
  };

  // Delete municipality handler
  const handleDeleteMunicipality = async () => {
    if (!deleteDialog.municipality) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/municipalities/${deleteDialog.municipality.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Municipality deleted successfully");
        setDeleteDialog({ open: false, municipality: null });
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete municipality");
      }
    } catch (error) {
      console.error("Error deleting municipality:", error);
      toast.error("Failed to delete municipality");
    }
  };

  // Edit municipality handler
  const handleEditMunicipality = async () => {
    if (!editDialog.municipality) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/municipalities/${editDialog.municipality.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editForm.name,
            type: editForm.type,
            state: editForm.state,
            district: editForm.district,
            bounds: {
              north: parseFloat(editForm.north) || 0,
              south: parseFloat(editForm.south) || 0,
              east: parseFloat(editForm.east) || 0,
              west: parseFloat(editForm.west) || 0,
            },
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Municipality updated successfully");
        setEditDialog({ open: false, municipality: null });
        fetchData();
      } else {
        toast.error(data.error || "Failed to update municipality");
      }
    } catch (error) {
      console.error("Error updating municipality:", error);
      toast.error("Failed to update municipality");
    }
  };

  // Open edit dialog with municipality data
  const openEditDialog = (municipality: Municipality) => {
    setEditForm({
      name: municipality.name,
      type: municipality.type,
      state: municipality.state,
      district: municipality.district,
      north: municipality.bounds?.north?.toString() || "",
      south: municipality.bounds?.south?.toString() || "",
      east: municipality.bounds?.east?.toString() || "",
      west: municipality.bounds?.west?.toString() || "",
    });
    setEditDialog({ open: true, municipality });
  };

  // Fetch issues for a municipality
  const fetchMunicipalityIssues = async (municipality: Municipality) => {
    setSelectedMunicipality(municipality);
    setIssuesLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/issues?municipalityId=${municipality.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setMunicipalityIssues(data.data?.items || []);
      } else {
        toast.error("Failed to fetch issues");
        setMunicipalityIssues([]);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      toast.error("Failed to fetch issues");
      setMunicipalityIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  // Delete issue handler
  const handleDeleteIssue = async (issueId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/issues/${issueId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Issue deleted successfully");
        if (selectedMunicipality) {
          fetchMunicipalityIssues(selectedMunicipality);
        }
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete issue");
      }
    } catch (error) {
      console.error("Error deleting issue:", error);
      toast.error("Failed to delete issue");
    }
  };

  // Update issue status handler
  const handleUpdateIssueStatus = async (issueId: string, status: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/issues/${issueId}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success("Issue status updated");
        if (selectedMunicipality) {
          fetchMunicipalityIssues(selectedMunicipality);
        }
        fetchData();
      } else {
        toast.error(data.error || "Failed to update issue status");
      }
    } catch (error) {
      console.error("Error updating issue status:", error);
      toast.error("Failed to update issue status");
    }
  };

  // Indian states constant - using imported INDIAN_STATES
  const indianStates = [...INDIAN_STATES];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage municipalities, users, and platform settings
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Municipalities
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">
                {stats?.totalMunicipalities || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Total Issues
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">
                {stats?.totalIssues || 0}
              </div>
            </CardContent>
          </Card>

          <Card
            className={stats?.pendingRegistrations ? "border-yellow-500" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Pending Registrations
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">
                {stats?.pendingRegistrations || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issue Status Breakdown */}
        {stats?.issuesByStatus && (
          <Card className="mb-6 md:mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg">Issue Status Breakdown</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setActiveTab("issues");
                  fetchAllIssues(1);
                }}
                className="text-primary"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded-md transition-colors"
                  onClick={() => {
                    setActiveTab("issues");
                    setIssueStatusFilter("OPEN");
                    fetchAllIssues(1, "", "OPEN");
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-xs md:text-sm">
                    Open: {stats.issuesByStatus.OPEN}
                  </span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded-md transition-colors"
                  onClick={() => {
                    setActiveTab("issues");
                    setIssueStatusFilter("CLOSED");
                    fetchAllIssues(1, "", "CLOSED");
                  }}
                >
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-xs md:text-sm">
                    Closed: {stats.issuesByStatus.CLOSED || 0}
                  </span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full grid grid-cols-6 sm:flex sm:flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs md:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger value="municipalities" className="text-xs md:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Municipalities</span>
              <span className="sm:hidden">Munis</span>
              {muniTotal > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs hidden md:inline-flex">
                  {muniTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="registrations" className="text-xs md:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Registrations</span>
              <span className="sm:hidden">Regs</span>
              {registrations.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {registrations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm px-2 sm:px-3">
              Users
              {userTotal > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs hidden md:inline-flex">
                  {userTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="issues"
              className="text-xs md:text-sm px-2 sm:px-3"
              onClick={() => {
                if (allIssues.length === 0) {
                  fetchAllIssues(1);
                }
              }}
            >
              <span className="hidden sm:inline">All Issues</span>
              <span className="sm:hidden">Issues</span>
              {allIssuesTotal > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs hidden md:inline-flex">
                  {allIssuesTotal}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ml"
              className="text-xs md:text-sm px-2 sm:px-3"
              onClick={() => {
                if (!mlModels) {
                  fetchMLModels();
                }
              }}
            >
              <span className="hidden sm:inline">ML Models</span>
              <span className="sm:hidden">ML</span>
              <Brain className="h-3 w-3 ml-1 hidden md:inline-block" />
            </TabsTrigger>
          </TabsList>

          {/* Municipalities Tab */}
          <TabsContent value="municipalities" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search municipalities..."
                    className="pl-9 w-full sm:w-64"
                    value={searchQuery}
                    onChange={(e) => handleMuniSearch(e.target.value)}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  Showing {municipalities.length} of {muniTotal}
                </span>
              </div>
              <Dialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
              >
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Municipality
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Municipality</DialogTitle>
                    <DialogDescription>
                      Add a new municipality to the platform
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Municipality Name</Label>
                      <Input
                        placeholder="e.g., Municipal Corporation of Delhi"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={createForm.type}
                          onValueChange={(value) =>
                            setCreateForm((prev) => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MUNICIPAL_CORPORATION">
                              Municipal Corporation
                            </SelectItem>
                            <SelectItem value="MUNICIPALITY">
                              Municipality
                            </SelectItem>
                            <SelectItem value="NAGAR_PANCHAYAT">
                              Nagar Panchayat
                            </SelectItem>
                            <SelectItem value="GRAM_PANCHAYAT">
                              Gram Panchayat
                            </SelectItem>
                            <SelectItem value="CANTONMENT_BOARD">
                              Cantonment Board
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Select
                          value={createForm.state}
                          onValueChange={(value) =>
                            setCreateForm((prev) => ({ ...prev, state: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {indianStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>District</Label>
                      <Input
                        placeholder="Enter district"
                        value={createForm.district}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            district: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jurisdiction Bounds (Coordinates)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="North (lat)"
                          value={createForm.north}
                          onChange={(e) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              north: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="South (lat)"
                          value={createForm.south}
                          onChange={(e) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              south: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="East (lng)"
                          value={createForm.east}
                          onChange={(e) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              east: e.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="West (lng)"
                          value={createForm.west}
                          onChange={(e) =>
                            setCreateForm((prev) => ({
                              ...prev,
                              west: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Define the rectangular boundary for this municipality&apos;s
                        jurisdiction
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMunicipality}>
                      Create Municipality
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {municipalities.map((municipality) => (
                  <Card key={municipality.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div 
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => fetchMunicipalityIssues(municipality)}
                        >
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">
                              {municipality.name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              <MapPin className="inline h-3 w-3 mr-1" />
                              {municipality.district}, {municipality.state}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <div className="text-center sm:text-right">
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Score
                            </p>
                            <p className="text-lg sm:text-xl font-bold text-primary">
                              {municipality.score}
                            </p>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Issues
                            </p>
                            <p className="text-base sm:text-lg font-semibold">
                              {municipality.resolvedIssues}/
                              {municipality.totalIssues}
                            </p>
                          </div>
                          <Badge className="text-xs">{municipality.type.replace(/_/g, " ")}</Badge>
                          <div className="flex items-center gap-1 sm:gap-2 ml-auto lg:ml-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => fetchMunicipalityIssues(municipality)}
                              title="View Issues"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(municipality)}
                              title="Edit Municipality"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => setDeleteDialog({ open: true, municipality })}
                              title="Delete Municipality"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {municipalities.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">
                      No Municipalities Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first municipality to get started
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Municipality
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Pagination Controls */}
            {muniTotalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {muniPage} of {muniTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMunicipalities(null, muniPage - 1)}
                    disabled={muniPage <= 1}
                  >
                    Previous
                  </Button>
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, muniTotalPages) }, (_, i) => {
                      let pageNum;
                      if (muniTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (muniPage <= 3) {
                        pageNum = i + 1;
                      } else if (muniPage >= muniTotalPages - 2) {
                        pageNum = muniTotalPages - 4 + i;
                      } else {
                        pageNum = muniPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={muniPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => fetchMunicipalities(null, pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMunicipalities(null, muniPage + 1)}
                    disabled={muniPage >= muniTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Registrations Tab */}
          <TabsContent value="registrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Municipality Registrations</CardTitle>
                <CardDescription>
                  Review and approve municipality registration requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrations.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold mb-2">All Caught Up!</h3>
                    <p className="text-muted-foreground">
                      No pending registration requests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {registrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">
                              {reg.municipalityName}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {reg.district}, {reg.state}
                            </p>
                          </div>
                          <Badge
                            variant={
                              reg.status === "PENDING"
                                ? "secondary"
                                : reg.status === "APPROVED"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {reg.status}
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <p>
                            <strong>Contact:</strong> {reg.name} ({reg.email})
                          </p>
                          <p>
                            <strong>Submitted:</strong>{" "}
                            {new Date(reg.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveRegistration(reg.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setRejectDialog({
                                open: true,
                                registrationId: reg.id,
                                reason: "",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reject Dialog - Using extracted component */}
            <RejectRegistrationDialog
              open={rejectDialog.open}
              reason={rejectDialog.reason}
              onOpenChange={(open) => {
                if (!open) {
                  setRejectDialog({ open: false, registrationId: "", reason: "" });
                } else {
                  setRejectDialog((prev) => ({ ...prev, open }));
                }
              }}
              onReasonChange={(reason) => setRejectDialog((prev) => ({ ...prev, reason }))}
              onConfirm={handleRejectRegistration}
            />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      View and manage platform users ({userTotal} total)
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search users..."
                        className="pl-10 w-full sm:w-64"
                        value={userSearchQuery}
                        onChange={(e) => handleUserSearch(e.target.value)}
                      />
                    </div>
                    <Select
                      value={userRoleFilter}
                      onValueChange={handleUserRoleFilter}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="citizen">Citizens</SelectItem>
                        <SelectItem value="municipality">Municipality</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Table Header */}
                  <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground">
                    <div className="col-span-4">User</div>
                    <div className="col-span-3">Role</div>
                    <div className="col-span-3">Joined</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors items-center"
                    >
                      {/* User Info */}
                      <div className="md:col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {(user.displayName || user.email || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {user.displayName || "No Name"}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      {/* Role Badge */}
                      <div className="md:col-span-3 flex items-center gap-2">
                        <Badge
                          variant={
                            user.role === "admin" || user.role === "PLATFORM_MAINTAINER"
                              ? "destructive"
                              : user.role === "municipality" || user.role === "MUNICIPALITY_ADMIN"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {user.role === "PLATFORM_MAINTAINER" ? "Admin" : 
                           user.role === "MUNICIPALITY_ADMIN" ? "Municipality" :
                           user.role}
                        </Badge>
                        {user.municipalityId && (
                          <span className="text-xs text-muted-foreground">
                            (Assigned)
                          </span>
                        )}
                      </div>

                      {/* Joined Date */}
                      <div className="md:col-span-3 text-sm text-muted-foreground">
                        <span className="md:hidden font-medium">Joined: </span>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "Unknown"}
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex justify-end">
                        <Select
                          value={user.role}
                          onValueChange={(value) => {
                            if (value === "municipality") {
                              toast.info(
                                "To assign as municipality admin, use the registration flow"
                              );
                            } else {
                              handleUpdateUserRole(user.id, value);
                            }
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Change role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="citizen">Citizen</SelectItem>
                            <SelectItem value="municipality">
                              Municipality
                            </SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No Users Found</h3>
                      <p className="text-muted-foreground">
                        {userSearchQuery || userRoleFilter !== "all"
                          ? "Try adjusting your search or filters"
                          : "Users will appear here once they register"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {userTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(userPage - 1) * USER_PAGE_SIZE + 1} -{" "}
                      {Math.min(userPage * USER_PAGE_SIZE, userTotal)} of{" "}
                      {userTotal} users
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={userPage === 1}
                        onClick={() => fetchUsers(null, userPage - 1)}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, userTotalPages) }, (_, i) => {
                          let pageNum;
                          if (userTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (userPage <= 3) {
                            pageNum = i + 1;
                          } else if (userPage >= userTotalPages - 2) {
                            pageNum = userTotalPages - 4 + i;
                          } else {
                            pageNum = userPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={userPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => fetchUsers(null, pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={userPage === userTotalPages}
                        onClick={() => fetchUsers(null, userPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Issues Tab */}
          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <List className="h-5 w-5" />
                        All Issues
                      </CardTitle>
                      <CardDescription>
                        View and manage all issues across all municipalities ({allIssuesTotal} total)
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchAllIssues(allIssuesPage)}
                      disabled={allIssuesLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${allIssuesLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search issues..."
                        className="pl-10"
                        value={issueSearchQuery}
                        onChange={(e) => handleIssueSearch(e.target.value)}
                      />
                    </div>
                    <Select
                      value={issueStatusFilter}
                      onValueChange={handleIssueStatusFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={issueTypeFilter}
                      onValueChange={handleIssueTypeFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {issueTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={issueMunicipalityFilter}
                      onValueChange={(value) => {
                        handleIssueMunicipalityFilter(value);
                        setMuniFilterSearch(""); // Reset search when selecting
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by municipality" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-hidden">
                        <div className="p-2 border-b bg-background">
                          <Input
                            placeholder="Search municipalities..."
                            value={muniFilterSearch}
                            onChange={(e) => {
                              e.stopPropagation();
                              setMuniFilterSearch(e.target.value);
                            }}
                            className="h-8"
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              // Prevent select from capturing key events
                              if (e.key !== 'Escape') {
                                e.stopPropagation();
                              }
                            }}
                            onFocus={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-[220px] overflow-y-auto">
                          <SelectItem value="all">All Municipalities</SelectItem>
                          {filteredMunicipalitiesForDropdown.length === 0 ? (
                            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                              No municipalities found
                            </div>
                          ) : (
                            filteredMunicipalitiesForDropdown.map((muni) => (
                              <SelectItem key={muni.id} value={muni.id}>
                                {muni.name}
                              </SelectItem>
                            ))
                          )}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {allIssuesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : allIssues.length > 0 ? (
                  <div className="space-y-3">
                    {/* Table Header */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground">
                      <div className="col-span-3">Type</div>
                      <div className="col-span-3">Description</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {allIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/30 transition-colors items-center"
                      >
                        {/* Type */}
                        <div className="lg:col-span-3">
                          <Badge variant="outline" className="capitalize">
                            {issue.type?.replace(/_/g, " ") || "Unknown"}
                          </Badge>
                        </div>

                        {/* Description */}
                        <div className="lg:col-span-3">
                          <p className="text-sm line-clamp-2">{issue.description}</p>
                          {issue.location?.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              {issue.location.address}
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        <div className="lg:col-span-2">
                          <Badge
                            variant={
                              issue.status === "OPEN"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {issue.status === "OPEN" ? (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            {issue.status}
                          </Badge>
                        </div>

                        {/* Date */}
                        <div className="lg:col-span-2 text-sm text-muted-foreground">
                          <span className="lg:hidden font-medium">Reported: </span>
                          {issue.createdAt
                            ? new Date(issue.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Unknown"}
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-2 flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewIssueDialog({ open: true, issue })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditIssueDialog(issue)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteIssueDialog({ open: true, issue })}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Issues Found</h3>
                    <p className="text-muted-foreground">
                      {issueSearchQuery || issueStatusFilter !== "all" || issueTypeFilter !== "all" || issueMunicipalityFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : "No issues have been reported yet"}
                    </p>
                  </div>
                )}

                {/* Pagination Controls */}
                {allIssuesTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(allIssuesPage - 1) * ALL_ISSUES_PAGE_SIZE + 1} -{" "}
                      {Math.min(allIssuesPage * ALL_ISSUES_PAGE_SIZE, allIssuesTotal)} of{" "}
                      {allIssuesTotal} issues
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={allIssuesPage === 1}
                        onClick={() => fetchAllIssues(allIssuesPage - 1)}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, allIssuesTotalPages) }, (_, i) => {
                          let pageNum;
                          if (allIssuesTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (allIssuesPage <= 3) {
                            pageNum = i + 1;
                          } else if (allIssuesPage >= allIssuesTotalPages - 2) {
                            pageNum = allIssuesTotalPages - 4 + i;
                          } else {
                            pageNum = allIssuesPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={allIssuesPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => fetchAllIssues(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={allIssuesPage === allIssuesTotalPages}
                        onClick={() => fetchAllIssues(allIssuesPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Hero Stats - Completion Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Completion Donut */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-600" />
                    Issue Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Resolved', value: stats?.issuesByStatus?.CLOSED || 0 },
                              { name: 'Open', value: stats?.issuesByStatus?.OPEN || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-emerald-600">
                          {stats?.resolutionRate ?? 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-emerald-500" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Resolved</span>
                        </div>
                        <span className="font-semibold text-emerald-600">{stats?.issuesByStatus?.CLOSED || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-gray-300" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                        </div>
                        <span className="font-semibold text-gray-600">{stats?.issuesByStatus?.OPEN || 0}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total Issues</span>
                          <span className="text-lg font-bold text-emerald-700">{stats?.totalIssues || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    Platform Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Users className="h-6 w-6 mx-auto text-emerald-600 mb-1" />
                      <p className="text-2xl font-bold text-emerald-700">{stats?.totalUsers || 0}</p>
                      <p className="text-xs text-emerald-600">Total Users</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Building2 className="h-6 w-6 mx-auto text-emerald-600 mb-1" />
                      <p className="text-2xl font-bold text-emerald-700">{stats?.totalMunicipalities || 0}</p>
                      <p className="text-xs text-emerald-600">Municipalities</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Timer className="h-6 w-6 mx-auto text-emerald-600 mb-1" />
                      <p className="text-2xl font-bold text-emerald-700">{stats?.avgResolutionTimeHours || 0}h</p>
                      <p className="text-xs text-emerald-600">Avg Resolution</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <Brain className="h-6 w-6 mx-auto text-emerald-600 mb-1" />
                      <p className={`text-lg font-bold capitalize ${
                        stats?.mlServiceStatus === 'healthy' ? 'text-emerald-700' : 'text-gray-500'
                      }`}>
                        {stats?.mlServiceStatus === 'healthy' ? 'Online' : stats?.mlServiceStatus || 'Unknown'}
                      </p>
                      <p className="text-xs text-emerald-600">ML Service</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Issues Trend Chart */}
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Issues Trend (Last 7 Days)
                  </CardTitle>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    {stats?.issuesTrend?.reduce((sum, d) => sum + d.count, 0) || 0} new issues
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats?.issuesTrend || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #d1fae5',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#065f46', fontWeight: 600 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorIssues)"
                        name="Issues"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Issue Types & Municipalities Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Issues by Type - Bar Chart */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                    Issues by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.issuesByType && Object.keys(stats.issuesByType).length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(stats.issuesByType)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([type, count]) => ({
                              type: type.replace(/_/g, ' ').slice(0, 12),
                              count,
                            }))}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                          <YAxis
                            dataKey="type"
                            type="category"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            width={80}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #d1fae5',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Issues" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No issue data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Municipalities */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                      <Award className="h-5 w-5 text-emerald-600" />
                      Top Municipalities
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("municipalities")}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.topMunicipalities && stats.topMunicipalities.length > 0 ? (
                      stats.topMunicipalities.map((muni, index) => {
                        const maxCount = stats.topMunicipalities?.[0]?.issueCount || 1;
                        const percent = (muni.issueCount / maxCount) * 100;
                        return (
                          <div key={muni.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                  index === 0 ? 'bg-emerald-500 text-white' :
                                  index === 1 ? 'bg-emerald-400 text-white' :
                                  index === 2 ? 'bg-emerald-300 text-emerald-900' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {index + 1}
                                </span>
                                <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                                  {muni.name}
                                </span>
                              </div>
                              <span className="font-bold text-emerald-700">{muni.issueCount}</span>
                            </div>
                            <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-48 flex items-center justify-center text-gray-400">
                        No municipality data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row - Pending & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status Breakdown */}
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-emerald-600" />
                    Status Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">Completed</span>
                          <span className="text-sm font-semibold text-emerald-600">{stats?.issuesByStatus?.CLOSED || 0}</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${stats?.resolutionRate || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">Pending</span>
                          <span className="text-sm font-semibold text-gray-500">{stats?.issuesByStatus?.OPEN || 0}</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 rounded-full transition-all duration-500"
                            style={{ width: `${100 - (stats?.resolutionRate || 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Resolution Rate</span>
                        <span className="text-2xl font-bold text-emerald-600">{stats?.resolutionRate || 0}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Registrations */}
              <Card className="lg:col-span-2 border-emerald-200 dark:border-emerald-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-emerald-600" />
                      Pending Registrations
                    </CardTitle>
                    {registrations.length > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        {registrations.length} pending
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {registrations.length > 0 ? (
                    <div className="space-y-3">
                      {registrations.slice(0, 4).map((reg) => (
                        <div
                          key={reg.id}
                          className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-emerald-900 dark:text-emerald-100 truncate">{reg.municipalityName}</p>
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 truncate">
                              {reg.district}, {reg.state}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="ml-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setActiveTab("registrations")}
                          >
                            Review
                          </Button>
                        </div>
                      ))}
                      {registrations.length > 4 && (
                        <Button
                          variant="outline"
                          className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setActiveTab("registrations")}
                        >
                          View {registrations.length - 4} more
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                      <CheckCircle className="h-12 w-12 mb-3 text-emerald-500" />
                      <p className="text-lg font-medium text-emerald-700">All caught up!</p>
                      <p className="text-sm text-gray-500">No pending registrations</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ML Models Tab */}
          <TabsContent value="ml" className="space-y-6">
            {mlLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : mlModels ? (
              <>
                {/* ML Service Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Classifier */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Image Classifier</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          mlModels.models.classifier.status === 'loaded'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {mlModels.models.classifier.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{mlModels.models.classifier.name}</p>
                      <p className="text-lg font-bold text-emerald-600 mt-1">{mlModels.models.classifier.num_classes} classes</p>
                    </CardContent>
                  </Card>

                  {/* Severity */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity Scorer</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          mlModels.models.severity.status === 'available'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {mlModels.models.severity.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{mlModels.models.severity.name}</p>
                      {mlModels.models.severity.metrics && (
                        <p className="text-lg font-bold text-emerald-600 mt-1">MAE: {mlModels.models.severity.metrics.mae}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Risk */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Risk Predictor</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          mlModels.models.risk.status === 'available'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {mlModels.models.risk.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{mlModels.models.risk.name}</p>
                      <p className="text-sm text-gray-600 mt-1">Weather + Location</p>
                    </CardContent>
                  </Card>

                  {/* Clustering */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Clustering</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          {mlModels.models.clustering.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{mlModels.models.clustering.algorithm}</p>
                      <p className="text-sm text-gray-600 mt-1">{mlModels.models.clustering.default_params.eps_meters}m radius</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Demo Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Severity Demo */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <Target className="h-5 w-5 text-emerald-600" />
                        Severity Prediction Demo
                      </CardTitle>
                      <CardDescription>Test the severity scoring model</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {["POTHOLE", "GARBAGE", "FALLEN_TREE", "DAMAGED_ELECTRICAL", "VANDALISM"].map((type) => (
                            <Button
                              key={type}
                              variant={severityDemo.issueType === type ? "default" : "outline"}
                              size="sm"
                              className={severityDemo.issueType === type ? "bg-emerald-600 hover:bg-emerald-700" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}
                              onClick={() => runSeverityDemo(type)}
                              disabled={severityLoading}
                            >
                              {type.replace(/_/g, " ")}
                            </Button>
                          ))}
                        </div>
                        {severityLoading && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                            Predicting...
                          </div>
                        )}
                        {severityDemo.result && (
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Issue Type:</span>
                              <span className="font-medium">{severityDemo.issueType}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm text-gray-600">Severity Score:</span>
                              <span className="text-2xl font-bold text-emerald-600">{severityDemo.result.score.toFixed(1)}/10</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm text-gray-600">Level:</span>
                              <span className={`px-2 py-0.5 rounded text-sm font-medium ${
                                severityDemo.result.level === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                severityDemo.result.level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                severityDemo.result.level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {severityDemo.result.level}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Capabilities */}
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-emerald-600" />
                        ML Capabilities
                      </CardTitle>
                      <CardDescription>What our ML models can do</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mlModels.capabilities.map((cap, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{cap}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Model Metrics */}
                {mlModels.models.severity.metrics && (
                  <Card className="border-emerald-200 dark:border-emerald-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-emerald-600" />
                        Model Training Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{mlModels.models.severity.metrics.mae}</p>
                          <p className="text-xs text-gray-500">Mean Absolute Error</p>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{mlModels.models.severity.metrics.mse}</p>
                          <p className="text-xs text-gray-500">Mean Squared Error</p>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{mlModels.models.severity.metrics.training_samples}</p>
                          <p className="text-xs text-gray-500">Training Samples</p>
                        </div>
                        <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-600">{mlModels.models.severity.metrics.validation_samples}</p>
                          <p className="text-xs text-gray-500">Validation Samples</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Issue Types Classification */}
                <Card className="border-emerald-200 dark:border-emerald-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5 text-emerald-600" />
                      Supported Issue Types
                    </CardTitle>
                    <CardDescription>The classifier can identify these issue types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {mlModels.models.classifier.classes.map((cls) => (
                        <Badge key={cls} variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                          {cls}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">ML service is not available</p>
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={fetchMLModels}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Municipality Dialog - Using extracted component */}
        <DeleteMunicipalityDialog
          open={deleteDialog.open}
          municipality={deleteDialog.municipality}
          onOpenChange={(open) => setDeleteDialog({ open, municipality: open ? deleteDialog.municipality : null })}
          onConfirm={handleDeleteMunicipality}
        />

        {/* Edit Municipality Dialog - Using extracted component */}
        <EditMunicipalityDialog
          open={editDialog.open}
          municipality={editDialog.municipality}
          onOpenChange={(open) => setEditDialog({ open, municipality: open ? editDialog.municipality : null })}
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleEditMunicipality}
        />

        {/* Municipality Detail / Issues View Dialog */}
        <Dialog 
          open={selectedMunicipality !== null} 
          onOpenChange={(open) => !open && setSelectedMunicipality(null)}
        >
          <DialogContent className="w-[calc(100%-1rem)] sm:max-w-xl md:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span className="truncate">{selectedMunicipality?.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                <MapPin className="inline h-3 w-3 mr-1" />
                {selectedMunicipality?.district}, {selectedMunicipality?.state}
              </DialogDescription>
            </DialogHeader>

            {/* Municipality Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 py-2 sm:py-4">
              <Card className="p-0 shadow-sm">
                <CardContent className="p-2 sm:p-4 sm:pt-4">
                  <div className="text-center">
                    <p className="text-base sm:text-2xl font-bold text-primary">{selectedMunicipality?.score}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Score</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="p-0 shadow-sm">
                <CardContent className="p-2 sm:p-4 sm:pt-4">
                  <div className="text-center">
                    <p className="text-base sm:text-2xl font-bold">{selectedMunicipality?.totalIssues || 0}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Issues</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="p-0 shadow-sm">
                <CardContent className="p-2 sm:p-4 sm:pt-4">
                  <div className="text-center">
                    <p className="text-base sm:text-2xl font-bold text-green-600">{selectedMunicipality?.resolvedIssues || 0}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Resolved</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Resolution Rate */}
            <div className="space-y-1 sm:space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Resolution Rate</span>
                <span className="font-medium">
                  {selectedMunicipality?.totalIssues 
                    ? Math.round((selectedMunicipality.resolvedIssues / selectedMunicipality.totalIssues) * 100) 
                    : 0}%
                </span>
              </div>
              <Progress 
                value={selectedMunicipality?.totalIssues 
                  ? (selectedMunicipality.resolvedIssues / selectedMunicipality.totalIssues) * 100 
                  : 0} 
                className="h-1.5 sm:h-2" 
              />
            </div>

            {/* Issues List */}
            <div className="space-y-2 sm:space-y-4 mt-2 sm:mt-4">
              <h4 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                <FileText className="h-4 w-4" />
                Issues ({municipalityIssues.length})
              </h4>

              {issuesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 sm:h-20" />
                  ))}
                </div>
              ) : municipalityIssues.length === 0 ? (
                <div className="py-4 sm:py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No issues reported for this municipality</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 max-h-[200px] sm:max-h-[300px] overflow-y-auto">
                  {municipalityIssues.map((issue) => (
                    <Card key={issue.id} className="p-2 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex gap-2 sm:gap-3">
                          {issue.imageUrls && issue.imageUrls.length > 0 ? (
                            <img 
                              src={issue.imageUrls[0]} 
                              alt="Issue" 
                              className="w-10 h-10 sm:w-16 sm:h-16 object-cover rounded-md flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-16 sm:h-16 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                              <Image className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-base truncate">{issue.type.replace(/_/g, " ")}</p>
                            <p className="text-[10px] sm:text-sm text-muted-foreground line-clamp-1 sm:line-clamp-2">{issue.description}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">
                              {new Date(issue.createdAt).toLocaleDateString()}
                              {issue.location?.address && ` • ${issue.location.address}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 justify-end">
                          <Select
                            value={issue.status}
                            onValueChange={(value) => handleUpdateIssueStatus(issue.id, value)}
                          >
                            <SelectTrigger className="w-20 sm:w-28 h-7 sm:h-9 text-[10px] sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OPEN">Open</SelectItem>
                              <SelectItem value="CLOSED">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleDeleteIssue(issue.id)}
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-2 sm:mt-4 flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEditDialog(selectedMunicipality!)}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => {
                  setSelectedMunicipality(null);
                  setDeleteDialog({ open: true, municipality: selectedMunicipality });
                }}
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Issue Dialog - Using extracted component */}
        <ViewIssueDialog
          open={viewIssueDialog.open}
          issue={viewIssueDialog.issue}
          onOpenChange={(open) => setViewIssueDialog({ open, issue: open ? viewIssueDialog.issue : null })}
          onEdit={() => {
            setViewIssueDialog({ open: false, issue: null });
            if (viewIssueDialog.issue) {
              openEditIssueDialog(viewIssueDialog.issue);
            }
          }}
        />

        {/* Edit Issue Dialog - Using extracted component */}
        <EditIssueDialog
          open={editIssueDialog.open}
          issue={editIssueDialog.issue}
          onOpenChange={(open) => setEditIssueDialog({ open, issue: open ? editIssueDialog.issue : null })}
          form={editIssueForm}
          setForm={setEditIssueForm}
          onSubmit={handleEditIssue}
        />

        {/* Delete Issue Dialog - Using extracted component */}
        <DeleteIssueDialog
          open={deleteIssueDialog.open}
          issue={deleteIssueDialog.issue}
          onOpenChange={(open) => setDeleteIssueDialog({ open, issue: open ? deleteIssueDialog.issue : null })}
          onConfirm={handleDeleteIssueFromAll}
        />
      </main>
      <Footer />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminOnly>
      <AdminDashboardContent />
    </AdminOnly>
  );
}
