import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, parseDateLocal } from "@/lib/utils";
import { useFinance } from "@/contexts/FinanceContext";
import { BillDisplayItem, BillSourceType, BillTracker, ExternalPaidBill, formatCurrency } from "@/types/finance";
import {
  Building2,
  Shield,
  Repeat,
  DollarSign,
  Info,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { format, differenceInCalendarDays, isSameDay } from "date-fns";

interface BillsTrackerMobileListProps {
  bills: BillDisplayItem[];
  onUpdateBill: (id: string, updates: Partial<BillTracker>) => void;
  onDeleteBill: (id: string) => void;
  onAddBill: (bill: Omit<BillTracker, "id" | "isPaid" | "type">) => void;
  onTogglePaid: (bill: BillTracker, isChecked: boolean) => void;
  currentDate: Date;
}

const SOURCE_CONFIG_MOBILE: Record<
  BillSourceType | "external_expense",
  { icon: React.ElementType; color: string; label: string }
> = {
  loan_installment: { icon: Building2, color: "text-tertiary", label: "Empréstimo" },
  insurance_installment: { icon: Shield, color: "text-info", label: "Seguro" },
  fixed_expense: { icon: Repeat, color: "text-secondary", label: "Fixa" },
  variable_expense: { icon: DollarSign, color: "text-warning", label: "Variável" },
  ad_hoc: { icon: Info, color: "text-primary", label: "Avulsa" },
  purchase_installment: { icon: ShoppingCart, color: "text-tertiary", label: "Parcela" },
  external_expense: { icon: CheckCircle2, color: "text-success", label: "Extrato" },
};

const isBillTracker = (bill: BillDisplayItem): bill is BillTracker => bill.type === "tracker";
const isExternalPaidBill = (bill: BillDisplayItem): bill is ExternalPaidBill => bill.type === "external_paid";

const formatDateLabel = (dateStr: string) => {
  const d = parseDateLocal(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const formatAmountInput = (value: string) => {
  const cleaned = value.replace(/[^\d,]/g, "");
  const parts = cleaned.split(",");
  if (parts.length > 2) return value;
  return cleaned;
};

const parseAmount = (value: string): number => {
  const parsed = parseFloat(value.replace(".", "").replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
};

export function BillsTrackerMobileList({
  bills,
  onUpdateBill,
  onDeleteBill,
  onAddBill,
  onTogglePaid,
  currentDate,
}: BillsTrackerMobileListProps) {
  const { contasMovimento, categoriasV2 } = useFinance();
  const [newBillData, setNewBillData] = useState({
    description: "",
    amount: "",
    dueDate: format(currentDate, "yyyy-MM-dd"),
  });

  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const sortedBills = useMemo(() => {
    const tracker = bills.filter(isBillTracker).filter((b) => !b.isExcluded);
    const external = bills.filter(isExternalPaidBill);

    const pending = tracker
      .filter((b) => !b.isPaid)
      .sort(
        (a, b) =>
          parseDateLocal(a.dueDate).getTime() - parseDateLocal(b.dueDate).getTime(),
      );

    const paid = [...tracker.filter((b) => b.isPaid), ...external].sort(
      (a, b) =>
        parseDateLocal(b.paymentDate || b.dueDate).getTime() -
        parseDateLocal(a.paymentDate || a.dueDate).getTime(),
    );

    return [...pending, ...paid];
  }, [bills]);

  const sections = useMemo(() => {
    const result: Record<
      "overdue" | "today" | "yesterday" | "thisWeek" | "upcoming" | "paid",
      BillDisplayItem[]
    > = {
      overdue: [],
      today: [],
      yesterday: [],
      thisWeek: [],
      upcoming: [],
      paid: [],
    };

    sortedBills.forEach((bill) => {
      const isPaid = bill.isPaid;
      const due = parseDateLocal(bill.dueDate);
      const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffDays = differenceInCalendarDays(dueMid, todayMid);

      if (isPaid || isExternalPaidBill(bill)) {
        result.paid.push(bill);
        return;
      }

      if (diffDays < 0) {
        result.overdue.push(bill);
      } else if (diffDays === 0) {
        result.today.push(bill);
      } else if (diffDays === -1) {
        result.yesterday.push(bill);
      } else if (diffDays <= 7) {
        result.thisWeek.push(bill);
      } else {
        result.upcoming.push(bill);
      }
    });

    return result;
  }, [sortedBills, todayMid]);

  const handleAddAdHocBill = () => {
    const amount = parseAmount(newBillData.amount);
    if (!newBillData.description || amount <= 0 || !newBillData.dueDate) return;

    onAddBill({
      description: newBillData.description,
      dueDate: newBillData.dueDate,
      expectedAmount: amount,
      sourceType: "ad_hoc",
      suggestedAccountId: contasMovimento.find((c) => c.accountType === "corrente")?.id,
      suggestedCategoryId: null,
    });

    setNewBillData({
      description: "",
      amount: "",
      dueDate: format(currentDate, "yyyy-MM-dd"),
    });
  };

  const renderSection = (
    key: keyof typeof sections,
    label: string,
    accentClass: string,
  ) => {
    const items = sections[key];
    if (!items.length) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className={cn("text-[10px] font-semibold uppercase tracking-tight text-muted-foreground", accentClass)}>
            {label}
          </p>
          {key === "overdue" && (
            <span className="text-[10px] text-destructive/80 font-medium">
              Atenção às contas vencidas
            </span>
          )}
        </div>

        <div className="space-y-2">
          {items.map((bill) => {
            const cfg =
              SOURCE_CONFIG_MOBILE[bill.sourceType] || SOURCE_CONFIG_MOBILE.ad_hoc;
            const Icon = cfg.icon;
            const isExt = isExternalPaidBill(bill);
            const isPaid = bill.isPaid;
            const dueDateLabel = formatDateLabel(bill.dueDate);
            const cat = categoriasV2.find(
              (c) => c.id === bill.suggestedCategoryId,
            );
            const account = contasMovimento.find(
              (a) => a.id === bill.suggestedAccountId,
            );

            const isOverdue =
              !isPaid &&
              differenceInCalendarDays(
                new Date(
                  parseDateLocal(bill.dueDate).getFullYear(),
                  parseDateLocal(bill.dueDate).getMonth(),
                  parseDateLocal(bill.dueDate).getDate(),
                ),
                todayMid,
              ) < 0;

            return (
              <div
                key={bill.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5 flex gap-3 items-center bg-card/95 shadow-sm",
                  "border-border/60",
                  isOverdue && "border-destructive/40 bg-destructive/5",
                  isPaid && !isExt && "border-success/40 bg-success/5",
                  isExt && "opacity-70",
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-lg bg-muted/70 flex items-center justify-center">
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 h-5 text-[9px] border-0 font-semibold",
                      cfg.color,
                    )}
                  >
                    {cfg.label}
                  </Badge>
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {bill.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {cat?.icon && <span className="mr-1">{cat.icon}</span>}
                    {cat?.label || "Sem categoria"}
                    {account && " • "}
                    {account?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/80">
                    {isPaid || isExt ? "Pago em " : "Vence em "}
                    {bill.paymentDate
                      ? formatDateLabel(bill.paymentDate)
                      : dueDateLabel}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between gap-1 self-stretch">
                  <p
                    className={cn(
                      "text-xs font-extrabold",
                      isPaid || isExt ? "text-success" : "text-destructive",
                    )}
                  >
                    {formatCurrency(bill.expectedAmount)}
                  </p>

                  <div className="flex items-center gap-2">
                    {isExt ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Checkbox
                        className="h-4 w-4"
                        checked={isPaid}
                        onCheckedChange={(checked) =>
                          onTogglePaid(bill as BillTracker, checked as boolean)
                        }
                      />
                    )}

                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[9px] font-semibold border-0",
                        isPaid || isExt
                          ? "bg-success/10 text-success"
                          : isOverdue
                          ? "bg-destructive/10 text-destructive"
                          : "bg-warning/10 text-warning",
                      )}
                    >
                      {isPaid || isExt
                        ? "Concluído"
                        : isOverdue
                        ? "Vencido"
                        : "Pendente"}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
      {/* Nova Conta (compacto, estilo Pixel) */}
      <div className="glass-card p-3 rounded-xl bg-muted/30 border border-border/60 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-0.5">
            <Label className="text-[10px] text-muted-foreground opacity-80">
              Nova Conta
            </Label>
            <Input
              value={newBillData.description}
              onChange={(e) =>
                setNewBillData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Descrição..."
              className="h-8 text-xs rounded-lg"
            />
          </div>
          <div className="w-[90px] space-y-0.5">
            <Label className="text-[10px] text-muted-foreground opacity-80">
              Valor
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={newBillData.amount}
              onChange={(e) =>
                setNewBillData((prev) => ({
                  ...prev,
                  amount: formatAmountInput(e.target.value),
                }))
              }
              placeholder="0,00"
              className="h-8 text-xs rounded-lg"
            />
          </div>
          <div className="w-[110px] space-y-0.5">
            <Label className="text-[10px] text-muted-foreground opacity-80">
              Vencimento
            </Label>
            <Input
              type="date"
              value={newBillData.dueDate}
              onChange={(e) =>
                setNewBillData((prev) => ({
                  ...prev,
                  dueDate: e.target.value,
                }))
              }
              className="h-8 text-[11px] rounded-lg"
            />
          </div>
          <Button
            onClick={handleAddAdHocBill}
            className="h-8 w-9 p-0"
            disabled={
              !newBillData.description || parseAmount(newBillData.amount) <= 0
            }
          >
            +
          </Button>
        </div>
      </div>

      {/* Lista em seções por dia / status */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {renderSection("overdue", "Vencidos", "text-destructive")}
        {renderSection("today", "Hoje", "text-primary")}
        {renderSection("yesterday", "Ontem", "text-muted-foreground")}
        {renderSection("thisWeek", "Esta Semana", "text-tertiary")}
        {renderSection("upcoming", "Próximos", "text-info")}
        {renderSection("paid", "Pagas Recentes", "text-success")}
      </div>
    </div>
  );
}
