/**
 * ====================================================================
 * VEHICLES MODULE (የመኪና ሞዴሎች ሞጁል)
 * Handles vehicle catalog fetching from Supabase, rendering, filtering,
 * image lightbox viewer, and state management.
 * ====================================================================
 */

// Fallback initial vehicles for instant testing/preview
const FALLBACK_VEHICLES = [
  {
    id: "v-001",
    model_name: "ኢትዮ ኢ-ጎልፍ ቪዥን 4S (Electric Sightseeing Golf Cart)",
    seats: 4,
    price_etb: 1850000,
    range_km: 120,
    motor_battery_capacity: "72V / 5.0 KW (Li-ion 105Ah)",
    max_speed: 45,
    description: "ዘመናዊ እና ለአካባቢ ተስማሚ የሆነ የ 4 መቀመጫ የኤሌክትሪክ ጎልፍ መኪና። የ 5 ዓመት ሙሉ ዋስትና ያለው የሊቲየም ባትሪ የተገጠመለት። ለሆቴሎች፣ ለሪዞርቶች፣ ለግቢ ውስጥ መጓጓዣ እና ለመዝናኛ ተስማሚ።",
    image_url: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: true
  },
  {
    id: "v-002",
    model_name: "ኢትዮ ኢ-ጎልፍ ቱሪስት 6S (Electric Sightseeing Golf Cart)",
    seats: 6,
    price_etb: 2450000,
    range_km: 110,
    motor_battery_capacity: "72V / 7.5 KW (Li-ion 150Ah)",
    max_speed: 40,
    description: "የ 6 መቀመጫ ባለከፍተኛ አቅም የኤሌክትሪክ ጎልፍ መኪና። ለቱሪስት ማመላለሻ፣ ለኤርፖርት፣ ለትላልቅ ፋብሪካዎችና ግቢዎች ተመራጭ። ከብክለት ነፃ እና እጅግ ወጪ ቆጣቢ።",
    image_url: "https://images.unsplash.com/photo-1535732820275-9ffd998cac22?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: true
  },
  {
    id: "v-003",
    model_name: "ኢትዮ ፕራይም ክሮስ ኤስዩቪ (Ethio Prime Cross EV SUV)",
    seats: 5,
    price_etb: 4900000,
    range_km: 510,
    motor_battery_capacity: "400V / 150 KW (66.5 kWh Li-ion)",
    max_speed: 165,
    description: "ምቹ እና ዘመናዊ ባለ 5 መቀመጫ የቤተሰብ እና የስራ ኤስዩቪ። ፈጣን ቻርጅንግ (Fast Charging) የሚደግፍ፣ በአንድ ቻርጅ 510 ኪሎሜትር የሚጓዝ።",
    image_url: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: true
  },
  {
    id: "v-004",
    model_name: "ኢትዮ ሲቲ ስማርት ኮምፓክት (Ethio City Smart EV)",
    seats: 4,
    price_etb: 2950000,
    range_km: 305,
    motor_battery_capacity: "320V / 55 KW (38.8 kWh Li-ion)",
    max_speed: 130,
    description: "ለከተማ ትራፊክ ፍቱን የሆነ፣ የመኪና ማቆሚያ የማያስቸግር፣ እጅግ ኢኮኖሚያዊ እና ዘመናዊ ባለ 4 መቀመጫ የከተማ መኪና።",
    image_url: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: false
  },
  {
    id: "v-005",
    model_name: "ኢትዮ ኤክስኪዩቲቭ ሴዳን (Ethio Executive Luxury EV)",
    seats: 5,
    price_etb: 6200000,
    range_km: 605,
    motor_battery_capacity: "450V / 200 KW (82 kWh Li-ion)",
    max_speed: 190,
    description: "ከፍተኛ ምቾትና ደህንነት የተላበሰ የኤሌክትሪክ ሴዳን። ለድርጅት መሪዎች እና ለረጅም ጉዞ የተሰራ፣ የላቀ የመንዳት ልምድ የሚያጎናጽፍ።",
    image_url: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: true
  },
  {
    id: "v-006",
    model_name: "ኢትዮ ካርጎ ኢ-ቫን (Ethio Cargo Commercial EV)",
    seats: 2,
    price_etb: 3600000,
    range_km: 280,
    motor_battery_capacity: "380V / 70 KW (50.2 kWh Li-ion)",
    max_speed: 110,
    description: "ለዕቃ ማመላለሻ፣ ለሽያጭና ለከተማ ውስጥ ስርጭት የተዘጋጀ ከፍተኛ የመጫን አቅም ያለው የኤሌክትሪክ ቫን። የነዳጅ ወጪን 100% ያስቀራል።",
    image_url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=900&q=80",
    available: true,
    featured: false
  }
];

let allVehicles = [];
let filteredVehicles = [];
let vehiclesRealtimeChannel = null;

// Format ETB currency nicely
function formatPriceETB(amount) {
  if (!amount) return "0 ብር";
  return Number(amount).toLocaleString('en-US') + " ብር";
}

// Fetch vehicles from Supabase
async function loadVehicles() {
  const container = document.getElementById("vehicle-grid-container");
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
      <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #ecfdf5; border-top-color: #059669; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 1rem; color: #64748b; font-weight: 600;">የመኪና ሞዴሎች በመጫን ላይ ናቸው...</p>
    </div>
  `;

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("vehicles")
        .select("*")
        .eq("available", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase load vehicles error:", error);
        allVehicles = FALLBACK_VEHICLES;
      } else if (data && data.length > 0) {
        allVehicles = data;
      } else {
        // Table is empty in Supabase, use initial catalogue
        allVehicles = FALLBACK_VEHICLES;
      }
    } else {
      allVehicles = FALLBACK_VEHICLES;
    }
  } catch (err) {
    console.error("Failed to load vehicles from Supabase:", err);
    allVehicles = FALLBACK_VEHICLES;
  }

  filteredVehicles = [...allVehicles];
  renderVehicles(filteredVehicles);
}

function subscribeToVehiclesRealtime() {
  if (!window.supabaseClient || vehiclesRealtimeChannel) return;

  vehiclesRealtimeChannel = window.supabaseClient
    .channel("public-vehicles-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "vehicles" },
      () => loadVehicles(),
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Vehicle realtime subscription failed");
      }
    });
}

// Render vehicle cards into grid
function renderVehicles(vehicles) {
  const container = document.getElementById("vehicle-grid-container");
  if (!container) return;

  if (!vehicles || vehicles.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: #ffffff; border-radius: 16px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;">🚘</div>
        <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">ምንም መኪና አልተገኘም</h3>
        <p style="color: #64748b; font-size: 0.95rem;">የፈለጉትን ቃል ወይም ማጣሪያ ቀይረው እንደገና ይሞክሩ።</p>
      </div>
    `;
    return;
  }

  let html = "";
  vehicles.forEach((vehicle) => {
    const isAvailable = vehicle.available !== false;
    const availabilityBadge = isAvailable
      ? `<span class="availability-tag available">✓ በክምችት አለ</span>`
      : `<span class="availability-tag unavailable">✕ በአሁን ሰዓት አልቋል</span>`;

    const imgUrl = vehicle.image_url || "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80";

    html += `
      <article class="vehicle-card" id="vehicle-card-${vehicle.id}">
        <div class="vehicle-img-wrapper" onclick="openLightbox('${imgUrl}', '${escapeHtml(vehicle.model_name)}')">
          <img src="${imgUrl}" alt="${escapeHtml(vehicle.model_name)}" class="vehicle-img" loading="lazy" />
          ${availabilityBadge}
          <div class="img-zoom-hint">🔍 ለማሳደግ ይጫኑ</div>
        </div>

        <div class="vehicle-body">
          <div class="vehicle-header-row">
            <h3 class="vehicle-title">${escapeHtml(vehicle.model_name)}</h3>
            <div class="vehicle-price-box">
              <span class="price-label">ዋጋ</span>
              <div class="price-amount">${formatPriceETB(vehicle.price_etb)}</div>
            </div>
          </div>

          ${vehicle.description ? `<p class="vehicle-desc">${escapeHtml(vehicle.description)}</p>` : ""}

          <!-- Specifications Grid -->
          <div class="vehicle-specs-grid">
            <div class="spec-item">
              <span class="spec-title">የመቀመጫ ብዛት</span>
              <span class="spec-value">💺 ${vehicle.seats} ሰው</span>
            </div>
            <div class="spec-item">
              <span class="spec-title">የጉዞ ርቀት በአንድ ቻርጅ</span>
              <span class="spec-value">⚡ ${vehicle.range_km} ኪ.ሜ</span>
            </div>
            <div class="spec-item">
              <span class="spec-title">የሞተር እና ባትሪ አቅም</span>
              <span class="spec-value">🔋 ${escapeHtml(vehicle.motor_battery_capacity || "Li-ion")}</span>
            </div>
            <div class="spec-item">
              <span class="spec-title">ከፍተኛ ፍጥነት</span>
              <span class="spec-value">⏱️ ${vehicle.max_speed} ኪ.ሜ/ሰ</span>
            </div>
          </div>

          <div class="vehicle-card-footer">
            <button 
              type="button" 
              class="btn btn-buy" 
              id="buy-btn-${vehicle.id}" 
              onclick="openPurchaseModal('${vehicle.id}')"
              ${!isAvailable ? "disabled style='opacity:0.6; cursor:not-allowed;'" : ""}
            >
              ግዛ
            </button>
          </div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;
}

// Search and filtering logic
function filterVehicles() {
  const searchInput = document.getElementById("vehicle-search-input");
  const seatsFilter = document.getElementById("vehicle-seats-filter");
  const sortFilter = document.getElementById("vehicle-sort-filter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const seatsVal = seatsFilter ? seatsFilter.value : "all";
  const sortVal = sortFilter ? sortFilter.value : "default";

  filteredVehicles = allVehicles.filter((v) => {
    // Search by model name or description
    const matchesQuery =
      !query ||
      (v.model_name && v.model_name.toLowerCase().includes(query)) ||
      (v.description && v.description.toLowerCase().includes(query));

    // Seats filter
    let matchesSeats = true;
    if (seatsVal === "2") matchesSeats = v.seats === 2;
    else if (seatsVal === "4") matchesSeats = v.seats === 4;
    else if (seatsVal === "5") matchesSeats = v.seats === 5;
    else if (seatsVal === "6") matchesSeats = v.seats >= 6;

    return matchesQuery && matchesSeats;
  });

  // Sorting
  if (sortVal === "price-low") {
    filteredVehicles.sort((a, b) => Number(a.price_etb) - Number(b.price_etb));
  } else if (sortVal === "price-high") {
    filteredVehicles.sort((a, b) => Number(b.price_etb) - Number(a.price_etb));
  } else if (sortVal === "range-high") {
    filteredVehicles.sort((a, b) => Number(b.range_km) - Number(a.range_km));
  }

  renderVehicles(filteredVehicles);
}

// Lightbox image viewer
function openLightbox(imageUrl, title) {
  const modal = document.getElementById("lightbox-modal");
  const imgEl = document.getElementById("lightbox-image");
  const capEl = document.getElementById("lightbox-caption");

  if (!modal || !imgEl) return;

  imgEl.src = imageUrl;
  imgEl.alt = title;
  if (capEl) capEl.textContent = title;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const modal = document.getElementById("lightbox-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Helper: Escape HTML strings
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Expose functions globally
window.loadVehicles = loadVehicles;
window.filterVehicles = filterVehicles;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.formatPriceETB = formatPriceETB;
window.getAllVehicles = () => allVehicles;
window.subscribeToVehiclesRealtime = subscribeToVehiclesRealtime;
