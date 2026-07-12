import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly load the most critical pages (first paint)
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// Lazy load all other pages to reduce initial bundle size
const Cards = lazy(() => import("./pages/Cards"));
const CardDetail = lazy(() => import("./pages/CardDetail"));
const Sets = lazy(() => import("./pages/Sets"));
const Pokedex = lazy(() => import("./pages/Pokedex"));
const GuessGame = lazy(() => import("./pages/GuessGame"));
const PokemonDetail = lazy(() => import("./pages/PokemonDetail"));
const Metagame = lazy(() => import("./pages/Metagame"));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder"));
const Decks = lazy(() => import("./pages/Decks"));
const Community = lazy(() => import("./pages/Community"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const Binder = lazy(() => import("./pages/Binder"));
const Drops = lazy(() => import("./pages/Drops"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Orders = lazy(() => import("./pages/Orders"));
const Auctions = lazy(() => import("./pages/Auctions"));
const Bazaar = lazy(() => import("./pages/Bazaar"));
const Articles = lazy(() => import("./pages/Articles"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const SellCard = lazy(() => import("./pages/SellCard"));
const Sell = lazy(() => import("./pages/Sell"));
const OpenStore = lazy(() => import("./pages/OpenStore"));
const StorePage = lazy(() => import("./pages/StorePage"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const AdminEscrow = lazy(() => import("./pages/AdminEscrow"));
const Login = lazy(() => import("./pages/Login"));

function PageLoader() {
  return (
    <div className="container py-12 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/cards" component={Cards} />
          <Route path="/cards/:id" component={CardDetail} />
          <Route path="/sets" component={Sets} />
          <Route path="/game" component={GuessGame} />
          <Route path="/pokedex" component={Pokedex} />
          <Route path="/pokedex/:id" component={PokemonDetail} />
          <Route path="/metagame" component={Metagame} />
          <Route path="/decks" component={Decks} />
          <Route path="/decks/builder" component={DeckBuilder} />
          <Route path="/deck-builder" component={DeckBuilder} />
          <Route path="/community" component={Community} />
          <Route path="/tournaments" component={Tournaments} />
          <Route path="/binder" component={Binder} />
          <Route path="/drops" component={Drops} />
          <Route path="/shop" component={Shop} />
          <Route path="/shop/:slug" component={ProductDetail} />
          <Route path="/cart" component={Cart} />
          <Route path="/orders" component={Orders} />
          <Route path="/marketplace" component={Shop} />
          <Route path="/auctions" component={Auctions} />
          <Route path="/bazaar" component={Bazaar} />
          <Route path="/articles" component={Articles} />
          <Route path="/articles/:slug" component={ArticleDetail} />
          <Route path="/sell" component={Sell} />
          <Route path="/sell-card" component={SellCard} />
          <Route path="/open-store" component={OpenStore} />
          <Route path="/store/:slug" component={StorePage} />
          <Route path="/profile/:username" component={PlayerProfile} />
          <Route path="/profile/edit" component={ProfileEdit} />
          <Route path="/dashboard" component={UserDashboard} />
          <Route path="/admin/escrow" component={AdminEscrow} />
          <Route path="/account" component={UserDashboard} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
