import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Shield, Car, Calendar, DollarSign } from "lucide-react";
import { useFinance, SeguroVeiculo, Veiculo } from "@/contexts/FinanceContext";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/types/finance";

interface SeguroParcelaSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectParcela: (seguroId: number, parcelaNumero: number, valor: number, vencimento: string) => void;
}

interface ParcelaPendente {
  seguro: SeguroVeiculo;
  veiculo: Veiculo | undefined;
  parcela: SeguroVeiculo['parcelas'][0];
  diasVencimento: number;
}

export function SeguroParcelaSelector({
  open,
  onOpenChange,
  onSelectParcela,
}: SeguroParcelaSelectorProps) {
  const { segurosVeiculo, veiculos } = useFinance();
  const hoje = new Date();

  const parcelasPendentes = useMemo<ParcelaPendente[]>(() => {
    const pendentes: ParcelaPendente[] = [];
    
    segurosVeiculo.forEach(seguro => {
      const veiculo = veiculos.find(v => v.id === seguro.veiculoId);
      seguro.parcelas.forEach(parcela => {
        if (!parcela.paga) {
          const venc = new Date(parcela.vencimento);
          const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          
          pendentes.push({ seguro, veiculo, parcela, diasVencimento: dias });
        }
      });
    });
    
    return pendentes.sort((a, b) => a.diasVencimento - b.diasVencimento);
  }, [segurosVeiculo, veiculos]);

  const handleSelect = (item: ParcelaPendente) => {
    onSelectParcela(
      item.seguro.id,
      item.parcela.numero,
      item.parcela.valor,
      item.parcela.vencimento
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Selecionar Parcela de Seguro
          </DialogTitle>
          <DialogDescription>
            Escolha qual parcela de seguro será paga com esta transação.
          </DialogDescription>
        </DialogHeader>

        {parcelasPendentes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-8 h-8 mx-auto mb-3 text-success" />
            <p className="font-medium">Nenhuma parcela de seguro pendente.</p>
            <p className="text-sm">Todos os seguros estão em dia.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Seguradora</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasPendentes.map((item) => {
                  const vencida = item.diasVencimento < 0;
                  const proximaVencer = item.diasVencimento >= 0 && item.diasVencimento <= 7;
                  
                  return (
                    <TableRow key={`${item.seguro.id}-${item.parcela.numero}`} className="hover:bg-muted/50">
                      <TableCell className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        {item.veiculo?.modelo || "N/A"}
                      </TableCell>
                      <TableCell>{item.seguro.seguradora}</TableCell>
                      <TableCell>
                        {item.parcela.numero}/{item.seguro.numeroParcelas}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {new Date(item.parcela.vencimento).toLocaleDateString("pt-BR")}
                          {vencida && (
                            <Badge variant="destructive" className="text-xs">Vencida</Badge>
                          )}
                          {proximaVencer && (
                            <Badge variant="outline" className="text-xs border-warning text-warning">
                              {item.diasVencimento}d
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(item.parcela.valor)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-warning text-warning">Pendente</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSelect(item)}
                          className="h-8 px-3"
                        >
                          Selecionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}