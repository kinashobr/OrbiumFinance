import React, { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { BillsTrackerModal } from '@/components/bills/BillsTrackerModal';
import { FixedBillSelectorModal } from '@/components/bills/FixedBillSelectorModal';
import { startOfMonth } from 'date-fns';

export default function BillsTrackerPage() {
  const { 
    getPotentialFixedBillsForMonth, 
    getFutureFixedBills, 
    getBillsForMonth,
    toggleFixedBill 
  } = useFinance();
  
  const [currentDate] = useState(startOfMonth(new Date()));
  const [isTrackerOpen, setIsTrackerOpen] = useState(true);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  
  const trackerManagedBills = useMemo(() => getBillsForMonth(currentDate), [getBillsForMonth, currentDate]);

  const potentialFixedBills = useMemo(() => 
    getPotentialFixedBillsForMonth(currentDate, trackerManagedBills)
  , [getPotentialFixedBillsForMonth, currentDate, trackerManagedBills]);

  const futureFixedBills = useMemo(() => 
    getFutureFixedBills(currentDate, trackerManagedBills)
  , [getFutureFixedBills, currentDate, trackerManagedBills]);

  return (
    <div className="p-6">
      <BillsTrackerModal 
        open={isTrackerOpen} 
        onOpenChange={setIsTrackerOpen} 
      />

      <FixedBillSelectorModal
        open={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        mode="current"
        currentDate={currentDate}
        potentialFixedBills={potentialFixedBills}
        onToggleFixedBill={(bill, checked) => toggleFixedBill(bill, checked, currentDate)}
      />

      <FixedBillSelectorModal
        open={isAdvanceModalOpen}
        onOpenChange={setIsAdvanceModalOpen}
        mode="future"
        currentDate={currentDate}
        potentialFixedBills={futureFixedBills}
        onToggleFixedBill={(bill, checked) => toggleFixedBill(bill, checked, currentDate)}
      />
    </div>
  );
}