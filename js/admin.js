import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./config.js";
 
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
const sizes = ["S", "M", "L", "XL", "XXL"];
 
let products = [];
let categories = [];
 
const $ = (s) => document.querySelector(s);
 
function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
 
function toast(message) {
  const element = $("#toast");
  if (!element) return;
 
  element.textContent = message;
  element.style.display = "block";
 
  setTimeout(() => {
    element.style.display = "none";
  }, 2200);
}
 
async function isAdmin() {
  const {
    data: { user }
  } = await db.auth.getUser();
 
  if (!user) return false;
 
  const { data, error } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
 
  return !error && !!data;
}
 
async function start() {
  const {
    data: { session }
  } = await db.auth.getSession();
 
  if (session && (await isAdmin())) {
    showAdmin(session.user);
  } else {
    showLogin();
  }
}
 
function showLogin() {
  $("#loginView").hidden = false;
  $("#adminView").hidden = true;
}
 
function showAdmin(user) {
  $("#loginView").hidden = true;
  $("#adminView").hidden = false;
  $("#adminEmail").textContent = user.email || "";
 
  loadAll();
}
 
async function loadAll() {
  const categoriesResult = await db
    .from("categories")
    .select("*")
    .order("sort_order");
 
  const productsResult = await db
    .from("products")
    .select("*, categories(name), product_sizes(*)")
    .order("created_at", { ascending: false });
 
  if (categoriesResult.error || productsResult.error) {
    toast("Erreur de chargement");
    console.error(categoriesResult.error || productsResult.error);
    return;
  }
 
  categories = categoriesResult.data || [];
  products = productsResult.data || [];
 
  render();
}
 
function totalStock(product) {
  return (product.product_sizes || [])
    .filter((size) => size.enabled)
    .reduce((total, size) => total + Number(size.quantity || 0), 0);
}
 
function render() {
  const statProducts = $("#statProducts");
  const statStock = $("#statStock");
  const statOut = $("#statOut");
  const statNew = $("#statNew");
  const statFeatured = $("#statFeatured");
 
  if (statProducts) {
    statProducts.textContent = products.filter((p) => p.active).length;
  }
 
  if (statStock) {
    statStock.textContent = products.reduce(
      (total, product) => total + totalStock(product),
      0
    );
  }
 
  if (statOut) {
    statOut.textContent = products.filter(
      (product) => totalStock(product) === 0
    ).length;
  }
 
  if (statNew) {
    statNew.textContent = products.filter((p) => p.is_new).length;
  }
 
  if (statFeatured) {
    statFeatured.textContent = products.filter((p) => p.is_featured).length;
  }
 
  const adminCategory = $("#adminCategory");
  if (adminCategory) {
    adminCategory.innerHTML =
      '<option value="">Toutes les catégories</option>' +
      categories
        .map(
          (category) =>
            `<option value="${esc(category.id)}">${esc(category.name)}</option>`
        )
        .join("");
  }
 
  const productCategory = $("#pCategory");
  if (productCategory) {
    productCategory.innerHTML = categories
      .map(
        (category) =>
          `<option value="${esc(category.id)}">${esc(category.name)}</option>`
      )
      .join("");
  }
 
  const searchElement = $("#adminSearch");
  const stockElement = $("#adminStock");
  const categoryElement = $("#adminCategory");
 
  const search = searchElement ? searchElement.value.toLowerCase() : "";
  const category = categoryElement ? categoryElement.value : "";
  const stock = stockElement ? stockElement.value : "";
 
  const list = products.filter((product) => {
    const text = [product.name, product.description, product.categories?.name]
      .join(" ")
      .toLowerCase();
 
    const matchesSearch = !search || text.includes(search);
    const matchesCategory = !category || product.category_id === category;
    const matchesStock =
      !stock || (stock === "in" ? totalStock(product) > 0 : totalStock(product) === 0);
 
    return matchesSearch && matchesCategory && matchesStock;
  });
 
  const adminProducts = $("#adminProducts");
  if (adminProducts) {
    adminProducts.innerHTML = list
      .map(
        (product) => `
        <tr>
          <td><strong>${esc(product.name)}</strong></td>
 
          <td>${Number(product.price).toLocaleString("fr-FR")} 🎾</td>
 
          <td>${esc(product.categories?.name || "—")}</td>
 
          <td>
            <div class="stock-mini">
              ${
                (product.product_sizes || [])
                  .filter((size) => size.enabled)
                  .map((size) => `<span>${esc(size.size)}: ${Number(size.quantity)}</span>`)
                  .join("") || "—"
              }
            </div>
          </td>
 
          <td>
            ${product.active ? "Actif" : "Masqué"}
            ${product.is_new ? " · Nouveau" : ""}
            ${product.is_featured ? " · ⭐" : ""}
          </td>
 
          <td>
            <button class="admin-btn" data-edit="${esc(product.id)}">Modifier</button>
            <button class="admin-btn danger" data-del="${esc(product.id)}">Supprimer</button>
          </td>
        </tr>
      `
      )
      .join("");
  }
 
  const categoryList = $("#categoryAdminList");
  if (categoryList) {
    categoryList.innerHTML = categories
      .map(
        (category) => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee">
          <span>${esc(category.name)}</span>
          <button class="admin-btn" data-cat-edit="${esc(category.id)}">Modifier</button>
        </div>
      `
      )
      .join("");
  }
 
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => openProduct(button.dataset.edit);
  });
 
  document.querySelectorAll("[data-del]").forEach((button) => {
    button.onclick = () => deleteProduct(button.dataset.del);
  });
 
  document.querySelectorAll("[data-cat-edit]").forEach((button) => {
    button.onclick = () => openCategory(button.dataset.catEdit);
  });
}
 
function resetForm() {
  $("#productId").value = "";
  $("#modalTitle").textContent = "Ajouter un produit";
 
  $("#pName").value = "";
  $("#pPrice").value = "";
  $("#pDescription").value = "";
  $("#pImage").value = "";
  $("#pCategory").value = "";
 
  $("#pActive").checked = true;
  $("#pNew").checked = false;
  $("#pFeatured").checked = false;
 
  $("#sizeInputs").innerHTML = sizes
    .map(
      (size) => `
      <label style="font-size:.7rem">
        <span>
          <input type="checkbox" data-enabled="${size}">
          ${size}
        </span>
        <input type="number" min="0" value="0" data-qty="${size}">
      </label>
    `
    )
    .join("");
}
 
async function openProduct(id = null) {
  resetForm();
 
  if (id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
 
    $("#modalTitle").textContent = "Modifier le produit";
    $("#productId").value = product.id;
    $("#pName").value = product.name;
    $("#pPrice").value = product.price;
    $("#pDescription").value = product.description || "";
    $("#pCategory").value = product.category_id || "";
    $("#pActive").checked = !!product.active;
    $("#pNew").checked = !!product.is_new;
    $("#pFeatured").checked = !!product.is_featured;
 
    for (const size of product.product_sizes || []) {
      const enabled = $(`[data-enabled="${size.size}"]`);
      const quantity = $(`[data-qty="${size.size}"]`);
 
      if (enabled) enabled.checked = !!size.enabled;
      if (quantity) quantity.value = Number(size.quantity || 0);
    }
  }
 
  $("#productModal").showModal();
}
 
async function uploadImage(file, productId) {
  if (!file) return null;
 
  const extension = file.name.split(".").pop().toLowerCase();
 
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
    throw new Error("Format image non accepté");
  }
 
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
 
  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
 
  if (error) throw error;
 
  return path;
}
 
$("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
 
  try {
    const productId = $("#productId").value || crypto.randomUUID();
 
    const payload = {
      id: productId,
      name: $("#pName").value.trim(),
      price: Number($("#pPrice").value),
      description: $("#pDescription").value.trim(),
      category_id: $("#pCategory").value || null,
      active: $("#pActive").checked,
      is_new: $("#pNew").checked,
      is_featured: $("#pFeatured").checked
    };
 
    const file = $("#pImage").files[0];
 
    if (file) {
      payload.image_path = await uploadImage(file, productId);
    }
 
    let result;
 
    if ($("#productId").value) {
      result = await db.from("products").update(payload).eq("id", productId);
    } else {
      result = await db.from("products").insert(payload);
    }
 
    if (result.error) throw result.error;
 
    const stockRows = sizes.map((size) => ({
      product_id: productId,
      size,
      enabled: $(`[data-enabled="${size}"]`).checked,
      quantity: Math.max(0, Number($(`[data-qty="${size}"]`).value || 0))
    }));
 
    const stockResult = await db
      .from("product_sizes")
      .upsert(stockRows, { onConflict: "product_id,size" });
 
    if (stockResult.error) throw stockResult.error;
 
    toast("Produit enregistré");
    $("#productModal").close();
 
    await loadAll();
  } catch (error) {
    console.error(error);
    toast(error.message || "Erreur");
  }
});
 
async function deleteProduct(id) {
  if (!confirm("Supprimer définitivement ce produit ?")) return;
 
  const { error } = await db.from("products").delete().eq("id", id);
 
  if (error) {
    toast(error.message);
    return;
  }
 
  toast("Produit supprimé");
  await loadAll();
}
 
$("#addProduct").onclick = () => openProduct();
$("#cancelModal").onclick = () => $("#productModal").close();
$("#adminSearch").oninput = render;
$("#adminCategory").onchange = render;
$("#adminStock").onchange = render;
 
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
 
  $("#loginError").textContent = "";
 
  const { data, error } = await db.auth.signInWithPassword({
    email: $("#email").value,
    password: $("#password").value
  });
 
  if (error) {
    $("#loginError").textContent = error.message;
    return;
  }
 
  if (!(await isAdmin())) {
    await db.auth.signOut();
    $("#loginError").textContent =
      "Ce compte n'est pas autorisé à accéder à l'administration.";
    return;
  }
 
  showAdmin(data.user);
});
 
$("#logout").onclick = async () => {
  await db.auth.signOut();
  showLogin();
};
 
$("#createCategory").onclick = async () => {
  const name = $("#newCategory").value.trim();
  if (!name) return;
 
  const { error } = await db
    .from("categories")
    .insert({ name, sort_order: categories.length });
 
  if (error) {
    toast(error.message);
    return;
  }
 
  $("#newCategory").value = "";
  toast("Catégorie ajoutée");
 
  await loadAll();
};
 
function openCategory(id) {
  const category = categories.find((item) => item.id === id);
  if (!category) return;
 
  $("#categoryId").value = category.id;
  $("#categoryName").value = category.name;
  $("#categoryModal").showModal();
}
 
$("#cancelCategory").onclick = () => $("#categoryModal").close();
 
$("#categoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
 
  const { error } = await db
    .from("categories")
    .update({ name: $("#categoryName").value.trim() })
    .eq("id", $("#categoryId").value);
 
  if (error) {
    toast(error.message);
    return;
  }
 
  $("#categoryModal").close();
  toast("Catégorie modifiée");
 
  await loadAll();
});
 
db.channel("admin-live")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "products" },
    loadAll
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "product_sizes" },
    loadAll
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "categories" },
    loadAll
  )
  .subscribe();
 
start();
 
