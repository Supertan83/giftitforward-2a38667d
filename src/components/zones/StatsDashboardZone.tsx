import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, Users, UserCheck, Package, Clock, MapPin, 
  TrendingUp, ShoppingBag, DoorOpen, LogOut, CreditCard
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/StatCard';
import { useQRCards, useVolunteerQRCards, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations } from '@/hooks/useMarketplaceAllocations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

export const StatsDashboardZone = () => {
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('all');

  const { data: qrCards = [], isLoading: isLoadingCards } = useQRCards();
  const { data: volunteerCards = [], isLoading: isLoadingVolunteers } = useVolunteerQRCards();
  const { data: marketplaces = [], isLoading: isLoadingMarketplaces } = useMarketplaces();
  const { data: allocations = [], isLoading: isLoadingAllocations } = useMarketplaceAllocations(
    selectedMarketplaceId === 'all' ? undefined : selectedMarketplaceId
  );

  const isLoading = isLoadingCards || isLoadingVolunteers || isLoadingMarketplaces || isLoadingAllocations;

  // Filter marketplaces for selector
  const availableMarketplaces = marketplaces.filter(m => m.status === 'upcoming' || m.status === 'active');
  const selectedMarketplace = availableMarketplaces.find(m => m.id === selectedMarketplaceId);

  // Calculate beneficiary statistics
  const beneficiaryStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filteredCards = selectedMarketplaceId === 'all' 
      ? qrCards 
      : qrCards.filter(c => c.marketplaceId === selectedMarketplaceId);

    const activeCards = filteredCards.filter(c => c.status === 'active');
    const checkedOutCards = filteredCards.filter(c => c.status === 'checked_out');
    const allProcessedCards = [...activeCards, ...checkedOutCards];

    // Cards activated today
    const activatedToday = filteredCards.filter(c => {
      if (!c.activatedAt) return false;
      const activatedDate = new Date(c.activatedAt);
      activatedDate.setHours(0, 0, 0, 0);
      return activatedDate.getTime() === today.getTime();
    }).length;

    // Total items distributed from marketplace allocations (accurate count)
    const totalItemsDistributed = allocations.reduce((sum, a) => sum + a.distributedQuantity, 0);

    // Average items per beneficiary
    const avgItemsPerBeneficiary = allProcessedCards.length > 0 
      ? Math.round((totalItemsDistributed / allProcessedCards.length) * 10) / 10
      : 0;

    // Build marketplace credit limit lookup
    const marketplaceLimitMap: Record<string, number> = {};
    for (const m of marketplaces) {
      marketplaceLimitMap[m.id] = m.beneficiary_credit_limit ?? 15;
    }

    // Credits used (marketplace limit - remaining balance)
    const totalCreditsUsed = allProcessedCards.reduce((sum, c) => {
      const limit = c.marketplaceId ? (marketplaceLimitMap[c.marketplaceId] ?? 15) : 15;
      return sum + (limit - (c.creditBalance || 0));
    }, 0);

    // Gender breakdown
    const genderBreakdown = {
      male: allProcessedCards.filter(c => c.gender === 'male').length,
      female: allProcessedCards.filter(c => c.gender === 'female').length,
      other: allProcessedCards.filter(c => c.gender && c.gender !== 'male' && c.gender !== 'female').length,
    };

    // Total children
    const totalChildren = allProcessedCards.reduce((sum, c) => sum + (c.childrenCount || 0), 0);

    return {
      totalBeneficiaries: allProcessedCards.length,
      activatedToday,
      currentlyActive: activeCards.length,
      checkedOut: checkedOutCards.length,
      totalItemsDistributed,
      avgItemsPerBeneficiary,
      totalCreditsUsed,
      genderBreakdown,
      totalChildren,
    };
  }, [qrCards, selectedMarketplaceId, allocations, marketplaces]);

  // Calculate volunteer statistics
  const volunteerStats = useMemo(() => {
    const filteredVolunteers = selectedMarketplaceId === 'all'
      ? volunteerCards
      : volunteerCards.filter(v => v.marketplace_id === selectedMarketplaceId);

    const checkedIn = filteredVolunteers.filter(v => v.status === 'checked_in');
    const checkedOut = filteredVolunteers.filter(v => v.status === 'checked_out');

    // Total hours worked
    const totalHoursWorked = filteredVolunteers.reduce((sum, v) => sum + (v.total_hours_worked || 0), 0);

    return {
      totalVolunteers: filteredVolunteers.length,
      currentlyActive: checkedIn.length,
      checkedOut: checkedOut.length,
      totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
    };
  }, [volunteerCards, selectedMarketplaceId]);

  const totalBeneficiaries = beneficiaryStats.totalBeneficiaries;
  const genderTotal = beneficiaryStats.genderBreakdown.male + beneficiaryStats.genderBreakdown.female + beneficiaryStats.genderBreakdown.other;

  return (
    <div className="min-h-full p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 md:mb-6"
      >
        <div className="flex items-center gap-2 text-primary mb-1">
          <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium uppercase tracking-wider">Live Stats</span>
        </div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Marketplace Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 md:mt-1">
          Real-time statistics for beneficiaries and volunteers
        </p>
      </motion.div>

      {/* Marketplace Selector */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-4 md:mb-6"
      >
        <div className="bg-card rounded-xl border border-border p-3 md:p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Filter by Marketplace</span>
          </div>
          <Select
            value={selectedMarketplaceId}
            onValueChange={setSelectedMarketplaceId}
            disabled={isLoadingMarketplaces}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Marketplaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Marketplaces</SelectItem>
              {availableMarketplaces.map((marketplace) => (
                <SelectItem key={marketplace.id} value={marketplace.id}>
                  <div className="flex items-center gap-2">
                    <span>{marketplace.name}</span>
                    {marketplace.location && (
                      <span className="text-muted-foreground text-xs">
                        ({marketplace.location})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMarketplace && (
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMarketplace.event_date 
                ? `Event date: ${new Date(selectedMarketplace.event_date).toLocaleDateString()}`
                : 'No date set'}
            </p>
          )}
        </div>
      </motion.div>

      {/* Beneficiary Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Beneficiary Statistics</h2>
        </div>
        
        {/* Live Queue Metrics */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3">
          <StatCard
            icon={DoorOpen}
            label="Activated (Entrance)"
            value={isLoading ? '-' : beneficiaryStats.activatedToday}
            variant="success"
          />
          <StatCard
            icon={Users}
            label="In Queue"
            value={isLoading ? '-' : beneficiaryStats.currentlyActive}
            variant="warning"
          />
          <StatCard
            icon={LogOut}
            label="Checked Out (Exit)"
            value={isLoading ? '-' : beneficiaryStats.checkedOut}
            variant="default"
          />
          <StatCard
            icon={UserCheck}
            label="Total Served"
            value={isLoading ? '-' : beneficiaryStats.totalBeneficiaries}
            variant="primary"
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3">
          <StatCard
            icon={ShoppingBag}
            label="Items Distributed"
            value={isLoading ? '-' : beneficiaryStats.totalItemsDistributed}
            variant="warning"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Items/Person"
            value={isLoading ? '-' : beneficiaryStats.avgItemsPerBeneficiary}
            variant="default"
          />
        </div>

        {/* Additional Beneficiary Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Gender Breakdown */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Gender Distribution</span>
                <span>{genderTotal} recorded</span>
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                {genderTotal > 0 && (
                  <>
                    <div 
                      className="bg-blue-500 transition-all"
                      style={{ width: `${(beneficiaryStats.genderBreakdown.male / genderTotal) * 100}%` }}
                    />
                    <div 
                      className="bg-pink-500 transition-all"
                      style={{ width: `${(beneficiaryStats.genderBreakdown.female / genderTotal) * 100}%` }}
                    />
                    <div 
                      className="bg-purple-500 transition-all"
                      style={{ width: `${(beneficiaryStats.genderBreakdown.other / genderTotal) * 100}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex gap-4 mt-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Male: {beneficiaryStats.genderBreakdown.male}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  Female: {beneficiaryStats.genderBreakdown.female}
                </span>
              </div>
            </div>

            {/* Children & Credits */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{beneficiaryStats.totalChildren}</p>
                <p className="text-xs text-muted-foreground">Total Children</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{beneficiaryStats.totalCreditsUsed}</p>
                <p className="text-xs text-muted-foreground">Credits Used</p>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Volunteer Stats Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-success" />
          <h2 className="font-semibold text-sm">Volunteer Statistics</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-3">
          <StatCard
            icon={UserCheck}
            label="Currently Active"
            value={isLoading ? '-' : volunteerStats.currentlyActive}
            variant="success"
          />
          <StatCard
            icon={Users}
            label="Total Volunteers"
            value={isLoading ? '-' : volunteerStats.totalVolunteers}
            variant="primary"
          />
          <StatCard
            icon={Clock}
            label="Hours Worked"
            value={isLoading ? '-' : volunteerStats.totalHoursWorked}
            subValue="Total"
            variant="warning"
          />
          <StatCard
            icon={CreditCard}
            label="Checked Out"
            value={isLoading ? '-' : volunteerStats.checkedOut}
            variant="default"
          />
        </div>

        {/* Volunteer Capacity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Volunteer Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active vs Total</span>
                <span className="font-medium">
                  {volunteerStats.currentlyActive} / {volunteerStats.totalVolunteers}
                </span>
              </div>
              <Progress 
                value={volunteerStats.totalVolunteers > 0 
                  ? (volunteerStats.currentlyActive / volunteerStats.totalVolunteers) * 100 
                  : 0
                } 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {volunteerStats.totalVolunteers > 0 
                  ? `${Math.round((volunteerStats.currentlyActive / volunteerStats.totalVolunteers) * 100)}% currently active`
                  : 'No volunteers registered'}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
