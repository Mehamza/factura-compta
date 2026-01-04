import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Building2, Receipt, FileText, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupWizardProps {
  onComplete: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  children: React.ReactNode;
}

const steps = [
  { id: 1, name: 'Entreprise', icon: Building2, description: 'Informations de votre société' },
  { id: 2, name: 'Facturation', icon: FileText, description: 'Format de vos factures' },
  { id: 3, name: 'TVA', icon: Receipt, description: 'Taux de TVA applicables' },
];

export default function SetupWizard({ onComplete, currentStep, setCurrentStep, children }: SetupWizardProps) {
  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Configuration initiale</h1>
        <p className="text-muted-foreground">Configurez votre entreprise en quelques étapes</p>
      </div>

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>Étape {currentStep} sur {steps.length}</span>
          <span>{Math.round(progress)}% complété</span>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex justify-center gap-4 md:gap-8">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <button
              key={step.id}
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              disabled={step.id > currentStep}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg transition-colors",
                isActive && "bg-primary/10",
                isCompleted && "cursor-pointer hover:bg-primary/5",
                step.id > currentStep && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isActive && "bg-primary text-primary-foreground",
                isCompleted && "bg-primary/20 text-primary",
                !isActive && !isCompleted && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="text-center hidden md:block">
                <p className={cn(
                  "font-medium text-sm",
                  isActive && "text-primary",
                  !isActive && "text-muted-foreground"
                )}>
                  {step.name}
                </p>
                <p className="text-xs text-muted-foreground hidden lg:block">{step.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const step = steps[currentStep - 1];
              const Icon = step.icon;
              return (
                <>
                  <Icon className="h-5 w-5" />
                  {step.name}
                </>
              );
            })()}
          </CardTitle>
          <CardDescription>
            {steps[currentStep - 1].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Précédent
        </Button>
        
        {currentStep < steps.length ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Suivant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={onComplete}>
            <Check className="h-4 w-4 mr-2" />
            Terminer la configuration
          </Button>
        )}
      </div>
    </div>
  );
}
