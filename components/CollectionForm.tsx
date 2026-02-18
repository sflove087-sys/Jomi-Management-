
import React, { useState, useMemo } from 'react';
import { LandRecord, CollectionEntry } from '../types';

interface CollectionFormProps {
  record: LandRecord;
  onSave: (entries: Omit<CollectionEntry, 'id'>[], newDuration?: string) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
}

const CollectionForm: React.FC<CollectionFormProps> = ({ record, onSave, onCancel, theme = 'light' }) => {
  const isDark = theme === 'dark';
  
  const [mode, setMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  const [amount, setAmount] = useState(record.collectionAmount.toString());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  
  const [isExtending, setIsExtending] = useState(false);
  const [extValue, setExtValue] = useState('1');
  const [extUnit, setExtUnit] = useState('বছর');

  const [frequency, setFrequency] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');

  const receiptNo = useMemo(() => Math.floor(100000 + Math.random() * 900000), []);

  const totalCollectedBefore = useMemo(() => 
    (record.collections || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  , [record.collections]);

  const bulkPreview = useMemo(() => {
    if (mode !== 'BULK') return [];
    
    const start = new Date(record.startDate);
    const now = new Date();
    const entries: Omit<CollectionEntry, 'id'>[] = [];
    
    let current = new Date(start);
    const increment = () => {
      if (frequency === 'MONTHLY') current.setMonth(current.getMonth() + 1);
      else if (frequency === 'QUARTERLY') current.setMonth(current.getMonth() + 3);
      else if (frequency === 'YEARLY') current.setFullYear(current.getFullYear() + 1);
    };

    increment();

    while (current <= now) {
      const dateStr = current.toISOString().split('T')[0];
      const exists = (record.collections || []).some(c => c.date.startsWith(dateStr.substring(0, 7)));
      
      if (!exists) {
        entries.push({
          amount: record.collectionAmount,
          date: dateStr,
          note: `স্বয়ংক্রিয় রিকারিং কিস্তি (${frequency === 'MONTHLY' ? 'মাসিক' : frequency === 'QUARTERLY' ? 'ত্রৈমাসিক' : 'বার্ষিক'})`
        });
      }
      increment();
    }
    return entries;
  }, [mode, frequency, record.startDate, record.collectionAmount, record.collections]);

  const currentPayTotal = useMemo(() => {
    if (mode === 'SINGLE') return parseFloat(amount) || 0;
    return bulkPreview.reduce((sum, item) => sum + item.amount, 0);
  }, [mode, amount, bulkPreview]);

  const newExpiryDate = useMemo(() => {
    if (!record.startDate || !record.duration) return null;
    const expiry = new Date(record.startDate);
    
    const currentParts = record.duration.split(' ');
    const origVal = parseInt(currentParts[0]) || 0;
    const origUnit = currentParts[1] || 'বছর';
    
    if (origUnit === 'বছর') expiry.setFullYear(expiry.getFullYear() + origVal);
    else if (origUnit === 'মাস') expiry.setMonth(expiry.getMonth() + origVal);
    else expiry.setDate(expiry.getDate() + origVal);
    
    if (isExtending) {
      const addVal = parseInt(extValue) || 0;
      const addUnit = extUnit;
      if (addUnit === 'বছর') expiry.setFullYear(expiry.getFullYear() + addVal);
      else if (addUnit === 'মাস') expiry.setMonth(expiry.getMonth() + addVal);
      else expiry.setDate(expiry.getDate() + addVal);
    }

    return expiry.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [record.startDate, record.duration, isExtending, extValue, extUnit]);

  const handlePreSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === 'SINGLE') {
      if (!amount || parseFloat(amount) <= 0) {
        alert("সঠিক আদায়ের পরিমাণ প্রদান করুন");
        return;
      }
    } else {
      if (bulkPreview.length === 0) {
        alert("জেনারেট করার মতো কোনো বকেয়া কিস্তি নেই");
        return;
      }
    }
    setIsPreviewing(true);
  };

  const handleFinalSubmit = () => {
    let updatedDuration = record.duration;
    if (isExtending) {
      const currentParts = record.duration.split(' ');
      const currentVal = parseInt(currentParts[0]) || 0;
      const newVal = currentVal + (parseInt(extValue) || 0);
      updatedDuration = `${newVal} ${extUnit}`;
    }

    if (mode === 'SINGLE') {
      onSave([{
        amount: parseFloat(amount),
        date,
        note: note || (isExtending ? `কিস্তি আদায় + মেয়াদ বৃদ্ধি (${extValue} ${extUnit})` : 'নিয়মিত কিস্তি')
      }], isExtending ? updatedDuration : undefined);
    } else {
      onSave(bulkPreview, isExtending ? updatedDuration : undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 z-[999] animate-in fade-in zoom-in duration-200">
      <div className={`${isDark ? 'bg-slate-900 border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'bg-white'} rounded-[2.5rem] w-full max-w-xl shadow-2xl relative overflow-hidden border border-inherit flex flex-col max-h-[90vh]`}>
        
        <div className={`px-8 py-6 ${isDark ? 'bg-slate-800/50' : 'bg-[#002b5c]'} text-white flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 ${isPreviewing ? 'bg-indigo-500 shadow-indigo-500/30' : 'bg-emerald-600 shadow-emerald-600/30'} rounded-2xl flex items-center justify-center shadow-lg transition-colors`}>
              {isPreviewing ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
              )}
            </div>
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-widest">{isPreviewing ? 'মানি রিসিট' : 'কিস্তি আদায় ব্যবস্থাপনা'}</h3>
              <p className="text-[9px] uppercase font-black tracking-widest text-amber-400 mt-0.5">{isPreviewing ? `Receipt No: #${receiptNo}` : 'Payment Manager'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all text-[12px]">✕</button>
        </div>

        {!isPreviewing && (
          <div className={`flex border-b shrink-0 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
             <button onClick={() => setMode('SINGLE')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'SINGLE' ? (isDark ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400' : 'bg-white text-[#002b5c] border-b-2 border-[#002b5c]') : 'text-slate-400'}`}>একক আদায়</button>
             <button onClick={() => setMode('BULK')} className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'BULK' ? (isDark ? 'bg-slate-800 text-amber-400 border-b-2 border-amber-400' : 'bg-white text-[#002b5c] border-b-2 border-[#002b5c]') : 'text-slate-400'}`}>অটো আদায়</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
          {!isPreviewing ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className={`p-5 rounded-2xl ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'} border flex justify-between items-center`}>
                <div>
                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">গ্রাহক ও বিনিয়োগ</p>
                   <p className="text-[9px] font-black text-[#002b5c] dark:text-white leading-tight uppercase">{record.ownerName}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">নির্ধারিত কিস্তি</p>
                   <p className="text-[9px] font-black text-emerald-600 uppercase">{record.collectionAmount.toLocaleString()} ৳</p>
                </div>
              </div>

              <div className="space-y-6">
                {mode === 'SINGLE' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500 px-1">টাকার পরিমাণ</label>
                      <div className="relative">
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={`w-full pl-8 pr-4 py-3 rounded-xl border outline-none font-black text-[9px] transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-200 focus:border-[#002b5c]'}`} />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-[9px]">৳</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500 px-1">তারিখ</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full px-4 py-3 rounded-xl border outline-none font-black text-[9px] transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-white border-slate-200'}`} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500 px-1">কিস্তির ধরন</label>
                      <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className={`w-full px-4 py-3 rounded-xl border outline-none font-black text-[9px] cursor-pointer ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`}>
                        <option value="MONTHLY">মাসিক (Monthly)</option>
                        <option value="QUARTERLY">ত্রৈমাসিক (Quarterly)</option>
                        <option value="YEARLY">বার্ষিক (Yearly)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                   <label className="text-[9px] font-black uppercase text-slate-500 px-1">অতিরিক্ত নোট (ঐচ্ছিক)</label>
                   <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="উদা: নগদ প্রাপ্তি" className={`w-full px-4 py-3 rounded-xl border outline-none font-bold text-[9px] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`} />
                </div>

                <div className={`p-5 rounded-2xl border transition-all ${isExtending ? (isDark ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50 border-amber-200') : (isDark ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50 border-slate-100')}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isExtending ? 'bg-amber-400 text-[#002b5c]' : 'bg-slate-200 text-slate-400'}`}>
                         <span className="text-[9px]">⏳</span>
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-wider">মেয়াদ বাড়ানো হবে?</p>
                    </div>
                    <button type="button" onClick={() => setIsExtending(!isExtending)} className={`w-8 h-4 rounded-full relative transition-all ${isExtending ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isExtending ? 'left-4.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                  {isExtending && (
                    <div className="flex gap-2 mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      <input type="number" min="1" value={extValue} onChange={e => setExtValue(e.target.value)} className={`flex-1 px-4 py-2.5 rounded-lg border outline-none font-black text-[9px] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`} />
                      <select value={extUnit} onChange={e => setExtUnit(e.target.value)} className={`flex-1 px-3 py-2.5 rounded-lg border outline-none font-black text-[9px] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`}>
                        <option value="বছর">বছর</option><option value="মাস">মাস</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
               <div className={`relative w-full max-w-[340px] shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border-x-2 border-t-2`}>
                  <div className="p-10 space-y-8">
                     <div className="text-center space-y-3">
                        <div className="inline-block p-3 rounded-full bg-emerald-500/10 text-emerald-500 mb-1">
                           <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">মানি রিসিট</h4>
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-[#002b5c] dark:text-white uppercase">{record.title}</p>
                           <p className="text-[9px] font-bold text-slate-500 uppercase">{record.ownerName}</p>
                        </div>
                     </div>

                     <div className="space-y-4 border-t border-b border-dashed border-slate-200 dark:border-slate-800 py-6">
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                           <span>তারিখ:</span>
                           <span className="text-slate-900 dark:text-slate-200">{new Date(date).toLocaleDateString('bn-BD')}</span>
                        </div>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                           <span>পূর্বের মোট জমা:</span>
                           <span className="text-slate-600 dark:text-slate-400 uppercase">{totalCollectedBefore.toLocaleString()} ৳</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-black text-emerald-600 uppercase">চলতি আদায়:</span>
                           <span className="text-[9px] font-black text-emerald-600">+{currentPayTotal.toLocaleString()} ৳</span>
                        </div>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                        <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                           <span className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-tight">সর্বমোট কালেকশন:</span>
                           <span className="text-[9px] font-black text-indigo-600">{(totalCollectedBefore + currentPayTotal).toLocaleString()} ৳</span>
                        </div>
                     </div>

                     <div className={`p-5 rounded-2xl border-2 border-dashed ${isExtending ? 'bg-amber-50 border-amber-400/30' : 'bg-slate-50 border-slate-200/50'} dark:bg-slate-800/50`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">পরবর্তী মেয়াদ শেষ তারিখ</p>
                        <div className="flex items-center gap-2">
                           <span className="text-[12px]">📅</span>
                           <p className={`text-[9px] font-black uppercase ${isExtending ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                              {newExpiryDate}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="mt-8 flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-500 text-white shadow-xl">
                  <span className="animate-pulse text-[9px]">✨</span>
                  <p className="text-[9px] font-black uppercase tracking-widest">সব ঠিক থাকলে সেভ করুন</p>
               </div>
            </div>
          )}
        </div>

        <div className={`px-8 py-6 flex gap-4 shrink-0 ${isDark ? 'bg-slate-950/80 border-t border-slate-800' : 'bg-slate-50 border-t border-slate-100'}`}>
          {!isPreviewing ? (
            <>
              <button onClick={onCancel} className={`flex-1 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>বাতিল</button>
              <button onClick={() => handlePreSubmit()} className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">সেভ ও প্রিভিউ</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsPreviewing(false)} className={`flex-1 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>সংশোধন</button>
              <button onClick={handleFinalSubmit} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">নিশ্চিত ও জমা দিন</button>
            </>
          )}
        </div>
      </div>
      <style>{`* { font-size: 9px !important; }`}</style>
    </div>
  );
};

export default CollectionForm;
