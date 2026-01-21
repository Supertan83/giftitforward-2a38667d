import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserCheck, 
  Building2, 
  Briefcase,
  Loader2,
  TrendingUp
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface VolunteerTrackingData {
  registered: number;
  attended: number;
  companyBreakdown: Record<string, number>;
  verticalBreakdown: Record<string, number>;
}

interface VolunteerTrackingSectionProps {
  marketplaceId: string;
  marketplaceName: string;
}

export const VolunteerTrackingSection = ({
  marketplaceId,
  marketplaceName
}: VolunteerTrackingSectionProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<VolunteerTrackingData>({
    registered: 0,
    attended: 0,
    companyBreakdown: {},
    verticalBreakdown: {}
  });

  useEffect(() => {
    loadVolunteerData();
  }, [marketplaceId, marketplaceName]);

  const loadVolunteerData = async () => {
    setIsLoading(true);
    try {
      // Get registered volunteers - those who have this marketplace in their events_list
      const { data: pendingVolunteers, error: pvError } = await supabase
        .from('pending_volunteers')
        .select('id, external_company, employee_vertical, events_list, is_employee')
        .not('events_list', 'is', null);

      if (pvError) throw pvError;

      // Filter volunteers whose events_list contains a matching event for this marketplace
      // The marketplace name might be part of an event slug like "event-7---cda" where "cda" matches "CDA"
      const marketplaceNameLower = marketplaceName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const registeredVolunteers = pendingVolunteers?.filter(pv => {
        if (!pv.events_list) return false;
        const eventsLower = pv.events_list.toLowerCase().replace(/[^a-z0-9,]/g, '');
        return eventsLower.includes(marketplaceNameLower);
      }) || [];

      // Get attended volunteers - those checked in at this marketplace
      const { data: volunteerCards, error: vcError } = await supabase
        .from('volunteer_qr_cards')
        .select(`
          id,
          checked_in_at,
          volunteer_id,
          pending_volunteers (
            id,
            external_company,
            employee_vertical,
            is_employee
          )
        `)
        .eq('marketplace_id', marketplaceId)
        .not('checked_in_at', 'is', null);

      if (vcError) throw vcError;

      // Calculate breakdowns from attended volunteers
      // Company Breakdown: for NON-Dubai Holding employees (external partners)
      // Vertical Breakdown: for Dubai Holding employees
      const companyBreakdown: Record<string, number> = {};
      const verticalBreakdown: Record<string, number> = {};

      volunteerCards?.forEach(card => {
        const volunteer = card.pending_volunteers as { 
          external_company: string | null; 
          employee_vertical: string | null;
          is_employee: boolean | null;
        } | null;
        
        if (volunteer) {
          // If NOT a Dubai Holding employee (external partner) → count in Company Breakdown
          if (!volunteer.is_employee && volunteer.external_company) {
            const company = volunteer.external_company;
            companyBreakdown[company] = (companyBreakdown[company] || 0) + 1;
          }
          
          // If IS a Dubai Holding employee → count in Vertical Breakdown
          if (volunteer.is_employee && volunteer.employee_vertical) {
            const vertical = volunteer.employee_vertical;
            verticalBreakdown[vertical] = (verticalBreakdown[vertical] || 0) + 1;
          }
        }
      });

      setData({
        registered: registeredVolunteers.length,
        attended: volunteerCards?.length || 0,
        companyBreakdown,
        verticalBreakdown
      });
    } catch (error) {
      console.error('Error loading volunteer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const attendanceRate = data.registered > 0 
    ? Math.round((data.attended / data.registered) * 100) 
    : 0;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Volunteer Tracking</h3>
            <p className="text-xs text-muted-foreground">Registered vs Attended</p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Registered vs Attended */}
          <div className="bg-gradient-to-r from-blue-500/5 to-emerald-500/5 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h4 className="font-semibold">Attendance Overview</h4>
              {data.registered > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <TrendingUp className={`w-4 h-4 ${attendanceRate >= 80 ? 'text-emerald-500' : attendanceRate >= 50 ? 'text-amber-500' : 'text-red-500'}`} />
                  <span className={`font-bold ${attendanceRate >= 80 ? 'text-emerald-600' : attendanceRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {attendanceRate}% Attendance
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-card/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{data.registered}</p>
                <p className="text-sm text-muted-foreground">Registered</p>
              </div>
              <div className="bg-card/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">{data.attended}</p>
                <p className="text-sm text-muted-foreground">Attended</p>
              </div>
            </div>

            {data.registered > 0 && (
              <Progress value={attendanceRate} className="h-3" />
            )}
          </div>

          {/* Company Breakdown - External Partners (Non-Dubai Holding) */}
          {Object.keys(data.companyBreakdown).length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Company Breakdown
                <span className="text-xs text-muted-foreground font-normal">(External Partners)</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(data.companyBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([company, count]) => (
                    <div key={company} className="bg-muted/50 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-sm truncate">{company}</span>
                      <span className="font-medium text-sm ml-2">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Vertical Breakdown - Dubai Holding Employees */}
          {Object.keys(data.verticalBreakdown).length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Vertical Breakdown
                <span className="text-xs text-muted-foreground font-normal">(Dubai Holding)</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(data.verticalBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([vertical, count]) => (
                    <div key={vertical} className="bg-muted/50 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-sm truncate">{vertical}</span>
                      <span className="font-medium text-sm ml-2">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Vertical Breakdown */}
          {Object.keys(data.verticalBreakdown).length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Vertical Breakdown
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.entries(data.verticalBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([vertical, count]) => (
                    <div key={vertical} className="bg-muted/50 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-sm truncate">{vertical}</span>
                      <span className="font-medium text-sm ml-2">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.registered === 0 && data.attended === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No volunteer data available for this marketplace.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
