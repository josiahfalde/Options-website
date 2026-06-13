import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Campaigns from "./pages/Campaigns";
import Screener from "./pages/Screener";
import RadarPage from "./pages/Radar";
import CalendarPage from "./pages/Calendar";
import Insights from "./pages/Insights";
import ImportData from "./pages/ImportData";
import Account from "./pages/Account";
import Disclaimer from "./pages/Disclaimer";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/import" element={<ImportData />} />
        <Route path="/account" element={<Account />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}
