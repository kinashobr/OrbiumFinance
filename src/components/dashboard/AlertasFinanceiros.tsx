// ... keep all existing code above ...

              <DialogTitle className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                detalhesAberto?.tipo === "danger" && "bg-destructive/20 text-destructive",
                detalhesAberto?.tipo === "warning" && "bg-warning/20 text-warning",
                detalhesAberto?.tipo === "success" && "bg-success/20 text-success",
                detalhesAberto?.tipo === "info" && "bg-primary/20 text-primary"
              )}>
                {detalhesAberto && (() => {
                  const Icon = getIcon(detalhesAberto.tipo, detalhesAberto.categoria);
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{detalhesAberto?.titulo}</h3>
                <p className="text-sm text-muted-foreground">{detalhesAberto?.descricao}</p>
              </div>
            </DialogTitle>

// ... keep all existing code below ...