/**
 * ====================================================================
 * ADMIN PORTAL JAVASCRIPT (የአስተዳዳሪ ሞጁል)
 * Handles Supabase Authentication, Dashboard Statistics, Vehicle CRUD,
 * Purchase Applications inspection with signed URLs, and CBE Settings.
 * ====================================================================
 */

let currentAdminUser = null;
let adminVehiclesList = [];
let adminApplicationsList = [];
let adminRealtimeChannel = null;

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuthState();
});

// 1. Check Authentication State
async function checkAdminAuthState() {
  const loginScreen = document.getElementById("admin-login-screen");
  const dashboardLayout = document.getElementById("admin-dashboard-layout");
  const userEmailSpan = document.getElementById("admin-user-email");

  if (window.isSupabaseConfigured() && window.supabaseClient) {
    try {
      const { data: { session }, error } = await window.supabaseClient.auth.getSession();
      
      if (session && session.user) {
        currentAdminUser = session.user;
        if (loginScreen) loginScreen.style.display = "none";
        if (dashboardLayout) dashboardLayout.style.display = "flex";
        if (userEmailSpan) userEmailSpan.textContent = currentAdminUser.email || "አስተዳዳሪ";

        // Listen for auth changes
        window.supabaseClient.auth.onAuthStateChange((event, newSession) => {
          if (!newSession) {
            currentAdminUser = null;
            if (loginScreen) loginScreen.style.display = "flex";
            if (dashboardLayout) dashboardLayout.style.display = "none";
          }
        });

        // Load initial dashboard data
        loadAdminOverview();
        loadAdminVehicles();
        loadAdminApplications();
        loadAdminPaymentSettings();
        loadAdminGeneralSettings();
        subscribeToAdminRealtime();
        return;
      }
    } catch (err) {
      console.error("Auth session check error:", err);
    }
  }

  // Not authenticated or Supabase not yet configured
  if (loginScreen) loginScreen.style.display = "flex";
  if (dashboardLayout) dashboardLayout.style.display = "none";
}

function subscribeToAdminRealtime() {
  if (!window.supabaseClient || adminRealtimeChannel) return;

  adminRealtimeChannel = window.supabaseClient
    .channel("admin-dashboard-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "vehicles" },
      () => {
        loadAdminVehicles();
        loadAdminOverview();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchase_applications" },
      () => {
        loadAdminApplications();
        loadAdminOverview();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => {
        loadAdminPaymentSettings();
        loadAdminGeneralSettings();
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Admin realtime subscription failed");
      }
    });
}

// 2. Admin Login
async function handleAdminLogin(event) {
  event.preventDefault();
  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-password");
  const submitBtn = document.getElementById("login-submit-btn");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passInput ? passInput.value : "";

  if (!email || !password) {
    showAdminToast("እባክዎ ኢሜይል እና የይለፍ ቃል ያስገቡ", "error");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>በመግባት ላይ...</span>";
  }

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error("Supabase login error:", error);
        showAdminToast("የተሳሳተ ኢሜይል ወይም የይለፍ ቃል። እባክዎ እንደገና ይሞክሩ።", "error");
        return;
      }

      showAdminToast("እንኳን ደህና መጡ! በተሳካ ሁኔታ ገብተዋል።", "success");
      currentAdminUser = data.user;
      checkAdminAuthState();
    } else {
      // Demo fallback mode when Supabase is not configured yet
      showAdminToast("ማሳሰቢያ፦ Supabase እስኪዋቀር በሙከራ ሁነታ (Demo mode) ገብተዋል።", "info");
      currentAdminUser = { email: email };
      const loginScreen = document.getElementById("admin-login-screen");
      const dashboardLayout = document.getElementById("admin-dashboard-layout");
      if (loginScreen) loginScreen.style.display = "none";
      if (dashboardLayout) dashboardLayout.style.display = "flex";
      const userEmailSpan = document.getElementById("admin-user-email");
      if (userEmailSpan) userEmailSpan.textContent = email;

      loadAdminOverview();
      loadAdminVehicles();
      loadAdminApplications();
      loadAdminPaymentSettings();
      loadAdminGeneralSettings();
    }
  } catch (err) {
    console.error("Login process error:", err);
    showAdminToast("አንድ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "<span>ግባ</span>";
    }
  }
}

// 3. Admin Logout
async function handleAdminLogout() {
  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      await window.supabaseClient.auth.signOut();
    }
  } catch (err) {
    console.warn("Logout error:", err);
  }

  currentAdminUser = null;
  const loginScreen = document.getElementById("admin-login-screen");
  const dashboardLayout = document.getElementById("admin-dashboard-layout");
  if (loginScreen) loginScreen.style.display = "flex";
  if (dashboardLayout) dashboardLayout.style.display = "none";
  showAdminToast("በተሳካ ሁኔታ ወጥተዋል።", "info");
}

// 4. Tab Switching
function switchAdminTab(tabName) {
  const sections = document.querySelectorAll(".admin-tab-section");
  sections.forEach((sec) => (sec.style.display = "none"));

  const menuItems = document.querySelectorAll(".admin-menu-item");
  menuItems.forEach((item) => item.classList.remove("active"));

  const targetSection = document.getElementById(`tab-${tabName}`);
  const targetMenu = document.getElementById(`menu-${tabName}`);
  const headerTitle = document.getElementById("admin-header-title");

  if (targetSection) targetSection.style.display = "block";
  if (targetMenu) targetMenu.classList.add("active");

  const titles = {
    overview: "ዳሽቦርድ",
    vehicles: "የመኪና ሞዴሎች አስተዳደር",
    applications: "የግዢ ማመልከቻዎች አስተዳደር",
    payment: "የክፍያ ሂሳብ መረጃ ቅንብር",
    settings: "የድር ጣቢያ ቅንብሮች"
  };

  if (headerTitle && titles[tabName]) {
    headerTitle.textContent = titles[tabName];
  }
}

// 5. Load Overview & Statistics
async function loadAdminOverview() {
  let totalVehicles = 0;
  let availableModels = 0;
  let pendingApps = 0;
  let approvedApps = 0;

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      // Vehicles count
      const { data: vData } = await window.supabaseClient.from("vehicles").select("id, available");
      if (vData) {
        totalVehicles = vData.length;
        availableModels = vData.filter((v) => v.available).length;
      }

      // Applications count
      const { data: aData } = await window.supabaseClient.from("purchase_applications").select("id, status");
      if (aData) {
        pendingApps = aData.filter((a) => a.status === "pending").length;
        approvedApps = aData.filter((a) => a.status === "approved").length;
      }
    } else {
      totalVehicles = 6;
      availableModels = 6;
      pendingApps = 1;
      approvedApps = 2;
    }
  } catch (err) {
    console.error("Overview fetch error:", err);
  }

  const statTot = document.getElementById("stat-total-vehicles");
  const statPend = document.getElementById("stat-pending-apps");
  const statAppr = document.getElementById("stat-approved-apps");
  const statAvail = document.getElementById("stat-available-models");

  if (statTot) statTot.textContent = totalVehicles;
  if (statPend) statPend.textContent = pendingApps;
  if (statAppr) statAppr.textContent = approvedApps;
  if (statAvail) statAvail.textContent = availableModels;
}

// 6. Vehicles Management (CRUD)
async function loadAdminVehicles() {
  const tbody = document.getElementById("admin-vehicles-tbody");
  if (!tbody) return;

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        adminVehiclesList = data;
      }
    } else {
      // Demo seed vehicles if Supabase is not configured yet
      adminVehiclesList = [
        {
          id: "v-001",
          model_name: "ኢትዮ ኢ-ጎልፍ ቪዥን 4S (Electric Sightseeing Golf Cart)",
          seats: 4,
          price_etb: 1850000,
          range_km: 120,
          motor_battery_capacity: "72V / 5.0 KW",
          max_speed: 45,
          image_url: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=400&q=80",
          available: true
        },
        {
          id: "v-002",
          model_name: "ኢትዮ ኢ-ጎልፍ ቱሪስት 6S (Electric Sightseeing Golf Cart)",
          seats: 6,
          price_etb: 2450000,
          range_km: 110,
          motor_battery_capacity: "72V / 7.5 KW",
          max_speed: 40,
          image_url: "https://images.unsplash.com/photo-1535732820275-9ffd998cac22?auto=format&fit=crop&w=400&q=80",
          available: true
        }
      ];
    }
  } catch (err) {
    console.error("Load admin vehicles error:", err);
  }

  if (adminVehiclesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">ምንም መኪና አልተመዘገበም። 'አዲስ መኪና ጨምር' የሚለውን ይጫኑ።</td></tr>`;
    return;
  }

  let rows = "";
  adminVehiclesList.forEach((v) => {
    const isAvail = v.available !== false;
    const img = v.image_url || "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=150&q=80";

    rows += `
      <tr>
        <td><img src="${img}" style="width:60px; height:40px; object-fit:cover; border-radius:6px;" alt="${escapeAdminHtml(v.model_name)}" /></td>
        <td><strong>${escapeAdminHtml(v.model_name)}</strong></td>
        <td>${v.seats} ሰው</td>
        <td><strong>${Number(v.price_etb).toLocaleString()} ብር</strong></td>
        <td>${v.range_km} ኪ.ሜ</td>
        <td>
          <span class="status-badge ${isAvail ? "status-approved" : "status-rejected"}">
            ${isAvail ? "በክምችት አለ" : "የለም"}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openVehicleModal('${v.id}')">✏️ አርትዕ</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="deleteVehicle('${v.id}')" style="color:#dc2626;">🗑️ ሰርዝ</button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rows;
}

function openVehicleModal(editId = null) {
  const modal = document.getElementById("admin-vehicle-modal");
  const title = document.getElementById("vehicle-modal-title");
  const form = document.getElementById("admin-vehicle-form");
  const editIdInput = document.getElementById("veh-edit-id");

  if (!modal || !form) return;
  form.reset();

  if (editId) {
    const item = adminVehiclesList.find((v) => String(v.id) === String(editId));
    if (item) {
      if (title) title.textContent = "የመኪና መረጃ አርትዕ";
      if (editIdInput) editIdInput.value = item.id;
      document.getElementById("veh-model-name").value = item.model_name || "";
      document.getElementById("veh-seats").value = item.seats || 4;
      document.getElementById("veh-price").value = item.price_etb || "";
      document.getElementById("veh-range").value = item.range_km || "";
      document.getElementById("veh-speed").value = item.max_speed || "";
      document.getElementById("veh-motor").value = item.motor_battery_capacity || "";
      document.getElementById("veh-image-url").value = item.image_url || "";
      document.getElementById("veh-desc").value = item.description || "";
      document.getElementById("veh-available").checked = item.available !== false;
      document.getElementById("veh-featured").checked = !!item.featured;
    }
  } else {
    if (title) title.textContent = "አዲስ መኪና ጨምር";
    if (editIdInput) editIdInput.value = "";
  }

  modal.classList.add("active");
}

function closeVehicleModal() {
  const modal = document.getElementById("admin-vehicle-modal");
  if (modal) modal.classList.remove("active");
}

async function handleSaveVehicle(event) {
  event.preventDefault();
  const editId = document.getElementById("veh-edit-id").value;
  const modelName = document.getElementById("veh-model-name").value.trim();
  const seats = parseInt(document.getElementById("veh-seats").value, 10) || 4;
  const price = parseFloat(document.getElementById("veh-price").value) || 0;
  const range = parseFloat(document.getElementById("veh-range").value) || 0;
  const speed = parseFloat(document.getElementById("veh-speed").value) || 0;
  const motor = document.getElementById("veh-motor").value.trim();
  const desc = document.getElementById("veh-desc").value.trim();
  const available = document.getElementById("veh-available").checked;
  const featured = document.getElementById("veh-featured").checked;
  const fileInput = document.getElementById("veh-image-file");
  const urlInput = document.getElementById("veh-image-url");
  const saveBtn = document.getElementById("btn-save-vehicle");

  let imageUrl = urlInput ? urlInput.value.trim() : "";
  let imagePath = null;

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = "በማስቀመጥ ላይ...";
  }

  try {
    // If a new vehicle image file was uploaded
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const ext = file.name.split(".").pop().toLowerCase();
      const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now();
      imagePath = `vehicles/${uuid}.${ext}`;

      if (window.isSupabaseConfigured() && window.supabaseClient) {
        const { error: uploadErr } = await window.supabaseClient.storage
          .from("vehicle-images")
          .upload(imagePath, file, { cacheControl: "3600", upsert: true });

        if (uploadErr) {
          console.error("Vehicle image upload error:", uploadErr);
        } else {
          const { data: publicUrlData } = window.supabaseClient.storage
            .from("vehicle-images")
            .getPublicUrl(imagePath);

          if (publicUrlData && publicUrlData.publicUrl) {
            imageUrl = publicUrlData.publicUrl;
          }
        }
      }
    }

    const payload = {
      model_name: modelName,
      seats: seats,
      price_etb: price,
      range_km: range,
      max_speed: speed,
      motor_battery_capacity: motor,
      description: desc,
      available: available,
      featured: featured
    };

    if (imageUrl) payload.image_url = imageUrl;
    if (imagePath) payload.image_path = imagePath;

    if (window.isSupabaseConfigured() && window.supabaseClient) {
      if (editId) {
        const { error: updateErr } = await window.supabaseClient
          .from("vehicles")
          .update(payload)
          .eq("id", editId);

        if (updateErr) throw updateErr;
        showAdminToast("የመኪናው መረጃ በተሳካ ሁኔታ ተሻሽሏል", "success");
      } else {
        const { error: insertErr } = await window.supabaseClient
          .from("vehicles")
          .insert([payload]);

        if (insertErr) throw insertErr;
        showAdminToast("አዲስ መኪና በተሳካ ሁኔታ ተጨምሯል", "success");
      }
    } else {
      showAdminToast("መረጃው በሙከራ ሁነታ ተቀምጧል", "success");
    }

    closeVehicleModal();
    loadAdminVehicles();
    loadAdminOverview();
  } catch (err) {
    console.error("Save vehicle error:", err);
    showAdminToast("መኪናውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "አስቀምጥ";
    }
  }
}

async function deleteVehicle(id) {
  const confirmMsg = confirm("ይህን መኪና በእርግጥ መሰረዝ ይፈልጋሉ?");
  if (!confirmMsg) return;

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { error } = await window.supabaseClient
        .from("vehicles")
        .delete()
        .eq("id", id);

      if (error) throw error;
      showAdminToast("መኪናው በተሳካ ሁኔታ ተሰርዟል", "success");
    } else {
      adminVehiclesList = adminVehiclesList.filter((v) => String(v.id) !== String(id));
      showAdminToast("መኪናው በሙከራ ሁነታ ተሰርዟል", "info");
    }
    loadAdminVehicles();
    loadAdminOverview();
  } catch (err) {
    console.error("Delete vehicle error:", err);
    showAdminToast("መኪናውን መሰረዝ አልተቻለም", "error");
  }
}

// 7. Applications Management
async function loadAdminApplications() {
  const tbody = document.getElementById("admin-applications-tbody");
  const overviewTbody = document.getElementById("overview-recent-apps-tbody");

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("purchase_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        adminApplicationsList = data;
      }
    } else {
      // Demo seed applications
      adminApplicationsList = [
        {
          id: "app-1",
          vehicle_model_name: "ኢትዮ ኢ-ጎልፍ ቪዥን 4S",
          vehicle_price_etb: 1850000,
          phone_number: "0911234567",
          destination_country: "ኢትዮጵያ (አዲስ አበባ)",
          registration_date: "2026-09-17",
          status: "pending",
          identity_file_path: "identity/demo.jpg",
          photo_file_path: "photos/demo.jpg",
          receipt_file_path: "receipts/demo.jpg",
          created_at: new Date().toISOString()
        }
      ];
    }
  } catch (err) {
    console.error("Load applications error:", err);
  }

  // Render Applications Tab
  if (tbody) {
    if (adminApplicationsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem;">ምንም ማመልከቻ አልተገኘም።</td></tr>`;
    } else {
      let rows = "";
      adminApplicationsList.forEach((app) => {
        const badgeClass = getStatusBadgeClass(app.status);
        const statusLabel = getStatusLabel(app.status);

        rows += `
          <tr>
            <td><strong>${escapeAdminHtml(app.vehicle_model_name)}</strong></td>
            <td>${Number(app.vehicle_price_etb).toLocaleString()} ብር</td>
            <td><a href="tel:${app.phone_number}" style="color:var(--primary); font-weight:600;">${escapeAdminHtml(app.phone_number)}</a></td>
            <td>${escapeAdminHtml(app.destination_country)}</td>
            <td>${app.registration_date}</td>
            <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" onclick="openApplicationDocs('${app.id}')">
                📂 ሰነዶችን እይ
              </button>
            </td>
            <td>
              <div style="display: flex; gap: 0.3rem;">
                <button type="button" class="btn btn-sm" style="background:#ecfdf5; color:#065f46;" onclick="updateAppStatus('${app.id}', 'approved')" title="አጽድቅ">✅ አጽድቅ</button>
                <button type="button" class="btn btn-sm" style="background:#fef2f2; color:#991b1b;" onclick="updateAppStatus('${app.id}', 'rejected')" title="ውድቅ አድርግ">❌ ውድቅ</button>
                <button type="button" class="btn btn-sm" style="background:#f1f5f9; color:#64748b;" onclick="updateAppStatus('${app.id}', 'deleted')" title="ሰርዝ">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = rows;
    }
  }

  // Render Overview Recent Table
  if (overviewTbody) {
    if (adminApplicationsList.length === 0) {
      overviewTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem;">ምንም ማመልከቻ የለም።</td></tr>`;
    } else {
      let overRows = "";
      adminApplicationsList.slice(0, 5).forEach((app) => {
        overRows += `
          <tr>
            <td><strong>${escapeAdminHtml(app.vehicle_model_name)}</strong></td>
            <td>${Number(app.vehicle_price_etb).toLocaleString()} ብር</td>
            <td>${escapeAdminHtml(app.phone_number)}</td>
            <td>${app.registration_date}</td>
            <td><span class="status-badge ${getStatusBadgeClass(app.status)}">${getStatusLabel(app.status)}</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="switchAdminTab('applications')">እይ</button></td>
          </tr>
        `;
      });
      overviewTbody.innerHTML = overRows;
    }
  }
}

// Inspect Application Documents using Secure Signed URLs
async function openApplicationDocs(appId) {
  const modal = document.getElementById("admin-doc-modal");
  const content = document.getElementById("doc-modal-content");
  const title = document.getElementById("doc-modal-applicant-title");

  const app = adminApplicationsList.find((a) => String(a.id) === String(appId));
  if (!app || !modal || !content) return;

  if (title) {
    title.textContent = `የማመልከቻ ሰነዶች፦ ${app.vehicle_model_name} (${app.phone_number})`;
  }

  content.innerHTML = `<div style="text-align:center; padding:2rem;">ሰነዶች በማመንጨት ላይ ናቸው...</div>`;
  modal.classList.add("active");

  try {
    let idUrl = "#";
    let photoUrl = "#";
    let receiptUrl = "#";

    if (window.isSupabaseConfigured() && window.supabaseClient) {
      // Generate private signed URLs valid for 5 minutes
      if (app.identity_file_path) {
        const { data: idSign } = await window.supabaseClient.storage
          .from("customer-documents")
          .createSignedUrl(app.identity_file_path, 300);
        if (idSign) idUrl = idSign.signedUrl;
      }

      if (app.photo_file_path) {
        const { data: photoSign } = await window.supabaseClient.storage
          .from("customer-documents")
          .createSignedUrl(app.photo_file_path, 300);
        if (photoSign) photoUrl = photoSign.signedUrl;
      }

      if (app.receipt_file_path) {
        const { data: recSign } = await window.supabaseClient.storage
          .from("customer-documents")
          .createSignedUrl(app.receipt_file_path, 300);
        if (recSign) receiptUrl = recSign.signedUrl;
      }
    } else {
      // Demo placeholder images
      idUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";
      photoUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";
      receiptUrl = "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80";
    }

    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        
        <!-- 1. Identity -->
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem;">
          <h4 style="font-size:1.1rem; margin-bottom:0.75rem;">1. መታወቂያ</h4>
          ${
            idUrl !== "#"
              ? `<a href="${idUrl}" target="_blank" class="btn btn-secondary btn-sm" style="margin-bottom:0.75rem;">🔗 በሙሉ ስክሪን ክፈት</a>
                 <img src="${idUrl}" style="max-height:220px; border-radius:8px; border:1px solid #cbd5e1; object-fit:contain;" alt="መታወቂያ" />`
              : `<p style="color:#64748b;">ፋይል የለም</p>`
          }
        </div>

        <!-- 2. Photo -->
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem;">
          <h4 style="font-size:1.1rem; margin-bottom:0.75rem;">2. ጉርድ ፎቶ</h4>
          ${
            photoUrl !== "#"
              ? `<a href="${photoUrl}" target="_blank" class="btn btn-secondary btn-sm" style="margin-bottom:0.75rem;">🔗 በሙሉ ስክሪን ክፈት</a>
                 <img src="${photoUrl}" style="max-height:220px; border-radius:8px; border:1px solid #cbd5e1; object-fit:contain;" alt="ጉርድ ፎቶ" />`
              : `<p style="color:#64748b;">ፋይል የለም</p>`
          }
        </div>

        <!-- 3. Receipt -->
        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem;">
          <h4 style="font-size:1.1rem; margin-bottom:0.75rem;">3. የ 10% ክፍያ ደረሰኝ</h4>
          ${
            receiptUrl !== "#"
              ? `<a href="${receiptUrl}" target="_blank" class="btn btn-secondary btn-sm" style="margin-bottom:0.75rem;">🔗 በሙሉ ስክሪን ክፈት</a>
                 <img src="${receiptUrl}" style="max-height:220px; border-radius:8px; border:1px solid #cbd5e1; object-fit:contain;" alt="ደረሰኝ" />`
              : `<p style="color:#64748b;">ፋይል የለም</p>`
          }
        </div>

      </div>
    `;
  } catch (err) {
    console.error("Error loading signed docs:", err);
    content.innerHTML = `<p style="color:#dc2626;">ሰነዶቹን ማምጣት አልተቻለም።</p>`;
  }
}

function closeDocModal() {
  const modal = document.getElementById("admin-doc-modal");
  if (modal) modal.classList.remove("active");
}

async function updateAppStatus(id, newStatus) {
  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { error } = await window.supabaseClient
        .from("purchase_applications")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
    } else {
      const app = adminApplicationsList.find((a) => String(a.id) === String(id));
      if (app) app.status = newStatus;
    }

    showAdminToast(`የማመልከቻው ሁኔታ ወደ '${getStatusLabel(newStatus)}' ተቀይሯል`, "success");
    loadAdminApplications();
    loadAdminOverview();
  } catch (err) {
    console.error("Update status error:", err);
    showAdminToast("ሁኔታውን መቀየር አልተቻለም", "error");
  }
}

function getStatusBadgeClass(status) {
  if (status === "approved") return "status-approved";
  if (status === "rejected") return "status-rejected";
  if (status === "deleted") return "status-deleted";
  return "status-pending";
}

function getStatusLabel(status) {
  if (status === "approved") return "ጸድቋል";
  if (status === "rejected") return "ውድቅ ተደርጓል";
  if (status === "deleted") return "ተሰርዟል";
  return "በመጠባበቅ ላይ";
}

// 8. Payment Settings (CBE Account Editor)
async function loadAdminPaymentSettings() {
  const accInput = document.getElementById("setting-cbe-account");
  const instInput = document.getElementById("setting-cbe-instructions");

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data } = await window.supabaseClient.from("site_settings").select("*");
      if (data) {
        const acc = data.find((r) => r.setting_key === "payment_account");
        const inst = data.find((r) => r.setting_key === "payment_instructions");
        if (acc && accInput) accInput.value = acc.setting_value;
        if (inst && instInput) instInput.value = inst.setting_value;
      }
    } else {
      if (accInput) accInput.value = "CBE: 1000245519668";
      if (instInput) instInput.value = "የ 10% የቅድመ ክፍያ በኢትዮጵያ ንግድ ባንክ (CBE) አካውንት ካስገቡ በኋላ የተቆረጠውን ደረሰኝ በማያያዝ ያመልክቱ።";
    }
  } catch (err) {
    console.error("Load payment settings error:", err);
  }
}

async function handleSavePaymentSettings(event) {
  event.preventDefault();
  const accVal = document.getElementById("setting-cbe-account").value.trim();
  const instVal = document.getElementById("setting-cbe-instructions").value.trim();
  const btn = document.getElementById("btn-save-payment-settings");

  if (!accVal) {
    showAdminToast("እባክዎ የባንክ አካውንት ያስገቡ", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "በማስቀመጥ ላይ...";
  }

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      // Upsert payment_account
      await window.supabaseClient
        .from("site_settings")
        .upsert({ setting_key: "payment_account", setting_value: accVal }, { onConflict: "setting_key" });

      // Upsert payment_instructions
      await window.supabaseClient
        .from("site_settings")
        .upsert({ setting_key: "payment_instructions", setting_value: instVal }, { onConflict: "setting_key" });

      showAdminToast("የባንክ ሂሳብ መረጃ በተሳካ ሁኔታ ተቀምጧል!", "success");
    } else {
      showAdminToast("መረጃው በሙከራ ሁነታ ተቀምጧል", "success");
    }
  } catch (err) {
    console.error("Save payment settings error:", err);
    showAdminToast("የክፍያ መረጃውን ማስቀመጥ አልተቻለም", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "አስቀምጥ";
    }
  }
}

// 9. Site General Settings
async function loadAdminGeneralSettings() {
  const phoneInput = document.getElementById("setting-business-phone");
  const emailInput = document.getElementById("setting-business-email");
  const addrInput = document.getElementById("setting-business-address");
  const heroInput = document.getElementById("setting-hero-title");

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data } = await window.supabaseClient.from("site_settings").select("*");
      if (data) {
        data.forEach((r) => {
          if (r.setting_key === "business_phone" && phoneInput) phoneInput.value = r.setting_value;
          if (r.setting_key === "business_email" && emailInput) emailInput.value = r.setting_value;
          if (r.setting_key === "business_address" && addrInput) addrInput.value = r.setting_value;
          if (r.setting_key === "hero_title" && heroInput) heroInput.value = r.setting_value;
        });
      }
    } else {
      if (phoneInput) phoneInput.value = "+251 911 23 45 67 / +251 922 88 99 00";
      if (emailInput) emailInput.value = "info@ethioelectriccars.et";
      if (addrInput) addrInput.value = "ቦሌ አትላስ፣ አዲስ አበባ፣ ኢትዮጵያ";
      if (heroInput) heroInput.value = "ኢትዮ ኤሌክትሪክ መኪኖች — የዘመናዊ መጓጓዣ ምርጫ!";
    }
  } catch (err) {
    console.error("Load general settings error:", err);
  }
}

async function handleSaveGeneralSettings(event) {
  event.preventDefault();
  const phone = document.getElementById("setting-business-phone").value.trim();
  const email = document.getElementById("setting-business-email").value.trim();
  const addr = document.getElementById("setting-business-address").value.trim();
  const hero = document.getElementById("setting-hero-title").value.trim();
  const btn = document.getElementById("btn-save-general-settings");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "በማስቀመጥ ላይ...";
  }

  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const settings = [
        { setting_key: "business_phone", setting_value: phone },
        { setting_key: "business_email", setting_value: email },
        { setting_key: "business_address", setting_value: addr },
        { setting_key: "hero_title", setting_value: hero }
      ];

      for (const s of settings) {
        await window.supabaseClient.from("site_settings").upsert(s, { onConflict: "setting_key" });
      }

      showAdminToast("የድር ጣቢያ ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል!", "success");
    } else {
      showAdminToast("ቅንብሮቹ በሙከራ ሁነታ ተቀምጠዋል", "success");
    }
  } catch (err) {
    console.error("Save general settings error:", err);
    showAdminToast("ቅንብሮችን ማስቀመጥ አልተቻለም", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "ቅንብሮችን አስቀምጥ";
    }
  }
}

// Toast notification helper for Admin
function showAdminToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${escapeAdminHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 20);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 4500);
}

function escapeAdminHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global exposure
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout;
window.switchAdminTab = switchAdminTab;
window.openVehicleModal = openVehicleModal;
window.closeVehicleModal = closeVehicleModal;
window.handleSaveVehicle = handleSaveVehicle;
window.deleteVehicle = deleteVehicle;
window.loadAdminApplications = loadAdminApplications;
window.openApplicationDocs = openApplicationDocs;
window.closeDocModal = closeDocModal;
window.updateAppStatus = updateAppStatus;
window.handleSavePaymentSettings = handleSavePaymentSettings;
window.handleSaveGeneralSettings = handleSaveGeneralSettings;
