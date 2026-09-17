/**
 * ====================================================================
 * PURCHASE MODULE (የግዢ ማመልከቻ ሞጁል)
 * Handles customer purchase questionnaire, validation, CBE account retrieval,
 * copy-to-clipboard, secure file uploads, and Supabase database insertion.
 * ====================================================================
 */

let selectedVehicleForPurchase = null;
let currentCBEAccount = "CBE: 1000245519668";
let currentPaymentInstructions = "የ 10% የቅድመ ክፍያ በኢትዮጵያ ንግድ ባንክ (CBE) አካውንት ካስገቡ በኋላ የተቆረጠውን ደረሰኝ በማያያዝ ያመልክቱ።";
let settingsRealtimeChannel = null;

// Load site settings (dynamic payment account) from Supabase
async function loadPaymentSettings() {
  try {
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("site_settings")
        .select("setting_key, setting_value");

      if (error) {
        console.warn("Could not fetch site_settings from Supabase:", error);
      } else if (data && data.length > 0) {
        const accRow = data.find((r) => r.setting_key === "payment_account");
        if (accRow && accRow.setting_value) {
          currentCBEAccount = accRow.setting_value;
        }

        const instRow = data.find((r) => r.setting_key === "payment_instructions");
        if (instRow && instRow.setting_value) {
          currentPaymentInstructions = instRow.setting_value;
        }
      }
    }
  } catch (err) {
    console.warn("Error in loadPaymentSettings:", err);
  }

  // Update UI everywhere
  updatePaymentInfoUI();
}

function updatePaymentInfoUI() {
  const cbeEls = document.querySelectorAll(".dynamic-cbe-number");
  cbeEls.forEach((el) => {
    el.textContent = currentCBEAccount;
  });

  const instEls = document.querySelectorAll(".dynamic-payment-instructions");
  instEls.forEach((el) => {
    el.textContent = currentPaymentInstructions;
  });
}

function subscribeToSettingsRealtime() {
  if (!window.supabaseClient || settingsRealtimeChannel) return;

  settingsRealtimeChannel = window.supabaseClient
    .channel("public-site-settings-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_settings" },
      () => loadPaymentSettings(),
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Site settings realtime subscription failed");
      }
    });
}

// Open purchase modal for a specific vehicle
function openPurchaseModal(vehicleId) {
  const vehicles = window.getAllVehicles ? window.getAllVehicles() : [];
  selectedVehicleForPurchase = vehicles.find((v) => String(v.id) === String(vehicleId));

  if (!selectedVehicleForPurchase) {
    showToast("መኪናው አልተገኘም", "error");
    return;
  }

  const modal = document.getElementById("purchase-modal");
  const modelNameEl = document.getElementById("modal-vehicle-model-name");
  const priceEl = document.getElementById("modal-vehicle-price");
  const regDateInput = document.getElementById("form-reg-date");

  if (modelNameEl) modelNameEl.textContent = selectedVehicleForPurchase.model_name;
  if (priceEl) priceEl.textContent = window.formatPriceETB ? window.formatPriceETB(selectedVehicleForPurchase.price_etb) : selectedVehicleForPurchase.price_etb + " ብር";

  // Set default registration date to today
  if (regDateInput && !regDateInput.value) {
    const today = new Date().toISOString().split("T")[0];
    regDateInput.value = today;
  }

  // Reset form errors and previews
  resetPurchaseForm();

  // Show modal
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  // Refresh payment account info
  loadPaymentSettings();
}

// Close purchase modal
function closePurchaseModal() {
  const modal = document.getElementById("purchase-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Reset form elements
function resetPurchaseForm() {
  const form = document.getElementById("purchase-application-form");
  if (form) form.reset();

  // Reset file previews
  ["identity", "photo", "receipt"].forEach((type) => {
    const preview = document.getElementById(`preview-${type}`);
    if (preview) {
      preview.classList.remove("active");
      preview.textContent = "";
    }
  });

  const progressWrap = document.getElementById("purchase-progress-wrap");
  if (progressWrap) progressWrap.classList.remove("active");

  const submitBtn = document.getElementById("purchase-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>አመልክት</span>`;
  }
}

// Copy CBE Account number to clipboard
function copyCBEAccount() {
  // Extract number part if text contains "CBE: 1000..."
  let numberToCopy = currentCBEAccount;
  const match = currentCBEAccount.match(/\d+/);
  if (match) {
    numberToCopy = match[0];
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(numberToCopy).then(
      () => {
        showToast("የአካውንት ቁጥሩ በትክክል ተቀድቷል! (" + numberToCopy + ")", "success");
      },
      () => {
        fallbackCopyText(numberToCopy);
      }
    );
  } else {
    fallbackCopyText(numberToCopy);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
    showToast("የአካውንት ቁጥሩ በትክክል ተቀድቷል! (" + text + ")", "success");
  } catch (err) {
    showToast("እባክዎ አካውንት ቁጥሩን በእጅዎ ይቅዱ፦ " + text, "info");
  }
  document.body.removeChild(textArea);
}

// Setup custom file upload dropzone events
function setupFileUploadHandlers() {
  ["identity", "photo", "receipt"].forEach((type) => {
    const input = document.getElementById(`file-${type}`);
    const preview = document.getElementById(`preview-${type}`);
    const box = document.getElementById(`dropzone-${type}`);

    if (!input) return;

    input.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
          showToast(validation.message, "error");
          input.value = "";
          if (preview) preview.classList.remove("active");
          return;
        }

        if (preview) {
          preview.classList.add("active");
          preview.innerHTML = `<span>📄 ${escapeHtml(file.name)} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" onclick="clearSelectedFile('${type}')" style="color:#dc2626; font-weight:bold; margin-left:8px;">✕ አስወግድ</button>`;
        }
      }
    });

    if (box) {
      box.addEventListener("dragover", (e) => {
        e.preventDefault();
        box.classList.add("dragover");
      });
      box.addEventListener("dragleave", () => {
        box.classList.remove("dragover");
      });
      box.addEventListener("drop", (e) => {
        e.preventDefault();
        box.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          input.files = e.dataTransfer.files;
          const event = new Event("change");
          input.dispatchEvent(event);
        }
      });
    }
  });
}

function clearSelectedFile(type) {
  const input = document.getElementById(`file-${type}`);
  const preview = document.getElementById(`preview-${type}`);
  if (input) input.value = "";
  if (preview) {
    preview.classList.remove("active");
    preview.innerHTML = "";
  }
}

// Validate file type and size
function validateFile(file) {
  const maxBytes = 5 * 1024 * 1024; // 5 MB
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
  const fileName = file.name.toLowerCase();

  const isAllowedExt = allowedExtensions.some((ext) => fileName.endsWith(ext));
  if (!isAllowedExt) {
    return {
      valid: false,
      message: "የተፈቀዱ የፋይል አይነቶች JPG፣ JPEG፣ PNG፣ WEBP ወይም PDF ብቻ ናቸው።"
    };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      message: "የፋይል መጠን ከ 5 MB መብለጥ የለበትም።"
    };
  }

  return { valid: true };
}

// Validate phone number
function validatePhone(phone) {
  if (!phone) return false;
  // Ethiopian phone patterns: 09..., 07..., +2519..., +2517..., 2519...
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  const etRegex = /^(\+251|251|0)?[97]\d{8}$/;
  return etRegex.test(cleaned);
}

// Generate unique UUID-based file path
function generateSafeFilePath(folder, originalFile) {
  const ext = originalFile.name.split(".").pop().toLowerCase();
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "doc-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
  return `${folder}/${uuid}.${ext}`;
}

// Handle Form Submission
async function handlePurchaseSubmit(event) {
  event.preventDefault();

  if (!selectedVehicleForPurchase) {
    showToast("እባክዎ መኪና ይምረጡ።", "error");
    return;
  }

  const phoneInput = document.getElementById("form-phone");
  const countryInput = document.getElementById("form-country");
  const regDateInput = document.getElementById("form-reg-date");
  const idFileInput = document.getElementById("file-identity");
  const photoFileInput = document.getElementById("file-photo");
  const receiptFileInput = document.getElementById("file-receipt");

  const phone = phoneInput ? phoneInput.value.trim() : "";
  const country = countryInput ? countryInput.value.trim() : "";
  const regDate = regDateInput ? regDateInput.value : "";
  const idFile = idFileInput && idFileInput.files ? idFileInput.files[0] : null;
  const photoFile = photoFileInput && photoFileInput.files ? photoFileInput.files[0] : null;
  const receiptFile = receiptFileInput && receiptFileInput.files ? receiptFileInput.files[0] : null;

  // Validation
  if (!idFile) {
    showToast("እባክዎ የመታወቂያዎን ፎቶ ወይም ኮፒ ያያይዙ።", "error");
    return;
  }
  if (!photoFile) {
    showToast("እባክዎ ጉርድ ፎቶዎን ያያይዙ።", "error");
    return;
  }
  if (!phone || !validatePhone(phone)) {
    showToast("እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ምሳሌ፦ 0911234567)።", "error");
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (!country) {
    showToast("እባክዎ የሚላክበትን ከተማ ወይም ሀገር ያስገቡ።", "error");
    if (countryInput) countryInput.focus();
    return;
  }
  if (!regDate) {
    showToast("እባክዎ የምዝገባ ቀን ይምረጡ።", "error");
    return;
  }
  if (!receiptFile) {
    showToast("እባክዎ የ 10% ክፍያ የተፈጸመበትን ደረሰኝ ያያይዙ።", "error");
    return;
  }

  // Show upload progress
  const submitBtn = document.getElementById("purchase-submit-btn");
  const progressWrap = document.getElementById("purchase-progress-wrap");
  const progressFill = document.getElementById("purchase-progress-fill");
  const progressText = document.getElementById("purchase-progress-text");

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>በመላክ ላይ...</span>`;
  }
  if (progressWrap) progressWrap.classList.add("active");
  if (progressFill) progressFill.style.width = "20%";
  if (progressText) progressText.textContent = "ፋይሎች በመጫን ላይ ናቸው... (20%)";

  try {
    const identityPath = generateSafeFilePath("identity", idFile);
    const photoPath = generateSafeFilePath("photos", photoFile);
    const receiptPath = generateSafeFilePath("receipts", receiptFile);

    // If Supabase is configured, upload to private bucket 'customer-documents'
    if (window.isSupabaseConfigured() && window.supabaseClient) {
      if (progressFill) progressFill.style.width = "40%";
      if (progressText) progressText.textContent = "የመታወቂያ ፋይል በማስቀመጥ ላይ... (40%)";

      // 1. Upload Identity
      const { error: idErr } = await window.supabaseClient.storage
        .from("customer-documents")
        .upload(identityPath, idFile, { cacheControl: "3600", upsert: false });

      if (idErr) {
        console.error("Storage upload identity error:", idErr);
        throw new Error("መታወቂያ መጫን አልተቻለም");
      }

      // 2. Upload Photo
      if (progressFill) progressFill.style.width = "65%";
      if (progressText) progressText.textContent = "ጉርድ ፎቶ በማስቀመጥ ላይ... (65%)";

      const { error: photoErr } = await window.supabaseClient.storage
        .from("customer-documents")
        .upload(photoPath, photoFile, { cacheControl: "3600", upsert: false });

      if (photoErr) {
        console.error("Storage upload photo error:", photoErr);
        throw new Error("ጉርድ ፎቶ መጫን አልተቻለም");
      }

      // 3. Upload Receipt
      if (progressFill) progressFill.style.width = "85%";
      if (progressText) progressText.textContent = "ደረሰኝ በማስቀመጥ ላይ... (85%)";

      const { error: receiptErr } = await window.supabaseClient.storage
        .from("customer-documents")
        .upload(receiptPath, receiptFile, { cacheControl: "3600", upsert: false });

      if (receiptErr) {
        console.error("Storage upload receipt error:", receiptErr);
        throw new Error("የክፍያ ደረሰኝ መጫን አልተቻለም");
      }

      // 4. Insert record into purchase_applications table
      if (progressFill) progressFill.style.width = "95%";
      if (progressText) progressText.textContent = "ማመልከቻውን በመመዝገብ ላይ... (95%)";

      const applicationPayload = {
        vehicle_id: String(selectedVehicleForPurchase.id).includes("-00") ? null : selectedVehicleForPurchase.id,
        vehicle_model_name: selectedVehicleForPurchase.model_name,
        vehicle_price_etb: selectedVehicleForPurchase.price_etb,
        identity_file_path: identityPath,
        photo_file_path: photoPath,
        receipt_file_path: receiptPath,
        phone_number: phone,
        destination_country: country,
        registration_date: regDate,
        status: "pending"
      };

      const { error: insertErr } = await window.supabaseClient
        .from("purchase_applications")
        .insert([applicationPayload]);

      if (insertErr) {
        console.error("Database insert application error:", insertErr);
        throw new Error("መረጃውን መመዝገብ አልተቻለም");
      }
    } else {
      // Local simulated wait if user has not yet connected Supabase URL/key
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.info("Demo submission saved locally (Supabase keys not yet pasted in js/supabase-config.js).");
    }

    if (progressFill) progressFill.style.width = "100%";
    if (progressText) progressText.textContent = "ተጠናቋል! (100%)";

    // Close purchase questionnaire modal
    closePurchaseModal();

    // Show Success Modal
    openSuccessModal();
  } catch (err) {
    console.error("Submission failed:", err);
    // User requirement: Do NOT expose raw Supabase technical errors to customers!
    showToast("አንድ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>አመልክት</span>`;
    }
    if (progressWrap) progressWrap.classList.remove("active");
  }
}

// Open Success modal
function openSuccessModal() {
  const modal = document.getElementById("success-modal");
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeSuccessModal() {
  const modal = document.getElementById("success-modal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Global Toast Notification Helper
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "⚠️";

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 20);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 4500);
}

// Expose functions globally
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.copyCBEAccount = copyCBEAccount;
window.handlePurchaseSubmit = handlePurchaseSubmit;
window.clearSelectedFile = clearSelectedFile;
window.openSuccessModal = openSuccessModal;
window.closeSuccessModal = closeSuccessModal;
window.showToast = showToast;
window.loadPaymentSettings = loadPaymentSettings;
window.setupFileUploadHandlers = setupFileUploadHandlers;
window.subscribeToSettingsRealtime = subscribeToSettingsRealtime;
