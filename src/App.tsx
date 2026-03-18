import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import TrainingPage from "./pages/TrainingPage";
import TrainingCompletePage from "./pages/TrainingCompletePage";
import VolunteerSurveyPage from "./pages/VolunteerSurveyPage";
import ExternalSurveyPage from "./pages/ExternalSurveyPage";
import OnsiteRegistrationPage from "./pages/OnsiteRegistrationPage";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/training/complete" element={<TrainingCompletePage />} />
            <Route path="/volunteer-survey" element={<VolunteerSurveyPage />} />
            <Route path="/survey" element={<ExternalSurveyPage />} />
            <Route path="/register" element={<OnsiteRegistrationPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
