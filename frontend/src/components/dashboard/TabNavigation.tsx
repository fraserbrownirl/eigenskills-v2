import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Terminal, List, Activity, Code, Send, KeyRound, Brain } from "lucide-react";

export type TabType = "task" | "skills" | "memory" | "history" | "logs" | "messaging" | "secrets";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: TabType) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: TabType; label: string; icon: typeof Terminal }[] = [
    { id: "task", label: "Task", icon: Terminal },
    { id: "skills", label: "Skills", icon: Code },
    { id: "memory", label: "Memory", icon: Brain },
    { id: "history", label: "History", icon: List },
    { id: "logs", label: "Logs", icon: Activity },
    { id: "messaging", label: "Telegram", icon: Send },
    { id: "secrets", label: "Secrets", icon: KeyRound },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "gap-2",
              activeTab === tab.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
