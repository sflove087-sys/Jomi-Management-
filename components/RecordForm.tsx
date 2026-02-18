
import React, { useState, useEffect, useCallback } from 'react';
import { LandRecord } from '../types';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  prefix?: string;
  isDark?: boolean;
  as?: 'input' | 'textarea';
}

const FormInput: React.FC<InputFieldProps> = ({ 
  label, value, onChange, type = "text", placeholder = "", 
  required = false, icon = null, prefix = null, isDark = false, as = 'input'
}) => (
  <div className="flex flex-col space-y-1.5">
    <div className="flex justify-between items-center px-0.5">
      <label className={`text-[9px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      {required && (
        <span className="text-[9px] font-black text-rose-500">আবশ্যক</span>
      )}
    </div>
    <div className="relative group">
      {icon && (
        <div className={`absolute left-4 top-4 ${isDark ? 'text-slate-600' : 'text-slate-400'} transition-colors`}>
          {icon}
        </div>
      )}
      
      {as === 'textarea' ? (
        <textarea
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={2}
          className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl outline-none transition-all font-bold text-[9px] placeholder:font-normal placeholder:opacity-30 resize-none`}
        />
      ) : (
        <input 
          required={required}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl outline-none transition-all font-bold text-[9px] placeholder:font-normal placeholder:opacity-30`}
        />
      )}
      
      {prefix && (
        <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {prefix}
        </div>
      )}
    </div>
  </div>
);

interface RecordFormProps {
  onSave: (record: Omit<LandRecord, 'id' | 'collections'> | LandRecord) => void;
  onCancel: () => void;
  initialData?: LandRecord | null;
  profitPercentage: number;
  theme?: 'light' | 'dark';
}

const RecordForm: React.FC<RecordFormProps> = ({ onSave, onCancel, initialData, profitPercentage, theme = 'light' }) => {
  const isDark = theme === 'dark';
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    area: '',
    location: '',
    amount: '',
    ownerName: '',
    mobile: '',
    durationValue: '1',
    durationUnit: 'বছর',
    contractorName: '',
    contractorMobile: '',
    contractorAddress: '',
    collectionAmount: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (initialData) {
      const durationStr = initialData.duration || "1 বছর";
      const dParts = durationStr.split(' ');
      
      setFormData({
        title: initialData.title || '',
        area: (initialData.area || 0).toString(),
        location: initialData.location || '',
        amount: (initialData.amount || 0).toString(),
        ownerName: initialData.ownerName || '',
        mobile: initialData.mobile || '',
        durationValue: dParts[0] || '1',
        durationUnit: dParts[1] || 'বছর',
        contractorName: initialData.contractorName || '',
        contractorMobile: initialData.contractorMobile || '',
        contractorAddress: initialData.contractorAddress || '',
        collectionAmount: (initialData.collectionAmount || 0).toString(),
        startDate: initialData.startDate || new Date().toISOString().split('T')[0],
      });
    }
  }, [initialData]);

  const handleLandAmountChange = useCallback((val: string) => {
    const landPrice = parseFloat(val) || 0;
    const calc = Math.round(landPrice * (profitPercentage / 100)).toString();
    setFormData(prev => ({ ...prev, amount: val, collectionAmount: calc }));
  }, [profitPercentage]);

  const handlePreSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title || !formData.ownerName || !formData.amount || !formData.contractorName) {
      alert("অনুগ্রহ করে সব আবশ্যক তথ্য (টাইটেল, মালিক, বিনিয়োগ, চুক্তিধর) পূরণ করুন");
      return;
    }
    setIsPreviewing(true);
  };

  const handleFinalSave = () => {
    const payload = {
      ...formData,
      area: parseFloat(formData.area) || 0,
      amount: parseFloat(formData.amount) || 0,
      collectionAmount: parseFloat(formData.collectionAmount) || 0,
      duration: `${formData.durationValue} ${formData.durationUnit}`,
    };
    onSave(initialData ? { ...initialData, ...payload } : payload as any);
  };

  return (
    <div className="fixed inset-0 bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
      <div className={`${isDark ? 'bg-slate-900 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'bg-white'} rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[95vh] overflow-hidden`}>
        
        <div className={`px-10 py-6 flex justify-between items-center border-b shrink-0 ${isDark ? 'border-slate-800 bg-slate-800/20' : 'border-slate-100 bg-[#002b5c] text-white'}`}>
          <div className="flex items-center gap-5">
            <div className={`w-8 h-8 rounded-2xl ${isPreviewing ? 'bg-emerald-500' : 'bg-amber-400'} flex items-center justify-center text-white shadow-lg transition-colors`}>
              {isPreviewing ? '✓' : '📄'}
            </div>
            <div>
              <h2 className="text-[9px] font-black tracking-tight leading-none uppercase">
                {isPreviewing ? 'তথ্য যাচাই (Preview)' : (initialData ? 'চুক্তি সংশোধন' : 'নতুন চুক্তি নিবন্ধন')}
              </h2>
            </div>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-[12px]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar">
          {!isPreviewing ? (
            <form id="main-record-form" onSubmit={handlePreSave} className="space-y-12 animate-in fade-in duration-200">
              {/* Land Owner Section */}
              <div className="space-y-6">
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-amber-400' : 'text-[#002b5c]'} border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} pb-2`}>জমির মালিকের তথ্য</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormInput isDark={isDark} label="জমির মালিকের নাম" value={formData.ownerName} onChange={v => setFormData({...formData, ownerName: v})} required placeholder="মালিকের নাম" />
                  <FormInput isDark={isDark} label="মালিকের মোবাইল" value={formData.mobile} onChange={v => setFormData({...formData, mobile: v})} type="tel" placeholder="মোবাইল" />
                </div>
                <FormInput isDark={isDark} label="জমির ঠিকানা / অবস্থান" value={formData.location} onChange={v => setFormData({...formData, location: v})} as="textarea" placeholder="জমির পূর্ণ ঠিকানা..." />
              </div>

              {/* Contractor Section */}
              <div className="space-y-6">
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-indigo-400' : 'text-indigo-600'} border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} pb-2`}>চুক্তিধরের তথ্য (গ্রহীতা)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormInput isDark={isDark} label="চুক্তিধরের নাম" value={formData.contractorName} onChange={v => setFormData({...formData, contractorName: v})} required placeholder="চুক্তিধরের নাম" />
                  <FormInput isDark={isDark} label="চুক্তিধরের মোবাইল" value={formData.contractorMobile} onChange={v => setFormData({...formData, contractorMobile: v})} type="tel" placeholder="মোবাইল" />
                </div>
                <FormInput isDark={isDark} label="চুক্তিধরের ঠিকানা" value={formData.contractorAddress} onChange={v => setFormData({...formData, contractorAddress: v})} as="textarea" placeholder="চুক্তিধরের বর্তমান ঠিকানা..." />
              </div>

              {/* Agreement Details Section */}
              <div className="space-y-6">
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-600'} border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} pb-2`}>চুক্তিনামা বিস্তারিত</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FormInput isDark={isDark} label="চুক্তিনামার শিরোনাম" value={formData.title} onChange={v => setFormData({...formData, title: v})} required placeholder="উদা: ধানক্ষেত বন্ধক" />
                  <FormInput isDark={isDark} label="জমির পরিমাণ (শতক)" value={formData.area} onChange={v => setFormData({...formData, area: v})} required type="number" prefix="শতক" />
                  <FormInput isDark={isDark} label="বিনিয়োগকৃত টাকা (Security)" value={formData.amount} onChange={handleLandAmountChange} required type="number" prefix="৳" />
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">চুক্তির মেয়াদকাল</label>
                    <div className="flex gap-3">
                      <input type="number" min="1" className={`flex-1 px-5 py-3 rounded-xl border outline-none font-black text-[9px] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`} value={formData.durationValue} onChange={e => setFormData({...formData, durationValue: e.target.value})} />
                      <select className={`flex-1 px-4 py-3 rounded-xl border outline-none font-black text-[9px] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200'}`} value={formData.durationUnit} onChange={e => setFormData({...formData, durationUnit: e.target.value})}>
                        <option value="বছর">বছর</option><option value="মাস">মাস</option>
                      </select>
                    </div>
                  </div>
                  <FormInput isDark={isDark} label={`মাসিক কিস্তি`} value={formData.collectionAmount} onChange={v => setFormData({...formData, collectionAmount: v})} required type="number" prefix="৳" />
                  <FormInput isDark={isDark} label="শুরুর তারিখ" value={formData.startDate} onChange={v => setFormData({...formData, startDate: v})} type="date" required />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
               <div className={`p-8 rounded-[2rem] border-2 border-dashed ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-4`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase">চুক্তি: <span className="text-slate-900 dark:text-white">{formData.title}</span></p>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">মালিক: <span className="text-slate-900 dark:text-white">{formData.ownerName} ({formData.mobile})</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">চুক্তিধর: <span className="text-indigo-600 dark:text-indigo-400">{formData.contractorName} ({formData.contractorMobile})</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">বিনিয়োগ: <span className="text-emerald-600 uppercase">{parseFloat(formData.amount).toLocaleString()} ৳</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">কিস্তি: <span className="text-indigo-600 uppercase">{parseFloat(formData.collectionAmount).toLocaleString()} ৳</span></p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">মেয়াদ: <span className="text-amber-600 uppercase">{formData.durationValue} {formData.durationUnit}</span></p>
               </div>
            </div>
          )}
        </div>

        <div className={`px-10 py-8 flex gap-5 shrink-0 ${isDark ? 'bg-slate-950/80 border-t border-slate-800' : 'bg-slate-50 border-t border-slate-100'}`}>
          {!isPreviewing ? (
            <>
              <button onClick={onCancel} className={`flex-1 py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border-2 border-slate-200 text-slate-600'}`}>বাতিল</button>
              <button onClick={() => handlePreSave()} className="flex-[2] py-5 bg-[#002b5c] text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg">সেভ ও প্রিভিউ</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsPreviewing(false)} className={`flex-1 py-5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-white border-2 border-slate-200 text-slate-600'}`}>সংশোধন</button>
              <button onClick={handleFinalSave} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg">নিশ্চিত করুন</button>
            </>
          )}
        </div>
      </div>
      <style>{`* { font-size: 9px !important; }`}</style>
    </div>
  );
};

export default RecordForm;
