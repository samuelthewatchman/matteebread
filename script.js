/* ============================
   PRODUCT DATA
   ============================ */

const products = [
  {
    id: "butter",
    name: "Butter Bread",
    price: 10,
    image: "assets/sliced-bread.jpg"
  },
  {
    id: "tea",
    name: "Tea Bread",
    price: 10,
    image: "assets/round-loaves.jpg"
  },
  {
    id: "wheat",
    name: "Wheat Bread",
    price: 10,
    image: "assets/seeded-rolls.jpg"
  }
];
/* ============================
   CONFIG
   ============================ */

const CONFIG = {
  paystackPublicKey: "pk_test_baa7d65e04026a677a857e13a843c9b8c64890a0",
  currency: "GHS",

  emailjsPublicKey: "V0rfnBUBr5IbmTTwM",   // Account → API Keys
  emailjsServiceId: "service_du1mexd",           // Email Services
  emailjsTemplateId: "template_k8qspf8"          // Email Templates
};

// Prices above are placeholders — update them to your mom's real prices.

/* ============================
   STATE
   ============================ */

// Tracks how many of each bread the person has picked with +/- BEFORE adding to cart
let selectedQty = {};
products.forEach(p => selectedQty[p.id] = 1);

// The actual cart: { butter: 2, wheat: 5 } etc. Starts empty.
let cart = {};

/* ============================
   RENDER PRODUCT CARDS
   ============================ */

function renderProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = ""; // clear it out before rebuilding

  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="price">GHS ${product.price} / loaf</p>
        <div class="qty-controls">
          <button onclick="changeQty('${product.id}', -1)">−</button>
          <span id="qty-${product.id}">${selectedQty[product.id]}</span>
          <button onclick="changeQty('${product.id}', 1)">+</button>
        </div>
        <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">
          Add to Cart
        </button>
      </div>
    `;

    list.appendChild(card);
  });
}

/* ============================
   QUANTITY STEPPER (before adding to cart)
   ============================ */

function changeQty(id, delta) {
  const newQty = selectedQty[id] + delta;
  if (newQty < 1) return; // never go below 1
  selectedQty[id] = newQty;
  document.getElementById(`qty-${id}`).textContent = newQty;
}

/* ============================
   ADD TO CART
   ============================ */

function addToCart(id) {
  const qty = selectedQty[id];
  cart[id] = (cart[id] || 0) + qty;

  updateCartCount();
  renderCart();   // ← added this line
  saveCartToStorage();   // ← added


  selectedQty[id] = 1;
  document.getElementById(`qty-${id}`).textContent = 1;
}

function updateCartCount() {
  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

/* ============================
   INIT
   ============================ */
loadCartFromStorage();   // ← added, must run before render calls below
renderProducts();
renderCart();
updateCartCount();
emailjs.init(CONFIG.emailjsPublicKey);
initWelcomeModal();   // ← added


/* ============================
   CART DRAWER OPEN/CLOSE
   ============================ */

document.getElementById("cart-btn").addEventListener("click", () => {
  document.getElementById("cart-drawer").classList.add("open");
});

document.getElementById("close-cart").addEventListener("click", () => {
  document.getElementById("cart-drawer").classList.remove("open");
});

/* ============================
   BULK DISCOUNT RULE
   ============================ */

// 10+ loaves of the SAME bread gets 10% off that line
// Simple line total — no automatic discount, promos will be handled separately later
function getLineTotal(product, qty) {
  return product.price * qty;
}

/* ============================
   RENDER CART CONTENTS
   ============================ */

function renderCart() {
  const container = document.getElementById("cart-items");
  container.innerHTML = "";

  let grandTotal = 0;

  Object.keys(cart).forEach(id => {
    const product = products.find(p => p.id === id);
    const qty = cart[id];
    const lineTotal = getLineTotal(product, qty);
    grandTotal += lineTotal;

    const line = document.createElement("div");
    line.className = "cart-line";
    line.innerHTML = `
      <div>
        <strong>${product.name}</strong> × ${qty}
        <br>
        <button class="remove-btn" onclick="removeFromCart('${id}')">Remove</button>
      </div>
      <div>GHS ${lineTotal.toFixed(2)}</div>
    `;
    container.appendChild(line);
  });

  document.getElementById("cart-total").textContent = grandTotal.toFixed(2);

  if (Object.keys(cart).length === 0) {
    container.innerHTML = "<p>Your cart is empty.</p>";
  }
}

function removeFromCart(id) {
  delete cart[id];
  renderCart();
  updateCartCount();
  saveCartToStorage();   // ← added
}
/* ============================
   SCROLL TO TOP (Home link)
   ============================ */

function scrollToTop(e) {
  e.preventDefault();               // stop the "#" from jumping or adding to the URL
  window.scrollTo({ top: 0, behavior: "smooth" });
}
/* ============================
   TOGGLE DELIVERY ADDRESS FIELD
   ============================ */

const deliveryRadios = document.querySelectorAll('input[name="delivery"]');
const addressField = document.getElementById("delivery-address");
const deliveryNote = document.getElementById("delivery-note");

deliveryRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    const isDelivery = radio.value === "delivery" && radio.checked;
    addressField.style.display = isDelivery ? "block" : "none";
    deliveryNote.style.display = isDelivery ? "block" : "none";
  });
});

/* ============================
   CHECKOUT FORM SUBMIT → PAYSTACK
   ============================ */

document.getElementById("checkout-form").addEventListener("submit", (e) => {
  e.preventDefault();

  if (Object.keys(cart).length === 0) {
    alert("Your cart is empty — add some bread first!");
    return;
  }

  if (!validateForm()) {
    return;   // stop here — error messages are already showing, don't proceed to payment
  }

  const order = {
    name: document.getElementById("cust-name").value,
    phone: document.getElementById("cust-phone").value,
    email: document.getElementById("cust-email").value,
    deliveryMethod: document.querySelector('input[name="delivery"]:checked').value,
    address: document.getElementById("delivery-address").value,
    notes: document.getElementById("order-notes").value,
    cart: cart
  };

  const total = calculateGrandTotal();

  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Processing...";

  payWithPaystack(order, total);
});

/* ============================
   PAYSTACK PAYMENT
   ============================ */

function payWithPaystack(order, totalGHS) {
  const handler = PaystackPop.setup({
    key: CONFIG.paystackPublicKey,
    email: order.email,
    amount: Math.round(totalGHS * 100),
    currency: CONFIG.currency,
    ref: "MB-" + Date.now(),
    callback: function(response) {
      handlePaymentSuccess(order, totalGHS, response.reference);
    },
    onClose: function() {
      alert("Payment window closed. Your order was not completed.");
      resetCheckoutButton();   // ← added
    }
  });
  handler.openIframe();
}

function resetCheckoutButton() {
  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.disabled = false;
  checkoutBtn.textContent = "Checkout";
}

function handlePaymentSuccess(order, totalGHS, reference) {
  showConfirmation(order, reference);          // was alert(...)
  sendOrderEmail(order, totalGHS, reference);

  console.log("PAID ORDER:", order, "Total:", totalGHS, "Ref:", reference);

  cart = {};
  renderCart();
  updateCartCount();
  saveCartToStorage();   // ← added
  document.getElementById("checkout-form").reset();
  resetCheckoutButton();                        // ← also add this, easy to forget
  document.getElementById("cart-drawer").classList.remove("open");   // close the drawer behind it
}

/* ============================
   GRAND TOTAL (cart + delivery)
   ============================ */

// Delivery fee is quoted separately by WhatsApp based on distance —
// Paystack only ever charges for the bread itself.
function calculateGrandTotal() {
  let total = 0;
  Object.keys(cart).forEach(id => {
    const product = products.find(p => p.id === id);
    total += getLineTotal(product, cart[id]);
  });
  return total;
}
/* ============================
   EMAIL NOTIFICATION
   ============================ */

function buildOrderSummaryText(order, totalGHS) {
  let lines = [];
  Object.keys(order.cart).forEach(id => {
    const product = products.find(p => p.id === id);
    const qty = order.cart[id];
    lines.push(`${product.name} x${qty} — GHS ${getLineTotal(product, qty).toFixed(2)}`);
  });
  return lines.join("\n");
}

function sendOrderEmail(order, totalGHS, reference) {
  const templateParams = {
    customer_name: order.name,
    customer_phone: order.phone,
    customer_email: order.email,
    delivery_method: order.deliveryMethod,
    delivery_address: order.address || "N/A (pickup)",
    order_notes: order.notes || "None",
    order_summary: buildOrderSummaryText(order, totalGHS),
    total: totalGHS.toFixed(2),
    reference: reference
  };

  emailjs.send(CONFIG.emailjsServiceId, CONFIG.emailjsTemplateId, templateParams)
    .then(() => {
      console.log("Order email sent successfully");
    })
    .catch((error) => {
      console.error("Order email failed to send:", error);
      // Payment already succeeded regardless — don't block the customer on this failing
    });
}
/* ============================
   CONFIRMATION MODAL
   ============================ */

function showConfirmation(order, reference) {
  const deliveryMsg = order.deliveryMethod === "delivery"
    ? "We'll message you on WhatsApp shortly to confirm your delivery fee and time."
    : "Your bread will be ready for pickup at Ejisu Besease.";

  document.getElementById("confirmation-message").textContent =
    `Thank you, ${order.name}! ${deliveryMsg}`;
  document.getElementById("confirmation-ref-number").textContent = reference;
  document.getElementById("confirmation-overlay").classList.add("open");
}

function closeConfirmation() {
  document.getElementById("confirmation-overlay").classList.remove("open");
}
/* ============================
   FORM VALIDATION
   ============================ */

function validateForm() {
  let isValid = true;

  // Ghana phone numbers: 0XXXXXXXXX (10 digits) or +233XXXXXXXXX
  const phoneInput = document.getElementById("cust-phone");
  const phonePattern = /^(0\d{9}|\+233\d{9})$/;
  const phoneError = document.getElementById("phone-error");

  if (!phonePattern.test(phoneInput.value.trim())) {
    phoneInput.classList.add("invalid");
    phoneError.textContent = "Enter a valid number, e.g. 0246756119";
    phoneError.classList.add("show");
    isValid = false;
  } else {
    phoneInput.classList.remove("invalid");
    phoneError.classList.remove("show");
  }

  // Basic email shape check: something@something.something
  const emailInput = document.getElementById("cust-email");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailError = document.getElementById("email-error");

  if (!emailPattern.test(emailInput.value.trim())) {
    emailInput.classList.add("invalid");
    emailError.textContent = "Enter a valid email address";
    emailError.classList.add("show");
    isValid = false;
  } else {
    emailInput.classList.remove("invalid");
    emailError.classList.remove("show");
  }

  return isValid;
}
/* ============================
   CART PERSISTENCE (localStorage)
   ============================ */

function saveCartToStorage() {
  localStorage.setItem("matteeBreadCart", JSON.stringify(cart));
}

function loadCartFromStorage() {
  const saved = localStorage.getItem("matteeBreadCart");
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch (e) {
      console.error("Saved cart was corrupted, starting fresh:", e);
      cart = {};
    }
  }
}
/* ============================
   WELCOME MODAL (once per day)
   ============================ */

function initWelcomeModal() {
  const lastShown = localStorage.getItem("matteeWelcomeShown");
  const today = new Date().toDateString();

  if (lastShown === today) {
    return; // already greeted them today, skip
  }

  setTimeout(() => {
    document.getElementById("welcome-overlay").classList.add("open");
  }, 600); // small delay so it doesn't feel like a jarring instant popup

  localStorage.setItem("matteeWelcomeShown", today);
}

function closeWelcomeModal() {
  document.getElementById("welcome-overlay").classList.remove("open");
}

document.getElementById("close-welcome").addEventListener("click", closeWelcomeModal);
document.getElementById("welcome-dismiss-btn").addEventListener("click", closeWelcomeModal);

document.getElementById("welcome-order-btn").addEventListener("click", () => {
  closeWelcomeModal();
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});
