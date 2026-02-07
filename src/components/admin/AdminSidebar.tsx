import {
  UserPlus, Upload, UserCheck, Award, GraduationCap, FileQuestion,
  QrCode, Store, PieChart, RefreshCw, Unlock,
  Package, TrendingUp, Users, Webhook, Database, CloudUpload, Mail, Loader2, ScrollText, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { BrandLogo } from '@/components/BrandLogo';

type AdminView = 'dashboard' | 'qr-generator' | 'statistics' | 'users' | 'marketplaces' | 'inventory' | 'webhooks' | 'partner-registrations' | 'external-items' | 'pending-volunteers' | 'training-assessments' | 'training-completion' | 'volunteer-qr' | 'marketplace-sync' | 'marketplace-reports' | 'allocations' | 'volunteer-qr-cards' | 'surpluss-sync' | 'hubspot-email-config' | 'email-logs' | 'email-management' | 'bulk-volunteer-upload' | 'traceability-logs' | 'email-templates' | 'item-list';

interface AdminSidebarProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
  onAutoUnblock: () => void;
  onHubspotSync: () => void;
  isSyncingHubspot: boolean;
}

const volunteerItems = [
  { view: 'pending-volunteers' as AdminView, label: 'Volunteers Added', icon: UserPlus, color: 'text-orange-500' },
  { view: 'bulk-volunteer-upload' as AdminView, label: 'Bulk Upload', icon: Upload, color: 'text-teal-500' },
  { view: 'volunteer-qr-cards' as AdminView, label: 'Volunteer QR Cards', icon: UserCheck, color: 'text-blue-500' },
  { view: 'training-completion' as AdminView, label: 'Training Completion', icon: Award, color: 'text-emerald-500' },
  { view: 'training-assessments' as AdminView, label: 'Training Assessments', icon: FileQuestion, color: 'text-purple-500' },
];

const beneficiaryItems = [
  { view: 'qr-generator' as AdminView, label: 'Generate QR Cards', icon: QrCode, color: 'text-primary' },
  { view: 'marketplaces' as AdminView, label: 'Marketplaces', icon: Store, color: 'text-amber-500' },
  { view: 'marketplace-reports' as AdminView, label: 'Marketplace Reports', icon: PieChart, color: 'text-indigo-500' },
  { view: 'traceability-logs' as AdminView, label: 'Traceability Logs', icon: ScrollText, color: 'text-cyan-500' },
  { view: 'marketplace-sync' as AdminView, label: 'Sync & Reset Cards', icon: RefreshCw, color: 'text-rose-500' },
];

const adminItems = [
  { view: 'item-list' as AdminView, label: 'Item List', icon: Package, color: 'text-sky-500' },
  { view: 'inventory' as AdminView, label: 'Manage Inventory', icon: Package, color: 'text-foreground' },
  { view: 'allocations' as AdminView, label: 'Allocate Items', icon: TrendingUp, color: 'text-teal-500' },
  { view: 'statistics' as AdminView, label: 'Live Statistics', icon: TrendingUp, color: 'text-emerald-500' },
  { view: 'users' as AdminView, label: 'Manage Users', icon: Users, color: 'text-violet-500' },
  { view: 'webhooks' as AdminView, label: 'Webhook Events', icon: Webhook, color: 'text-cyan-500' },
  { view: 'external-items' as AdminView, label: 'External Items', icon: Database, color: 'text-teal-500' },
  { view: 'surpluss-sync' as AdminView, label: 'Surpluss Sync', icon: Database, color: 'text-cyan-500' },
  { view: 'hubspot-email-config' as AdminView, label: 'HubSpot Emails', icon: Mail, color: 'text-pink-500' },
  { view: 'email-logs' as AdminView, label: 'Email Logs', icon: Mail, color: 'text-red-500' },
  { view: 'email-management' as AdminView, label: 'Email Preview & Test', icon: Mail, color: 'text-emerald-500' },
  { view: 'email-templates' as AdminView, label: 'Email Templates', icon: FileText, color: 'text-indigo-500' },
];

export const AdminSidebar = ({
  currentView,
  onViewChange,
  onAutoUnblock,
  onHubspotSync,
  isSyncingHubspot,
}: AdminSidebarProps) => {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const renderMenuItem = (item: { view: AdminView; label: string; icon: React.ElementType; color: string }) => (
    <SidebarMenuItem key={item.view}>
      <SidebarMenuButton
        isActive={currentView === item.view}
        onClick={() => onViewChange(item.view)}
        tooltip={item.label}
      >
        <item.icon className={`h-4 w-4 ${item.color}`} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2">
          <BrandLogo size="sm" />
          {!isCollapsed && (
            <span className="font-display font-bold text-sm truncate">GIF Admin</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Dashboard Home */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={currentView === 'dashboard'}
                onClick={() => onViewChange('dashboard')}
                tooltip="Dashboard"
              >
                <Store className="h-4 w-4 text-primary" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Volunteer Apps */}
        <SidebarGroup>
          <SidebarGroupLabel>Volunteer Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {volunteerItems.map(renderMenuItem)}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate('/training')}
                  tooltip="Training Module"
                >
                  <GraduationCap className="h-4 w-4 text-indigo-500" />
                  <span>Training Module</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Beneficiary Apps */}
        <SidebarGroup>
          <SidebarGroupLabel>Beneficiary Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {beneficiaryItems.map(renderMenuItem)}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onAutoUnblock}
                  tooltip="Auto-Unblock Cards"
                >
                  <Unlock className="h-4 w-4 text-yellow-500" />
                  <span>Auto-Unblock Cards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Admin Apps */}
        <SidebarGroup>
          <SidebarGroupLabel>Admin Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map(renderMenuItem)}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onHubspotSync}
                  disabled={isSyncingHubspot}
                  tooltip={isSyncingHubspot ? 'Syncing...' : 'Sync to HubSpot'}
                >
                  {isSyncingHubspot ? (
                    <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
                  ) : (
                    <CloudUpload className="h-4 w-4 text-orange-500" />
                  )}
                  <span>{isSyncingHubspot ? 'Syncing...' : 'Sync to HubSpot'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
