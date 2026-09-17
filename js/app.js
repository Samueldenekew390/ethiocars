/**
 * ====================================================================
 * ETHIO ELECTRIC VEHICLES (ኢትዮ ኤሌክትሪክ መኪኖች)
 * Main Application Initializer (Vanilla JavaScript)
 * ====================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  
  // Load dynamic data from Supabase
  if (typeof window.loadVehicles === "function") {
    window.loadVehicles();
  }

  if (typeof window.subscribeToVehiclesRealtime === "function") {
    window.subscribeToVehiclesRealtime();
  }
  
  if (typeof window.loadPaymentSettings === "function") {
    window.loadPaymentSettings();
  }

  if (typeof window.subscribeToSettingsRealtime === "function") {
    window.subscribeToSettingsRealtime();
  }

  if (typeof window.setupFileUploadHandlers === "function") {
    window.setupFileUploadHandlers();
  }

  initEventListeners();
});

// Mobile Navigation Toggle
function initNavigation() {
  const hamburger = document.getElementById("hamburger-btn");
  const navLinks = document.getElementById("nav-links");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });

    // Close mobile nav when clicking any link
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
      });
    });
  }
}

// Global modal and filter event listeners
function initEventListeners() {
  // Search & Filter
  const searchInput = document.getElementById("vehicle-search-input");
  const seatsFilter = document.getElementById("vehicle-seats-filter");
  const sortFilter = document.getElementById("vehicle-sort-filter");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (window.filterVehicles) window.filterVehicles();
    });
  }

  if (seatsFilter) {
    seatsFilter.addEventListener("change", () => {
      if (window.filterVehicles) window.filterVehicles();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener("change", () => {
      if (window.filterVehicles) window.filterVehicles();
    });
  }

  // Close modals with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (window.closePurchaseModal) window.closePurchaseModal();
      if (window.closeLightbox) window.closeLightbox();
      if (window.closeSuccessModal) window.closeSuccessModal();
    }
  });

  // Close modals when clicking overlay background
  const modals = document.querySelectorAll(".modal-overlay");
  modals.forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  });
}
