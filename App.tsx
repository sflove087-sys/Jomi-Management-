
import React, { useState, useEffect, useMemo } from 'react';
import { LandRecord, CollectionEntry, AppConfig } from './types';
import StatCard from './components/StatCard';
import RecordForm from './components/RecordForm';
import CollectionForm from './components/CollectionForm';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
      const saved = localStorage.getItem('jomi_config_v2');
      return saved ? JSON.parse(saved) : {
        businessName: 'জমি বন্ধক ম্যানেজার',
        profitPercentage: 9,
        warningDays: 15,
        currency: '৳',
        theme: 'light',
        googleSheetUrl: 'https://script.google.com/macros/s/AKfycbxK4JSotFBwBWxoHJECh6Y6OROSrTqyp-QqFwiNVmwbenV0ouLgQKZcV-D7x6NLVcvs/exec',
        autoSync: true,
        restrictCollectionToExpired: false
      };
    } catch (e) {
      return { businessName: 'জমি বন্ধক ম্যানেজার', profitPercentage: 9, theme: 'light', autoSync: true, restrictCollectionToExpired: false };
    }
  });

  const [records, setRecords] = useState<LandRecord[]>(() => {
    try {
      const saved = localStorage.getItem('jomi_records_v4');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [lastSync, setLastSync] = useState<string>(localStorage.getItem('jomi_last_sync') || 'কখনো নয়');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LandRecord | null>(null);
  const [collectingFor, setCollectingFor] = useState<LandRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LandRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('ডাটা লোড হচ্ছে...');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  
  const isDark = config.theme === 'dark';

  useEffect(() => {
    localStorage.setItem('jomi_records_v4', JSON.stringify(records));
    localStorage.setItem('jomi_config_v2', JSON.stringify(config));
    document.title = config.businessName;
  }, [records, config]);

  const loadFromCloud = async (isSilent = false) => {
    if (!config.googleSheetUrl) return;
    if (!isSilent) setIsLoading(true);
    try {
      const response = await fetch(`${config.googleSheetUrl}?t=${Date.now()}`);
      const result = await response.json();
      if (result.status === 'success') {
        setRecords(result.records || []);
        const time = new Date().toLocaleString('bn-BD');
        setLastSync(time);
        localStorage.setItem('jomi_last_sync', time);
      }
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const syncToCloud = async (action: string, data: any) => {
    if (!config.googleSheetUrl) return;
    try {
      await fetch(config.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action, ...data })
      });
    } catch (e) {}
  };

  const handleSaveRecord = async (recordData: any) => {
    setIsLoading(true);
    let updatedRecords: LandRecord[];
    if (recordData.id) {
      updatedRecords = records.map(r => r.id === recordData.id ? { ...r, ...recordData } : r);
      await syncToCloud('edit', { record: recordData });
    } else {
      const newRecord = { ...recordData, id: generateId(), collections: [] };
      updatedRecords = [...records, newRecord];
      await syncToCloud('add', { record: newRecord });
    }
    setRecords(updatedRecords);
    setIsFormOpen(false);
    setEditingRecord(null);
    setIsLoading(false);
  };

  const handleSaveCollection = async (entries: any[]) => {
    if (!collectingFor) return;
    setIsLoading(true);
    const newEntries = entries.map(e => ({ id: generateId(), ...e }));
    const updatedRec = { ...collectingFor, collections: [...(collectingFor.collections || []), ...newEntries] };
    const updatedRecords = records.map(r => r.id === collectingFor.id ? updatedRec : r);
    setRecords(updatedRecords);
    await syncToCloud('edit', { record: updatedRec });
    setCollectingFor(null);
    setIsLoading(false);
  };

  const getExpiryInfo = (record: LandRecord) => {
    if (!record.startDate || !record.duration) return { expired: false };
    const expiry = new Date(record.startDate);
    const parts = record.duration.split(' ');
    const val = parseInt(parts[0]) || 0;
    const unit = parts[1];
    if (unit === 'বছর') expiry.setFullYear(expiry.getFullYear() + val);
    else if (unit === 'মাস') expiry.setMonth(expiry.getMonth() + val);
    else expiry.setDate(expiry.getDate() + val);
    return { expired: new Date() > expiry, date: expiry };
  };

  const stats = useMemo(() => ({
    investment: records.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    collected: records.reduce((acc, r) => acc + (r.collections?.reduce((s, c) => s + Number(c.amount || 0), 0) || 0), 0),
    active: records.filter(r => !getExpiryInfo(r).expired).length,
    total: records.length
  }), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const search = searchTerm.toLowerCase();
      const { expired } = getExpiryInfo(r);
      const matchesSearch = r.title.toLowerCase().includes(search) || r.ownerName.toLowerCase().includes(search) || r.mobile.includes(search);
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && !expired) || (statusFilter === 'EXPIRED' && expired);
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, statusFilter]);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[3000] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 font-bold">{loadingMessage}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row min-h-screen no-print">
        {/* Sidebar */}
        <aside className={`w-full lg:w-64 p-6 ${isDark ? 'bg-slate-900' : 'bg-indigo-900'} text-white flex flex-col`}>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-indigo-900 text-xl">🏠</div>
            <h1 className="font-bold text-lg leading-tight">{config.businessName}</h1>
          </div>
          <nav className="flex-1 space-y-2">
            <button className="w-full text-left px-4 py-3 rounded-xl bg-white/10 font-bold">ড্যাশবোর্ড</button>
            <button onClick={() => loadFromCloud()} className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5">ডাটা রিফ্রেশ</button>
            <button onClick={() => setConfig({...config, theme: isDark ? 'light' : 'dark'})} className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5">
              {isDark ? 'লাইট মোড' : 'ডার্ক মোড'}
            </button>
          </nav>
          <div className="mt-auto pt-6 border-t border-white/10 text-xs opacity-60">
            শেষ আপডেট: {lastSync}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-10 space-y-8 overflow-y-auto">
          <header className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">ওভারভিউ</h2>
            <button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all">+ নতুন চুক্তি</button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="মোট বিনিয়োগ" value={`${stats.investment.toLocaleString()} ৳`} icon="💰" color="bg-indigo-500" theme={config.theme} />
            <StatCard label="মোট আদায়" value={`${stats.collected.toLocaleString()} ৳`} icon="📈" color="bg-emerald-500" theme={config.theme} />
            <StatCard label="সচল চুক্তি" value={stats.active} icon="✅" color="bg-amber-500" theme={config.theme} />
            <StatCard label="মোট রেকর্ড" value={stats.total} icon="📄" color="bg-rose-500" theme={config.theme} />
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <input type="text" placeholder="মালিক বা টাইটেল দিয়ে খুঁজুন..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 px-4 py-3 rounded-xl border dark:bg-slate-950 dark:border-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
              {['ALL', 'ACTIVE', 'EXPIRED'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500'}`}>
                  {s === 'ALL' ? 'সব' : s === 'ACTIVE' ? 'সচল' : 'মেয়াদ শেষ'}
                </button>
              ))}
            </div>
          </div>

          {/* Records Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRecords.map(r => {
              const { expired } = getExpiryInfo(r);
              const totalCol = (r.collections || []).reduce((s, c) => s + c.amount, 0);
              return (
                <div key={r.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-6 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-lg uppercase leading-tight">{r.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {expired ? 'মেয়াদ উত্তীর্ণ' : 'সচল'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setViewingRecord(r)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-colors">👁️</button>
                      <button onClick={() => { setEditingRecord(r); setIsFormOpen(true); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-amber-100 hover:text-amber-600 transition-colors">✏️</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">মালিক:</span>
                      <span className="font-bold">{r.ownerName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">বিনিয়োগ:</span>
                      <span className="font-bold text-indigo-600">{r.amount.toLocaleString()} ৳</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">আদায়:</span>
                      <span className="font-bold text-emerald-600">{totalCol.toLocaleString()} ৳</span>
                    </div>
                  </div>
                  <button onClick={() => setCollectingFor(r)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all">কিস্তি আদায়</button>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Viewing Record - Full Profile & Print Ready */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2000] flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden print:rounded-none print:shadow-none print:max-w-none">
            
            <div className="p-8 bg-indigo-900 text-white flex justify-between items-center no-print">
              <h3 className="text-xl font-bold uppercase tracking-tight">চুক্তিপত্রের বিস্তারিত</h3>
              <div className="flex gap-4">
                <button onClick={() => window.print()} className="bg-white text-indigo-900 px-6 py-2 rounded-xl font-bold hover:bg-slate-100">প্রিন্ট করুন</button>
                <button onClick={() => setViewingRecord(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20">✕</button>
              </div>
            </div>

            <div className="p-10 lg:p-16 space-y-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white print:text-black">
              {/* Layout matching requested screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                
                {/* Left: Owner & Contractor info */}
                <div className="space-y-10">
                  <div className="space-y-6">
                    <h5 className="text-amber-600 font-bold uppercase tracking-widest border-b-2 border-amber-100 pb-2">জমির মালিকের তথ্য</h5>
                    <div className="space-y-4">
                      <div className="flex justify-between font-bold"><span>নাম:</span> <span>{viewingRecord.ownerName}</span></div>
                      <div className="flex justify-between font-bold"><span>মোবাইল:</span> <span className="text-amber-600">{viewingRecord.mobile}</span></div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                        <span className="text-xs text-slate-400 uppercase block mb-1">জমির ঠিকানা</span>
                        <p className="italic">{viewingRecord.location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h5 className="text-indigo-600 font-bold uppercase tracking-widest border-b-2 border-indigo-100 pb-2">চুক্তিধরের তথ্য (গ্রহীতা)</h5>
                    <div className="space-y-4">
                      <div className="flex justify-between font-bold"><span>নাম:</span> <span>{viewingRecord.contractorName}</span></div>
                      <div className="flex justify-between font-bold"><span>মোবাইল:</span> <span className="text-indigo-600">{viewingRecord.contractorMobile}</span></div>
                      <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl">
                        <span className="text-xs text-indigo-400 uppercase block mb-1">চুক্তিধরের ঠিকানা</span>
                        <p className="italic">{viewingRecord.contractorAddress || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Agreement Stats */}
                <div className="space-y-10">
                  <div className="space-y-6">
                    <h5 className="text-emerald-600 font-bold uppercase tracking-widest border-b-2 border-emerald-100 pb-2">চুক্তিনামা ও বিনিয়োগ</h5>
                    <div className="space-y-4">
                      <div className="flex justify-between font-bold"><span>জমির পরিমাণ:</span> <span>{viewingRecord.area} শতক</span></div>
                      <div className="flex justify-between font-bold"><span>বিনিয়োগ (Security):</span> <span className="text-indigo-600">{viewingRecord.amount.toLocaleString()} ৳</span></div>
                      <div className="flex justify-between font-bold"><span>নির্ধারিত কিস্তি:</span> <span className="text-emerald-600">{viewingRecord.collectionAmount.toLocaleString()} ৳</span></div>
                      <div className="flex justify-between font-bold"><span>নিবন্ধনের তারিখ:</span> <span>{new Date(viewingRecord.startDate).toLocaleDateString('bn-BD')}</span></div>
                      <div className="flex justify-between font-bold"><span>মোট মেয়াদ:</span> <span className="text-emerald-600">{viewingRecord.duration}</span></div>
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">চুক্তির বর্তমান অবস্থা:</span>
                        <span className={`font-black uppercase ${getExpiryInfo(viewingRecord).expired ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {getExpiryInfo(viewingRecord).expired ? 'সচল (EXPIRED)' : 'সচল (ACTIVE)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-8 bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center space-y-2">
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">মোট বিনিয়োগ</p>
                       <p className="text-xl font-bold text-indigo-900 dark:text-white">{viewingRecord.amount.toLocaleString()} ৳</p>
                    </div>
                    <div className="p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/10 text-center space-y-2">
                       <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">মোট আদায়</p>
                       <p className="text-xl font-bold text-emerald-600">{(viewingRecord.collections || []).reduce((s,c) => s+c.amount, 0).toLocaleString()} ৳</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="pt-10 border-t-2 border-slate-50 dark:border-slate-800 space-y-6">
                <h5 className="font-bold text-slate-400 uppercase tracking-[0.3em]">লেনদেনের ইতিহাস (Payment History)</h5>
                <div className="space-y-4">
                  {(viewingRecord.collections || []).length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-bold">কোনো লেনদেন পাওয়া যায়নি।</div>
                  ) : (
                    viewingRecord.collections.slice().reverse().map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm print:shadow-none print:border-slate-200">
                        <div>
                          <p className="font-bold">{new Date(c.date).toLocaleDateString('bn-BD', {day:'numeric', month:'long', year:'numeric'})}</p>
                          <p className="text-xs text-slate-400 italic">{c.note || 'কিস্তি আদায়'}</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-600">+{c.amount.toLocaleString()} ৳</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Signature Section for Print */}
              <div className="hidden print:grid grid-cols-2 gap-20 mt-32 border-t-2 border-slate-100 pt-16">
                 <div className="text-center space-y-4">
                    <div className="h-px bg-slate-300 w-full mb-2"></div>
                    <p className="font-bold uppercase tracking-widest text-slate-600">জমির মালিকের স্বাক্ষর</p>
                 </div>
                 <div className="text-center space-y-4">
                    <div className="h-px bg-slate-300 w-full mb-2"></div>
                    <p className="font-bold uppercase tracking-widest text-slate-600">চুক্তিধরের স্বাক্ষর</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && <RecordForm onSave={handleSaveRecord} onCancel={() => { setIsFormOpen(false); setEditingRecord(null); }} initialData={editingRecord} profitPercentage={config.profitPercentage} theme={config.theme} />}
      {collectingFor && <CollectionForm record={collectingFor} onSave={handleSaveCollection} onCancel={() => setCollectingFor(null)} theme={config.theme} />}

    </div>
  );
};

export default App;
