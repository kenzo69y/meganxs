const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let rows = [];
let selectedBank = "";
let activeTab = "overview";
let detailPage = 1;
const pageSize = 50;
const STORAGE_KEY = "meganxs_raw_v41";
const OLD_STORAGE_KEYS = ["meganxs_raw_v3"];

const money = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const num = n => new Intl.NumberFormat("id-ID").format(Number(n)||0);
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

function parseMoney(v){
  let s = String(v ?? "").trim();
  if(!s) return 0;
  const neg = /^\s*-/.test(s);
  s = s.replace(/[^\d]/g,"");
  return (neg ? -1 : 1) * Number(s || 0);
}

function detectBank(details){
  const t = String(details || "").toUpperCase();
  const rules = [
    [/\b(?:NXPAY|NXSPAY)\b/,"NXPAY","qris"],
    [/\bOASIS\b/,"OASIS","qris"],
    [/\bMINERA\b/,"MINERA","qris"],
    [/\bSTO\b/,"STO","qris"],
    [/\bBCA\b/,"BCA","bank"],
    [/\bBNI\b/,"BNI","bank"],
    [/\bBRI\b/,"BRI","bank"],
    [/\b(?:MANDIRI|MDR)\b/,"MDR","bank"]
  ];
  for(const [re,name,type] of rules){
    if(re.test(t)) return {name,type,known:true};
  }
  return {name:"BELUM TERBACA",type:"unknown",known:false};
}

function isAdjust(r){
  return String(r.category || "").toUpperCase().includes("ADJUST KEMBALI");
}

function effective(r){
  const d = Number(r.debit) || 0;
  const c = Number(r.credit) || 0;

  if(isAdjust(r)){
    if(d > 0 && c <= 0){
      return {out:0,in:-d,adjusted:true,source:"Debit",amount:d,effect:"Mengurangi Uang Masuk"};
    }
    if(c > 0 && d <= 0){
      return {out:-c,in:0,adjusted:true,source:"Credit",amount:c,effect:"Mengurangi Uang Keluar"};
    }
  }

  return {out:d,in:c,adjusted:false,source:"",amount:0,effect:""};
}

function dateKey(s){
  const t = String(s || "").trim();
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  const mons = {JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12"};

  if(m && mons[m[2].toUpperCase()]){
    return `${m[3]}-${mons[m[2].toUpperCase()]}-${String(m[1]).padStart(2,"0")}`;
  }

  const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  const m3 = t.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if(m3) return `${m3[3]}-${String(m3[2]).padStart(2,"0")}-${String(m3[1]).padStart(2,"0")}`;

  return "";
}

function splitLine(line,d){
  if(d === "\t") return line.split("\t");

  let out = [], cur = "", quote = false;
  for(let i=0;i<line.length;i++){
    const c = line[i];
    if(c === '"'){
      if(quote && line[i+1] === '"'){
        cur += '"';
        i++;
      }else{
        quote = !quote;
      }
    }else if(c === d && !quote){
      out.push(cur);
      cur = "";
    }else{
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeHeader(v){
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g," ");
}

function parseInput(text){
  const lines = String(text || "").replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if(lines.length < 2) throw new Error("Header dan minimal 1 transaksi harus ikut dimasukkan.");

  const d = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const head = splitLine(lines[0],d).map(normalizeHeader);
  const req = ["date time","details","debit","credit","category"];
  const idx = Object.fromEntries(req.map(k=>[k,head.indexOf(k)]));
  const missing = req.filter(k=>idx[k] < 0);

  if(missing.length) throw new Error("Header tidak terbaca: " + missing.join(", "));

  return lines.slice(1).map((line,i)=>{
    const c = splitLine(line,d);
    const details = (c[idx["details"]] || "").trim();
    const b = detectBank(details);

    return {
      id:i+1,
      dateTime:(c[idx["date time"]] || "").trim(),
      dateKey:dateKey(c[idx["date time"]]),
      details,
      debit:parseMoney(c[idx.debit]),
      credit:parseMoney(c[idx.credit]),
      category:(c[idx.category] || "").trim() || "TANPA CATEGORY",
      bank:b.name,
      type:b.type,
      known:b.known
    };
  }).filter(r=>r.dateTime || r.details || r.debit || r.credit);
}

function setStatus(t,type="info"){
  const e = $("#status");
  e.textContent = t;
  e.className = "status " + type;
}

function filtered(){
  const q = $("#searchInput").value.trim().toLowerCase();
  const cat = $("#categoryFilter").value;
  const dir = $("#directionFilter").value;
  const date = $("#dateFilter").value;

  return rows.filter(r=>{
    const e = effective(r);
    if(selectedBank && r.bank !== selectedBank) return false;
    if(cat && r.category !== cat) return false;
    if(dir === "out" && e.out === 0) return false;
    if(dir === "in" && e.in === 0) return false;
    if(dir === "adjust" && !e.adjusted) return false;
    if(date && r.dateKey !== date) return false;
    if(q && !`${r.dateTime} ${r.details} ${r.category} ${r.bank}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function group(data,key){
  const m = new Map();

  for(const r of data){
    const k = r[key] || "LAINNYA";
    const e = effective(r);

    if(!m.has(k)) m.set(k,{name:k,count:0,out:0,in:0,adjust:0});
    const x = m.get(k);

    x.count++;
    x.out += e.out;
    x.in += e.in;
    if(e.adjusted) x.adjust++;
  }

  return [...m.values()]
    .map(x=>({...x,net:x.in-x.out,volume:Math.abs(x.in)+Math.abs(x.out)}))
    .sort((a,b)=>b.volume-a.volume);
}

function refreshOptions(){
  const cur = $("#categoryFilter").value;
  const cats = [...new Set(rows.map(r=>r.category))].sort((a,b)=>a.localeCompare(b,"id"));

  $("#categoryFilter").innerHTML =
    `<option value="">Semua Category</option>` +
    cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");

  if(cats.includes(cur)) $("#categoryFilter").value = cur;

  const order = ["BCA","BNI","BRI","MDR","NXPAY","OASIS","MINERA","STO","BELUM TERBACA"];
  const banks = order.filter(x=>rows.some(r=>r.bank===x));

  $("#bankChips").innerHTML =
    `<button class="chip ${selectedBank===""?"active":""}" data-bank="">SEMUA</button>` +
    banks.map(b=>`<button class="chip ${selectedBank===b?"active":""}" data-bank="${b}">${b}</button>`).join("");

  $$("#bankChips .chip").forEach(b=>{
    b.onclick = ()=>{
      selectedBank = b.dataset.bank;
      detailPage = 1;
      refreshOptions();
      renderAll();
    };
  });
}

function renderCards(data){
  const out = data.reduce((s,r)=>s+effective(r).out,0);
  const inc = data.reduce((s,r)=>s+effective(r).in,0);
  const adjs = data.filter(isAdjust);
  const adjTotal = adjs.reduce((s,r)=>s+effective(r).amount,0);

  $("#totalOut").textContent = money(out);
  $("#totalIn").textContent = money(inc);
  $("#netTotal").textContent = money(inc-out);
  $("#adjustTotal").textContent = money(adjTotal);
  $("#trxCount").textContent = num(data.length);
  $("#inCount").textContent = `${data.filter(r=>effective(r).in!==0).length} transaksi masuk efektif`;
  $("#outCount").textContent = `${data.filter(r=>effective(r).out!==0).length} transaksi keluar efektif`;
  $("#adjustCount").textContent = `${adjs.length} adjust kembali`;
  $("#bankCount").textContent = `${new Set(data.map(r=>r.bank)).size} Bank / QRIS`;

  const unknown = data.filter(r=>!r.known);
  $("#unknownAlert").style.display = unknown.length ? "flex" : "none";
  $("#unknownText").textContent = unknown.length
    ? `${unknown.length} transaksi Bank / QRIS belum terbaca. Perlu dicek supaya rekap tidak salah.`
    : "";
}

function barHTML(items){
  if(!items.length) return `<div class="empty">Belum ada data.</div>`;
  const top = items.slice(0,7);
  const max = Math.max(...top.map(x=>x.volume),1);

  return top.map(x=>`
    <div class="rowbar">
      <div class="rowtop"><strong>${esc(x.name)}</strong><span>${money(x.net)}</span></div>
      <div class="bar"><i style="width:${Math.max(3,x.volume/max*100)}%"></i></div>
    </div>
  `).join("");
}

function renderOverview(data){
  const bg = group(data,"bank");
  const cg = group(data,"category");

  $("#bankBars").innerHTML = barHTML(bg);
  $("#categoryBars").innerHTML = barHTML(cg);

  const unknown = data.filter(r=>!r.known).length;
  const adj = data.filter(isAdjust).length;
  const normal = data.length - adj;

  $("#auditBox").innerHTML = `
    <div class="metric-line"><span>Transaksi normal</span><strong>${num(normal)}</strong></div>
    <div class="metric-line"><span>ADJUST KEMBALI</span><strong class="adjust">${num(adj)}</strong></div>
    <div class="metric-line"><span>Bank / QRIS belum terbaca</span><strong class="${unknown?"out":"in"}">${num(unknown)}</strong></div>
    <div class="metric-line"><span>Category unik</span><strong>${num(new Set(data.map(r=>r.category)).size)}</strong></div>
    <div class="metric-line"><span>Bank / QRIS unik</span><strong>${num(new Set(data.map(r=>r.bank)).size)}</strong></div>
  `;
}

function summaryTable(items,label){
  if(!items.length) return `<div class="empty">Belum ada data.</div>`;

  return `<table>
    <thead><tr><th>${label}</th><th>TRX</th><th style="text-align:right">Masuk</th><th style="text-align:right">Keluar</th><th style="text-align:right">Selisih</th><th>Adjust</th></tr></thead>
    <tbody>
      ${items.map(x=>`
        <tr>
          <td><strong>${esc(x.name)}</strong></td>
          <td>${num(x.count)}</td>
          <td class="money in">${money(x.in)}</td>
          <td class="money out">${money(x.out)}</td>
          <td class="money net">${money(x.net)}</td>
          <td>${x.adjust ? `<span class="badge adj">${x.adjust}</span>` : "—"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
}

function renderSummaries(data){
  $("#bankSummary").innerHTML = summaryTable(group(data,"bank"),"Bank / QRIS");
  $("#categorySummary").innerHTML = summaryTable(group(data,"category"),"Category");
}

function bankBadge(r){
  return `<span class="badge ${r.type==="qris"?"qris":r.type==="unknown"?"unknown":""}">${esc(r.bank)}</span>`;
}

function renderDetail(data){
  const pages = Math.max(1,Math.ceil(data.length/pageSize));
  if(detailPage > pages) detailPage = pages;

  const start = (detailPage-1)*pageSize;
  const slice = data.slice(start,start+pageSize);

  $("#detailBody").innerHTML = slice.map((r,i)=>{
    const e = effective(r);
    return `<tr class="clickable" data-id="${r.id}">
      <td>${start+i+1}</td>
      <td>${esc(r.dateTime)}</td>
      <td>${bankBadge(r)}</td>
      <td class="money out">${e.out!==0?money(e.out):"—"}</td>
      <td class="money in">${e.in!==0?money(e.in):"—"}</td>
      <td>${esc(r.category)} ${e.adjusted?`<span class="badge adj">ADJUST</span>`:""}</td>
    </tr>`;
  }).join("");

  $("#detailEmpty").style.display = slice.length ? "none" : "block";
  $("#rowInfo").textContent = `${data.length} dari ${rows.length} data · klik baris untuk Details`;
  $("#pageInfo").textContent = `Halaman ${detailPage} / ${pages}`;
  $("#prevPage").disabled = detailPage <= 1;
  $("#nextPage").disabled = detailPage >= pages;

  $$("#detailBody tr").forEach(tr=>tr.onclick=()=>openDetail(Number(tr.dataset.id)));
}

function renderAdjust(data){
  const ad = data.filter(isAdjust);

  $("#adjustBody").innerHTML = ad.map(r=>{
    const e = effective(r);
    return `<tr>
      <td>${esc(r.dateTime)}</td>
      <td>${bankBadge(r)}</td>
      <td><span class="badge adj">${e.source}</span></td>
      <td class="money adjust">${money(e.amount)}</td>
      <td>${esc(e.effect)}</td>
    </tr>`;
  }).join("");

  $("#adjustEmpty").style.display = ad.length ? "none" : "block";
}

function renderAll(){
  const data = filtered();
  renderCards(data);
  renderOverview(data);
  renderSummaries(data);
  renderDetail(data);
  renderAdjust(data);
}

function processData(sourceName=""){
  try{
    rows = parseInput($("#rawInput").value);
    selectedBank = "";
    detailPage = 1;
    localStorage.setItem(STORAGE_KEY,$("#rawInput").value);
    OLD_STORAGE_KEYS.forEach(k=>localStorage.removeItem(k));
    refreshOptions();
    renderAll();
    setStatus(`${rows.length} transaksi berhasil dibaca${sourceName ? " · " + sourceName : ""}`,"ok");
  }catch(e){
    rows = [];
    selectedBank = "";
    refreshOptions();
    renderAll();
    setStatus(e.message,"err");
  }
}

function resetFilter(){
  selectedBank = "";
  $("#searchInput").value = "";
  $("#categoryFilter").value = "";
  $("#directionFilter").value = "";
  $("#dateFilter").value = "";
  detailPage = 1;
  refreshOptions();
  renderAll();
}

function openDetail(id){
  const r = rows.find(x=>x.id===id);
  if(!r) return;

  const e = effective(r);

  $("#modalBody").innerHTML = `
    <div class="detail-grid">
      <div class="key">Date Time</div><div>${esc(r.dateTime)}</div>
      <div class="key">Bank / QRIS</div><div>${bankBadge(r)}</div>
      <div class="key">Category</div><div>${esc(r.category)}</div>
      <div class="key">Debit Asli</div><div>${money(r.debit)}</div>
      <div class="key">Credit Asli</div><div>${money(r.credit)}</div>
      <div class="key">Keluar Efektif</div><div class="out">${money(e.out)}</div>
      <div class="key">Masuk Efektif</div><div class="in">${money(e.in)}</div>
      <div class="key">Details</div><div class="detail-text">${esc(r.details)}</div>
    </div>
  `;

  $("#modal").classList.add("open");
}

function exportCSV(){
  const data = filtered();
  if(!data.length){
    setStatus("Tidak ada data untuk diexport","err");
    return;
  }

  const q = v => `"${String(v??"").replaceAll('"','""')}"`;
  const head = ["Date Time","Bank / QRIS","Uang Keluar Efektif","Uang Masuk Efektif","Category","Debit Asli","Credit Asli","Adjust","Details"];

  const csv = [
    head.map(q).join(","),
    ...data.map(r=>{
      const e = effective(r);
      return [r.dateTime,r.bank,e.out,e.in,r.category,r.debit,r.credit,e.adjusted?"YA":"TIDAK",r.details].map(q).join(",");
    })
  ].join("\n");

  const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "MegaNXS-V4.1-Rekap.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

function findMegaSheet(workbook){
  const required = ["date time","details","debit","credit","category"];

  for(const sheetName of workbook.SheetNames){
    const ws = workbook.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws,{
      header:1,
      raw:false,
      defval:"",
      blankrows:false,
      dateNF:"dd-mmm-yyyy hh:mm:ss"
    });

    const maxScan = Math.min(30,aoa.length);
    for(let i=0;i<maxScan;i++){
      const normalized = (aoa[i] || []).map(normalizeHeader);
      const ok = required.every(h=>normalized.includes(h));

      if(ok){
        const trimmed = aoa.slice(i);
        const tempSheet = XLSX.utils.aoa_to_sheet(trimmed);
        const tsv = XLSX.utils.sheet_to_csv(tempSheet,{
          FS:"\t",
          RS:"\n",
          blankrows:false
        });
        return {sheetName,tsv};
      }
    }
  }

  throw new Error("Header Date Time, Details, Debit, Credit, Category tidak ditemukan di file Excel.");
}

function readExcelFile(file){
  if(typeof XLSX === "undefined"){
    setStatus("Pembaca Excel belum termuat. Refresh halaman lalu coba lagi.","err");
    return;
  }

  setStatus(`Membaca ${file.name}...`,"info");

  const rd = new FileReader();

  rd.onload = ()=>{
    try{
      const workbook = XLSX.read(rd.result,{
        type:"array",
        cellDates:true,
        cellNF:true
      });

      const found = findMegaSheet(workbook);
      $("#rawInput").value = found.tsv;
      processData(`${file.name} · Sheet: ${found.sheetName}`);
      $("#fileInput").value = "";
    }catch(e){
      setStatus(`Excel gagal dibaca: ${e.message}`,"err");
    }
  };

  rd.onerror = ()=>setStatus("File Excel gagal dibaca.","err");
  rd.readAsArrayBuffer(file);
}

function readTextFile(file){
  setStatus(`Membaca ${file.name}...`,"info");

  const rd = new FileReader();
  rd.onload = ()=>{
    $("#rawInput").value = rd.result;
    processData(file.name);
    $("#fileInput").value = "";
  };
  rd.onerror = ()=>setStatus("File gagal dibaca.","err");
  rd.readAsText(file);
}

function readFile(file){
  if(!file) return;

  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if(["xlsx","xls"].includes(ext)){
    readExcelFile(file);
    return;
  }

  if(["csv","tsv","txt"].includes(ext)){
    readTextFile(file);
    return;
  }

  setStatus("Format belum didukung. Gunakan XLSX, XLS, CSV, TSV, atau TXT.","err");
}

$("#processBtn").onclick = ()=>processData();

$("#clearBtn").onclick = ()=>{
  if(!confirm("Bersihkan semua data rekap di browser ini?")) return;

  rows = [];
  selectedBank = "";
  $("#rawInput").value = "";
  localStorage.removeItem(STORAGE_KEY);
  OLD_STORAGE_KEYS.forEach(k=>localStorage.removeItem(k));
  $("#fileInput").value = "";
  resetFilter();
  setStatus("Data sudah dibersihkan","info");
};

$("#exportBtn").onclick = exportCSV;
$("#resetFilter").onclick = resetFilter;

["searchInput","categoryFilter","directionFilter","dateFilter"].forEach(id=>{
  $("#"+id).addEventListener(id==="searchInput" ? "input" : "change",()=>{
    detailPage = 1;
    renderAll();
  });
});

$("#prevPage").onclick = ()=>{
  if(detailPage > 1){
    detailPage--;
    renderAll();
  }
};

$("#nextPage").onclick = ()=>{
  const p = Math.ceil(filtered().length/pageSize);
  if(detailPage < p){
    detailPage++;
    renderAll();
  }
};

$$(".tab").forEach(t=>{
  t.onclick = ()=>{
    activeTab = t.dataset.tab;
    $$(".tab").forEach(x=>x.classList.toggle("active",x===t));
    $$(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+activeTab));
  };
});

$("#unknownBtn").onclick = ()=>{
  selectedBank = "BELUM TERBACA";
  detailPage = 1;
  refreshOptions();
  renderAll();
  $$(".tab").find(t=>t.dataset.tab==="detail").click();
};

$("#fileInput").onchange = e=>readFile(e.target.files[0]);

const dz = $("#dropzone");
["dragenter","dragover"].forEach(ev=>{
  dz.addEventListener(ev,e=>{
    e.preventDefault();
    dz.classList.add("drag");
  });
});
["dragleave","drop"].forEach(ev=>{
  dz.addEventListener(ev,e=>{
    e.preventDefault();
    dz.classList.remove("drag");
  });
});
dz.addEventListener("drop",e=>readFile(e.dataTransfer.files[0]));

$("#closeModal").onclick = ()=>$("#modal").classList.remove("open");
$("#modal").onclick = e=>{
  if(e.target === $("#modal")) $("#modal").classList.remove("open");
};

addEventListener("keydown",e=>{
  if(e.key === "Escape") $("#modal").classList.remove("open");
});

let saved = localStorage.getItem(STORAGE_KEY);
if(!saved){
  for(const oldKey of OLD_STORAGE_KEYS){
    const old = localStorage.getItem(oldKey);
    if(old){
      saved = old;
      localStorage.setItem(STORAGE_KEY,old);
      break;
    }
  }
}

if(saved){
  $("#rawInput").value = saved;
  try{
    rows = parseInput(saved);
    setStatus(`${rows.length} transaksi tersimpan`,"ok");
  }catch{}
}

refreshOptions();
renderAll();