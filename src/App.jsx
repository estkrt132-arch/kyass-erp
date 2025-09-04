import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { Download, Calendar, Plus, X } from "lucide-react";
import * as XLSX from "xlsx";

/* ================== SABİT SEKME TANIMLARI ================== */
const SECTIONS = [
  { id: "orgu", name: "Örgü Adetleri", color: "bg-blue-600", fields: [
    { key: "kyass",    label: "KYASS",   type: "adet", firma: "KYASS" },
    { key: "simliss",  label: "SİMLISS", type: "adet", firma: "SİMLISS" },
    { key: "liberty",  label: "LİBERTY", type: "adet", firma: "LİBERTY" },
    { key: "doca",     label: "DOCA",    type: "adet", firma: "DOCA" },
  ]},
  { id: "boyaya_cikan", name: "Boyaya Çıkan Adetler", color: "bg-amber-600", fields: [
    { key: "best_adet", label: "BEST BOYA ADET", type: "adet", firma: "BEST" },
    { key: "best_kg",   label: "BEST BOYA KG",   type: "kg",   firma: "BEST" },
    { key: "kyass_adet",label: "KYASS BOYA ADET",type: "adet", firma: "KYASS" },
    { key: "kyass_kg",  label: "KYASS BOYA KG",  type: "kg",   firma: "KYASS" },
  ]},
  { id: "boyadan_gelen", name: "Boyadan Gelen Adetler", color: "bg-emerald-600", fields: [
    { key: "gelen_adet",  label: "BOYADAN GELEN ADETLER", type: "adet", firma: "GENEL" },
    { key: "kaliteks_kg", label: "KALİTEKS BOYA KG",      type: "kg",   firma: "KALİTEKS" },
    { key: "kyass_g_adet",label: "KYASS BOYA GELEN ADET", type: "adet", firma: "KYASS" },
    { key: "kyass_g_kg",  label: "KYASS BOYA GELEN KG",   type: "kg",   firma: "KYASS" },
  ]},
  { id: "tasnif", name: "Tasnif Adetleri", color: "bg-purple-600", fields: [
    { key: "tasnif", label: "TASNİF YAPILAN", type: "adet", firma: "KYASS" },
    { key: "hatali", label: "HATALI ÜRÜN",    type: "adet", firma: "KYASS" },
  ]},
  { id: "dikim", name: "Dikim Adetleri", color: "bg-rose-600", fields: [
    { key: "kyass_dikim",  label: "KYASS",  type: "adet", firma: "KYASS" },
    { key: "ayteks_dikim", label: "AYTEKS", type: "adet", firma: "AYTEKS" },
  ]},
  { id: "paket", name: "Paket Adetleri", color: "bg-lime-600", fields: [
    { key: "kyass_paket", label: "KYASS", type: "adet", firma: "KYASS" },
    { key: "enes_paket",  label: "ENES",  type: "adet", firma: "ENES" },
  ]},
  { id: "sevkiyat", name: "Sevk Edilenler", color: "bg-slate-700", fields: [
    { key: "teveo",   label: "TEVEO",   type: "adet", firma: "TEVEO" },
    { key: "youngla", label: "YOUNGLA", type: "adet", firma: "YOUNGLA" },
  ]},
];

/* ================== STORAGE ANAHTARLARI ================== */
const STORAGE_DATA = "tekstil-erp-v4:data";
const STORAGE_META = "tekstil-erp-v4:meta";
const fieldsKey = (sectionId, y, m) => `tekstil-erp-v4:fields:${y}-${m}:${sectionId}`;
const rowsKey   = (sectionId, y, m) => `tekstil-erp-v4:rows:${y}-${m}:${sectionId}`;
const orderKey  = (sectionId, y, m) => `tekstil-erp-v4:order:${y}-${m}:${sectionId}`;
const deletedKey= (sectionId, y, m) => `tekstil-erp-v4:deleted:${y}-${m}:${sectionId}`;

/* ================== YARDIMCI ================== */
const loadJSON = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const monthDays = (year, month) => Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
const pad2 = (n) => String(n).padStart(2, "0");

const isKyassIlave = (name) => !!name && /^KYASS\s*İ?LAVE$/i.test((name||'').trim());
const isFilterFirma = (firma) => !!firma && !isKyassIlave(firma);

const PALETTE = [
  "#ef4444","#3b82f6","#10b981","#f59e0b","#8b5cf6",
  "#ec4899","#14b8a6","#22c55e","#eab308","#6366f1",
  "#06b6d4","#84cc16","#fb7185","#a78bfa","#f97316"
];
const colorFor = (name) => {
  let h = 0; const s = (name||"").toString();
  for (let i = 0; i < s.length; i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const rollupFirmaOf = (f) => {
  const firm = (f?.firma||"").trim();
  if (firm) return firm;
  const etiket = (f?.label||"").trim();
  return etiket || null;
};

function getFieldsWithOrder(sec, y, m) {
  const base = [...sec.fields];
  const extras = loadJSON(fieldsKey(sec.id, y, m), []);
  const order = loadJSON(orderKey(sec.id, y, m), null);
  const deleted = new Set(loadJSON(deletedKey(sec.id, y, m), []));
  const all = [...base, ...extras].filter(f => !deleted.has(f.key));
  if (!order) {
    const initial = all.map(f=>f.key);
    saveJSON(orderKey(sec.id, y, m), initial);
    return all;
  }
  const map = new Map(all.map(f => [f.key, f]));
  const ordered = [];
  order.forEach(k => { if (map.has(k)) { ordered.push(map.get(k)); map.delete(k); } });
  map.forEach(v => ordered.push(v));
  return ordered;
}

/* ================== APP ================== */
export default function App() {
  const today = new Date();
  const meta0 = loadJSON(STORAGE_META, {});
  const [year, setYear] = useState(meta0.year ?? today.getFullYear());
  const [month, setMonth] = useState(meta0.month ?? (today.getMonth() + 1));
  const [active, setActive] = useState(meta0.active ?? "_dashboard");
  const [period, setPeriod] = useState(meta0.period ?? "Aylık");
  const [firmaFilter, setFirmaFilter] = useState("Tümü");
  const [collapsed, setCollapsed] = useState(false);
  const [rev, setRev] = useState(0);

  // Admin modu (şifre: değiştir)
  const [isAdmin, setIsAdmin] = useState(false);
  const ADMIN_PASSWORD = "125634"; // <- burada değiştir

  const days = useMemo(() => monthDays(year, month), [year, month]);
  const [data, setData] = useState(() => loadJSON(STORAGE_DATA, {}));
  useEffect(() => saveJSON(STORAGE_DATA, data), [data]);
  useEffect(() => saveJSON(STORAGE_META, { year, month, active, period }), [year, month, active, period]);

  // alan değişim olayı
  useEffect(() => {
    const handler = () => setRev(r => r + 1);
    window.addEventListener("erp-fields-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("erp-fields-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // GitHub'daki JSON'dan veriyi çek
  useEffect(() => {
    async function fetchData() {
      try {
        const url = "https://raw.githubusercontent.com/estkrt132-arch/kyass-erp/main/data.json";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Veri okunamadı");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Hata:", err);
      }
    }
    fetchData();
  }, [year, month]);

  // GitHub'a kaydet (backend: /api/saveData)
  async function saveDataToGitHub(newData) {
    const res = await fetch("/api/saveData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newData }),
    });
    if (!res.ok) throw new Error("GitHub kaydedilemedi");
    return await res.json();
  }

  const section = useMemo(() => SECTIONS.find(s => s.id === active) || null, [active]);

  // Hücre set + anında GitHub'a commit (sadece adminken)
  const setCellAndMaybeSave = (rowKey, fieldKey, val, secId = active) => {
    let nextDataRef = null;
    setData(prev => {
      const k = `${year}-${month}`;
      const frame = prev[k] || {};
      const sec = frame[secId] || {};
      const row = sec[rowKey] || {};
      const next = {
        ...prev,
        [k]: {
          ...frame,
          [secId]: {
            ...sec,
            [rowKey]: { ...row, [fieldKey]: val }
          }
        }
      };
      saveJSON(STORAGE_DATA, next);
      nextDataRef = next;
      return next;
    });
    if (isAdmin && nextDataRef) {
      // Hemen commit et (istersen debouncing ekleyebilirsin)
      saveDataToGitHub(nextDataRef).catch(err => {
        console.error("GitHub kaydedilemedi", err);
        alert("GitHub'a kaydedilemedi!");
      });
    }
  };

  const getCell = (rowKey, fieldKey, secId = active) =>
    data?.[`${year}-${month}`]?.[secId]?.[rowKey]?.[fieldKey] ?? "";

  /* ================== KPI & GRAFİK HESAPLARI ================== */
  const firmalar = useMemo(() => {
    const s = new Set();
    SECTIONS.forEach(sec => {
      const fields = getFieldsWithOrder(sec, year, month);
      fields.forEach(f => {
        const r = rollupFirmaOf(f);
        if (isFilterFirma(r)) s.add(r);
      });
    });
    return ["Tümü", ...Array.from(s)];
  }, [year, month, data, rev]);

  const kpiData = useMemo(() => {
    if (period === "Aylık") {
      const frame = data?.[`${year}-${month}`] || {};
      return SECTIONS.map(sec => {
        let adet = 0, kg = 0;
        const fields = getFieldsWithOrder(sec, year, month);
        const secData = frame[sec.id] || {};
        Object.values(secData).forEach(row => {
          fields.forEach(f => {
            const r = rollupFirmaOf(f);
            if (firmaFilter !== "Tümü" && r !== firmaFilter) return;
            const v = Number(row?.[f.key] ?? 0);
            if (!isNaN(v)) (f.type === "kg" ? (kg += v) : (adet += v));
          });
        });
        return { id: sec.id, name: sec.name, adet, kg, color: sec.color };
      });
    }
    // yıllık
    return SECTIONS.map(sec => {
      let adet = 0, kg = 0;
      for (let m = 1; m <= 12; m++) {
        const frame = data?.[`${year}-${m}`] || {};
        const secData = frame[sec.id] || {};
        const fields = getFieldsWithOrder(sec, year, m);
        Object.values(secData).forEach(row => {
          fields.forEach(f => {
            const r = rollupFirmaOf(f);
            if (firmaFilter !== "Tümü" && r !== firmaFilter) return;
            const v = Number(row?.[f.key] ?? 0);
            if (!isNaN(v)) (f.type === "kg" ? (kg += v) : (adet += v));
          });
        });
      }
      return { id: sec.id, name: sec.name, adet, kg, color: sec.color };
    });
  }, [period, data, year, month, firmaFilter]);

  const mainTrend = useMemo(() => {
    if (period === "Aylık") {
      const frame = data?.[`${year}-${month}`] || {};
      return days.map(d => {
        let adet = 0, kg = 0;
        SECTIONS.forEach(sec => {
          const fields = getFieldsWithOrder(sec, year, month);
          fields.forEach(f => {
            const r = rollupFirmaOf(f);
            if (firmaFilter !== "Tümü" && r !== firmaFilter) return;
            const v = Number(frame?.[sec.id]?.[d]?.[f.key] ?? 0);
            if (!isNaN(v)) (f.type === "kg" ? (kg += v) : (adet += v));
          });
        });
        return { label: d, adet, kg };
      });
    }
    // yıllık
    return Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
      let adet = 0, kg = 0;
      const frame = data?.[`${year}-${m}`] || {};
      SECTIONS.forEach(sec => {
        const fields = getFieldsWithOrder(sec, year, m);
        const secData = frame[sec.id] || {};
        fields.forEach(f => {
          const r = rollupFirmaOf(f);
          if (firmaFilter !== "Tümü" && r !== firmaFilter) return;
          Object.values(secData).forEach(row => {
            const v = Number(row?.[f.key] ?? 0);
            if (!isNaN(v)) (f.type === "kg" ? (kg += v) : (adet += v));
          });
        });
      });
      return { label: pad2(m), adet, kg };
    });
  }, [period, data, year, month, days, firmaFilter]);

  const firmSet = useMemo(() => {
    const s = new Set();
    SECTIONS.forEach(sec => getFieldsWithOrder(sec, year, month).forEach(f => {
      const r = rollupFirmaOf(f);
      if (isFilterFirma(r)) s.add(r);
    }));
    return Array.from(s);
  }, [year, month, data, rev]);

  const firmMonthly = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ label: pad2(i + 1) }));
    for (let m = 1; m <= 12; m++) {
      const frame = data?.[`${year}-${m}`] || {};
      firmSet.forEach(firma => {
        let sum = 0;
        SECTIONS.forEach(sec => {
          const fields = getFieldsWithOrder(sec, year, m).filter(fl => rollupFirmaOf(fl) === firma);
          const secData = frame[sec.id] || {};
          fields.forEach(fl => {
            Object.values(secData).forEach(row => {
              const v = Number(row?.[fl.key] ?? 0);
              if (!isNaN(v)) sum += v;
            });
          });
        });
        byMonth[m - 1][firma] = sum;
      });
    }
    return byMonth;
  }, [data, year, firmSet]);

  /* ================== EXCEL ================== */
  const exportExcelAllMonthly = () => {
    const wb = XLSX.utils.book_new();
    const dash = [["Bölüm", period === "Aylık" ? `Ay Toplamı (${pad2(month)}.${year})` : `Yıl Toplamı (${year})`, "Kg"]];
    kpiData.forEach(s => dash.push([s.name, s.adet, s.kg]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dash), "Dashboard");

    SECTIONS.forEach(sec => {
      const fields = getFieldsWithOrder(sec, year, month);
      const headers = ["Satır", ...fields.map(f => f.label)];
      const rows = [headers];
      monthDays(year, month).forEach(d => {
        rows.push([`${pad2(d)}.${pad2(month)}.${year}`,
          ...fields.map(f => data?.[`${year}-${month}`]?.[sec.id]?.[d]?.[f.key] ?? "")
        ]);
      });
      const exRows = loadJSON(rowsKey(sec.id, year, month), []);
      exRows.forEach(r => rows.push([r.label, ...fields.map(f => data?.[`${year}-${month}`]?.[sec.id]?.[`x_${r.id}`]?.[f.key] ?? "")]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sec.name.slice(0, 31));
    });

    XLSX.writeFile(wb, `Rapor-${year}-${pad2(month)}.xlsx`);
  };

  const exportExcelAllYearly = () => {
    const wb = XLSX.utils.book_new();
    const dash = [["Bölüm", `Yıl Toplamı (${year})`, "Kg"]];
    kpiData.forEach(s => dash.push([s.name, s.adet, s.kg]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dash), "Dashboard");

    SECTIONS.forEach(sec => {
      const fieldMap = new Map();
      for (let m = 1; m <= 12; m++) getFieldsWithOrder(sec, year, m).forEach(f => { if (!fieldMap.has(f.key)) fieldMap.set(f.key, { label: f.label, type: f.type }); });
      const allFields = Array.from(fieldMap.entries()).map(([key, v]) => ({ key, ...v }));
      const headers = ["Ay", ...allFields.map(f => f.label)];
      const rows = [headers];
      for (let m = 1; m <= 12; m++) {
        const frame = data?.[`${year}-${m}`] || {};
        const secData = frame[sec.id] || {};
        const row = [pad2(m)];
        allFields.forEach(f => {
          let sum = 0;
          Object.values(secData).forEach(r => { const v = Number(r?.[f.key] ?? 0); if (!isNaN(v)) sum += v; });
          row.push(sum);
        });
        rows.push(row);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `${sec.name.slice(0, 28)}-Yıl`);
    });

    XLSX.writeFile(wb, `Rapor-Yillik-${year}.xlsx`);
  };

  /* ================== UI ================== */
  return (
    <div className="w-full h-full grid grid-cols-[auto_1fr] bg-slate-50">
      {/* Sidebar */}
      <aside className={`${collapsed?"w-20":"w-64"} transition-all h-screen bg-gradient-to-b from-slate-200 to-slate-900 text-white p-4 flex flex-col`}>
        <div className="flex items-center justify-center mb-6">
          {!collapsed && (
            <div className="flex items-center justify-center mb-6">
  {!collapsed && (
    <img
      src={`${import.meta.env.BASE_URL}kyass-logo.png`}
      alt="KYASS"
      className="h-24 w-auto object-contain"
    />
  )}
</div>

          )}
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => setActive("_dashboard")} className={`w-full text-left px-3 py-2 rounded-xl font-semibold ${active==="_dashboard"?"bg-white text-slate-900":"text-slate-200 hover:bg-white/20 hover:text-white"}`}>
            {collapsed?"🏠":"Anasayfa"}
          </button>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)} className={`w-full text-left px-3 py-2 rounded-xl font-semibold ${active===s.id?"bg-white text-slate-900":"text-slate-200 hover:bg-white/20 hover:text-white"}`}>
              {collapsed?"•":s.name}
            </button>
          ))}
        </nav>
        <div className="text-xs text-white/60">© By Design: Esat KURT</div>
      </aside>

      {/* Content */}
      <main className="h-screen overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar size={18} />
            <select value={month} onChange={e=>setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 bg-white">
              {Array.from({length:12}, (_,i)=>i+1).map(m=> (
                <option key={m} value={m}>{pad2(m)}</option>
              ))}
            </select>
            <input type="number" value={year} onChange={e=>setYear(Number(e.target.value))} className="w-24 border rounded-lg px-3 py-2 bg-white"/>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin butonları */}
            {!isAdmin ? (
              <button
                onClick={() => {
                  const pass = prompt("Admin şifresini gir:");
                  if (pass === ADMIN_PASSWORD) setIsAdmin(true);
                  else alert("Yanlış şifre!");
                }}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white"
              >
                Admin Girişi
              </button>
            ) : (
              <>
                <button
                  onClick={() => saveDataToGitHub(data).then(()=>alert("GitHub'a kaydedildi")).catch(()=>alert("Kaydedilemedi"))}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
                  title="Anında GitHub'a kaydet"
                >
                  Kaydet (GitHub)
                </button>
                <button onClick={()=>setIsAdmin(false)} className="px-3 py-2 rounded-xl bg-rose-600 text-white">Admin Modunu Kapat</button>
              </>
            )}

            <button onClick={exportExcelAllMonthly} className="px-3 py-2 rounded-xl bg-slate-900 text-white flex items-center gap-2">
              <Download size={16}/>Aylık Excel
            </button>
            <button onClick={exportExcelAllYearly} className="px-3 py-2 rounded-xl bg-slate-700 text-white flex items-center gap-2">
              <Download size={16}/>Yıllık Excel
            </button>
          </div>
        </div>

        {/* Screens */}
        {active === "_dashboard" ? (
          <Dashboard
            period={period}
            setPeriod={setPeriod}
            firmalar={firmalar}
            firmaFilter={firmaFilter}
            setFirmaFilter={setFirmaFilter}
            kpiData={kpiData}
            mainTrend={mainTrend}
            month={month}
            year={year}
            firmSet={firmSet}
            firmMonthly={firmMonthly}
          />
        ) : (
          <SectionView
            key={`${section?.id || "sec"}-${year}-${month}`}
            year={year}
            month={month}
            section={section}
            getCell={getCell}
            onCellChange={setCellAndMaybeSave}
            isAdmin={isAdmin}
          />
        )}
      </main>
    </div>
  );
}

/* ================== FORM (SEKME) ================== */
function SectionView({ year, month, section, getCell, onCellChange, isAdmin }) {
  const FKEY = fieldsKey(section.id, year, month);
  const RKEY = rowsKey(section.id, year, month);
  const OKEY = orderKey(section.id, year, month);
  const DKEY = deletedKey(section.id, year, month);

  const [extraFields, setExtraFields] = useState(() => loadJSON(FKEY, []));
  const [extraRows, setExtraRows] = useState(() => loadJSON(RKEY, []));
  const [order, setOrder] = useState(() => loadJSON(OKEY, null));
  const [deleted, setDeleted] = useState(() => new Set(loadJSON(DKEY, [])));

  useEffect(() => { saveJSON(FKEY, extraFields); }, [extraFields, FKEY]);
  useEffect(() => { saveJSON(RKEY, extraRows); }, [extraRows, RKEY]);
  useEffect(() => { saveJSON(OKEY, order);      }, [order, OKEY]);
  useEffect(() => { saveJSON(DKEY, Array.from(deleted)); }, [deleted, DKEY]);

  useEffect(() => { setExtraFields(loadJSON(FKEY, [])); }, [FKEY]);
  useEffect(() => { setExtraRows(loadJSON(RKEY, []));   }, [RKEY]);
  useEffect(() => { setOrder(loadJSON(OKEY, null));     }, [OKEY]);
  useEffect(() => { setDeleted(new Set(loadJSON(DKEY, []))); }, [DKEY]);

  const baseFields = section.fields;
  const fieldsOrdered = useMemo(() => {
    const current = [...baseFields, ...extraFields].filter(f => !deleted.has(f.key));
    let ord = order;
    if (!ord) {
      ord = [...current.map(f=>f.key)];
      setOrder(ord);
      return current;
    }
    const byKey = new Map(current.map(f => [f.key, f]));
    const out = [];
    ord.forEach(k => { if (byKey.has(k)) { out.push(byKey.get(k)); byKey.delete(k); } });
    byKey.forEach(v => out.push(v));
    return out;
  }, [baseFields, extraFields, order, deleted]);

  const allFields = fieldsOrdered;

  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ label: "", type: "adet", firma: "" });

  const onAddField = () => {
    if (!newField.label.trim()) return setShowAddField(false);
    const f = { key: `extra_${section.id}_${Date.now()}`, label: newField.label.trim(), type: newField.type, firma: newField.firma?.trim() || null };
    const next = [...extraFields, f];
    setExtraFields(next);
    setOrder([...(order||[]), f.key]);
    setShowAddField(false);
    setNewField({ label: "", type: "adet", firma: "" });
    window.dispatchEvent(new Event("erp-fields-changed"));
  };

  const addRow = () => {
    const label = prompt("Yeni satır adı:");
    if (!label) return;
    setExtraRows(prev => [...prev, { id: `${Date.now()}`, label }]);
    window.dispatchEvent(new Event("erp-fields-changed"));
  };

  const [dragFieldKey, setDragFieldKey] = useState(null);
  const onFieldDragStart = (e, key) => { setDragFieldKey(key); e.dataTransfer.setData("text/plain", key); e.stopPropagation(); };
  const onFieldDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onFieldDrop = (e, targetKey) => {
    e.preventDefault(); e.stopPropagation();
    const sourceKey = dragFieldKey || e.dataTransfer.getData("text/plain");
    if (!sourceKey || sourceKey === targetKey) return;
    setOrder(prev => {
      const arr = [...(prev||[])];
      const sIdx = arr.indexOf(sourceKey);
      let tIdx = arr.indexOf(targetKey);
      if (sIdx === -1 || tIdx === -1) return prev;
      const [moved] = arr.splice(sIdx, 1);
      arr.splice(tIdx, 0, moved);
      return arr;
    });
    setDragFieldKey(null);
    window.dispatchEvent(new Event("erp-fields-changed"));
  };

  const [dragRowId, setDragRowId] = useState(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const [dragOverPos, setDragOverPos] = useState(null);
  const onRowDragStart = (e, id) => { setDragRowId(id); e.dataTransfer.setData("text/plain", id); };
  const onRowDragOver = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const isBelow = (e.clientY - rect.top) > rect.height/2;
    const id = e.currentTarget.getAttribute("data-row-id");
    setDragOverRowId(id); setDragOverPos(isBelow?"bottom":"top");
  };
  const onRowDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = dragRowId || e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) { setDragOverRowId(null); setDragOverPos(null); return; }
    setExtraRows(prev => {
      const arr = [...prev];
      const sIdx = arr.findIndex(r => r.id === sourceId);
      const [moved] = arr.splice(sIdx, 1);
      let tIdx = arr.findIndex(r => r.id === targetId);
      if (tIdx === -1) return prev;
      const insertIndex = dragOverPos === "bottom" ? tIdx + 1 : tIdx;
      arr.splice(insertIndex, 0, moved);
      return arr;
    });
    setDragRowId(null); setDragOverRowId(null); setDragOverPos(null);
    window.dispatchEvent(new Event("erp-fields-changed"));
  };

  const onFieldContext = (e, key) => {
    e.preventDefault();
    if (!window.confirm("Bu sütunu bu ay/sekme görünümünden silmek istiyor musunuz?")) return;
    setDeleted(prev => new Set([...prev, key]));
    setExtraFields(prev => prev.filter(x => x.key !== key));
    setOrder(prev => (prev||[]).filter(k => k !== key));
    window.dispatchEvent(new Event("erp-fields-changed"));
  };
  const onRowContext = (e, id) => {
    e.preventDefault();
    if (window.confirm("Bu satırı silmek istiyor musunuz?")) {
      setExtraRows(prev => prev.filter(x => x.id !== id));
      window.dispatchEvent(new Event("erp-fields-changed"));
    }
  };

  const dayRows = monthDays(year, month).map(d => ({ key: d, label: `${pad2(d)}.${pad2(month)}.${year}`, isExtra: false }));
  const extraRowsView = extraRows.map(r => ({ key: `x_${r.id}`, id: r.id, label: r.label, isExtra: true }));
  const allRows = [...dayRows, ...extraRowsView];

  const totals = useMemo(() => {
    const t = {}; fieldsOrdered.forEach(f => t[f.key] = 0);
    allRows.forEach(r => fieldsOrdered.forEach(f => { const v = Number(getCell(r.key, f.key) || 0); if (!isNaN(v)) t[f.key] += v; }));
    return t;
  }, [fieldsOrdered, allRows, getCell]);

  return (
    <div className="space-y-4" onDragOver={(e)=>e.preventDefault()}>
      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`px-3 py-1 rounded-xl text-white text-sm ${section.color}`}>{section.name}</div>
        <div className="flex gap-2">
          <button onClick={()=>setShowAddField(true)} className="px-3 py-1 rounded bg-green-600 text-white flex items-center gap-1 text-sm" disabled={!isAdmin}>
            <Plus size={14}/> Alan Ekle
          </button>
          <button onClick={addRow} className="px-3 py-1 rounded bg-slate-700 text-white flex items-center gap-1 text-sm" disabled={!isAdmin}>
            <Plus size={14}/> Satır Ekle
          </button>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-2xl shadow p-3 overflow-auto">
        <table className="min-w-full text-sm" onDragOver={(e)=>e.preventDefault()}>
          <thead>
            <tr className="bg-slate-100">
              <th className="sticky left-0 bg-slate-100 p-2 text-left">Satır</th>
              {fieldsOrdered.map(f => (
                <th
                  key={f.key}
                  className={`p-2 whitespace-nowrap text-left select-none ${isAdmin ? "cursor-move" : ""}`}
                  draggable={isAdmin}
                  onDragStart={isAdmin ? (e)=>onFieldDragStart(e, f.key) : undefined}
                  onDragOver={isAdmin ? onFieldDragOver : undefined}
                  onDrop={isAdmin ? (e)=>onFieldDrop(e, f.key) : undefined}
                  onContextMenu={isAdmin ? (e)=>onFieldContext(e, f.key) : undefined}
                  title={isAdmin ? "Taşı / Sağ tık ile sil" : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{f.label}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{f.type}{f.firma?` • ${f.firma}`:""}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody onDragOver={(e)=>e.preventDefault()}>
            {allRows.map(r => (
              <tr key={r.key} className="even:bg-slate-50">
                <td
                  className="sticky left-0 bg-white p-2 font-medium select-none"
                  data-row-id={r.id}
                  draggable={isAdmin && r.isExtra}
                  onDragStart={isAdmin && r.isExtra ? (e)=>onRowDragStart(e, r.id) : undefined}
                  onDragOver={isAdmin && r.isExtra ? onRowDragOver : undefined}
                  onDrop={isAdmin && r.isExtra ? (e)=>onRowDrop(e, r.id) : undefined}
                  onContextMenu={isAdmin && r.isExtra ? (e)=>onRowContext(e, r.id) : undefined}
                  title={isAdmin ? (r.isExtra ? "Sürükle-bırak ile taşı • Sağ tık ile sil" : undefined) : undefined}
                >
                  {r.label}
                </td>

                {fieldsOrdered.map(f => (
                  <td key={f.key} className="p-1" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>e.preventDefault()}>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getCell(r.key, f.key)}
                      onChange={isAdmin ? (e) => {
                        const val = (e.target.value || "").replace(/[^0-9.]/g, "");
                        onCellChange(r.key, f.key, val, section.id);
                      } : undefined}
                      readOnly={!isAdmin}
                      className={`w-28 border rounded-lg px-2 py-1 ${isAdmin ? "bg-white focus:outline-none focus:ring-2 focus:ring-slate-400" : "bg-slate-100 text-slate-700"}`}
                      placeholder={f.type === "kg" ? "kg" : "adet"}
                      onDrop={(e)=>e.preventDefault()}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-slate-100 font-semibold">
              <td className="sticky left-0 bg-slate-100 p-2">AY TOPLAMI</td>
              {fieldsOrdered.map(f => (
                <td key={f.key} className="p-2">{(totals[f.key] || 0).toLocaleString("tr-TR")}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Alan ekle modalı */}
      {showAddField && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-4 w-[420px] shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Yeni Alan</div>
              <button className="p-1" onClick={()=>setShowAddField(false)}><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600">Etiket</label>
                <input value={newField.label} onChange={e=>setNewField(v=>({...v, label:e.target.value}))} className="w-full border rounded px-2 py-1" placeholder="örn: KYASS İlave" disabled={!isAdmin}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Tip</label>
                  <select value={newField.type} onChange={e=>setNewField(v=>({...v, type:e.target.value}))} className="w-full border rounded px-2 py-1" disabled={!isAdmin}>
                    <option value="adet">adet</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Firma (opsiyonel)</label>
                  <input value={newField.firma} onChange={e=>setNewField(v=>({...v, firma:e.target.value}))} className="w-full border rounded px-2 py-1" placeholder="örn: KYASS" disabled={!isAdmin}/>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Not: <b>Firma</b> doldurursan veriler o firmaya yazılır. Boş bırakırsan <b>Etiket</b> yeni firma kabul edilir.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="px-3 py-1 rounded bg-slate-200" onClick={()=>setShowAddField(false)}>Vazgeç</button>
                <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={onAddField} disabled={!isAdmin}>Ekle</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== ANASAYFA ================== */
function KPI({title, adet, kg, color}) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1.5 ${color}`}></div>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-bold">{adet.toLocaleString("tr-TR")} <span className="text-slate-400 text-sm">/ {kg.toLocaleString("tr-TR")} kg</span></div>
    </div>
  );
}

function Dashboard({ period, setPeriod, firmalar, firmaFilter, setFirmaFilter, kpiData, mainTrend, month, year, firmSet, firmMonthly }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <select value={period} onChange={e=>setPeriod(e.target.value)} className="border rounded px-3 py-2 bg-white">
          <option>Aylık</option>
          <option>Yıllık</option>
        </select>
        <select value={firmaFilter} onChange={e=>setFirmaFilter(e.target.value)} className="border rounded px-3 py-2 bg-white">
          {firmalar.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div className="text-lg font-bold text-slate-700">
        {period === "Aylık"
          ? `Aylık Rapor — ${pad2(month)}.${year} (Ay Toplamları)`
          : `Yıllık Rapor — ${year} (12 Ay Toplamları)`}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((m) => (
          <KPI key={m.id} title={m.name} adet={m.adet} kg={m.kg} color={m.color} />
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="text-slate-700 font-semibold mb-2">
          {period === "Aylık" ? "Günlük Toplam Trend (Seçili Ay)" : "Aylık Toplam Trend (12 Ay)"}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mainTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="adet" name="Adet" stroke="#ef4444" strokeWidth={2}/>
              <Line type="monotone" dataKey="kg"   name="Kg"   stroke="#3b82f6" strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="text-slate-700 font-semibold mb-2">Firma Bazında 12 Aylık Toplam (Adet)</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={firmMonthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              {firmSet.map(f => (
                <Bar key={f} dataKey={f} stackId="a" name={f} fill={colorFor(f)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
