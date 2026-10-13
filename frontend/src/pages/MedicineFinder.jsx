import { useState } from "react";
import api from "../services/api";
import {
  ArrowLeft, AlertTriangle, Clock3, Info, MapPin, Navigation, Phone,
  Pill, Search, ShieldCheck, ShoppingCart, Sparkles, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const emptyMedicine = (name) => ({
  name, generic_name: null, uses: null, dosage_information: null,
  side_effects: null, precautions: null, food_interactions: null,
});

function MedicineFinder() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [medicineInfoAvailable, setMedicineInfoAvailable] = useState(false);
  const [products, setProducts] = useState([]);
  const [detailedProducts, setDetailedProducts] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [city, setCity] = useState("Davanagere");
  const [pincode, setPincode] = useState("");
  const [provider, setProvider] = useState("");
  const [availabilityScope, setAvailabilityScope] = useState("");
  const [liveAvailability, setLiveAvailability] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState("");

  const resetResults = () => {
    setSelectedMedicine(null); setMedicineInfoAvailable(false); setProducts([]); setDetailedProducts([]);
    setPharmacies([]); setProvider(""); setAvailabilityScope("");
    setLiveAvailability(false); setError(""); setPharmacyError("");
  };

  const loadPharmacies = async (medicineName) => {
    setPharmacyLoading(true); setPharmacyError("");
    try {
      const response = await api.get("/pharmacy/locations", {
        params: {
          city: city.trim() || "Davanagere",
          ...(pincode.trim() ? { pincode: pincode.trim() } : {}),
          ...(medicineName ? { medicine: medicineName } : {}),
        },
      });
      setPharmacies(Array.isArray(response.data?.pharmacies) ? response.data.pharmacies : []);
      if (response.data?.source_note && !(response.data?.pharmacies || []).length) {
        setPharmacyError(response.data.source_note);
      }
    } catch (err) {
      console.error("Pharmacy location request failed:", err?.message || err);
      setPharmacies([]);
      setPharmacyError("Pharmacy locations could not be loaded. Check your connection and try again.");
    } finally { setPharmacyLoading(false); }
  };

  const searchMedicine = async (medicineName) => {
    const name = String(medicineName || "").trim();
    if (!name || loading) return;
    setSearch(name); resetResults(); setLoading(true);
    try {
      const response = await api.get("/pharmacy/search", {
        params: {
          medicine: name,
          city: city.trim() || "Davanagere",
          ...(pincode.trim() ? { pincode: pincode.trim() } : {}),
        },
      });
      const data = response.data || {};
      setSelectedMedicine(data.medicine || emptyMedicine(name));
      setMedicineInfoAvailable(Boolean(data.medicine));
      const returnedProducts = Array.isArray(data.products) ? data.products : [];
      setProducts(returnedProducts);
      setDetailedProducts(Array.isArray(data.detailed_products) ? data.detailed_products : []);
      setProvider(data.provider || "");
      setAvailabilityScope(data.availability_scope || "");
      // Do not treat a response flag alone as proof of live results.
      setLiveAvailability(Boolean(data.live_availability) && returnedProducts.length > 0);
      if (data.error) setError(String(data.error));
      else if (!returnedProducts.length) {
        setError(data.availability_status === "provider_unconfigured_or_no_results"
          ? "Online product results are unavailable. The provider may not be configured, may have no matching listings, or may be temporarily unavailable. No live price or stock is being assumed."
          : "No online product listings were returned for this search. Medicine information and pharmacy locations may still be available.");
      }
    } catch (err) {
      console.error("Medicine search request failed:", err?.message || err);
      setSelectedMedicine(emptyMedicine(name));
      setMedicineInfoAvailable(false); setProducts([]); setDetailedProducts([]); setLiveAvailability(false);
      setError("The medicine service could not be reached. No live prices or stock status can be shown right now.");
    } finally {
      setLoading(false);
      // Separate directory request; a failure here must not erase medicine results.
      await loadPharmacies(name);
    }
  };

  const handleSearch = (event) => { event.preventDefault(); searchMedicine(search); };
  const clearSearch = () => { resetResults(); setSearch(""); };
  const productName = (product) => String(product?.name || "Medicine")
    .replace(/\s+\d+['’]s$/i, "")
    .replace(/\s+\d+\s*(tablet|tablets|capsule|capsules)$/i, "");
  const productUrl = (product) => {
    if (product?.product_url && /^https?:\/\//i.test(product.product_url)) return product.product_url;
    if (!product?.url_key) return null;
    if (/^https?:\/\//i.test(product.url_key)) return product.url_key;
    return `https://www.apollopharmacy.in/otc/${String(product.url_key).replace(/^\/+/, "")}`;
  };
  const mapsUrl = (pharmacy) => {
    if (pharmacy?.map_url && /^https?:\/\//i.test(pharmacy.map_url)) return pharmacy.map_url;
    const query = [pharmacy?.name, pharmacy?.address, city, pincode].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || `pharmacies in ${city}`)}`;
  };
  const onlineProducts = liveAvailability ? products : [];
  const bestProduct = onlineProducts.find((p) => ["in-stock", "available"].includes(String(p?.status || "").toLowerCase().replace(/_/g, "-")));
  const productDetails = (product) => {
    const productSku = String(product?.sku || product?.id || "");
    const matched = detailedProducts.find((item) => {
      const itemSku = String(item?.sku || item?.details?.sku || "");
      return productSku && itemSku && productSku === itemSku;
    });
    return matched?.details || matched || {};
  };
  const displayValue = (value) => value === null || value === undefined || value === "" ? null : value;
  const detailRows = (product, details) => {
    const rows = [
      ["SKU / Product code", details.sku || product.sku],
      ["Manufacturer", details.manufacturer || details.manufacturer_name || product.manufacturer],
      ["Manufacturing date", details.manufacturing_date || details.manufacture_date || details.manufactured_date || product.manufacturing_date],
      ["Expiry date", details.expiry_date || details.expiryDate || product.expiry_date || product.expiryDate],
      ["Batch number", details.batch_number || details.batchNumber || product.batch_number],
      ["Composition", details.composition || details.ingredients || product.composition],
      ["Pack size", details.pack_info || details.pack_size || details.unit_size || product.unit_size],
      ["Quantity", details.quantity],
      ["MRP", details.mrp != null ? `₹${details.mrp}` : null],
      ["Selling price", details.price != null ? `₹${details.price}` : (product.special_price ?? product.price) != null ? `₹${product.special_price ?? product.price}` : null],
      ["Discount", details.discount != null ? (String(details.discount).includes("%") ? details.discount : `${details.discount}%`) : details.discount_percentage != null ? `${details.discount_percentage}%` : null],
      ["Unit price", details.unit_price != null ? `₹${details.unit_price}` : null],
      ["Recent purchases", details.recent_purchases != null ? details.recent_purchases : null],
    ];
    return rows.filter(([, value]) => displayValue(value) !== null);
  };

  return (
    <div className="min-h-screen bg-[#f4fbfa]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/dashboard")} aria-label="Back to dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-cyan-50 hover:text-cyan-600"><ArrowLeft size={20} /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 text-2xl shadow-lg shadow-cyan-100">💊</div>
            <div><h1 className="font-bold text-slate-800">Medicine Finder</h1><p className="hidden text-xs text-slate-400 sm:block">Medicine information and pharmacy assistance</p></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 sm:flex"><ShieldCheck size={17} /> Health information</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 p-7 text-white shadow-xl shadow-cyan-100 sm:p-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" /><div className="absolute -bottom-24 right-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative z-10 max-w-2xl"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl">🔎</div><h2 className="text-3xl font-bold sm:text-4xl">Find your medicine</h2><p className="mt-3 text-sm leading-6 text-cyan-50 sm:text-base">Look up medicine information, check online product listings when the provider is available, and find pharmacy locations. Location listings do not confirm medicine stock.</p></div>
        </section>

        <section className="mt-7 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="medicine-city" className="mb-2 block text-sm font-semibold text-slate-700">City</label><input id="medicine-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city, e.g. Davanagere" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" /></div>
            <div><label htmlFor="medicine-pincode" className="mb-2 block text-sm font-semibold text-slate-700">Pincode (optional)</label><input id="medicine-pincode" inputMode="numeric" maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" /></div>
          </div>
          <label htmlFor="medicine-search" className="mb-3 block text-sm font-semibold text-slate-700">What medicine are you looking for?</label>
          <form onSubmit={handleSearch}><div className="relative"><Search size={21} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input id="medicine-search" type="text" value={search} onChange={(e) => { setSearch(e.target.value); resetResults(); }} placeholder="Example: Paracetamol" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-28 text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" /><button type="submit" disabled={loading || !search.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Searching…" : "Search"}</button></div></form>
          {!search && <div className="mt-4 flex flex-wrap gap-2">{["Paracetamol", "Metformin", "Amlodipine", "Vitamin D3"].map((m) => <button key={m} type="button" onClick={() => searchMedicine(m)} disabled={loading} className="rounded-full bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-50">{m}</button>)}</div>}
        </section>

        {loading && <div className="mt-6 rounded-3xl border border-cyan-100 bg-cyan-50 p-6 text-center"><div className="text-3xl">🔎</div><p className="mt-3 font-semibold text-cyan-800">Searching medicine information…</p><p className="mt-1 text-sm text-cyan-600">Checking the medicine database and online provider.</p></div>}

        {selectedMedicine && !loading && <section className="mt-6">
          <div className="mb-5 flex items-center justify-between"><button type="button" onClick={clearSearch} className="flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700"><ArrowLeft size={17} /> Search another medicine</button><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:block">{medicineInfoAvailable ? "Medicine information found" : "Medicine information unavailable"}</span></div>
          <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-cyan-50 to-emerald-50 p-7 sm:p-8"><div className="flex items-center gap-5"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white text-4xl shadow-sm">💊</div><div><p className="text-sm font-semibold text-cyan-600">Medicine Information</p><h2 className="mt-1 text-3xl font-bold text-slate-800">{selectedMedicine.name || search}</h2>{selectedMedicine.generic_name && <p className="mt-1 text-slate-500">{selectedMedicine.generic_name}</p>}</div></div></div>
            <div className="grid gap-5 p-6 sm:p-8 md:grid-cols-2"><InfoCard icon={<Info size={21} />} title="Uses" content={selectedMedicine.uses} iconClass="bg-cyan-50 text-cyan-600" /><InfoCard icon={<Clock3 size={21} />} title="Dosage information" content={selectedMedicine.dosage_information} iconClass="bg-violet-50 text-violet-600" /><InfoCard icon={<AlertTriangle size={21} />} title="Side effects" content={selectedMedicine.side_effects} iconClass="bg-amber-50 text-amber-600" /><InfoCard icon={<ShieldCheck size={21} />} title="Precautions" content={selectedMedicine.precautions} iconClass="bg-rose-50 text-rose-500" /><div className="rounded-3xl bg-emerald-50 p-5 md:col-span-2"><h3 className="font-bold text-slate-800">🥗 Food interactions</h3><p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{selectedMedicine.food_interactions || "Information is currently unavailable."}</p></div></div>

            <div className="border-t border-slate-100 p-6 sm:p-8"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600"><ShoppingCart size={24} /></div><div><h3 className="text-xl font-bold text-slate-800">Online product listings</h3><p className="mt-2 text-sm leading-6 text-slate-600">Prices and availability appear here only when the configured provider returns product records. A product listing does not confirm stock at a local branch.</p></div></div>
              {error && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="flex gap-3"><Info size={19} className="mt-0.5 shrink-0 text-amber-600" /><p className="text-sm leading-6 text-amber-800">{error}</p></div></div>}
              {liveAvailability && onlineProducts.length > 0 && (
                <div className="mt-6">
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-emerald-600">Provider results received</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-800">{provider || "Online pharmacy results"}</h3>
                    {availabilityScope && <p className="mt-1 text-sm text-slate-500">{availabilityScope}</p>}
                  </div>
                  <div className="grid gap-6">
                    {onlineProducts.map((p, i) => {
                      const status = String(p?.status || "").toLowerCase().replace(/_/g, "-");
                      const inStock = status === "in-stock" || status === "available";
                      const price = p?.special_price ?? p?.price;
                      const url = productUrl(p);
                      const details = productDetails(p);
                      const rows = detailRows(p, details);
                      return (
                        <article key={p.id ?? p.sku ?? i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md sm:p-6">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><Pill size={22} /></div>
                              <div className="min-w-0">
                                <h4 className="text-lg font-bold text-slate-800">{productName(p)}</h4>
                                <p className={`mt-2 text-sm font-semibold ${inStock ? "text-emerald-700" : "text-slate-500"}`}>{inStock ? "Provider reports available" : "Availability not confirmed"}</p>
                                {p.unit_size && <p className="mt-1 text-sm text-slate-500">Pack: {p.unit_size}</p>}
                              </div>
                            </div>
                            <div className="rounded-xl bg-emerald-50 px-4 py-3 sm:min-w-36 sm:text-right">
                              <p className="text-xs text-emerald-700">Provider-reported price</p>
                              <p className="mt-1 text-xl font-bold text-emerald-800">{price != null ? `₹${price}` : "Price not provided"}</p>
                            </div>
                          </div>
                          {rows.length > 0 && (
                            <div className="mt-6 border-t border-slate-100 pt-5">
                              <h5 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Info size={16} className="text-cyan-600" /> Product and batch details</h5>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {rows.map(([label, value]) => <div key={label} className="min-h-[68px] rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-semibold text-slate-800">{String(value)}</p></div>)}
                              </div>
                            </div>
                          )}
                          {url && (
                            <div className="mt-6 border-t border-slate-100 pt-5">
                              <p className="mb-3 text-sm leading-6 text-slate-500">Ready to order? Open the product on Apollo Pharmacy to review the final price, delivery availability and complete checkout there.</p>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:w-auto"><ShoppingCart size={18} /> Order on Apollo Pharmacy <ExternalLink size={15} /></a>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <p className="mt-5 text-xs leading-5 text-slate-500">Product and batch fields are displayed only when returned by the provider. Missing expiry or manufacturing dates are not estimated. Prices and availability can change; verify the medicine strength, formulation, pack size and seller before ordering.</p>
                </div>
              )}
              {!liveAvailability && !error && <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">No live product listings were returned. Elder Sense will not estimate or invent prices or stock status.</div>}
            </div>

            <div className="border-t border-slate-100 bg-gradient-to-br from-emerald-50 to-cyan-50 p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Navigation size={21} className="text-emerald-600" /><h3 className="text-2xl font-bold text-slate-800">Pharmacies in {city.trim() || "your city"} 📍</h3></div><p className="mt-2 text-sm leading-6 text-slate-600">Directory listings provide locations only. Call the pharmacy to confirm medicine stock and price.</p></div><div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm"><span className="text-2xl">🏥</span><div><p className="text-2xl font-bold text-slate-800">{pharmacies.length}</p><p className="text-xs text-slate-500">locations found</p></div></div></div>
              {pharmacyLoading && <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-cyan-700">Searching pharmacy locations…</p>}
              {!pharmacyLoading && pharmacyError && <p className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">{pharmacyError}</p>}
              {!pharmacyLoading && pharmacies.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2">{pharmacies.map((ph, i) => <div key={ph.id ?? `${ph.name}-${i}`} className="rounded-3xl border border-white bg-white p-6 shadow-sm"><div className="flex gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">🏥</div><div className="min-w-0 flex-1"><h4 className="text-lg font-bold text-slate-800">{ph.name || "Pharmacy"}</h4><div className="mt-3 flex items-start gap-2"><MapPin size={18} className="mt-0.5 shrink-0 text-cyan-600" /><p className="text-sm leading-6 text-slate-600">{ph.address || "Address unavailable"}</p></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medicine stock</p><p className="mt-1 text-sm font-semibold text-slate-700">{ph.stock_status === "in_stock" ? `Inventory record reports ${ph.quantity ?? "unknown quantity"} unit(s)${ph.price != null ? ` · ₹${ph.price}` : ""}` : ph.stock_status === "out_of_stock" ? "Inventory record reports out of stock" : "Not verified by this location directory"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{ph.stock_note || "Call the pharmacy to verify current stock and price."}</p></div><div className="mt-4 flex flex-wrap gap-2">{ph.phone && <a href={`tel:${ph.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"><Phone size={16} /> Call</a>}<a href={mapsUrl(ph)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600"><Navigation size={16} /> Directions <ExternalLink size={14} /></a></div></div></div></div>)}</div>}
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="flex gap-3"><Info size={18} className="mt-0.5 shrink-0 text-amber-600" /><p className="text-xs leading-5 text-amber-700"><strong className="text-amber-800">Important:</strong> A pharmacy location does not prove that a particular medicine is available there. Contact the pharmacy before visiting.</p></div></div>
            </div>
            <div className="m-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:mx-8"><div className="flex gap-3"><span className="text-xl">⚠️</span><div><p className="font-semibold text-amber-800">Health information disclaimer</p><p className="mt-1 text-xs leading-5 text-amber-700">For educational purposes only. Do not start, stop or change medication based solely on this page. Follow your prescription and consult a qualified healthcare professional.</p></div></div></div>
          </div>
        </section>}

        {!search && !selectedMedicine && !loading && <section className="mt-7 grid gap-5 md:grid-cols-3"><FeatureCard icon="💊" title="Medicine information" text="Review available uses, side effects, precautions and food interactions." /><FeatureCard icon="🏥" title="Find pharmacies" text={`Explore pharmacy locations, phone numbers and directions in ${city.trim() || "your city"}.`} /><FeatureCard icon="🛒" title="Online product listings" text="See provider-returned prices and availability when a live pharmacy integration is available." /></section>}
        <div className="mt-7 flex items-start gap-3 rounded-3xl border border-violet-100 bg-violet-50 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm"><Sparkles size={19} /></div><div><p className="font-semibold text-violet-900">Need help understanding your medicine? 🤖</p><p className="mt-1 text-sm leading-6 text-violet-700">Elder Sense AI Assistant can explain general health information in simple language. Confirm medication decisions with a qualified healthcare professional.</p></div></div>
      </main>
    </div>
  );
}

function InfoCard({ icon, title, content, iconClass }) {
  return <div className="rounded-3xl bg-slate-50 p-5"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClass}`}>{icon}</div><h3 className="font-bold text-slate-800">{title}</h3></div><p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{content || "Information is currently unavailable."}</p></div>;
}
function FeatureCard({ icon, title, text }) {
  return <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="text-3xl">{icon}</div><h3 className="mt-5 font-bold text-slate-800">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>;
}
export default MedicineFinder;
