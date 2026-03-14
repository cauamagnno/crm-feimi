import React from 'react';
import { Rocket, CheckCircle, Circle, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';

interface OnboardingBannerProps {
  onOpenWizard: () => void;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ onOpenWizard }) => {
  const { loading, isComplete, steps, completionPercentage } = useOnboardingStatus();

  if (loading || isComplete) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 mb-8">
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center">
                <Rocket className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Complete a configuração do sistema</h3>
                <p className="text-sm text-muted-foreground">Configure sua empresa para começar a usar o sistema</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Progresso</span>
                <span className="font-semibold text-foreground">{completionPercentage}% concluído</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-foreground/80 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Steps Summary */}
            <div className="flex flex-wrap gap-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                    step.isComplete
                      ? 'bg-muted text-foreground border-border'
                      : step.isRequired
                      ? 'bg-muted/60 text-muted-foreground border-border/60'
                      : 'bg-muted/30 text-muted-foreground/70 border-border/40'
                  }`}
                >
                  {step.isComplete ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : step.isRequired ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  {step.title}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0">
            <Button
              variant="primary"
              onClick={onOpenWizard}
              className="gap-2 whitespace-nowrap"
            >
              Continuar Configuração
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
