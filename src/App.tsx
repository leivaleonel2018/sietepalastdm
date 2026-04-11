import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import GlobalChat from "@/components/GlobalChat";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Rankings from "./pages/Rankings";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import PlayerProfile from "./pages/PlayerProfile";
import AdminPanel from "./pages/AdminPanel";
import Challenges from "./pages/Challenges";
import Rules from "./pages/Rules";
import NewsDetail from "./pages/NewsDetail";
import AllNews from "./pages/AllNews";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/torneos" element={<Tournaments />} />
            <Route path="/torneo/:id" element={<TournamentDetail />} />
            <Route path="/jugador/:id" element={<PlayerProfile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/desafios" element={<Challenges />} />
            <Route path="/reglas" element={<Rules />} />
            <Route path="/noticia/:id" element={<NewsDetail />} />
            <Route path="/noticias" element={<AllNews />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <GlobalChat />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
