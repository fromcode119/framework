import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Settings, Search, Bell, Activity, Sun, Moon, Plus, X, Menu,
  GraduationCap, Users, FileText, ShoppingCart, Puzzle, Languages, ArrowUpRight,
  MoreHorizontal, Mail, PieChart, Target, Shield, Zap, CheckCircle2, Clock,
  ArrowRight, Sliders, ToggleLeft as ToggleIcon, Save, Trash2, Filter, Download,
  ChevronDown, BarChart3, TrendingUp, Globe, Briefcase, Copy, ExternalLink,
  ChevronRight, Lock, Key, ShieldCheck, MailWarning, UserPlus, Database,
  Cpu, HardDrive, RefreshCw, Eye, Edit3
} from 'lucide-react';

const App = () => {
  const [theme, setTheme] = useState('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState('Dashboard');
  const [selectedRows, setSelectedRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const bgMain = theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50';
  const bgCard = theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-slate-800' : 'border-slate-200';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';

  const renderContent = () => {
    switch(currentView) {
      case 'Dashboard': return <DashboardView theme={theme} selectedRows={selectedRows} setSelectedRows={setSelectedRows} />;
      case 'plugins': return <PluginsView theme={theme} onConfig={(name) => { setCurrentView('PluginDetail') }} />;
      case 'Users': return <UsersView theme={theme} />;
      case 'settings': return <ConfigurationView theme={theme} />;
      default: return <div className="flex items-center justify-center h-96 text-slate-500 font-mono">Module "{currentView}" Initializing...</div>;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-300 ${bgMain} ${textSecondary} font-sans`}>
      {/* Sidebar Restored with full navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${theme === 'dark' ? 'bg-[#020617] border-slate-800' : 'bg-white border-slate-200'} border-r flex flex-col`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Zap size={18} className="text-white" fill="currentColor" /></div>
            <span className={`font-bold text-xl tracking-tight ${textPrimary}`}>YieldAdmin</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-8 scrollbar-hide">
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-4">Platform</p>
          <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active={currentView === 'Dashboard'} onClick={() => setCurrentView('Dashboard')} theme={theme} />
          <NavItem icon={<Puzzle size={18}/>} label="plugins" active={currentView === 'plugins'} onClick={() => setCurrentView('plugins')} theme={theme} />
          <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-6">Administration</p>
          <NavItem icon={<Users size={18}/>} label="Users & Auth" active={currentView === 'Users'} onClick={() => setCurrentView('Users')} theme={theme} />
          <NavItem icon={<Settings size={18}/>} label="Configuration" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} theme={theme} />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-x-hidden min-h-screen">
        <header className={`flex h-16 border-b items-center justify-between px-6 lg:px-8 sticky top-0 z-40 backdrop-blur-md ${theme === 'dark' ? 'bg-[#020617]/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-500"><Menu size={20}/></button>
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className={`rounded-full py-2 pl-10 pr-4 text-xs w-64 focus:ring-2 focus:ring-indigo-500/20 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`} 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="text-slate-500 hover:text-indigo-500 transition-colors">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">AD</div>
          </div>
        </header>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 pb-24">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

// --- VIEWS ---

const DashboardView = ({ theme, selectedRows, setSelectedRows }) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const rows = [
    { id: 1, domain: "b2b-cloud-expert.com", niche: "SaaS Reviews", status: "Active", output: "124", health: 92 },
    { id: 2, domain: "logistics-hub.io", niche: "Supply Chain", status: "Active", output: "89", health: 85 },
    { id: 3, domain: "fintech-pulse.net", niche: "Banking Tech", status: "Paused", output: "210", health: 45 },
    { id: 4, domain: "hr-automation.tech", niche: "Recruitment", status: "Active", output: "56", health: 98 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Dashboard Overview</h2>
        <div className="flex gap-2">
          <Dropdown 
            theme={theme} 
            label="Export Data" 
            icon={<Download size={14}/>}
            options={["CSV Format", "PDF Report", "JSON API"]}
          />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={14}/> New Niche Site
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard theme={theme} label="Total Sites" value="12" icon={<Globe size={16}/>} trend="+2 this month" />
        <StatCard theme={theme} label="Articles/Month" value="1,402" icon={<FileText size={16}/>} trend="+12.5%" />
        <StatCard theme={theme} label="Ad Revenue" value="$4,285" icon={<TrendingUp size={16}/>} trend="+$420" />
        <StatCard theme={theme} label="API Status" value="Healthy" icon={<Activity size={16}/>} trend="99.9% Uptime" color="text-emerald-500" />
      </div>

      <div className={`${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-2xl overflow-hidden`}>
        <div className="p-5 border-b border-inherit flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Managed Clusters</h3>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"/>
            <div className="flex gap-2">
              <FilterChip label="Niche: All" theme={theme} />
              <FilterChip label="Status: Active" theme={theme} />
            </div>
          </div>
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-2">
               <Dropdown 
                theme={theme} 
                label={`Bulk Action (${selectedRows.length})`} 
                variant="danger"
                options={["Pause Selected", "Force Sync", "Delete Records"]}
              />
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className={`bg-slate-500/5 text-slate-500 font-bold uppercase tracking-wider border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <CustomCheckbox 
                    checked={selectedRows.length === rows.length} 
                    onChange={(val) => val ? setSelectedRows(rows.map(r => r.id)) : setSelectedRows([])}
                    theme={theme}
                  />
                </th>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Weekly Output</th>
                <th className="px-6 py-4">System Health</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {rows.map(row => (
                <tr key={row.id} className={`${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-6 py-4 text-center">
                    <CustomCheckbox 
                      checked={selectedRows.includes(row.id)} 
                      onChange={() => setSelectedRows(prev => prev.includes(row.id) ? prev.filter(i => i !== row.id) : [...prev, row.id])}
                      theme={theme}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{row.domain}</span>
                      <span className="text-[10px] text-slate-500">{row.niche}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-400">{row.output} docs</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                        <div className={`h-full ${row.health > 80 ? 'bg-emerald-500' : 'bg-amber-500'} transition-all`} style={{ width: `${row.health}%` }} />
                      </div>
                      <span className="text-[10px] font-bold">{row.health}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button className="p-1.5 hover:bg-slate-500/10 rounded-lg text-slate-500"><Edit3 size={14}/></button>
                    <button className="p-1.5 hover:bg-slate-500/10 rounded-lg text-slate-500"><ExternalLink size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const UsersView = ({ theme }) => {
  const users = [
    { name: "John Admin", role: "Super Admin", email: "john@yield.site", access: "Full", lastLogin: "2 mins ago" },
    { name: "Sarah Editor", role: "Content Manager", email: "sarah@yield.site", access: "CMS Only", lastLogin: "4 hours ago" },
    { name: "Automaton V2", role: "System User", email: "bot@yield.site", access: "API Only", lastLogin: "12 seconds ago" },
  ];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Users & Permissions</h2>
          <p className="text-xs text-slate-500 mt-1">Manage team access and automated service accounts.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
          <UserPlus size={14}/> Invite Member
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className={`${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-2xl overflow-hidden`}>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-500/5 text-slate-500 font-bold uppercase tracking-wider border-b border-inherit">
                <tr>
                  <th className="px-6 py-4">Team Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Access Level</th>
                  <th className="px-6 py-4 text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.map(u => (
                  <tr key={u.email} className={`${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-500">{u.name.charAt(0)}</div>
                      <div className="flex flex-col">
                        <span className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{u.name}</span>
                        <span className="text-[10px] text-slate-500">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{u.role}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.access === 'Full' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-500/10 text-slate-400'}`}>
                        {u.access}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">{u.lastLogin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Security Overview</h4>
            <div className="space-y-4">
              <SecurityCheck label="2FA Enforcement" status="Enabled" theme={theme} color="text-emerald-500" />
              <SecurityCheck label="Password Policy" status="Strong" theme={theme} color="text-indigo-500" />
              <SecurityCheck label="Active Sessions" status="4 Active" theme={theme} color="text-slate-500" />
            </div>
            <button className="w-full mt-6 py-2 rounded-xl bg-slate-500/10 text-slate-500 text-[10px] font-bold border border-slate-500/20 hover:bg-slate-500/20 transition-all">Audit Security Logs</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfigurationView = ({ theme }) => {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>System Configuration</h2>
        <p className="text-xs text-slate-500 mt-1">Global parameters for automation engines and API bridges.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ConfigSection theme={theme} title="General Engine Settings" icon={<Database size={16}/>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputGroup label="System Base URL" placeholder="https://admin.yield.site" theme={theme} />
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Environment Mode</label>
                <Dropdown theme={theme} options={["Production", "Staging", "Local Development"]} label="Production" className="w-full" />
              </div>
              <InputGroup label="API Token (Write)" type="password" placeholder="••••••••••••••••" theme={theme} />
              <InputGroup label="Max Cluster Concurrent" placeholder="10" theme={theme} />
            </div>
          </ConfigSection>

          <ConfigSection theme={theme} title="Content & AI Integration" icon={<Cpu size={16}/>}>
             <div className="space-y-6">
                <ToggleGroup label="Global Auto-Publish" desc="Niche sites go live immediately after generation" defaultChecked theme={theme} />
                <ToggleGroup label="Image Synthesis" desc="Use DALL-E 3 for every featured post automatically" theme={theme} />
                <ToggleGroup label="Deep-Linking Engine" desc="Automatically bridge articles across different domains" theme={theme} />
             </div>
          </ConfigSection>
        </div>

        <div className="space-y-6">
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
            <h4 className="text-sm font-bold text-indigo-500 mb-2 flex items-center gap-2"><Shield size={16}/> Configuration Safety</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">Changes to global settings take effect immediately across all n8n workers. Ensure backup clusters are idle before saving.</p>
            <button className="w-full mt-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Save All Changes</button>
          </div>

          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Storage Quotas</h4>
             <div className="space-y-4">
                <ProgressBar label="PostgreSQL" value={42} theme={theme} color="bg-indigo-500" />
                <ProgressBar label="S3 Assets" value={88} theme={theme} color="bg-rose-500" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PluginsView = ({ theme, onConfig }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <PluginCard 
        title="SEO Meta Wizard" desc="Automates schema markup and JSON-LD generation for all posts." 
        icon={<Activity className="text-indigo-500"/>} status="Active" theme={theme} onConfig={onConfig} />
      <PluginCard 
        title="Social Bridge" desc="Pushes published content to Twitter, LinkedIn, and Mastodon." 
        icon={<TrendingUp className="text-emerald-500"/>} status="Active" theme={theme} onConfig={onConfig} />
      <PluginCard 
        title="Keyword Pulse" desc="Real-time SERP tracking for targeted B2B keywords." 
        icon={<Search className="text-amber-500"/>} status="Inactive" theme={theme} onConfig={onConfig} />
    </div>
  );
};

// --- CORE UI COMPONENTS ---

const Dropdown = ({ theme, label, options, variant="default", icon, className="" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const variantClass = variant === 'danger' 
    ? 'bg-rose-500 text-white hover:bg-rose-600' 
    : theme === 'dark' ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-w-[120px] justify-between ${variantClass}`}
      >
        <span className="flex items-center gap-2">{icon} {label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl border z-50 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-700 shadow-black/50' : 'bg-white border-slate-200'}`}>
          {options.map((opt, i) => (
            <button 
              key={i} 
              className={`w-full text-left px-4 py-2.5 text-xs font-medium ${theme === 'dark' ? 'hover:bg-slate-700/50 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}
              onClick={() => setIsOpen(false)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CustomCheckbox = ({ checked, onChange, theme }) => (
  <div 
    onClick={() => onChange(!checked)}
    className={`w-5 h-5 rounded-md border-2 cursor-pointer transition-all flex items-center justify-center ${
      checked 
        ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20' 
        : theme === 'dark' ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
    }`}
  >
    {checked && <CheckCircle2 size={14} className="text-white" />}
  </div>
);

const NavItem = ({ icon, label, active, onClick, theme }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
    active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : `text-slate-500 ${theme === 'dark' ? 'hover:bg-slate-800/60 hover:text-slate-200' : 'hover:bg-slate-100 hover:text-slate-900'}`
  }`}>
    <div className="flex items-center gap-3">
      <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-indigo-500 transition-colors'}>{icon}</span>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  </button>
);

const StatCard = ({ label, value, icon, trend, theme, color="text-slate-400" }) => (
  <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-50'}`}>{icon}</div>
      <span className={`text-[10px] font-bold ${color}`}>{trend}</span>
    </div>
    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</h5>
    <p className={`text-xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</p>
  </div>
);

const FilterChip = ({ label, theme }) => (
  <div className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
    {label}
    <X size={10} className="cursor-pointer hover:text-indigo-500"/>
  </div>
);

const SecurityCheck = ({ label, status, theme, color }) => (
  <div className="flex items-center justify-between text-[11px]">
    <span className="text-slate-500">{label}</span>
    <span className={`font-bold ${color}`}>{status}</span>
  </div>
);

const ConfigSection = ({ title, icon, children, theme }) => (
  <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
    <div className="flex items-center gap-2 mb-6 border-b border-inherit pb-4">
      <div className="text-indigo-500">{icon}</div>
      <h3 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
    </div>
    {children}
  </div>
);

const InputGroup = ({ label, placeholder, theme, type="text" }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
    <input 
      type={type} 
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
      }`}
    />
  </div>
);

const ToggleGroup = ({ label, desc, defaultChecked = false, theme }) => {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between group cursor-pointer" onClick={() => setChecked(!checked)}>
      <div className="flex flex-col">
        <span className={`text-[13px] font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>{label}</span>
        <span className="text-[11px] text-slate-500">{desc}</span>
      </div>
      <div className={`w-11 h-6 rounded-full relative transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  );
};

const ProgressBar = ({ label, value, color, theme }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className={`h-1.5 w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} rounded-full overflow-hidden`}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const PluginCard = ({ title, desc, icon, status, theme, onConfig }) => (
  <div className={`p-6 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-sm'} hover:border-indigo-500/50 group`}>
    <div className="flex items-start justify-between mb-6">
      <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50'}`}>{icon}</div>
      <div className={`w-2 h-2 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
    </div>
    <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h4>
    <p className="text-[11px] text-slate-500 leading-relaxed mb-6">{desc}</p>
    <button onClick={() => onConfig(title)} className="w-full py-2 bg-indigo-600/10 text-indigo-500 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2">
      Configure <Sliders size={12}/>
    </button>
  </div>
);

export default App;