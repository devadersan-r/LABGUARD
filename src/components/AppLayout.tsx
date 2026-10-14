import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  ShieldCheck, 
  FileSearch, 
  ShieldAlert, 
  Settings, 
  Search, 
  LogOut, 
  Menu, 
  X,
} from 'lucide-react';
import { TrueguardLogo } from './TrueguardLogo';
import { UserSession } from '../types';

export type NavTab = 
  | 'dashboard' 
  | 'sessions' 
  | 'evidence' 
  | 'inspection' 
  | 'tampering' 
  | 'settings';

interface AppLayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  session: UserSession;
  onLogout: () => void;
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  globalSearch?: string;
  onGlobalSearchChange?: (val: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  session,
  onLogout,
  children,
  headerTitle,
  headerSubtitle,
  globalSearch = '',
  onGlobalSearchChange,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sessions', label: 'Recording Sessions', icon: Radio },
    { id: 'evidence', label: 'Evidence Verification', icon: ShieldCheck },
    { id: 'inspection', label: 'Record Inspection', icon: FileSearch },
    { id: 'tampering', label: 'Tampering Demo', icon: ShieldAlert },
    { id: 'settings', label: 'Settings / About', icon: Settings },
  ];

  const defaultTitle = currentTab === 'sessions' 
    ? 'Recording Sessions' 
    : currentTab === 'dashboard'
    ? 'Main Dashboard'
    : currentTab === 'evidence'
    ? 'Evidence Verification'
    : currentTab === 'inspection'
    ? 'Record Inspection'
    : currentTab === 'tampering'
    ? 'Tampering Demonstration'
    : 'System Settings & About';

  const defaultSubtitle = currentTab === 'sessions'
    ? 'Collect, organize, and export hardware telemetry records.'
    : currentTab === 'evidence'
    ? 'Check exported telemetry records for unauthorized changes, missing entries, and integrity failures.'
    : 'Hardware telemetry viability, cryptographic status, and live sensor stream.';

  const displayTitle = headerTitle || defaultTitle;
  const displaySubtitle = headerSubtitle || defaultSubtitle;

  return (
    <div className="min-h-screen bg-[#EAF9FF] text-[#17324D] flex flex-col md:flex-row relative selection:bg-[#BDEDFD] selection:text-[#082F61]">
      {/* Background Soft Ambient Grid & Accents */}
      <div className="absolute inset-0 bg-circuit-grid pointer-events-none opacity-40" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#BDEDFD]/30 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-[#C9EAF7]/40 blur-[150px] pointer-events-none" />

      {/* Sidebar Navigation (Left Column) - Light Blue & White Theme */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-[#FFFFFF] border-r border-[#C9EAF7] flex flex-col justify-between shrink-0 transition-transform duration-300 shadow-sm ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Logo & Mobile Close */}
          <div className="flex items-center justify-between">
            <TrueguardLogo size="sm" showTagline={false} theme="light" />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-[#58758D] hover:text-[#082F61] rounded-lg"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer leading-normal ${
                    isActive
                      ? 'bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA] shadow-xs font-bold'
                      : 'text-[#58758D] hover:text-[#082F61] hover:bg-[#F4FBFF]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#087EE8]' : 'text-[#58758D]'}`} />
                  <span className="truncate">{item.label}</span>
                  {item.id === 'sessions' && (
                    <span className="ml-auto text-[13px] bg-[#087EE8] text-white px-2 py-0.5 rounded-md font-mono-telemetry font-bold">
                      12
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Hardware Enclave Status */}
        <div className="p-4 m-3 rounded-xl bg-[#F4FBFF] border border-[#C9EAF7] text-xs space-y-1.5">
          <div className="flex items-center justify-between text-[14px] text-[#087EE8]">
            <span className="flex items-center gap-1.5 font-bold text-[#082F61]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              ESP32 RIG #1
            </span>
            <span className="font-bold text-[#10B981]">ONLINE</span>
          </div>
          <div className="text-[14px] text-[#58758D] font-mono-telemetry truncate">
            FW: LABGUARD-v2.4
          </div>
        </div>
      </aside>

      {/* Main Content Area (Right Column) */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-[#C9EAF7] bg-[#FFFFFF]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-xs">
          {/* Left: Mobile Toggle & Page Title/Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-[#082F61] hover:bg-[#F4FBFF] rounded-xl transition-colors shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#082F61] tracking-tight truncate leading-tight">
                {displayTitle}
              </h1>
              <p className="text-xs text-[#58758D] truncate hidden sm:block">
                {displaySubtitle}
              </p>
            </div>
          </div>

          {/* Right: Search, Demo Mode Badge, User Profile: Team Student, Sign Out */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Search field */}
            <div className="hidden lg:flex items-center relative w-48 xl:w-56">
              <Search className="w-4 h-4 text-[#58758D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange && onGlobalSearchChange(e.target.value)}
                placeholder="Search telemetry..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-[#F4FBFF] border border-[#C9EAF7] rounded-xl text-xs text-[#17324D] placeholder-[#58758D]/70 focus:outline-none focus:ring-1 focus:ring-[#087EE8] font-medium"
              />
            </div>

            {/* Demo Mode Badge in Light Blue Theme */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold bg-[#BDEDFD] text-[#082F61] border border-[#A5E3FA] shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#087EE8] animate-pulse" />
              <span>Demo Mode</span>
            </div>

            {/* User Profile: Team Student */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-[#C9EAF7]">
              <div className="w-8 h-8 rounded-full bg-[#BDEDFD] border border-[#C9EAF7] flex items-center justify-center text-[#082F61] text-xs font-bold shrink-0">
                TS
              </div>
              <div className="hidden xl:block text-left leading-tight">
                <span className="text-xs font-bold text-[#082F61] block">Team Student</span>
                <span className="text-[13px] text-[#58758D] block truncate max-w-[140px]">
                  {session.email}
                </span>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#F4FBFF] hover:bg-[#EAF9FF] text-[#082F61] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs border border-[#C9EAF7]"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-[#087EE8]" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
