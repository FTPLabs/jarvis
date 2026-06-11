import { Switch, Route, Router as WouterRouter } from "wouter";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "@/components/ui/toaster";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import NotFound from "@/pages/not-found";

  import Dashboard from "@/pages/dashboard";
  import Memory from "@/pages/memory";
  import Apps from "@/pages/apps";
  import Stats from "@/pages/stats";
  import Settings from "@/pages/settings";
  import License from "@/pages/license";

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 4000 } },
  });

  function Router() {
    return (
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/memory" component={Memory} />
        <Route path="/apps" component={Apps} />
        <Route path="/stats" component={Stats} />
        <Route path="/settings" component={Settings} />
        <Route path="/license" component={License} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  export default App;
  